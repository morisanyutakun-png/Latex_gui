"""OMR service — image/PDF → raw LaTeX via OpenAI Vision

方針:
  - 画像/PDF からテキスト・数式・表・図を読み取り、raw LaTeX として返す
  - AI には set_latex ツール (簡略版) を使わせて完全な LaTeX を返させる
  - PDF は PyMuPDF (fitz) → poppler → text-only の3段フォールバック
"""
import base64
import json
import logging
import os
import subprocess
import tempfile

from .ai_service import get_client, MODEL_VISION

logger = logging.getLogger(__name__)


OMR_SYSTEM_PROMPT = r"""\
You are an OMR (Optical Mark Recognition) assistant inside a Japanese LaTeX
editor (Eddivom / かんたんPDFメーカー). The editor uses a *raw LaTeX* document
model — you must output a complete, compilable LaTeX document.

## What to extract
- Text headings → \section / \subsection / \subsubsection
- Body text → ordinary paragraphs
- Math → use $...$ for inline math and \[ ... \] (or $$...$$) for display math
- Lists → itemize / enumerate
- Tables → tabular / booktabs
- Chemical formulas → \ce{...} (mhchem)
- Diagrams / figures → \begin{figure} ... \end{figure} placeholder
- Multi-choice answer sheets → list with \item entries

## How to respond
You MUST call the `set_latex` tool with a single argument `latex` containing
the FULL LaTeX source. The source MUST be a complete document that compiles
under LuaLaTeX with luatexja-preset for Japanese.

### Required preamble
\documentclass[11pt,a4paper]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{amsmath, amssymb, amsthm, mathtools}
\usepackage{geometry}
\geometry{margin=20mm}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{graphicx}

You may add other allowed packages (tikz, mhchem, hyperref, xcolor, tcolorbox,
multicol, etc.) when needed.

### CRITICAL rules
- Always call set_latex once. Do NOT print the LaTeX in the chat reply.
- Always wrap math correctly:
  * inline: $x^2 + 1$
  * display: \[ \int_0^1 f(x)\,dx \]
- Preserve paragraph breaks visible in the source.
- If something is unclear, transcribe what you can read and add "(要確認)".
- Respond in Japanese for any chat reply (but the LaTeX itself can mix as needed).
- Do NOT use forbidden commands: \input, \include, \write18, \directlua, etc.
"""


OMR_PDF_SYSTEM_PROMPT = OMR_SYSTEM_PROMPT + """

## PDF-specific instructions
- The user uploaded a multi-page PDF. Treat it as one continuous document.
- Use the extracted text as the primary source and the page images for verification.
- Number sections naturally (e.g. "第1章", "1.", "問1") if the original has them.
"""


OMR_HANDWRITING_PROMPT = OMR_SYSTEM_PROMPT + """

## Handwriting mode
The image is HANDWRITTEN (notebook, board, exam answer). Be extra careful with:
- Greek letters (α/a, β/B, ε/E, θ/0, π/n)
- Sub/superscripts
- Fractions / square roots / matrices
- 日本語の崩し字
- Crossed-out / struck-through content → SKIP
Where unsure, transcribe + "(要確認)".
"""


OMR_TEXT_ONLY_PROMPT = OMR_SYSTEM_PROMPT + """

## Text-only PDF instructions
You only have raw extracted text (no images). Reconstruct the logical structure
from line breaks and section numbering.
"""


# ─── Tool definition (simplified set_latex for OMR) ──────────────────────────

def _build_omr_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "set_latex",
                "description": (
                    "Set the full LaTeX source of the document. Provide a complete, "
                    "compilable LaTeX document including \\documentclass and "
                    "\\begin{document} ... \\end{document}."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "latex": {
                            "type": "string",
                            "description": "The full LaTeX source.",
                        },
                    },
                    "required": ["latex"],
                },
            },
        }
    ]


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _image_to_data_url(image_bytes: bytes, media_type: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{media_type};base64,{b64}"


# ─── PDF extraction strategies ──────────────────────────────────────────────

def _pdf_extract_pymupdf(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Extract text + images using PyMuPDF (fitz)."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = min(len(doc), max_pages)

    texts: list[str] = []
    images: list[tuple[bytes, str]] = []

    for i in range(page_count):
        page = doc[i]
        text = page.get_text("text")
        texts.append(text.strip())

        mat = fitz.Matrix(150 / 72, 150 / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        images.append((img_bytes, "image/png"))

    doc.close()
    return {"texts": texts, "images": images, "page_count": page_count}


def _pdf_extract_poppler(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Fallback: poppler-utils (pdftoppm)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        result = subprocess.run(
            ["pdfinfo", pdf_path],
            capture_output=True, text=True, timeout=10,
        )
        page_count = 1
        for line in result.stdout.splitlines():
            if line.startswith("Pages:"):
                page_count = int(line.split(":")[1].strip())
                break

        pages_to_process = min(page_count, max_pages)

        subprocess.run(
            [
                "pdftoppm", "-png", "-r", "200",
                "-l", str(pages_to_process),
                pdf_path, os.path.join(tmpdir, "page"),
            ],
            capture_output=True, timeout=60,
            check=True,
        )

        images: list[tuple[bytes, str]] = []
        for fname in sorted(os.listdir(tmpdir)):
            if fname.startswith("page") and fname.endswith(".png"):
                with open(os.path.join(tmpdir, fname), "rb") as img_f:
                    images.append((img_f.read(), "image/png"))

        texts: list[str] = []
        try:
            text_result = subprocess.run(
                ["pdftotext", "-layout", pdf_path, "-"],
                capture_output=True, text=True, timeout=30,
            )
            if text_result.returncode == 0 and text_result.stdout.strip():
                pages = text_result.stdout.split("\f")
                texts = [p.strip() for p in pages if p.strip()]
        except Exception:
            pass

        return {"texts": texts, "images": images, "page_count": pages_to_process}


def _pdf_extract_text_only(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Last resort: text only via PyMuPDF."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = min(len(doc), max_pages)
        texts = []
        for i in range(page_count):
            text = doc[i].get_text("text")
            texts.append(text.strip())
        doc.close()
        return {"texts": texts, "images": [], "page_count": page_count}
    except ImportError:
        return {"texts": [], "images": [], "page_count": 0}


async def _extract_pdf_content(pdf_bytes: bytes):
    import asyncio
    try:
        result = await asyncio.to_thread(_pdf_extract_pymupdf, pdf_bytes)
        if result["page_count"] > 0:
            return {**result, "method": "pymupdf"}
    except ImportError:
        logger.info("PyMuPDF not available, trying poppler")
    except Exception as e:
        logger.warning("PyMuPDF extraction failed: %s", e)

    try:
        result = await asyncio.to_thread(_pdf_extract_poppler, pdf_bytes)
        if result["images"]:
            return {**result, "method": "poppler"}
    except FileNotFoundError:
        logger.info("poppler-utils not installed")
    except Exception as e:
        logger.warning("poppler extraction failed: %s", e)

    try:
        result = await asyncio.to_thread(_pdf_extract_text_only, pdf_bytes)
        if any(result["texts"]):
            return {**result, "method": "text_only"}
    except Exception as e:
        logger.warning("Text-only extraction failed: %s", e)

    return {"texts": [], "images": [], "page_count": 0, "method": "none"}


# ─── Response parsing ──────────────────────────────────────────────────────

def _extract_latex_from_response(response) -> tuple[list[str], str | None]:
    """Extract text and raw LaTeX from an OpenAI response."""
    text_parts: list[str] = []
    latex: str | None = None
    try:
        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            text_parts.append(msg.content)

        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.function.name == "set_latex":
                    try:
                        parsed = json.loads(tc.function.arguments)
                        candidate = parsed.get("latex")
                        if isinstance(candidate, str) and candidate.strip():
                            latex = candidate
                            logger.info("OMR: Extracted %d chars of LaTeX", len(latex))
                    except json.JSONDecodeError as e:
                        logger.warning("OMR: set_latex args parse failed: %s", e)
        else:
            logger.warning("OMR: No tool_calls in response. finish_reason=%s",
                           choice.finish_reason)
    except (IndexError, AttributeError) as e:
        logger.warning("OpenAI OMR response parse failed: %s", e)
    return text_parts, latex


# ─── Image analysis ──────────────────────────────────────────────────────────

async def analyze_image(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
) -> dict:
    """OpenAI Vision で画像/PDFを解析し、raw LaTeX を返す。"""
    result = {"description": "", "latex": None}
    async for event_str in analyze_image_stream(image_bytes, media_type, document_context, hint):
        if event_str.startswith("data: "):
            try:
                event = json.loads(event_str[6:])
                if event.get("type") == "done":
                    result["description"] = event.get("description", "")
                    result["latex"] = event.get("latex")
                elif event.get("type") == "error":
                    result["description"] = event.get("message", "")
            except json.JSONDecodeError:
                pass
    return result


async def _detect_handwriting(client, data_url: str) -> bool:
    """画像が手書きかどうかを軽量モデルで判定する。"""
    import asyncio
    try:
        def _call():
            return client.chat.completions.create(
                model=MODEL_VISION,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
                            {"type": "text", "text": (
                                "この画像の主要な内容は手書き(handwritten)ですか、それとも活字(printed)ですか? "
                                "1単語のみで答えてください: 'handwritten' か 'printed'."
                            )},
                        ],
                    }
                ],
                temperature=0,
                max_tokens=8,
            )
        resp = await asyncio.to_thread(_call)
        ans = (resp.choices[0].message.content or "").strip().lower()
        return "hand" in ans
    except Exception as e:
        logger.warning("handwriting detection failed: %s", e)
        return False


def _hint_forces_handwriting(hint: str) -> bool | None:
    if not hint:
        return None
    h = hint.lower()
    if "handwriting" in h or "handwritten" in h or "手書き" in hint:
        return True
    if "printed" in h or "typeset" in h or "活字" in hint or "印刷" in hint:
        return False
    return None


async def analyze_image_stream(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
):
    """SSEストリーミング版のOMR解析（OpenAI Vision）。"""
    import asyncio

    if media_type == "application/pdf":
        async for event in _analyze_pdf_stream(image_bytes, document_context, hint):
            yield event
        return

    yield _sse({"type": "progress", "phase": "analyzing", "message": "画像を解析中..."})

    client = get_client()
    data_url = _image_to_data_url(image_bytes, media_type)

    forced = _hint_forces_handwriting(hint)
    if forced is True:
        is_handwriting = True
    elif forced is False:
        is_handwriting = False
    else:
        yield _sse({"type": "progress", "phase": "detecting", "message": "手書き / 活字を判定中..."})
        is_handwriting = await _detect_handwriting(client, data_url)

    if is_handwriting:
        yield _sse({"type": "progress", "phase": "mode", "message": "手書きモードで読み取ります"})
        system_prompt = OMR_HANDWRITING_PROMPT
    else:
        system_prompt = OMR_SYSTEM_PROMPT

    prompt_text = (
        f"この画像からドキュメント構造を抽出してください。{hint}"
        if hint
        else "この画像からドキュメント構造を抽出して、set_latexツールで完全なLaTeXソースを返してください。"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                {"type": "text", "text": prompt_text},
            ],
        },
    ]

    tools = _build_omr_tools()

    MAX_RETRIES = 2
    latex: str | None = None
    text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying", "message": f"再解析中... (試行 {attempt}/{MAX_RETRIES})"})

        yield _sse({"type": "progress", "phase": "ai_processing", "message": "AIがコンテンツを認識中..."})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.3,
                    max_tokens=16384,
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("OpenAI OMR API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({"type": "error", "message": f"AI解析エラー: {str(e)[:200]}"})
            return

        text_parts, latex = _extract_latex_from_response(response)

        if latex:
            break

    yield _sse({"type": "progress", "phase": "extracting", "message": "LaTeXを構成中..."})

    description = "\n".join(text_parts).strip()
    if not description and latex:
        description = f"画像から{len(latex)}文字のLaTeXソースを抽出しました。"

    yield _sse({
        "type": "done",
        "description": description,
        "latex": latex,
    })


# ─── PDF analysis ──────────────────────────────────────────────────────────

async def _analyze_pdf_stream(
    pdf_bytes: bytes,
    document_context: dict,
    hint: str = "",
):
    """PDFからテキスト+画像を抽出し、OpenAI APIで raw LaTeX に変換する。"""
    import asyncio

    yield _sse({"type": "progress", "phase": "converting", "message": "PDFを解析中..."})

    extraction = await _extract_pdf_content(pdf_bytes)

    method = extraction.get("method", "none")
    page_count = extraction.get("page_count", 0)
    texts = extraction.get("texts", [])
    images = extraction.get("images", [])
    has_text = any(t.strip() for t in texts)
    has_images = len(images) > 0

    if page_count == 0 and not has_text:
        yield _sse({"type": "error", "message": "PDFからコンテンツを抽出できませんでした。"})
        return

    yield _sse({"type": "progress", "phase": "converted",
                "message": f"{page_count}ページを検出 (方式: {method})"})

    client = get_client()
    tools = _build_omr_tools()

    page_label = f"{page_count}ページのPDF" if page_count > 1 else "1ページのPDF"

    forced = _hint_forces_handwriting(hint)
    is_handwriting = False
    if forced is True:
        is_handwriting = True
    elif forced is False:
        is_handwriting = False
    elif has_images and not has_text:
        yield _sse({"type": "progress", "phase": "detecting", "message": "手書き / 活字を判定中..."})
        first_data_url = _image_to_data_url(images[0][0], images[0][1])
        is_handwriting = await _detect_handwriting(client, first_data_url)
        if is_handwriting:
            yield _sse({"type": "progress", "phase": "mode", "message": "手書きモードで読み取ります"})

    if has_images and has_text:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": f"AIが{page_count}ページのテキストと画像を解析中..."})
        messages = _build_pdf_messages_with_text_and_images(
            texts, images, page_count, page_label, hint)
        system_prompt = OMR_PDF_SYSTEM_PROMPT
    elif has_images:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": f"AIが{page_count}ページの画像を解析中..."})
        messages = _build_pdf_messages_images_only(
            images, page_count, page_label, hint)
        system_prompt = OMR_HANDWRITING_PROMPT if is_handwriting else OMR_PDF_SYSTEM_PROMPT
    else:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": "AIがテキストからLaTeXを構成中..."})
        messages = _build_pdf_messages_text_only(
            texts, page_count, page_label, hint)
        system_prompt = OMR_TEXT_ONLY_PROMPT

    messages.insert(0, {"role": "system", "content": system_prompt})

    MAX_RETRIES = 2
    latex: str | None = None
    resp_text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying",
                        "message": f"再解析中... (試行 {attempt}/{MAX_RETRIES})"})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.3,
                    max_tokens=16384,
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("OpenAI OMR PDF API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({"type": "error", "message": f"AI解析エラー: {str(e)[:200]}"})
            return

        resp_text_parts, latex = _extract_latex_from_response(response)

        if latex:
            break

    yield _sse({"type": "progress", "phase": "extracting", "message": "LaTeXを構成中..."})

    description = "\n".join(resp_text_parts).strip()
    if not description and latex:
        description = f"PDFから{len(latex)}文字のLaTeXソースを抽出しました（{page_count}ページ）。"

    yield _sse({
        "type": "done",
        "description": description,
        "latex": latex,
    })


# ─── Message builders ─────────────────────────────────────────────────────

def _build_pdf_messages_with_text_and_images(
    texts: list[str], images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
) -> list[dict]:
    content_parts: list[dict] = []

    for i in range(page_count):
        content_parts.append({
            "type": "text",
            "text": f"--- ページ {i + 1}/{page_count} ---\n[抽出テキスト]\n{texts[i] if i < len(texts) else '(テキストなし)'}",
        })
        if i < len(images):
            data_url = _image_to_data_url(images[i][0], images[i][1])
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": data_url, "detail": "high"},
            })

    prompt = (
        f"この{page_label}からドキュメント構造を抽出してください。{hint}"
        if hint
        else (
            f"上記の{page_label}から抽出したテキストとページ画像を確認し、"
            "set_latex ツールで完全なLaTeXソースを返してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        )
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_images_only(
    images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
) -> list[dict]:
    content_parts: list[dict] = []

    for i in range(min(page_count, len(images))):
        if page_count > 1:
            content_parts.append({"type": "text", "text": f"--- ページ {i + 1}/{page_count} ---"})
        data_url = _image_to_data_url(images[i][0], images[i][1])
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": data_url, "detail": "high"},
        })

    prompt = (
        f"この{page_label}からドキュメント構造を抽出してください。{hint}"
        if hint
        else (
            f"この{page_label}のページ画像からテキスト・数式・表などを読み取り、"
            "set_latex ツールで完全なLaTeXソースを返してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        )
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_text_only(
    texts: list[str],
    page_count: int, page_label: str, hint: str,
) -> list[dict]:
    combined_text = ""
    for i, text in enumerate(texts):
        if text.strip():
            if page_count > 1:
                combined_text += f"\n\n=== ページ {i + 1}/{page_count} ===\n\n"
            combined_text += text

    prompt = (
        f"以下は{page_label}から抽出したテキストです。{hint}\n\n"
        if hint
        else (
            f"以下は{page_label}から抽出した生テキストです。\n"
            "このテキストを解析して、set_latex ツールで完全なLaTeXソースを返してください。\n"
            "見出し、本文、数式、リスト、表などを適切な LaTeX 構文に変換してください。\n\n"
        )
    )

    return [{"role": "user", "content": prompt + combined_text}]

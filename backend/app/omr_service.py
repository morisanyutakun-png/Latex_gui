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

from .ai_service import get_client, MODEL_VISION, max_tokens_param

logger = logging.getLogger(__name__)


_OMR_SYSTEM_PROMPT_JA = r"""\
You are an OMR (Optical Mark Recognition) assistant inside a Japanese LaTeX
editor (Eddivom). The editor uses a *raw LaTeX* document model — you must
output a complete, compilable LaTeX document.

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


_OMR_SYSTEM_PROMPT_EN = r"""\
You are an OMR (Optical Mark Recognition) assistant inside an English LaTeX
editor (Eddivom). The editor uses a *raw LaTeX* document model — you must
output a complete, compilable LaTeX document.

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
under LuaLaTeX for English.

### Required preamble
\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{amsmath, amssymb, amsthm, mathtools}
\usepackage{geometry}
\geometry{margin=20mm}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{graphicx}

You may add other allowed packages (tikz, mhchem, hyperref, xcolor, tcolorbox,
multicol, etc.) when needed. **Do not add `luatexja-preset` — this is an
English document.**

### CRITICAL rules
- Always call set_latex once. Do NOT print the LaTeX in the chat reply.
- Always wrap math correctly:
  * inline: $x^2 + 1$
  * display: \[ \int_0^1 f(x)\,dx \]
- Preserve paragraph breaks visible in the source.
- If something is unclear, transcribe what you can read and mark it "(unclear)".
- Respond in English for any chat reply.
- Do NOT use forbidden commands: \input, \include, \write18, \directlua, etc.
- Do NOT mix Japanese preamble packages — this is an English-first workflow.
"""


def _omr_prompts(locale: str) -> dict[str, str]:
    """Return the four OMR prompt variants (base / pdf / handwriting / text-only)
    for the given UI locale. Falls back to Japanese for any non-'en' locale."""
    if (locale or "").lower() == "en":
        base = _OMR_SYSTEM_PROMPT_EN
        pdf_extra = (
            "\n\n## PDF-specific instructions\n"
            "- The user uploaded a multi-page PDF. Treat it as one continuous document.\n"
            "- Use the extracted text as the primary source and the page images for verification.\n"
            "- Number sections naturally (e.g. 'Chapter 1', '1.', 'Problem 1') if the original has them.\n"
        )
        hw_extra = (
            "\n\n## Handwriting mode\n"
            "The image is HANDWRITTEN (notebook, whiteboard, exam answer). Be extra careful with:\n"
            "- Greek letters (α/a, β/B, ε/E, θ/0, π/n)\n"
            "- Sub/superscripts\n"
            "- Fractions / square roots / matrices\n"
            "- Crossed-out / struck-through content → SKIP\n"
            "Where unsure, transcribe what you see and mark it '(unclear)'.\n"
        )
        text_extra = (
            "\n\n## Text-only PDF instructions\n"
            "You only have raw extracted text (no images). Reconstruct the logical structure\n"
            "from line breaks and section numbering.\n"
        )
    else:
        base = _OMR_SYSTEM_PROMPT_JA
        pdf_extra = (
            "\n\n## PDF-specific instructions\n"
            "- The user uploaded a multi-page PDF. Treat it as one continuous document.\n"
            "- Use the extracted text as the primary source and the page images for verification.\n"
            '- Number sections naturally (e.g. "第1章", "1.", "問1") if the original has them.\n'
        )
        hw_extra = (
            "\n\n## Handwriting mode\n"
            "The image is HANDWRITTEN (notebook, board, exam answer). Be extra careful with:\n"
            "- Greek letters (α/a, β/B, ε/E, θ/0, π/n)\n"
            "- Sub/superscripts\n"
            "- Fractions / square roots / matrices\n"
            "- 日本語の崩し字\n"
            "- Crossed-out / struck-through content → SKIP\n"
            'Where unsure, transcribe + "(要確認)".\n'
        )
        text_extra = (
            "\n\n## Text-only PDF instructions\n"
            "You only have raw extracted text (no images). Reconstruct the logical structure\n"
            "from line breaks and section numbering.\n"
        )
    return {
        "base": base,
        "pdf": base + pdf_extra,
        "handwriting": base + hw_extra,
        "text_only": base + text_extra,
    }


# Japanese-locale defaults (kept for backward compatibility).
OMR_SYSTEM_PROMPT = _OMR_SYSTEM_PROMPT_JA
OMR_PDF_SYSTEM_PROMPT = _omr_prompts("ja")["pdf"]
OMR_HANDWRITING_PROMPT = _omr_prompts("ja")["handwriting"]
OMR_TEXT_ONLY_PROMPT = _omr_prompts("ja")["text_only"]


def _omr_status(locale: str) -> dict[str, str]:
    """Return status/progress strings for the OMR streaming responses."""
    if (locale or "").lower() == "en":
        return {
            "analyzing_image": "Analyzing image...",
            "detecting_mode": "Detecting handwritten vs printed…",
            "handwriting_mode": "Reading in handwriting mode",
            "ai_recognizing": "AI is recognizing content...",
            "retrying": "Retrying… (attempt {attempt}/{total})",
            "building_latex": "Building LaTeX...",
            "pdf_analyzing": "Analyzing PDF...",
            "pdf_pages": "Detected {pages} page(s) (method: {method})",
            "extract_failed": "Could not extract content from the PDF.",
            "ai_text_images": "AI is analyzing text and page images for {pages} page(s)...",
            "ai_images": "AI is analyzing {pages} page image(s)...",
            "ai_text_only": "AI is reconstructing LaTeX from the extracted text...",
            "ai_error": "AI analysis error: {err}",
            "extracted_summary": "Extracted {chars} characters of LaTeX from the image.",
            "extracted_summary_pdf": "Extracted {chars} characters of LaTeX from the PDF ({pages} pages).",
            "pdf_label_multi": "{pages}-page PDF",
            "pdf_label_single": "1-page PDF",
            "user_prompt_image": "Extract the document structure from this image and return the full LaTeX via the set_latex tool.",
            "user_prompt_image_hinted": "Extract the document structure from this image. {hint}",
            "user_prompt_pdf_multi_with_text": (
                "Review the extracted text and page images from this {label} and return the full "
                "LaTeX source via the set_latex tool. Treat the whole document as one continuous piece."
            ),
            "user_prompt_pdf_multi_with_text_hinted": "Extract the document structure from this {label}. {hint}",
            "user_prompt_pdf_images_only": (
                "Read the text, math and tables from this {label} and return the full LaTeX "
                "source via the set_latex tool. Treat the whole document as one continuous piece."
            ),
            "user_prompt_pdf_images_only_hinted": "Extract the document structure from this {label}. {hint}",
            "user_prompt_pdf_text_only": (
                "Below is the raw text extracted from this {label}.\n"
                "Parse it and return the full LaTeX source via the set_latex tool.\n"
                "Convert headings, body text, math, lists and tables into proper LaTeX syntax.\n\n"
            ),
            "user_prompt_pdf_text_only_hinted": "Below is the raw text extracted from this {label}. {hint}\n\n",
            "page_block_label": "--- Page {i}/{n} ---",
            "page_block_text_label": "--- Page {i}/{n} ---\n[Extracted text]\n{text}",
            "page_block_text_empty": "(no text)",
            "page_separator_text_only": "\n\n=== Page {i}/{n} ===\n\n",
        }
    return {
        "analyzing_image": "画像を解析中...",
        "detecting_mode": "手書き / 活字を判定中...",
        "handwriting_mode": "手書きモードで読み取ります",
        "ai_recognizing": "AIがコンテンツを認識中...",
        "retrying": "再解析中... (試行 {attempt}/{total})",
        "building_latex": "LaTeXを構成中...",
        "pdf_analyzing": "PDFを解析中...",
        "pdf_pages": "{pages}ページを検出 (方式: {method})",
        "extract_failed": "PDFからコンテンツを抽出できませんでした。",
        "ai_text_images": "AIが{pages}ページのテキストと画像を解析中...",
        "ai_images": "AIが{pages}ページの画像を解析中...",
        "ai_text_only": "AIがテキストからLaTeXを構成中...",
        "ai_error": "AI解析エラー: {err}",
        "extracted_summary": "画像から{chars}文字のLaTeXソースを抽出しました。",
        "extracted_summary_pdf": "PDFから{chars}文字のLaTeXソースを抽出しました（{pages}ページ）。",
        "pdf_label_multi": "{pages}ページのPDF",
        "pdf_label_single": "1ページのPDF",
        "user_prompt_image": "この画像からドキュメント構造を抽出して、set_latexツールで完全なLaTeXソースを返してください。",
        "user_prompt_image_hinted": "この画像からドキュメント構造を抽出してください。{hint}",
        "user_prompt_pdf_multi_with_text": (
            "上記の{label}から抽出したテキストとページ画像を確認し、"
            "set_latex ツールで完全なLaTeXソースを返してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        ),
        "user_prompt_pdf_multi_with_text_hinted": "この{label}からドキュメント構造を抽出してください。{hint}",
        "user_prompt_pdf_images_only": (
            "この{label}のページ画像からテキスト・数式・表などを読み取り、"
            "set_latex ツールで完全なLaTeXソースを返してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        ),
        "user_prompt_pdf_images_only_hinted": "この{label}からドキュメント構造を抽出してください。{hint}",
        "user_prompt_pdf_text_only": (
            "以下は{label}から抽出した生テキストです。\n"
            "このテキストを解析して、set_latex ツールで完全なLaTeXソースを返してください。\n"
            "見出し、本文、数式、リスト、表などを適切な LaTeX 構文に変換してください。\n\n"
        ),
        "user_prompt_pdf_text_only_hinted": "以下は{label}から抽出したテキストです。{hint}\n\n",
        "page_block_label": "--- ページ {i}/{n} ---",
        "page_block_text_label": "--- ページ {i}/{n} ---\n[抽出テキスト]\n{text}",
        "page_block_text_empty": "(テキストなし)",
        "page_separator_text_only": "\n\n=== ページ {i}/{n} ===\n\n",
    }


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
    """Extract text + images using PyMuPDF (fitz).

    images は `(bytes, mime, width_px, height_px)` のタプル列。
    後方互換のため、既存呼び出しは `bytes, mime, *_extra = item` でアンパックする。
    """
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = min(len(doc), max_pages)

    texts: list[str] = []
    images: list[tuple] = []

    for i in range(page_count):
        page = doc[i]
        text = page.get_text("text")
        texts.append(text.strip())

        mat = fitz.Matrix(150 / 72, 150 / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        images.append((img_bytes, "image/png", pix.width, pix.height))

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

        images: list[tuple] = []
        for fname in sorted(os.listdir(tmpdir)):
            if fname.startswith("page") and fname.endswith(".png"):
                fpath = os.path.join(tmpdir, fname)
                with open(fpath, "rb") as img_f:
                    img_bytes = img_f.read()
                # try to read dimensions via PIL if available; otherwise fall back to 0
                width, height = 0, 0
                try:
                    from PIL import Image
                    import io as _io
                    with Image.open(_io.BytesIO(img_bytes)) as im:
                        width, height = im.size
                except Exception:
                    pass
                images.append((img_bytes, "image/png", width, height))

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
    locale: str = "ja",
) -> dict:
    """OpenAI Vision で画像/PDFを解析し、raw LaTeX を返す。"""
    result = {"description": "", "latex": None}
    async for event_str in analyze_image_stream(
        image_bytes, media_type, document_context, hint, locale=locale,
    ):
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
                **max_tokens_param(MODEL_VISION, 8),
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
    locale: str = "ja",
):
    """SSEストリーミング版のOMR解析（OpenAI Vision）。"""
    import asyncio

    status = _omr_status(locale)
    prompts = _omr_prompts(locale)

    if media_type == "application/pdf":
        async for event in _analyze_pdf_stream(image_bytes, document_context, hint, locale=locale):
            yield event
        return

    yield _sse({"type": "progress", "phase": "analyzing", "message": status["analyzing_image"]})

    client = get_client()
    data_url = _image_to_data_url(image_bytes, media_type)

    forced = _hint_forces_handwriting(hint)
    if forced is True:
        is_handwriting = True
    elif forced is False:
        is_handwriting = False
    else:
        yield _sse({"type": "progress", "phase": "detecting", "message": status["detecting_mode"]})
        is_handwriting = await _detect_handwriting(client, data_url)

    if is_handwriting:
        yield _sse({"type": "progress", "phase": "mode", "message": status["handwriting_mode"]})
        system_prompt = prompts["handwriting"]
    else:
        system_prompt = prompts["base"]

    prompt_text = (
        status["user_prompt_image_hinted"].format(hint=hint)
        if hint
        else status["user_prompt_image"]
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
            yield _sse({"type": "progress", "phase": "retrying",
                        "message": status["retrying"].format(attempt=attempt, total=MAX_RETRIES)})

        yield _sse({"type": "progress", "phase": "ai_processing", "message": status["ai_recognizing"]})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.3,
                    **max_tokens_param(MODEL_VISION, 16384),
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("OpenAI OMR API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({"type": "error", "message": status["ai_error"].format(err=str(e)[:200])})
            return

        text_parts, latex = _extract_latex_from_response(response)

        if latex:
            break

    yield _sse({"type": "progress", "phase": "extracting", "message": status["building_latex"]})

    description = "\n".join(text_parts).strip()
    if not description and latex:
        description = status["extracted_summary"].format(chars=len(latex))

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
    locale: str = "ja",
):
    """PDFからテキスト+画像を抽出し、OpenAI APIで raw LaTeX に変換する。"""
    import asyncio

    status = _omr_status(locale)
    prompts = _omr_prompts(locale)

    yield _sse({"type": "progress", "phase": "converting", "message": status["pdf_analyzing"]})

    extraction = await _extract_pdf_content(pdf_bytes)

    method = extraction.get("method", "none")
    page_count = extraction.get("page_count", 0)
    texts = extraction.get("texts", [])
    images = extraction.get("images", [])
    has_text = any(t.strip() for t in texts)
    has_images = len(images) > 0

    if page_count == 0 and not has_text:
        yield _sse({"type": "error", "message": status["extract_failed"]})
        return

    yield _sse({"type": "progress", "phase": "converted",
                "message": status["pdf_pages"].format(pages=page_count, method=method)})

    client = get_client()
    tools = _build_omr_tools()

    page_label = (
        status["pdf_label_multi"].format(pages=page_count)
        if page_count > 1
        else status["pdf_label_single"]
    )

    forced = _hint_forces_handwriting(hint)
    is_handwriting = False
    if forced is True:
        is_handwriting = True
    elif forced is False:
        is_handwriting = False
    elif has_images and not has_text:
        yield _sse({"type": "progress", "phase": "detecting", "message": status["detecting_mode"]})
        first_data_url = _image_to_data_url(images[0][0], images[0][1])
        is_handwriting = await _detect_handwriting(client, first_data_url)
        if is_handwriting:
            yield _sse({"type": "progress", "phase": "mode", "message": status["handwriting_mode"]})

    if has_images and has_text:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": status["ai_text_images"].format(pages=page_count)})
        messages = _build_pdf_messages_with_text_and_images(
            texts, images, page_count, page_label, hint, status)
        system_prompt = prompts["pdf"]
    elif has_images:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": status["ai_images"].format(pages=page_count)})
        messages = _build_pdf_messages_images_only(
            images, page_count, page_label, hint, status)
        system_prompt = prompts["handwriting"] if is_handwriting else prompts["pdf"]
    else:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": status["ai_text_only"]})
        messages = _build_pdf_messages_text_only(
            texts, page_count, page_label, hint, status)
        system_prompt = prompts["text_only"]

    messages.insert(0, {"role": "system", "content": system_prompt})

    MAX_RETRIES = 2
    latex: str | None = None
    resp_text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying",
                        "message": status["retrying"].format(attempt=attempt, total=MAX_RETRIES)})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.3,
                    **max_tokens_param(MODEL_VISION, 16384),
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("OpenAI OMR PDF API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({"type": "error", "message": status["ai_error"].format(err=str(e)[:200])})
            return

        resp_text_parts, latex = _extract_latex_from_response(response)

        if latex:
            break

    yield _sse({"type": "progress", "phase": "extracting", "message": status["building_latex"]})

    description = "\n".join(resp_text_parts).strip()
    if not description and latex:
        description = status["extracted_summary_pdf"].format(chars=len(latex), pages=page_count)

    yield _sse({
        "type": "done",
        "description": description,
        "latex": latex,
    })


# ─── Message builders ─────────────────────────────────────────────────────

def _build_pdf_messages_with_text_and_images(
    texts: list[str], images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
    status: dict[str, str],
) -> list[dict]:
    content_parts: list[dict] = []

    for i in range(page_count):
        page_text = texts[i] if i < len(texts) else status["page_block_text_empty"]
        content_parts.append({
            "type": "text",
            "text": status["page_block_text_label"].format(i=i + 1, n=page_count, text=page_text),
        })
        if i < len(images):
            data_url = _image_to_data_url(images[i][0], images[i][1])
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": data_url, "detail": "high"},
            })

    prompt = (
        status["user_prompt_pdf_multi_with_text_hinted"].format(label=page_label, hint=hint)
        if hint
        else status["user_prompt_pdf_multi_with_text"].format(label=page_label)
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_images_only(
    images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
    status: dict[str, str],
) -> list[dict]:
    content_parts: list[dict] = []

    for i in range(min(page_count, len(images))):
        if page_count > 1:
            content_parts.append({
                "type": "text",
                "text": status["page_block_label"].format(i=i + 1, n=page_count),
            })
        data_url = _image_to_data_url(images[i][0], images[i][1])
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": data_url, "detail": "high"},
        })

    prompt = (
        status["user_prompt_pdf_images_only_hinted"].format(label=page_label, hint=hint)
        if hint
        else status["user_prompt_pdf_images_only"].format(label=page_label)
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_text_only(
    texts: list[str],
    page_count: int, page_label: str, hint: str,
    status: dict[str, str],
) -> list[dict]:
    combined_text = ""
    for i, text in enumerate(texts):
        if text.strip():
            if page_count > 1:
                combined_text += status["page_separator_text_only"].format(i=i + 1, n=page_count)
            combined_text += text

    prompt = (
        status["user_prompt_pdf_text_only_hinted"].format(label=page_label, hint=hint)
        if hint
        else status["user_prompt_pdf_text_only"].format(label=page_label)
    )

    return [{"role": "user", "content": prompt + combined_text}]

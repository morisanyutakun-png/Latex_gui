"""OMR service — image/PDF → structured document blocks via OpenAI Vision
SSEストリーミング対応: 進捗をリアルタイムでフロントエンドへ送信。

PDFテキスト抽出は2段構え:
  1. PyMuPDF (fitz) でテキスト直接抽出 → ページ画像レンダリング
  2. poppler (pdftoppm) をフォールバック
  3. テキスト抽出のみ (画像なし) を最終フォールバック
"""
import base64
import json
import logging
import subprocess
import tempfile
import os

from .ai_service import get_client, get_openai_tools, MODEL_VISION

logger = logging.getLogger(__name__)

OMR_SYSTEM_PROMPT = """\
You are an OMR (Optical Mark Recognition) and document structure extraction assistant
integrated into a Japanese LaTeX document editor called Eddivom (かんたんPDFメーカー).

Your job is to analyze uploaded images or extracted PDF content and convert them into
structured document blocks that can be imported into the editor.

## What to extract
- Text headings → heading blocks (with appropriate level: 1, 2, or 3)
- Body text / explanations → paragraph blocks
- Mathematical expressions → math blocks (use LaTeX notation, displayMode: true)
- Inline math within text → include as $...$ in paragraph text
- Lists or numbered items → list blocks (style: "bullet" or "numbered")
- Tables / grids → table blocks (with headers and rows arrays)
- Chemical formulas → chemistry blocks
- Diagrams / figures → paragraph blocks with [図: description]
- For OMR answer sheets (bubble sheets): extract question number + selected choice

## CRITICAL Instructions
- You MUST call the `edit_document` tool to return the extracted blocks.
- Do NOT describe the content in chat — always use the tool to create blocks.
- Generate IDs like "omr-001", "omr-002", "omr-003", etc.
- Default style: { "textAlign": "left", "fontSize": 11, "fontFamily": "sans" }
- If confidence is low for any region, add "(要確認)" at the end.
- Respond in Japanese.
- Even if the content is unclear, extract whatever you can. Do not refuse.
- For math expressions: use proper LaTeX (e.g. \\frac{a}{b}, \\sum_{i=1}^{n}, \\sqrt{x})

## Block format (MUST follow exactly)
Each block in ops must have this structure:
```json
{"op": "add_block", "afterId": null, "block": {
  "id": "omr-001",
  "content": {"type": "heading", "text": "タイトル", "level": 1},
  "style": {"textAlign": "left", "fontSize": 11, "fontFamily": "sans"}
}}
```

Block types and their content fields:
- heading: {"type": "heading", "text": "...", "level": 1}
- paragraph: {"type": "paragraph", "text": "..."}
- math: {"type": "math", "latex": "...", "displayMode": true}
- list: {"type": "list", "style": "numbered", "items": ["item1", "item2"]}

IMPORTANT: content MUST be a nested object with "type" field. Do NOT use flat format.
"""

OMR_PDF_SYSTEM_PROMPT = OMR_SYSTEM_PROMPT + """

## PDF-specific instructions
- You are receiving content extracted from a PDF document (text + page images).
- The extracted text may have formatting artifacts — clean them up.
- Use the page images to verify and supplement the extracted text.
- Treat all pages as a continuous document — maintain logical flow.
- Number IDs sequentially across all pages (omr-001, omr-002, ...).
- Do NOT repeat headings or titles if they appear identically on multiple pages.
"""

OMR_TEXT_ONLY_PROMPT = OMR_SYSTEM_PROMPT + """

## Text-only PDF instructions
- You are receiving raw text extracted from a PDF (no images available).
- The text may have formatting artifacts, extra whitespace, or broken lines.
- Reconstruct the logical document structure from the raw text.
- Identify headings by context (shorter standalone lines, numbered sections, etc.).
- Identify math expressions and convert to proper LaTeX notation.
- Group related paragraphs together.
"""


def _sse(data: dict) -> str:
    """Format SSE event."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _image_to_data_url(image_bytes: bytes, media_type: str) -> str:
    """Convert image bytes to data URL for OpenAI Vision API."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{media_type};base64,{b64}"


def _build_omr_tools() -> list[dict]:
    """Build OpenAI tools list with only edit_document for OMR."""
    all_tools = get_openai_tools()
    return [t for t in all_tools if t["function"]["name"] == "edit_document"]


# ─── PDF extraction strategies ──────────────────────────────────────────────


def _pdf_extract_pymupdf(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Extract text + render images using PyMuPDF (fitz).
    Returns {"texts": [str, ...], "images": [(bytes, mime), ...], "page_count": int}
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = min(len(doc), max_pages)

    texts: list[str] = []
    images: list[tuple[bytes, str]] = []

    for i in range(page_count):
        page = doc[i]

        # Extract text
        text = page.get_text("text")
        texts.append(text.strip())

        # Render page to PNG image (150 DPI for reasonable size)
        mat = fitz.Matrix(150 / 72, 150 / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        images.append((img_bytes, "image/png"))

    doc.close()
    return {"texts": texts, "images": images, "page_count": page_count}


def _pdf_extract_poppler(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Fallback: Extract images using poppler-utils (pdftoppm).
    Returns {"texts": [], "images": [(bytes, mime), ...], "page_count": int}
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        # Get page count
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

        # Try pdftotext for text extraction
        texts: list[str] = []
        try:
            text_result = subprocess.run(
                ["pdftotext", "-layout", pdf_path, "-"],
                capture_output=True, text=True, timeout=30,
            )
            if text_result.returncode == 0 and text_result.stdout.strip():
                # Split by form feeds (page breaks)
                pages = text_result.stdout.split("\f")
                texts = [p.strip() for p in pages if p.strip()]
        except Exception:
            pass

        return {"texts": texts, "images": images, "page_count": pages_to_process}


def _pdf_extract_text_only(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Last resort: Extract text only using PyMuPDF (no images).
    Returns {"texts": [str, ...], "images": [], "page_count": int}
    """
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
        # Even fitz not available — try basic extraction
        return {"texts": [], "images": [], "page_count": 0}


async def _extract_pdf_content(pdf_bytes: bytes, progress_callback=None):
    """Try multiple PDF extraction strategies, returning the best result.

    Returns {"texts": [...], "images": [...], "page_count": int, "method": str}
    """
    import asyncio

    # Strategy 1: PyMuPDF (best — text + images, pure Python)
    try:
        if progress_callback:
            progress_callback("PyMuPDF でPDFを解析中...")
        result = await asyncio.to_thread(_pdf_extract_pymupdf, pdf_bytes)
        if result["page_count"] > 0:
            logger.info("PDF extraction via PyMuPDF: %d pages, %d images, text=%s",
                        result["page_count"], len(result["images"]),
                        "yes" if any(result["texts"]) else "no")
            return {**result, "method": "pymupdf"}
    except ImportError:
        logger.info("PyMuPDF not available, trying poppler")
    except Exception as e:
        logger.warning("PyMuPDF extraction failed: %s", e)

    # Strategy 2: poppler-utils (external dependency)
    try:
        if progress_callback:
            progress_callback("poppler でPDFを変換中...")
        result = await asyncio.to_thread(_pdf_extract_poppler, pdf_bytes)
        if result["images"]:
            logger.info("PDF extraction via poppler: %d pages, %d images",
                        result["page_count"], len(result["images"]))
            return {**result, "method": "poppler"}
    except FileNotFoundError:
        logger.info("poppler-utils not installed, trying text-only extraction")
    except Exception as e:
        logger.warning("poppler extraction failed: %s", e)

    # Strategy 3: Text-only extraction (last resort)
    try:
        if progress_callback:
            progress_callback("テキストを直接抽出中...")
        result = await asyncio.to_thread(_pdf_extract_text_only, pdf_bytes)
        if any(result["texts"]):
            logger.info("PDF text-only extraction: %d pages", result["page_count"])
            return {**result, "method": "text_only"}
    except Exception as e:
        logger.warning("Text-only extraction failed: %s", e)

    return {"texts": [], "images": [], "page_count": 0, "method": "none"}


# ─── Response parsing ──────────────────────────────────────────────────────


def _normalize_omr_block(block: dict, block_id: str) -> dict:
    """OMR ブロックを正規化して content/style 構造を保証する。"""
    if not isinstance(block, dict):
        return None

    bid = block.get("id") or block_id

    # content が既に構造化されている場合
    content = block.get("content")
    if isinstance(content, dict) and "type" in content:
        style = block.get("style") or {"textAlign": "left", "fontSize": 11, "fontFamily": "sans"}
        return {"id": bid, "content": content, "style": style}

    # フラット形式: { id, type: "heading", text: "...", level: 2, style: {...} }
    btype = block.get("type")
    if btype:
        meta_keys = {"id", "style"}
        content = {k: v for k, v in block.items() if k not in meta_keys}
        style = block.get("style") or {"textAlign": "left", "fontSize": 11, "fontFamily": "sans"}
        return {"id": bid, "content": content, "style": style}

    return None


def _normalize_omr_patches(raw_patches: dict | list) -> dict | None:
    """OMR パッチを正規化し、afterId チェーンを修復する。"""
    if isinstance(raw_patches, list):
        ops = raw_patches
    elif isinstance(raw_patches, dict):
        ops = raw_patches.get("ops") or raw_patches.get("operations") or []
        if not ops and "op" in raw_patches:
            # 単一のオペレーション
            ops = [raw_patches]
    else:
        return None

    if not isinstance(ops, list) or len(ops) == 0:
        return None

    normalized_ops = []
    prev_id = None

    for i, op in enumerate(ops):
        if not isinstance(op, dict):
            continue

        op_type = op.get("op") or op.get("operation") or op.get("type")
        if not op_type:
            continue

        # op名の正規化
        if op_type in ("add", "add_block", "insert"):
            block = op.get("block") or {k: v for k, v in op.items() if k not in ("op", "operation", "type", "afterId", "after_id")}
            block_id = f"omr-{i+1:03d}"
            normalized_block = _normalize_omr_block(block, block_id)
            if not normalized_block:
                continue

            # afterId チェーンを修復
            after_id = op.get("afterId") or op.get("after_id")
            if after_id is None and prev_id is not None:
                after_id = prev_id

            normalized_ops.append({
                "op": "add_block",
                "afterId": after_id,
                "block": normalized_block,
            })
            prev_id = normalized_block["id"]

        elif op_type in ("update", "update_block"):
            normalized_ops.append({
                "op": "update_block",
                "blockId": op.get("blockId") or op.get("block_id"),
                "content": op.get("content"),
                "style": op.get("style"),
            })
        elif op_type in ("delete", "delete_block"):
            normalized_ops.append({
                "op": "delete_block",
                "blockId": op.get("blockId") or op.get("block_id"),
            })

    if not normalized_ops:
        return None

    return {"ops": normalized_ops}


def _extract_patches_from_response(response) -> tuple[list[str], dict | None]:
    """Extract text and patches from an OpenAI response."""
    text_parts: list[str] = []
    patches = None
    try:
        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            text_parts.append(msg.content)

        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.function.name == "edit_document":
                    try:
                        parsed = json.loads(tc.function.arguments)
                        patches = _normalize_omr_patches(parsed)
                        if patches:
                            logger.info("OMR: Extracted %d ops from edit_document",
                                        len(patches.get("ops", [])))
                        else:
                            logger.warning("OMR: edit_document returned empty/invalid patches")
                    except json.JSONDecodeError as e:
                        logger.warning("OMR: edit_document args parse failed: %s (args: %s...)",
                                       e, tc.function.arguments[:200])
        else:
            logger.warning("OMR: No tool_calls in response. finish_reason=%s, content=%s",
                           choice.finish_reason, (msg.content or "")[:200])
    except (IndexError, AttributeError) as e:
        logger.warning("OpenAI OMR response parse failed: %s", e)
    return text_parts, patches


# ─── Image analysis ──────────────────────────────────────────────────────────


async def analyze_image(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
) -> dict:
    """OpenAI Vision で画像/PDFを解析し、ドキュメントパッチを返す。"""
    result = {"description": "", "patches": None}
    async for event_str in analyze_image_stream(image_bytes, media_type, document_context, hint):
        if event_str.startswith("data: "):
            try:
                event = json.loads(event_str[6:])
                if event.get("type") == "done":
                    result["description"] = event.get("description", "")
                    result["patches"] = event.get("patches")
                elif event.get("type") == "error":
                    result["description"] = event.get("message", "")
            except json.JSONDecodeError:
                pass
    return result


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

    prompt_text = (
        f"この画像からドキュメント構造を抽出してください。{hint}"
        if hint
        else "この画像からドキュメント構造を抽出して、edit_documentツールでブロックとして追加してください。"
    )

    messages = [
        {"role": "system", "content": OMR_SYSTEM_PROMPT},
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
    patches = None
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
                    tool_choice={"type": "function", "function": {"name": "edit_document"}},
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

        text_parts, patches = _extract_patches_from_response(response)

        if patches and patches.get("ops"):
            break

        if attempt < MAX_RETRIES:
            logger.info("OMR attempt %d: no patches, retrying", attempt)

    yield _sse({"type": "progress", "phase": "extracting", "message": "ブロックを構成中..."})

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"画像から{len(patches.get('ops', []))}件のブロックを抽出しました。"

    yield _sse({
        "type": "done",
        "description": description,
        "patches": patches,
    })


# ─── PDF analysis ──────────────────────────────────────────────────────────


async def _analyze_pdf_stream(
    pdf_bytes: bytes,
    document_context: dict,
    hint: str = "",
):
    """PDFからテキスト+画像を抽出し、OpenAI APIで構造化ブロックに変換する。"""
    import asyncio

    yield _sse({"type": "progress", "phase": "converting", "message": "PDFを解析中..."})

    # Extract PDF content (tries PyMuPDF → poppler → text-only)
    def _progress(msg):
        pass  # Cannot yield from sync callback; log instead
        logger.info("PDF extraction: %s", msg)

    extraction = await _extract_pdf_content(pdf_bytes, progress_callback=_progress)

    method = extraction.get("method", "none")
    page_count = extraction.get("page_count", 0)
    texts = extraction.get("texts", [])
    images = extraction.get("images", [])
    has_text = any(t.strip() for t in texts)
    has_images = len(images) > 0

    if page_count == 0 and not has_text:
        yield _sse({"type": "error", "message": "PDFからコンテンツを抽出できませんでした。ファイルが破損しているか、スキャンPDFの可能性があります。"})
        return

    yield _sse({"type": "progress", "phase": "converted",
                "message": f"{page_count}ページを検出 (方式: {method})"})

    client = get_client()
    tools = _build_omr_tools()

    page_label = f"{page_count}ページのPDF" if page_count > 1 else "1ページのPDF"

    # Build the optimal message based on what we extracted
    if has_images and has_text:
        # Best case: text + images
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": f"AIが{page_count}ページのテキストと画像を解析中..."})
        messages = _build_pdf_messages_with_text_and_images(
            texts, images, page_count, page_label, hint)
        system_prompt = OMR_PDF_SYSTEM_PROMPT
    elif has_images:
        # Images only (scanned PDF)
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": f"AIが{page_count}ページの画像を解析中..."})
        messages = _build_pdf_messages_images_only(
            images, page_count, page_label, hint)
        system_prompt = OMR_PDF_SYSTEM_PROMPT
    else:
        # Text only (no images available)
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": f"AIがテキストからブロックを構成中..."})
        messages = _build_pdf_messages_text_only(
            texts, page_count, page_label, hint)
        system_prompt = OMR_TEXT_ONLY_PROMPT

    messages.insert(0, {"role": "system", "content": system_prompt})

    MAX_RETRIES = 2
    patches = None
    resp_text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying",
                        "message": f"再解析中... (試行 {attempt}/{MAX_RETRIES})"})

        try:
            use_vision = has_images
            model = MODEL_VISION

            def _call():
                return client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "edit_document"}},
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

        resp_text_parts, patches = _extract_patches_from_response(response)

        if patches and patches.get("ops"):
            break

        if attempt < MAX_RETRIES:
            logger.info("OMR PDF attempt %d: no patches, retrying", attempt)

    yield _sse({"type": "progress", "phase": "extracting", "message": "ブロックを構成中..."})

    description = "\n".join(resp_text_parts).strip()
    if not description and patches:
        n_ops = len(patches.get("ops", []))
        description = f"PDFから{n_ops}件のブロックを抽出しました（{page_count}ページ）。"

    yield _sse({
        "type": "done",
        "description": description,
        "patches": patches,
    })


# ─── Message builders for different PDF extraction modes ─────────────────


def _build_pdf_messages_with_text_and_images(
    texts: list[str], images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
) -> list[dict]:
    """Build messages using both extracted text and page images."""
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
            "edit_documentツールでブロックとして正確に再構成してください。"
            "テキスト抽出結果を主に使い、画像で補完してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        )
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_images_only(
    images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
) -> list[dict]:
    """Build messages using page images only (scanned PDF)."""
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
            "edit_documentツールでブロックとして追加してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        )
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_text_only(
    texts: list[str],
    page_count: int, page_label: str, hint: str,
) -> list[dict]:
    """Build messages using extracted text only (no images)."""
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
            "このテキストを解析して、edit_documentツールでドキュメントブロックに変換してください。\n"
            "見出し、本文、数式、リスト、表などを適切なブロックタイプに分類してください。\n"
            "数式は正しいLaTeX記法に変換してください。\n\n"
        )
    )

    return [{"role": "user", "content": prompt + combined_text}]

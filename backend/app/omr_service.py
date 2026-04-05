"""OMR service — image/PDF → structured document blocks via OpenAI Vision
SSEストリーミング対応: 進捗をリアルタイムでフロントエンドへ送信。
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
integrated into a Japanese LaTeX document editor called かんたんPDFメーカー.

Your job is to analyze uploaded images (exam sheets, worksheets, handwritten notes,
printed documents, answer sheets, etc.) and extract their content as structured
document blocks that can be imported into the editor.

## What to extract
- Text headings → heading blocks
- Body text / explanations → paragraph blocks
- Mathematical expressions → math blocks (use LaTeX notation)
- Lists or numbered items → list blocks
- Tables / grids → table blocks
- Chemical formulas → chemistry blocks
- Diagrams / figures → describe as paragraph with [図: description]
- For OMR answer sheets (bubble sheets): extract question number + selected choice + confidence

## CRITICAL Instructions
- You MUST use the `edit_document` tool to return the extracted blocks. Do NOT return blocks as text — always use the tool.
- After the tool call, write a brief Japanese summary of what was extracted.
- Use null for afterId on the first block; for each subsequent block, reference the previous block's id.
- Generate IDs like "omr-" + sequential number (e.g. "omr-001", "omr-002").
- Default style: { textAlign: "left", fontSize: 11, fontFamily: "serif" }
- If confidence is low for any region, add "(要確認)" at the end of that block's text.
- Respond in Japanese.
- Even if the image is unclear, extract whatever you can see. Do not refuse.
"""

OMR_PDF_SYSTEM_PROMPT = OMR_SYSTEM_PROMPT + """

## PDF-specific instructions
- You are receiving multiple page images from a single PDF document.
- Treat them as a continuous document — maintain logical flow across pages.
- Number the IDs sequentially across all pages (e.g. "omr-001", "omr-002", ...).
- Do NOT repeat headings or titles if they appear identically on multiple pages.
"""


def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 10) -> list[tuple[bytes, str]]:
    """Convert PDF to PNG images using poppler-utils (pdftoppm).
    Returns list of (image_bytes, mime_type) tuples.
    """
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

        return images


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
                        patches = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        logger.warning("OMR: edit_document の引数パースに失敗")
    except (IndexError, AttributeError) as e:
        logger.warning("OpenAI OMR レスポンスのパースに失敗: %s", e)
    return text_parts, patches


async def analyze_image(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
) -> dict:
    """
    OpenAI Vision で画像を解析し、ドキュメントパッチを返す。
    Returns { description: str, patches: dict | None }
    """
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
    """
    SSEストリーミング版のOMR解析（OpenAI Vision）。進捗イベントをyieldする。

    Events:
      {"type": "progress", "phase": "...", "message": "..."}
      {"type": "done", "description": "...", "patches": {...}}
      {"type": "error", "message": "..."}
    """
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
            logger.info("OMR attempt %d: no function call, retrying with stronger prompt", attempt)
            messages = [
                {"role": "system", "content": OMR_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                        {"type": "text", "text": (
                            "この画像の内容を読み取って、edit_documentツールを必ず使用してブロックに変換してください。"
                            "テキスト、数式、表など、画像に含まれるすべての要素をブロックとして追加してください。"
                            "画像が不鮮明でも、読み取れる範囲で最善を尽くしてください。"
                        )},
                    ],
                },
            ]

    yield _sse({"type": "progress", "phase": "extracting", "message": "ブロックを構成中..."})

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"画像から{len(patches.get('ops', []))}件のブロックを抽出しました。"

    yield _sse({
        "type": "done",
        "description": description,
        "patches": patches,
    })


async def _analyze_pdf_stream(
    pdf_bytes: bytes,
    document_context: dict,
    hint: str = "",
):
    """PDFを画像に変換し、全ページをまとめてOpenAI Visionで解析する（SSEストリーミング版）。"""
    import asyncio

    yield _sse({"type": "progress", "phase": "converting", "message": "PDFをページ画像に変換中..."})

    try:
        images = await asyncio.to_thread(_pdf_to_images, pdf_bytes)
    except subprocess.CalledProcessError as e:
        logger.error("PDF→画像変換に失敗: %s", e)
        yield _sse({"type": "error", "message": "PDFの変換に失敗しました。ファイルが破損している可能性があります。"})
        return
    except FileNotFoundError:
        yield _sse({"type": "error", "message": "PDF変換ツール(poppler)が見つかりません。"})
        return

    if not images:
        yield _sse({"type": "error", "message": "PDFからページを抽出できませんでした。"})
        return

    logger.info("PDF解析: %dページを処理します", len(images))
    yield _sse({"type": "progress", "phase": "converted", "message": f"{len(images)}ページを検出しました"})

    client = get_client()

    page_label = f"{len(images)}ページのPDF" if len(images) > 1 else "1ページのPDF"
    prompt_text = (
        f"この{page_label}からドキュメント構造を抽出してください。{hint}"
        if hint
        else f"この{page_label}からドキュメント構造を抽出して、edit_documentツールでブロックとして追加してください。全ページを通して1つの連続したドキュメントとして処理してください。"
    )

    # Build user message content with all page images
    content_parts: list[dict] = []
    for i, (img_bytes, img_mime) in enumerate(images):
        if len(images) > 1:
            content_parts.append({"type": "text", "text": f"--- ページ {i + 1}/{len(images)} ---"})
        data_url = _image_to_data_url(img_bytes, img_mime)
        content_parts.append({"type": "image_url", "image_url": {"url": data_url, "detail": "high"}})
    content_parts.append({"type": "text", "text": prompt_text})

    messages = [
        {"role": "system", "content": OMR_PDF_SYSTEM_PROMPT},
        {"role": "user", "content": content_parts},
    ]

    tools = _build_omr_tools()

    yield _sse({"type": "progress", "phase": "ai_processing", "message": f"AIが{len(images)}ページを解析中..."})

    MAX_RETRIES = 2
    patches = None
    text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying", "message": f"再解析中... (試行 {attempt}/{MAX_RETRIES})"})

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
            logger.error("OpenAI OMR PDF API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({"type": "error", "message": f"AI解析エラー: {str(e)[:200]}"})
            return

        text_parts, patches = _extract_patches_from_response(response)

        if patches and patches.get("ops"):
            break

        if attempt < MAX_RETRIES:
            logger.info("OMR PDF attempt %d: no function call, retrying", attempt)
            retry_content: list[dict] = []
            for i, (img_bytes, img_mime) in enumerate(images):
                if len(images) > 1:
                    retry_content.append({"type": "text", "text": f"--- ページ {i + 1}/{len(images)} ---"})
                data_url = _image_to_data_url(img_bytes, img_mime)
                retry_content.append({"type": "image_url", "image_url": {"url": data_url, "detail": "high"}})
            retry_content.append({"type": "text", "text": (
                f"この{page_label}の内容を読み取って、edit_documentツールを必ず使用してブロックに変換してください。"
                "テキスト、数式、表など、すべての要素をブロックとして追加してください。"
            )})
            messages = [
                {"role": "system", "content": OMR_PDF_SYSTEM_PROMPT},
                {"role": "user", "content": retry_content},
            ]

    yield _sse({"type": "progress", "phase": "extracting", "message": "ブロックを構成中..."})

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"PDFから{len(patches.get('ops', []))}件のブロックを抽出しました（{len(images)}ページ）。"

    yield _sse({
        "type": "done",
        "description": description,
        "patches": patches,
    })

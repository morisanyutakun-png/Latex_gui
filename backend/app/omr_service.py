"""OMR service — image/PDF → structured document blocks via Gemini Vision
開発用: Gemini Vision を使用。将来的には Claude Vision に戻す。
"""
import logging
import subprocess
import tempfile
import os

from .ai_service import get_client, get_gemini_tool_def

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

## Instructions
- Always use the `edit_document` tool to return the extracted blocks.
- After the tool call, write a brief Japanese summary of what was extracted.
- Use null for afterId on the first block; for each subsequent block, reference the previous block's id.
- Generate IDs like "omr-" + sequential number (e.g. "omr-001", "omr-002").
- Default style: { textAlign: "left", fontSize: 11, fontFamily: "serif" }
- If confidence is low for any region, add "(要確認)" at the end of that block's text.
- Respond in Japanese.
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

        # Get page count first
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

        # Convert to PNG images at 200 DPI
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


async def analyze_image(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
) -> dict:
    """
    Gemini Vision で画像を解析し、ドキュメントパッチを返す。
    Returns { description: str, patches: dict | None }
    """
    import asyncio
    from google.genai import types  # type: ignore

    # PDFの場合はページごとの画像に変換して一括解析
    if media_type == "application/pdf":
        return await _analyze_pdf(image_bytes, document_context, hint)

    client = get_client()

    prompt_text = (
        f"この画像からドキュメント構造を抽出してください。{hint}"
        if hint
        else "この画像からドキュメント構造を抽出して、ブロックとして追加してください。"
    )

    config = types.GenerateContentConfig(
        system_instruction=OMR_SYSTEM_PROMPT,
        tools=[get_gemini_tool_def()],
    )

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part(
                    inline_data=types.Blob(mime_type=media_type, data=image_bytes)
                ),
                types.Part(text=prompt_text),
            ],
        )
    ]

    def _call():
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config,
        )

    response = await asyncio.to_thread(_call)

    text_parts: list[str] = []
    patches = None

    try:
        parts = response.candidates[0].content.parts
        for part in parts:
            if part.text:
                text_parts.append(part.text)
            if part.function_call and part.function_call.name == "edit_document":
                patches = dict(part.function_call.args)
    except (IndexError, AttributeError) as e:
        logger.warning("Gemini OMR レスポンスのパースに失敗: %s", e)

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"画像から{len(patches.get('ops', []))}件のブロックを抽出しました。確認して適用してください。"

    return {
        "description": description,
        "patches": patches,
    }


async def _analyze_pdf(
    pdf_bytes: bytes,
    document_context: dict,
    hint: str = "",
) -> dict:
    """PDFを画像に変換し、全ページをまとめてGemini Visionで解析する。"""
    import asyncio
    from google.genai import types  # type: ignore

    # PDF → 画像変換
    try:
        images = await asyncio.to_thread(_pdf_to_images, pdf_bytes)
    except subprocess.CalledProcessError as e:
        logger.error("PDF→画像変換に失敗: %s", e)
        raise ValueError("PDFの変換に失敗しました。ファイルが破損している可能性があります。")
    except FileNotFoundError:
        raise ValueError("PDF変換ツール(poppler)が見つかりません。サーバー管理者に連絡してください。")

    if not images:
        raise ValueError("PDFからページを抽出できませんでした。")

    logger.info("PDF解析: %dページを処理します", len(images))

    client = get_client()

    page_label = f"{len(images)}ページのPDF" if len(images) > 1 else "1ページのPDF"
    prompt_text = (
        f"この{page_label}からドキュメント構造を抽出してください。{hint}"
        if hint
        else f"この{page_label}からドキュメント構造を抽出して、ブロックとして追加してください。全ページを通して1つの連続したドキュメントとして処理してください。"
    )

    # 全ページの画像をpartsとして一括送信
    parts: list[types.Part] = []
    for i, (img_bytes, img_mime) in enumerate(images):
        if len(images) > 1:
            parts.append(types.Part(text=f"--- ページ {i + 1}/{len(images)} ---"))
        parts.append(
            types.Part(inline_data=types.Blob(mime_type=img_mime, data=img_bytes))
        )
    parts.append(types.Part(text=prompt_text))

    config = types.GenerateContentConfig(
        system_instruction=OMR_PDF_SYSTEM_PROMPT,
        tools=[get_gemini_tool_def()],
    )

    contents = [types.Content(role="user", parts=parts)]

    def _call():
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config,
        )

    response = await asyncio.to_thread(_call)

    text_parts: list[str] = []
    patches = None

    try:
        resp_parts = response.candidates[0].content.parts
        for part in resp_parts:
            if part.text:
                text_parts.append(part.text)
            if part.function_call and part.function_call.name == "edit_document":
                patches = dict(part.function_call.args)
    except (IndexError, AttributeError) as e:
        logger.warning("Gemini OMR PDF レスポンスのパースに失敗: %s", e)

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"PDFから{len(patches.get('ops', []))}件のブロックを抽出しました（{len(images)}ページ）。"

    return {
        "description": description,
        "patches": patches,
    }

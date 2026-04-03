"""OMR service — image/PDF → structured document blocks via Gemini Vision
(開発用: Gemini Vision を使用。将来的には Claude Vision に戻す。)
"""
import base64
import logging
from typing import Any

from .ai_service import configure_gemini, GEMINI_TOOL_DEF, _proto_args_to_dict

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

    genai = configure_gemini()

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    prompt_text = (
        f"この画像からドキュメント構造を抽出してください。{hint}"
        if hint
        else "この画像からドキュメント構造を抽出して、ブロックとして追加してください。"
    )

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=OMR_SYSTEM_PROMPT,
        tools=[GEMINI_TOOL_DEF],
    )

    def _call():
        return model.generate_content(
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"inline_data": {"mime_type": media_type, "data": image_b64}},
                        {"text": prompt_text},
                    ],
                }
            ]
        )

    response = await asyncio.to_thread(_call)

    text_parts: list[str] = []
    patches = None

    try:
        parts = response.candidates[0].content.parts
        for part in parts:
            if hasattr(part, "text") and part.text:
                text_parts.append(part.text)
            if hasattr(part, "function_call") and part.function_call.name == "edit_document":
                patches = _proto_args_to_dict(part.function_call.args)
    except (IndexError, AttributeError) as e:
        logger.warning("Gemini OMR レスポンスのパースに失敗: %s", e)

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"画像から{len(patches.get('ops', []))}件のブロックを抽出しました。確認して適用してください。"

    return {
        "description": description,
        "patches": patches,
    }

"""OMR service — image/PDF → structured document blocks via Claude Vision"""
import base64
import logging
from typing import Any

from .ai_service import get_client, TOOLS

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
    Analyze an image using Claude Vision and return document patches.
    Returns { description: str, patches: dict | None }
    """
    import asyncio

    client = get_client()

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    user_content: list[Any] = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_b64,
            },
        },
        {
            "type": "text",
            "text": (
                f"この画像からドキュメント構造を抽出してください。{hint}"
                if hint
                else "この画像からドキュメント構造を抽出して、ブロックとして追加してください。"
            ),
        },
    ]

    def _call():
        return client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=OMR_SYSTEM_PROMPT,
            tools=TOOLS,
            messages=[{"role": "user", "content": user_content}],
        )

    response = await asyncio.to_thread(_call)

    text_parts = []
    patches = None

    for block in response.content:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use" and block.name == "edit_document":
            patches = block.input

    description = "\n".join(text_parts).strip()
    if not description and patches:
        description = f"画像から{len(patches.get('ops', []))}件のブロックを抽出しました。確認して適用してください。"

    return {
        "description": description,
        "patches": patches,
    }

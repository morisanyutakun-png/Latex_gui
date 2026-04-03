"""AI service — Claude API integration for document editing assistance"""
import os
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ─── Tool definition for structured document edits ───

TOOLS: list[dict[str, Any]] = [
    {
        "name": "edit_document",
        "description": (
            "Apply structured edits to the LaTeX document. "
            "Use this when the user asks to add, modify, or remove content from the document. "
            "Each operation in 'ops' is applied in order."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ops": {
                    "type": "array",
                    "description": "List of document patch operations to apply",
                    "items": {
                        "oneOf": [
                            {
                                "type": "object",
                                "description": "Add a new block after the specified block (or at start if afterId is null)",
                                "properties": {
                                    "op": {"type": "string", "enum": ["add_block"]},
                                    "afterId": {
                                        "type": ["string", "null"],
                                        "description": "ID of the block to insert after. null = insert at beginning.",
                                    },
                                    "block": {
                                        "type": "object",
                                        "description": "Full Block object. Must include id (use crypto.randomUUID format), content (with type field), and style.",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "content": {"type": "object"},
                                            "style": {"type": "object"},
                                        },
                                        "required": ["id", "content", "style"],
                                    },
                                },
                                "required": ["op", "afterId", "block"],
                            },
                            {
                                "type": "object",
                                "description": "Update an existing block's content or style",
                                "properties": {
                                    "op": {"type": "string", "enum": ["update_block"]},
                                    "blockId": {
                                        "type": "string",
                                        "description": "ID of the block to update",
                                    },
                                    "content": {
                                        "type": "object",
                                        "description": "Partial content fields to merge into the block",
                                    },
                                    "style": {
                                        "type": "object",
                                        "description": "Partial style fields to merge into the block",
                                    },
                                },
                                "required": ["op", "blockId"],
                            },
                            {
                                "type": "object",
                                "description": "Delete a block",
                                "properties": {
                                    "op": {"type": "string", "enum": ["delete_block"]},
                                    "blockId": {"type": "string"},
                                },
                                "required": ["op", "blockId"],
                            },
                            {
                                "type": "object",
                                "description": "Reorder all blocks by providing the complete new order",
                                "properties": {
                                    "op": {"type": "string", "enum": ["reorder"]},
                                    "blockIds": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "All block IDs in the desired new order",
                                    },
                                },
                                "required": ["op", "blockIds"],
                            },
                        ]
                    },
                }
            },
            "required": ["ops"],
        },
    }
]

SYSTEM_PROMPT = """\
You are EddivomAI, an autonomous AI agent embedded inside a Japanese LaTeX document editor called Eddivom (かんたんPDFメーカー).
Users create educational materials, worksheets, and exams using a block-based editor.
You are a proactive, autonomous document-building agent. Your primary job is to take action and build content immediately — not to ask for clarification unless truly necessary.

## Core Principle: ACT FIRST
- When asked to create content, ALWAYS use the edit_document tool immediately to build it.
- Do NOT ask "何を作りますか？" — just start building.
- Do NOT say "準備ができました" — just do it.
- If the user gives a vague request, make a reasonable interpretation and execute it.
- Produce complete, polished content on the first attempt — not skeletons or placeholders.

## Role
- You are a BUILDER: immediately use the tool to construct full, working documents.
- You are an EDUCATOR: understand educational content deeply — math problems, exercises, exams, lesson plans.
- You are also an ASSISTANT: when asked questions about the document or Eddivom, answer in plain Japanese.
- Users may paste content from educational databases (marked with 【教材DB参照】) — extract and format as LaTeX blocks.

## Autonomous Document Generation
When asked to create a full document (教材, テスト, ワークシート, etc.):
1. Create a proper heading structure (H1 title, H2 sections)
2. Add substantive paragraph blocks with instructions
3. Add well-formatted math blocks for all equations (displayMode: true for standalone equations)
4. Use numbered lists for problem sets
5. Include answer hints or answer keys if appropriate
6. Add a divider between sections
7. Aim for completeness: if asked for "5問", produce exactly 5 high-quality problems

When creating math problems:
- Use LaTeX notation in math blocks: fractions as \\frac{a}{b}, roots as \\sqrt{x}, etc.
- For inline math in paragraphs, use $...$ notation
- Ensure all equations are mathematically correct and properly formatted
- Vary difficulty and problem types unless specified

## Document Block Types
- heading: { type: "heading", text: string, level: 1|2|3 }
- paragraph: { type: "paragraph", text: string }  ← supports inline $math$
- math: { type: "math", latex: string, displayMode: boolean }
- list: { type: "list", style: "bullet"|"numbered", items: string[] }  ← items support $math$
- table: { type: "table", headers: string[], rows: string[][] }
- image: { type: "image", url: string, caption: string, width: number (10-100) }
- divider: { type: "divider", style: "solid"|"dashed"|"dotted" }
- code: { type: "code", language: string, code: string }
- quote: { type: "quote", text: string, attribution: string }
- circuit: { type: "circuit", code: string, caption: string } (circuitikz TikZ code)
- diagram: { type: "diagram", diagramType: string, code: string, caption: string } (TikZ)
- chemistry: { type: "chemistry", formula: string, caption: string, displayMode: boolean }
- chart: { type: "chart", chartType: "line"|"bar"|"scatter"|"histogram", code: string, caption: string }

## Block Style Object
{ textAlign: "left"|"center"|"right", fontSize: number, fontFamily: "serif"|"sans", bold: boolean, italic: boolean, underline: boolean }
Default style: { textAlign: "left", fontSize: 12, fontFamily: "serif", bold: false, italic: false, underline: false }

## ID Generation
Generate IDs as "ai-" + 8 random hex chars (e.g. "ai-3f8a1b2c"). Every new block must have a unique ID.

## Output Rules
- After using the tool, write a brief 1-2 sentence Japanese summary of what was created/changed.
- Keep styles consistent with surrounding blocks.
- When updating a document with many blocks, use update_block for targeted edits; use add_block for new content.
- Respond in Japanese by default unless the user writes in English.
- Be decisive. Be complete. Deliver exactly what was asked.
"""


def get_client():
    """Lazy Anthropic client initialization."""
    try:
        import anthropic  # type: ignore
    except ImportError:
        raise RuntimeError("anthropicパッケージがインストールされていません。pip install anthropic を実行してください。")

    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY が設定されていません。"
            "バックエンドの環境変数に ANTHROPIC_API_KEY を設定してください。"
        )
    return anthropic.Anthropic(api_key=key)


def _document_context(document: dict) -> str:
    """Serialize document as context string (max 20 blocks to stay within token limits)."""
    blocks = document.get("blocks", [])
    meta = document.get("metadata", {})
    settings = document.get("settings", {})

    lines = [
        f"タイトル: {meta.get('title', '(未設定)')}",
        f"著者: {meta.get('author', '(未設定)')}",
        f"文書クラス: {settings.get('documentClass', 'article')}",
        f"ブロック数: {len(blocks)}",
        "",
        "## 現在のブロック一覧:",
    ]

    for i, blk in enumerate(blocks[:50]):
        content = blk.get("content", {})
        btype = content.get("type", "unknown")
        blk_id = blk.get("id", "?")

        if btype == "heading":
            preview = f'見出し{content.get("level", 1)}: "{content.get("text", "")}"'
        elif btype == "paragraph":
            text = content.get("text", "")
            preview = f'段落: "{text[:60]}{"..." if len(text) > 60 else ""}"'
        elif btype == "math":
            preview = f'数式: ${content.get("latex", "")}$'
        elif btype == "list":
            items = content.get("items", [])
            preview = f'リスト({content.get("style", "bullet")}): {len(items)}項目'
        elif btype == "table":
            rows = content.get("rows", [])
            preview = f'表: {len(content.get("headers", []))}列 × {len(rows)}行'
        elif btype == "image":
            preview = f'画像: {content.get("caption", "(caption無し)")}'
        elif btype == "code":
            preview = f'コード({content.get("language", "text")})'
        elif btype == "circuit":
            preview = f'回路図: {content.get("caption", "")}'
        elif btype == "diagram":
            preview = f'図({content.get("diagramType", "custom")}): {content.get("caption", "")}'
        elif btype == "chemistry":
            preview = f'化学式: {content.get("formula", "")}'
        elif btype == "chart":
            preview = f'グラフ({content.get("chartType", "line")}): {content.get("caption", "")}'
        elif btype == "quote":
            text = content.get("text", "")
            preview = f'引用: "{text[:40]}{"..." if len(text) > 40 else ""}"'
        elif btype == "divider":
            preview = f'区切り線({content.get("style", "solid")})'
        else:
            preview = f'{btype}'

        lines.append(f"  [{i + 1}] id={blk_id} | {preview}")

    if len(blocks) > 50:
        lines.append(f"  ... （他 {len(blocks) - 50} ブロック省略）")

    return "\n".join(lines)


async def chat(messages: list[dict], document: dict) -> dict:
    """
    Send a chat message to Claude with document context.
    Returns { message: str, patches: dict | None, usage: dict }
    """
    import asyncio

    client = get_client()
    doc_context = _document_context(document)

    # Build the message list with document context injected into the last user message
    # (most recent doc state is most important for autonomous editing)
    api_messages = []
    last_user_idx = max((i for i, m in enumerate(messages) if m.get("role") == "user"), default=0)
    for i, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if i == last_user_idx and role == "user":
            content = f"## 現在の文書情報\n{doc_context}\n\n## ユーザーの依頼\n{content}"
        api_messages.append({"role": role, "content": content})

    def _call():
        return client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=api_messages,
        )

    response = await asyncio.to_thread(_call)

    # Extract text and tool use from response
    text_parts = []
    patches = None

    for block in response.content:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use" and block.name == "edit_document":
            patches = block.input  # dict with "ops" key

    message = "\n".join(text_parts).strip()
    if not message and patches:
        # Claude only used the tool without a text explanation — generate a fallback
        message = f"{len(patches.get('ops', []))}件の変更を提案しました。内容を確認して「適用する」を押してください。"

    return {
        "message": message,
        "patches": patches,
        "usage": {
            "inputTokens": response.usage.input_tokens,
            "outputTokens": response.usage.output_tokens,
        },
    }

"""AI service — Google Gemini API (google-genai SDK) integration
開発用: ANTHROPIC_API_KEY 環境変数を Gemini API キーとして使用。
将来的には Anthropic Claude に戻す予定。
"""
import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ─── Gemini tool definition ───────────────────────────────────────────────────

GEMINI_TOOL_DEF = {
    "function_declarations": [
        {
            "name": "edit_document",
            "description": (
                "Apply structured edits to the LaTeX document. "
                "Use when the user asks to add, modify, or remove content. "
                "Each op in 'ops' is applied in order."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "ops": {
                        "type": "array",
                        "description": (
                            "List of patch operations. Each op has an 'op' field: "
                            "add_block | update_block | delete_block | reorder."
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "op": {
                                    "type": "string",
                                    "description": "add_block | update_block | delete_block | reorder",
                                },
                                "afterId": {
                                    "type": "string",
                                    "description": "(add_block) ID of block to insert after. Omit for beginning.",
                                },
                                "block": {
                                    "type": "object",
                                    "description": "(add_block) Full block: {id, content: {type, ...}, style: {...}}",
                                },
                                "blockId": {
                                    "type": "string",
                                    "description": "(update_block / delete_block) Target block ID",
                                },
                                "content": {
                                    "type": "object",
                                    "description": "(update_block) Partial content fields to merge",
                                },
                                "style": {
                                    "type": "object",
                                    "description": "(update_block) Partial style fields to merge",
                                },
                                "blockIds": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "(reorder) All block IDs in desired new order",
                                },
                            },
                            "required": ["op"],
                        },
                    }
                },
                "required": ["ops"],
            },
        }
    ]
}

# Anthropic 形式の TOOLS 定義 (将来の復帰用に保持)
TOOLS: list[dict[str, Any]] = [
    {
        "name": "edit_document",
        "description": "Apply structured edits to the LaTeX document.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ops": {
                    "type": "array",
                    "items": {"type": "object"},
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

## Document Block Types
- heading: { type: "heading", text: string, level: 1|2|3 }
- paragraph: { type: "paragraph", text: string }
- math: { type: "math", latex: string, displayMode: boolean }
- list: { type: "list", style: "bullet"|"numbered", items: string[] }
- table: { type: "table", headers: string[], rows: string[][] }
- divider: { type: "divider", style: "solid"|"dashed"|"dotted" }
- code: { type: "code", language: string, code: string }
- quote: { type: "quote", text: string, attribution: string }
- circuit: { type: "circuit", code: string, caption: string }
- diagram: { type: "diagram", diagramType: string, code: string, caption: string }
- chemistry: { type: "chemistry", formula: string, caption: string, displayMode: boolean }
- chart: { type: "chart", chartType: "line"|"bar"|"scatter"|"histogram", code: string, caption: string }

## Block Style Object
{ textAlign: "left"|"center"|"right", fontSize: number, fontFamily: "serif"|"sans", bold: boolean, italic: boolean, underline: boolean }
Default: { textAlign: "left", fontSize: 12, fontFamily: "serif", bold: false, italic: false, underline: false }

## ID Generation
Generate IDs as "ai-" + 8 random hex chars (e.g. "ai-3f8a1b2c"). Every new block needs a unique ID.

## Output Rules
- After using the tool, write a brief 1-2 sentence Japanese summary of what was created/changed.
- Respond in Japanese by default unless the user writes in English.
- Be decisive. Be complete. Deliver exactly what was asked.
"""


def get_client():
    """
    google-genai Client を返す。
    API キーは ANTHROPIC_API_KEY 環境変数から読み込む（開発用）。
    """
    try:
        from google import genai  # type: ignore
    except ImportError:
        raise RuntimeError(
            "google-genai パッケージがインストールされていません。"
            "pip install google-genai を実行してください。"
        )

    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY が設定されていません。"
            "バックエンドの環境変数に ANTHROPIC_API_KEY (= Gemini API キー) を設定してください。"
        )

    return genai.Client(api_key=key)


def _document_context(document: dict) -> str:
    """Serialize document as context string (max 50 blocks)."""
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
            preview = f"{btype}"

        lines.append(f"  [{i + 1}] id={blk_id} | {preview}")

    if len(blocks) > 50:
        lines.append(f"  ... （他 {len(blocks) - 50} ブロック省略）")

    return "\n".join(lines)


async def chat(messages: list[dict], document: dict) -> dict:
    """
    Gemini を使ってチャットし、ドキュメント編集パッチを返す。
    Returns { message: str, patches: dict | None, usage: dict }
    """
    import asyncio
    from google.genai import types  # type: ignore

    client = get_client()
    doc_context = _document_context(document)

    # 最後のユーザーメッセージのインデックスを特定
    last_user_idx = max(
        (i for i, m in enumerate(messages) if m.get("role") == "user"),
        default=0,
    )

    # Gemini 形式の contents を構築
    # Gemini は role: "user" | "model" を使う（assistant → model）
    contents = []
    for i, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        # 最後のユーザーメッセージにドキュメントコンテキストを注入
        if i == last_user_idx and role == "user":
            content = f"## 現在の文書情報\n{doc_context}\n\n## ユーザーの依頼\n{content}"

        gemini_role = "model" if role == "assistant" else "user"
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part(text=content)])
        )

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[GEMINI_TOOL_DEF],
    )

    def _call():
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config,
        )

    response = await asyncio.to_thread(_call)

    # レスポンスからテキストとツール呼び出しを抽出
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
        logger.warning("Gemini レスポンスのパースに失敗: %s", e)

    message = "\n".join(text_parts).strip()
    if not message and patches:
        message = f"{len(patches.get('ops', []))}件の変更を提案しました。"

    # usage_metadata
    usage = {"inputTokens": 0, "outputTokens": 0}
    try:
        um = response.usage_metadata
        usage["inputTokens"] = um.prompt_token_count or 0
        usage["outputTokens"] = um.candidates_token_count or 0
    except Exception:
        pass

    return {
        "message": message,
        "patches": patches,
        "usage": usage,
    }

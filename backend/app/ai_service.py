"""AI service — Google Gemini API (google-genai SDK) integration
開発用: ANTHROPIC_API_KEY 環境変数を Gemini API キーとして使用。
将来的には Anthropic Claude に戻す予定。
"""
import os
import json
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
                "Use this tool whenever the user asks to create, add, modify, or remove content. "
                "Each op in 'ops' is applied in order."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "ops": {
                        "type": "array",
                        "description": (
                            "List of patch operations. Each item has 'op': "
                            "add_block | update_block | delete_block | reorder"
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "op": {
                                    "type": "string",
                                    "description": "Operation type: add_block | update_block | delete_block | reorder",
                                },
                                "afterId": {
                                    "type": "string",
                                    "description": "(add_block only) ID of block to insert after. Omit to insert at beginning.",
                                },
                                "block": {
                                    "type": "object",
                                    "description": (
                                        "(add_block only) The block to add. Must have: "
                                        "id (string like 'ai-xxxxxxxx'), "
                                        "content (object with 'type' field), "
                                        "style (object)"
                                    ),
                                },
                                "blockId": {
                                    "type": "string",
                                    "description": "(update_block / delete_block only) ID of target block",
                                },
                                "content": {
                                    "type": "object",
                                    "description": "(update_block only) Partial content fields to merge into block",
                                },
                                "style": {
                                    "type": "object",
                                    "description": "(update_block only) Partial style fields to merge into block",
                                },
                                "blockIds": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "(reorder only) All block IDs in the desired new order",
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
                "ops": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["ops"],
        },
    }
]

SYSTEM_PROMPT = """\
You are EddivomAI, an autonomous AI agent embedded inside a Japanese LaTeX document editor called Eddivom.
Users create educational materials, worksheets, and exams using a block-based editor.

## CRITICAL: ALWAYS USE THE TOOL
- When the user asks to create or edit any document content, you MUST call the edit_document tool.
- NEVER respond with only text when the user wants content created.
- Do not ask for clarification — make reasonable assumptions and build immediately.
- Do not explain what you are about to do — just do it via the tool.

## Document Block Types
- heading: { type: "heading", text: string, level: 1|2|3 }
- paragraph: { type: "paragraph", text: string }  (supports inline $math$)
- math: { type: "math", latex: string, displayMode: boolean }  (displayMode: true for standalone equations)
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
Every new block needs a unique ID in the format "ai-" + 8 hex chars (e.g. "ai-3f8a1b2c").

## How to build a full worksheet
When asked to create a worksheet or problem set:
1. Add a heading block (level 1) for the title
2. Add a paragraph block with instructions
3. Add math blocks (displayMode: true) for each equation
4. Use numbered list blocks for problem sets
5. Add a divider between sections if needed
6. For afterId: use null for the first block, then use the previous block's ID for each subsequent block

## LaTeX examples
- Quadratic: \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
- Fraction: \\frac{a}{b}
- Square root: \\sqrt{x}
- Power: x^{2}
- Subscript: x_{1}

## After calling the tool
Write 1 short sentence in Japanese summarizing what was created.
Respond in Japanese unless the user writes in English.
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


def _deep_to_dict(obj: Any) -> Any:
    """
    Gemini の function_call.args を完全な Python dict/list に変換する。
    ネストされた proto オブジェクトも再帰的に処理する。
    """
    if isinstance(obj, dict):
        return {k: _deep_to_dict(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deep_to_dict(v) for v in obj]
    # proto MapComposite / RepeatedComposite 対策
    if hasattr(obj, "items"):
        return {k: _deep_to_dict(v) for k, v in obj.items()}
    if hasattr(obj, "__iter__") and not isinstance(obj, (str, bytes)):
        return [_deep_to_dict(v) for v in obj]
    return obj


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
    Gemini でチャットし、ドキュメント編集パッチを返す。
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

    # Gemini 形式の contents を構築（role: "user" | "model"）
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
        # AUTO: モデルが自由に tool か text を選ぶ（デフォルト）
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO")
        ),
    )

    def _call():
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config,
        )

    response = await asyncio.to_thread(_call)

    # ─── レスポンスのパース ───
    text_parts: list[str] = []
    patches = None

    try:
        candidate = response.candidates[0]
        finish_reason = str(candidate.finish_reason) if candidate.finish_reason else ""
        logger.info("Gemini finish_reason: %s", finish_reason)

        for part in candidate.content.parts:
            # thought パーツ（gemini-2.5 の内部思考）はスキップ
            if getattr(part, "thought", False):
                continue

            if part.text:
                text_parts.append(part.text)

            if part.function_call and part.function_call.name == "edit_document":
                raw_args = part.function_call.args
                patches = _deep_to_dict(raw_args)
                logger.info("edit_document called, ops count: %d", len(patches.get("ops", [])))

    except (IndexError, AttributeError) as e:
        logger.error("Gemini レスポンスのパースに失敗: %s", e, exc_info=True)

    message = "\n".join(text_parts).strip()

    if not message and patches:
        ops = patches.get("ops", [])
        message = f"{len(ops)}件の変更を適用しました。"
    elif not message and not patches:
        # 何も返ってこなかった場合のフォールバック
        logger.warning("Gemini returned empty response (no text, no function call)")
        message = "応答を取得できませんでした。もう一度お試しください。"

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

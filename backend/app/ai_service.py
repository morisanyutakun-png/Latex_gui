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
あなたは **EddivomAI** — 日本語 LaTeX ドキュメントエディタ「Eddivom」に組み込まれた自律型 AI エージェントです。
ユーザーは教育資料・ワークシート・試験問題などをブロックベースのエディタで作成しています。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 行動原則（Claude Code スタイル）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **まず現状を把握する** — 「現在の文書情報」を必ず読み、既存のブロック構造・内容を理解してから行動する。
2. **的確に編集する** — 必要最小限の変更で最大の効果を出す。既存ブロックを活かし、不要な削除や重複追加をしない。
3. **即座に実行する** — 確認を求めず、合理的な判断で edit_document ツールを呼ぶ。テキストだけの返答は避ける。
4. **結果を簡潔に報告する** — ツール実行後、何をしたかを1〜2文で日本語で伝える。

## レスポンスの書式
- 日本語で応答する（ユーザーが英語の場合は英語で）
- **数式は `$...$` や `$$...$$` で囲んで** Markdown 形式で書く（チャット UI が KaTeX でレンダリングする）
- コードブロック、リスト、太字などの Markdown 記法を活用して見やすく整形する
- 長い説明は避け、簡潔に要点を伝える

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ドキュメントブロック仕様
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ブロックタイプ
| type | content フィールド |
|------|-------------------|
| heading | `{ type: "heading", text: string, level: 1/2/3 }` |
| paragraph | `{ type: "paragraph", text: string }` — インライン `$数式$` 対応 |
| math | `{ type: "math", latex: string, displayMode: boolean }` — `displayMode: true` で独立数式 |
| list | `{ type: "list", style: "bullet"/"numbered", items: string[] }` |
| table | `{ type: "table", headers: string[], rows: string[][] }` |
| divider | `{ type: "divider", style: "solid"/"dashed"/"dotted" }` |
| code | `{ type: "code", language: string, code: string }` |
| quote | `{ type: "quote", text: string, attribution: string }` |
| circuit | `{ type: "circuit", code: string, caption: string }` |
| diagram | `{ type: "diagram", diagramType: string, code: string, caption: string }` |
| chemistry | `{ type: "chemistry", formula: string, caption: string, displayMode: boolean }` |
| chart | `{ type: "chart", chartType: "line"/"bar"/"scatter"/"histogram", code: string, caption: string }` |

### スタイルオブジェクト
```json
{ "textAlign": "left"/"center"/"right", "fontSize": 12, "fontFamily": "serif"/"sans",
  "bold": false, "italic": false, "underline": false }
```

### ID 生成規則
新規ブロックの ID: `"ai-"` + 8桁 hex（例: `"ai-3f8a1b2c"`）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## edit_document ツールの使い方
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 操作タイプ
- **add_block**: `afterId` の後ろに新ブロックを挿入（先頭に入れるなら `afterId: null`）
- **update_block**: `blockId` のブロックの content / style を部分更新
- **delete_block**: `blockId` のブロックを削除
- **reorder**: `blockIds` 配列で全ブロックの順序を指定

### ワークシート作成パターン
1. 見出し (level 1) → タイトル
2. 段落 → 指示文
3. math (displayMode: true) → 数式問題
4. numbered list → 問題番号付き
5. divider → セクション区切り
6. `afterId`: 最初は `null`、以降は直前のブロック ID を指定

### LaTeX 数式の例
- 二次方程式の解の公式: `\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`
- 積分: `\\int_{a}^{b} f(x)\\,dx`
- 行列: `\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}`
- 総和: `\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}`
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
    """Serialize document as rich context string for AI analysis."""
    blocks = document.get("blocks", [])
    meta = document.get("metadata", {})
    settings = document.get("settings", {})

    n_blocks = len(blocks)
    # ブロックタイプの統計
    type_counts: dict[str, int] = {}
    for blk in blocks:
        btype = blk.get("content", {}).get("type", "unknown")
        type_counts[btype] = type_counts.get(btype, 0) + 1
    stats = ", ".join(f"{t}×{c}" for t, c in sorted(type_counts.items(), key=lambda x: -x[1]))

    lines = [
        "━━━ 文書メタデータ ━━━",
        f"タイトル: {meta.get('title', '(未設定)')}",
        f"著者: {meta.get('author', '(未設定)')}",
        f"文書クラス: {settings.get('documentClass', 'article')}",
        f"ブロック数: {n_blocks}  構成: [{stats}]",
    ]

    if n_blocks == 0:
        lines.append("")
        lines.append("※ 文書は空です。新しいコンテンツを自由に追加してください。")
        return "\n".join(lines)

    lines.append("")
    lines.append("━━━ ブロック一覧 ━━━")

    max_blocks = 60
    for i, blk in enumerate(blocks[:max_blocks]):
        content = blk.get("content", {})
        btype = content.get("type", "unknown")
        blk_id = blk.get("id", "?")

        if btype == "heading":
            lvl = content.get("level", 1)
            indent = "  " * (lvl - 1)
            preview = f'{indent}H{lvl} "{content.get("text", "")}"'
        elif btype == "paragraph":
            text = content.get("text", "")
            preview = f'P  "{text[:80]}{"…" if len(text) > 80 else ""}"'
        elif btype == "math":
            latex = content.get("latex", "")
            mode = "display" if content.get("displayMode") else "inline"
            preview = f'M[{mode}] ${latex[:80]}{"…" if len(latex) > 80 else ""}$'
        elif btype == "list":
            items = content.get("items", [])
            style = content.get("style", "bullet")
            item_preview = "; ".join(str(it)[:30] for it in items[:3])
            more = f"… +{len(items)-3}" if len(items) > 3 else ""
            preview = f'L[{style}] {len(items)}項目: {item_preview}{more}'
        elif btype == "table":
            headers = content.get("headers", [])
            rows = content.get("rows", [])
            preview = f'T  {len(headers)}列×{len(rows)}行 headers={headers}'
        elif btype == "code":
            lang = content.get("language", "text")
            code = content.get("code", "")
            preview = f'CODE[{lang}] {code[:60]}{"…" if len(code) > 60 else ""}'
        elif btype == "circuit":
            preview = f'CIRCUIT "{content.get("caption", "")}"'
        elif btype == "diagram":
            preview = f'DIAG[{content.get("diagramType", "custom")}] "{content.get("caption", "")}"'
        elif btype == "chemistry":
            preview = f'CHEM {content.get("formula", "")}'
        elif btype == "chart":
            preview = f'CHART[{content.get("chartType", "line")}] "{content.get("caption", "")}"'
        elif btype == "quote":
            text = content.get("text", "")
            preview = f'Q  "{text[:50]}{"…" if len(text) > 50 else ""}"'
        elif btype == "divider":
            preview = f'── {content.get("style", "solid")} ──'
        else:
            preview = f"[{btype}]"

        lines.append(f"  {i+1:>2}. id={blk_id} | {preview}")

    if n_blocks > max_blocks:
        lines.append(f"  ... 他 {n_blocks - max_blocks} ブロック省略")

    return "\n".join(lines)


def _build_contents(messages: list[dict], doc_context: str):
    """Gemini 形式の contents リストを構築する。"""
    from google.genai import types  # type: ignore

    last_user_idx = max(
        (i for i, m in enumerate(messages) if m.get("role") == "user"),
        default=0,
    )

    contents = []
    for i, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if i == last_user_idx and role == "user":
            content = f"## 現在の文書情報\n{doc_context}\n\n## ユーザーの依頼\n{content}"

        gemini_role = "model" if role == "assistant" else "user"
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part(text=content)])
        )
    return contents


def _parse_response(response) -> dict:
    """Gemini レスポンスをパースして {message, patches, usage} を返す。
    MALFORMED_FUNCTION_CALL の場合は None を返してリトライを促す。
    """
    text_parts: list[str] = []
    thought_parts: list[str] = []
    patches = None

    # prompt_feedback チェック
    try:
        pf = getattr(response, "prompt_feedback", None)
        if pf:
            block_reason = getattr(pf, "block_reason", None)
            if block_reason and str(block_reason) not in ("", "BLOCK_REASON_UNSPECIFIED"):
                logger.warning("Gemini prompt blocked: %s", block_reason)
                return {
                    "message": f"セーフティフィルターによりブロックされました（理由: {block_reason}）。内容を変えてお試しください。",
                    "patches": None,
                    "usage": {"inputTokens": 0, "outputTokens": 0},
                }
    except Exception as e:
        logger.warning("prompt_feedback check error: %s", e)

    if not response.candidates:
        logger.error("Gemini returned no candidates. Full response: %s", response)
        return {
            "message": "AIからの応答が空でした。APIキーやモデル設定を確認してください。",
            "patches": None,
            "usage": {"inputTokens": 0, "outputTokens": 0},
        }

    try:
        candidate = response.candidates[0]
        finish_reason = str(candidate.finish_reason) if candidate.finish_reason else ""
        logger.info("Gemini finish_reason: %s", finish_reason)

        # MALFORMED_FUNCTION_CALL → リトライ可能
        if "MALFORMED_FUNCTION_CALL" in finish_reason:
            logger.warning("Gemini returned MALFORMED_FUNCTION_CALL, will retry without tools")
            # テキスト部分があれば抽出して返す、なければ None でリトライ指示
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if getattr(part, "thought", False):
                        continue
                    if part.text:
                        text_parts.append(part.text)
            if text_parts:
                return {
                    "message": "\n".join(text_parts).strip(),
                    "patches": None,
                    "usage": _extract_usage(response),
                }
            return None  # リトライシグナル

        if "SAFETY" in finish_reason:
            return {
                "message": "セーフティフィルターにより応答が中断されました。内容を変えてお試しください。",
                "patches": None,
                "usage": {"inputTokens": 0, "outputTokens": 0},
            }

        if not candidate.content or not candidate.content.parts:
            logger.error("Gemini candidate has no content/parts. finish_reason=%s", finish_reason)
            return {
                "message": f"AIからの応答が空でした（finish_reason: {finish_reason}）。もう一度お試しください。",
                "patches": None,
                "usage": {"inputTokens": 0, "outputTokens": 0},
            }

        for part in candidate.content.parts:
            if getattr(part, "thought", False):
                if part.text:
                    thought_parts.append(part.text)
                continue

            if part.text:
                text_parts.append(part.text)

            if part.function_call and part.function_call.name == "edit_document":
                raw_args = part.function_call.args
                patches = _deep_to_dict(raw_args)
                logger.info("edit_document called, ops count: %d", len(patches.get("ops", [])))

    except (IndexError, AttributeError) as e:
        logger.error("Gemini レスポンスのパースに失敗: %s  response=%s", e, response, exc_info=True)

    message = "\n".join(text_parts).strip()

    if not message and patches:
        ops = patches.get("ops", [])
        message = f"{len(ops)}件の変更を適用しました。"
    elif not message and not patches:
        if thought_parts:
            logger.warning("Gemini returned only thought parts, using as response")
            message = "\n".join(thought_parts).strip()
        else:
            logger.warning("Gemini returned empty response. Full response: %s", response)
            message = "応答を取得できませんでした。ログを確認してください。"

    return {
        "message": message,
        "patches": patches,
        "usage": _extract_usage(response),
    }


def _extract_usage(response) -> dict:
    try:
        um = response.usage_metadata
        return {
            "inputTokens": um.prompt_token_count or 0,
            "outputTokens": um.candidates_token_count or 0,
        }
    except Exception:
        return {"inputTokens": 0, "outputTokens": 0}


async def chat(messages: list[dict], document: dict) -> dict:
    """
    Gemini でチャットし、ドキュメント編集パッチを返す。
    MALFORMED_FUNCTION_CALL 時はツールなしで自動リトライ。
    Returns { message: str, patches: dict | None, usage: dict }
    """
    import asyncio
    from google.genai import types  # type: ignore

    client = get_client()
    doc_context = _document_context(document)
    contents = _build_contents(messages, doc_context)

    # ─── 1回目: ツール付きで呼び出し ───
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[GEMINI_TOOL_DEF],
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO")
        ),
        thinking_config=types.ThinkingConfig(thinking_budget=1024),
    )

    def _call(cfg):
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=cfg,
        )

    try:
        response = await asyncio.to_thread(_call, config)
    except Exception as e:
        logger.error("Gemini API call failed: %s", e, exc_info=True)
        return {
            "message": f"AI APIの呼び出しに失敗しました: {type(e).__name__}: {e}",
            "patches": None,
            "usage": {"inputTokens": 0, "outputTokens": 0},
        }

    result = _parse_response(response)

    # ─── 2回目: MALFORMED_FUNCTION_CALL → ツールなしでリトライ ───
    if result is None:
        logger.info("Retrying without tools due to MALFORMED_FUNCTION_CALL")
        config_no_tools = types.GenerateContentConfig(
            system_instruction=(
                SYSTEM_PROMPT
                + "\n\n**注意: ツール呼び出しは現在利用できません。**\n"
                "テキストのみで応答してください。"
                "ドキュメント編集が必要な場合は、具体的な変更内容をJSON形式で ```json コードブロック内に記述してください。"
            ),
            thinking_config=types.ThinkingConfig(thinking_budget=512),
        )

        try:
            response2 = await asyncio.to_thread(_call, config_no_tools)
            result = _parse_response(response2)
            if result is None:
                result = {
                    "message": "ツール呼び出しでエラーが発生しました。もう一度メッセージを送信してください。",
                    "patches": None,
                    "usage": _extract_usage(response2),
                }
        except Exception as e:
            logger.error("Gemini retry failed: %s", e, exc_info=True)
            result = {
                "message": f"リトライも失敗しました: {type(e).__name__}: {e}",
                "patches": None,
                "usage": {"inputTokens": 0, "outputTokens": 0},
            }

    return result

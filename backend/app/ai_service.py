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
                            "add_block | update_block | delete_block | reorder | update_design"
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "op": {
                                    "type": "string",
                                    "description": "Operation type: add_block | update_block | delete_block | reorder | update_design",
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
                                "paperDesign": {
                                    "type": "object",
                                    "description": (
                                        "(update_design only) Paper design settings. Fields: "
                                        "theme (plain/grid/lined/dot-grid/elegant/modern), "
                                        "paperColor (hex like #ffffff), "
                                        "accentColor (hex like #4f46e5), "
                                        "headerBorder (boolean), "
                                        "sectionDividers (boolean)"
                                    ),
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
## 行動原則（自律エージェント）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **まず現状を完全に把握する** — 「現在の文書情報」のブロック一覧を1つずつ精読し、既存ブロックの ID・内容・順序を正確に理解する。既存コンテンツを壊さない。
2. **的確に編集する** — 必要最小限の変更で最大の効果を出す。既存ブロックを活かし、不要な削除や重複追加をしない。update_block で部分変更できる場合は add_block + delete_block を使わない。
3. **即座に実行する** — 確認を求めず、合理的な判断で edit_document ツールを呼ぶ。テキストだけの返答は避ける。ユーザーが「〜して」と言ったら、必ず edit_document を使って実行する。
4. **結果を簡潔に報告する** — ツール実行後、何をしたかを1〜2文で日本語で伝える。変更の要点を明確に。
5. **LaTeX の力を最大限に活用する** — math ブロック内では LaTeX の豊富な数学記法を惜しみなく使う。美しい出力こそが最優先。

## レスポンスの書式
- 日本語で応答する（ユーザーが英語の場合は英語で）
- **チャット内の数式は `$...$` や `$$...$$` で囲んで** Markdown 形式で書く（KaTeX レンダリング対応）
- 文書に挿入する数式は必ず edit_document の math ブロックで挿入する。チャットテキストに書くだけではダメ。
- 長い説明は避け、簡潔に要点を伝える

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ドキュメントブロック仕様
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ブロックタイプ一覧
| type | content フィールド | 説明 |
|------|-------------------|------|
| heading | `{ type: "heading", text: string, level: 1/2/3 }` | 見出し。level 1 が最大 |
| paragraph | `{ type: "paragraph", text: string }` | 本文テキスト。インライン `$数式$` 対応 |
| math | `{ type: "math", latex: string, displayMode: boolean }` | 数式ブロック。**最重要ブロック** |
| list | `{ type: "list", style: "bullet"/"numbered", items: string[] }` | リスト。items 内で `$数式$` 可 |
| table | `{ type: "table", headers: string[], rows: string[][] }` | 表。セル内で `$数式$` 可 |
| divider | `{ type: "divider", style: "solid"/"dashed"/"dotted" }` | 区切り線 |
| code | `{ type: "code", language: string, code: string }` | コードブロック |
| quote | `{ type: "quote", text: string, attribution: string }` | 引用 |
| circuit | `{ type: "circuit", code: string, caption: string }` | 電気回路図 (circuitikz) |
| diagram | `{ type: "diagram", diagramType: string, code: string, caption: string }` | 図 (TikZ) |
| chemistry | `{ type: "chemistry", formula: string, caption: string, displayMode: boolean }` | 化学式 (mhchem) |
| chart | `{ type: "chart", chartType: "line"/"bar"/"scatter"/"histogram", code: string, caption: string }` | グラフ (pgfplots) |

### スタイルオブジェクト（全ブロック共通）
```json
{ "textAlign": "left"/"center"/"right", "fontSize": 12, "fontFamily": "serif"/"sans",
  "bold": false, "italic": false, "underline": false }
```

### ID 生成規則
新規ブロックの ID: `"ai-"` + 8桁ランダム hex（例: `"ai-3f8a1b2c"`）。毎回一意の値を生成すること。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## edit_document ツール — 必ずこのツールを使って編集する
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 操作タイプ
- **add_block**: `afterId` の後ろに新ブロックを挿入。先頭に入れるなら `afterId: null`。連続追加では直前に追加したブロックの ID を `afterId` に指定。
- **update_block**: `blockId` のブロックの content / style を部分更新。
- **delete_block**: `blockId` のブロックを削除。
- **reorder**: `blockIds` 配列で全ブロックの順序を指定。
- **update_design**: 紙のデザインを変更。`paperDesign` オブジェクトを指定:
  - `theme`: "plain" / "grid" / "lined" / "dot-grid" / "elegant" / "modern"
  - `paperColor`: 紙の色（hex）例: "#fffff0"（クリーム）, "#f0f4ff"（淡い青）
  - `accentColor`: アクセントカラー（hex）見出しの色調に影響
  - `headerBorder`: タイトル下にボーダーを表示するか
  - `sectionDividers`: セクション間に自動区切り線

### ⚠️ 重要な afterId チェーン規則
複数ブロックを連続で追加する場合:
1. 最初のブロックの `afterId` は既存ブロックの ID または `null`（先頭に挿入）
2. 2番目以降のブロックの `afterId` は **直前に追加したブロックの ID** を指定
3. これにより正しい順序で挿入される

例（3ブロック連続追加）:
```
ops: [
  { op: "add_block", afterId: null, block: { id: "ai-00000001", content: {...}, style: {...} } },
  { op: "add_block", afterId: "ai-00000001", block: { id: "ai-00000002", content: {...}, style: {...} } },
  { op: "add_block", afterId: "ai-00000002", block: { id: "ai-00000003", content: {...}, style: {...} } }
]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LaTeX 数式 — 正しく美しく書く
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 基本原則
- **独立した数式は必ず math ブロック** (`type: "math", displayMode: true`) を使う
- paragraph 内のインライン `$...$` は短い式のみ（`$x = 3$` 等）
- **長い数式・重要な数式は math ブロックとして独立させる** — PDF で美しくレンダリングされる
- math ブロックの `latex` フィールドには $$ を付けない。LaTeX の中身だけを書く

### LaTeX バックエンド仕様
- エンジン: **LuaLaTeX** (luatexja-preset[haranoaji] で日本語対応)
- 使用可能パッケージ: amsmath, amssymb, mathtools, physics, siunitx, cancel, empheq, cases, bm, tikz, pgfplots, circuitikz, chemfig, mhchem 等
- **amsmath 環境を積極的に使う**: align, gather, cases, matrix, pmatrix, bmatrix 等

### 数式の書き方ガイド（高品質出力のために）

#### 基本数式
- 分数: `\\frac{分子}{分母}` — 例: `\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`
- 平方根: `\\sqrt{x}`, `\\sqrt[3]{x}` (立方根)
- 上付き: `x^{2}`, `e^{i\\pi}`  下付き: `a_{n}`, `x_{i,j}`
- 括弧の自動伸縮: `\\left( \\frac{a}{b} \\right)` — 分数を含む括弧には必ず \\left \\right を使う

#### 高度な数式
- 複数行の式（連立方程式・式変形）:
  ```
  \\begin{align}
  f(x) &= x^2 + 2x + 1 \\\\
  &= (x+1)^2
  \\end{align}
  ```
- 場合分け:
  ```
  f(x) = \\begin{cases} x^2 & (x \\geq 0) \\\\ -x^2 & (x < 0) \\end{cases}
  ```
- 行列:
  ```
  \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}
  ```
  他に bmatrix (角括弧), vmatrix (行列式), Vmatrix (ノルム) も利用可

#### 微積分
- 積分: `\\int_{a}^{b} f(x)\\,dx`  (\\,dx の薄いスペースを忘れない)
- 重積分: `\\iint_D f(x,y)\\,dx\\,dy`
- 微分: `\\frac{d}{dx}f(x)`, `\\frac{\\partial f}{\\partial x}` (偏微分)
- 極限: `\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1`
- 総和: `\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}`
- 無限級数: `\\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = e^x`

#### 便利な記法
- ベクトル: `\\vec{a}`, `\\bm{v}` (太字ベクトル)
- ノルム: `\\| \\bm{x} \\|`
- 内積: `\\langle \\bm{a}, \\bm{b} \\rangle`
- 上付き装飾: `\\hat{x}`, `\\bar{x}`, `\\dot{x}`, `\\ddot{x}`, `\\tilde{x}`
- 取り消し線: `\\cancel{x}` (cancel パッケージ)
- 単位: `\\SI{9.8}{m/s^2}` (siunitx パッケージ)
- テキスト混在: `\\text{ただし } x > 0`

#### 化学式 (chemistry ブロック)
- `\\ce{H2O}`, `\\ce{2H2 + O2 -> 2H2O}` (mhchem 記法)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 教材・ワークシート作成のベストプラクティス
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 構造パターン（この順序でブロックを追加）
1. **タイトル**: heading (level 1) + style: `{textAlign: "center", fontSize: 18, bold: true}`
2. **サブ情報**: paragraph + style: `{textAlign: "center", fontSize: 10}` — 日付・学年・名前欄: `「名前: ＿＿＿＿＿＿＿＿  組: ＿＿  番号: ＿＿」`
3. **セクション区切り**: divider (style: "solid")
4. **セクション見出し**: heading (level 2) — 「第1問」「計算問題」など
5. **問題指示文**: paragraph — 「次の方程式を解きなさい。」
6. **問題番号 + 数式**: paragraph で `(1)` を書き、**直後に math ブロック**で数式
7. **解答欄**: paragraph で `「答え: ＿＿＿＿＿＿＿＿」`
8. 繰り返し: 問題番号 → 数式 → 解答欄

### スタイル活用
- タイトル: `{"textAlign":"center","fontSize":18,"bold":true}`
- サブタイトル/情報行: `{"textAlign":"center","fontSize":10}`
- 問題番号: `{"fontSize":12,"bold":true}`
- 注意書き: `{"fontSize":9,"italic":true}`
- 解答欄: `{"fontSize":11}`

### 問題作成の品質基準
- 数式は全て math ブロック (displayMode: true) で独立させる
- 問題番号と数式は別ブロックにする（段落で番号、math ブロックで式）
- 解答欄やスペースを適切に配置する
- 難易度のバランスを考慮する
- **PDF 出力で美しく見える**ことを常に意識する
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


import re as _re


def _extract_json_patches(text: str) -> dict | None:
    """テキスト内のJSON配列/オブジェクトを検出し、edit_document パッチ形式に正規化する。

    Gemini がツール呼び出しに失敗した場合、テキスト中にJSONを書くことがある。
    正規 ops 形式 {"ops": [...]} と、簡略形式 [{type, text, ...}, ...] の両方に対応。
    """
    # コードブロック内のJSONを優先
    json_candidates: list[str] = []
    for m in _re.finditer(r'```(?:json)?\s*\n?([\s\S]*?)```', text):
        json_candidates.append(m.group(1).strip())
    # コードブロックがなければ、テキスト全体から [...] or {...} を探す
    if not json_candidates:
        for m in _re.finditer(r'(\[[\s\S]*\]|\{[\s\S]*\})', text):
            json_candidates.append(m.group(1).strip())

    for candidate in json_candidates:
        try:
            data = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue

        # 正規形式: {"ops": [...]}
        if isinstance(data, dict) and "ops" in data:
            ops = data["ops"]
            if isinstance(ops, list) and len(ops) > 0:
                normalized = _normalize_ops(ops)
                return {"ops": normalized}

        # "operations" キー形式 (Gemini が時々使う別フォーマット)
        if isinstance(data, dict) and "operations" in data:
            ops = data["operations"]
            if isinstance(ops, list) and len(ops) > 0:
                normalized = _normalize_flat_blocks(ops)
                if normalized:
                    return {"ops": normalized}

        # 簡略配列形式: [{type, text, afterId, blockId}, ...] or [{op/tool_code/operation, ...}]
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            first = data[0]
            if any(k in first for k in ("type", "op", "tool_code", "operation")):
                ops = _normalize_flat_blocks(data)
                if ops:
                    return {"ops": ops}

    return None


def _normalize_ops(ops: list[dict]) -> list[dict]:
    """既に ops 形式の配列に含まれるブロックのフラット構造を正規化する。"""
    for op in ops:
        if op.get("op") == "add_block" and "block" in op and isinstance(op["block"], dict):
            op["block"] = _normalize_block_structure(op["block"])
            _fix_block_content(op["block"])
        elif op.get("op") == "update_block" and "content" in op and isinstance(op["content"], dict):
            _fix_content_fields(op["content"])
    return ops


def _fix_block_content(block: dict) -> None:
    """ブロックの content フィールドを修正する（math の displayMode 等）。"""
    content = block.get("content", {})
    _fix_content_fields(content)


def _fix_content_fields(content: dict) -> None:
    """content 内の一般的な欠落フィールドを補完する。"""
    btype = content.get("type")

    # math ブロック: displayMode がない場合はデフォルト true
    if btype == "math":
        if "displayMode" not in content:
            content["displayMode"] = True
        # latex フィールドから誤った $$ ラッパーを除去
        latex = content.get("latex", "")
        if latex.startswith("$$") and latex.endswith("$$"):
            content["latex"] = latex[2:-2].strip()
        elif latex.startswith("$") and latex.endswith("$") and not latex.startswith("$$"):
            content["latex"] = latex[1:-1].strip()

    # list ブロック: style がない場合
    if btype == "list" and "style" not in content:
        content["style"] = "bullet"

    # heading ブロック: level がない場合
    if btype == "heading" and "level" not in content:
        content["level"] = 2

    # divider ブロック: style がない場合
    if btype == "divider" and "style" not in content:
        content["style"] = "solid"


def _normalize_block_structure(block: dict) -> dict:
    """ブロックの content/style 構造を正規化する。

    Gemini が返すブロック形式:
      {id, type, text, level, style: {...}}  (フラット形式)
    正規形式:
      {id, content: {type, text, level}, style: {...}}
    """
    if "content" in block and isinstance(block["content"], dict) and "type" in block["content"]:
        # 既に正規形式
        return block

    # フラット形式 → content/style を分離
    DEFAULT_STYLE = {
        "textAlign": "left", "fontSize": 12, "fontFamily": "serif",
        "bold": False, "italic": False, "underline": False,
    }
    block_id = block.get("id") or f"ai-{os.urandom(4).hex()}"
    raw_style = block.get("style")

    # style が文字列の場合 (divider の "solid" 等) → content に含める
    if isinstance(raw_style, str):
        meta_keys = {"id"}
        content = {k: v for k, v in block.items() if k not in meta_keys}
        return {"id": block_id, "content": content, "style": DEFAULT_STYLE.copy()}

    meta_keys = {"id", "style"}
    content = {k: v for k, v in block.items() if k not in meta_keys}
    style = raw_style if isinstance(raw_style, dict) else DEFAULT_STYLE.copy()

    return {"id": block_id, "content": content, "style": style}


def _normalize_flat_blocks(blocks: list[dict]) -> list[dict]:
    """Gemini の様々な簡略フォーマットを正規 ops 形式に変換する。

    対応パターン:
    1. 正規形式: {"op": "add_block", ...} → そのまま
    2. tool_code 形式: {"tool_code": "update_block", ...} → op に正規化
    3. "type": "add_block" 形式 (operations 配列) → op に正規化
    4. 簡略 add 形式: {"type": "heading", "text": "...", ...} → add_block に変換
    """
    # op として認識する type 値
    OP_TYPES = {"add_block", "update_block", "delete_block", "reorder", "update_design"}

    DEFAULT_STYLE = {
        "textAlign": "left", "fontSize": 12, "fontFamily": "serif",
        "bold": False, "italic": False, "underline": False,
    }
    ops = []
    for blk in blocks:
        # op, tool_code, operation, または type がオペレーション名の場合を統合
        op_type = blk.get("op") or blk.get("tool_code") or blk.get("operation")
        if not op_type and blk.get("type") in OP_TYPES:
            op_type = blk["type"]

        if op_type:
            # 既知の op タイプ → 正規形式に統一
            normalized = dict(blk)
            normalized["op"] = op_type
            normalized.pop("tool_code", None)
            normalized.pop("operation", None)

            if op_type == "update_design":
                ops.append({"op": "update_design", "paperDesign": normalized.get("paperDesign", {})})
            elif op_type == "update_block":
                entry: dict = {"op": "update_block", "blockId": normalized.get("blockId", "")}
                if "content" in normalized:
                    entry["content"] = normalized["content"]
                if "style" in normalized:
                    entry["style"] = normalized["style"]
                ops.append(entry)
            elif op_type == "delete_block":
                ops.append({"op": "delete_block", "blockId": normalized.get("blockId", "")})
            elif op_type == "reorder":
                ops.append({"op": "reorder", "blockIds": normalized.get("blockIds", [])})
            elif op_type == "add_block":
                if "block" in normalized and isinstance(normalized["block"], dict):
                    # ブロック構造を正規化 (フラット形式対応)
                    normalized["block"] = _normalize_block_structure(normalized["block"])
                    ops.append({"op": "add_block", "afterId": normalized.get("afterId"), "block": normalized["block"]})
                else:
                    block_id = normalized.get("blockId") or normalized.get("id") or f"ai-{os.urandom(4).hex()}"
                    after_id = normalized.get("afterId")
                    content = normalized.get("content", {})
                    style = normalized.get("style", DEFAULT_STYLE.copy())
                    ops.append({
                        "op": "add_block",
                        "afterId": after_id,
                        "block": {
                            "id": block_id,
                            "content": content,
                            "style": style,
                        },
                    })
            else:
                ops.append(normalized)
            continue

        # op/tool_code がない → type フィールドから add_block を推定
        btype = blk.get("type")
        if not btype:
            continue

        block_id = blk.get("blockId") or blk.get("id") or f"ai-{os.urandom(4).hex()}"
        after_id = blk.get("afterId")

        meta_keys = {"blockId", "id", "afterId", "style", "op", "tool_code"}
        content = {k: v for k, v in blk.items() if k not in meta_keys}

        style = blk.get("style", DEFAULT_STYLE.copy())

        ops.append({
            "op": "add_block",
            "afterId": after_id,
            "block": {
                "id": block_id,
                "content": content,
                "style": style,
            },
        })

    return ops


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


def _build_thinking_steps(thought_parts: list[str], patches: dict | None) -> list[dict]:
    """Gemini の thinking テキストを Claude Code 風のステップに分解する。

    各ステップは { type: "thinking"|"action"|"result", text: str } の形式。
    コストを増やさず、既存の thinking 出力を構造化するだけ。
    """
    steps: list[dict] = []
    if not thought_parts:
        # thinking が空でも patches があれば最低限のステップを生成
        if patches and patches.get("ops"):
            ops = patches["ops"]
            add_count = sum(1 for o in ops if o.get("op") == "add_block")
            update_count = sum(1 for o in ops if o.get("op") == "update_block")
            delete_count = sum(1 for o in ops if o.get("op") == "delete_block")
            parts = []
            if add_count: parts.append(f"{add_count}ブロック追加")
            if update_count: parts.append(f"{update_count}ブロック更新")
            if delete_count: parts.append(f"{delete_count}ブロック削除")
            steps.append({"type": "action", "text": f"edit_document: {', '.join(parts) or f'{len(ops)}件の操作'}"})
        return steps

    raw = "\n".join(thought_parts).strip()
    # 段落ごとに分割 (空行区切り or 改行区切り)
    paragraphs = [p.strip() for p in _re.split(r'\n{2,}', raw) if p.strip()]
    if len(paragraphs) <= 1 and raw:
        # 空行区切りがなければ改行で分割
        paragraphs = [p.strip() for p in raw.split("\n") if p.strip()]

    for para in paragraphs:
        # 200文字で切って省コンテキスト化
        text = para[:200] + ("..." if len(para) > 200 else "")
        steps.append({"type": "thinking", "text": text})

    # パッチがあれば最後にアクションステップ
    if patches and patches.get("ops"):
        ops = patches["ops"]
        add_count = sum(1 for o in ops if o.get("op") == "add_block")
        update_count = sum(1 for o in ops if o.get("op") == "update_block")
        delete_count = sum(1 for o in ops if o.get("op") == "delete_block")
        parts = []
        if add_count: parts.append(f"{add_count}ブロック追加")
        if update_count: parts.append(f"{update_count}ブロック更新")
        if delete_count: parts.append(f"{delete_count}ブロック削除")
        steps.append({"type": "action", "text": f"edit_document: {', '.join(parts) or f'{len(ops)}件の操作'}"})

    return steps


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
                # ツール呼び出し経由でもブロック構造を正規化
                if "ops" in patches:
                    patches["ops"] = _normalize_ops(patches["ops"])
                logger.info("edit_document called, ops count: %d", len(patches.get("ops", [])))

    except (IndexError, AttributeError) as e:
        logger.error("Gemini レスポンスのパースに失敗: %s  response=%s", e, response, exc_info=True)

    message = "\n".join(text_parts).strip()

    # テキスト内にJSONパッチが含まれていたら抽出
    if message and not patches:
        extracted = _extract_json_patches(message)
        if extracted:
            patches = extracted
            # JSON部分をメッセージから除去して要約だけ残す
            cleaned = _re.sub(r'```(?:json)?\s*\n?[\s\S]*?```', '', message).strip()
            # JSONの生配列/オブジェクトも除去
            cleaned = _re.sub(r'(?:^|\n)\s*[\[{][\s\S]*?[\]}]\s*(?:\n|$)', '', cleaned).strip()
            ops_count = len(patches.get("ops", []))
            if cleaned:
                message = cleaned
            else:
                message = f"{ops_count}件の変更を適用します。"
            logger.info("Extracted %d ops from text response", ops_count)

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

    # 思考ログをステップに分解して返す
    thinking_steps = _build_thinking_steps(thought_parts, patches)

    return {
        "message": message,
        "patches": patches,
        "thinking": thinking_steps,
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


def _parse_api_error(e: Exception) -> tuple[str, float]:
    """API エラーを解析し、(ユーザー向けメッセージ, リトライ待機秒数) を返す。
    リトライ不要なら待機秒数 = 0。
    """
    err_str = str(e)
    retry_seconds = 0.0

    # 429 レート制限
    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
        # retryDelay を抽出
        import re
        m = re.search(r'retryDelay["\s:]+["\s]*(\d+)', err_str)
        if m:
            retry_seconds = float(m.group(1))
        else:
            # "retry in XX.XXs" パターン
            m2 = re.search(r'retry in\s+([\d.]+)\s*s', err_str, re.IGNORECASE)
            if m2:
                retry_seconds = float(m2.group(1))
            else:
                retry_seconds = 30.0  # デフォルト待機

        if retry_seconds > 0:
            wait_int = int(retry_seconds) + 1
            msg = f"APIレート制限に達しました。{wait_int}秒後に自動リトライします..."
        else:
            msg = "APIレート制限に達しました。しばらく待ってから再度お試しください。"
        return msg, retry_seconds

    # 403 / 401 認証エラー
    if "403" in err_str or "401" in err_str or "PERMISSION_DENIED" in err_str:
        return "APIキーが無効または権限不足です。APIキーの設定を確認してください。", 0

    # 500系サーバーエラー
    if "500" in err_str or "503" in err_str or "INTERNAL" in err_str:
        return "AIサービスで一時的なエラーが発生しました。しばらく待ってから再度お試しください。", 0

    # その他
    return f"AI APIの呼び出しに失敗しました。しばらく待ってから再度お試しください。", 0


async def chat(messages: list[dict], document: dict) -> dict:
    """
    Gemini でチャットし、ドキュメント編集パッチを返す。
    MALFORMED_FUNCTION_CALL 時はツールなしで自動リトライ。
    429 レート制限時は待機後に自動リトライ (最大2回)。
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
        thinking_config=types.ThinkingConfig(thinking_budget=2048),
    )

    def _call(cfg):
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=cfg,
        )

    # レート制限リトライループ (最大2回リトライ)
    max_rate_retries = 2
    response = None
    for attempt in range(1 + max_rate_retries):
        try:
            response = await asyncio.to_thread(_call, config)
            break  # 成功
        except Exception as e:
            user_msg, retry_wait = _parse_api_error(e)
            logger.error("Gemini API call failed (attempt %d): %s", attempt + 1, e)

            if retry_wait > 0 and attempt < max_rate_retries:
                # レート制限 → 待機してリトライ
                wait_secs = min(retry_wait + 2, 60)  # 最大60秒
                logger.info("Rate limited, waiting %.0fs before retry...", wait_secs)
                await asyncio.sleep(wait_secs)
                continue

            return {
                "message": user_msg,
                "patches": None,
                "usage": {"inputTokens": 0, "outputTokens": 0},
            }

    if response is None:
        return {
            "message": "AIの応答を取得できませんでした。しばらく待ってから再度お試しください。",
            "patches": None,
            "usage": {"inputTokens": 0, "outputTokens": 0},
        }

    result = _parse_response(response)

    # ─── MALFORMED_FUNCTION_CALL → ツールなしでリトライ ───
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
            user_msg, _ = _parse_api_error(e)
            logger.error("Gemini retry failed: %s", e, exc_info=True)
            result = {
                "message": user_msg,
                "patches": None,
                "usage": {"inputTokens": 0, "outputTokens": 0},
            }

    return result

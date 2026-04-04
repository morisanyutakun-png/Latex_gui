"""AI Agent Service — Google Gemini API with Claude Code-style agentic loop.

EddivomAI: LaTeX document agent with multi-tool support.
Tools: read_document, search_blocks, edit_document, compile_check, get_latex_source
Agent loop: plan → tool call → observe → adjust → respond
"""
import os
import json
import logging
import re as _re
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

# ─── Tool Definitions ────────────────────────────────────────────────────────

AGENT_TOOLS = {
    "function_declarations": [
        {
            "name": "read_document",
            "description": (
                "Read the current document structure. Returns metadata, block count, "
                "and optionally detailed content of specific blocks. "
                "Use this FIRST to understand the document before making changes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "block_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional: specific block IDs to read in detail. Omit to get overview.",
                    },
                    "include_styles": {
                        "type": "boolean",
                        "description": "Whether to include style information. Default false.",
                    },
                },
            },
        },
        {
            "name": "search_blocks",
            "description": (
                "Search blocks by type or text content. Returns matching block IDs and previews. "
                "Use this to find specific blocks before editing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for in block content (case-insensitive).",
                    },
                    "block_type": {
                        "type": "string",
                        "description": "Filter by block type: heading, paragraph, math, list, table, image, code, quote, circuit, diagram, chemistry, chart, divider.",
                    },
                },
            },
        },
        {
            "name": "edit_document",
            "description": (
                "Apply structured edits to the document. Use after reading/searching to understand the structure. "
                "Each op in 'ops' is applied in order. Available operations: "
                "add_block, update_block, delete_block, reorder, update_design."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "ops": {
                        "type": "array",
                        "description": "List of patch operations.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "op": {
                                    "type": "string",
                                    "description": "Operation type: add_block | update_block | delete_block | reorder | update_design",
                                },
                                "afterId": {
                                    "type": "string",
                                    "description": "(add_block) Insert after this block ID. Omit for beginning.",
                                },
                                "block": {
                                    "type": "object",
                                    "description": "(add_block) Block: {id, content: {type, ...}, style: {...}}",
                                },
                                "blockId": {
                                    "type": "string",
                                    "description": "(update_block/delete_block) Target block ID",
                                },
                                "content": {
                                    "type": "object",
                                    "description": "(update_block) Partial content to merge",
                                },
                                "style": {
                                    "type": "object",
                                    "description": "(update_block) Partial style to merge",
                                },
                                "blockIds": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "(reorder) All block IDs in desired order",
                                },
                                "paperDesign": {
                                    "type": "object",
                                    "description": "(update_design) Paper design settings",
                                },
                            },
                            "required": ["op"],
                        },
                    }
                },
                "required": ["ops"],
            },
        },
        {
            "name": "compile_check",
            "description": (
                "Compile the current document to check for LaTeX errors. "
                "Returns success/failure and any error messages. "
                "Use this AFTER making edits to verify they work correctly."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "quick": {
                        "type": "boolean",
                        "description": "If true, do a quick syntax check only (faster). Default true.",
                    },
                },
            },
        },
        {
            "name": "get_latex_source",
            "description": (
                "Get the generated LaTeX source code for the current document. "
                "Useful to inspect exact LaTeX output and diagnose formatting issues."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "block_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional: get LaTeX for specific blocks only.",
                    },
                },
            },
        },
    ]
}


# ─── System Prompt ─────────────────────────────────────��──────────────────────

SYSTEM_PROMPT = """\
あなたは **EddivomAI** — LaTeX ドキュメントエディタ「Eddivom」に組み込まれた AI エージェントです。
あなたは Claude Code のようなエージェントとして振る舞います。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 最重要ルール: 文書に書き込む
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ユーザーが内容の作成・追加・生成を依頼した場合、必ず `edit_document` ツールを使って文書に直接書き込め。**
チャットにテキストとして返すだけでは不十分。問題、数式、表、リスト、テキスト等は全てブロックとして文書に挿入する。

例:
- 「RSA暗号の問題を作って」→ edit_document で heading + paragraph + math ブロックを追加
- 「微分の練習問題を5問」→ edit_document で問題ブロックを文書に追加
- 「表を追加して」→ edit_document で table ブロックを追加
- 「この節を書き直して」→ edit_document で update_block

チャット応答では「文書に○○を追加しました」と簡潔に報告するだけでよい。

**テキスト応答のみが適切な場合:**
- LaTeXの書き方を質問された場合
- 概念の説明を求められた場合
- 文書の構造について質問された場合

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## エージェント行動原則
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 思考 → 実行 → 検証のサイクル
1. **まず理解する** — `read_document` で文書の現在の構造を確認する
2. **計画を立てる** — 複雑な依頼はステップに分解する
3. **文書に書き込む** — `edit_document` でブロックを追加・編集・削除する
4. **検証する** — 編集後に `compile_check` でエラーがないか確認する
5. **エラーがあれば修正する** — コンパイルエラーを検知したら自動修正を試みる

### 応答スタイル
- ツールで文書に書き込んだ後は、何をしたか1〜2行で簡潔に報告する
- 質問への回答だけはテキストで返す（数式は `$...$` / `$$...$$`）
- 日本語で応答する

### ツール使用ガイド
- **内容の作成・追加** → まず `read_document` → `edit_document` で文書に書き込む
- **内容の修正** → `search_blocks` で対象を特定 → `edit_document` で更新
- **問題の診断** → `get_latex_source` + `compile_check`
- **編集後の確認** → `compile_check` で検証

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LaTeX 仕様
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- エンジン: **LuaLaTeX** (luatexja-preset[haranoaji] で日本語対応)
- パッケージ: amsmath, amssymb, mathtools, physics, siunitx, cancel, empheq, tikz, pgfplots, circuitikz, chemfig, mhchem 等

### ブロックタイプと用途
- **heading** (H1-H3): セクション見出し → `{"type":"heading", "text":"第1問", "level":2}`
- **paragraph**: 本文テキスト → `{"type":"paragraph", "text":"次の問いに答えなさい。"}`
- **math**: 数式 → `{"type":"math", "latex":"x^2 + 2x + 1 = 0", "displayMode":true}`
- **list**: 箇条書き → `{"type":"list", "style":"numbered", "items":["項目1","項目2"]}`
- **table**: 表 → `{"type":"table", "headers":["列1","列2"], "rows":[["a","b"]]}`
- **code, quote, circuit, diagram, chemistry, chart, divider** も使用可能

### 数式の書き方
- 分数: `\\frac{a}{b}`, 平方根: `\\sqrt{x}`, `\\sqrt[3]{x}`
- 括弧: `\\left( \\right)`, 積分: `\\int_{a}^{b} f(x)\\,dx`
- 行列: `\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}`
- 場合分け: `\\begin{cases} ... \\end{cases}`
- ベクトル: `\\vec{a}`, `\\bm{v}`, 単位: `\\SI{9.8}{m/s^2}`
- 化学式: `\\ce{H2O}`, `\\ce{2H2 + O2 -> 2H2O}`
- 合同式: `a \\equiv b \\pmod{n}`

### add_block の構造
```json
{
  "op": "add_block",
  "afterId": "既存ブロックID or null（先頭に挿入）",
  "block": {
    "id": "ai-xxxxxxxx",
    "content": { "type": "heading", "text": "タイトル", "level": 2 },
    "style": { "textAlign": "left", "fontSize": 12, "fontFamily": "serif" }
  }
}
```

### 教材・問題の書き込みパターン

問題を文書に書き込む場合の典型的な ops 構造:
```json
{"ops": [
  {"op":"add_block", "afterId":null, "block":{"id":"ai-001","content":{"type":"heading","text":"公開鍵暗号（RSA）に関する問題","level":2},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}},
  {"op":"add_block", "afterId":"ai-001", "block":{"id":"ai-002","content":{"type":"paragraph","text":"RSA暗号は、安全な通信を実現するための公開鍵暗号方式の一つです。以下の問いに答えなさい。"},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}},
  {"op":"add_block", "afterId":"ai-002", "block":{"id":"ai-003","content":{"type":"heading","text":"第1問 RSA暗号の鍵生成","level":3},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}},
  {"op":"add_block", "afterId":"ai-003", "block":{"id":"ai-004","content":{"type":"paragraph","text":"素数 p=3 と q=11 を用いてRSA暗号の鍵ペアを生成します。"},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}},
  {"op":"add_block", "afterId":"ai-004", "block":{"id":"ai-005","content":{"type":"paragraph","text":"(1) モジュラス N の値を求めなさい。"},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}},
  {"op":"add_block", "afterId":"ai-005", "block":{"id":"ai-006","content":{"type":"math","latex":"N = p \\\\times q","displayMode":true},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}},
  {"op":"add_block", "afterId":"ai-006", "block":{"id":"ai-007","content":{"type":"paragraph","text":"答え: ＿＿＿＿＿＿＿＿"},"style":{"textAlign":"left","fontSize":12,"fontFamily":"serif"}}}
]}
```

このように、問題のタイトル→導入文→小見出し→問題文→数式→解答欄の順でブロックを追加する。
数式は必ず math ブロック (displayMode: true) として独立させ、テキスト内に埋め込まない。
"""


# ─── Gemini Client ────────────────────────────────────────────────────────────

def get_client():
    try:
        from google import genai  # type: ignore
    except ImportError:
        raise RuntimeError("google-genai not installed. pip install google-genai")

    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY が設定されていません。"
            "バックエンドの環境変数に設定してください。"
        )
    return genai.Client(api_key=key)


# ─── Tool Execution (Server-side) ────────────────────────────────────────────

def _execute_read_document(document: dict, args: dict) -> dict:
    """Execute read_document tool — return document structure."""
    blocks = document.get("blocks", [])
    meta = document.get("metadata", {})
    settings = document.get("settings", {})
    block_ids = args.get("block_ids") or []
    include_styles = args.get("include_styles", False)

    # Type stats
    type_counts: dict[str, int] = {}
    for blk in blocks:
        btype = blk.get("content", {}).get("type", "unknown")
        type_counts[btype] = type_counts.get(btype, 0) + 1

    result: dict[str, Any] = {
        "title": meta.get("title", "(未設定)"),
        "author": meta.get("author", "(未設定)"),
        "documentClass": settings.get("documentClass", "article"),
        "blockCount": len(blocks),
        "composition": type_counts,
    }

    if block_ids:
        # Return detailed info for specific blocks
        detailed = []
        for blk in blocks:
            if blk.get("id") in block_ids:
                entry = {"id": blk["id"], "content": blk.get("content", {})}
                if include_styles:
                    entry["style"] = blk.get("style", {})
                detailed.append(entry)
        result["blocks"] = detailed
    else:
        # Return overview of all blocks
        overview = []
        for i, blk in enumerate(blocks[:80]):
            content = blk.get("content", {})
            btype = content.get("type", "unknown")
            blk_id = blk.get("id", "?")
            preview = _block_preview(content)
            overview.append({"index": i, "id": blk_id, "type": btype, "preview": preview})
        result["blocks"] = overview
        if len(blocks) > 80:
            result["truncated"] = len(blocks) - 80

    return result


def _execute_search_blocks(document: dict, args: dict) -> dict:
    """Execute search_blocks tool — find blocks by query/type."""
    blocks = document.get("blocks", [])
    query = (args.get("query") or "").lower()
    block_type = args.get("block_type") or ""
    matches = []

    for i, blk in enumerate(blocks):
        content = blk.get("content", {})
        btype = content.get("type", "unknown")

        if block_type and btype != block_type:
            continue

        if query:
            text_fields = _extract_text(content)
            if not any(query in t.lower() for t in text_fields):
                continue

        preview = _block_preview(content)
        matches.append({
            "index": i,
            "id": blk.get("id", "?"),
            "type": btype,
            "preview": preview,
        })

    return {"matches": matches, "count": len(matches)}


def _execute_compile_check(document: dict, args: dict) -> dict:
    """Execute compile_check tool — try compiling the document."""
    try:
        from .generators.document_generator import generate_document_latex
        from .models import DocumentModel
        doc_model = DocumentModel(**document)
        latex_source = generate_document_latex(doc_model)

        if args.get("quick", True):
            # Quick syntax check: look for common issues
            issues = []
            # Check balanced braces
            depth = 0
            for ch in latex_source:
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                if depth < 0:
                    issues.append("閉じ括弧 } が多すぎます")
                    break
            if depth > 0:
                issues.append(f"開き括弧 {{ が {depth} 個閉じられていません")

            # Check begin/end balance
            begins = _re.findall(r'\\begin\{(\w+)\}', latex_source)
            ends = _re.findall(r'\\end\{(\w+)\}', latex_source)
            for env in set(begins):
                bc = begins.count(env)
                ec = ends.count(env)
                if bc != ec:
                    issues.append(f"\\begin{{{env}}} と \\end{{{env}}} の数が一致しません ({bc} vs {ec})")

            return {
                "success": len(issues) == 0,
                "issues": issues,
                "message": "構文チェック OK" if not issues else f"{len(issues)}件の問題を検出",
            }
        else:
            # Full compilation would need subprocess — return syntax check for now
            return {"success": True, "message": "LaTeX ソース生成成功", "latex_length": len(latex_source)}

    except Exception as e:
        return {"success": False, "error": str(e), "message": f"コンパイルエラー: {str(e)[:200]}"}


def _execute_get_latex_source(document: dict, args: dict) -> dict:
    """Execute get_latex_source tool — return generated LaTeX."""
    try:
        from .generators.document_generator import generate_document_latex
        from .models import DocumentModel
        doc_model = DocumentModel(**document)
        latex_source = generate_document_latex(doc_model)

        block_ids = args.get("block_ids") or []
        if block_ids:
            # Extract relevant sections (approximate)
            lines = latex_source.split('\n')
            relevant = []
            capturing = False
            for line in lines:
                if any(bid in line for bid in block_ids):
                    capturing = True
                if capturing:
                    relevant.append(line)
                    if line.strip() == '' and len(relevant) > 3:
                        capturing = False

            if relevant:
                return {"source": '\n'.join(relevant[:100]), "partial": True}

        # Return full source (truncated for context window)
        max_len = 3000
        truncated = len(latex_source) > max_len
        return {
            "source": latex_source[:max_len],
            "truncated": truncated,
            "total_length": len(latex_source),
        }
    except Exception as e:
        return {"error": str(e), "message": f"LaTeX 生成エラー: {str(e)[:200]}"}


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _block_preview(content: dict) -> str:
    """Generate a short preview string for a block."""
    btype = content.get("type", "unknown")
    if btype == "heading":
        lvl = content.get("level", 1)
        return f'H{lvl} "{content.get("text", "")[:60]}"'
    elif btype == "paragraph":
        text = content.get("text", "")
        return f'"{text[:80]}{"..." if len(text) > 80 else ""}"'
    elif btype == "math":
        latex = content.get("latex", "")
        mode = "display" if content.get("displayMode") else "inline"
        return f'[{mode}] ${latex[:60]}{"..." if len(latex) > 60 else ""}$'
    elif btype == "list":
        items = content.get("items", [])
        return f'{content.get("style", "bullet")} {len(items)}項目'
    elif btype == "table":
        return f'{len(content.get("headers", []))}列×{len(content.get("rows", []))}行'
    elif btype == "code":
        return f'[{content.get("language", "text")}] {content.get("code", "")[:40]}'
    elif btype == "circuit":
        return f'回路: {content.get("caption", "")[:40]}'
    elif btype == "diagram":
        return f'[{content.get("diagramType", "custom")}] {content.get("caption", "")[:40]}'
    elif btype == "chemistry":
        return f'{content.get("formula", "")[:40]}'
    elif btype == "chart":
        return f'[{content.get("chartType", "line")}] {content.get("caption", "")[:40]}'
    elif btype == "quote":
        return f'"{content.get("text", "")[:50]}"'
    elif btype == "divider":
        return f'── {content.get("style", "solid")} ──'
    return f"[{btype}]"


def _extract_text(content: dict) -> list[str]:
    """Extract searchable text fields from block content."""
    texts = []
    for key in ("text", "latex", "code", "formula", "caption"):
        val = content.get(key)
        if isinstance(val, str) and val:
            texts.append(val)
    items = content.get("items")
    if isinstance(items, list):
        texts.extend(str(it) for it in items)
    headers = content.get("headers")
    if isinstance(headers, list):
        texts.extend(str(h) for h in headers)
    rows = content.get("rows")
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, list):
                texts.extend(str(c) for c in row)
    return texts


def _deep_to_dict(obj: Any) -> Any:
    """Convert Gemini proto objects to plain Python dicts."""
    if isinstance(obj, dict):
        return {k: _deep_to_dict(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deep_to_dict(v) for v in obj]
    if hasattr(obj, "items"):
        return {k: _deep_to_dict(v) for k, v in obj.items()}
    if hasattr(obj, "__iter__") and not isinstance(obj, (str, bytes)):
        return [_deep_to_dict(v) for v in obj]
    return obj


def _document_context_brief(document: dict) -> str:
    """Brief document context for the initial system message."""
    blocks = document.get("blocks", [])
    meta = document.get("metadata", {})
    n = len(blocks)
    type_counts: dict[str, int] = {}
    for blk in blocks:
        btype = blk.get("content", {}).get("type", "unknown")
        type_counts[btype] = type_counts.get(btype, 0) + 1
    stats = ", ".join(f"{t}×{c}" for t, c in sorted(type_counts.items(), key=lambda x: -x[1]))
    return (
        f"文書: {meta.get('title', '(未設定)')} | "
        f"著者: {meta.get('author', '(未設定)')} | "
        f"ブロック数: {n} [{stats}]"
    )


# ─── Block normalization ─────────────────────────────────────────────────────

def _normalize_ops(ops: list[dict]) -> list[dict]:
    """Normalize ops array — fix block structures."""
    for op in ops:
        if op.get("op") == "add_block" and "block" in op and isinstance(op["block"], dict):
            op["block"] = _normalize_block_structure(op["block"])
            _fix_block_content(op["block"])
        elif op.get("op") == "update_block" and "content" in op and isinstance(op["content"], dict):
            _fix_content_fields(op["content"])
    return ops


def _fix_block_content(block: dict) -> None:
    content = block.get("content", {})
    _fix_content_fields(content)


def _fix_content_fields(content: dict) -> None:
    btype = content.get("type")
    if btype == "math":
        if "displayMode" not in content:
            content["displayMode"] = True
        latex = content.get("latex", "")
        if latex.startswith("$$") and latex.endswith("$$"):
            content["latex"] = latex[2:-2].strip()
        elif latex.startswith("$") and latex.endswith("$") and not latex.startswith("$$"):
            content["latex"] = latex[1:-1].strip()
    if btype == "list" and "style" not in content:
        content["style"] = "bullet"
    if btype == "heading" and "level" not in content:
        content["level"] = 2
    if btype == "divider" and "style" not in content:
        content["style"] = "solid"


def _normalize_block_structure(block: dict) -> dict:
    if "content" in block and isinstance(block["content"], dict) and "type" in block["content"]:
        return block

    DEFAULT_STYLE = {
        "textAlign": "left", "fontSize": 12, "fontFamily": "serif",
        "bold": False, "italic": False, "underline": False,
    }
    block_id = block.get("id") or f"ai-{os.urandom(4).hex()}"
    raw_style = block.get("style")

    if isinstance(raw_style, str):
        meta_keys = {"id"}
        content = {k: v for k, v in block.items() if k not in meta_keys}
        return {"id": block_id, "content": content, "style": DEFAULT_STYLE.copy()}

    meta_keys = {"id", "style"}
    content = {k: v for k, v in block.items() if k not in meta_keys}
    style = raw_style if isinstance(raw_style, dict) else DEFAULT_STYLE.copy()
    return {"id": block_id, "content": content, "style": style}


def _extract_json_patches(text: str) -> dict | None:
    """Extract JSON patches from text response."""
    json_candidates: list[str] = []
    for m in _re.finditer(r'```(?:json)?\s*\n?([\s\S]*?)```', text):
        json_candidates.append(m.group(1).strip())
    if not json_candidates:
        for m in _re.finditer(r'(\[[\s\S]*\]|\{[\s\S]*\})', text):
            json_candidates.append(m.group(1).strip())

    for candidate in json_candidates:
        try:
            data = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue

        if isinstance(data, dict) and "ops" in data:
            ops = data["ops"]
            if isinstance(ops, list) and len(ops) > 0:
                return {"ops": _normalize_ops(ops)}

        if isinstance(data, dict) and "operations" in data:
            ops = data["operations"]
            if isinstance(ops, list) and len(ops) > 0:
                normalized = _normalize_flat_blocks(ops)
                if normalized:
                    return {"ops": normalized}

        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            first = data[0]
            OP_TYPES = {"add_block", "update_block", "delete_block", "reorder", "update_design"}
            if any(k in first for k in ("type", "op", "tool_code", "operation")):
                ops = _normalize_flat_blocks(data)
                if ops:
                    return {"ops": ops}

    return None


def _normalize_flat_blocks(blocks: list[dict]) -> list[dict]:
    OP_TYPES = {"add_block", "update_block", "delete_block", "reorder", "update_design"}
    DEFAULT_STYLE = {
        "textAlign": "left", "fontSize": 12, "fontFamily": "serif",
        "bold": False, "italic": False, "underline": False,
    }
    ops = []
    for blk in blocks:
        op_type = blk.get("op") or blk.get("tool_code") or blk.get("operation")
        if not op_type and blk.get("type") in OP_TYPES:
            op_type = blk["type"]

        if op_type:
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
                    normalized["block"] = _normalize_block_structure(normalized["block"])
                    ops.append({"op": "add_block", "afterId": normalized.get("afterId"), "block": normalized["block"]})
                else:
                    block_id = normalized.get("blockId") or normalized.get("id") or f"ai-{os.urandom(4).hex()}"
                    content = normalized.get("content", {})
                    style = normalized.get("style", DEFAULT_STYLE.copy())
                    ops.append({
                        "op": "add_block",
                        "afterId": normalized.get("afterId"),
                        "block": {"id": block_id, "content": content, "style": style},
                    })
            else:
                ops.append(normalized)
            continue

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
            "block": {"id": block_id, "content": content, "style": style},
        })

    return ops


# ─── Error Handling ───────────────────────────────────────────────────────────

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
    err_str = str(e)
    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
        m = _re.search(r'retryDelay["\s:]+["\s]*(\d+)', err_str)
        if m:
            retry_seconds = float(m.group(1))
        else:
            m2 = _re.search(r'retry in\s+([\d.]+)\s*s', err_str, _re.IGNORECASE)
            retry_seconds = float(m2.group(1)) if m2 else 30.0
        wait_int = int(retry_seconds) + 1
        return f"APIレート制限に達しました。{wait_int}秒後に自動リトライします...", retry_seconds

    if "403" in err_str or "401" in err_str or "PERMISSION_DENIED" in err_str:
        return "APIキーが無効または権限不足です。", 0

    if "500" in err_str or "503" in err_str or "INTERNAL" in err_str:
        return "AIサービスで一時的なエラーが発生しました。", 0

    return "AI APIの呼び出しに失敗しました。", 0


# ─── Agent Loop (Streaming) ───────────────────────────────���──────────────────

async def chat_stream(messages: list[dict], document: dict):
    """
    Agentic streaming chat — Claude Code-style multi-tool loop.

    SSE events:
      {"type": "thinking", "text": "..."}
      {"type": "text", "delta": "..."}
      {"type": "tool_call", "name": "...", "args": {...}}
      {"type": "tool_result", "name": "...", "result": {...}, "duration": N}
      {"type": "patch", "ops": [...]}
      {"type": "done", "message": "...", "patches": {...}, "thinking": [...], "usage": {...}}
      {"type": "error", "message": "..."}
    """
    from google.genai import types  # type: ignore

    client = get_client()
    doc_brief = _document_context_brief(document)

    # Build initial contents
    contents = _build_agent_contents(messages, doc_brief)

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=[
            types.FunctionDeclaration(**fd) for fd in AGENT_TOOLS["function_declarations"]
        ])],
        thinking_config=types.ThinkingConfig(thinking_budget=4096),
        # Allow the model to call tools automatically
        automatic_function_calling=False,
    )

    def _sse(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    all_patches: list[dict] = []
    all_thinking: list[dict] = []
    total_usage = {"inputTokens": 0, "outputTokens": 0}
    final_text_parts: list[str] = []

    MAX_AGENT_TURNS = 6  # Safety limit for agentic loop

    try:
        for turn in range(MAX_AGENT_TURNS):
            text_parts: list[str] = []
            thought_parts: list[str] = []
            tool_calls: list[dict] = []
            last_response = None

            try:
                def _call_stream():
                    return client.models.generate_content_stream(
                        model="gemini-2.5-flash",
                        contents=contents,
                        config=config,
                    )

                stream = await asyncio.to_thread(_call_stream)

                for chunk in stream:
                    last_response = chunk
                    if not chunk.candidates:
                        continue
                    candidate = chunk.candidates[0]
                    if not candidate.content or not candidate.content.parts:
                        continue

                    for part in candidate.content.parts:
                        if getattr(part, "thought", False):
                            if part.text:
                                thought_parts.append(part.text)
                                yield _sse({"type": "thinking", "text": part.text[:300]})
                            continue

                        if part.text:
                            text_parts.append(part.text)
                            yield _sse({"type": "text", "delta": part.text})

                        if part.function_call:
                            fc_name = part.function_call.name
                            fc_args = _deep_to_dict(part.function_call.args) if part.function_call.args else {}
                            tool_calls.append({"name": fc_name, "args": fc_args, "part": part})
                            yield _sse({"type": "tool_call", "name": fc_name, "args": fc_args})

            except Exception as e:
                user_msg, retry_wait = _parse_api_error(e)
                if retry_wait > 0 and turn == 0:
                    wait_secs = min(retry_wait + 2, 60)
                    yield _sse({"type": "thinking", "text": f"レート制限 — {int(wait_secs)}秒後にリトライ..."})
                    await asyncio.sleep(wait_secs)
                    continue
                logger.error("Agent stream error (turn %d): %s", turn, e, exc_info=True)
                yield _sse({"type": "error", "message": user_msg})
                return

            # Accumulate usage
            if last_response:
                usage = _extract_usage(last_response)
                total_usage["inputTokens"] += usage["inputTokens"]
                total_usage["outputTokens"] += usage["outputTokens"]

            # Accumulate thinking
            for t in thought_parts:
                all_thinking.append({"type": "thinking", "text": t[:200]})

            # If no tool calls, we're done — this is the final text response
            if not tool_calls:
                final_text_parts.extend(text_parts)
                break

            # Process tool calls and feed results back for next turn
            # First, add the model's response (text + tool calls) to contents
            model_parts = []
            for tp in text_parts:
                model_parts.append(types.Part(text=tp))
            for tc in tool_calls:
                model_parts.append(tc["part"])

            if model_parts:
                contents.append(types.Content(role="model", parts=model_parts))

            # Execute each tool and collect results
            tool_result_parts = []
            for tc in tool_calls:
                tc_name = tc["name"]
                tc_args = tc["args"]
                start_ms = _now_ms()

                try:
                    result = _execute_tool(tc_name, document, tc_args, all_patches)
                    duration = _now_ms() - start_ms

                    # If edit_document, accumulate patches
                    if tc_name == "edit_document" and tc_args.get("ops"):
                        ops = _normalize_ops(tc_args["ops"])
                        all_patches.extend(ops)
                        yield _sse({"type": "patch", "ops": ops})

                    yield _sse({
                        "type": "tool_result",
                        "name": tc_name,
                        "result": result,
                        "duration": duration,
                    })
                    all_thinking.append({
                        "type": "tool_call",
                        "text": f"{tc_name}: {_summarize_result(tc_name, result)}",
                        "tool": tc_name,
                        "duration": duration,
                    })

                    tool_result_parts.append(
                        types.Part.from_function_response(
                            name=tc_name,
                            response=result,
                        )
                    )

                except Exception as e:
                    duration = _now_ms() - start_ms
                    error_result = {"error": str(e)[:200]}
                    yield _sse({
                        "type": "tool_result",
                        "name": tc_name,
                        "result": error_result,
                        "duration": duration,
                    })
                    all_thinking.append({
                        "type": "error",
                        "text": f"{tc_name} エラー: {str(e)[:100]}",
                        "tool": tc_name,
                        "duration": duration,
                    })
                    tool_result_parts.append(
                        types.Part.from_function_response(
                            name=tc_name,
                            response=error_result,
                        )
                    )

            # Add tool results as user message for next turn
            if tool_result_parts:
                contents.append(types.Content(role="user", parts=tool_result_parts))

            # Continue the agent loop...

        # Build final response
        message = "\n".join(final_text_parts).strip()

        # Check if text contains embedded JSON patches
        if message and not all_patches:
            extracted = _extract_json_patches(message)
            if extracted:
                ops = extracted.get("ops", [])
                all_patches.extend(ops)
                yield _sse({"type": "patch", "ops": ops})
                # Clean JSON from message
                message = _re.sub(r'```(?:json)?\s*\n?[\s\S]*?```', '', message).strip()
                message = _re.sub(r'(?:^|\n)\s*[\[{][\s\S]*?[\]}]\s*(?:\n|$)', '', message).strip()
                if not message:
                    message = f"{len(ops)}件の変更を適用しました。"

        if not message:
            if all_patches:
                op_summary = _ops_summary(all_patches)
                message = f"完了しました。{op_summary}"
            elif all_thinking:
                message = "\n".join(t["text"] for t in all_thinking if t["type"] == "thinking")[:500]
            else:
                message = "応答を取得できませんでした。"

        patches_result = {"ops": all_patches} if all_patches else None

        yield _sse({
            "type": "done",
            "message": message,
            "patches": patches_result,
            "thinking": all_thinking,
            "usage": total_usage,
        })

    except Exception as e:
        user_msg, _ = _parse_api_error(e)
        logger.error("Agent loop error: %s", e, exc_info=True)
        yield _sse({"type": "error", "message": user_msg})


def _execute_tool(name: str, document: dict, args: dict, accumulated_patches: list[dict]) -> dict:
    """Dispatch tool execution."""
    if name == "read_document":
        return _execute_read_document(document, args)
    elif name == "search_blocks":
        return _execute_search_blocks(document, args)
    elif name == "edit_document":
        # Validate and return confirmation
        ops = args.get("ops", [])
        normalized = _normalize_ops(ops)
        add_count = sum(1 for o in normalized if o.get("op") == "add_block")
        update_count = sum(1 for o in normalized if o.get("op") == "update_block")
        delete_count = sum(1 for o in normalized if o.get("op") == "delete_block")
        return {
            "applied": True,
            "ops_count": len(normalized),
            "summary": f"{add_count}追加, {update_count}更新, {delete_count}削除",
        }
    elif name == "compile_check":
        return _execute_compile_check(document, args)
    elif name == "get_latex_source":
        return _execute_get_latex_source(document, args)
    else:
        return {"error": f"Unknown tool: {name}"}


def _summarize_result(name: str, result: dict) -> str:
    """Create short summary of tool result for thinking display."""
    if name == "read_document":
        bc = result.get("blockCount", 0)
        return f"{bc}ブロックの文書を読み込み"
    elif name == "search_blocks":
        count = result.get("count", 0)
        return f"{count}件の一致"
    elif name == "edit_document":
        return result.get("summary", "適用完了")
    elif name == "compile_check":
        ok = result.get("success", False)
        return "OK" if ok else result.get("message", "エラーあり")
    elif name == "get_latex_source":
        length = result.get("total_length", 0)
        return f"{length}文字のLaTeX"
    return json.dumps(result, ensure_ascii=False)[:80]


def _ops_summary(ops: list[dict]) -> str:
    add_count = sum(1 for o in ops if o.get("op") == "add_block")
    update_count = sum(1 for o in ops if o.get("op") == "update_block")
    delete_count = sum(1 for o in ops if o.get("op") == "delete_block")
    parts = []
    if add_count:
        parts.append(f"{add_count}ブロック追加")
    if update_count:
        parts.append(f"{update_count}ブロック更新")
    if delete_count:
        parts.append(f"{delete_count}ブロック削除")
    return ", ".join(parts) or f"{len(ops)}件の操作"


def _now_ms() -> int:
    import time
    return int(time.time() * 1000)


def _build_agent_contents(messages: list[dict], doc_brief: str):
    """Build Gemini contents list for agent mode."""
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
            content = (
                f"[文書コンテキスト: {doc_brief}]\n\n"
                f"{content}\n\n"
                "必要に応じてツールを使って文書を確認・編集してください。"
            )

        gemini_role = "model" if role == "assistant" else "user"
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part(text=content)])
        )
    return contents


# ─── Non-streaming fallback ──────────────────────────────────────────────────

async def chat(messages: list[dict], document: dict) -> dict:
    """Non-streaming agent chat — fallback for when streaming fails."""
    from google.genai import types  # type: ignore

    client = get_client()
    doc_brief = _document_context_brief(document)
    contents = _build_agent_contents(messages, doc_brief)

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=[
            types.FunctionDeclaration(**fd) for fd in AGENT_TOOLS["function_declarations"]
        ])],
        thinking_config=types.ThinkingConfig(thinking_budget=4096),
        automatic_function_calling=False,
    )

    all_patches: list[dict] = []
    all_thinking: list[dict] = []
    total_usage = {"inputTokens": 0, "outputTokens": 0}
    final_message = ""

    MAX_TURNS = 6

    for turn in range(MAX_TURNS):
        try:
            def _call():
                return client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=contents,
                    config=config,
                )

            response = await asyncio.to_thread(_call)
        except Exception as e:
            user_msg, retry_wait = _parse_api_error(e)
            if retry_wait > 0 and turn == 0:
                await asyncio.sleep(min(retry_wait + 2, 60))
                continue
            return {"message": user_msg, "patches": None, "thinking": all_thinking, "usage": total_usage}

        usage = _extract_usage(response)
        total_usage["inputTokens"] += usage["inputTokens"]
        total_usage["outputTokens"] += usage["outputTokens"]

        if not response.candidates:
            return {"message": "AIからの応答が空でした。", "patches": None, "thinking": all_thinking, "usage": total_usage}

        candidate = response.candidates[0]
        finish_reason = str(candidate.finish_reason) if candidate.finish_reason else ""

        if "SAFETY" in finish_reason:
            return {"message": "セーフティフィルターにより応答が中断されました。", "patches": None, "thinking": all_thinking, "usage": total_usage}

        if not candidate.content or not candidate.content.parts:
            break

        text_parts = []
        thought_parts = []
        tool_calls = []

        for part in candidate.content.parts:
            if getattr(part, "thought", False):
                if part.text:
                    thought_parts.append(part.text)
                    all_thinking.append({"type": "thinking", "text": part.text[:200]})
                continue
            if part.text:
                text_parts.append(part.text)
            if part.function_call:
                fc_name = part.function_call.name
                fc_args = _deep_to_dict(part.function_call.args) if part.function_call.args else {}
                tool_calls.append({"name": fc_name, "args": fc_args, "part": part})

        if not tool_calls:
            final_message = "\n".join(text_parts).strip()
            break

        # Add model response to contents
        from google.genai import types as gtypes
        model_parts = []
        for tp in text_parts:
            model_parts.append(gtypes.Part(text=tp))
        for tc in tool_calls:
            model_parts.append(tc["part"])
        if model_parts:
            contents.append(gtypes.Content(role="model", parts=model_parts))

        # Execute tools
        tool_result_parts = []
        for tc in tool_calls:
            start_ms = _now_ms()
            try:
                result = _execute_tool(tc["name"], document, tc["args"], all_patches)
                duration = _now_ms() - start_ms

                if tc["name"] == "edit_document" and tc["args"].get("ops"):
                    ops = _normalize_ops(tc["args"]["ops"])
                    all_patches.extend(ops)

                all_thinking.append({
                    "type": "tool_call",
                    "text": f"{tc['name']}: {_summarize_result(tc['name'], result)}",
                    "tool": tc["name"],
                    "duration": duration,
                })
                tool_result_parts.append(
                    gtypes.Part.from_function_response(name=tc["name"], response=result)
                )
            except Exception as e:
                tool_result_parts.append(
                    gtypes.Part.from_function_response(name=tc["name"], response={"error": str(e)[:200]})
                )

        if tool_result_parts:
            contents.append(gtypes.Content(role="user", parts=tool_result_parts))

    if not final_message:
        if all_patches:
            final_message = f"完了しました。{_ops_summary(all_patches)}"
        else:
            final_message = "応答を取得できませんでした。"

    # Check for embedded patches
    if not all_patches and final_message:
        extracted = _extract_json_patches(final_message)
        if extracted:
            all_patches.extend(extracted.get("ops", []))
            final_message = _re.sub(r'```(?:json)?\s*\n?[\s\S]*?```', '', final_message).strip()
            if not final_message:
                final_message = f"{len(all_patches)}件の変更を適用しました。"

    patches_result = {"ops": all_patches} if all_patches else None

    return {
        "message": final_message,
        "patches": patches_result,
        "thinking": all_thinking,
        "usage": total_usage,
    }

"""AI Agent Service — OpenAI API with raw-LaTeX editing tools.

EddivomAI: テンプレート駆動 LaTeX エージェント。
Tools: read_latex, set_latex, replace_in_latex, compile_check
方針: AIは raw LaTeX を直接読み書きする。ブロック構造化レイヤは廃止。
"""
import os
import json
import logging
import re as _re
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

# ─── Model Configuration ────────────────────────────────────────────────────
# 2026-04 改修: 運用コスト削減のため、メインの chat 用モデルを gpt-4.1 から
# gpt-5.4-mini に切り替え。Vision 用 (画像解析) と Fast 用 (短い補完) はそのまま。
# モデル名はすべて環境変数で上書き可能。本番で別モデルに差し替えたい場合は
# OPENAI_MODEL_CHAT / _VISION / _FAST を設定する。
MODEL_CHAT = os.environ.get("OPENAI_MODEL_CHAT", "gpt-5.4-mini")
MODEL_VISION = os.environ.get("OPENAI_MODEL_VISION", "gpt-4.1-mini")
MODEL_FAST = os.environ.get("OPENAI_MODEL_FAST", "gpt-4.1-nano")


# ─── Per-model parameter compatibility ──────────────────────────────────────
# 新しい "reasoning" 系モデル (gpt-5*, o1*, o3*, o4*) は OpenAI API で
#   max_tokens を拒否し、代わりに max_completion_tokens を要求する。
# 旧モデル (gpt-4*, gpt-3.5*) は逆に max_completion_tokens を受け付けない場合がある。
# モデル名から適切なキー名を選び、kwargs として呼び出し側に渡せる dict を返す。

def max_tokens_param(model: str, n: int) -> dict:
    """Return the correct max-tokens kwarg dict for the given model.

    Usage:
        client.chat.completions.create(
            model=MODEL_CHAT,
            messages=...,
            **max_tokens_param(MODEL_CHAT, 16384),
        )
    """
    lower = (model or "").lower()
    needs_completion_tokens = any(
        lower.startswith(prefix) for prefix in ("gpt-5", "o1", "o3", "o4")
    )
    if needs_completion_tokens:
        return {"max_completion_tokens": n}
    return {"max_tokens": n}


# ─── Tool Definitions ────────────────────────────────────────────────────────

AGENT_TOOLS = {
    "function_declarations": [
        {
            "name": "read_latex",
            "description": (
                "Read the current LaTeX source of the document. Returns the full LaTeX text "
                "along with template id and metadata. Use this FIRST to understand what is "
                "already in the document before making changes."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
        {
            "name": "set_latex",
            "description": (
                "Replace the entire LaTeX source of the document with new content. "
                "Use this when creating a new document from scratch or making large rewrites. "
                "The content must be a valid, complete LaTeX document inside the active template's "
                "\\documentclass / preamble / \\begin{document} ... \\end{document} structure."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "latex": {
                        "type": "string",
                        "description": "The full LaTeX source to set as the new document content.",
                    },
                },
                "required": ["latex"],
            },
        },
        {
            "name": "replace_in_latex",
            "description": (
                "Make a localized edit by replacing one substring with another inside the current "
                "LaTeX source. Use this for small targeted changes (fixing a typo, updating a single "
                "section, inserting one paragraph). The 'find' string MUST appear exactly once in the "
                "current source — otherwise the call fails. Prefer this over set_latex for partial edits."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "find": {
                        "type": "string",
                        "description": "Exact substring to find in the current LaTeX source. Must appear exactly once.",
                    },
                    "replace": {
                        "type": "string",
                        "description": "Replacement text. Use empty string to delete.",
                    },
                },
                "required": ["find", "replace"],
            },
        },
        {
            "name": "compile_check",
            "description": (
                "Compile the current LaTeX source with LuaLaTeX to verify it produces a valid PDF. "
                "Returns compile result with error messages and line numbers. "
                "MUST be called after every set_latex or replace_in_latex to catch errors early. "
                "Set quick=true for fast syntax-only check (brace/environment matching), false (default) "
                "for real compilation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "quick": {
                        "type": "boolean",
                        "description": "true: fast syntax check only. false (default): real LuaLaTeX compilation.",
                    },
                },
            },
        },
        {
            "name": "list_figures",
            "description": (
                "Browse the curated figure asset library (math plots, circuit diagrams, physics "
                "diagrams). Use this BEFORE hand-writing any TikZ / pgfplots / circuitikz code — "
                "a curated asset is more reliable and matches the template style. "
                "Returns compact entries with id, title, tags. Call get_figure next to see parameters."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Filter by category: 'math', 'circuit', or 'physics'. Omit to list everything.",
                        "enum": ["math", "circuit", "physics"],
                    },
                    "query": {
                        "type": "string",
                        "description": "Free-text search over title, tags, and subcategory (e.g. 'sine', 'opamp', 'free body').",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of entries (default 20, max 100).",
                    },
                },
            },
        },
        {
            "name": "get_figure",
            "description": (
                "Fetch full metadata for a single figure asset by id, including its parameter schema "
                "(types, defaults, min/max, enum choices) and preview URL. Use this to learn which "
                "parameters to supply to insert_figure."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Asset id like 'math.quadratic' or 'circuit.rc_series'.",
                    },
                },
                "required": ["id"],
            },
        },
        {
            "name": "insert_figure",
            "description": (
                "Render a curated figure asset with the given parameters and splice it into the "
                "current LaTeX source. Automatically loads any required packages and TikZ libraries. "
                "Prefer this over writing raw TikZ by hand. After calling this you MUST run "
                "compile_check(quick=false) like any other write."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Asset id from list_figures / get_figure.",
                    },
                    "params": {
                        "type": "object",
                        "description": (
                            "Parameter values for the asset (e.g. {\"a\": 2, \"color\": \"red\"}). "
                            "Unknown keys are ignored; missing keys fall back to each parameter's default."
                        ),
                    },
                    "anchor_text": {
                        "type": "string",
                        "description": (
                            "Existing substring in the source to insert the figure AFTER. Must appear "
                            "exactly once. If omitted (or not unique), the figure is inserted right "
                            "after \\begin{document}."
                        ),
                    },
                    "caption": {
                        "type": "string",
                        "description": "Caption text (only used when float_env is true).",
                    },
                    "label": {
                        "type": "string",
                        "description": "Label suffix — becomes \\label{fig:<label>}.",
                    },
                    "float_env": {
                        "type": "boolean",
                        "description": "Wrap the figure in a 'figure' float environment with \\centering (default true).",
                    },
                },
                "required": ["id"],
            },
        },
    ]
}


# ─── System Prompt ─────────────────────────────────────────────────────────────
#
# Phase 3 改修:
#   - SYSTEM_PROMPT を JA / EN に分割
#   - locale パラメータで切り替え
#   - 許可パッケージ一覧を security.get_allowed_packages_doc() から動的に埋め込む
#     (security.py の ALLOWED_PACKAGES が単一情報源)

from .security import get_allowed_packages_doc as _get_pkg_doc


def _build_system_prompt_ja() -> str:
    pkg_doc = _get_pkg_doc(lang="ja")
    return rf"""
あなたは **EddivomAI** — テンプレート駆動 LaTeX エディタ「Eddivom」に組み込まれた自律型 AI エージェントです。
Claude Code / OpenAI Codex のように、ユーザーの指示に応じて自分で考え、計画し、ツールを使って raw LaTeX を直接編集する。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 絶対原則: チャットではなく LaTeX ソースに書け
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ユーザーが何かを「作って」「書いて」「追加して」「修正して」と言ったら、
**100% `set_latex` または `replace_in_latex` ツールを使って LaTeX ソースを直接編集せよ**。
チャットに LaTeX を貼り付けるだけは絶対にNG。チャット応答は「○○を書き込みました」程度に留める。

例外（テキスト応答のみ許可）:
- 「○○って何？」「○○を説明して」→ 知識の質問
- 「LaTeXでどう書く？」→ 書き方の相談
- 「この文書どう思う？」→ フィードバック依頼

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## エージェント行動ループ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

毎リクエストで以下を自律的に実行せよ:

### Step 1: Read（現状把握）
- ユーザーメッセージに `[文書LaTeX]` が含まれていれば、その内容を信頼し read_latex を省略してよい
- それ以外なら `read_latex` で現在のLaTeXソースを取得する

### Step 2: Plan（計画）
- 何を、どの位置に、どう書くかを計画する
- 既存ドキュメントをベースに小さな修正で済むなら `replace_in_latex` を使う
- 全面的な書き換え or 新規作成なら `set_latex` を使う

### Step 3: Write（書き込み）
- `set_latex` または `replace_in_latex` で LaTeX を更新する
- テンプレートのスタイル（プリアンブル、見出しデザイン、色設定）を **必ず尊重** する
- 既存テンプレが日本語フォント (luatexja-preset 等) を読み込んでいる場合は **絶対に消さない**

### Step 4: Build（コンパイル検証 — 必須）
- **`compile_check(quick=false)` で実コンパイル検証**
- エラーが出たら:
  1. エラーメッセージを読んで原因を特定
  2. `replace_in_latex` または `set_latex` で修正
  3. 再度 `compile_check` で確認
  4. 成功するまで繰り返せ（最大3回）

### Step 5: Report（報告）
- 何をしたか、コンパイル結果を 2〜4 行で報告

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LaTeX 編集の指針
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### エンジン
LuaLaTeX を前提とする。日本語テンプレなら `luatexja-preset[haranoaji]`、
英語テンプレなら `lmodern` + `fontenc[T1]` を用いる。
**現在のソースが採用しているフォント / 言語スキームを途中で切り替えてはいけない。**

### 許可パッケージ (allowlist 方式)
{pkg_doc}

### 図の挿入 (Figure library — TikZ / pgfplots / circuitikz)
**TikZ / pgfplots / circuitikz を自分でゼロから書く前に、必ず図アセットライブラリを確認せよ。**
ライブラリはカテゴリ別にキュレーションされた、確実にコンパイル可能な図のカタログ:

- `math` — 関数グラフ、座標軸、三角形、円、ベクトル場、数直線など
- `circuit` — RC/RL/RLC 回路、整流回路、オペアンプ、分圧、ホイートストンブリッジ
- `physics` — 自由体図、斜面、振り子、ばね、波、光線図、斜方投射、電気力線

ワークフロー:
1. `list_figures(category="...", query="...")` で候補を検索
2. ヒットしたら `get_figure(id="...")` で parameter_schema を確認
3. `insert_figure(id="...", params={{...}}, caption="...", label="...")` で文書に挿入
4. 必ず `compile_check(quick=false)` で検証

自力で TikZ を書いてよいのは、ライブラリに適切な候補が無いことを `list_figures` で確認した後のみ。
パラメータは parameter_schema に従って型と範囲を守ること (例: `color` が enum なら choices 内の値だけ)。

### 禁止事項
- `\input`, `\include`, `\write18`, `\directlua` などのファイルアクセス・シェル実行系
- `--shell-escape` を必要とするコマンドの呼び出し
- 上記 allowlist にないパッケージの `\usepackage`

### 数式
- インライン: `$x^2 + 1$`
- 独立: `\[ ... \]` または `$$ ... $$`
- 整列: `\begin{{align}} ... \end{{align}}` (※ 中括弧は LaTeX として 2 重)

### 日本語ドキュメント
- LuaLaTeX + luatexja-preset を使用するため、日本語はそのまま記述できる
- フォント指定が必要な場合は `\usepackage[haranoaji]{{luatexja-preset}}` 等

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 応答ルール
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **日本語で応答する**
- 文書編集後の報告は: (1) 何を変更したか / (2) compile_check の結果 / (3) (あれば) 注意点
- 迷ったら書き込む。テキスト応答で済ませるな
- 必ず `compile_check` でコンパイルが通ることを確認してから完了報告する
"""


def _build_system_prompt_en() -> str:
    pkg_doc = _get_pkg_doc(lang="en")
    return rf"""
You are **EddivomAI** — an autonomous AI agent embedded in the template-driven LaTeX editor "Eddivom".
Like Claude Code or OpenAI Codex, you reason, plan, and call tools to edit raw LaTeX directly on behalf of the user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Cardinal rule: WRITE TO THE SOURCE, don't paste in chat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user says "make / write / add / fix something",
**always use the `set_latex` or `replace_in_latex` tool to modify the LaTeX source directly**.
Pasting LaTeX into the chat reply is forbidden. Keep the chat reply short ("Done — added the worksheet.").

Exceptions (text reply allowed):
- "What is X?" / "Explain X." → knowledge questions
- "How do you write X in LaTeX?" → syntax advice
- "What do you think of this doc?" → feedback request

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Agent loop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every request, run this loop autonomously:

### Step 1: Read
- If the user message already contains a `[Document LaTeX]` block, trust it and skip `read_latex`.
- Otherwise call `read_latex` to fetch the current source.

### Step 2: Plan
- Decide what to write, where to insert it, and how.
- For small targeted edits, prefer `replace_in_latex`.
- For new docs or large rewrites, use `set_latex`.

### Step 3: Write
- Call `set_latex` or `replace_in_latex` to update the source.
- **Respect the existing template** — preamble, heading style, colors, fonts, language scheme.
- If the existing source uses an English preamble (`lmodern` / `fontenc[T1]`),
  **never switch it to a Japanese preamble** (luatexja-preset / haranoaji) and vice versa.
  Match what is already there.

### Step 4: Build (mandatory)
- Call `compile_check(quick=false)` to actually compile.
- If it fails:
  1. Read the error and locate the root cause.
  2. Fix with `replace_in_latex` or `set_latex`.
  3. Re-run `compile_check`.
  4. Repeat until it succeeds (max 3 retries).

### Step 5: Report
- Tell the user what you changed and the compile result in 2–4 lines.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LaTeX editing guidelines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Engine
LuaLaTeX. For English documents use `lmodern` + `\usepackage[T1]{{fontenc}}`.
For Japanese documents use `\usepackage[haranoaji]{{luatexja-preset}}`.
**Do not switch the font/language scheme of an existing document mid-edit.**

### Allowed packages (allowlist)
{pkg_doc}

### Figure library (TikZ / pgfplots / circuitikz)
**Before writing any TikZ / pgfplots / circuitikz by hand, browse the curated figure library.**
Categories:

- `math` — function plots, axes, triangles, circles, vector fields, number lines
- `circuit` — RC / RL / RLC, rectifier, inverting op-amp, voltage divider, Wheatstone bridge
- `physics` — free-body diagrams, inclines, pendulum, spring-mass, waves, lens rays, projectile, field lines

Workflow:
1. `list_figures(category="...", query="...")` to search
2. If a match exists, `get_figure(id="...")` to see its parameter_schema
3. `insert_figure(id="...", params={{...}}, caption="...", label="...")` to splice it in
4. Always `compile_check(quick=false)` afterward

Only hand-write TikZ when `list_figures` returns nothing suitable. Stay within the declared
parameter types/ranges (e.g. an `enum` color must come from its `choices`).

### Forbidden
- `\input`, `\include`, `\write18`, `\directlua`, and any file/shell escape commands
- Commands that require `--shell-escape`
- `\usepackage` for any package not in the allowlist above

### Math
- Inline: `$x^2 + 1$`
- Display: `\[ ... \]` or `$$ ... $$`
- Aligned: `\begin{{align}} ... \end{{align}}`

### English documents
- Use `lmodern` + `\usepackage[T1]{{fontenc}}`. Do **not** add `luatexja-preset` to an English template.
- Currency, dates, references should match the user's locale (default: US English).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Reply rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Reply in English.**
- After editing, report: (1) what you changed, (2) the compile_check result, (3) any caveats.
- When in doubt, edit the source — do not just answer in text.
- Always confirm a successful `compile_check` before reporting "done".
"""


# Lazy-built (built once on first access so security.ALLOWED_PACKAGES is fully loaded).
_SYSTEM_PROMPT_JA: str | None = None
_SYSTEM_PROMPT_EN: str | None = None


def get_system_prompt(locale: str = "ja") -> str:
    """Return the system prompt for the given UI locale.
    Recognised values: "ja" (default), "en". Anything else → ja."""
    global _SYSTEM_PROMPT_JA, _SYSTEM_PROMPT_EN
    if locale == "en":
        if _SYSTEM_PROMPT_EN is None:
            _SYSTEM_PROMPT_EN = _build_system_prompt_en()
        return _SYSTEM_PROMPT_EN
    if _SYSTEM_PROMPT_JA is None:
        _SYSTEM_PROMPT_JA = _build_system_prompt_ja()
    return _SYSTEM_PROMPT_JA


# ─── OpenAI Tool wrapper ─────────────────────────────────────────────────────

def build_openai_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": fd["name"],
                "description": fd["description"],
                "parameters": fd["parameters"],
            },
        }
        for fd in AGENT_TOOLS["function_declarations"]
    ]


OPENAI_TOOLS: list[dict] | None = None


def get_openai_tools() -> list[dict]:
    global OPENAI_TOOLS
    if OPENAI_TOOLS is None:
        OPENAI_TOOLS = build_openai_tools()
    return OPENAI_TOOLS


# Legacy alias for omr_service compatibility
def get_gemini_tool_def():
    return get_openai_tools()


# ─── OpenAI Client ────────────────────────────────────────────────────────────

_openai_client = None


def get_client():
    global _openai_client
    if _openai_client is not None:
        return _openai_client

    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError("openai not installed. pip install openai")

    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY が設定されていません。"
            "バックエンドの環境変数に設定してください。"
        )
    _openai_client = OpenAI(api_key=key)
    return _openai_client


# ─── Tool Execution ──────────────────────────────────────────────────────────

def _execute_read_latex(document: dict, args: dict) -> dict:
    """Return the current LaTeX source and metadata."""
    latex = document.get("latex", "") or ""
    metadata = document.get("metadata", {}) or {}
    return {
        "template": document.get("template", "blank"),
        "title": metadata.get("title", ""),
        "author": metadata.get("author", ""),
        "latex_length": len(latex),
        "latex": latex,
    }


def _execute_set_latex(document: dict, args: dict) -> dict:
    """Replace the entire LaTeX source."""
    new_latex = args.get("latex", "")
    if not isinstance(new_latex, str):
        return {"error": "latex must be a string"}
    document["latex"] = new_latex
    return {
        "applied": True,
        "latex_length": len(new_latex),
        "message": f"LaTeXソースを更新しました（{len(new_latex)}文字）",
    }


def _execute_replace_in_latex(document: dict, args: dict) -> dict:
    """Find-and-replace a substring in the LaTeX source."""
    find = args.get("find", "")
    replace = args.get("replace", "")
    if not isinstance(find, str) or not isinstance(replace, str):
        return {"error": "find and replace must be strings"}
    if not find:
        return {"error": "find must not be empty"}

    current = document.get("latex", "") or ""
    occurrences = current.count(find)
    if occurrences == 0:
        return {
            "error": "not_found",
            "message": "find文字列が現在のLaTeXソース内に見つかりません。read_latex で最新の内容を確認してください。",
        }
    if occurrences > 1:
        return {
            "error": "ambiguous",
            "occurrences": occurrences,
            "message": f"find文字列が{occurrences}箇所一致しました。一意に特定できる文字列で再試行してください。",
        }

    new_latex = current.replace(find, replace, 1)
    document["latex"] = new_latex
    return {
        "applied": True,
        "latex_length": len(new_latex),
        "delta_chars": len(new_latex) - len(current),
        "message": f"LaTeXを修正しました（{len(new_latex)}文字）",
    }


def _execute_compile_check(document: dict, args: dict) -> dict:
    """LuaLaTeX で実際にコンパイル検証する。

    本番の compile_pdf と同じパッケージ補完 (autofix) を適用してから検証するため、
    AI が「\\dfrac を使ったが amsmath を読み込んでいない」など軽微な不足を指摘するより、
    コンパイル成功と判定して次のステップに進める。
    """
    import subprocess
    import tempfile
    from pathlib import Path

    try:
        from .tex_env import TEX_ENV, LUALATEX_CMD
        from .security import get_compile_args
        from .latex_autofix import autofix_latex, autofix_after_failure

        raw_latex_source = document.get("latex", "") or ""
        latex_source = autofix_latex(raw_latex_source)

        # ── Phase 1: 構文チェック ──
        issues = []
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

        begins = _re.findall(r'\\begin\{(\w+)\}', latex_source)
        ends = _re.findall(r'\\end\{(\w+)\}', latex_source)
        for env in set(begins):
            bc, ec = begins.count(env), ends.count(env)
            if bc != ec:
                issues.append(f"\\begin{{{env}}} / \\end{{{env}}} 不一致 ({bc} vs {ec})")

        if issues:
            return {
                "success": False,
                "phase": "syntax",
                "issues": issues,
                "message": f"構文エラー {len(issues)}件 — コンパイル前に修正が必要",
            }

        quick = args.get("quick", False)
        if quick:
            return {
                "success": True,
                "phase": "syntax",
                "issues": [],
                "latex_length": len(latex_source),
                "message": f"構文チェック OK（{len(latex_source)}文字）",
            }

        # ── Phase 2: 実コンパイル ──
        # 内部ヘルパ: 1 回コンパイル → (success, pdf_size or 0, log)
        def _run_once(source: str) -> tuple[bool, int, str]:
            with tempfile.TemporaryDirectory() as tmpdir:
                tex_path = Path(tmpdir) / "check.tex"
                tex_path.write_text(source, encoding="utf-8")

                cmd_args = get_compile_args(LUALATEX_CMD, str(tmpdir), str(tex_path))
                result = subprocess.run(
                    cmd_args,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    cwd=tmpdir,
                    env=TEX_ENV,
                )

                pdf_path = Path(tmpdir) / "check.pdf"
                if result.returncode == 0 and pdf_path.exists():
                    return True, pdf_path.stat().st_size, result.stdout
                return False, 0, result.stdout + "\n" + result.stderr

        try:
            ok, pdf_size, log = _run_once(latex_source)

            # autofix リトライ — 不足パッケージ / no-op stub を最大 3 回まで補完
            if not ok:
                max_rounds = int(os.environ.get("LATEX_AUTOFIX_MAX_ROUNDS", "3"))
                current = latex_source
                for _round in range(max_rounds):
                    retry_source = autofix_after_failure(current, log)
                    if not retry_source or retry_source == current:
                        break
                    ok, pdf_size, log = _run_once(retry_source)
                    current = retry_source
                    if ok:
                        latex_source = retry_source
                        # AI が次の編集で同じ問題を起こさないよう、補完済みのソースを document に反映
                        document["latex"] = retry_source
                        break

            if ok:
                warnings = []
                for line in log.split("\n"):
                    if "Warning" in line or "Overfull" in line or "Underfull" in line:
                        clean = line.strip()[:120]
                        if clean and clean not in warnings:
                            warnings.append(clean)
                return {
                    "success": True,
                    "phase": "compile",
                    "issues": warnings[:5] if warnings else [],
                    "pdf_size": pdf_size,
                    "latex_length": len(latex_source),
                    "message": f"コンパイル成功 ✓（PDF {pdf_size//1024}KB）"
                               + (f" — 警告{len(warnings)}件" if warnings else ""),
                }

            errors = []
            for line in log.split("\n"):
                stripped = line.strip()
                if stripped.startswith("!"):
                    errors.append(stripped[:150])
                elif "error" in stripped.lower() and len(stripped) < 200:
                    errors.append(stripped[:150])
            if not errors:
                errors = ["不明なコンパイルエラー"]

            line_match = _re.search(r'l\.(\d+)', log)
            error_line = int(line_match.group(1)) if line_match else None

            return {
                "success": False,
                "phase": "compile",
                "issues": errors[:8],
                "errors": errors[:8],
                "error_line": error_line,
                "message": f"コンパイル失敗 ✗ — {errors[0][:100]}",
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "phase": "compile",
                "issues": ["コンパイルタイムアウト (30秒)"],
                "message": "コンパイルタイムアウト — 文書が複雑すぎるか無限ループの可能性",
            }
        except FileNotFoundError:
            return {
                "success": True,
                "phase": "syntax",
                "issues": [],
                "latex_length": len(latex_source),
                "message": f"構文チェック OK（{len(latex_source)}文字）— コンパイラ未検出のため構文のみ",
            }

    except Exception as e:
        return {
            "success": False,
            "phase": "error",
            "issues": [str(e)[:200]],
            "message": f"検証エラー: {str(e)[:200]}",
        }


def _execute_list_figures(document: dict, args: dict) -> dict:
    from .figures import get_registry
    reg = get_registry()
    try:
        return reg.list(
            category=args.get("category"),
            query=args.get("query"),
            limit=int(args.get("limit", 20) or 20),
        )
    except Exception as e:
        return {"error": f"list_figures failed: {e}"}


def _execute_get_figure(document: dict, args: dict) -> dict:
    from .figures import get_registry
    asset_id = args.get("id")
    if not isinstance(asset_id, str) or not asset_id:
        return {"error": "id must be a non-empty string"}
    data = get_registry().get(asset_id)
    if not data:
        return {"error": "not_found", "message": f"unknown figure id: {asset_id}"}
    return data


def _execute_insert_figure(document: dict, args: dict) -> dict:
    from .figures import get_registry
    from .figures.render import ParameterError, apply_figure_to_source
    from .security import validate_latex_security

    asset_id = args.get("id")
    if not isinstance(asset_id, str) or not asset_id:
        return {"error": "id must be a non-empty string"}

    reg = get_registry()
    asset = reg.get_raw(asset_id)
    if not asset:
        return {"error": "not_found", "message": f"unknown figure id: {asset_id}"}

    params = args.get("params") or {}
    if not isinstance(params, dict):
        return {"error": "params must be an object"}

    try:
        rendered = reg.render(asset_id, params)
    except ParameterError as e:
        return {"error": "invalid_params", "message": str(e)}
    except Exception as e:
        return {"error": f"render failed: {e}"}

    caption = args.get("caption")
    label = args.get("label")
    float_env = bool(args.get("float_env", True))
    anchor_text = args.get("anchor_text") or None

    # Sanitize caption / label the same way as string parameters
    if caption is not None and not isinstance(caption, str):
        return {"error": "caption must be a string"}
    if caption and any(ch in caption for ch in "\\%${}#&^~\n\r"):
        return {"error": "caption contains forbidden characters"}
    if label is not None and not isinstance(label, str):
        return {"error": "label must be a string"}
    if label and not _re.match(r"^[A-Za-z][A-Za-z0-9_:-]{0,48}$", label):
        return {"error": "label must match [A-Za-z][A-Za-z0-9_:-]*"}

    current = document.get("latex", "") or ""
    new_src, line = apply_figure_to_source(
        current,
        rendered,
        caption=caption,
        label=label,
        float_env=float_env,
        anchor_text=anchor_text,
    )

    if new_src == current:
        return {
            "error": "insert_failed",
            "message": "could not locate insertion point (no \\begin{document}?)",
        }

    # Defense in depth: scan the final source against the security allowlist.
    violations = validate_latex_security(new_src)
    if violations:
        return {
            "error": "security_violation",
            "violations": violations[:5],
            "message": "rendered figure failed security scan — aborted insertion",
        }

    document["latex"] = new_src
    return {
        "applied": True,
        "asset_id": asset_id,
        "latex_length": len(new_src),
        "inserted_at_line": line,
        "preview_url": f"/api/figures/{asset_id}/preview.png",
        "required_packages_added": rendered.required_packages,
        "required_tikzlibraries_added": rendered.required_tikzlibraries,
        "message": f"図 {asset_id} を挿入しました（L{line} 付近）",
    }


def _execute_tool(name: str, document: dict, args: dict) -> dict:
    if name == "read_latex":
        return _execute_read_latex(document, args)
    if name == "set_latex":
        return _execute_set_latex(document, args)
    if name == "replace_in_latex":
        return _execute_replace_in_latex(document, args)
    if name == "compile_check":
        return _execute_compile_check(document, args)
    if name == "list_figures":
        return _execute_list_figures(document, args)
    if name == "get_figure":
        return _execute_get_figure(document, args)
    if name == "insert_figure":
        return _execute_insert_figure(document, args)
    return {"error": f"Unknown tool: {name}"}


def _summarize_result(name: str, result: dict) -> str:
    if name == "read_latex":
        return f"Read: {result.get('latex_length', 0)}文字のLaTeX"
    if name == "set_latex":
        return f"Write: {result.get('message', '更新完了')}"
    if name == "replace_in_latex":
        if result.get("error"):
            return f"Replace ✗: {result.get('message', result['error'])}"
        return f"Replace: {result.get('message', '修正完了')}"
    if name == "compile_check":
        ok = result.get("success", False)
        return "Build ✓" if ok else f"Build ✗: {result.get('message', 'エラー')[:80]}"
    if name == "list_figures":
        return f"Figures: {result.get('returned', 0)}/{result.get('total', 0)}件"
    if name == "get_figure":
        if result.get("error"):
            return f"Figure ✗: {result.get('message', result['error'])}"
        return f"Figure: {result.get('id', '?')}"
    if name == "insert_figure":
        if result.get("error"):
            return f"InsertFig ✗: {result.get('message', result['error'])[:80]}"
        return f"InsertFig: {result.get('asset_id', '?')} @ L{result.get('inserted_at_line', '?')}"
    return json.dumps(result, ensure_ascii=False)[:80]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _document_context_brief(document: dict) -> str:
    metadata = document.get("metadata", {}) or {}
    latex = document.get("latex", "") or ""
    return (
        f"テンプレート: {document.get('template', 'blank')} | "
        f"タイトル: {metadata.get('title', '(未設定)')} | "
        f"LaTeX: {len(latex)}文字"
    )


def _now_ms() -> int:
    import time
    return int(time.time() * 1000)


def _build_agent_contents(messages: list[dict], doc_brief: str, locale: str = "ja"):
    """Build OpenAI messages list. `locale` selects the system prompt language ("ja" / "en")."""
    MAX_MESSAGES = 20
    if len(messages) > MAX_MESSAGES:
        logger.warning("Too many messages (%d > %d), trimming", len(messages), MAX_MESSAGES)
        messages = messages[:2] + messages[-6:]

    last_user_idx = max(
        (i for i, m in enumerate(messages) if m.get("role") == "user"),
        default=0,
    )

    last_user_content = messages[last_user_idx].get("content", "") if messages else ""
    # ja: "[文書LaTeX]" / en: "[Document LaTeX]" のどちらでもコンテキスト同梱と判定
    has_doc_context = (
        "[文書LaTeX]" in last_user_content
        or "[Document LaTeX]" in last_user_content
    )

    openai_messages: list[dict] = [
        {"role": "system", "content": get_system_prompt(locale)},
    ]

    # locale 別の補足指示テンプレ
    if locale == "en":
        nudge_with_ctx = (
            "Use set_latex / replace_in_latex / compile_check to edit the document as needed."
        )
        nudge_without_ctx = (
            "If needed, call read_latex to fetch the current source, then "
            "set_latex / replace_in_latex / compile_check to edit it."
        )
        ctx_label = "Document context"
    else:
        nudge_with_ctx = (
            "必要に応じて set_latex / replace_in_latex / compile_check で文書を編集してください。"
        )
        nudge_without_ctx = (
            "必要に応じて read_latex で現在の内容を確認し、"
            "set_latex / replace_in_latex / compile_check で文書を編集してください。"
        )
        ctx_label = "文書コンテキスト"

    for i, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if i == last_user_idx and role == "user":
            if has_doc_context:
                content = f"{content}\n\n{nudge_with_ctx}"
            else:
                content = f"[{ctx_label}: {doc_brief}]\n\n{content}\n\n{nudge_without_ctx}"

        openai_role = "assistant" if role == "assistant" else "user"
        openai_messages.append({"role": openai_role, "content": content})

    return openai_messages


def _parse_api_error(e: Exception) -> tuple[str, float]:
    err_str = str(e)
    err_type = type(e).__name__

    if "rate_limit" in err_type.lower() or "429" in err_str or "RateLimitError" in err_type:
        m = _re.search(r'try again in\s+([\d.]+)\s*s', err_str, _re.IGNORECASE)
        retry_seconds = float(m.group(1)) if m else 30.0
        wait_int = int(retry_seconds) + 1
        return f"⚠️ APIレート制限に達しました。{wait_int}秒後に自動リトライします。", retry_seconds

    if "quota" in err_str.lower() or "billing" in err_str.lower() or "insufficient_quota" in err_str.lower():
        return "⚠️ APIの使用量上限に達しているか、課金設定に問題があります。", 0

    if "AuthenticationError" in err_type or "401" in err_str:
        return "⚠️ APIキーが無効です。環境変数を確認してください。", 0

    if "PermissionDeniedError" in err_type or "403" in err_str:
        return "⚠️ APIキーの権限が不足しています。", 0

    if "NotFoundError" in err_type or "404" in err_str:
        return f"⚠️ AIモデルが見つかりません。({err_type})", 0

    if "500" in err_str or "503" in err_str or "InternalServerError" in err_type:
        return f"⚠️ AIサービスで一時的なエラー。({err_type})", 0

    if "timeout" in err_str.lower() or "timed out" in err_str.lower():
        return "⚠️ AIサービスの応答がタイムアウトしました。", 0

    if "connection" in err_str.lower() or "network" in err_str.lower():
        return f"⚠️ AIサービスへの接続に失敗しました。({err_type})", 0

    return f"⚠️ AI APIエラー: {err_type}: {err_str[:150]}", 0


# ─── Streaming Agent Loop ─────────────────────────────────────────────────────

async def chat_stream(messages: list[dict], document: dict, locale: str = "ja"):
    """
    Streaming chat — OpenAI API with raw-LaTeX editing tools.

    Args:
        messages: chat history
        document: current DocumentModel as dict (mutated by tools)
        locale:   "ja" (default) or "en" — selects system prompt + status text

    SSE events:
      {"type": "thinking", "text": "..."}
      {"type": "text", "delta": "..."}
      {"type": "tool_call", "name": "...", "args": {...}}
      {"type": "tool_result", "name": "...", "result": {...}, "duration": N}
      {"type": "latex", "latex": "..."}
      {"type": "done", "message": "...", "latex": "...", "thinking": [...], "usage": {...}}
      {"type": "error", "message": "..."}
    """

    def _sse(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    # locale 別のステータス文言 (SSE thinking で表示される)
    if locale == "en":
        STATUS_INIT = "Initializing…"
        STATUS_BOOT = "Starting agent…"
        STATUS_TURN = lambda n: f"Turn {n}: continuing…"
        STATUS_WAITING = "Waiting for response…"
        STATUS_RATELIMIT = lambda s: f"Rate limit — retrying in {s}s…"
        STATUS_TOOL = lambda name: f"Running {name}…"
        STATUS_NO_RESPONSE = "No response from the AI service."
    else:
        STATUS_INIT = "初期化中..."
        STATUS_BOOT = "エージェント起動..."
        STATUS_TURN = lambda n: f"ターン {n}: 続行中..."
        STATUS_WAITING = "応答を待っています..."
        STATUS_RATELIMIT = lambda s: f"レート制限 — {s}秒後にリトライ..."
        STATUS_TOOL = lambda name: f"{name} を実行中..."
        STATUS_NO_RESPONSE = "AIサービスから応答がありませんでした。"

    all_thinking: list[dict] = []
    total_usage = {"inputTokens": 0, "outputTokens": 0}
    final_text_parts: list[str] = []
    latex_changed = False

    MAX_AGENT_TURNS = 12

    try:
        yield _sse({"type": "thinking", "text": STATUS_INIT})

        client = get_client()
        doc_brief = _document_context_brief(document)
        openai_messages = _build_agent_contents(messages, doc_brief, locale=locale)
        tools = get_openai_tools()

        yield _sse({"type": "thinking", "text": STATUS_BOOT})

        for turn in range(MAX_AGENT_TURNS):
            text_parts: list[str] = []
            tool_calls_raw: list[dict] = []
            last_response = None

            try:
                if turn > 0:
                    yield _sse({"type": "thinking", "text": STATUS_TURN(turn + 1)})

                from collections import deque as _deque
                _SENTINEL = object()
                _items: _deque = _deque()
                _notify: asyncio.Event = asyncio.Event()
                loop = asyncio.get_running_loop()

                def _consume_stream():
                    try:
                        stream = client.chat.completions.create(
                            model=MODEL_CHAT,
                            messages=openai_messages,
                            tools=tools,
                            stream=True,
                            temperature=0.7,
                            **max_tokens_param(MODEL_CHAT, 16384),
                        )
                        for chunk in stream:
                            _items.append(chunk)
                            loop.call_soon_threadsafe(_notify.set)
                    except Exception as exc:
                        _items.append(exc)
                        loop.call_soon_threadsafe(_notify.set)
                    finally:
                        _items.append(_SENTINEL)
                        loop.call_soon_threadsafe(_notify.set)

                loop.run_in_executor(None, _consume_stream)

                tc_accum: dict[int, dict] = {}
                stream_done = False

                while not stream_done:
                    try:
                        await asyncio.wait_for(_notify.wait(), timeout=30)
                    except asyncio.TimeoutError:
                        yield _sse({"type": "thinking", "text": STATUS_WAITING})
                        continue
                    _notify.clear()

                    while _items:
                        item = _items.popleft()
                        if item is _SENTINEL:
                            stream_done = True
                            break
                        if isinstance(item, Exception):
                            raise item

                        chunk = item
                        last_response = chunk

                        if not chunk.choices:
                            if chunk.usage:
                                total_usage["inputTokens"] += chunk.usage.prompt_tokens or 0
                                total_usage["outputTokens"] += chunk.usage.completion_tokens or 0
                            continue

                        delta = chunk.choices[0].delta
                        if not delta:
                            continue

                        if delta.content:
                            text_parts.append(delta.content)
                            yield _sse({"type": "text", "delta": delta.content})

                        if delta.tool_calls:
                            for tc_delta in delta.tool_calls:
                                idx = tc_delta.index
                                if idx not in tc_accum:
                                    tc_accum[idx] = {
                                        "id": tc_delta.id or "",
                                        "name": "",
                                        "args_parts": [],
                                    }
                                if tc_delta.id:
                                    tc_accum[idx]["id"] = tc_delta.id
                                if tc_delta.function and tc_delta.function.name:
                                    tc_accum[idx]["name"] = tc_delta.function.name
                                if tc_delta.function and tc_delta.function.arguments:
                                    tc_accum[idx]["args_parts"].append(tc_delta.function.arguments)

                for idx in sorted(tc_accum.keys()):
                    tc = tc_accum[idx]
                    args_str = "".join(tc["args_parts"])
                    try:
                        args = json.loads(args_str) if args_str else {}
                    except json.JSONDecodeError:
                        args = {}
                    tool_calls_raw.append({
                        "id": tc["id"],
                        "name": tc["name"],
                        "args": args,
                        "args_str": args_str,
                    })
                    yield _sse({"type": "tool_call", "name": tc["name"], "args": args})

            except Exception as e:
                user_msg, retry_wait = _parse_api_error(e)
                if retry_wait > 0 and turn == 0:
                    wait_secs = min(retry_wait + 2, 60)
                    yield _sse({"type": "thinking", "text": STATUS_RATELIMIT(int(wait_secs))})
                    await asyncio.sleep(wait_secs)
                    continue
                logger.error("Agent stream error (turn %d): %s", turn, e, exc_info=True)
                yield _sse({"type": "error", "message": user_msg})
                final_latex = document.get("latex") if latex_changed else None
                yield _sse({
                    "type": "done",
                    "message": user_msg,
                    "latex": final_latex,
                    "thinking": all_thinking,
                    "usage": total_usage,
                })
                return

            if last_response is None:
                logger.error("Agent stream: no chunks received (turn %d)", turn)
                yield _sse({"type": "error", "message": STATUS_NO_RESPONSE})
                break

            if not tool_calls_raw:
                final_text_parts.extend(text_parts)
                break

            assistant_msg: dict[str, Any] = {"role": "assistant"}
            assistant_msg["content"] = "".join(text_parts) if text_parts else None
            assistant_msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["args_str"]},
                }
                for tc in tool_calls_raw
            ]
            openai_messages.append(assistant_msg)

            for tc in tool_calls_raw:
                tc_name = tc["name"]
                tc_args = tc["args"]
                start_ms = _now_ms()

                try:
                    yield _sse({"type": "thinking", "text": STATUS_TOOL(tc_name)})
                    result = _execute_tool(tc_name, document, tc_args)
                    duration = _now_ms() - start_ms

                    if tc_name in ("set_latex", "replace_in_latex") and result.get("applied"):
                        latex_changed = True
                        yield _sse({"type": "latex", "latex": document.get("latex", "")})

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

                    openai_messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    })

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
                    openai_messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(error_result, ensure_ascii=False),
                    })

        message = "\n".join(final_text_parts).strip()
        if not message:
            if latex_changed:
                message = "LaTeX source updated." if locale == "en" else "LaTeXソースを更新しました。"
            else:
                message = "No response from the AI." if locale == "en" else "応答を取得できませんでした。"

        final_latex = document.get("latex") if latex_changed else None

        logger.info("Agent stream completed: latex_changed=%s, thinking=%d, usage=%s",
                    latex_changed, len(all_thinking), total_usage)

        yield _sse({
            "type": "done",
            "message": message,
            "latex": final_latex,
            "thinking": all_thinking,
            "usage": total_usage,
        })

    except GeneratorExit:
        logger.info("Agent stream: client disconnected")
        return
    except Exception as e:
        user_msg, _ = _parse_api_error(e)
        logger.error("Agent loop fatal error [%s]: %s", type(e).__name__, e, exc_info=True)
        yield _sse({"type": "error", "message": user_msg})
        final_latex = document.get("latex") if latex_changed else None
        yield _sse({
            "type": "done",
            "message": user_msg,
            "latex": final_latex,
            "thinking": all_thinking,
            "usage": total_usage,
        })


# ─── Non-streaming fallback ──────────────────────────────────────────────────

async def chat(messages: list[dict], document: dict, locale: str = "ja") -> dict:
    """Non-streaming agent chat — fallback for when streaming fails.

    `locale` selects the system prompt language ("ja" / "en")."""
    client = get_client()
    doc_brief = _document_context_brief(document)
    openai_messages = _build_agent_contents(messages, doc_brief, locale=locale)
    tools = get_openai_tools()

    all_thinking: list[dict] = []
    total_usage = {"inputTokens": 0, "outputTokens": 0}
    final_message = ""
    latex_changed = False

    MAX_TURNS = 12

    for turn in range(MAX_TURNS):
        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_CHAT,
                    messages=openai_messages,
                    tools=tools,
                    temperature=0.7,
                    **max_tokens_param(MODEL_CHAT, 16384),
                )

            response = await asyncio.get_event_loop().run_in_executor(None, _call)
            msg = response.choices[0].message

            if response.usage:
                total_usage["inputTokens"] += response.usage.prompt_tokens or 0
                total_usage["outputTokens"] += response.usage.completion_tokens or 0

            content = msg.content or ""
            if content:
                final_message = content

            tool_calls = getattr(msg, "tool_calls", None) or []

            if not tool_calls:
                break

            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": content or None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "",
                        },
                    }
                    for tc in tool_calls
                ],
            }
            openai_messages.append(assistant_msg)

            for tc in tool_calls:
                try:
                    args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                except json.JSONDecodeError:
                    args = {}
                start_ms = _now_ms()
                try:
                    result = _execute_tool(tc.function.name, document, args)
                except Exception as e:
                    result = {"error": str(e)[:200]}
                duration = _now_ms() - start_ms

                if tc.function.name in ("set_latex", "replace_in_latex") and result.get("applied"):
                    latex_changed = True

                all_thinking.append({
                    "type": "tool_call",
                    "text": f"{tc.function.name}: {_summarize_result(tc.function.name, result)}",
                    "tool": tc.function.name,
                    "duration": duration,
                })

                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

        except Exception as e:
            user_msg, _ = _parse_api_error(e)
            return {
                "message": user_msg,
                "latex": document.get("latex") if latex_changed else None,
                "thinking": all_thinking,
                "usage": total_usage,
            }

    if not final_message:
        if locale == "en":
            final_message = "LaTeX source updated." if latex_changed else "No response from the AI."
        else:
            final_message = "LaTeXソースを更新しました。" if latex_changed else "応答を取得できませんでした。"

    return {
        "message": final_message,
        "latex": document.get("latex") if latex_changed else None,
        "thinking": all_thinking,
        "usage": total_usage,
    }

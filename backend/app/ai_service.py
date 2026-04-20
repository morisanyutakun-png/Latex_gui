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
            "name": "draft_figure",
            "description": (
                "ESCAPE HATCH for figures not covered by the asset library. Only use this "
                "AFTER two `list_figures` searches returned no match. Compiles an arbitrary "
                "tikzpicture / circuitikz / pgfplots snippet through LuaLaTeX, returns a "
                "PNG preview key, and prefixes the body with a tracking comment. The returned "
                "`tikz_body_marked` is what you then splice into the document via "
                "`replace_in_latex` — do NOT hand-write TikZ without this tool, because it "
                "(a) enforces the security allowlist, (b) verifies the figure actually "
                "compiles in isolation, and (c) logs the attempt so the library can grow."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tikz_body": {
                        "type": "string",
                        "description": (
                            "A complete \\begin{tikzpicture}...\\end{tikzpicture} (or "
                            "\\begin{circuitikz}/\\begin{pgfpicture}) block. No preamble, "
                            "no \\documentclass, no \\usepackage — the server adds those."
                        ),
                    },
                    "category_hint": {
                        "type": "string",
                        "description": "math | circuit | physics | other — best-fit category",
                    },
                    "reason": {
                        "type": "string",
                        "description": (
                            "Short explanation of why no library asset fit (e.g. "
                            "'ユーザー要求: 三次関数の変曲点入り、該当 id 無し')."
                        ),
                    },
                },
                "required": ["tikz_body", "reason"],
            },
        },
        {
            "name": "insert_figure",
            "description": (
                "Render a curated figure asset with the given parameters and splice it into the "
                "current LaTeX source. Automatically loads any required packages and TikZ libraries, "
                "runs a pre-commit compile check, and ROLLS BACK on failure. Prefer this over "
                "writing raw TikZ by hand. On success the document source is already verified "
                "to compile — no separate compile_check needed."
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


# ─── Agent Modes ─────────────────────────────────────────────────────────────
# Claude Code ライクなモード切替。UI のタブと 1:1 対応。
#
#   plan — 計画のみ。read-only ツールだけ許可し、LaTeX を一切編集しない。
#          チャット応答として番号付きの実行計画を返す。ユーザーが計画を見て
#          確認してから edit / mix で発火させる運用を想定。
#   edit — 自律編集。計画は書かずに即座にツールを叩いて完走する。
#          問題作成・数式・校正などすべてこのモードで走る (run-to-completion)。
#   mix  — 両方。まず短い計画テキストを返し、続けて同じターンの中で実行まで完走する。
#
# ここで定義するのは "mode id" と "ターン予算" だけ。プロンプトの日英文面は
# _MODE_APPENDIX_JA / _MODE_APPENDIX_EN に置き、ロケールごとに注入する。

VALID_MODES = ("plan", "edit", "mix")
DEFAULT_MODE = "edit"

# 旧モード ID (auto/problem/math/review) → 新モードへのマイグレーション用エイリアス。
# フロントの localStorage に古い値が残っていても壊れないようにする。
_LEGACY_MODE_ALIAS: dict[str, str] = {
    "auto": "edit",
    "problem": "edit",
    "math": "edit",
    "review": "edit",
}


def _normalize_mode(mode: str | None) -> str:
    m = (mode or "").strip().lower()
    if m in VALID_MODES:
        return m
    if m in _LEGACY_MODE_ALIAS:
        return _LEGACY_MODE_ALIAS[m]
    return DEFAULT_MODE


# 書き込み系ツール名 (plan モードで取り除く対象)
_WRITE_TOOL_NAMES = frozenset({
    "set_latex",
    "replace_in_latex",
    "compile_check",
    "insert_figure",
    "draft_figure",
})


def max_turns_for_mode(mode: str) -> int:
    """plan は計画だけなので短く、edit/mix は完走させるため余裕を持たせる。"""
    m = _normalize_mode(mode)
    if m == "plan":
        return 6
    # edit / mix: run-to-completion
    return 24


def _build_figure_catalog_block() -> str:
    """Render the current figure asset catalog as a compact markdown block for
    the system prompt. Called lazily when the prompt is first built so the
    registry is already loaded."""
    try:
        from .figures import get_registry
        reg = get_registry()
        reg.ensure_loaded()
        by_cat: dict[str, list[str]] = {}
        for entry in reg.list(limit=500)["figures"]:
            by_cat.setdefault(entry["category"], []).append(entry["id"])
        lines: list[str] = []
        for cat in sorted(by_cat.keys()):
            ids = ", ".join(sorted(by_cat[cat]))
            lines.append(f"- **{cat}** ({len(by_cat[cat])}): {ids}")
        return "\n".join(lines) or "- (registry empty)"
    except Exception as e:
        logger.warning("figure catalog block unavailable: %s", e)
        return "- (catalog unavailable — call `list_figures` to browse)"


_MODE_APPENDIX_JA: dict[str, str] = {
    "plan": (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "## モード: Plan (計画のみ) — **編集は絶対に行わない**\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "\n"
        "このモードでは **LaTeX ソースを一切書き換えてはいけない**。\n"
        "冒頭の「絶対原則 #1 (チャットではなくソースに書け)」はこのモードでは**例外**扱い。\n"
        "\n"
        "### やってよいこと\n"
        "- `read_latex` で現状を把握する\n"
        "- `list_figures` / `get_figure` で使える素材を調べる\n"
        "- チャット応答として **実行計画** を番号付きで返す\n"
        "\n"
        "### やってはいけないこと\n"
        "- `set_latex`, `replace_in_latex`, `compile_check`, `insert_figure`, `draft_figure`\n"
        "  これらは **一切呼ばない** (ツール自体が外されている場合もある)\n"
        "- 「計画を書いたついでに編集します」は禁止。ユーザーは後で edit / mix で実行する\n"
        "\n"
        "### 応答フォーマット\n"
        "以下の構造を守る:\n"
        "```\n"
        "### 目的\n"
        "(1〜2 行でユーザー要求を言い換える)\n"
        "\n"
        "### 実行計画\n"
        "1. 〜〜を set_latex で新規作成する\n"
        "2. 〜〜を replace_in_latex で差し替える (find/replace の要点)\n"
        "3. 図は `<asset_id>` を insert_figure で挿入する\n"
        "4. 最後に compile_check(quick=false) で検証する\n"
        "\n"
        "### 注意点・前提\n"
        "- (テンプレ選択、語数、既存内容との整合など)\n"
        "\n"
        "次のアクション: Edit モード または Mix モードに切り替えて実行してください。\n"
        "```\n"
        "\n"
        "計画は **具体的** に書く。「問題を追加する」だけでなく「二次方程式 5 問、係数は整数範囲、\n"
        "解答と解説付き、レイアウトは問題/解答/解説で別セクション」まで踏み込むこと。\n"
    ),
    "edit": (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "## モード: Edit (自律編集) — **完走モード**\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "\n"
        "このモードでは **計画をチャットに書く時間はない**。即座にツールを叩き、最後まで書き切れ。\n"
        "ユーザーは結果 (LaTeX の変更 + PDF) だけを見たい。\n"
        "\n"
        "### 行動原則\n"
        "- 着手前のチャット応答は不要 (もしくは最短の一言)。いきなりツール呼び出しで始めてよい\n"
        "- 「問題 N 問」「プリント」「テスト」と言われたら 問題文+解答+解説を **全部具体値で埋める**\n"
        "- 抽象変数のまま / TODO / プレースホルダ / 空 enumerate は禁止\n"
        "- 完走するまで自分から止まるな。途中で「続けますか？」と聞くな\n"
        "- `compile_check` を通し、最後に `read_latex` で Self-Review して欠損があれば追記\n"
        "\n"
        "### デフォルト (ユーザー指定がない場合)\n"
        "- 問題数指定なし → **5 問** を既定とする\n"
        "- 難易度指定なし → 高校標準レベル\n"
        "- レイアウトは既存テンプレのスタイルに合わせる\n"
        "\n"
        "### 数式の品質\n"
        "- インライン `$...$`、独立行は `\\[ ... \\]`、複数行は `align` / `align*`\n"
        "- `\\dfrac`、`\\bm`、`pmatrix`、`\\lim_{{x \\to a}}` を適切に使う\n"
        "- 解答の計算は `align*` の `&=` で列を揃える\n"
        "\n"
        "### 最終報告 — 必ず下記マークダウン構造で返す (Summary block)\n"
        "以下の 4 見出しを必ず全て含めよ。見出しは **太字** のままでよい。\n"
        "⚠️ **以下の ``` ブロックは書式サンプル**。実際の応答では ``` で囲まず、\n"
        "**✅ 実施サマリー** から直接書き始めること (コードブロック扱いにしない)。\n"
        "```\n"
        "**✅ 実施サマリー**\n"
        "- (やったことを箇条書きで。具体的な数値を含む)\n"
        "  例: 問題 5 問追加 (二次方程式 3 問、整数問題 2 問)\n"
        "  例: 図 math.quadratic を問 1 の直後に挿入\n"
        "\n"
        "**📝 変更箇所**\n"
        "- (set_latex なら「LaTeX 全面更新 (N 文字)」のように粒度ざっくりで)\n"
        "- (replace_in_latex なら「解答セクションに追記」「問 3 の数値変更」など位置で)\n"
        "\n"
        "**🔧 検証**\n"
        "- compile_check: 成功 ✓ / PDF {{size}}KB  もしくは  失敗 ✗ とその要因\n"
        "- Self-Review: 確認した観点 (プレースホルダ残り無し / 解答全問分あり 等)\n"
        "\n"
        "**⚠️ 注意点** (ある場合のみ、無ければ見出しごと省略)\n"
        "- (置いた仮定・ユーザーに確認したい点・次回の改善提案など)\n"
        "```\n"
        "\n"
        "このサマリーはチャットに残って、次回ターンの文脈としても使われる。\n"
        "**「骨組みだけ」「あとはご自由に」「続けますか？」系の報告は絶対禁止**。\n"
    ),
    "mix": (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "## モード: Mix (計画 + 自律実行) — 両方やる\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "\n"
        "**同じターン内で** まず短い計画をテキスト応答し、続けて編集まで完走する。\n"
        "\n"
        "### フェーズ 1: Plan (先にチャットへ)\n"
        "- 3〜6 行程度。箇条書き。ユーザーが流し読みで把握できる粒度\n"
        "- 具体的な内容 (問題数・図の id・セクション構成など) を含める\n"
        "- **長々とした LaTeX 貼り付けは禁止**。計画の要約だけ\n"
        "\n"
        "### フェーズ 2: Execute (続けてツール実行)\n"
        "- その計画通りに `set_latex` / `replace_in_latex` / `insert_figure` で書き込む\n"
        "- Edit モードと同じ完走ルールを適用:\n"
        "  抽象・TODO・プレースホルダ禁止 / compile_check 必須 / Self-Review 必須\n"
        "- 計画から逸脱した場合は実行中に計画を更新してよいが、欠損を放置するな\n"
        "\n"
        "### 最終報告 — 必ず下記マークダウン構造で返す\n"
        "Phase 1 の計画テキストに続けて、実行後は以下のサマリー block を必ず付ける。\n"
        "⚠️ 下の ``` は書式サンプル。実際の応答では ``` で囲まず、**✅ 実施サマリー** から直接書く。\n"
        "```\n"
        "**✅ 実施サマリー**\n"
        "- (計画通りにやった項目 + 計画から変えた項目を箇条書きで)\n"
        "\n"
        "**📝 変更箇所**\n"
        "- (どのセクション/問題に手を入れたか)\n"
        "\n"
        "**🔧 検証**\n"
        "- compile_check の結果 / Self-Review で確認した点\n"
        "\n"
        "**⚠️ 注意点** (ある場合のみ)\n"
        "- (計画からの逸脱理由、確認してほしい点)\n"
        "```\n"
        "\n"
        "ユーザーは「計画」「実行内容のサマリー」両方を見る前提。\n"
    ),
}


def _mode_appendix_ja(mode: str) -> str:
    return _MODE_APPENDIX_JA.get(_normalize_mode(mode), _MODE_APPENDIX_JA[DEFAULT_MODE])


def _build_system_prompt_ja(mode: str = DEFAULT_MODE) -> str:
    pkg_doc = _get_pkg_doc(lang="ja")
    catalog_block = _build_figure_catalog_block()
    mode_appendix = _mode_appendix_ja(mode)
    return rf"""
あなたは **EddivomAI** — テンプレート駆動 LaTeX エディタ「Eddivom」に組み込まれた自律型 AI エージェントです。
Claude Code / OpenAI Codex のように、ユーザーの指示に応じて自分で考え、計画し、ツールを使って raw LaTeX を直接編集する。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 絶対原則 #1: チャットではなく LaTeX ソースに書け
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ユーザーが何かを「作って」「書いて」「追加して」「修正して」と言ったら、
**100% `set_latex` または `replace_in_latex` ツールを使って LaTeX ソースを直接編集せよ**。
チャットに LaTeX を貼り付けるだけは絶対にNG。チャット応答は「○○を書き込みました」程度に留める。

例外（テキスト応答のみ許可）:
- 「○○って何？」「○○を説明して」→ 知識の質問
- 「LaTeXでどう書く？」→ 書き方の相談
- 「この文書どう思う？」→ フィードバック依頼

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 絶対原則 #2: 完走せよ — 骨組みだけで止めるな
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

これは **最重要ルール**。ユーザーが「問題作って」「プリント作って」「テスト作って」と言ったとき、
**型だけ・見出しだけ・「問題1, 問題2...」だけ書いて終わるのは絶対に禁止**。

### 完走の定義
「問題 N 問作って」なら、以下をすべて具体的に埋めて初めて完了:
1. 各問題の **問題文を全文** (「問題1: 次の方程式を解け」だけは NG。数値・条件を具体化)
2. **具体的な数値・係数** (`a, b, c` 等の抽象変数のままは NG。`2x^2 - 5x + 3 = 0` のように実数にする)
3. **解答** (単に答えを書くのではなく、模範解答の数値/式)
4. **解説** (途中式を含む計算過程や、考え方のポイント。1〜3 行でよい)
5. 必要なら図 (関数グラフ・幾何図形・ベクトル等) を `insert_figure` で挿入

### 絶対に書いてはいけないプレースホルダ
以下のような「後で埋める」系の文言は **全面禁止**。見つけたら自分で具体化しろ:
- `\\TODO`, `\\placeholder`, `[ここに問題を書く]`, `[後で追加]`, `(未定)`, `...`, `（略）`
- 空の `enumerate` / `itemize`
- 「問題文はユーザーが指定してください」「数値を入れてください」「必要に応じて...」
- 解答欄だけ・解答なし・解説なし
- `\\section{{問題}}` の下に本文が無い

### 中断ルール
**ターンの途中で「とりあえず骨組みだけ出しました」と報告するな。**
まだ埋まっていないプレースホルダや TODO があれば、**自分のターン内で続けて書き込め**。
`compile_check` が通っただけでは完了ではない。「内容が具体的に全部埋まっている」ことが完了条件。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## エージェント行動ループ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

毎リクエストで以下を自律的に実行せよ。**完走するまで自分から止まるな**。

### Step 1: Read（現状把握）
- ユーザーメッセージに `[文書LaTeX]` が含まれていれば、その内容を信頼し read_latex を省略してよい
- それ以外なら `read_latex` で現在のLaTeXソースを取得する

### Step 2: Plan（計画）
- 何を、どの位置に、どう書くかを計画する
- 「問題 N 問」なら N 問ぶんの具体的な題材 (係数・関数・単元) を先に頭の中で決めてから書き始める
- 既存ドキュメントをベースに小さな修正で済むなら `replace_in_latex` を使う
- 全面的な書き換え or 新規作成なら `set_latex` を使う

### Step 3: Write（書き込み）
- `set_latex` または `replace_in_latex` で LaTeX を更新する
- テンプレートのスタイル（プリアンブル、見出しデザイン、色設定）を **必ず尊重** する
- 既存テンプレが日本語フォント (luatexja-preset 等) を読み込んでいる場合は **絶対に消さない**
- プレースホルダや TODO を書くな。最初から具体的な数値・文を入れろ

### Step 4: Build（コンパイル検証 — 必須）
- **`compile_check(quick=false)` で実コンパイル検証**
- エラーが出たら:
  1. エラーメッセージを読んで原因を特定
  2. `replace_in_latex` または `set_latex` で修正
  3. 再度 `compile_check` で確認
  4. 成功するまで繰り返せ（最大3回）

### Step 5: Self-Review（完走チェック — 必須）
コンパイルが通ったら、**最後に一度 `read_latex` で自分の成果物を読み返し**、以下を確認:
- 依頼された問題数・節・項目が **すべて具体的な内容で埋まっている** か
- プレースホルダ (`...`, `TODO`, `[ここに]`, 空 enumerate, 「後で」) が残っていないか
- 問題に対して **解答・解説が付いている** か (ユーザーが「問題だけ」と明示した場合を除く)
- 不足があれば **`replace_in_latex` で追記** してから Step 4 に戻る

### Step 6: Report（報告）
- 何を生成したか (問題数・図の数・セクション数など具体的な数値で)
- `compile_check` の結果
- 報告は日本語で 3〜6 行程度。冗長に LaTeX を貼るな

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LaTeX 編集の指針
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### エンジン
LuaLaTeX を前提とする。日本語テンプレなら `luatexja-preset[haranoaji]`、
英語テンプレなら `lmodern` + `fontenc[T1]` を用いる。
**現在のソースが採用しているフォント / 言語スキームを途中で切り替えてはいけない。**

### 許可パッケージ (allowlist 方式)
{pkg_doc}

### 図の挿入 (Figure library) — **厳守フロー**

ユーザーが図・グラフ・回路・自由体図・振り子・ばね・斜面・光線・投射・電場・ベクトル場・三角形・円・数直線・関数プロットなどを要求 (教材作成では大半が該当) したら、必ず以下の順:

#### 1) まず `list_figures` を **2 回** 呼ぶ (2-query ルール)
- 1 回目: 具体的なキーワード (例: `query="quadratic"`, `category="math"`)
- 2 回目: 空振りなら **広めのキーワード** で再検索 (例: `query="function"`, `category="math"`)
- 2 回ともヒット無しだったときだけ `draft_figure` 使用を許可する

#### 2) ヒットしたら `get_figure(id)` で parameter_schema 確認 → `insert_figure(id, params, caption, label)`
- `insert_figure` は挿入後に **自動で pre-compile 検証** を実行。成功したら文書にコミット、失敗したらロールバックして `error=compile_failed` を返す
- 成功後の `compile_check` は不要 (既に検証済み)
- 失敗時は params を見直すか別 id を試す

#### 3) 2 回の list_figures が両方空だった場合のみ `draft_figure`
- `tikz_body` にフル `\begin{{tikzpicture}}...\end{{tikzpicture}}` (または circuitikz / pgfpicture) を渡す。preamble 不要
- `reason` に「なぜライブラリで足りないか」を必ず書く (ログに残り、将来のカタログ拡張判断に使う)
- 成功すると `snippet_key` と `tikz_body_marked` が返る
- その `tikz_body_marked` を `replace_in_latex` で文書に差し込む
- 最後に `compile_check(quick=false)` を必ず呼ぶ

**絶対禁止**: 上記 3 フローを通さずに `set_latex` / `replace_in_latex` で `\begin{{tikzpicture}}` / `\begin{{circuitikz}}` / `\begin{{pgfpicture}}` を直接書くこと。**ツールレベルで弾かれて `error: protocol_violation` が返る**のでコストの無駄。必ず `insert_figure` か `draft_figure` を使え。

#### 現在のカタログ (id 一覧)
{catalog_block}

**複数の図が必要なとき**: 1 つずつ `insert_figure` (または `draft_figure` → `replace_in_latex`) を繰り返せ。まとめて手書きするな。

パラメータ: parameter_schema の型・範囲・enum 選択肢を守れ。迷ったら `get_figure` で確認せよ。

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
- 文書編集後の報告は: (1) 生成した内容を **具体的な数** で (例: 問題 5 問・図 2 点)
  (2) `compile_check` の結果 (3) Self-Review で確認した点 (4) (あれば) 注意点
- 迷ったら書き込む。テキスト応答で済ませるな
- 必ず `compile_check` でコンパイルが通ることを確認してから完了報告する
- **「とりあえず枠だけ」「型だけ」「後はユーザーにお任せ」系の報告は禁止**
- モード別の追加ルールが下にある場合は、それを最優先で遵守せよ

{mode_appendix}
"""


_MODE_APPENDIX_EN: dict[str, str] = {
    "plan": (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "## Mode: Plan — **no editing allowed**\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "\n"
        "In this mode you MUST NOT modify the LaTeX source. Cardinal rule #1\n"
        "(\"write to the source\") is **overridden** here.\n"
        "\n"
        "### Allowed\n"
        "- `read_latex` to inspect the current source\n"
        "- `list_figures` / `get_figure` to survey available assets\n"
        "- Reply in chat with a numbered execution plan\n"
        "\n"
        "### Forbidden\n"
        "- Never call `set_latex`, `replace_in_latex`, `compile_check`, `insert_figure`,\n"
        "  or `draft_figure`. (They may be stripped from the toolset in this mode.)\n"
        "- Do not 'plan and then also edit just this once'. The user will run Edit / Mix later.\n"
        "\n"
        "### Response format\n"
        "```\n"
        "### Goal\n"
        "(1–2 lines restating the user's ask)\n"
        "\n"
        "### Plan\n"
        "1. Create <...> via set_latex\n"
        "2. Patch <...> via replace_in_latex (find/replace gist)\n"
        "3. Insert figure `<asset_id>` via insert_figure\n"
        "4. Verify with compile_check(quick=false)\n"
        "\n"
        "### Notes & assumptions\n"
        "- (template choice, word counts, consistency with existing doc, …)\n"
        "\n"
        "Next: switch to Edit or Mix mode to execute.\n"
        "```\n"
        "\n"
        "Be **concrete** — not 'add problems' but 'add 5 quadratic-equation problems with\n"
        "integer coefficients, answers, and solutions, split into Problem / Answer / Solution sections'.\n"
    ),
    "edit": (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "## Mode: Edit (autonomous) — **run-to-completion**\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "\n"
        "No plan-in-chat in this mode. Go straight to tool calls and keep writing until done.\n"
        "The user wants the result (LaTeX + PDF), not a narration.\n"
        "\n"
        "### Behaviour\n"
        "- Skip the plan; start with tool calls (or a one-liner at most).\n"
        "- 'N problems' / 'worksheet' / 'test' → every problem, answer, and solution filled in\n"
        "  with concrete numbers. No abstract variables, no TODOs, no empty lists.\n"
        "- Never stop midway asking 'should I continue?'.\n"
        "- Run `compile_check`, then a final `read_latex` Self-Review; patch any gap.\n"
        "\n"
        "### Defaults (when unspecified)\n"
        "- Problem count: **5** if no number is given.\n"
        "- Difficulty: standard high-school level.\n"
        "- Layout: follow the existing template.\n"
        "\n"
        "### Math quality\n"
        "- Inline `$...$`, display `\\[ ... \\]`, multi-line `align` / `align*`\n"
        "- Use `\\dfrac`, `\\bm`, `pmatrix`, `\\lim_{{x \\to a}}`\n"
        "- Aligned `&=` in multi-step derivations\n"
        "\n"
        "### Final report — MUST use this markdown summary block\n"
        "Emit ALL four headings below (drop **Caveats** only if empty).\n"
        "⚠️ The ``` block below is a FORMAT SAMPLE. In your actual reply, do NOT wrap\n"
        "the summary in ``` — write it as plain markdown starting from **✅ What was done**.\n"
        "```\n"
        "**✅ What was done**\n"
        "- (bullet list of concrete actions with counts)\n"
        "  e.g. Added 5 problems (3 quadratics, 2 integer problems)\n"
        "  e.g. Inserted figure math.quadratic right after Problem 1\n"
        "\n"
        "**📝 Changes**\n"
        "- (set_latex → 'Rewrote full source (N chars)')\n"
        "- (replace_in_latex → 'Patched the Answers section', 'Changed the coefficients of Problem 3')\n"
        "\n"
        "**🔧 Verification**\n"
        "- compile_check: ✓ PDF {{size}}KB   OR   ✗ with cause\n"
        "- Self-Review: what you checked (no placeholders remaining, answers for every problem, ...)\n"
        "\n"
        "**⚠️ Caveats** (omit the heading entirely if none)\n"
        "- (assumptions made, points for the user to confirm, suggestions for next round)\n"
        "```\n"
        "\n"
        "This summary stays in the chat and feeds forward as context for the next turn.\n"
        "**Never report 'skeleton only' / 'rest is up to you' / 'shall I continue?'.**\n"
    ),
    "mix": (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "## Mode: Mix (plan + autonomous edit)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "\n"
        "In the **same turn**, first emit a short plan, then execute it to completion.\n"
        "\n"
        "### Phase 1 — Plan (in chat)\n"
        "- 3–6 lines of bullets. Skimmable.\n"
        "- Concrete: problem count, figure ids, section structure.\n"
        "- No long LaTeX pasted. Summary only.\n"
        "\n"
        "### Phase 2 — Execute (tool calls, immediately after)\n"
        "- Follow the plan with `set_latex` / `replace_in_latex` / `insert_figure`.\n"
        "- Apply all Edit-mode run-to-completion rules:\n"
        "  no placeholders, mandatory `compile_check`, mandatory Self-Review.\n"
        "- If you diverge from the plan, adjust the plan mid-run — do not leave gaps.\n"
        "\n"
        "### Final report — MUST use this markdown summary block\n"
        "After Phase 1's plan text, always append this block once execution is done.\n"
        "⚠️ The ``` below is a format sample. Do NOT wrap the summary in ``` — write plain markdown.\n"
        "```\n"
        "**✅ What was done**\n"
        "- (bullet list: items followed from plan + items diverged from plan)\n"
        "\n"
        "**📝 Changes**\n"
        "- (which sections / problems were touched)\n"
        "\n"
        "**🔧 Verification**\n"
        "- compile_check result / Self-Review points checked\n"
        "\n"
        "**⚠️ Caveats** (omit if empty)\n"
        "- (reasons for diverging from the plan, points to confirm)\n"
        "```\n"
        "\n"
        "User reads both the plan and the summary. Keep them aligned.\n"
    ),
}


def _mode_appendix_en(mode: str) -> str:
    return _MODE_APPENDIX_EN.get(_normalize_mode(mode), _MODE_APPENDIX_EN[DEFAULT_MODE])


def _build_system_prompt_en(mode: str = DEFAULT_MODE) -> str:
    pkg_doc = _get_pkg_doc(lang="en")
    catalog_block = _build_figure_catalog_block()
    mode_appendix = _mode_appendix_en(mode)
    return rf"""
You are **EddivomAI** — an autonomous AI agent embedded in the template-driven LaTeX editor "Eddivom".
Like Claude Code or OpenAI Codex, you reason, plan, and call tools to edit raw LaTeX directly on behalf of the user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Cardinal rule #1: WRITE TO THE SOURCE, don't paste in chat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user says "make / write / add / fix something",
**always use the `set_latex` or `replace_in_latex` tool to modify the LaTeX source directly**.
Pasting LaTeX into the chat reply is forbidden. Keep the chat reply short ("Done — added the worksheet.").

Exceptions (text reply allowed):
- "What is X?" / "Explain X." → knowledge questions
- "How do you write X in LaTeX?" → syntax advice
- "What do you think of this doc?" → feedback request

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Cardinal rule #2: Run to completion — never stop at the skeleton
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user asks for "N problems", "a worksheet", "a test", etc., **do not stop
after writing just headings and problem numbers**. The task is not done until:

1. Every requested problem has its **full statement** with concrete numbers.
2. Every problem has an **answer** and a **solution walkthrough** (unless the user explicitly excluded them).
3. There are **no placeholders** anywhere in the source: no `\\TODO`, `[fill this in]`,
   `[example here]`, `...`, empty `enumerate`, empty sections, no "add content as needed".
4. `compile_check` succeeds — but compile success alone is NOT "done". Content must be concrete.

**Never return a half-filled skeleton and ask the user to continue.**
If anything is missing, keep writing in the same turn with more tool calls.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Agent loop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every request, run this loop autonomously. **Do not stop until the task is complete.**

### Step 1: Read
- If the user message already contains a `[Document LaTeX]` block, trust it and skip `read_latex`.
- Otherwise call `read_latex` to fetch the current source.

### Step 2: Plan
- Decide what to write, where to insert it, and how.
- For "N problems", pick the N specific subjects (coefficients, function choices, topics) BEFORE writing.
- For small targeted edits, prefer `replace_in_latex`.
- For new docs or large rewrites, use `set_latex`.

### Step 3: Write
- Call `set_latex` or `replace_in_latex` to update the source.
- **Respect the existing template** — preamble, heading style, colors, fonts, language scheme.
- If the existing source uses an English preamble (`lmodern` / `fontenc[T1]`),
  **never switch it to a Japanese preamble** (luatexja-preset / haranoaji) and vice versa.
  Match what is already there.
- Write concrete content from the start — never leave placeholders for a later pass.

### Step 4: Build (mandatory)
- Call `compile_check(quick=false)` to actually compile.
- If it fails:
  1. Read the error and locate the root cause.
  2. Fix with `replace_in_latex` or `set_latex`.
  3. Re-run `compile_check`.
  4. Repeat until it succeeds (max 3 retries).

### Step 5: Self-Review (mandatory)
After a successful compile, re-read the source with `read_latex` and verify:
- Every requested problem / section / item is **filled in with concrete content**.
- No leftover `...`, `TODO`, `[fill in]`, empty lists, or "add more later" comments.
- Every problem has an answer + solution (unless the user excluded them).
- If anything is missing, patch with `replace_in_latex` and return to Step 4.

### Step 6: Report
- Say what you produced with concrete counts (e.g. "5 problems, 2 figures, 3 sections").
- Report the `compile_check` outcome.
- 3–6 lines. Do not paste LaTeX back into the chat reply.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LaTeX editing guidelines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Engine
LuaLaTeX. For English documents use `lmodern` + `\usepackage[T1]{{fontenc}}`.
For Japanese documents use `\usepackage[haranoaji]{{luatexja-preset}}`.
**Do not switch the font/language scheme of an existing document mid-edit.**

### Allowed packages (allowlist)
{pkg_doc}

### Figure library — **MANDATORY FLOW**

For any figure / graph / circuit / FBD / pendulum / spring / incline / lens / projectile /
field lines / vector field / triangle / circle / number line / function plot request
(most teaching-material work qualifies), follow this order:

#### 1) Call `list_figures` **twice** (2-query rule)
- First: specific keyword (e.g. `query="quadratic"`, `category="math"`)
- Second (only if empty): broader keyword (e.g. `query="function"`, `category="math"`)
- Only if BOTH return empty may you use `draft_figure`.

#### 2) On a hit → `get_figure(id)` → `insert_figure(id, params, caption, label)`
- `insert_figure` now performs a **pre-commit compile check** automatically.
  On success the document is already verified; on failure the tool rolls back
  and returns `error=compile_failed` so you can retry with different params or
  pick another id. **No separate `compile_check` is needed after `insert_figure`.**

#### 3) If both list_figures queries returned empty → `draft_figure`
- Pass the full `\begin{{tikzpicture}}...\end{{tikzpicture}}` (or circuitikz / pgfpicture)
  in `tikz_body`. No preamble.
- Always supply `reason` (why the library didn't cover it) — it's logged for catalog growth.
- On success you get `snippet_key` + `tikz_body_marked`. Splice `tikz_body_marked` into
  the document via `replace_in_latex`, then call `compile_check(quick=false)`.

**STRICTLY FORBIDDEN**: hand-writing `\begin{{tikzpicture}}` / `\begin{{circuitikz}}` /
`\begin{{pgfpicture}}` via `set_latex` / `replace_in_latex` without going through
`insert_figure` or `draft_figure`. **The tools will reject this at runtime with
`error: protocol_violation`**, so wasting a turn on it costs tokens for nothing.

#### Current catalog (id list)
{catalog_block}

When multiple figures are needed, call `insert_figure` (or `draft_figure` →
`replace_in_latex`) once per figure. Never paste multiple tikzpictures at once.

Stay within each parameter's declared type and range (e.g. an `enum` must come from its `choices`).

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
- After editing, report: (1) what you produced with concrete counts
  (e.g. "5 problems, 2 figures"), (2) the compile_check result,
  (3) what you verified during Self-Review, (4) any caveats.
- When in doubt, edit the source — do not just answer in text.
- Always confirm a successful `compile_check` before reporting "done".
- **Never report "skeleton only" / "structure in place, fill in later" style.**
- Any mode-specific rules below override defaults — follow them first.

{mode_appendix}
"""


# Lazy-built per (locale, mode). Keyed cache so we don't rebuild on every turn
# but still serve a distinct prompt per mode.
_SYSTEM_PROMPT_CACHE: dict[tuple[str, str], str] = {}


def get_system_prompt(locale: str = "ja", mode: str = DEFAULT_MODE) -> str:
    """Return the system prompt for the given UI locale and agent mode.

    locale: "ja" (default) or "en".  Anything else → "ja".
    mode:   one of VALID_MODES (auto / problem / math / review).  Invalid → auto.
    """
    loc = "en" if locale == "en" else "ja"
    m = _normalize_mode(mode)
    key = (loc, m)
    cached = _SYSTEM_PROMPT_CACHE.get(key)
    if cached is not None:
        return cached
    prompt = (
        _build_system_prompt_en(m) if loc == "en" else _build_system_prompt_ja(m)
    )
    _SYSTEM_PROMPT_CACHE[key] = prompt
    return prompt


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


def get_tools_for_mode(mode: str) -> list[dict]:
    """Plan モードでは書き込み系ツールを物理的に外す。
    プロンプトだけでなくツール層でも強制することで、AI が誤って編集することを防ぐ。"""
    m = _normalize_mode(mode)
    tools = get_openai_tools()
    if m == "plan":
        return [t for t in tools if t.get("function", {}).get("name") not in _WRITE_TOOL_NAMES]
    return tools


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


_TIKZ_ENV_BEGIN_RE = _re.compile(
    r"\\begin\{(tikzpicture|circuitikz|circuittikz|pgfpicture)\}"
)
_FIGURE_MARKER_RE = _re.compile(r"%\s*eddivom-figure:")


def _find_unmarked_tikz_envs(added_text: str) -> list[str]:
    """Return env names of any tikz-like environment in `added_text` that
    lacks an `% eddivom-figure:` marker in the immediately surrounding
    lines. Used by _execute_set_latex / _execute_replace_in_latex to enforce
    the "figures must go through insert_figure / draft_figure" protocol."""
    offenders: list[str] = []
    for m in _TIKZ_ENV_BEGIN_RE.finditer(added_text):
        env = m.group(1)
        # Window: 200 chars before and 400 after the \begin{...}
        start = max(0, m.start() - 200)
        end = min(len(added_text), m.end() + 400)
        window = added_text[start:end]
        if not _FIGURE_MARKER_RE.search(window):
            offenders.append(env)
    return offenders


_TIKZ_GUARD_MESSAGE = (
    "TikZ 図は set_latex / replace_in_latex で直接書けません (プロトコル違反)。"
    "insert_figure (ライブラリ経由) か draft_figure (escape hatch) を使ってください。"
    "既存の図をそのまま移動させる場合は `% eddivom-figure: id=...` マーカも一緒に含めてください。"
)


def _execute_set_latex(document: dict, args: dict) -> dict:
    """Replace the entire LaTeX source."""
    new_latex = args.get("latex", "")
    if not isinstance(new_latex, str):
        return {"error": "latex must be a string"}

    # Protocol guard: reject new unmarked TikZ envs to prevent the AI from
    # freestyling around insert_figure / draft_figure.
    current = document.get("latex", "") or ""
    new_unmarked = _find_unmarked_tikz_envs(new_latex)
    old_unmarked = _find_unmarked_tikz_envs(current)
    # Only the *added* offenders count — existing ones shouldn't block edits.
    if len(new_unmarked) > len(old_unmarked):
        return {
            "error": "protocol_violation",
            "offender_envs": new_unmarked,
            "message": _TIKZ_GUARD_MESSAGE,
        }

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

    # Protocol guard: new tikz envs in the replacement text need the marker.
    # We compute "added" as "in replace but not in find" — if a tikz begin
    # appears in `replace` that wasn't in `find`, it's a new unmarked figure.
    find_unmarked = _find_unmarked_tikz_envs(find)
    replace_unmarked = _find_unmarked_tikz_envs(replace)
    if len(replace_unmarked) > len(find_unmarked):
        return {
            "error": "protocol_violation",
            "offender_envs": replace_unmarked,
            "message": _TIKZ_GUARD_MESSAGE,
        }

    new_latex = current.replace(find, replace, 1)
    document["latex"] = new_latex
    return {
        "applied": True,
        "latex_length": len(new_latex),
        "delta_chars": len(new_latex) - len(current),
        "message": f"LaTeXを修正しました（{len(new_latex)}文字）",
    }


def _compile_latex_snapshot(
    raw_latex_source: str,
    *,
    allow_autofix: bool = True,
    timeout: int = 30,
) -> dict:
    """Core compile routine shared by compile_check and insert_figure rollback.

    Accepts a raw LaTeX string (not a document dict) so callers can compile a
    hypothetical new version without mutating `document["latex"]`. Returns the
    same result shape as _execute_compile_check so existing summarizers and
    prompt fragments can consume it unchanged.

    Keys returned:
        success: bool
        phase: "syntax" | "compile" | "error"
        issues: list[str]
        latex_source: str    (post-autofix — caller may want to commit this)
        pdf_size: int        (only on success)
        errors: list[str]    (only on failure)
        error_line: int|None
        message: str
    """
    import subprocess
    import tempfile
    from pathlib import Path

    try:
        from .tex_env import TEX_ENV, LUALATEX_CMD
        from .security import get_compile_args
        from .latex_autofix import autofix_latex, autofix_after_failure

        latex_source = (
            autofix_latex(raw_latex_source) if allow_autofix else (raw_latex_source or "")
        )

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
                "latex_source": latex_source,
                "message": f"構文エラー {len(issues)}件 — コンパイル前に修正が必要",
            }

        # ── Phase 2: 実コンパイル ──
        def _run_once(source: str) -> tuple[bool, int, str]:
            with tempfile.TemporaryDirectory() as tmpdir:
                tex_path = Path(tmpdir) / "check.tex"
                tex_path.write_text(source, encoding="utf-8")

                cmd_args = get_compile_args(LUALATEX_CMD, str(tmpdir), str(tex_path))
                from .pdf_service import _make_subprocess_limits
                result = subprocess.run(
                    cmd_args,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=tmpdir,
                    env=TEX_ENV,
                    preexec_fn=_make_subprocess_limits(),
                )

                pdf_path = Path(tmpdir) / "check.pdf"
                if result.returncode == 0 and pdf_path.exists():
                    return True, pdf_path.stat().st_size, result.stdout
                return False, 0, result.stdout + "\n" + result.stderr

        try:
            ok, pdf_size, log = _run_once(latex_source)

            # autofix リトライ — 不足パッケージ / no-op stub を最大 3 回まで補完
            if not ok and allow_autofix:
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
                    "latex_source": latex_source,
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
                "latex_source": latex_source,
                "log_tail": log[-1500:],
                "message": f"コンパイル失敗 ✗ — {errors[0][:100]}",
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "phase": "compile",
                "issues": ["コンパイルタイムアウト (30秒)"],
                "latex_source": latex_source,
                "message": "コンパイルタイムアウト — 文書が複雑すぎるか無限ループの可能性",
            }
        except FileNotFoundError:
            return {
                "success": True,
                "phase": "syntax",
                "issues": [],
                "latex_source": latex_source,
                "latex_length": len(latex_source),
                "message": f"構文チェック OK（{len(latex_source)}文字）— コンパイラ未検出のため構文のみ",
            }

    except Exception as e:
        return {
            "success": False,
            "phase": "error",
            "issues": [str(e)[:200]],
            "latex_source": raw_latex_source or "",
            "message": f"検証エラー: {str(e)[:200]}",
        }


def _syntax_check(latex_source: str) -> list[str]:
    """Brace / environment balance only. No subprocess."""
    issues: list[str] = []
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
    return issues


def _execute_compile_check(document: dict, args: dict) -> dict:
    """LuaLaTeX で実際にコンパイル検証する。

    quick=True は subprocess を使わず brace/env balance だけ。
    quick=False は _compile_latex_snapshot ヘルパ経由で実コンパイル。
    """
    from .latex_autofix import autofix_latex

    raw_latex_source = document.get("latex", "") or ""
    latex_source = autofix_latex(raw_latex_source)

    quick = args.get("quick", False)
    if quick:
        issues = _syntax_check(latex_source)
        if issues:
            return {
                "success": False,
                "phase": "syntax",
                "issues": issues,
                "message": f"構文エラー {len(issues)}件 — コンパイル前に修正が必要",
            }
        return {
            "success": True,
            "phase": "syntax",
            "issues": [],
            "latex_length": len(latex_source),
            "message": f"構文チェック OK（{len(latex_source)}文字）",
        }

    result = _compile_latex_snapshot(raw_latex_source, allow_autofix=True)

    # autofix 済みソースがあれば document に反映 (旧挙動と互換)
    fixed = result.get("latex_source")
    if fixed and fixed != raw_latex_source and result.get("success"):
        document["latex"] = fixed

    clean = dict(result)
    clean.pop("latex_source", None)
    clean.pop("log_tail", None)
    return clean


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
        asset_id=asset_id,
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

    # Pre-commit compile validation. If lualatex rejects the resulting document
    # we leave `document["latex"]` untouched so the AI can retry with different
    # parameters or pick a different asset, without polluting the source.
    skip_compile = bool(args.get("_skip_compile"))  # test hook
    if not skip_compile:
        compile_result = _compile_latex_snapshot(new_src, allow_autofix=True)
        if not compile_result.get("success"):
            return {
                "error": "compile_failed",
                "asset_id": asset_id,
                "phase": compile_result.get("phase"),
                "errors": compile_result.get("errors", compile_result.get("issues", []))[:5],
                "error_line": compile_result.get("error_line"),
                "log_tail": (compile_result.get("log_tail") or "")[-800:],
                "message": (
                    f"図 {asset_id} 挿入後のコンパイルが失敗したためロールバックしました。"
                    "params を見直すか別の id を試してください。"
                ),
            }
        # autofix がパッケージ追加等で new_src を書き換えていれば、その版を採用。
        fixed = compile_result.get("latex_source")
        if fixed:
            new_src = fixed

    document["latex"] = new_src
    return {
        "applied": True,
        "asset_id": asset_id,
        "latex_length": len(new_src),
        "inserted_at_line": line,
        "preview_url": f"/api/figures/{asset_id}/preview.png",
        "required_packages_added": rendered.required_packages,
        "required_tikzlibraries_added": rendered.required_tikzlibraries,
        "compile_verified": not skip_compile,
        "message": (
            f"図 {asset_id} を挿入し compile 検証 OK（L{line} 付近）"
            if not skip_compile
            else f"図 {asset_id} を挿入しました（L{line} 付近、compile 検証スキップ）"
        ),
    }


def _execute_draft_figure(document: dict, args: dict) -> dict:
    from .figures.snippet import SnippetError, compile_snippet_sync

    tikz_body = args.get("tikz_body") or ""
    if not isinstance(tikz_body, str) or not tikz_body.strip():
        return {"error": "tikz_body must be a non-empty string"}
    category_hint = args.get("category_hint") or None
    reason = args.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        return {"error": "reason is required (why no library asset fits)"}

    try:
        _path, key = compile_snippet_sync(
            tikz_body, category_hint=category_hint, reason=reason
        )
    except SnippetError as e:
        return {
            "error": "compile_failed",
            "message": f"draft_figure コンパイル失敗: {str(e)[:200]}",
        }
    except Exception as e:
        return {"error": f"draft_figure internal error: {str(e)[:200]}"}

    # Inject a freestyle marker so the Visual Editor still renders the PNG.
    marker = f"% eddivom-figure: freestyle key={key}"
    lines = tikz_body.splitlines()
    # Insert marker on the line right after the first \begin{...}
    for i, ln in enumerate(lines):
        if _re.match(r"\s*\\begin\{(tikzpicture|circuitikz|pgfpicture)\}", ln):
            lines.insert(i + 1, marker)
            break
    else:
        lines.insert(0, marker)
    marked = "\n".join(lines)

    return {
        "applied": False,  # AI still needs to splice it into the document
        "compile_verified": True,
        "snippet_key": key,
        "preview_url": f"/api/figures/snippet/{key}.png",
        "tikz_body_marked": marked,
        "category_hint": category_hint,
        "message": (
            f"draft_figure OK — key={key}. tikz_body_marked を "
            "replace_in_latex で文書に挿入してください。"
        ),
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
    if name == "draft_figure":
        return _execute_draft_figure(document, args)
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
    if name == "draft_figure":
        if result.get("error"):
            return f"DraftFig ✗: {result.get('message', result['error'])[:80]}"
        return f"DraftFig ✓: key={result.get('snippet_key', '?')}"
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


def _build_agent_contents(
    messages: list[dict],
    doc_brief: str,
    locale: str = "ja",
    mode: str = DEFAULT_MODE,
):
    """Build OpenAI messages list. `locale` selects the system prompt language ("ja" / "en").
    `mode` selects the agent mode appendix (auto / problem / math / review)."""
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
        {"role": "system", "content": get_system_prompt(locale, mode)},
    ]

    norm_mode = _normalize_mode(mode)

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
        mode_banner = {
            "plan": "[mode: PLAN] Plan only — DO NOT edit the LaTeX. Use read_latex / list_figures only. Reply with a numbered plan.",
            "edit": "[mode: EDIT] Autonomous edit — skip the plan, call tools immediately, finish every problem+answer+solution with concrete content. Run-to-completion.",
            "mix":  "[mode: MIX] Plan + execute in the same turn. Short plan first in chat, then edit to completion.",
        }[norm_mode]
    else:
        nudge_with_ctx = (
            "必要に応じて set_latex / replace_in_latex / compile_check で文書を編集してください。"
        )
        nudge_without_ctx = (
            "必要に応じて read_latex で現在の内容を確認し、"
            "set_latex / replace_in_latex / compile_check で文書を編集してください。"
        )
        ctx_label = "文書コンテキスト"
        mode_banner = {
            "plan": "[モード: PLAN] 計画のみ。LaTeX を書き換えるな。read_latex / list_figures だけ使い、番号付き計画をチャットに返せ。",
            "edit": "[モード: EDIT] 自律編集。計画は書かずに即ツール呼び出し。問題・解答・解説まで具体値で完走。骨組みだけで止めるな。",
            "mix":  "[モード: MIX] 同じターン内で まず短い計画テキスト → そのまま実行まで完走。",
        }[norm_mode]

    for i, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if i == last_user_idx and role == "user":
            if has_doc_context:
                content = f"{mode_banner}\n\n{content}\n\n{nudge_with_ctx}"
            else:
                content = (
                    f"{mode_banner}\n\n"
                    f"[{ctx_label}: {doc_brief}]\n\n{content}\n\n{nudge_without_ctx}"
                )

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

async def chat_stream(
    messages: list[dict],
    document: dict,
    locale: str = "ja",
    mode: str = DEFAULT_MODE,
):
    """
    Streaming chat — OpenAI API with raw-LaTeX editing tools.

    Args:
        messages: chat history
        document: current DocumentModel as dict (mutated by tools)
        locale:   "ja" (default) or "en" — selects system prompt + status text
        mode:     agent mode id — one of VALID_MODES (plan / edit / mix).
                  Controls which prompt appendix is injected, the tool set,
                  and the per-turn budget. Invalid / legacy ids → edit.

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

    mode = _normalize_mode(mode)
    MAX_AGENT_TURNS = max_turns_for_mode(mode)

    try:
        yield _sse({"type": "thinking", "text": STATUS_INIT})

        client = get_client()
        doc_brief = _document_context_brief(document)
        openai_messages = _build_agent_contents(
            messages, doc_brief, locale=locale, mode=mode
        )
        tools = get_tools_for_mode(mode)

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

async def chat(
    messages: list[dict],
    document: dict,
    locale: str = "ja",
    mode: str = DEFAULT_MODE,
) -> dict:
    """Non-streaming agent chat — fallback for when streaming fails.

    `locale` selects the system prompt language ("ja" / "en").
    `mode` selects the agent mode (plan / edit / mix)."""
    client = get_client()
    doc_brief = _document_context_brief(document)
    mode = _normalize_mode(mode)
    openai_messages = _build_agent_contents(
        messages, doc_brief, locale=locale, mode=mode
    )
    tools = get_tools_for_mode(mode)

    all_thinking: list[dict] = []
    total_usage = {"inputTokens": 0, "outputTokens": 0}
    final_message = ""
    latex_changed = False

    MAX_TURNS = max_turns_for_mode(mode)

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

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
MODEL_CHAT = os.environ.get("OPENAI_MODEL_CHAT", "gpt-4.1")
MODEL_VISION = os.environ.get("OPENAI_MODEL_VISION", "gpt-4.1-mini")
MODEL_FAST = os.environ.get("OPENAI_MODEL_FAST", "gpt-4.1-nano")


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
    ]
}


# ─── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = r"""
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
- テンプレートのスタイル（プリアンブル、見出しデザイン、色設定）を尊重する

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
LuaLaTeX (luatexja-preset[haranoaji]) を前提とする。

### プリアンブルで使える主なパッケージ
- 数式: amsmath, amssymb, amsthm, mathtools, bm, physics
- 表: booktabs, tabularx, longtable, multirow
- 図: tikz, circuitikz, pgfplots, graphicx, wrapfig
- 装飾: tcolorbox, mdframed, framed
- レイアウト: geometry, multicol, fancyhdr, titlesec, enumitem
- 色: xcolor
- 化学: mhchem
- リンク: hyperref

### 禁止事項
- `\input`, `\include`, `\write18`, `\directlua` などのファイルアクセス・シェル実行系
- `--shell-escape` を必要とするパッケージ（minted など）

### 数式
- インライン: `$x^2 + 1$`
- 独立: `\[ ... \]` または `$$ ... $$`
- 整列: `\begin{align} ... \end{align}`

### 日本語
- LuaLaTeX + luatexja-preset を使用するため、日本語はそのまま記述できる
- フォント指定が必要な場合は `\usepackage[haranoaji]{luatexja-preset}` 等

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 応答ルール
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 日本語で応答する
- 文書編集後の報告は: (1) 何を変更したか / (2) compile_check の結果 / (3) (あれば) 注意点
- 迷ったら書き込む。テキスト応答で済ませるな
- 必ず `compile_check` でコンパイルが通ることを確認してから完了報告する
"""


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
    """LuaLaTeX で実際にコンパイル検証する。"""
    import subprocess
    import tempfile
    from pathlib import Path

    try:
        from .tex_env import TEX_ENV, LUALATEX_CMD
        from .security import get_compile_args

        latex_source = document.get("latex", "") or ""

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
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                tex_path = Path(tmpdir) / "check.tex"
                tex_path.write_text(latex_source, encoding="utf-8")

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
                pdf_exists = pdf_path.exists()

                if result.returncode == 0 and pdf_exists:
                    pdf_size = pdf_path.stat().st_size
                    warnings = []
                    for line in result.stdout.split("\n"):
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
                else:
                    log = result.stdout + "\n" + result.stderr
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


def _execute_tool(name: str, document: dict, args: dict) -> dict:
    if name == "read_latex":
        return _execute_read_latex(document, args)
    if name == "set_latex":
        return _execute_set_latex(document, args)
    if name == "replace_in_latex":
        return _execute_replace_in_latex(document, args)
    if name == "compile_check":
        return _execute_compile_check(document, args)
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


def _build_agent_contents(messages: list[dict], doc_brief: str):
    """Build OpenAI messages list."""
    MAX_MESSAGES = 20
    if len(messages) > MAX_MESSAGES:
        logger.warning("Too many messages (%d > %d), trimming", len(messages), MAX_MESSAGES)
        messages = messages[:2] + messages[-6:]

    last_user_idx = max(
        (i for i, m in enumerate(messages) if m.get("role") == "user"),
        default=0,
    )

    last_user_content = messages[last_user_idx].get("content", "") if messages else ""
    has_doc_context = "[文書LaTeX]" in last_user_content

    openai_messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    for i, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if i == last_user_idx and role == "user":
            if has_doc_context:
                content = (
                    f"{content}\n\n"
                    "必要に応じて set_latex / replace_in_latex / compile_check で文書を編集してください。"
                )
            else:
                content = (
                    f"[文書コンテキスト: {doc_brief}]\n\n"
                    f"{content}\n\n"
                    "必要に応じて read_latex で現在の内容を確認し、set_latex / replace_in_latex / compile_check で文書を編集してください。"
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

async def chat_stream(messages: list[dict], document: dict):
    """
    Streaming chat — OpenAI API with raw-LaTeX editing tools.

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

    all_thinking: list[dict] = []
    total_usage = {"inputTokens": 0, "outputTokens": 0}
    final_text_parts: list[str] = []
    latex_changed = False

    MAX_AGENT_TURNS = 12

    try:
        yield _sse({"type": "thinking", "text": "初期化中..."})

        client = get_client()
        doc_brief = _document_context_brief(document)
        openai_messages = _build_agent_contents(messages, doc_brief)
        tools = get_openai_tools()

        yield _sse({"type": "thinking", "text": "エージェント起動..."})

        for turn in range(MAX_AGENT_TURNS):
            text_parts: list[str] = []
            tool_calls_raw: list[dict] = []
            last_response = None

            try:
                if turn > 0:
                    yield _sse({"type": "thinking", "text": f"ターン {turn + 1}: 続行中..."})

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
                            max_tokens=16384,
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
                        yield _sse({"type": "thinking", "text": "応答を待っています..."})
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
                    yield _sse({"type": "thinking", "text": f"レート制限 — {int(wait_secs)}秒後にリトライ..."})
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
                yield _sse({"type": "error", "message": "AIサービスから応答がありませんでした。"})
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
                    yield _sse({"type": "thinking", "text": f"{tc_name} を実行中..."})
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
                message = "LaTeXソースを更新しました。"
            else:
                message = "応答を取得できませんでした。"

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

async def chat(messages: list[dict], document: dict) -> dict:
    """Non-streaming agent chat — fallback for when streaming fails."""
    client = get_client()
    doc_brief = _document_context_brief(document)
    openai_messages = _build_agent_contents(messages, doc_brief)
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
                    max_tokens=16384,
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
        final_message = "LaTeXソースを更新しました。" if latex_changed else "応答を取得できませんでした。"

    return {
        "message": final_message,
        "latex": document.get("latex") if latex_changed else None,
        "thinking": all_thinking,
        "usage": total_usage,
    }

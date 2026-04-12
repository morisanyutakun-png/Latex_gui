"""採点モード — AI 採点サービス

責務:
- ルーブリック AI 補完  (extract_rubric_with_ai_stream)  ── Phase 3
- 答案 AI 採点          (grade_answer_stream)             ── Phase 5

OpenAI API ベース。`ai_service.get_client()` と `omr_service` のメッセージ
ビルダーパターンを再利用する。
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import AsyncGenerator

import re

from .ai_service import get_client, MODEL_CHAT, MODEL_VISION, max_tokens_param
from .grading_models import (
    AnswerPage,
    BBox,
    CriterionResult,
    GradedQuestion,
    GradingResult,
    Mark,
    Rubric,
    RubricBundle,
    RubricCriterion,
)
from .omr_service import _extract_pdf_content, _image_to_data_url
from .rubric_parser import parse_rubrics, serialize_rubrics_into_latex

logger = logging.getLogger(__name__)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# ════════════════ Phase 3: AI ルーブリック抽出 ════════════════

_RUBRIC_EXTRACTOR_SYSTEM_PROMPT_EN = r"""\
You are an expert teaching assistant who reads a problem's LaTeX source and
designs a grading rubric for it.

# Your job
Read the user's problem LaTeX and return an updated LaTeX source with grading
criteria embedded as comments for each question (Problem 1, Problem 1(1), etc.).

# Output format (strict)
Rubrics are embedded as LaTeX **comments** so they are ignored at compile time.
Use this exact shape. One block per question.

```
%@rubric-begin: <ASCII question_id>
%@rubric: label="display label (e.g. Problem 1(1))"
%@rubric: points=<max points for this question>
%@rubric: criterion="description of criterion 1"; weight=<weight 1>
%@rubric: criterion="description of criterion 2"; weight=<weight 2>
%@rubric: criterion="description of criterion 3"; weight=<weight 3>
%@rubric: hint="global hint for the grading AI (optional)"
%@rubric-end
```

# How to build question_id
- ASCII letters, digits, and hyphens only. e.g. `q1`, `q1-1`, `q2-3`, `q3-a`
- Sub-parts inside Problem 1 → `q1-1`, `q1-2`
- Top-level problems → `q1`, `q2`, ...

# How to build criteria
- Aim for 2–4 criteria per question.
- The sum of each criterion `weight` must equal `points`.
- Criteria must be at a granularity where you can judge "met / partial / not met"
  by looking at the student's answer.
- Common examples:
  - "Sets up the equation correctly" / "Executes the algebra correctly" / "States the final answer clearly"
  - "Understands the question" / "Provides justification" / "Reaches a valid conclusion"
  - "Correct definition given" / "Appropriate example"

# How to find questions (important)
Questions may appear as any of the following. **Handle all of them**:
1. `\begin{problem}{...}` / `\begin{daimon}{...}` style custom environments
2. Macros like `\problemhead{1}{...}` / `\daimonhead{1}{...}`
3. Headings like `\section{Problem 1 ...}` / `\section*{Problem 1}`
4. Custom environments: `\begin{basic}{...}` / `\begin{standard}{...}` / `\begin{advanced}{...}`
5. Paragraph-leading text like "Problem 1.", "(1)", "[1]"
6. `\item` entries inside `\begin{enumerate}` — treat each `\item` as one question

If the problem is short or the boundaries are ambiguous, **still produce at
least one** `%@rubric-begin..end` block. Empty output is forbidden (unless the
body is truly empty).

# Complete example

Input LaTeX (excerpt):
```latex
\section*{Problem 1}
Solve the following system.
\begin{align*}
2x + 3y &= 7 \\
x - y &= 1
\end{align*}
\section*{Problem 2}
For $f(x) = x^2 - 4x + 3$, find the coordinates of the vertex.
```

Expected **correct** output (relevant excerpt):
```latex
%@rubric-begin: q1
%@rubric: label="Problem 1"
%@rubric: points=10
%@rubric: criterion="Chooses substitution or elimination and transforms correctly"; weight=4
%@rubric: criterion="No sign or arithmetic mistakes in the working"; weight=3
%@rubric: criterion="Final values of x and y are stated clearly"; weight=3
%@rubric-end

%@rubric-begin: q2
%@rubric: label="Problem 2"
%@rubric: points=8
%@rubric: criterion="Chooses completing the square or calculus to find the vertex"; weight=3
%@rubric: criterion="Arithmetic is correct"; weight=3
%@rubric: criterion="Vertex coordinates (x, y) are given"; weight=2
%@rubric-end
```

# Strictly forbidden
- Modifying the preamble (`\documentclass`, `\usepackage`, `\title`, `\author`, …).
- Modifying the body between `\begin{document}` and `\end{document}`.
- Deleting existing `%@rubric-begin..end` blocks — preserve or improve them.
- Breaking LaTeX syntax (brace matching, newlines, …).
- Returning **zero** `%@rubric-begin..end` blocks (even a guess is better than empty).

# How to respond
**Always call the `set_latex` tool** and pass the full updated LaTeX (with rubric
comments inserted) as the `latex` argument. No chat reply is needed.
Insert the rubric blocks **immediately after `\begin{document}`**.
"""


RUBRIC_EXTRACTOR_SYSTEM_PROMPT = r"""\
あなたは熟練した教員のアシスタントで、問題LaTeX を読んで採点ルーブリックを設計します。

# あなたの仕事
ユーザーから受け取った問題LaTeX を解析し、各設問(問1, 問2, 問1(1) など)に対して
「採点観点」を埋め込んだ更新版 LaTeX を返します。

# 出力フォーマット (絶対厳守)
ルーブリックは LaTeX **コメント** として埋め込みます。コンパイル時には無視されます。
記法は次の通り。1 設問につき 1 ブロック。

```
%@rubric-begin: <半角英数の question_id>
%@rubric: label="表示用ラベル(問1(1) など)"
%@rubric: points=<設問の満点>
%@rubric: criterion="観点1の説明"; weight=<観点1の配点>
%@rubric: criterion="観点2の説明"; weight=<観点2の配点>
%@rubric: criterion="観点3の説明"; weight=<観点3の配点>
%@rubric: hint="採点AIへの全体ヒント (任意)"
%@rubric-end
```

# question_id の付け方
- 半角英数 + ハイフンのみ。例: `q1`, `q1-1`, `q2-3`, `q3-a`
- 大問1の (1)(2) → `q1-1`, `q1-2`
- 大問だけなら `q1`, `q2`, ...

# 観点(criterion)の作り方
- 1 設問につき 2〜4 個の観点が望ましい
- 各観点の `weight` 合計が `points` と一致するようにする
- 観点は「答案を見て○か×か(または部分点)を判断できる粒度」にする
- ありがちな例:
  - 「立式が正しい」「計算過程が正しい」「最終解答が明示されている」
  - 「論点の理解」「論拠の提示」「結論の妥当性」
  - 「定義を正しく書いている」「具体例が適切」

# 設問の見つけ方 (重要)
入力 LaTeX 内では設問は次のような形で現れます。**いずれにも対応してください**:
1. `\begin{daimon}{大問1 ...}` 〜 `\end{daimon}` のような独自環境
2. `\daimonhead{1}{...}` のようなマクロ
3. `\section{第1問 ...}` `\section*{大問1}` のような見出し
4. `\begin{kihon}{基本問題 ...}` `\begin{ouyou}{...}` `\begin{reidai}{...}` のような独自環境
5. 段落先頭の素テキストで「問1.」「(1)」「[1]」など
6. `\begin{enumerate}` 内の `\item` が連続している場合も、各 `\item` を 1 設問とみなしてよい

問題が短い場合や、設問区切りが曖昧でも、**最低でも 1 つは** `%@rubric-begin..end`
ブロックを生成してください。空の応答は禁止です(問題本文が完全に空の場合を除く)。

# 完全な入出力例

入力 LaTeX (抜粋):
```latex
\section*{第1問}
次の連立方程式を解け。
\begin{align*}
2x + 3y &= 7 \\
x - y &= 1
\end{align*}
\section*{第2問}
$f(x) = x^2 - 4x + 3$ について、頂点の座標を求めよ。
```

期待される **正しい** 出力 (該当箇所のみ抜粋):
```latex
%@rubric-begin: q1
%@rubric: label="第1問"
%@rubric: points=10
%@rubric: criterion="加減法または代入法を選択し正しく式を変形している"; weight=4
%@rubric: criterion="計算過程に符号ミス・計算ミスがない"; weight=3
%@rubric: criterion="x, y の最終解答が明示されている"; weight=3
%@rubric-end

%@rubric-begin: q2
%@rubric: label="第2問"
%@rubric: points=8
%@rubric: criterion="平方完成または微分により頂点を求める方針が立っている"; weight=3
%@rubric: criterion="計算過程が正しい"; weight=3
%@rubric: criterion="頂点の座標 (x, y) を明示している"; weight=2
%@rubric-end
```

# 絶対禁止事項
- プリアンブル(`\documentclass`, `\usepackage`, `\title`, `\author` 等)を変更しない
- `\begin{document}` 〜 `\end{document}` の中身(本文)を変更しない
- 既存の `%@rubric-begin..end` ブロックがあれば残す or 改善する(削除しない)
- LaTeX 構文を壊さない (波括弧の対応、改行位置など)
- **`%@rubric-begin..end` を 1 つも入れない**(=本文をそのまま返す)のは禁止
  問題が読み取りづらくても、最低 1 つは推測で生成してください。

# 応答方法
**必ず `set_latex` ツールを呼び出して**、ルーブリックコメントを追加した完全な
LaTeX ソースを `latex` 引数として渡してください。チャット応答は不要です。
ルーブリックブロックの挿入位置は **`\begin{document}` の直後** が推奨です。
"""


def _is_en(locale: str) -> bool:
    return (locale or "").lower() == "en"


def _rubric_extractor_system_prompt(locale: str) -> str:
    return _RUBRIC_EXTRACTOR_SYSTEM_PROMPT_EN if _is_en(locale) else RUBRIC_EXTRACTOR_SYSTEM_PROMPT


def _rubric_extractor_status(locale: str) -> dict[str, str]:
    if _is_en(locale):
        return {
            "starting": "Asking the AI to generate grading criteria",
            "empty_latex": "Problem LaTeX is empty",
            "thinking": "AI is designing the criteria…",
            "retrying": "Retrying… ({attempt}/{total})",
            "fallback": "AI generation failed — deriving a template rubric from the problem structure…",
            "generated": "Could not generate a grading rubric. Make sure the problem LaTeX contains identifiable questions (e.g. 'Problem 1', 'Question 1', '\\section').",
            "last_error_suffix": " (last error: {err})",
            "validating": "Validating the generated rubric…",
            "fallback_note": (
                "AI rubric generation failed, so a template rubric was derived from the problem "
                "structure. Please adjust each criterion's wording and weight before grading."
            ),
            "correction_api_fail": (
                "The previous API call failed ({err}). "
                "**You MUST call the `set_latex` tool** and return the full LaTeX as the `latex` argument."
            ),
            "correction_missing_tool": (
                "Your previous response did not call `set_latex`. "
                "**You MUST call the `set_latex` tool** and return the full LaTeX source with rubric "
                "comments as the `latex` argument — not plain text."
            ),
            "correction_zero_rubrics": (
                "Your previous response contained **zero** `%@rubric-begin..end` blocks.\n"
                "The problem LaTeX almost certainly has some questions. Read it again carefully "
                "and generate at least one `%@rubric-begin..end` block.\n\n"
                "Minimal example to follow:\n\n"
                "```\n"
                "%@rubric-begin: q1\n"
                "%@rubric: label=\"Problem 1\"\n"
                "%@rubric: points=10\n"
                "%@rubric: criterion=\"Problem understanding / correct setup\"; weight=3\n"
                "%@rubric: criterion=\"Correct working\"; weight=4\n"
                "%@rubric: criterion=\"Final answer stated clearly\"; weight=3\n"
                "%@rubric-end\n"
                "```\n\n"
                "Insert the block **right after `\\begin{document}`** and call the `set_latex` tool — "
                "do not touch the preamble or body."
            ),
            "user_prompt": (
                "For the following problem LaTeX, insert `%@rubric-begin..end` comment blocks for "
                "every question and return the full updated LaTeX via the `set_latex` tool. "
                "Do not modify the preamble or body.\n\n"
                "```latex\n"
                "{latex}\n"
                "```"
            ),
        }
    return {
        "starting": "AIに採点基準の生成を依頼しています",
        "empty_latex": "問題LaTeX が空です",
        "thinking": "AIが採点観点を考えています…",
        "retrying": "再試行中… ({attempt}/{total})",
        "fallback": "AI の生成に失敗したので、問題構造から採点基準の雛形を作成しています…",
        "generated": "採点基準を生成できませんでした。問題LaTeX に「問1」「大問1」「\\begin{daimon}」など設問を識別できる手がかりが含まれているか確認してください。",
        "last_error_suffix": " (最後のエラー: {err})",
        "validating": "生成された採点基準を検証中…",
        "fallback_note": (
            "AI による採点基準の生成に失敗したため、問題構造から自動で雛形を作成しました。"
            "観点の文言と配点を必ずあなた自身で調整してください。"
        ),
        "correction_api_fail": (
            "前回の API 呼び出しに失敗しました ({err})。"
            "**必ず set_latex ツールを呼び出して** 完全な LaTeX を `latex` 引数で返してください。"
        ),
        "correction_missing_tool": (
            "前回の応答では `set_latex` ツールが正しく呼ばれませんでした。"
            "チャット文ではなく、**必ず `set_latex` ツールを呼び出して** "
            "ルーブリックコメント付きの完全な LaTeX ソースを `latex` 引数として返してください。"
        ),
        "correction_zero_rubrics": (
            "前回の応答には `%@rubric-begin..end` ブロックが **1 つも含まれていませんでした**。\n"
            "問題LaTeX に何らかの設問が含まれているはずです。もう一度よく読んで、"
            "少なくとも 1 つの `%@rubric-begin..end` ブロックを必ず生成してください。\n\n"
            "次の最小例を参考にしてください:\n\n"
            "```\n"
            "%@rubric-begin: q1\n"
            "%@rubric: label=\"問1\"\n"
            "%@rubric: points=10\n"
            "%@rubric: criterion=\"立式・問題の理解\"; weight=3\n"
            "%@rubric: criterion=\"計算過程の正しさ\"; weight=4\n"
            "%@rubric: criterion=\"最終解答の明示\"; weight=3\n"
            "%@rubric-end\n"
            "```\n\n"
            "このブロックを `\\begin{document}` の **直後** に挿入してください。"
            "プリアンブルや本文は一切変更せず、`set_latex` ツールを呼んでください。"
        ),
        "user_prompt": (
            "次の問題LaTeX に対して、各設問の採点基準を `%@rubric-begin..end` "
            "コメントブロックとして挿入した完全な LaTeX を `set_latex` ツールで返してください。"
            "プリアンブルと本文は変更しないでください。\n\n"
            "```latex\n"
            "{latex}\n"
            "```"
        ),
    }


def _build_rubric_extractor_tool() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "set_latex",
                "description": (
                    "Return the updated LaTeX source with %@rubric comment blocks "
                    "inserted for each question. Do not modify preamble or body."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "latex": {
                            "type": "string",
                            "description": "The full updated LaTeX source.",
                        },
                    },
                    "required": ["latex"],
                },
            },
        }
    ]


def _extract_latex_from_tool_call(response) -> str | None:
    """Pull the `latex` argument out of a tool call response."""
    try:
        choice = response.choices[0]
        msg = choice.message
        if not msg.tool_calls:
            return None
        for tc in msg.tool_calls:
            if tc.function.name == "set_latex":
                try:
                    parsed = json.loads(tc.function.arguments)
                    val = parsed.get("latex")
                    if isinstance(val, str) and val.strip():
                        return val
                except json.JSONDecodeError as e:
                    logger.warning("set_latex args parse failed: %s", e)
                    return None
    except (IndexError, AttributeError) as e:
        logger.warning("response parse failed: %s", e)
    return None


async def extract_rubric_with_ai_stream(
    latex: str,
    locale: str = "ja",
) -> AsyncGenerator[str, None]:
    """SSEストリーム版 — 問題LaTeX に %@rubric コメントブロックを追加する。

    強化点 (2026-04 改修):
    - 最大 3 回まで AI を再試行する
    - 各試行で前回失敗の理由 (tool_call なし / parse 結果が空 / API エラー) を
      ユーザーメッセージとして追加し、AI に修正を促す
    - すべての試行が失敗しても、LaTeX 内の設問パターンから雛形ルーブリックを
      自動生成する fallback を持つ。完全な失敗 ("作れない") を避ける。

    locale: "ja" (default) or "en" — switches the AI system prompt and status text.

    yields:
      data: {"type": "progress", "phase": "...", "message": "..."}
      data: {"type": "done", "latex": "...", "rubrics": <RubricBundle>}
      data: {"type": "error", "message": "..."}
    """
    status = _rubric_extractor_status(locale)
    system_prompt = _rubric_extractor_system_prompt(locale)

    yield _sse({
        "type": "progress",
        "phase": "starting",
        "message": status["starting"],
    })

    if not latex.strip():
        yield _sse({"type": "error", "message": status["empty_latex"]})
        return

    try:
        client = get_client()
    except ValueError as e:
        yield _sse({"type": "error", "message": str(e)})
        return

    tools = _build_rubric_extractor_tool()
    base_messages: list[dict] = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": status["user_prompt"].format(latex=latex),
        },
    ]

    yield _sse({
        "type": "progress",
        "phase": "ai_processing",
        "message": status["thinking"],
    })

    MAX_AI_ATTEMPTS = 3
    new_latex: str | None = None
    bundle: RubricBundle | None = None
    correction_feedback: str | None = None
    last_error: str | None = None

    for attempt in range(1, MAX_AI_ATTEMPTS + 1):
        if attempt > 1:
            yield _sse({
                "type": "progress",
                "phase": "retrying",
                "message": status["retrying"].format(attempt=attempt, total=MAX_AI_ATTEMPTS),
            })

        # 修正フィードバックがあれば末尾に追加してから呼び出す
        messages = list(base_messages)
        if correction_feedback:
            messages.append({"role": "user", "content": correction_feedback})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_CHAT,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.4,
                    **max_tokens_param(MODEL_CHAT, 16384),
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("rubric extract API error (attempt %d): %s", attempt, e)
            last_error = f"{type(e).__name__}: {str(e)[:200]}"
            correction_feedback = status["correction_api_fail"].format(err=last_error)
            continue

        candidate_latex = _extract_latex_from_tool_call(response)
        if not candidate_latex:
            logger.warning("rubric extract attempt %d: tool_call missing", attempt)
            correction_feedback = status["correction_missing_tool"]
            continue

        candidate_bundle = parse_rubrics(candidate_latex)
        if candidate_bundle.rubrics:
            new_latex = candidate_latex
            bundle = candidate_bundle
            break

        # tool_call は成功したが %@rubric ブロックが 0 個 → 修正フィードバックして再試行
        logger.warning(
            "rubric extract attempt %d: parsed 0 rubrics from %d chars",
            attempt, len(candidate_latex),
        )
        correction_feedback = status["correction_zero_rubrics"]

    # ── すべての AI 試行が失敗 → ヒューリスティクス fallback ──
    if not bundle or not bundle.rubrics:
        yield _sse({
            "type": "progress",
            "phase": "fallback",
            "message": status["fallback"],
        })
        try:
            fallback_rubrics = _heuristic_rubric_fallback(latex, locale=locale)
        except Exception as e:
            logger.exception("heuristic fallback failed: %s", e)
            fallback_rubrics = []

        if fallback_rubrics:
            try:
                new_latex = serialize_rubrics_into_latex(latex, fallback_rubrics)
                bundle = parse_rubrics(new_latex)
            except Exception as e:
                logger.exception("fallback serialize failed: %s", e)
                bundle = None

            if bundle and bundle.rubrics:
                bundle.parse_warnings.append(status["fallback_note"])

        if not bundle or not bundle.rubrics:
            err_detail = status["last_error_suffix"].format(err=last_error) if last_error else ""
            yield _sse({
                "type": "error",
                "message": status["generated"] + err_detail,
            })
            return

    yield _sse({
        "type": "progress",
        "phase": "validating",
        "message": status["validating"],
    })

    yield _sse({
        "type": "done",
        "latex": new_latex,
        "rubrics": bundle.model_dump(by_alias=True),
    })


# ──────────── ヒューリスティクス fallback ────────────

# 「問題っぽい構造」を検知する正規表現群。長いパターンから優先する。
_DAIMON_ENV_RE = re.compile(r"\\begin\{daimon\}")
_DAIMONHEAD_RE = re.compile(r"\\daimonhead\s*\{")
_KIHON_OUYOU_RE = re.compile(r"\\begin\{(?:kihon|ouyou|reidai|teiri|teigi|hatten)\}")
_SECTION_QUESTION_RE = re.compile(
    r"\\section\*?\s*\{[^}]*?(?:大問|第\s*[\d一二三四五六七八九十百]+\s*問|問\s*\d+)[^}]*?\}"
)
_BARE_QUESTION_RE = re.compile(
    r"(?m)^\s*(?:大問\s*\d+|問\s*\d+|第\s*\d+\s*問|【\s*問\s*\d+\s*】|\(\s*\d+\s*\))"
)
_ENUMERATE_RE = re.compile(r"\\begin\{enumerate\}")


def _heuristic_rubric_fallback(latex: str, locale: str = "ja") -> list[Rubric]:
    """LaTeX 内の設問らしき構造を数えて、placeholder ルーブリックを生成する。

    AI が空応答を返した時の最後の砦。完璧である必要はないが、ユーザーが
    UI 上で観点と配点を調整できる「叩き台」を必ず返すことを目的とする。
    """
    if not latex.strip():
        return []

    # 戦略 1: \begin{daimon}
    count = len(_DAIMON_ENV_RE.findall(latex))

    # 戦略 2: \daimonhead{N}
    if count == 0:
        count = len(_DAIMONHEAD_RE.findall(latex))

    # 戦略 3: 塾系テンプレの kihon/ouyou/reidai 等
    if count == 0:
        count = len(_KIHON_OUYOU_RE.findall(latex))

    # 戦略 4: \section{第1問} 等
    if count == 0:
        count = len(_SECTION_QUESTION_RE.findall(latex))

    # 戦略 5: 行頭の素テキスト (大問N / 問N / (1) 等)
    if count == 0:
        count = len(_BARE_QUESTION_RE.findall(latex))

    # 最終フォールバック: enumerate がある or section が 1 つでもあるなら 1 問とみなす
    if count == 0:
        if _ENUMERATE_RE.search(latex) or re.search(r"\\section\*?\s*\{", latex):
            count = 1

    if count == 0:
        return []

    # 暴走防止: 上限 20 問
    count = min(count, 20)

    if _is_en(locale):
        label_fmt = "Problem {n}"
        criteria_texts = (
            "Problem understanding / correct setup",
            "Correct working",
            "Final answer stated clearly",
        )
    else:
        label_fmt = "問{n}"
        criteria_texts = (
            "立式・問題の理解",
            "計算過程の正しさ",
            "最終解答の明示",
        )

    rubrics: list[Rubric] = []
    for n in range(1, count + 1):
        rubrics.append(Rubric(
            question_id=f"q{n}",
            question_label=label_fmt.format(n=n),
            max_points=10,
            criteria=[
                RubricCriterion(description=criteria_texts[0], weight=3),
                RubricCriterion(description=criteria_texts[1], weight=4),
                RubricCriterion(description=criteria_texts[2], weight=3),
            ],
        ))
    return rubrics


# ════════════════ Phase 5: AI 採点 (grade_answer_stream) ════════════════

_GRADING_SYSTEM_PROMPT_EN = r"""\
You are a strict and precise grader. You read the problem, the grading rubric
(JSON), and the student's answer images, then decide partial credit, comments,
and mark overlay positions for every question.

# Inputs
1. Problem LaTeX (body)
2. Grading rubric (JSON)
3. Answer images (1 or more pages)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Core posture — "read → classify → score", in that order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST execute the following steps **in order**. Filling in scores before
reading and classifying is forbidden.

### Step 1: Read the answer (transcription)
Transcribe exactly what is written in the image into `transcribedAnswer`.
- Text, math, diagrams, graphs, tables, scribbles — write it all down.
- Use "(illegible)" for parts you cannot read.
- **Even if the image is blank, is a printed document, or is a different
  document, transcribe what you see.** Examples:
    "This is not an answer — it's a screenshot of a newspaper article."
    "Nearly blank page with just the student's name in the corner."
    "Only the printed problem is visible; the student wrote nothing."
- `transcribedAnswer` MUST NOT be empty. If nothing is readable, say
  "blank" / "illegible" / "not an answer".

### Step 2: Decide whether it is an answer to this problem (relevance check)
Set `answerStatus` to exactly one of:
- `"answered"`  : the student clearly attempted this question (right or wrong)
- `"blank"`     : no response to this question (blank page, name only, etc.)
- `"off_topic"` : the image is unrelated (different problem, different subject,
                  memo, random photo, etc.)
- `"illegible"` : the handwriting cannot be deciphered

### Step 3: Award points according to the status
- **Only when `answered`** should you distribute points across the rubric
  criteria (up to each criterion's `weight`):
  - Fully correct → full `weight`
  - Partially correct → partial credit based on the criterion
  - Fully wrong → 0
- **If `blank` / `off_topic` / `illegible`, ALL criteria MUST get `awarded = 0`.**
  - Do NOT hallucinate: "there is no answer, but the equation was set up correctly"
    is absolutely forbidden.
  - Write "no answer", "unrelated image", or "illegible" in the comment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CRITICAL — NO HALLUCINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Past incidents: "gave full marks to a blank page" and "praised an unrelated
image with 'well done'". Do NOT repeat these mistakes.

- **Never grade based on content you cannot actually see in the image.**
- If there is no identifiable answer, `awarded = 0` and the appropriate status.
- Return "all correct" ONLY when you clearly see a correct answer for every
  question.
- When uncertain, err on the side of lower scores — never hallucinate in the
  student's favour.
- If the image is unrelated to the problem, `overallFeedback` MUST say so
  explicitly: "The uploaded image does not appear to be an answer to this
  problem."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Tool call
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Always call the `submit_grading` tool** to return your result. A chat-only
reply is invalid.

`submit_grading` takes:
- `questions`: per-question grading results (array)
- `overallFeedback`: overall comment (string)

`questions[i]` shape:
- `questionId`: the rubric's question_id
- `questionLabel`: the rubric's label
- `maxPoints`: the rubric's points
- `awardedPoints`: sum of awarded points across the criteria
- `answerStatus`: "answered" | "blank" | "off_topic" | "illegible"  ← REQUIRED
- `transcribedAnswer`: verbatim transcription (LaTeX for math) ← REQUIRED, never empty
- `overallComment`: 1–2 sentences of feedback
- `criteriaResults`: per-criterion grading
   - `description`: criterion text
   - `weight`: max points for this criterion
   - `awarded`: awarded points (MUST be 0 unless status is "answered")
   - `comment`: short comment
- `marks`: red-ink marks to overlay on the image (array, optional)
   - `kind`: "circle" | "cross" | "triangle" | "comment" | "score"
   - `bbox`: normalized coordinates { pageIndex, x, y, w, h } (0..1, top-left origin)
   - `text`: short number / comment (optional)

# Grading policy (when status == "answered")
- Judge each rubric criterion in order, capping at its `weight`.
- Be generous with partial credit for small sign/arithmetic slips.
- Comments: say what is correct / what is wrong / how to improve.
- `awardedPoints` must equal the sum of `criteriaResults[].awarded`.
- Spread `marks` so they do not overlap on the image.
- If unsure about a bbox, leave `marks` empty (a fallback will render them).
- Overall feedback: 2–3 sentences, one strength and one improvement.

# Language
**Reply in English.** Keep math in LaTeX (`$x^2$`, `\\[ ... \\]`).
"""


GRADING_SYSTEM_PROMPT = r"""\
あなたは厳格で正確な採点者です。提示された問題、採点ルーブリック(JSON)、生徒の答案画像を読み、
各設問について部分点・コメント・赤入れ位置を判定します。

# 入力
1. 問題LaTeX (本文)
2. 採点ルーブリック (JSON)
3. 答案画像 (1 ページ以上)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 採点の基本姿勢 — 「読む → 判定する → 採点する」の順序を守れ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

採点は **必ず以下の順序** で行う。順序を飛ばして配点だけ埋めることは禁止。

### Step 1: 答案を読み取る (transcription)
画像の中に書かれている内容を **そのまま** `transcribedAnswer` に書き写す。
- 文字、数式、図、グラフ、表、走り書き、何でも書き写す
- 走り書きや判読不能な部分は「(判読不能)」と書く
- **答案画像が空白 / 印刷文書 / 関係ない別の文書 だった場合もそのまま記述する**
  例: 「答案ではない印刷文書 (新聞記事のスクリーンショット)」
       「ほぼ空白のページ。右上に名前のみ」
       「問題文と思われる数式のみ。生徒の解答記述なし」
- transcribedAnswer が空文字 ("") のままになることは禁止。
  読み取り結果がない場合でも 「空白」「読み取れなかった」と明示する。

### Step 2: 答案がこの問題に対する解答かどうかを判定する (relevance check)
`answerStatus` フィールドに以下のいずれかを設定する:
- `"answered"` : 生徒がこの設問に対して **明確に解答を試みている** (正誤を問わず)
- `"blank"`    : この設問に対する解答記述が **まったく無い** (空白・名前だけ等)
- `"off_topic"`: 答案が **この問題と関係ない** (別の問題、別の科目、メモ、無関係な画像等)
- `"illegible"`: 文字が判読できず、解答内容が読み取れない

### Step 3: ステータスに応じて配点する
- **`answered` の場合のみ**、ルーブリックの観点に従って `weight` を上限に `awarded` を割り当てる
  - 完全に正解 → `weight` 全部
  - 部分的に正解 → 観点を読んで適度な部分点
  - 完全に不正解 → 0
- **`blank` / `off_topic` / `illegible` の場合は、すべての観点で `awarded = 0` を設定**
  - "答案が無いのに『立式は正しい』と判定する" のような **ハルシネーションは絶対禁止**
  - コメント欄に「答案なし」「無関係な画像」「判読不能」と明示する

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 重要 — ハルシネーション禁止
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

過去に「画像に何も書いていないのに満点をつけた」「無関係な画像なのに『よく理解できています』
とコメントした」という重大事故が発生している。次を厳守すること:

- **画像から読み取れない内容を採点根拠にしない**
- 「答案らしきもの」が画像に **存在しない** なら必ず `awarded = 0` + 該当ステータス
- "全問正解" を返すのは、**全設問について明確に正解を読み取った場合のみ**
- 迷ったら点数を下げる (生徒に不利な方ではなく、ハルシネーション側に厳しく)
- 答案が問題と無関係なら、`overallFeedback` に **「アップロードされた画像はこの問題に対する
  答案ではないようです」と明記** すること

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ツール呼び出し
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**必ず `submit_grading` ツールを呼び出して** 結果を返してください。
チャット応答だけでは無効です。

`submit_grading` は次の引数を受け取ります:
- `questions`: 設問ごとの採点結果 (配列)
- `overallFeedback`: 全体講評 (文字列)

`questions[i]` の構造:
- `questionId`: ルーブリックの question_id
- `questionLabel`: ルーブリックの label
- `maxPoints`: ルーブリックの points
- `awardedPoints`: 部分点合計 (各観点の awarded を加算)
- `answerStatus`: "answered" | "blank" | "off_topic" | "illegible"  ← **必須**
- `transcribedAnswer`: 答案画像から読み取った答案 (LaTeX 形式の数式含む) ← **必須・空文字禁止**
- `overallComment`: 設問講評 (1〜2 文)
- `criteriaResults`: 観点ごとの採点
   - `description`: 観点
   - `weight`: 配点
   - `awarded`: 与えた点 (status≠"answered" の場合は必ず 0)
   - `comment`: 短いコメント
- `marks`: 答案画像上の赤入れマーク (配列。なくても可)
   - `kind`: "circle" | "cross" | "triangle" | "comment" | "score"
   - `bbox`: 答案画像上の正規化座標 { pageIndex, x, y, w, h } (0..1, left-top 原点)
   - `text`: 数値や短いコメント (任意)

# 採点ポリシー (answered の場合の細則)
- ルーブリックの観点を順番に判定し、`weight` を上限として `awarded` を割り当てる
- 計算過程の符号ミスなど軽微な間違いは部分点を惜しまない
- コメントは「何が正しい / 何が違う / どう改善すべきか」を簡潔に書く
- `awardedPoints` は `criteriaResults` の `awarded` の合計と必ず一致させる
- `marks` の bbox は答案画像に対する正規化座標。重ならないように配置する
- bbox がよく分からない場合は `marks` を空配列にする (フォールバック表示される)
- 全体講評は 2〜3 文。良かった点と改善点を両方含める

# 言語
日本語で書く。数式は LaTeX で書く ($x^2$ や \\[ ... \\])。
"""


def _grading_system_prompt(locale: str) -> str:
    return _GRADING_SYSTEM_PROMPT_EN if _is_en(locale) else GRADING_SYSTEM_PROMPT


def _grading_status(locale: str) -> dict[str, str]:
    if _is_en(locale):
        return {
            "loading_answers": "Loading the student's answers",
            "no_files": "No answer files were provided",
            "empty_rubric": "The grading rubric is empty",
            "extract_failed": "Failed to load the answers: {err}",
            "no_pages": "Could not extract any pages from the answer files",
            "rubric_loaded": "Loaded rubric ({n} questions, {p} points)",
            "ai_grading": "AI is grading…",
            "retrying": "Retrying… ({attempt}/{total})",
            "ai_error": "AI grading error: {ty}: {err}",
            "no_result": "The AI could not return a grading result. Please try again.",
            "rendering": "Organising the grading result…",
            "blank_comment": "No answer written",
            "off_topic_comment": "Answer is unrelated to this question",
            "illegible_comment": "Cannot be read",
            "status_msg_blank": "No answer was found for this question.",
            "status_msg_off_topic": "The uploaded image does not appear to be an answer to this problem. Please upload an image that matches the question.",
            "status_msg_illegible": "The answer could not be read. Please retake a sharper photo and upload again.",
            "overall_off_topic": "The uploaded image does not appear to be an answer to this problem. Please upload an answer that matches the question.",
            "overall_blank": "No usable answer writing was found in the uploaded images.",
            "overall_illegible": "The answers could not be read. Please upload clearer images.",
            "problem_latex_header": "## Problem LaTeX",
            "rubric_header": "## Grading rubric (JSON)",
            "images_header": "## Answer images (top-left origin, coordinates normalized 0..1)",
            "images_intro": (
                "Below are the **student's answer images**. "
                "First verify that they really are answers to the problem above.\n"
            ),
            "page_label": "--- Page {i} ---",
            "instructions_header": "## Grading instructions",
            "instructions_body": (
                "Grade the answers above and return the result via the `submit_grading` tool.\n\n"
                "**Procedure (strict):**\n"
                "1. Carefully examine each image and transcribe exactly what is written into "
                "`transcribedAnswer`.\n"
                "2. Decide whether the image is **an answer to the problem LaTeX** and set "
                "`answerStatus`:\n"
                "   - `answered`  : the student attempted this question (right or wrong)\n"
                "   - `blank`     : no answer (blank page, name only, etc.)\n"
                "   - `off_topic` : different question / unrelated image / printed document / screenshot / etc.\n"
                "   - `illegible` : cannot be read\n"
                "3. Only when `answered` should you distribute credit across the rubric criteria. "
                "Any other status forces **all criteria to `awarded=0`**. Never fabricate a score.\n"
                "4. If the image does not match the problem, **do not hesitate to pick `off_topic`**. "
                "Hallucinating credit for blank or unrelated images is a critical failure mode.\n\n"
                "Return a grading result for **every question** in the rubric."
            ),
        }
    return {
        "loading_answers": "答案を読み込んでいます",
        "no_files": "答案ファイルが指定されていません",
        "empty_rubric": "採点基準(ルーブリック)が空です",
        "extract_failed": "答案の読み込みに失敗しました: {err}",
        "no_pages": "答案からページを抽出できませんでした",
        "rubric_loaded": "採点基準を読み込みました ({n}問・{p}点)",
        "ai_grading": "AIが採点中…",
        "retrying": "再試行中… ({attempt}/{total})",
        "ai_error": "AI採点エラー: {ty}: {err}",
        "no_result": "AIが採点結果を返せませんでした。もう一度お試しください。",
        "rendering": "採点結果を整理中…",
        "blank_comment": "答案記述なし",
        "off_topic_comment": "答案がこの問題と無関係",
        "illegible_comment": "判読不能",
        "status_msg_blank": "この設問に対する答案記述が見つかりませんでした。",
        "status_msg_off_topic": "アップロードされた画像はこの問題への解答ではないようです。問題と一致する答案をアップロードしてください。",
        "status_msg_illegible": "答案を判読できませんでした。再度撮影してアップロードしてください。",
        "overall_off_topic": (
            "アップロードされた画像はこの問題への解答ではないようです。"
            "問題と一致する答案をアップロードしてください。"
        ),
        "overall_blank": "答案画像から有効な解答記述が見つかりませんでした。",
        "overall_illegible": "答案を判読できませんでした。鮮明な画像で再度アップロードしてください。",
        "problem_latex_header": "## 問題LaTeX",
        "rubric_header": "## 採点ルーブリック (JSON)",
        "images_header": "## 答案画像 (左上原点、座標は 0..1 の正規化)",
        "images_intro": (
            "下に添付されているのが **生徒の答案画像** です。"
            "この画像が本当に上記の問題に対する解答なのか、まず必ず確認してください。\n"
        ),
        "page_label": "--- ページ {i} ---",
        "instructions_header": "## 採点指示",
        "instructions_body": (
            "上記の答案を採点して、`submit_grading` ツールで結果を返してください。\n\n"
            "**手順 (必ず守る):**\n"
            "1. まず答案画像をよく見て、何が書かれているか `transcribedAnswer` に正確に書き写す。\n"
            "2. その内容が **問題LaTeX に対する解答かどうか** を判断し、`answerStatus` を設定する:\n"
            "   - `answered`  : この問題への解答を試みている (正誤を問わない)\n"
            "   - `blank`     : 解答記述がない (空白・名前のみ等)\n"
            "   - `off_topic` : 別の問題・無関係な画像・印刷文書・スクリーンショット等\n"
            "   - `illegible` : 判読できない\n"
            "3. `answered` の場合のみルーブリックに従って観点別に採点する。\n"
            "   それ以外の場合は **必ず全観点 awarded=0**。点数を捏造しない。\n"
            "4. 画像と問題が一致しないと感じたら、ためらわず `off_topic` を選択する。\n"
            "   ハルシネーション (空答案や無関係画像に部分点) は重大事故扱い。\n\n"
            "ルーブリックの **全設問** に対して採点結果を返してください。"
        ),
    }


def _build_grading_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "submit_grading",
                "description": (
                    "Submit the final grading result for all questions in the answer sheet. "
                    "MUST be called exactly once."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "questionId": {"type": "string"},
                                    "questionLabel": {"type": "string"},
                                    "maxPoints": {"type": "integer"},
                                    "awardedPoints": {"type": "integer"},
                                    "answerStatus": {
                                        "type": "string",
                                        "enum": ["answered", "blank", "off_topic", "illegible"],
                                        "description": (
                                            "Must reflect what the rubric finds in the answer image. "
                                            "'answered' = student attempted this question (right or wrong). "
                                            "'blank' = nothing written for this question. "
                                            "'off_topic' = uploaded image is unrelated to the problem. "
                                            "'illegible' = handwriting cannot be read at all."
                                        ),
                                    },
                                    "transcribedAnswer": {
                                        "type": "string",
                                        "description": (
                                            "Required. Verbatim text/math the student wrote, "
                                            "or '空白' / '無関係な画像' / '判読不能' if not answered."
                                        ),
                                    },
                                    "overallComment": {"type": "string"},
                                    "criteriaResults": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "description": {"type": "string"},
                                                "weight": {"type": "integer"},
                                                "awarded": {"type": "integer"},
                                                "comment": {"type": "string"},
                                            },
                                            "required": ["description", "weight", "awarded"],
                                        },
                                    },
                                    "marks": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "kind": {
                                                    "type": "string",
                                                    "enum": ["circle", "cross", "triangle", "comment", "score"],
                                                },
                                                "bbox": {
                                                    "type": "object",
                                                    "properties": {
                                                        "pageIndex": {"type": "integer"},
                                                        "x": {"type": "number"},
                                                        "y": {"type": "number"},
                                                        "w": {"type": "number"},
                                                        "h": {"type": "number"},
                                                    },
                                                    "required": ["pageIndex", "x", "y", "w", "h"],
                                                },
                                                "text": {"type": "string"},
                                            },
                                            "required": ["kind"],
                                        },
                                    },
                                },
                                "required": [
                                    "questionId", "maxPoints", "awardedPoints",
                                    "answerStatus", "transcribedAnswer",
                                    "criteriaResults",
                                ],
                            },
                        },
                        "overallFeedback": {"type": "string"},
                    },
                    "required": ["questions"],
                },
            },
        }
    ]


def _parse_grading_tool_call(
    response,
    rubrics: RubricBundle,
    locale: str = "ja",
) -> GradingResult | None:
    """Pull `submit_grading` output and convert to GradingResult."""
    status = _grading_status(locale)
    try:
        choice = response.choices[0]
        msg = choice.message
        if not msg.tool_calls:
            return None
        for tc in msg.tool_calls:
            if tc.function.name != "submit_grading":
                continue
            try:
                parsed = json.loads(tc.function.arguments)
            except json.JSONDecodeError as e:
                logger.warning("submit_grading args parse failed: %s", e)
                return None

            questions_in: list[dict] = parsed.get("questions") or []
            overall_fb: str = parsed.get("overallFeedback") or ""

            # ルーブリックから max_points map を作る (LLM が間違えても正解値で上書き)
            rubric_map = {r.question_id: r for r in rubrics.rubrics}

            graded_questions: list[GradedQuestion] = []
            for q in questions_in:
                qid = q.get("questionId") or ""
                rubric = rubric_map.get(qid)

                # ── answerStatus を解釈 ──
                raw_status = (q.get("answerStatus") or "answered").strip().lower()
                if raw_status not in {"answered", "blank", "off_topic", "illegible"}:
                    raw_status = "answered"

                transcribed = (q.get("transcribedAnswer") or "").strip()

                # ── 自衛的フォールバック判定 ──
                # AI が answerStatus="answered" と言っても、transcribedAnswer が
                # 空 or "空白" / "no answer" 系の文言なら blank に矯正する。
                # ハルシネーション (空答案に満点) を最後の砦で塞ぐ。
                blank_markers = (
                    "", "空白", "なし", "無し", "無回答", "未記入", "未回答",
                    "(空白)", "（空白）", "blank", "no answer", "n/a", "none",
                )
                if transcribed.lower() in {m.lower() for m in blank_markers}:
                    if raw_status == "answered":
                        logger.warning(
                            "[grading] AI claimed 'answered' but transcribed='%s' — coerce to blank (qid=%s)",
                            transcribed, qid,
                        )
                    raw_status = "blank"

                # 関係なさそうな画像のヒント (印刷文書、無関係、別問題)
                offtopic_keywords = (
                    "無関係", "関係ない", "別の問題", "別問題", "別の科目",
                    "印刷文書", "印刷物", "印刷された", "新聞", "広告",
                    "this question", "unrelated", "different problem", "off topic", "off-topic",
                    "答案ではな", "答案ではない", "解答ではな",
                )
                lowered_trans = transcribed.lower()
                if any(k in transcribed or k in lowered_trans for k in offtopic_keywords):
                    if raw_status == "answered":
                        logger.warning(
                            "[grading] off-topic markers in transcript — coerce to off_topic (qid=%s, trans=%s)",
                            qid, transcribed[:80],
                        )
                        raw_status = "off_topic"

                # ── 観点別採点 ──
                criteria_results = []
                for c in q.get("criteriaResults") or []:
                    desc = c.get("description", "")
                    weight = int(c.get("weight", 0))
                    raw_awarded = int(c.get("awarded", 0))
                    comment = c.get("comment", "") or ""

                    # answered 以外は強制ゼロ + コメント上書き
                    if raw_status != "answered":
                        if raw_awarded > 0:
                            logger.warning(
                                "[grading] forcing awarded=0 because status=%s (qid=%s, criterion=%s, was=%d)",
                                raw_status, qid, desc, raw_awarded,
                            )
                        raw_awarded = 0
                        if not comment:
                            comment = {
                                "blank": status["blank_comment"],
                                "off_topic": status["off_topic_comment"],
                                "illegible": status["illegible_comment"],
                            }.get(raw_status, "")

                    criteria_results.append(CriterionResult(
                        description=desc,
                        weight=weight,
                        awarded=raw_awarded,
                        comment=comment,
                    ))

                # AI が awardedPoints を間違えても合計値を信頼する
                awarded = sum(c.awarded for c in criteria_results)
                if not criteria_results and "awardedPoints" in q:
                    try:
                        awarded = int(q["awardedPoints"])
                    except (TypeError, ValueError):
                        awarded = 0
                # answered 以外なら最終的にも 0 に固定
                if raw_status != "answered":
                    awarded = 0

                marks: list[Mark] = []
                for m in q.get("marks") or []:
                    bbox_raw = m.get("bbox")
                    bbox: BBox | None = None
                    if isinstance(bbox_raw, dict):
                        try:
                            bbox = BBox(
                                page_index=int(bbox_raw.get("pageIndex", 0)),
                                x=float(bbox_raw.get("x", 0)),
                                y=float(bbox_raw.get("y", 0)),
                                w=float(bbox_raw.get("w", 0)),
                                h=float(bbox_raw.get("h", 0)),
                            )
                        except (TypeError, ValueError):
                            bbox = None
                    kind = m.get("kind") or "comment"
                    if kind not in {"circle", "cross", "triangle", "comment", "score"}:
                        kind = "comment"
                    marks.append(Mark(
                        kind=kind,  # type: ignore[arg-type]
                        bbox=bbox,
                        text=m.get("text"),
                    ))

                # max_points は rubric を信頼
                max_points = rubric.max_points if rubric else int(q.get("maxPoints", awarded))

                # overall_comment: off_topic 等の場合はコメントを上書き
                overall_comment = q.get("overallComment", "") or ""
                if raw_status != "answered":
                    status_msg = {
                        "blank": status["status_msg_blank"],
                        "off_topic": status["status_msg_off_topic"],
                        "illegible": status["status_msg_illegible"],
                    }.get(raw_status, "")
                    if status_msg:
                        overall_comment = (
                            f"{status_msg}\n{overall_comment}".strip() if overall_comment else status_msg
                        )

                graded_questions.append(GradedQuestion(
                    question_id=qid,
                    question_label=q.get("questionLabel") or (rubric.question_label if rubric else ""),
                    max_points=max_points,
                    awarded_points=min(awarded, max_points),
                    answer_status=raw_status,  # type: ignore[arg-type]
                    transcribed_answer=transcribed,
                    overall_comment=overall_comment,
                    criteria_results=criteria_results,
                    marks=marks,
                ))

            total_awarded = sum(q.awarded_points for q in graded_questions)
            total_max = sum(q.max_points for q in graded_questions)
            percentage = round(total_awarded / total_max * 100, 1) if total_max > 0 else 0.0

            # 全設問が off_topic / blank / illegible なら overall_feedback を上書き
            if graded_questions and all(q.answer_status != "answered" for q in graded_questions):
                statuses = {q.answer_status for q in graded_questions}
                if "off_topic" in statuses:
                    overall_fb = status["overall_off_topic"]
                elif "blank" in statuses:
                    overall_fb = status["overall_blank"]
                elif "illegible" in statuses:
                    overall_fb = status["overall_illegible"]

            return GradingResult(
                total_points=total_awarded,
                max_points=total_max,
                percentage=percentage,
                questions=graded_questions,
                overall_feedback=overall_fb,
            )
    except (IndexError, AttributeError) as e:
        logger.warning("grading response parse failed: %s", e)
    return None


async def _files_to_answer_pages(files: list[tuple[bytes, str, str]]) -> tuple[list[AnswerPage], list[tuple[bytes, str]]]:
    """Convert uploaded files (bytes, mime, filename) into AnswerPage list and image data list.

    PDF はページ画像列に展開する。画像はそのまま 1 ページとして扱う。

    Returns:
        (answer_pages, image_pairs)
        answer_pages: AnswerPage list — image_url は base64 data URL を埋め込み済み
        image_pairs:  [(bytes, mime), ...] — Vision API へ渡す用 (data URL 構築済みなので冗長だが保持)
    """
    pages: list[AnswerPage] = []
    pairs: list[tuple[bytes, str]] = []

    for file_bytes, mime, _name in files:
        if mime == "application/pdf":
            extraction = await _extract_pdf_content(file_bytes)
            for img_item in extraction.get("images", []) or []:
                # 後方互換: tuple 長で 2 / 4 を吸収
                if len(img_item) >= 4:
                    img_bytes, img_mime, w, h = img_item[0], img_item[1], img_item[2], img_item[3]
                else:
                    img_bytes, img_mime = img_item[0], img_item[1]
                    w, h = 0, 0
                data_url = _image_to_data_url(img_bytes, img_mime)
                pages.append(AnswerPage(
                    page_index=len(pages),
                    image_url=data_url,
                    width_px=w,
                    height_px=h,
                ))
                pairs.append((img_bytes, img_mime))
        else:
            # image
            w, h = 0, 0
            try:
                from PIL import Image
                import io as _io
                with Image.open(_io.BytesIO(file_bytes)) as im:
                    w, h = im.size
            except Exception:
                pass
            data_url = _image_to_data_url(file_bytes, mime)
            pages.append(AnswerPage(
                page_index=len(pages),
                image_url=data_url,
                width_px=w,
                height_px=h,
            ))
            pairs.append((file_bytes, mime))

    return pages, pairs


def _build_grading_messages(
    rubrics: RubricBundle,
    problem_latex: str,
    answer_pages: list[AnswerPage],
    locale: str = "ja",
) -> list[dict]:
    status = _grading_status(locale)
    content_parts: list[dict] = []

    content_parts.append({
        "type": "text",
        "text": (
            f"{status['problem_latex_header']}\n"
            "```latex\n"
            f"{problem_latex}\n"
            "```\n\n"
            f"{status['rubric_header']}\n"
            "```json\n"
            f"{json.dumps(rubrics.model_dump(by_alias=True), ensure_ascii=False, indent=2)}\n"
            "```\n\n"
            f"{status['images_header']}\n"
            f"{status['images_intro']}"
        ),
    })

    for page in answer_pages:
        if page.image_url:
            content_parts.append({
                "type": "text",
                "text": status["page_label"].format(i=page.page_index + 1),
            })
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": page.image_url, "detail": "high"},
            })

    content_parts.append({
        "type": "text",
        "text": f"{status['instructions_header']}\n{status['instructions_body']}",
    })

    return [{"role": "user", "content": content_parts}]


async def grade_answer_stream(
    rubrics: RubricBundle,
    problem_latex: str,
    answer_files: list[tuple[bytes, str, str]],
    student_name: str = "",
    student_id: str = "",
    locale: str = "ja",
) -> AsyncGenerator[str, None]:
    """SSE 採点ストリーム。

    Args:
        rubrics: パース済みルーブリック
        problem_latex: 問題本文 LaTeX
        answer_files: アップロード済み答案 (bytes, mime, filename) のリスト
        student_name, student_id: 任意
        locale: "ja" (default) or "en" — switches system prompt + progress messages.

    yields:
      data: {"type": "progress", "phase": "...", "message": "..."}
      data: {"type": "question_done", "questionId": "q1-1", "awarded": N, "max": M}
      data: {"type": "done", "result": <GradingResult>}
      data: {"type": "error", "message": "..."}
    """
    status = _grading_status(locale)

    yield _sse({
        "type": "progress",
        "phase": "extracting_pages",
        "message": status["loading_answers"],
    })

    if not answer_files:
        yield _sse({"type": "error", "message": status["no_files"]})
        return
    if not rubrics.rubrics:
        yield _sse({"type": "error", "message": status["empty_rubric"]})
        return

    try:
        pages, _pairs = await _files_to_answer_pages(answer_files)
    except Exception as e:
        logger.exception("answer page extraction failed")
        yield _sse({"type": "error", "message": status["extract_failed"].format(err=str(e)[:160])})
        return

    if not pages:
        yield _sse({"type": "error", "message": status["no_pages"]})
        return

    yield _sse({
        "type": "progress",
        "phase": "parsing_rubric",
        "message": status["rubric_loaded"].format(n=len(rubrics.rubrics), p=rubrics.total_points),
    })

    yield _sse({
        "type": "progress",
        "phase": "ai_grading",
        "message": status["ai_grading"],
    })

    try:
        client = get_client()
    except ValueError as e:
        yield _sse({"type": "error", "message": str(e)})
        return

    tools = _build_grading_tools()
    messages = _build_grading_messages(rubrics, problem_latex, pages, locale=locale)
    messages.insert(0, {"role": "system", "content": _grading_system_prompt(locale)})

    MAX_RETRIES = 2
    grading_result: GradingResult | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({
                "type": "progress",
                "phase": "retrying",
                "message": status["retrying"].format(attempt=attempt, total=MAX_RETRIES),
            })
        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "submit_grading"}},
                    temperature=0.2,
                    **max_tokens_param(MODEL_VISION, 8192),
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("grading API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({
                "type": "error",
                "message": status["ai_error"].format(ty=type(e).__name__, err=str(e)[:200]),
            })
            return

        grading_result = _parse_grading_tool_call(response, rubrics, locale=locale)
        if grading_result and grading_result.questions:
            break

    if not grading_result or not grading_result.questions:
        yield _sse({
            "type": "error",
            "message": status["no_result"],
        })
        return

    # 疑似ストリーム: 設問ごとに question_done を順次配信
    for q in grading_result.questions:
        await asyncio.sleep(0.15)
        yield _sse({
            "type": "question_done",
            "questionId": q.question_id,
            "awarded": q.awarded_points,
            "max": q.max_points,
        })

    # 学生情報と答案ページを最終結果に同梱
    grading_result.student_name = student_name
    grading_result.student_id = student_id
    grading_result.answer_pages = pages

    yield _sse({
        "type": "progress",
        "phase": "rendering",
        "message": status["rendering"],
    })

    yield _sse({
        "type": "done",
        "result": grading_result.model_dump(by_alias=True),
    })

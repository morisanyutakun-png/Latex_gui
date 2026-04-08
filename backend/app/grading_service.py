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


async def extract_rubric_with_ai_stream(latex: str) -> AsyncGenerator[str, None]:
    """SSEストリーム版 — 問題LaTeX に %@rubric コメントブロックを追加する。

    強化点 (2026-04 改修):
    - 最大 3 回まで AI を再試行する
    - 各試行で前回失敗の理由 (tool_call なし / parse 結果が空 / API エラー) を
      ユーザーメッセージとして追加し、AI に修正を促す
    - すべての試行が失敗しても、LaTeX 内の設問パターンから雛形ルーブリックを
      自動生成する fallback を持つ。完全な失敗 ("作れない") を避ける。

    yields:
      data: {"type": "progress", "phase": "...", "message": "..."}
      data: {"type": "done", "latex": "...", "rubrics": <RubricBundle>}
      data: {"type": "error", "message": "..."}
    """
    yield _sse({
        "type": "progress",
        "phase": "starting",
        "message": "AIに採点基準の生成を依頼しています",
    })

    if not latex.strip():
        yield _sse({"type": "error", "message": "問題LaTeX が空です"})
        return

    try:
        client = get_client()
    except ValueError as e:
        yield _sse({"type": "error", "message": str(e)})
        return

    tools = _build_rubric_extractor_tool()
    base_messages: list[dict] = [
        {"role": "system", "content": RUBRIC_EXTRACTOR_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "次の問題LaTeX に対して、各設問の採点基準を `%@rubric-begin..end` "
                "コメントブロックとして挿入した完全な LaTeX を `set_latex` ツールで返してください。"
                "プリアンブルと本文は変更しないでください。\n\n"
                "```latex\n"
                f"{latex}\n"
                "```"
            ),
        },
    ]

    yield _sse({
        "type": "progress",
        "phase": "ai_processing",
        "message": "AIが採点観点を考えています…",
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
                "message": f"再試行中… ({attempt}/{MAX_AI_ATTEMPTS})",
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
            correction_feedback = (
                f"前回の API 呼び出しに失敗しました ({last_error})。"
                "**必ず set_latex ツールを呼び出して** 完全な LaTeX を `latex` 引数で返してください。"
            )
            continue

        candidate_latex = _extract_latex_from_tool_call(response)
        if not candidate_latex:
            logger.warning("rubric extract attempt %d: tool_call missing", attempt)
            correction_feedback = (
                "前回の応答では `set_latex` ツールが正しく呼ばれませんでした。"
                "チャット文ではなく、**必ず `set_latex` ツールを呼び出して** "
                "ルーブリックコメント付きの完全な LaTeX ソースを `latex` 引数として返してください。"
            )
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
        correction_feedback = (
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
        )

    # ── すべての AI 試行が失敗 → ヒューリスティクス fallback ──
    if not bundle or not bundle.rubrics:
        yield _sse({
            "type": "progress",
            "phase": "fallback",
            "message": "AI の生成に失敗したので、問題構造から採点基準の雛形を作成しています…",
        })
        try:
            fallback_rubrics = _heuristic_rubric_fallback(latex)
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
                bundle.parse_warnings.append(
                    "AI による採点基準の生成に失敗したため、問題構造から自動で雛形を作成しました。"
                    "観点の文言と配点を必ずあなた自身で調整してください。"
                )

        if not bundle or not bundle.rubrics:
            err_detail = f" (最後のエラー: {last_error})" if last_error else ""
            yield _sse({
                "type": "error",
                "message": (
                    "採点基準を生成できませんでした。問題LaTeX に「問1」「大問1」"
                    "「\\begin{daimon}」など設問を識別できる手がかりが含まれているか確認してください。"
                    + err_detail
                ),
            })
            return

    yield _sse({
        "type": "progress",
        "phase": "validating",
        "message": "生成された採点基準を検証中…",
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


def _heuristic_rubric_fallback(latex: str) -> list[Rubric]:
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

    rubrics: list[Rubric] = []
    for n in range(1, count + 1):
        rubrics.append(Rubric(
            question_id=f"q{n}",
            question_label=f"問{n}",
            max_points=10,
            criteria=[
                RubricCriterion(description="立式・問題の理解", weight=3),
                RubricCriterion(description="計算過程の正しさ", weight=4),
                RubricCriterion(description="最終解答の明示", weight=3),
            ],
        ))
    return rubrics


# ════════════════ Phase 5: AI 採点 (grade_answer_stream) ════════════════

GRADING_SYSTEM_PROMPT = r"""\
あなたは熟練した採点者です。提示された問題、採点ルーブリック(JSON)、生徒の答案画像を読み、
各設問について部分点・コメント・赤入れ位置を判定します。

# 入力
1. 問題LaTeX (本文)
2. 採点ルーブリック (JSON)
3. 答案画像 (1 ページ以上)

# あなたの仕事 (絶対遵守)
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
- `transcribedAnswer`: 答案画像から読み取った答案 (LaTeX 形式の数式含む)
- `overallComment`: 設問講評 (1〜2 文)
- `criteriaResults`: 観点ごとの採点
   - `description`: 観点
   - `weight`: 配点
   - `awarded`: 与えた点
   - `comment`: 短いコメント
- `marks`: 答案画像上の赤入れマーク (配列。なくても可)
   - `kind`: "circle" | "cross" | "triangle" | "comment" | "score"
   - `bbox`: 答案画像上の正規化座標 { pageIndex, x, y, w, h } (0..1, left-top 原点)
   - `text`: 数値や短いコメント (任意)

# 採点ポリシー
- ルーブリックの観点を順番に判定し、`weight` を上限として `awarded` を割り当てる
- 完全に正解 → `weight` 全部
- 部分的 → 半分など適度に
- 全く違う or 無回答 → 0
- 計算過程の符号ミスなど軽微な間違いは部分点を惜しまない
- コメントは「何が正しい / 何が違う / どう改善すべきか」を簡潔に書く
- `awardedPoints` は `criteriaResults` の `awarded` の合計と必ず一致させる
- `marks` の bbox は答案画像に対する正規化座標。重ならないように配置する
- bbox がよく分からない場合は `marks` を空配列にする (フォールバック表示される)
- 全体講評は 2〜3 文。良かった点と改善点を両方含める

# 言語
日本語で書く。数式は LaTeX で書く ($x^2$ や \\[ ... \\])。
"""


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
                                    "transcribedAnswer": {"type": "string"},
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


def _parse_grading_tool_call(response, rubrics: RubricBundle) -> GradingResult | None:
    """Pull `submit_grading` output and convert to GradingResult."""
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
                criteria_results = []
                for c in q.get("criteriaResults") or []:
                    criteria_results.append(CriterionResult(
                        description=c.get("description", ""),
                        weight=int(c.get("weight", 0)),
                        awarded=int(c.get("awarded", 0)),
                        comment=c.get("comment", "") or "",
                    ))
                # AI が awardedPoints を間違えても合計値を信頼する
                awarded = sum(c.awarded for c in criteria_results)
                if not criteria_results and "awardedPoints" in q:
                    try:
                        awarded = int(q["awardedPoints"])
                    except (TypeError, ValueError):
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

                graded_questions.append(GradedQuestion(
                    question_id=qid,
                    question_label=q.get("questionLabel") or (rubric.question_label if rubric else ""),
                    max_points=max_points,
                    awarded_points=min(awarded, max_points),
                    transcribed_answer=q.get("transcribedAnswer", "") or "",
                    overall_comment=q.get("overallComment", "") or "",
                    criteria_results=criteria_results,
                    marks=marks,
                ))

            total_awarded = sum(q.awarded_points for q in graded_questions)
            total_max = sum(q.max_points for q in graded_questions)
            percentage = round(total_awarded / total_max * 100, 1) if total_max > 0 else 0.0

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
) -> list[dict]:
    content_parts: list[dict] = []

    content_parts.append({
        "type": "text",
        "text": (
            "## 問題LaTeX\n"
            "```latex\n"
            f"{problem_latex}\n"
            "```\n\n"
            "## 採点ルーブリック (JSON)\n"
            "```json\n"
            f"{json.dumps(rubrics.model_dump(by_alias=True), ensure_ascii=False, indent=2)}\n"
            "```\n\n"
            "## 答案画像 (左上原点、座標は 0..1 の正規化)\n"
        ),
    })

    for page in answer_pages:
        if page.image_url:
            content_parts.append({"type": "text", "text": f"--- ページ {page.page_index + 1} ---"})
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": page.image_url, "detail": "high"},
            })

    content_parts.append({
        "type": "text",
        "text": (
            "上記の答案を採点して、`submit_grading` ツールで結果を返してください。"
            "ルーブリックの全設問に対して採点結果を返してください。"
        ),
    })

    return [{"role": "user", "content": content_parts}]


async def grade_answer_stream(
    rubrics: RubricBundle,
    problem_latex: str,
    answer_files: list[tuple[bytes, str, str]],
    student_name: str = "",
    student_id: str = "",
) -> AsyncGenerator[str, None]:
    """SSE 採点ストリーム。

    Args:
        rubrics: パース済みルーブリック
        problem_latex: 問題本文 LaTeX
        answer_files: アップロード済み答案 (bytes, mime, filename) のリスト
        student_name, student_id: 任意

    yields:
      data: {"type": "progress", "phase": "...", "message": "..."}
      data: {"type": "question_done", "questionId": "q1-1", "awarded": N, "max": M}
      data: {"type": "done", "result": <GradingResult>}
      data: {"type": "error", "message": "..."}
    """
    yield _sse({
        "type": "progress",
        "phase": "extracting_pages",
        "message": "答案を読み込んでいます",
    })

    if not answer_files:
        yield _sse({"type": "error", "message": "答案ファイルが指定されていません"})
        return
    if not rubrics.rubrics:
        yield _sse({"type": "error", "message": "採点基準(ルーブリック)が空です"})
        return

    try:
        pages, _pairs = await _files_to_answer_pages(answer_files)
    except Exception as e:
        logger.exception("answer page extraction failed")
        yield _sse({"type": "error", "message": f"答案の読み込みに失敗しました: {str(e)[:160]}"})
        return

    if not pages:
        yield _sse({"type": "error", "message": "答案からページを抽出できませんでした"})
        return

    yield _sse({
        "type": "progress",
        "phase": "parsing_rubric",
        "message": f"採点基準を読み込みました ({len(rubrics.rubrics)}問・{rubrics.total_points}点)",
    })

    yield _sse({
        "type": "progress",
        "phase": "ai_grading",
        "message": "AIが採点中…",
    })

    try:
        client = get_client()
    except ValueError as e:
        yield _sse({"type": "error", "message": str(e)})
        return

    tools = _build_grading_tools()
    messages = _build_grading_messages(rubrics, problem_latex, pages)
    messages.insert(0, {"role": "system", "content": GRADING_SYSTEM_PROMPT})

    MAX_RETRIES = 2
    grading_result: GradingResult | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({
                "type": "progress",
                "phase": "retrying",
                "message": f"再試行中… ({attempt}/{MAX_RETRIES})",
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
                "message": f"AI採点エラー: {type(e).__name__}: {str(e)[:200]}",
            })
            return

        grading_result = _parse_grading_tool_call(response, rubrics)
        if grading_result and grading_result.questions:
            break

    if not grading_result or not grading_result.questions:
        yield _sse({
            "type": "error",
            "message": "AIが採点結果を返せませんでした。もう一度お試しください。",
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
        "message": "採点結果を整理中…",
    })

    yield _sse({
        "type": "done",
        "result": grading_result.model_dump(by_alias=True),
    })

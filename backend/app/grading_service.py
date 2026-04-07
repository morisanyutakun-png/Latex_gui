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

from .ai_service import get_client, MODEL_CHAT, MODEL_VISION
from .grading_models import (
    AnswerPage,
    BBox,
    CriterionResult,
    GradedQuestion,
    GradingResult,
    Mark,
    RubricBundle,
)
from .omr_service import _extract_pdf_content, _image_to_data_url
from .rubric_parser import parse_rubrics

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

# 絶対禁止事項
- プリアンブル(`\documentclass`, `\usepackage`, `\title`, `\author` 等)を変更しない
- `\begin{document}` 〜 `\end{document}` の中身(本文)を変更しない
- 既存の `%@rubric-begin..end` ブロックがあれば残す or 改善する(削除しない)
- 問題が見当たらないテンプレや空文書には新規ルーブリックを作らず、空のままで構わない
- LaTeX 構文を壊さない

# 応答方法
**必ず `set_latex` ツールを呼び出して**、ルーブリックコメントを追加した完全な
LaTeX ソースを `latex` 引数として渡してください。チャット応答は不要です。
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
    messages = [
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

    MAX_RETRIES = 2
    new_latex: str | None = None

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
                    model=MODEL_CHAT,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.4,
                    max_tokens=16384,
                )

            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("rubric extract API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                continue
            yield _sse({
                "type": "error",
                "message": f"AI呼び出しエラー: {type(e).__name__}: {str(e)[:200]}",
            })
            return

        new_latex = _extract_latex_from_tool_call(response)
        if new_latex:
            break

    if not new_latex:
        yield _sse({
            "type": "error",
            "message": "AIがルーブリックを生成できませんでした。問題が短すぎないか確認してください。",
        })
        return

    yield _sse({
        "type": "progress",
        "phase": "validating",
        "message": "生成された採点基準を検証中…",
    })

    bundle = parse_rubrics(new_latex)

    if not bundle.rubrics:
        yield _sse({
            "type": "error",
            "message": "AIが %@rubric ブロックを正しく挿入できませんでした。もう一度お試しください。",
        })
        return

    yield _sse({
        "type": "done",
        "latex": new_latex,
        "rubrics": bundle.model_dump(by_alias=True),
    })


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
                    max_tokens=8192,
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

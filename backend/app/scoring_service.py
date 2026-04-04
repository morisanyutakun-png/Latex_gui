"""
OMR 採点サービス — 解答キーと生徒の回答を比較して採点する
"""
from __future__ import annotations

from .models import AnswerKey, StudentAnswer, ScoreResult, ScoreResultItem


def score_answers(
    answer_key: AnswerKey,
    student_answers: list[StudentAnswer],
) -> ScoreResult:
    """解答キーと生徒回答を比較して採点結果を返す"""
    key_map = {item.question_id: item for item in answer_key.items}
    total_possible = sum(item.points for item in answer_key.items)

    items: list[ScoreResultItem] = []
    total_score = 0

    for sa in student_answers:
        key_item = key_map.get(sa.question_id)
        if not key_item:
            continue
        is_correct = _compare_answer(sa.answer, key_item.correct_answer, key_item.answer_type)
        points = key_item.points if is_correct else 0
        total_score += points
        items.append(ScoreResultItem(
            question_id=sa.question_id,
            student_answer=sa.answer,
            correct_answer=key_item.correct_answer,
            is_correct=is_correct,
            points_earned=points,
            points_possible=key_item.points,
        ))

    return ScoreResult(
        total_score=total_score,
        total_possible=total_possible,
        percentage=round(total_score / total_possible * 100, 1) if total_possible > 0 else 0.0,
        items=items,
    )


def _compare_answer(student: str, correct: str, answer_type: str) -> bool:
    """回答タイプに応じて比較"""
    s = student.strip()
    c = correct.strip()

    if answer_type == "choice":
        return s == c
    elif answer_type == "numeric":
        try:
            return abs(float(s) - float(c)) < 1e-9
        except ValueError:
            return s == c
    else:  # text
        # 正規化して比較（全角半角、大文字小文字）
        return s.lower() == c.lower()

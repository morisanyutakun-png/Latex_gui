"""
採点モード用 Pydantic モデル

問題LaTeX に埋め込まれた `%@rubric:` コメントを正規化した
ルーブリック・採点リクエスト・採点結果を扱う。
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import Field

from .models import CamelModel


# ──────────── ルーブリック ────────────

class RubricCriterion(CamelModel):
    """1 つの採点観点 (criterion)"""
    description: str
    weight: int
    hint: Optional[str] = None


class Rubric(CamelModel):
    """1 設問分の採点ルーブリック"""
    question_id: str                                  # "q1-1"
    question_label: str = ""                          # 表示用 "問1(1)"
    max_points: int
    criteria: list[RubricCriterion] = Field(default_factory=list)
    hint: Optional[str] = None
    source_line: Optional[int] = None                 # LaTeX 内の `%@rubric-begin:` 行番号


class RubricBundle(CamelModel):
    """文書全体の採点ルーブリック集"""
    rubrics: list[Rubric] = Field(default_factory=list)
    total_points: int = 0
    parse_warnings: list[str] = Field(default_factory=list)


# ──────────── 採点入力 ────────────

class AnswerPage(CamelModel):
    """1 ページ分の答案画像"""
    page_index: int
    image_url: Optional[str] = None                   # base64 data URL も可
    width_px: int = 0
    height_px: int = 0


class GradingRequest(CamelModel):
    rubrics: RubricBundle
    problem_latex: str
    answer_pages: list[AnswerPage] = Field(default_factory=list)
    student_name: str = ""
    student_id: str = ""


# ──────────── 採点結果 ────────────

class BBox(CamelModel):
    """正規化座標 (0..1) — left-top 原点。画像幅・高さに対する比率。"""
    page_index: int
    x: float
    y: float
    w: float
    h: float


class Mark(CamelModel):
    """赤入れPDF上の単一マーク"""
    kind: Literal["circle", "cross", "triangle", "comment", "score"]
    bbox: Optional[BBox] = None                       # 不明なら紙面下部にフォールバック
    text: Optional[str] = None


class CriterionResult(CamelModel):
    """ルーブリック観点ごとの採点結果"""
    description: str
    weight: int
    awarded: int
    comment: str = ""


AnswerStatus = Literal["answered", "blank", "off_topic", "illegible"]


class GradedQuestion(CamelModel):
    """1 設問分の採点結果"""
    question_id: str
    question_label: str = ""
    max_points: int
    awarded_points: int
    # 答案ステータス: AI が答案画像をどう判定したかの相互チェック用ラベル
    #  - "answered"  : この設問への解答試行があった (正誤を問わず)
    #  - "blank"     : 空白
    #  - "off_topic" : 関係ない画像 / 別問題 / 印刷文書 など
    #  - "illegible" : 判読不能
    # blank / off_topic / illegible のときはサーバ側で全観点を 0 点にフォースする。
    answer_status: AnswerStatus = "answered"
    transcribed_answer: str = ""                      # AI が画像から読み取った答案 (LaTeX)
    overall_comment: str = ""
    criteria_results: list[CriterionResult] = Field(default_factory=list)
    marks: list[Mark] = Field(default_factory=list)


class GradingResult(CamelModel):
    student_name: str = ""
    student_id: str = ""
    total_points: int = 0
    max_points: int = 0
    percentage: float = 0.0
    questions: list[GradedQuestion] = Field(default_factory=list)
    answer_pages: list[AnswerPage] = Field(default_factory=list)
    overall_feedback: str = ""

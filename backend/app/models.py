"""
Block-based document model (Word-like structured editing)
Frontend blocks → structured LaTeX → XeLaTeX → PDF
"""
from __future__ import annotations

from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Discriminator, Field, Tag
from pydantic.alias_generators import to_camel


# --------------- Base schema (camelCase JSON ↔ snake_case Python) ---------------

class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


# --------------- Block Content (discriminated union) ---------------

class HeadingContent(CamelModel):
    type: Literal["heading"] = "heading"
    text: str = ""
    level: int = Field(default=1, ge=1, le=3)


class ParagraphContent(CamelModel):
    type: Literal["paragraph"] = "paragraph"
    text: str = ""


class MathContent(CamelModel):
    type: Literal["math"] = "math"
    latex: str = ""
    display_mode: bool = True
    source_text: Optional[str] = None


class ListContent(CamelModel):
    type: Literal["list"] = "list"
    style: Literal["bullet", "numbered"] = "bullet"
    items: list[str] = Field(default_factory=lambda: [""])


class TableContent(CamelModel):
    type: Literal["table"] = "table"
    headers: list[str] = Field(default_factory=lambda: ["列1", "列2"])
    rows: list[list[str]] = Field(default_factory=lambda: [["", ""]])
    caption: Optional[str] = None


class ImageContent(CamelModel):
    type: Literal["image"] = "image"
    url: str = ""
    caption: str = ""
    width: Optional[int] = None


class DividerContent(CamelModel):
    type: Literal["divider"] = "divider"
    style: Optional[str] = "solid"  # solid, dashed, dotted


class CodeContent(CamelModel):
    type: Literal["code"] = "code"
    language: str = ""
    code: str = ""


class QuoteContent(CamelModel):
    type: Literal["quote"] = "quote"
    text: str = ""
    attribution: Optional[str] = None


# --------------- Engineering / Science Block Types ---------------

class CircuitContent(CamelModel):
    """回路図ブロック (circuitikz)"""
    type: Literal["circuit"] = "circuit"
    code: str = ""                              # circuitikz code
    caption: Optional[str] = None
    preset: Optional[str] = None                # preset template id


class DiagramContent(CamelModel):
    """ダイアグラムブロック (TikZ)"""
    type: Literal["diagram"] = "diagram"
    code: str = ""                              # TikZ code
    caption: Optional[str] = None
    diagram_type: str = "flowchart"             # flowchart, sequence, block, state, tree, custom
    preset: Optional[str] = None                # preset template id


class ChemistryContent(CamelModel):
    """化学式ブロック (mhchem)"""
    type: Literal["chemistry"] = "chemistry"
    formula: str = ""                           # mhchem notation, e.g., "H2O", "CO2 + H2O -> H2CO3"
    display_mode: bool = True
    caption: Optional[str] = None


class ChartContent(CamelModel):
    """グラフ・チャートブロック (pgfplots)"""
    type: Literal["chart"] = "chart"
    chart_type: str = "line"                    # line, bar, scatter, histogram
    code: str = ""                              # pgfplots code
    caption: Optional[str] = None
    preset: Optional[str] = None


class LaTeXContent(CamelModel):
    """生のLaTeXコードブロック — AIが自由にLaTeXを書ける"""
    type: Literal["latex"] = "latex"
    code: str = ""                              # raw LaTeX code (rendered verbatim)
    caption: Optional[str] = None


BlockContent = Annotated[
    Union[
        Annotated[HeadingContent, Tag("heading")],
        Annotated[ParagraphContent, Tag("paragraph")],
        Annotated[MathContent, Tag("math")],
        Annotated[ListContent, Tag("list")],
        Annotated[TableContent, Tag("table")],
        Annotated[ImageContent, Tag("image")],
        Annotated[DividerContent, Tag("divider")],
        Annotated[CodeContent, Tag("code")],
        Annotated[QuoteContent, Tag("quote")],
        Annotated[CircuitContent, Tag("circuit")],
        Annotated[DiagramContent, Tag("diagram")],
        Annotated[ChemistryContent, Tag("chemistry")],
        Annotated[ChartContent, Tag("chart")],
        Annotated[LaTeXContent, Tag("latex")],
    ],
    Discriminator("type"),
]


# --------------- Block Style ---------------

class BlockStyle(CamelModel):
    text_align: Optional[str] = None
    font_size: Optional[int] = None
    font_family: Optional[str] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    text_color: Optional[str] = None
    background_color: Optional[str] = None


# --------------- Block ---------------

class Block(CamelModel):
    id: str
    content: BlockContent = Field(discriminator="type")
    style: BlockStyle = Field(default_factory=BlockStyle)


# --------------- Document Settings ---------------

class Margins(CamelModel):
    top: int = 25
    bottom: int = 25
    left: int = 20
    right: int = 20


class PaperDesign(CamelModel):
    """紙のデザイン設定 — PDF出力にも反映される"""
    theme: str = "plain"           # plain, grid, lined, dot-grid, elegant, modern
    paper_color: str = "#ffffff"    # 紙の背景色 (hex)
    accent_color: str = "#4f46e5"   # アクセントカラー (hex)
    header_border: bool = False     # タイトル下ボーダー
    section_dividers: bool = False  # セクション間区切り線
    design_preset: str = "none"     # デザインプリセットID


class DocumentSettings(CamelModel):
    paper_size: str = "a4"
    margins: Margins = Field(default_factory=Margins)
    line_spacing: float = 1.15
    page_numbers: bool = True
    two_column: bool = False
    document_class: str = "article"
    paper_design: Optional[PaperDesign] = None


# --------------- Metadata ---------------

class Metadata(CamelModel):
    title: str = ""
    author: str = ""
    date: Optional[str] = None


# --------------- Advanced Mode (上級者モード) ---------------

class AdvancedHooks(CamelModel):
    """上級者モード: LaTeX 部分カスタマイズ用フック"""
    enabled: bool = False
    custom_preamble: str = ""          # \usepackage, \newcommand 等
    pre_document: str = ""             # \begin{document} 直後
    post_document: str = ""            # \end{document} 直前
    custom_commands: list[str] = Field(default_factory=list)  # ["\\newcommand{...}{...}", ...]


# --------------- Document ---------------

class DocumentModel(CamelModel):
    template: str = "blank"
    metadata: Metadata = Field(default_factory=Metadata)
    settings: DocumentSettings = Field(default_factory=DocumentSettings)
    blocks: list[Block] = Field(default_factory=list)
    advanced: AdvancedHooks = Field(default_factory=AdvancedHooks)


# --------------- Batch (量産) Models ---------------

class BatchRequest(CamelModel):
    """テンプレート × 変数 バッチ生成リクエスト"""
    template: DocumentModel
    variables_csv: Optional[str] = None    # CSV テキスト (ヘッダー付き)
    variables_json: Optional[str] = None   # JSON 配列テキスト
    filename_template: str = "{{_index}}_document"
    max_rows: int = Field(default=50, ge=1, le=200)


class BatchResultItem(CamelModel):
    """バッチ生成結果の1行"""
    index: int
    filename: str
    success: bool
    error: Optional[str] = None
    time_ms: Optional[float] = None


class BatchResponse(CamelModel):
    """バッチ生成結果レスポンス"""
    success: bool
    total: int
    success_count: int
    error_count: int
    total_time_ms: float
    results: list[BatchResultItem] = Field(default_factory=list)


# --------------- API Response ---------------

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None


# --------------- Scoring (OMR採点) ---------------

class AnswerKeyItem(CamelModel):
    """解答キーの1問"""
    question_id: str
    correct_answer: str
    points: int = 1
    answer_type: Literal["choice", "numeric", "text"] = "choice"


class AnswerKey(CamelModel):
    """解答キー全体"""
    title: str = ""
    items: list[AnswerKeyItem] = Field(default_factory=list)
    total_points: int = 0


class StudentAnswer(CamelModel):
    """生徒の回答1問"""
    question_id: str
    answer: str
    confidence: float = 1.0


class ScoreResultItem(CamelModel):
    """採点結果の1問"""
    question_id: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    points_earned: int
    points_possible: int


class ScoreResult(CamelModel):
    """採点結果全体"""
    total_score: int
    total_possible: int
    percentage: float
    items: list[ScoreResultItem] = Field(default_factory=list)


class ScoreRequest(CamelModel):
    """採点リクエスト"""
    answer_key: AnswerKey
    student_answers: list[StudentAnswer] = Field(default_factory=list)

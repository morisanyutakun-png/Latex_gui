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


class DocumentSettings(CamelModel):
    paper_size: str = "a4"
    margins: Margins = Field(default_factory=Margins)
    line_spacing: float = 1.15
    page_numbers: bool = True
    two_column: bool = False
    document_class: str = "article"


# --------------- Metadata ---------------

class Metadata(CamelModel):
    title: str = ""
    author: str = ""
    date: Optional[str] = None


# --------------- Document ---------------

class DocumentModel(CamelModel):
    template: str = "blank"
    metadata: Metadata = Field(default_factory=Metadata)
    settings: DocumentSettings = Field(default_factory=DocumentSettings)
    blocks: list[Block] = Field(default_factory=list)


# --------------- API Response ---------------

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None

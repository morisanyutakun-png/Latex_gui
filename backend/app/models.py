"""
Canvas-based document model
Frontend pages > elements (position, style) に対応
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Discriminator, Field, Tag


# --------------- Enums ---------------

class TemplateType(str, Enum):
    BLANK = "blank"
    REPORT = "report"
    ANNOUNCEMENT = "announcement"
    WORKSHEET = "worksheet"


class ListStyle(str, Enum):
    BULLET = "bullet"
    NUMBERED = "numbered"


# --------------- Position & Style ---------------

class ElementPosition(BaseModel):
    x: float = Field(default=20, description="X座標 (mm)")
    y: float = Field(default=20, description="Y座標 (mm)")
    width: float = Field(default=170, description="幅 (mm)")
    height: float = Field(default=40, description="高さ (mm)")


class ElementStyle(BaseModel):
    textColor: Optional[str] = None
    backgroundColor: Optional[str] = None
    textAlign: Optional[str] = Field(default=None, pattern="^(left|center|right)$")
    fontSize: Optional[float] = None        # pt
    fontFamily: Optional[str] = Field(default=None, pattern="^(serif|sans)$")
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    borderColor: Optional[str] = None
    borderWidth: Optional[float] = None     # pt
    borderRadius: Optional[float] = None    # mm
    padding: Optional[float] = None         # mm
    opacity: Optional[float] = Field(default=None, ge=0, le=1)


# --------------- Content Models (discriminated union) ---------------

class HeadingContent(BaseModel):
    type: Literal["heading"] = "heading"
    text: str = Field(default="", description="見出しテキスト")
    level: int = Field(default=1, ge=1, le=3)


class ParagraphContent(BaseModel):
    type: Literal["paragraph"] = "paragraph"
    text: str = Field(default="", description="本文テキスト")


class ListContent(BaseModel):
    type: Literal["list"] = "list"
    style: ListStyle = Field(default=ListStyle.BULLET)
    items: list[str] = Field(default_factory=lambda: [""])


class TableContent(BaseModel):
    type: Literal["table"] = "table"
    headers: list[str] = Field(default_factory=lambda: ["列1", "列2"])
    rows: list[list[str]] = Field(default_factory=lambda: [["", ""]])


class ImageContent(BaseModel):
    type: Literal["image"] = "image"
    url: str = Field(default="", description="画像URL")
    caption: str = Field(default="")


ElementContent = Annotated[
    Union[
        Annotated[HeadingContent, Tag("heading")],
        Annotated[ParagraphContent, Tag("paragraph")],
        Annotated[ListContent, Tag("list")],
        Annotated[TableContent, Tag("table")],
        Annotated[ImageContent, Tag("image")],
    ],
    Discriminator("type"),
]


# --------------- Canvas Element ---------------

class CanvasElement(BaseModel):
    id: str
    content: ElementContent
    position: ElementPosition = Field(default_factory=ElementPosition)
    style: ElementStyle = Field(default_factory=ElementStyle)
    zIndex: int = Field(default=1)


# --------------- Page ---------------

class Page(BaseModel):
    id: str
    elements: list[CanvasElement] = Field(default_factory=list)


# --------------- Metadata ---------------

class Metadata(BaseModel):
    title: str = Field(default="無題のドキュメント")
    subtitle: str = Field(default="")
    author: str = Field(default="")
    date: str = Field(default="")


# --------------- Document ---------------

class DocumentModel(BaseModel):
    template: TemplateType = Field(default=TemplateType.BLANK)
    metadata: Metadata = Field(default_factory=Metadata)
    pages: list[Page] = Field(default_factory=list)


# --------------- API Response Models ---------------

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None

"""
中間表現（JSON）のPydanticモデル定義
GUI入力 → JSON中間表現 → LaTeX生成 → PDF
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Discriminator, Field, Tag


# --------------- Enums ---------------

class TemplateType(str, Enum):
    REPORT = "report"
    ANNOUNCEMENT = "announcement"
    WORKSHEET = "worksheet"


class BlockType(str, Enum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST = "list"
    TABLE = "table"
    IMAGE = "image"


class ListStyle(str, Enum):
    BULLET = "bullet"
    NUMBERED = "numbered"


# --------------- Block Models ---------------

class HeadingBlock(BaseModel):
    type: Literal["heading"] = "heading"
    text: str = Field(..., description="見出しテキスト")
    level: int = Field(default=1, ge=1, le=3, description="見出しレベル 1-3")


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"] = "paragraph"
    text: str = Field(..., description="本文テキスト")


class ListBlock(BaseModel):
    type: Literal["list"] = "list"
    style: ListStyle = Field(default=ListStyle.BULLET, description="箇条書きの種別")
    items: list[str] = Field(..., description="項目リスト")


class TableBlock(BaseModel):
    type: Literal["table"] = "table"
    headers: list[str] = Field(..., description="列見出し")
    rows: list[list[str]] = Field(..., description="行データ")


class ImageBlock(BaseModel):
    type: Literal["image"] = "image"
    url: str = Field(..., description="画像URL")
    caption: str = Field(default="", description="キャプション")
    width: float = Field(default=0.8, ge=0.1, le=1.0, description="幅（0.1〜1.0）")


# Discriminated Union type
Block = Annotated[
    Union[
        Annotated[HeadingBlock, Tag("heading")],
        Annotated[ParagraphBlock, Tag("paragraph")],
        Annotated[ListBlock, Tag("list")],
        Annotated[TableBlock, Tag("table")],
        Annotated[ImageBlock, Tag("image")],
    ],
    Discriminator("type"),
]


# --------------- Document Model ---------------

class Metadata(BaseModel):
    title: str = Field(default="無題のドキュメント", description="文書タイトル")
    subtitle: str = Field(default="", description="サブタイトル")
    author: str = Field(default="", description="作成者")
    date: str = Field(default="", description="日付")


class DocumentModel(BaseModel):
    template: TemplateType = Field(..., description="テンプレート種別")
    metadata: Metadata = Field(default_factory=Metadata)
    blocks: list[Block] = Field(default_factory=list, description="ブロックリスト")


# --------------- API Response Models ---------------

class PDFResponse(BaseModel):
    success: bool
    message: str
    filename: Optional[str] = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None

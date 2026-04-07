"""
Raw LaTeX document model (template-driven editing)

方針: AI / ユーザーは raw LaTeX を直接編集する。
ブロック構造化レイヤは廃止。テンプレートが既定の見た目を担う。
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# --------------- Base schema (camelCase JSON ↔ snake_case Python) ---------------

class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


# --------------- Metadata ---------------

class Metadata(CamelModel):
    title: str = ""
    author: str = ""
    date: Optional[str] = None


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
    document_class: str = "article"


# --------------- Document ---------------

class DocumentModel(CamelModel):
    """テンプレート + raw LaTeX ソースで構成される文書。

    AI とユーザーは `latex` フィールドを直接編集する。
    `template` は使用しているテンプレートの ID（プリアンブルや既定スタイルの出所）。
    """
    template: str = "blank"
    metadata: Metadata = Field(default_factory=Metadata)
    settings: DocumentSettings = Field(default_factory=DocumentSettings)
    latex: str = ""


# --------------- Batch (量産) Models ---------------

class BatchRequest(CamelModel):
    """テンプレート × 変数 バッチ生成リクエスト"""
    template: DocumentModel
    variables_csv: Optional[str] = None
    variables_json: Optional[str] = None
    filename_template: str = "{{_index}}_document"
    max_rows: int = Field(default=50, ge=1, le=200)


class BatchResultItem(CamelModel):
    index: int
    filename: str
    success: bool
    error: Optional[str] = None
    time_ms: Optional[float] = None


class BatchResponse(CamelModel):
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

"""
バッチ生成サービス: テンプレート × 変数 で PDF を量産 (教材工場)

方針:
  - テンプレート (DocumentModel) 内の `{{変数名}}` プレースホルダを検出
  - CSV/JSON 形式の変数データセットを受け取り
  - 各行ごとにプレースホルダを置換 → PDF 生成
  - ZIP でまとめてダウンロード
  - エラーが発生した行はスキップして続行
"""
import asyncio
import csv
import io
import json
import logging
import re
import time
import zipfile
from typing import Any, Optional

from .models import (
    DocumentModel, Block, BlockContent,
    HeadingContent, ParagraphContent, MathContent,
    ListContent, TableContent, CodeContent,
    QuoteContent, CircuitContent, DiagramContent,
    ChemistryContent, ChartContent, ImageContent,
)
from .pdf_service import compile_pdf, PDFGenerationError
from .audit import log_batch_event, AuditEvent, log_audit

logger = logging.getLogger(__name__)

# プレースホルダパターン: {{変数名}} or {{ 変数名 }}
PLACEHOLDER_RE = re.compile(r'\{\{\s*(\w+)\s*\}\}')


# ═══════════════════════════════════════════════════════════════
# プレースホルダ検出
# ═══════════════════════════════════════════════════════════════

def detect_placeholders(doc: DocumentModel) -> list[str]:
    """
    ドキュメント内の全ブロック + メタデータからプレースホルダ変数名を検出。
    重複なしのリストを返す。
    """
    found: set[str] = set()

    # メタデータ
    for field in ("title", "author", "date"):
        val = getattr(doc.metadata, field, None)
        if val:
            found.update(PLACEHOLDER_RE.findall(val))

    # 各ブロック
    for block in doc.blocks:
        content = block.content
        _scan_content_placeholders(content, found)

    return sorted(found)


def _scan_content_placeholders(content: BlockContent, found: set[str]):
    """ブロックコンテンツ内のプレースホルダを検出"""
    # テキスト系フィールド
    for attr in ("text", "latex", "code", "formula", "caption", "attribution", "url", "language"):
        val = getattr(content, attr, None)
        if val and isinstance(val, str):
            found.update(PLACEHOLDER_RE.findall(val))

    # リスト項目
    if hasattr(content, "items"):
        for item in content.items:
            found.update(PLACEHOLDER_RE.findall(item))

    # テーブル
    if hasattr(content, "headers"):
        for h in content.headers:
            found.update(PLACEHOLDER_RE.findall(h))
    if hasattr(content, "rows"):
        for row in content.rows:
            for cell in row:
                found.update(PLACEHOLDER_RE.findall(cell))


# ═══════════════════════════════════════════════════════════════
# プレースホルダ置換
# ═══════════════════════════════════════════════════════════════

def _replace_in_string(s: str, variables: dict[str, str]) -> str:
    """文字列内のプレースホルダを変数値で置換"""
    def replacer(match):
        var_name = match.group(1)
        return variables.get(var_name, match.group(0))  # 未定義は元のまま
    return PLACEHOLDER_RE.sub(replacer, s)


def apply_variables(doc: DocumentModel, variables: dict[str, str]) -> DocumentModel:
    """
    ドキュメントのディープコピーを作成し、プレースホルダを変数値で置換。
    元のドキュメントは変更しない。
    """
    # ディープコピー (Pydantic model_copy)
    doc_dict = doc.model_dump(by_alias=False)

    # メタデータの置換
    for field in ("title", "author", "date"):
        if doc_dict["metadata"].get(field):
            doc_dict["metadata"][field] = _replace_in_string(
                doc_dict["metadata"][field], variables
            )

    # ブロックの置換
    for block in doc_dict["blocks"]:
        _replace_in_block(block["content"], variables)

    return DocumentModel.model_validate(doc_dict)


def _replace_in_block(content: dict, variables: dict[str, str]):
    """ブロック辞書内のプレースホルダを再帰的に置換"""
    for key, val in content.items():
        if isinstance(val, str):
            content[key] = _replace_in_string(val, variables)
        elif isinstance(val, list):
            for i, item in enumerate(val):
                if isinstance(item, str):
                    val[i] = _replace_in_string(item, variables)
                elif isinstance(item, list):
                    for j, cell in enumerate(item):
                        if isinstance(cell, str):
                            item[j] = _replace_in_string(cell, variables)
                elif isinstance(item, dict):
                    _replace_in_block(item, variables)


# ═══════════════════════════════════════════════════════════════
# CSV パース
# ═══════════════════════════════════════════════════════════════

def parse_csv_variables(csv_text: str) -> list[dict[str, str]]:
    """
    CSV テキストをパースして変数辞書のリストに変換。
    1行目はヘッダー（変数名）。
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for row in reader:
        # 空行をスキップ
        if any(v.strip() for v in row.values()):
            rows.append({k.strip(): v.strip() for k, v in row.items()})
    return rows


def parse_json_variables(json_text: str) -> list[dict[str, str]]:
    """
    JSON テキストをパースして変数辞書のリストに変換。
    [{"name": "太郎", "score": "95"}, ...] 形式を期待。
    """
    data = json.loads(json_text)
    if not isinstance(data, list):
        raise ValueError("JSON は配列形式 [{...}, ...] である必要があります")
    rows = []
    for item in data:
        if isinstance(item, dict):
            rows.append({str(k): str(v) for k, v in item.items()})
    return rows


# ═══════════════════════════════════════════════════════════════
# バッチ PDF 生成
# ═══════════════════════════════════════════════════════════════

class BatchResult:
    """バッチ生成結果"""
    def __init__(self):
        self.results: list[dict[str, Any]] = []
        self.success_count: int = 0
        self.error_count: int = 0
        self.total_time_ms: float = 0

    def add_success(self, index: int, filename: str, pdf_bytes: bytes, time_ms: float):
        self.results.append({
            "index": index,
            "filename": filename,
            "success": True,
            "pdf_bytes": pdf_bytes,
            "time_ms": round(time_ms, 1),
        })
        self.success_count += 1

    def add_error(self, index: int, filename: str, error: str):
        self.results.append({
            "index": index,
            "filename": filename,
            "success": False,
            "error": error,
        })
        self.error_count += 1


async def generate_batch_pdfs(
    template_doc: DocumentModel,
    variable_rows: list[dict[str, str]],
    *,
    filename_template: str = "{{_index}}_document",
    max_concurrent: int = 1,
    max_rows: int = 100,
) -> BatchResult:
    """
    テンプレート × 変数行で複数PDFを生成。

    Args:
        template_doc: テンプレートドキュメント
        variable_rows: 変数辞書のリスト (各行がCSVの1行に相当)
        filename_template: 出力ファイル名テンプレート (プレースホルダ使用可)
        max_concurrent: 最大同時コンパイル数
        max_rows: 最大処理行数

    Returns:
        BatchResult: 成功/失敗の結果
    """
    t0 = time.monotonic()
    result = BatchResult()

    # 行数制限
    rows = variable_rows[:max_rows]
    if len(variable_rows) > max_rows:
        logger.warning(f"[batch] Row limit exceeded: {len(variable_rows)} > {max_rows}")

    for i, variables in enumerate(rows):
        # _index 自動変数を追加
        variables_with_index = {**variables, "_index": str(i + 1)}

        try:
            # プレースホルダ置換
            doc = apply_variables(template_doc, variables_with_index)

            # ファイル名生成
            filename = _replace_in_string(filename_template, variables_with_index)
            if not filename.endswith(".pdf"):
                filename += ".pdf"

            # PDF コンパイル
            row_t0 = time.monotonic()
            pdf_bytes = await compile_pdf(doc)
            row_time = (time.monotonic() - row_t0) * 1000

            result.add_success(i, filename, pdf_bytes, row_time)
            logger.info(f"[batch] Row {i+1}/{len(rows)}: {filename} ({row_time:.0f}ms)")

        except PDFGenerationError as e:
            result.add_error(i, f"row_{i+1}.pdf", e.user_message)
            logger.warning(f"[batch] Row {i+1} failed: {e.user_message}")
        except Exception as e:
            result.add_error(i, f"row_{i+1}.pdf", str(e))
            logger.error(f"[batch] Row {i+1} unexpected error: {e}")

    result.total_time_ms = (time.monotonic() - t0) * 1000

    # 監査ログ
    log_batch_event(
        template=template_doc.template,
        variable_count=len(detect_placeholders(template_doc)),
        row_count=len(rows),
        success_count=result.success_count,
        error_count=result.error_count,
        total_time_ms=result.total_time_ms,
    )

    return result


def create_batch_zip(batch_result: BatchResult) -> bytes:
    """
    バッチ結果からZIPファイルを生成。
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in batch_result.results:
            if item["success"] and "pdf_bytes" in item:
                zf.writestr(item["filename"], item["pdf_bytes"])

        # エラーサマリーを含める
        if batch_result.error_count > 0:
            error_lines = []
            for item in batch_result.results:
                if not item["success"]:
                    error_lines.append(f"行 {item['index'] + 1}: {item.get('error', 'Unknown error')}")
            zf.writestr("_errors.txt", "\n".join(error_lines))

    return buf.getvalue()

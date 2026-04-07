"""
バッチ生成サービス: テンプレート × 変数 で PDF を量産

方針:
  - DocumentModel.latex 内 + metadata 内の `{{変数名}}` プレースホルダを検出
  - CSV/JSON 形式の変数データセットを受け取り
  - 各行ごとにプレースホルダを置換 → PDF 生成
  - ZIP でまとめてダウンロード
"""
import csv
import io
import json
import logging
import re
import time
import zipfile
from typing import Any

from .models import DocumentModel
from .pdf_service import compile_pdf, PDFGenerationError
from .audit import log_batch_event

logger = logging.getLogger(__name__)

PLACEHOLDER_RE = re.compile(r'\{\{\s*(\w+)\s*\}\}')


# ═══════════════════════════════════════════════════════════════
# プレースホルダ検出
# ═══════════════════════════════════════════════════════════════

def detect_placeholders(doc: DocumentModel) -> list[str]:
    """
    ドキュメント内 (latex + metadata) からプレースホルダ変数名を検出。
    重複なしのリストを返す。
    """
    found: set[str] = set()

    for field in ("title", "author", "date"):
        val = getattr(doc.metadata, field, None)
        if val:
            found.update(PLACEHOLDER_RE.findall(val))

    if doc.latex:
        found.update(PLACEHOLDER_RE.findall(doc.latex))

    return sorted(found)


# ═══════════════════════════════════════════════════════════════
# プレースホルダ置換
# ═══════════════════════════════════════════════════════════════

def _replace_in_string(s: str, variables: dict[str, str]) -> str:
    def replacer(match):
        var_name = match.group(1)
        return variables.get(var_name, match.group(0))
    return PLACEHOLDER_RE.sub(replacer, s)


def apply_variables(doc: DocumentModel, variables: dict[str, str]) -> DocumentModel:
    """
    ドキュメントのコピーを作成し、プレースホルダを変数値で置換。
    元のドキュメントは変更しない。
    """
    doc_dict = doc.model_dump(by_alias=False)

    for field in ("title", "author", "date"):
        if doc_dict["metadata"].get(field):
            doc_dict["metadata"][field] = _replace_in_string(
                doc_dict["metadata"][field], variables
            )

    if doc_dict.get("latex"):
        doc_dict["latex"] = _replace_in_string(doc_dict["latex"], variables)

    return DocumentModel.model_validate(doc_dict)


# ═══════════════════════════════════════════════════════════════
# CSV / JSON パース
# ═══════════════════════════════════════════════════════════════

def parse_csv_variables(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for row in reader:
        if any(v.strip() for v in row.values()):
            rows.append({k.strip(): v.strip() for k, v in row.items()})
    return rows


def parse_json_variables(json_text: str) -> list[dict[str, str]]:
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
    max_rows: int = 100,
) -> BatchResult:
    t0 = time.monotonic()
    result = BatchResult()

    rows = variable_rows[:max_rows]
    if len(variable_rows) > max_rows:
        logger.warning(f"[batch] Row limit exceeded: {len(variable_rows)} > {max_rows}")

    for i, variables in enumerate(rows):
        variables_with_index = {**variables, "_index": str(i + 1)}

        try:
            doc = apply_variables(template_doc, variables_with_index)

            filename = _replace_in_string(filename_template, variables_with_index)
            if not filename.endswith(".pdf"):
                filename += ".pdf"

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
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in batch_result.results:
            if item["success"] and "pdf_bytes" in item:
                zf.writestr(item["filename"], item["pdf_bytes"])

        if batch_result.error_count > 0:
            error_lines = []
            for item in batch_result.results:
                if not item["success"]:
                    error_lines.append(f"行 {item['index'] + 1}: {item.get('error', 'Unknown error')}")
            zf.writestr("_errors.txt", "\n".join(error_lines))

    return buf.getvalue()

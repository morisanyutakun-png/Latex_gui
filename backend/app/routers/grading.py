"""採点モード API ルーター

エンドポイント:
- POST /api/grading/parse-rubric           — LaTeX 内 `%@rubric:` をパース(AI 不使用)
- POST /api/grading/write-rubric           — 編集済みルーブリックを LaTeX に書き戻し
- POST /api/grading/extract-rubric/stream  — AI 自動補完(SSE)
- POST /api/grading/grade/stream           — AI 採点本体(SSE, multipart)
- POST /api/grading/render-feedback        — フィードバック PDF
- POST /api/grading/render-marked          — 赤入れ PDF (TikZ overlay)
"""
from __future__ import annotations

import base64
import json as _json
import logging
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from ..grading_models import GradingResult, RubricBundle, Rubric
from ..rubric_parser import parse_rubrics, serialize_rubrics_into_latex
from ..grading_service import extract_rubric_with_ai_stream, grade_answer_stream
from ..grading_renderer import (
    render_feedback_latex,
    render_marked_pdf_latex,
    compile_with_images,
)
from ..pdf_service import compile_raw_latex, PDFGenerationError


def _loc(locale: str, en: str, ja: str) -> str:
    return en if (locale or "").lower().startswith("en") else ja

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/grading", tags=["grading"])


# ──────────── 1) parse-rubric (決定論) ────────────

class ParseRubricRequest(BaseModel):
    latex: str = ""


@router.post("/parse-rubric", response_model=RubricBundle)
async def parse_rubric_endpoint(req: ParseRubricRequest) -> RubricBundle:
    """LaTeX 文字列から `%@rubric:` ブロックを抽出してルーブリック構造を返す。

    AI を使わない決定論的処理。プレビュー速度に影響しない。
    """
    return parse_rubrics(req.latex or "")


# ──────────── 2) write-rubric (決定論) ────────────

class WriteRubricRequest(BaseModel):
    latex: str = ""
    rubrics: list[Rubric] = []


class WriteRubricResponse(BaseModel):
    latex: str


@router.post("/write-rubric", response_model=WriteRubricResponse)
async def write_rubric_endpoint(req: WriteRubricRequest) -> WriteRubricResponse:
    """編集済みルーブリックを LaTeX に書き戻す。

    既存の `%@rubric-begin..end` ブロック群は丸ごと差し替える。
    `\\begin{document}` の直後 (またはファイル末尾) に挿入される。
    """
    new_latex = serialize_rubrics_into_latex(req.latex or "", req.rubrics)
    return WriteRubricResponse(latex=new_latex)


# ──────────── 3) extract-rubric/stream (AI 補完) ────────────

class ExtractRubricRequest(BaseModel):
    latex: str = ""
    locale: str = "ja"


@router.post("/extract-rubric/stream")
async def extract_rubric_stream_endpoint(req: ExtractRubricRequest):
    """問題LaTeX に AI が `%@rubric` コメントを追加した更新版 LaTeX を返す (SSE)。

    SSE events:
      data: {"type": "progress", "phase": "...", "message": "..."}
      data: {"type": "done", "latex": "...", "rubrics": {...}}
      data: {"type": "error", "message": "..."}
    """
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail={
                "message": _loc(
                    req.locale,
                    "Set ANTHROPIC_API_KEY in the backend environment to use AI features.",
                    "AI機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                ),
                "code": "MISSING_API_KEY",
            },
        )

    if not (req.latex or "").strip():
        raise HTTPException(
            status_code=400,
            detail={"message": _loc(req.locale, "Problem LaTeX is empty.", "問題LaTeX が空です")},
        )

    return StreamingResponse(
        extract_rubric_with_ai_stream(req.latex, locale=req.locale),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────── 4) grade/stream (AI 採点) ────────────

_ALLOWED_ANSWER_MIME = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
}
_MAX_ANSWER_SIZE = 20 * 1024 * 1024  # 1 ファイルあたり 20MB


@router.post("/grade/stream")
async def grade_stream_endpoint(
    request_json: str = Form(...),
    answers: list[UploadFile] = File(...),
):
    """AI 採点 SSE エンドポイント。

    multipart フォーム:
    - request_json: JSON 文字列 { rubrics, problemLatex, studentName, studentId, locale? }
    - answers[]:    1 つ以上の答案画像/PDF
    """
    try:
        req_data = _json.loads(request_json)
    except _json.JSONDecodeError:
        raise HTTPException(status_code=400, detail={"message": "request_json is not valid JSON."})

    locale = req_data.get("locale") or "ja"

    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail={
                "message": _loc(
                    locale,
                    "Set ANTHROPIC_API_KEY in the backend environment to use AI features.",
                    "AI機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                ),
                "code": "MISSING_API_KEY",
            },
        )

    rubrics_raw = req_data.get("rubrics") or {}
    problem_latex = req_data.get("problemLatex") or ""
    student_name = req_data.get("studentName") or ""
    student_id = req_data.get("studentId") or ""

    try:
        rubrics = RubricBundle.model_validate(rubrics_raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail={"message": _loc(
            locale,
            f"Invalid rubric bundle: {str(e)[:160]}",
            f"rubrics の検証に失敗: {str(e)[:160]}",
        )})

    if not rubrics.rubrics:
        raise HTTPException(status_code=400, detail={"message": _loc(
            locale, "The grading rubric is empty.", "採点基準が空です",
        )})

    if not answers:
        raise HTTPException(status_code=400, detail={"message": _loc(
            locale, "No answer files were provided.", "答案ファイルが指定されていません",
        )})

    # ファイル読み込み + 検証
    file_tuples: list[tuple[bytes, str, str]] = []
    for f in answers:
        data = await f.read()
        if len(data) > _MAX_ANSWER_SIZE:
            raise HTTPException(
                status_code=400,
                detail={"message": _loc(
                    locale,
                    f"{f.filename} exceeds the 20MB limit.",
                    f"{f.filename} は 20MB を超えています",
                )},
            )
        mime = f.content_type or "application/octet-stream"
        if mime not in _ALLOWED_ANSWER_MIME:
            raise HTTPException(
                status_code=400,
                detail={"message": _loc(
                    locale,
                    f"{f.filename}: supported formats are JPEG/PNG/GIF/WEBP/PDF ({mime}).",
                    f"{f.filename}: 対応形式は JPEG/PNG/GIF/WEBP/PDF です ({mime})",
                )},
            )
        file_tuples.append((data, mime, f.filename or "answer"))

    return StreamingResponse(
        grade_answer_stream(
            rubrics=rubrics,
            problem_latex=problem_latex,
            answer_files=file_tuples,
            student_name=student_name,
            student_id=student_id,
            locale=locale,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────── 5) render-feedback ────────────

class RenderFeedbackRequest(BaseModel):
    result: GradingResult
    locale: str = "ja"


@router.post("/render-feedback")
async def render_feedback_endpoint(req: RenderFeedbackRequest) -> Response:
    """採点結果からフィードバック文書 PDF を生成する。"""
    latex_source = render_feedback_latex(req.result, locale=req.locale)
    try:
        pdf_bytes = await compile_raw_latex(latex_source)
    except PDFGenerationError as e:
        raise HTTPException(
            status_code=422,
            detail={
                "message": _loc(
                    req.locale,
                    "Failed to generate the feedback PDF.",
                    "フィードバックPDFの生成に失敗しました",
                ),
                "detail": (e.detail or "")[:2000],
            },
        )

    filename = (req.result.student_name or "feedback").replace(" ", "_") + "_feedback.pdf"
    from urllib.parse import quote
    safe = quote(filename, safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe}"},
    )


# ──────────── 6) render-marked (TikZ overlay) ────────────

class RenderMarkedRequest(BaseModel):
    result: GradingResult
    locale: str = "ja"


@router.post("/render-marked")
async def render_marked_endpoint(req: RenderMarkedRequest) -> Response:
    """採点結果から TikZ overlay 赤入れ PDF を生成する。

    `result.answer_pages[i].image_url` は base64 data URL 必須。
    """
    # 画像を base64 → bytes に復元
    images: list[tuple[bytes, str]] = []
    for i, page in enumerate(req.result.answer_pages):
        if not page.image_url or not page.image_url.startswith("data:"):
            raise HTTPException(
                status_code=400,
                detail={"message": _loc(
                    req.locale,
                    f"Page {i + 1} image is not a data URL.",
                    f"ページ {i + 1} の画像が data URL 形式ではありません",
                )},
            )
        _header, _, b64 = page.image_url.partition(",")
        try:
            img_bytes = base64.b64decode(b64)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail={"message": _loc(
                    req.locale,
                    f"Could not decode page {i + 1} image.",
                    f"ページ {i + 1} の画像をデコードできませんでした",
                )},
            )
        images.append((img_bytes, f"page-{i + 1}.png"))

    # ファイル名列を作る
    image_filenames = [name for _, name in images]
    latex_source = render_marked_pdf_latex(req.result, image_filenames, locale=req.locale)

    try:
        pdf_bytes = await compile_with_images(latex_source, images)
    except PDFGenerationError as e:
        raise HTTPException(
            status_code=422,
            detail={
                "message": _loc(
                    req.locale,
                    "Failed to generate the marked-up PDF.",
                    "赤入れPDFの生成に失敗しました",
                ),
                "detail": (e.detail or "")[:2000],
            },
        )

    filename = (req.result.student_name or "marked").replace(" ", "_") + "_marked.pdf"
    from urllib.parse import quote
    safe = quote(filename, safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe}"},
    )

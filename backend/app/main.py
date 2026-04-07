"""FastAPI メインアプリケーション (raw LaTeX 駆動 v6)"""
import os
import json
import logging
from pathlib import Path
import pydantic
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, StreamingResponse

from .models import DocumentModel, ErrorResponse, BatchRequest, BatchResponse, BatchResultItem
from .pdf_service import compile_pdf, compile_raw_latex, generate_latex, PDFGenerationError
from .security import (
    validate_latex_security, validate_latex_size,
    SecurityViolation, ALLOWED_PACKAGES, ALLOWED_TIKZ_LIBRARIES,
)
from .cache_service import get_cache_stats, clear_all_caches
from .audit import (
    AuditMiddleware, AuditEvent, log_audit,
    log_security_event, get_recent_audit_logs,
)
from .batch_service import (
    detect_placeholders, generate_batch_pdfs,
    create_batch_zip, parse_csv_variables, parse_json_variables,
)
from .ai_service import chat as ai_chat, chat_stream as ai_chat_stream
from .omr_service import analyze_image as omr_analyze_image, analyze_image_stream as omr_analyze_image_stream
from .routers.subscription import router as subscription_router
from .routers.grading import router as grading_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LaTeX GUI - PDF生成API",
    description="raw LaTeX 駆動 + テンプレート + AI補助 (v6)",
    version="0.6.0",
)

# CORS設定
_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_env_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _env_origins:
    _origins = [o.strip() for o in _env_origins.split(",") if o.strip()]
else:
    _origins = _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuditMiddleware)
app.include_router(subscription_router)
app.include_router(grading_router)


@app.on_event("startup")
async def _startup_warmup():
    from .tex_env import start_background_warmup
    from .database import engine
    from .db_models import Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
    start_background_warmup()
    logger.info("Background TeX warmup triggered")


@app.get("/")
async def root_health():
    return {"status": "ok"}


@app.get("/api/health")
async def health_check():
    mem_info = _get_memory_info()
    return {
        "status": "ok",
        "message": "PDF生成サーバーは正常に動作しています",
        "memory": mem_info,
    }


def _get_memory_info() -> dict:
    info: dict = {}
    try:
        import resource
        import platform
        usage = resource.getrusage(resource.RUSAGE_SELF)
        maxrss = usage.ru_maxrss
        if platform.system() == "Linux":
            maxrss *= 1024
        info["process_rss_mb"] = round(maxrss / (1024 * 1024), 1)
    except Exception:
        info["process_rss_mb"] = -1

    try:
        p = Path("/sys/fs/cgroup/memory.max")
        if p.exists():
            val = p.read_text().strip()
            if val != "max":
                info["container_limit_mb"] = round(int(val) / (1024 * 1024), 1)
            else:
                info["container_limit_mb"] = "unlimited"
        else:
            p = Path("/sys/fs/cgroup/memory/memory.limit_in_bytes")
            if p.exists():
                val = int(p.read_text().strip())
                if val < 2**62:
                    info["container_limit_mb"] = round(val / (1024 * 1024), 1)
                else:
                    info["container_limit_mb"] = "unlimited"
    except Exception:
        info["container_limit_mb"] = "unknown"

    try:
        p = Path("/sys/fs/cgroup/memory.current")
        if p.exists():
            info["container_used_mb"] = round(int(p.read_text().strip()) / (1024 * 1024), 1)
        else:
            p = Path("/sys/fs/cgroup/memory/memory.usage_in_bytes")
            if p.exists():
                info["container_used_mb"] = round(int(p.read_text().strip()) / (1024 * 1024), 1)
    except Exception:
        pass

    return info


@app.get("/api/debug/warmup-status")
async def warmup_status():
    from .tex_env import (
        LUALATEX_JA_OK, LUALATEX_AVAILABLE,
        DEFAULT_ENGINE, is_warmup_done, is_lualatex_cache_warm,
    )
    return {
        "warmup_done": is_warmup_done(),
        "lualatex_cache_warm": is_lualatex_cache_warm(),
        "default_engine": DEFAULT_ENGINE,
        "availability": {
            "lualatex": LUALATEX_AVAILABLE,
        },
        "compile_tested": {
            "lualatex": LUALATEX_JA_OK,
        },
    }


@app.post("/api/preview-latex")
async def preview_latex(doc: DocumentModel):
    """LaTeXソースのプレビュー（生成済みLaTeXをそのまま返す）"""
    try:
        latex_source = generate_latex(doc)
        return {"success": True, "latex": latex_source}
    except PDFGenerationError as e:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": e.user_message,
        })
    except Exception as e:
        logger.error("LaTeX preview error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail={
            "success": False,
            "message": f"LaTeX生成中にエラーが発生しました: {str(e)[:200]}",
        })


@app.post("/api/generate-pdf")
async def generate_pdf(doc: DocumentModel):
    """PDF生成エンドポイント — DocumentModel.latex をコンパイルしてPDFバイトを返す"""
    if not (doc.latex or "").strip():
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": "LaTeXソースが空です。コンテンツを追加してください。",
        })

    try:
        pdf_bytes = await compile_pdf(doc)
    except PDFGenerationError as e:
        logger.error(f"PDF generation failed: {e.detail}")
        raise HTTPException(status_code=422, detail={
            "success": False,
            "message": e.user_message,
            "detail": e.detail[:2000] if e.detail else None,
        })
    except Exception as e:
        logger.exception("Unexpected error during PDF generation")
        raise HTTPException(status_code=500, detail={
            "success": False,
            "message": "予期しないエラーが発生しました。しばらく待ってからもう一度お試しください。",
        })

    filename = (doc.metadata.title or "document").replace(" ", "_") + ".pdf"

    from urllib.parse import quote
    safe_filename = quote(filename, safe="")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
        },
    )


class RawLatexRequest(pydantic.BaseModel):
    latex: str
    filename: str = "document"


@app.post("/api/compile-raw")
async def compile_raw(req: RawLatexRequest):
    """生のLaTeXソースを直接コンパイルしてPDFを返す"""
    try:
        pdf_bytes = await compile_raw_latex(req.latex)
    except PDFGenerationError as e:
        raise HTTPException(status_code=422, detail={
            "success": False,
            "message": e.user_message,
        })
    except Exception as e:
        logger.exception("Unexpected error during raw LaTeX compilation")
        raise HTTPException(status_code=500, detail={
            "success": False,
            "message": f"コンパイルエラー: {str(e)[:200]}",
        })
    from urllib.parse import quote
    safe_filename = quote((req.filename or "document").replace(" ", "_") + ".pdf", safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"},
    )


# ═══ バッチ生成 (教材工場) エンドポイント ═══

@app.post("/api/batch/detect-variables")
async def detect_variables(doc: DocumentModel):
    """テンプレート内の {{variables}} プレースホルダーを検出"""
    try:
        placeholders = detect_placeholders(doc)
        return {"success": True, "variables": placeholders}
    except Exception as e:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": f"変数検出に失敗: {str(e)}",
        })


@app.post("/api/batch/generate")
async def batch_generate_pdfs(req: BatchRequest):
    """テンプレート × 変数データで複数PDFを量産→ZIPで返却"""
    variable_rows = []
    try:
        if req.variables_csv:
            variable_rows = parse_csv_variables(req.variables_csv)
        elif req.variables_json:
            variable_rows = parse_json_variables(req.variables_json)
        else:
            raise HTTPException(status_code=400, detail={
                "success": False,
                "message": "variables_csv または variables_json が必要です",
            })
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": f"変数データのパースに失敗: {str(e)}",
        })

    if not variable_rows:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": "変数データが空です",
        })

    log_audit(AuditEvent.COMPILE_BATCH, details={
        "row_count": len(variable_rows),
        "template": req.template.template,
    })

    try:
        batch_result = await generate_batch_pdfs(
            req.template,
            variable_rows,
            filename_template=req.filename_template,
            max_rows=req.max_rows,
        )
    except Exception as e:
        logger.exception("Batch generation failed")
        raise HTTPException(status_code=500, detail={
            "success": False,
            "message": f"バッチ生成に失敗: {str(e)}",
        })

    if batch_result.success_count == 0:
        errors = [r.get("error", "") for r in batch_result.results if not r["success"]]
        raise HTTPException(status_code=422, detail={
            "success": False,
            "message": "全てのPDF生成に失敗しました",
            "errors": errors[:10],
        })

    zip_bytes = create_batch_zip(batch_result)

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="batch_output.zip"',
            "X-Batch-Total": str(len(variable_rows)),
            "X-Batch-Success": str(batch_result.success_count),
            "X-Batch-Errors": str(batch_result.error_count),
            "X-Batch-Time-Ms": str(round(batch_result.total_time_ms)),
        },
    )


@app.post("/api/batch/preview")
async def batch_preview(req: BatchRequest):
    """バッチ生成のプレビュー（最初の1行だけLaTeXソースを返す）"""
    variable_rows = []
    try:
        if req.variables_csv:
            variable_rows = parse_csv_variables(req.variables_csv)
        elif req.variables_json:
            variable_rows = parse_json_variables(req.variables_json)
    except Exception:
        pass

    if not variable_rows:
        return {"success": True, "latex": generate_latex(req.template), "variables": {}}

    from .batch_service import apply_variables
    first_row = variable_rows[0]
    doc = apply_variables(req.template, {**first_row, "_index": "1"})
    latex_source = generate_latex(doc)
    return {
        "success": True,
        "latex": latex_source,
        "variables": first_row,
        "total_rows": len(variable_rows),
    }


# ═══ キャッシュ管理 ═══

@app.get("/api/cache/stats")
async def cache_stats():
    return {"success": True, "stats": get_cache_stats()}


@app.post("/api/cache/clear")
async def cache_clear():
    clear_all_caches()
    log_audit(AuditEvent.CACHE_CLEAR)
    return {"success": True, "message": "キャッシュをクリアしました"}


# ═══ セキュリティ情報 ═══

@app.get("/api/security/allowed-packages")
async def get_allowed_packages():
    return {
        "success": True,
        "packages": sorted(ALLOWED_PACKAGES),
        "tikz_libraries": sorted(ALLOWED_TIKZ_LIBRARIES),
    }


# ═══ 監査ログ ═══

@app.get("/api/audit/logs")
async def audit_logs(limit: int = 100):
    logs = get_recent_audit_logs(limit=min(limit, 500))
    return {"success": True, "logs": logs, "count": len(logs)}


# ═══ AI チャット ═══

class ChatRequest(pydantic.BaseModel):
    messages: list[dict] = []
    document: dict = {}


@app.post("/api/ai/chat")
async def ai_chat_endpoint(request: ChatRequest):
    """AIチャット — raw LaTeX を直接編集する自律エージェント"""
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail={
                "message": "AI機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                "code": "MISSING_API_KEY",
            },
        )

    if not request.messages:
        raise HTTPException(status_code=400, detail={"message": "messages が空です"})

    try:
        result = await ai_chat(request.messages, request.document)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=503, detail={"message": str(e)})
    except Exception as e:
        logger.error("AI chat error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"message": f"AIエラー: {type(e).__name__}: {str(e)[:200]}"},
        )


@app.post("/api/ai/chat/stream")
async def ai_chat_stream_endpoint(request: ChatRequest):
    """AIチャット (SSEストリーミング)"""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "AI機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                "code": "MISSING_API_KEY",
            },
        )

    if not request.messages:
        raise HTTPException(status_code=400, detail={"message": "messages が空です"})

    logger.info("[stream] Starting SSE stream: %d messages", len(request.messages))

    return StreamingResponse(
        ai_chat_stream(request.messages, request.document),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ═══ OMR エンドポイント ═══

@app.post("/api/omr/analyze")
async def omr_analyze_endpoint(
    image: UploadFile = File(...),
    document: str = Form("{}"),
    hint: str = Form(""),
):
    """OMR解析 — 画像から raw LaTeX を抽出"""
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail={
                "message": "OMR機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                "code": "MISSING_API_KEY",
            },
        )

    image_bytes = await image.read()
    max_size = 20 * 1024 * 1024
    if len(image_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail={"message": "ファイルサイズは20MB以下にしてください"},
        )

    media_type = image.content_type or "image/jpeg"
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"}
    if media_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail={"message": "JPEG, PNG, GIF, WEBP, PDF に対応しています"},
        )

    try:
        doc_dict = json.loads(document) if document else {}
    except json.JSONDecodeError:
        doc_dict = {}

    try:
        result = await omr_analyze_image(image_bytes, media_type, doc_dict, hint)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=503, detail={"message": str(e)})
    except Exception as e:
        logger.error("OMR analyze error: %s", e)
        raise HTTPException(
            status_code=500,
            detail={"message": "画像解析中にエラーが発生しました。"},
        )


@app.post("/api/omr/analyze/stream")
async def omr_analyze_stream_endpoint(
    image: UploadFile = File(...),
    document: str = Form("{}"),
    hint: str = Form(""),
):
    """OMR解析 SSEストリーミング"""
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail={
                "message": "OMR機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                "code": "MISSING_API_KEY",
            },
        )

    image_bytes = await image.read()
    max_size = 20 * 1024 * 1024
    if len(image_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail={"message": "ファイルサイズは20MB以下にしてください"},
        )

    media_type = image.content_type or "image/jpeg"
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"}
    if media_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail={"message": "JPEG, PNG, GIF, WEBP, PDF に対応しています"},
        )

    try:
        doc_dict = json.loads(document) if document else {}
    except json.JSONDecodeError:
        doc_dict = {}

    return StreamingResponse(
        omr_analyze_image_stream(image_bytes, media_type, doc_dict, hint),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─────────────── Stripe Webhook ───────────────

from fastapi import Request as FastAPIRequest
from fastapi.responses import Response as FastAPIResponse
import stripe as _stripe


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: FastAPIRequest):
    """Stripe Webhook イベントを受信して処理する。"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    from .database import get_db as _get_db
    from .stripe_service import handle_webhook_event

    db = next(_get_db())
    try:
        handle_webhook_event(payload, sig_header, db)
    except _stripe.error.SignatureVerificationError:
        return FastAPIResponse(content="Invalid signature", status_code=400)
    except Exception as e:
        logger.error("Webhook processing error: %s", e)
        return FastAPIResponse(content="Webhook error", status_code=500)
    finally:
        db.close()

    return FastAPIResponse(content="OK", status_code=200)

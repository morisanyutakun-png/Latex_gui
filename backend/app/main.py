"""FastAPI メインアプリケーション (512MB最適化版 v5)"""
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
from .preview_service import preview_block_svg
from .security import (
    validate_document_security, validate_input_size,
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
from .omr_service import analyze_image as omr_analyze_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LaTeX GUI - PDF生成API",
    description="GUIで作成した文書をPDF化するAPI (クラウド軽量版 v4)",
    version="0.4.0",
)

# CORS設定（環境変数 ALLOWED_ORIGINS でカンマ区切り指定可能）
# Vercel の Route Handler 経由の場合、サーバー間通信なので CORS 不要。
# ローカル開発 & 直接アクセス用にのみ必要。
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

# ── 監査ログミドルウェア ──
app.add_middleware(AuditMiddleware)


# ── サーバー起動時にバックグラウンド・ウォームアップを開始 ──
@app.on_event("startup")
async def _startup_warmup():
    from .tex_env import start_background_warmup
    start_background_warmup()
    logger.info("Background TeX warmup triggered")


@app.get("/")
async def root_health():
    """ルートヘルスチェック (Koyeb等のデフォルトヘルスチェック用)"""
    return {"status": "ok"}


@app.get("/api/health")
async def health_check():
    """ヘルスチェック + メモリ使用量レポート"""
    mem_info = _get_memory_info()
    return {
        "status": "ok",
        "message": "PDF生成サーバーは正常に動作しています",
        "memory": mem_info,
    }


def _get_memory_info() -> dict:
    """プロセスメモリ + コンテナメモリ上限を取得"""
    info: dict = {}
    try:
        import resource
        import platform
        usage = resource.getrusage(resource.RUSAGE_SELF)
        maxrss = usage.ru_maxrss
        if platform.system() == "Linux":
            maxrss *= 1024  # KB → bytes
        info["process_rss_mb"] = round(maxrss / (1024 * 1024), 1)
    except Exception:
        info["process_rss_mb"] = -1

    # コンテナのメモリ上限を取得 (cgroup v1/v2)
    try:
        # cgroup v2
        p = Path("/sys/fs/cgroup/memory.max")
        if p.exists():
            val = p.read_text().strip()
            if val != "max":
                info["container_limit_mb"] = round(int(val) / (1024 * 1024), 1)
            else:
                info["container_limit_mb"] = "unlimited"
        else:
            # cgroup v1
            p = Path("/sys/fs/cgroup/memory/memory.limit_in_bytes")
            if p.exists():
                val = int(p.read_text().strip())
                if val < 2**62:  # "unlimited" は巨大な値
                    info["container_limit_mb"] = round(val / (1024 * 1024), 1)
                else:
                    info["container_limit_mb"] = "unlimited"
    except Exception:
        info["container_limit_mb"] = "unknown"

    # コンテナの現在のメモリ使用量 (cgroup)
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


@app.get("/api/debug/tex-info")
async def tex_debug_info():
    """TeX環境の診断情報を返す（LuaLaTeX 専用版）"""
    import shutil
    import subprocess
    from pathlib import Path
    from .tex_env import (
        LUALATEX_CMD, PDFTOCAIRO_CMD, DVISVGM_CMD,
        TEX_ENV, DEFAULT_ENGINE,
        LUALATEX_JA_OK, LUALATEX_AVAILABLE,
        LUATEXJA_STY_AVAILABLE, LUATEXJA_PRESET_AVAILABLE,
        DETECTED_CJK_MAIN_FONT, DETECTED_CJK_SANS_FONT,
        is_warmup_done, is_lualatex_cache_warm,
    )

    info: dict = {
        "warmup": {
            "done": is_warmup_done(),
            "lualatex_cache_warm": is_lualatex_cache_warm(),
        },
        "engine": {
            "default": DEFAULT_ENGINE,
            "mode": "lualatex-only",
            "lualatex_ja_ok": LUALATEX_JA_OK,
        },
        "availability": {
            "lualatex": LUALATEX_AVAILABLE,
        },
        "packages": {
            "luatexja_sty": LUATEXJA_STY_AVAILABLE,
            "luatexja_preset_sty": LUATEXJA_PRESET_AVAILABLE,
        },
        "commands": {
            "lualatex": {"path": LUALATEX_CMD, "exists": bool(shutil.which(LUALATEX_CMD) or Path(LUALATEX_CMD).is_file())},
            "pdftocairo": {"path": PDFTOCAIRO_CMD, "exists": bool(shutil.which(PDFTOCAIRO_CMD))},
            "dvisvgm": {"path": DVISVGM_CMD, "exists": bool(shutil.which(DVISVGM_CMD))},
        },
        "fonts": {
            "main": DETECTED_CJK_MAIN_FONT,
            "sans": DETECTED_CJK_SANS_FONT,
        },
        "env": {
            "COMPILE_TIMEOUT_SECONDS": os.environ.get("COMPILE_TIMEOUT_SECONDS", "120"),
        },
    }

    # Test fc-list (fast)
    if shutil.which("fc-list"):
        try:
            result = subprocess.run(
                ["fc-list", ":lang=ja", "family"],
                capture_output=True, text=True, timeout=5
            )
            fonts = sorted(set(l.strip() for l in result.stdout.split("\n") if l.strip()))
            info["fc_list_ja"] = fonts[:20]
        except Exception as e:
            info["fc_list_ja"] = f"error: {e}"
    else:
        info["fc_list_ja"] = "fc-list not available"

    # ── .sty ファイルシステム検索 (luatexja のみ) ──
    sty_files = {}
    for sty_name in ["luatexja.sty", "luatexja-preset.sty"]:
        try:
            r = subprocess.run(
                ["find", "/usr", "-name", sty_name, "-type", "f"],
                capture_output=True, text=True, timeout=10,
            )
            paths = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
            sty_files[sty_name] = paths if paths else "NOT FOUND"
        except Exception:
            sty_files[sty_name] = "search failed"
    info["sty_filesystem"] = sty_files

    # OS info
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    info["os"] = line.strip().split("=", 1)[1].strip('"')
                    break
    except Exception:
        info["os"] = "unknown"

    return info


@app.get("/api/debug/warmup-status")
async def warmup_status():
    """ウォームアップ状態を即座に返す (軽量)"""
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


@app.get("/api/capabilities")
async def get_capabilities():
    """利用可能な機能一覧を返す"""
    return {
        "blockTypes": [
            "heading", "paragraph", "math", "list", "table", "image",
            "divider", "code", "quote", "circuit", "diagram", "chemistry", "chart",
        ],
        "engineeringFeatures": {
            "circuit": {"package": "circuitikz", "description": "電子回路図の描画"},
            "diagram": {"package": "tikz", "description": "フローチャート・ブロック図・状態遷移図"},
            "chemistry": {"package": "mhchem", "description": "化学反応式・分子式"},
            "chart": {"package": "pgfplots", "description": "データグラフ・プロット"},
            "math": {"package": "amsmath", "description": "高品質な数式組版"},
        },
        "templates": [
            "report", "announcement", "worksheet", "academic", "resume",
            "circuit", "control", "chemistry", "physics", "algorithm",
            "math-proof", "tech-spec", "blank",
        ],
    }


@app.post("/api/preview-latex")
async def preview_latex(doc: DocumentModel):
    """LaTeXソースのプレビュー（デバッグ用）"""
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


from pydantic import BaseModel as _BM

class PreviewBlockRequest(_BM):
    code: str
    block_type: str  # circuit, diagram, chart
    caption: str = ""


@app.post("/api/preview-block")
async def preview_block(req: PreviewBlockRequest):
    """ブロック単位のSVGプレビューを生成"""
    if not req.code.strip():
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": "コードが空です",
        })
    try:
        svg = preview_block_svg(req.code, req.block_type, req.caption)
        return {"success": True, "svg": svg}
    except RuntimeError as e:
        logger.error(f"Preview generation failed: {e}")
        raise HTTPException(status_code=422, detail={
            "success": False,
            "message": f"プレビュー生成に失敗: {str(e)}",
        })
    except Exception as e:
        logger.exception("Unexpected error during preview")
        raise HTTPException(status_code=500, detail={
            "success": False,
            "message": "プレビューの生成中にエラーが発生しました",
        })


@app.post("/api/generate-pdf")
async def generate_pdf(doc: DocumentModel):
    """PDF生成エンドポイント"""
    # バリデーション
    if not doc.blocks:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "message": "ブロックが1つもありません。コンテンツを追加してください。",
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

    # RFC 5987: non-ASCII filenames use filename*=UTF-8'' encoding
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
    """生のLaTeXソースを直接コンパイルしてPDFを返す（LaTeXソースビューワ用）"""
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
    # 変数データのパース
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

    # ZIP 生成して返却
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


# ═══ キャッシュ管理 エンドポイント ═══

@app.get("/api/cache/stats")
async def cache_stats():
    """キャッシュ統計情報"""
    return {"success": True, "stats": get_cache_stats()}


@app.post("/api/cache/clear")
async def cache_clear():
    """全キャッシュクリア"""
    clear_all_caches()
    log_audit(AuditEvent.CACHE_CLEAR)
    return {"success": True, "message": "キャッシュをクリアしました"}


# ═══ セキュリティ情報 エンドポイント ═══

@app.get("/api/security/allowed-packages")
async def get_allowed_packages():
    """許可されたパッケージ一覧"""
    return {
        "success": True,
        "packages": sorted(ALLOWED_PACKAGES),
        "tikz_libraries": sorted(ALLOWED_TIKZ_LIBRARIES),
    }


# ═══ 監査ログ エンドポイント ═══

@app.get("/api/audit/logs")
async def audit_logs(limit: int = 100):
    """最近の監査ログを取得"""
    logs = get_recent_audit_logs(limit=min(limit, 500))
    return {"success": True, "logs": logs, "count": len(logs)}


# ═══ AI チャット エンドポイント ═══

class ChatRequest(pydantic.BaseModel):
    messages: list[dict] = []
    document: dict = {}
    requestPatches: bool = True


@app.post("/api/ai/chat")
async def ai_chat_endpoint(request: ChatRequest):
    """AIチャット — 文書コンテキストを使ったClaudeとの会話"""
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
    """AIチャット (SSEストリーミング) — リアルタイムでトークンを返す"""
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

    logger.info("[stream] Starting SSE stream: %d messages, key=%s...%s",
                len(request.messages), api_key[:4], api_key[-4:])

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
    """OMR解析 — 画像から文書ブロックを抽出"""
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail={
                "message": "OMR機能を使うにはバックエンドで ANTHROPIC_API_KEY を設定してください。",
                "code": "MISSING_API_KEY",
            },
        )

    image_bytes = await image.read()
    max_size = 20 * 1024 * 1024  # 20MB (PDFは大きい場合がある)
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


# ─────────────── Scoring (採点) ───────────────

from app.models import ScoreRequest, ScoreResult
from app.scoring_service import score_answers


@app.post("/api/scoring/score", response_model=ScoreResult)
async def scoring_score(req: ScoreRequest):
    """解答キーと生徒の回答を比較して採点する"""
    return score_answers(req.answer_key, req.student_answers)

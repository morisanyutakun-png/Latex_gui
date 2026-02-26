"""FastAPI メインアプリケーション (クラウド軽量版 v4)"""
import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

from .models import DocumentModel, ErrorResponse
from .pdf_service import compile_pdf, generate_latex, PDFGenerationError
from .preview_service import preview_block_svg

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


# ── サーバー起動時にバックグラウンド・ウォームアップを開始 ──
@app.on_event("startup")
async def _startup_warmup():
    from .tex_env import start_background_warmup
    start_background_warmup()
    logger.info("Background TeX warmup triggered")


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
    """現在のプロセスメモリ使用量を取得"""
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF)
        # maxrss は macOS では bytes、Linux では KB
        import platform
        maxrss = usage.ru_maxrss
        if platform.system() == "Linux":
            maxrss *= 1024  # KB → bytes
        return {
            "rss_mb": round(maxrss / (1024 * 1024), 1),
        }
    except Exception:
        return {"rss_mb": -1}


@app.get("/api/debug/tex-info")
async def tex_debug_info():
    """TeX環境の診断情報を返す（軽量版 — コンパイルテストは実行しない）"""
    import shutil
    import subprocess
    from pathlib import Path
    from .tex_env import (
        XELATEX_CMD, PDFLATEX_CMD, LUALATEX_CMD, PDFTOCAIRO_CMD, DVISVGM_CMD,
        TEX_ENV, DEFAULT_ENGINE, FALLBACK_ENGINES,
        PDFLATEX_CJK_OK, LUALATEX_JA_OK, XELATEX_OK,
        CJK_STY_AVAILABLE, BXCJKJATYPE_AVAILABLE,
        XECJK_STY_AVAILABLE, LUATEXJA_STY_AVAILABLE,
        PDFLATEX_AVAILABLE, LUALATEX_AVAILABLE, XELATEX_AVAILABLE,
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
            "fallbacks": FALLBACK_ENGINES,
            "pdflatex_cjk_ok": PDFLATEX_CJK_OK,
            "lualatex_ja_ok": LUALATEX_JA_OK,
            "xelatex_ok": XELATEX_OK,
        },
        "availability": {
            "pdflatex": PDFLATEX_AVAILABLE,
            "lualatex": LUALATEX_AVAILABLE,
            "xelatex": XELATEX_AVAILABLE,
        },
        "packages": {
            "CJK_sty": CJK_STY_AVAILABLE,
            "bxcjkjatype_sty": BXCJKJATYPE_AVAILABLE,
            "xeCJK_sty": XECJK_STY_AVAILABLE,
            "luatexja_sty": LUATEXJA_STY_AVAILABLE,
        },
        "commands": {
            "pdflatex": {"path": PDFLATEX_CMD, "exists": bool(shutil.which(PDFLATEX_CMD) or Path(PDFLATEX_CMD).is_file())},
            "lualatex": {"path": LUALATEX_CMD, "exists": bool(shutil.which(LUALATEX_CMD) or Path(LUALATEX_CMD).is_file())},
            "xelatex": {"path": XELATEX_CMD, "exists": bool(shutil.which(XELATEX_CMD) or Path(XELATEX_CMD).is_file())},
            "pdftocairo": {"path": PDFTOCAIRO_CMD, "exists": bool(shutil.which(PDFTOCAIRO_CMD))},
            "dvisvgm": {"path": DVISVGM_CMD, "exists": bool(shutil.which(DVISVGM_CMD))},
        },
        "fonts": {
            "main": DETECTED_CJK_MAIN_FONT,
            "sans": DETECTED_CJK_SANS_FONT,
        },
        "env": {
            "CJK_MAIN_FONT": os.environ.get("CJK_MAIN_FONT", "(not set)"),
            "CJK_SANS_FONT": os.environ.get("CJK_SANS_FONT", "(not set)"),
            "TEXINPUTS": TEX_ENV.get("TEXINPUTS", "(not set)"),
            "COMPILE_MEM_LIMIT_MB": os.environ.get("COMPILE_MEM_LIMIT_MB", "512"),
            "COMPILE_TOTAL_BUDGET_SECONDS": os.environ.get("COMPILE_TOTAL_BUDGET_SECONDS", "42"),
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

    # ── .sty ファイルシステム検索 (fast) ──
    sty_files = {}
    for sty_name in ["CJK.sty", "bxcjkjatype.sty", "xeCJK.sty", "luatexja.sty"]:
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
        PDFLATEX_CJK_OK, LUALATEX_JA_OK, XELATEX_OK,
        PDFLATEX_AVAILABLE, LUALATEX_AVAILABLE, XELATEX_AVAILABLE,
        DEFAULT_ENGINE, is_warmup_done, is_lualatex_cache_warm,
    )
    return {
        "warmup_done": is_warmup_done(),
        "lualatex_cache_warm": is_lualatex_cache_warm(),
        "default_engine": DEFAULT_ENGINE,
        "availability": {
            "pdflatex": PDFLATEX_AVAILABLE,
            "lualatex": LUALATEX_AVAILABLE,
            "xelatex": XELATEX_AVAILABLE,
        },
        "compile_tested": {
            "pdflatex": PDFLATEX_CJK_OK,
            "lualatex": LUALATEX_JA_OK,
            "xelatex": XELATEX_OK,
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

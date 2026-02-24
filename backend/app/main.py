"""
FastAPI メインアプリケーション
"""
import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .models import DocumentModel, ErrorResponse
from .pdf_service import compile_pdf, generate_latex, PDFGenerationError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LaTeX GUI - PDF生成API",
    description="GUIで作成した文書をPDF化するAPI",
    version="0.1.0",
)

# CORS設定（環境変数 ALLOWED_ORIGINS でカンマ区切り指定可能）
_default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_origins = os.environ.get("ALLOWED_ORIGINS", "").split(",") if os.environ.get("ALLOWED_ORIGINS") else _default_origins
_origins = [o.strip() for o in _origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "PDF生成サーバーは正常に動作しています"}


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
        pdf_bytes = compile_pdf(doc)
    except PDFGenerationError as e:
        logger.error(f"PDF generation failed: {e.detail}")
        raise HTTPException(status_code=422, detail={
            "success": False,
            "message": e.user_message,
            "detail": e.detail[:500] if e.detail else None,
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

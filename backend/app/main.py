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
from .preview_service import preview_block_svg

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


@app.get("/api/debug/tex-info")
async def tex_debug_info():
    """TeX環境の診断情報を返す（デプロイ問題のデバッグ用）"""
    import shutil
    import subprocess
    from .tex_env import XELATEX_CMD, PDFLATEX_CMD, PDFTOCAIRO_CMD, DVISVGM_CMD, TEX_ENV
    from .generators.document_generator import CJK_MAIN_FONT, CJK_SANS_FONT

    info: dict = {
        "commands": {
            "xelatex": {"path": XELATEX_CMD, "exists": shutil.which(XELATEX_CMD) is not None},
            "pdflatex": {"path": PDFLATEX_CMD, "exists": shutil.which(PDFLATEX_CMD) is not None},
            "pdftocairo": {"path": PDFTOCAIRO_CMD, "exists": shutil.which(PDFTOCAIRO_CMD) is not None},
            "dvisvgm": {"path": DVISVGM_CMD, "exists": shutil.which(DVISVGM_CMD) is not None},
        },
        "fonts": {
            "main": CJK_MAIN_FONT,
            "sans": CJK_SANS_FONT,
        },
        "env": {
            "CJK_MAIN_FONT": os.environ.get("CJK_MAIN_FONT", "(not set)"),
            "CJK_SANS_FONT": os.environ.get("CJK_SANS_FONT", "(not set)"),
            "LIBGS": TEX_ENV.get("LIBGS", "(not set)"),
        },
    }

    # Test fc-list
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

    # Quick pdflatex compile test (primary engine — low memory)
    try:
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmpdir:
            tex = (
                "\\documentclass{article}\n"
                "\\usepackage[whole]{bxcjkjatype}\n"
                "\\begin{document}\nHello World テスト\n\\end{document}\n"
            )
            tex_path = Path(tmpdir) / "test.tex"
            tex_path.write_text(tex, encoding="utf-8")
            result = subprocess.run(
                [PDFLATEX_CMD, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", str(tmpdir), str(tex_path)],
                capture_output=True, text=True, timeout=15,
                cwd=tmpdir, env=TEX_ENV,
            )
            pdf_exists = (Path(tmpdir) / "test.pdf").exists()
            info["pdflatex_test"] = {
                "success": result.returncode == 0 and pdf_exists,
                "returncode": result.returncode,
                "pdf_generated": pdf_exists,
                "log_tail": result.stdout[-500:] if result.stdout else "",
                "stderr": result.stderr[-200:] if result.stderr else "",
            }
    except Exception as e:
        info["pdflatex_test"] = {"success": False, "error": str(e)}

    # Quick XeLaTeX compile test (fallback engine — high memory)
    try:
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmpdir:
            tex = (
                "\\documentclass{article}\n"
                "\\usepackage{fontspec}\n"
                f"\\IfFontExistsTF{{{CJK_MAIN_FONT}}}{{\\setmainfont{{{CJK_MAIN_FONT}}}}}{{\\typeout{{FONT NOT FOUND}}}}\n"
                "\\begin{document}\nHello World テスト\n\\end{document}\n"
            )
            tex_path = Path(tmpdir) / "test.tex"
            tex_path.write_text(tex, encoding="utf-8")
            result = subprocess.run(
                [XELATEX_CMD, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", str(tmpdir), str(tex_path)],
                capture_output=True, text=True, timeout=15,
                cwd=tmpdir, env=TEX_ENV,
            )
            pdf_exists = (Path(tmpdir) / "test.pdf").exists()
            info["xelatex_test"] = {
                "success": result.returncode == 0 and pdf_exists,
                "returncode": result.returncode,
                "pdf_generated": pdf_exists,
                "log_tail": result.stdout[-500:] if result.stdout else "",
                "stderr": result.stderr[-200:] if result.stderr else "",
            }
    except Exception as e:
        info["xelatex_test"] = {"success": False, "error": str(e)}

    return info


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
        pdf_bytes = compile_pdf(doc)
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

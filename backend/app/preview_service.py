"""
ブロックプレビューサービス: LaTeXブロック → SVG画像
回路図・ダイアグラム等のリアルタイムプレビュー用

最適化:
  - pdflatex を使用 (CJK不要のブロックなので xelatex より高速)
  - pdftocairo で直接 PDF→SVG 変換 (dvisvgm の Ghostscript 問題を回避)
  - インメモリ LRU キャッシュ (同一コードの再コンパイル回避)
"""
import subprocess
import tempfile
import hashlib
import logging
import shutil
from pathlib import Path

from .tex_env import TEX_ENV, PDFLATEX_CMD, PDFTOCAIRO_CMD, DVISVGM_CMD

logger = logging.getLogger(__name__)

# LRU cache for compiled SVGs (up to 128 entries)
_svg_cache: dict[str, str] = {}
MAX_CACHE = 128


def _get_cache_key(code: str, block_type: str) -> str:
    """Generate a cache key from code + type."""
    return hashlib.md5(f"{block_type}:{code}".encode()).hexdigest()


def preview_block_svg(code: str, block_type: str, caption: str = "") -> str:
    """
    Compile a LaTeX block to SVG for preview.
    Returns SVG string or raises an exception on failure.
    """
    if not code.strip():
        return ""

    cache_key = _get_cache_key(code, block_type)
    if cache_key in _svg_cache:
        return _svg_cache[cache_key]

    latex_source = _wrap_block_latex(code, block_type)
    svg = _compile_to_svg(latex_source)

    # Cache the result
    if len(_svg_cache) >= MAX_CACHE:
        # Remove oldest entry
        oldest = next(iter(_svg_cache))
        del _svg_cache[oldest]
    _svg_cache[cache_key] = svg

    return svg


def _wrap_block_latex(code: str, block_type: str) -> str:
    """Wrap block code in a minimal standalone LaTeX document."""
    # Common preamble
    preamble_lines = [
        "\\documentclass[border=5pt,varwidth]{standalone}",
        "\\usepackage{tikz}",
    ]

    if block_type == "circuit":
        preamble_lines.append("\\usepackage{circuitikz}")
        preamble_lines.append(
            "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,"
            "decorations.markings,automata,fit}"
        )
        body = (
            "\\begin{circuitikz}[american]\n"
            f"{code}\n"
            "\\end{circuitikz}"
        )
    elif block_type == "diagram":
        preamble_lines.append(
            "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,"
            "decorations.markings,automata,fit}"
        )
        body = (
            "\\begin{tikzpicture}\n"
            f"{code}\n"
            "\\end{tikzpicture}"
        )
    elif block_type == "chart":
        preamble_lines.append("\\usepackage{pgfplots}")
        preamble_lines.append("\\pgfplotsset{compat=1.18}")
        body = (
            "\\begin{tikzpicture}\n"
            "\\begin{axis}[grid=major]\n"
            f"{code}\n"
            "\\end{axis}\n"
            "\\end{tikzpicture}"
        )
    else:
        body = code

    preamble = "\n".join(preamble_lines)
    return f"{preamble}\n\\begin{{document}}\n{body}\n\\end{{document}}"


def _compile_to_svg(latex_source: str) -> str:
    """Compile LaTeX source to SVG.
    
    Pipeline: pdflatex → PDF → pdftocairo → SVG
    (pdflatex is ~40% faster than xelatex for non-CJK content)
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "preview.tex"
        pdf_path = Path(tmpdir) / "preview.pdf"
        svg_path = Path(tmpdir) / "preview.svg"

        tex_path.write_text(latex_source, encoding="utf-8")

        # Step 1: Compile LaTeX → PDF (pdflatex: fast, no fontspec overhead)
        try:
            result = subprocess.run(
                [
                    PDFLATEX_CMD,
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-no-shell-escape",
                    "-output-directory", str(tmpdir),
                    str(tex_path),
                ],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=tmpdir,
                env=TEX_ENV,
            )
        except FileNotFoundError:
            raise RuntimeError("pdflatex not found")
        except subprocess.TimeoutExpired:
            raise RuntimeError("LaTeX compilation timeout")

        if result.returncode != 0 or not pdf_path.exists():
            log = result.stdout + "\n" + result.stderr
            error_lines = [l for l in log.split("\n") if l.startswith("!")]
            error_msg = "; ".join(error_lines[:3]) if error_lines else "Unknown compilation error"
            logger.error(f"Preview compilation failed: {error_msg}")
            raise RuntimeError(f"LaTeX compilation error: {error_msg}")

        # Step 2: PDF → SVG (pdftocairo: reliable on macOS, no Ghostscript lib needed)
        if PDFTOCAIRO_CMD:
            try:
                result = subprocess.run(
                    [PDFTOCAIRO_CMD, "-svg", str(pdf_path), str(svg_path)],
                    capture_output=True, text=True, timeout=5,
                    cwd=tmpdir, env=TEX_ENV,
                )
                if result.returncode == 0 and svg_path.exists():
                    return svg_path.read_text(encoding="utf-8")
                logger.warning(f"pdftocairo failed: {result.stderr}")
            except Exception as e:
                logger.warning(f"pdftocairo error: {e}")

        # Fallback: dvisvgm (if LIBGS is set in TEX_ENV)
        if DVISVGM_CMD:
            try:
                result = subprocess.run(
                    [DVISVGM_CMD, "--pdf", "--no-fonts", "--exact-bbox",
                     "-o", str(svg_path), str(pdf_path)],
                    capture_output=True, text=True, timeout=5,
                    cwd=tmpdir, env=TEX_ENV,
                )
                if result.returncode == 0 and svg_path.exists():
                    return svg_path.read_text(encoding="utf-8")
                logger.warning(f"dvisvgm failed: {result.stderr}")
            except Exception as e:
                logger.warning(f"dvisvgm error: {e}")

        raise RuntimeError("SVG変換に失敗しました")


def clear_preview_cache():
    """Clear the SVG preview cache."""
    _svg_cache.clear()

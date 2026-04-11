"""Compile an arbitrary user-supplied TikZ / circuitikz / pgfplots snippet
into a cached PNG. Used by the Visual Editor to render figures that the AI
wrote freestyle (no figure-library id marker) so the browser can still see
a real preview.

Every snippet goes through `validate_latex_security` before lualatex sees it.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from ..security import (
    ALLOWED_PACKAGES,
    ALLOWED_TIKZ_LIBRARIES,
    get_compile_args,
    validate_latex_security,
)
from ..tex_env import LUALATEX_CMD, TEX_ENV
from .loader import asset_root

logger = logging.getLogger(__name__)

_PREVIEW_TIMEOUT_SEC = 30
_snippet_semaphore = asyncio.Semaphore(2)
_MAX_SNIPPET_LEN = 16 * 1024

_TIKZ_ENV_RE = re.compile(
    r"\\begin\{(tikzpicture|circuitikz|pgfpicture)\}[\s\S]*?\\end\{\1\}"
)
_USETIKZLIB_RE = re.compile(r"\\usetikzlibrary\{([^}]+)\}")
_USEPACKAGE_RE = re.compile(r"\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}")
_HAS_PGFPLOTS = re.compile(r"\\begin\{axis\}|\\begin\{groupplot\}|\\addplot")
_HAS_CIRCUITIKZ = re.compile(r"\\begin\{circuitikz\}")


class SnippetError(RuntimeError):
    pass


def snippet_cache_dir() -> Path:
    return asset_root() / "_snippets"


def _normalize_body(src: str) -> str:
    """Extract just the first tikz/circuitikz/pgfpicture environment."""
    m = _TIKZ_ENV_RE.search(src)
    if not m:
        raise SnippetError("no tikzpicture / circuitikz environment found")
    return m.group(0)


def _detect_packages(src: str) -> list[str]:
    """Detect which packages the snippet + surrounding source want."""
    pkgs: set[str] = set()
    for m in _USEPACKAGE_RE.finditer(src):
        for p in m.group(1).split(","):
            p = p.strip()
            if p in ALLOWED_PACKAGES:
                pkgs.add(p)
    if _HAS_PGFPLOTS.search(src):
        pkgs.add("pgfplots")
    if _HAS_CIRCUITIKZ.search(src):
        pkgs.add("circuitikz")
    if not pkgs or pkgs == {"pgfplots"}:
        pkgs.add("tikz")
    return sorted(pkgs)


def _detect_libraries(src: str) -> list[str]:
    libs: set[str] = set()
    for m in _USETIKZLIB_RE.finditer(src):
        for lib in m.group(1).split(","):
            lib = lib.strip()
            if lib in ALLOWED_TIKZ_LIBRARIES:
                libs.add(lib)
    return sorted(libs)


def snippet_hash(body: str, pkgs: list[str], libs: list[str]) -> str:
    h = hashlib.sha256()
    h.update(body.encode("utf-8"))
    h.update(b"\x00")
    h.update(",".join(pkgs).encode("utf-8"))
    h.update(b"\x00")
    h.update(",".join(libs).encode("utf-8"))
    return h.hexdigest()[:32]


def snippet_png_path(key: str) -> Path:
    return snippet_cache_dir() / f"{key}.png"


def _build_standalone(body: str, pkgs: list[str], libs: list[str]) -> str:
    lines = [r"\documentclass[border=4pt]{standalone}"]
    has_non_ascii = any(ord(c) > 127 for c in body)
    if has_non_ascii:
        lines.append(r"\usepackage{luatexja-preset}")
    if "tikz" not in pkgs and "pgfplots" not in pkgs and "circuitikz" not in pkgs:
        lines.append(r"\usepackage{tikz}")
    for p in pkgs:
        lines.append(f"\\usepackage{{{p}}}")
    if libs:
        lines.append(f"\\usetikzlibrary{{{','.join(libs)}}}")
    if "pgfplots" in pkgs:
        lines.append(r"\pgfplotsset{compat=1.18}")
    lines.append(r"\begin{document}")
    lines.append(body)
    lines.append(r"\end{document}")
    return "\n".join(lines) + "\n"


def _run(cmd: list[str], cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=_PREVIEW_TIMEOUT_SEC,
        cwd=cwd,
        env=TEX_ENV,
    )


def _build_png_sync(key: str, body: str, pkgs: list[str], libs: list[str]) -> Path:
    out = snippet_png_path(key)
    out.parent.mkdir(parents=True, exist_ok=True)

    tex = _build_standalone(body, pkgs, libs)

    with tempfile.TemporaryDirectory(prefix="figsnip_") as tmpdir:
        tex_path = Path(tmpdir) / "snip.tex"
        pdf_path = Path(tmpdir) / "snip.pdf"
        tex_path.write_text(tex, encoding="utf-8")

        result = _run(get_compile_args(LUALATEX_CMD, tmpdir, str(tex_path)), tmpdir)
        if result.returncode != 0 or not pdf_path.exists():
            tail = (result.stdout + "\n" + result.stderr)[-1500:]
            raise SnippetError(f"lualatex failed: {tail}")

        pdfcrop = shutil.which("pdfcrop")
        if pdfcrop:
            cropped = Path(tmpdir) / "snip-cropped.pdf"
            r = _run([pdfcrop, "--margins", "6", str(pdf_path), str(cropped)], tmpdir)
            if r.returncode == 0 and cropped.exists():
                pdf_path = cropped

        pdftoppm = shutil.which("pdftoppm")
        if not pdftoppm:
            raise SnippetError("pdftoppm not available")

        png_prefix = Path(tmpdir) / "page"
        r = _run(
            [pdftoppm, "-png", "-r", "180", "-singlefile", str(pdf_path), str(png_prefix)],
            tmpdir,
        )
        png_out = Path(tmpdir) / "page.png"
        if r.returncode != 0 or not png_out.exists():
            cands = sorted(Path(tmpdir).glob("page*.png"))
            if not cands:
                raise SnippetError(f"pdftoppm failed: {r.stderr[-300:]}")
            png_out = cands[0]
        shutil.copyfile(png_out, out)

    return out


async def compile_snippet(source: str) -> tuple[Path, str]:
    """Compile an arbitrary tikz/circuitikz snippet → PNG path + cache key.

    `source` can be either just the `\\begin{tikzpicture}...\\end{tikzpicture}`
    block or a longer string that contains one. Packages / tikz libraries are
    auto-detected from the surrounding text when available, otherwise inferred
    from the body (e.g. `\\addplot` → pgfplots, `\\begin{circuitikz}` → circuitikz).
    """
    if not source or len(source) > _MAX_SNIPPET_LEN:
        raise SnippetError(f"snippet too large (>{_MAX_SNIPPET_LEN} bytes) or empty")

    body = _normalize_body(source)
    pkgs = _detect_packages(source)
    libs = _detect_libraries(source)

    # Validate the body (not the surrounding source) against the allowlist.
    # This rejects \input / \write18 / unknown \usepackage etc.
    violations = validate_latex_security(body)
    if violations:
        raise SnippetError(f"security violation: {violations[:3]}")

    key = snippet_hash(body, pkgs, libs)
    out = snippet_png_path(key)
    if out.exists() and out.stat().st_size > 0:
        return out, key

    async with _snippet_semaphore:
        if out.exists() and out.stat().st_size > 0:
            return out, key
        loop = asyncio.get_event_loop()
        return (
            await loop.run_in_executor(None, _build_png_sync, key, body, pkgs, libs),
            key,
        )

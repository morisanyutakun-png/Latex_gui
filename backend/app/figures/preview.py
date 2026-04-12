"""Standalone preview rendering for figure assets.

Compiles each asset once with its canonical `preview.params` values and caches
the result as a PNG on disk. Subsequent requests return the cached file.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from ..security import get_compile_args
from ..tex_env import LUALATEX_CMD, TEX_ENV
from .loader import asset_root
from .registry import FigureRegistry, get_registry
from .render import render_asset

logger = logging.getLogger(__name__)

_PREVIEW_TIMEOUT_SEC = 30
_preview_semaphore = asyncio.Semaphore(2)


class PreviewError(RuntimeError):
    """Raised when asset preview rendering fails."""


def preview_cache_dir() -> Path:
    return asset_root() / "_previews"


def preview_path(asset_id: str) -> Path:
    category, _, slug = asset_id.partition(".")
    return preview_cache_dir() / category / f"{slug}.png"


def _has_non_ascii(s: str) -> bool:
    return any(ord(c) > 127 for c in s)


def _standalone_doc(asset: dict[str, Any]) -> str:
    """Build a minimal \\documentclass{standalone} wrapper around the asset body.

    Avoids the `[tikz]` class option because it only auto-previews the
    `tikzpicture` environment, leaving `circuitikz` renders on a full letter
    page. Instead we load `standalone` bare and run `pdfcrop` afterwards.
    """
    rendered = render_asset(asset, asset.get("preview", {}).get("params"))
    pkgs = list(rendered.required_packages)
    libs = list(rendered.required_tikzlibraries)

    lines = [
        r"\documentclass[border=4pt]{standalone}",
    ]
    # Only pull in Japanese font support when the body actually needs it —
    # luatexja-preset occasionally interacts badly with standalone's page
    # sizing, so we avoid loading it when unnecessary.
    if _has_non_ascii(rendered.tikz_body):
        lines.append(r"\usepackage{luatexja-preset}")
    if "tikz" not in pkgs and "pgfplots" not in pkgs and "circuitikz" not in pkgs:
        lines.append(r"\usepackage{tikz}")
    for p in pkgs:
        lines.append(f"\\usepackage{{{p}}}")
    if libs:
        lines.append(f"\\usetikzlibrary{{{','.join(libs)}}}")
    if "pgfplots" in pkgs:
        lines.append(r"\pgfplotsset{compat=1.18}")
        # pgfplots sub-libraries we load by default for asset bodies because
        # they're cheap and widely used (integral area, stacked plots, stats).
        lines.append(r"\usepgfplotslibrary{fillbetween}")
    lines.append(r"\begin{document}")
    lines.append(rendered.tikz_body)
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


def _build_png_sync(asset_id: str) -> Path:
    reg: FigureRegistry = get_registry()
    asset = reg.get_raw(asset_id)
    if not asset:
        raise PreviewError(f"unknown asset: {asset_id}")

    out = preview_path(asset_id)
    out.parent.mkdir(parents=True, exist_ok=True)

    tex = _standalone_doc(asset)

    with tempfile.TemporaryDirectory(prefix="figprev_") as tmpdir:
        tex_path = Path(tmpdir) / "fig.tex"
        pdf_path = Path(tmpdir) / "fig.pdf"
        tex_path.write_text(tex, encoding="utf-8")

        cmd_args = get_compile_args(LUALATEX_CMD, tmpdir, str(tex_path))
        result = _run(cmd_args, tmpdir)
        if result.returncode != 0 or not pdf_path.exists():
            tail = (result.stdout + "\n" + result.stderr)[-2000:]
            raise PreviewError(f"lualatex failed for {asset_id}: {tail}")

        # Crop the PDF to its ink bounding box. This rescues circuitikz
        # (which standalone's [tikz] wrapper doesn't cover) and any figure
        # that leaks whitespace from the document class defaults.
        pdfcrop = shutil.which("pdfcrop")
        if pdfcrop:
            cropped = Path(tmpdir) / "fig-cropped.pdf"
            r = _run(
                [pdfcrop, "--margins", "6", str(pdf_path), str(cropped)],
                tmpdir,
            )
            if r.returncode == 0 and cropped.exists():
                pdf_path = cropped
            else:
                logger.warning("[figures] pdfcrop failed for %s: %s", asset_id, r.stderr[-300:])

        pdftoppm = shutil.which("pdftoppm")
        if pdftoppm:
            png_prefix = Path(tmpdir) / "page"
            r = _run(
                [pdftoppm, "-png", "-r", "180", "-singlefile", str(pdf_path), str(png_prefix)],
                tmpdir,
            )
            png_out = Path(tmpdir) / "page.png"
            if r.returncode != 0 or not png_out.exists():
                # Fallback: non-singlefile variant writes page-1.png etc.
                candidates = sorted(Path(tmpdir).glob("page*.png"))
                if not candidates:
                    raise PreviewError(f"pdftoppm failed for {asset_id}: {r.stderr[-500:]}")
                png_out = candidates[0]
            shutil.copyfile(png_out, out)
        else:
            logger.warning("[figures] pdftoppm not found — storing PDF bytes at %s", out)
            shutil.copyfile(pdf_path, out)

    return out


async def ensure_preview(asset_id: str) -> Path:
    """Return the on-disk path to the preview PNG, building it on demand.

    Concurrent callers for the same asset are serialized via a small semaphore;
    the on-disk cache makes subsequent lookups effectively free.
    """
    out = preview_path(asset_id)
    if out.exists() and out.stat().st_size > 0:
        return out
    async with _preview_semaphore:
        if out.exists() and out.stat().st_size > 0:
            return out
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _build_png_sync, asset_id)

"""Parameter substitution + figure splicing helpers."""
from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from typing import Any

from jinja2.sandbox import SandboxedEnvironment

from ..latex_autofix import (
    _BEGIN_DOCUMENT_RE,
    _USEPACKAGE_TIKZ_RE,
    _USETIKZLIBRARY_RE,
    _inject_packages,
)

logger = logging.getLogger(__name__)


# Jinja2 sandbox — autoescape off (target is LaTeX, not HTML).
# Default delimiters {{ var }} / {% ... %} are fine because TikZ rarely uses
# doubled braces. We validate params ourselves before rendering.
_JINJA_ENV = SandboxedEnvironment(
    autoescape=False,
    trim_blocks=False,
    lstrip_blocks=False,
    keep_trailing_newline=True,
)
# Expose safe math helpers so parameters can be composed numerically.
# Trig functions take RADIANS (Python's math module convention); templates
# that want degrees should convert via math.radians(...).
_JINJA_ENV.globals.update({
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "radians": math.radians,
    "degrees": math.degrees,
    "sqrt": math.sqrt,
    "pi": math.pi,
    "abs": abs,
    "round": round,
    "max": max,
    "min": min,
})


_STRING_FORBIDDEN_RE = re.compile(r"[\\%${}#&^~\n\r]")


class ParameterError(ValueError):
    """Raised when user-supplied parameters fail sanitization."""


@dataclass
class RenderedFigure:
    tikz_body: str
    required_packages: list[str]
    required_tikzlibraries: list[str]


def _sanitize_param(name: str, spec: dict[str, Any], value: Any) -> Any:
    ptype = spec.get("type")
    default = spec.get("default")

    if value is None:
        return default

    if ptype == "number":
        try:
            num = float(value)
        except (TypeError, ValueError) as e:
            raise ParameterError(f"{name}: expected number, got {value!r}") from e
        if math.isnan(num) or math.isinf(num):
            raise ParameterError(f"{name}: NaN/inf not allowed")
        lo = spec.get("min")
        hi = spec.get("max")
        if lo is not None:
            num = max(float(lo), num)
        if hi is not None:
            num = min(float(hi), num)
        # Render integers without a trailing .0 so TikZ output stays clean
        if num.is_integer():
            return int(num)
        return num

    if ptype == "integer":
        try:
            num = int(value)
        except (TypeError, ValueError) as e:
            raise ParameterError(f"{name}: expected integer, got {value!r}") from e
        lo = spec.get("min")
        hi = spec.get("max")
        if lo is not None:
            num = max(int(lo), num)
        if hi is not None:
            num = min(int(hi), num)
        return num

    if ptype == "enum":
        choices = spec.get("choices") or []
        if value in choices:
            return value
        logger.warning("[figures] enum %s: %r not in %s, using default", name, value, choices)
        return default

    if ptype == "string":
        if not isinstance(value, str):
            value = str(value)
        if _STRING_FORBIDDEN_RE.search(value):
            raise ParameterError(
                f"{name}: string contains forbidden characters "
                r"(one of \\ % $ { } # & ^ ~ or newline)"
            )
        max_len = int(spec.get("max_len", 120))
        if len(value) > max_len:
            raise ParameterError(f"{name}: string too long (> {max_len} chars)")
        return value

    if ptype == "boolean":
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return "true" if value else "false"
        if isinstance(value, str) and value.lower() in {"true", "false", "0", "1"}:
            return "true" if value.lower() in {"true", "1"} else "false"
        raise ParameterError(f"{name}: expected boolean, got {value!r}")

    raise ParameterError(f"{name}: unknown parameter type {ptype!r}")


def sanitize_params(asset: dict[str, Any], params: dict[str, Any] | None) -> dict[str, Any]:
    """Return a dict of sanitized values for the asset's declared parameters.

    Unknown keys in `params` are silently dropped. Missing keys fall back to
    the parameter's declared default.
    """
    out: dict[str, Any] = {}
    specs = asset.get("parameters") or {}
    supplied = params or {}
    for name, spec in specs.items():
        raw = supplied.get(name, spec.get("default"))
        out[name] = _sanitize_param(name, spec, raw)
    return out


def render_asset(asset: dict[str, Any], params: dict[str, Any] | None = None) -> RenderedFigure:
    """Substitute parameters into the asset body and return a RenderedFigure."""
    clean = sanitize_params(asset, params)
    template = _JINJA_ENV.from_string(asset["body"])
    body = template.render(**clean)
    return RenderedFigure(
        tikz_body=body,
        required_packages=list(asset.get("required_packages") or []),
        required_tikzlibraries=list(asset.get("required_tikzlibraries") or []),
    )


# ─── Library injection ─────────────────────────────────────────────

def ensure_figure_libraries(src: str, libs: list[str]) -> str:
    """Ensure the given \\usetikzlibrary{...} entries exist in the preamble.

    Mirrors latex_autofix._ensure_tikz_libraries but takes an explicit list of
    libraries (not a fixed set). No-op when `src` has no tikz/pgfplots/circuitikz
    package loaded — caller is expected to call _inject_packages first.
    """
    if not libs:
        return src

    already: set[str] = set()
    for m in _USETIKZLIBRARY_RE.finditer(src):
        for lib in m.group(1).split(","):
            already.add(lib.strip())

    missing = [lib for lib in libs if lib and lib not in already]
    if not missing:
        return src

    insertion = f"\\usetikzlibrary{{{','.join(missing)}}}"

    # Prefer appending right after the last existing \usetikzlibrary line
    last_utl = None
    for m in _USETIKZLIBRARY_RE.finditer(src):
        last_utl = m
    if last_utl:
        pos = last_utl.end()
        return src[:pos] + "\n" + insertion + src[pos:]

    # Otherwise insert right after \usepackage{...tikz...}
    m = _USEPACKAGE_TIKZ_RE.search(src)
    if m:
        pos = m.end()
        return src[:pos] + "\n" + insertion + src[pos:]

    # Fallback: right before \begin{document}
    m = _BEGIN_DOCUMENT_RE.search(src)
    if m:
        pos = m.start()
        return src[:pos] + insertion + "\n" + src[pos:]

    return src


_USEPACKAGE_PGFPLOTS_RE = re.compile(
    r"(\\usepackage(?:\[[^\]]*\])?\{[^}]*pgfplots[^}]*\})"
)


def ensure_pgfplots_libraries_in_src(src: str) -> str:
    """Ensure `\\usepgfplotslibrary{fillbetween}` is loaded whenever pgfplots
    is used. Idempotent. Mirrors the tikz-library injection but for pgfplots
    sub-libraries (which use `\\usepgfplotslibrary`, not `\\usetikzlibrary`).
    Also emits `\\pgfplotsset{compat=1.18}` once if absent, to suppress the
    backwards-compatibility warning."""
    pgfplots_pkg = _USEPACKAGE_PGFPLOTS_RE.search(src)
    if not pgfplots_pkg:
        return src

    has_fillbetween = "\\usepgfplotslibrary{fillbetween}" in src
    has_compat = "\\pgfplotsset{compat=" in src

    insertions: list[str] = []
    if not has_compat:
        insertions.append(r"\pgfplotsset{compat=1.18}")
    if not has_fillbetween:
        insertions.append(r"\usepgfplotslibrary{fillbetween}")
    if not insertions:
        return src

    pos = pgfplots_pkg.end()
    return src[:pos] + "\n" + "\n".join(insertions) + src[pos:]


def splice_figure(
    src: str,
    fragment: str,
    anchor_text: str | None = None,
) -> tuple[str, int]:
    """Insert `fragment` into the LaTeX source.

    Strategy:
      1. If `anchor_text` is given and appears exactly once, insert after it.
      2. Otherwise, insert immediately after `\\begin{document}`.
      3. If neither works, return the source unchanged.

    Returns (new_source, line_number_of_insertion).
    """
    if anchor_text:
        count = src.count(anchor_text)
        if count == 1:
            pos = src.find(anchor_text) + len(anchor_text)
            new_src = src[:pos] + "\n" + fragment + "\n" + src[pos:]
            line = src[:pos].count("\n") + 2
            return new_src, line
        logger.info("[figures] anchor_text not unique (count=%d), falling back", count)

    m = _BEGIN_DOCUMENT_RE.search(src)
    if m:
        pos = m.end()
        new_src = src[:pos] + "\n\n" + fragment + "\n" + src[pos:]
        line = src[:pos].count("\n") + 3
        return new_src, line

    return src, 0


_FIGURE_MARKER_PREFIX = "% eddivom-figure: id="


def figure_marker(asset_id: str) -> str:
    """Return the invisible comment marker that tags an inserted asset.

    The Visual Editor scans for this line in raw LaTeX blocks and replaces
    the block with the corresponding preview image — without it KaTeX has
    no way to visualise TikZ.
    """
    return f"{_FIGURE_MARKER_PREFIX}{asset_id}"


def wrap_figure_float(
    tikz_body: str,
    caption: str | None,
    label: str | None,
    asset_id: str | None = None,
) -> str:
    """Wrap a TikZ body in a `figure` float environment."""
    parts = [r"\begin{figure}[h]", r"\centering"]
    if asset_id:
        parts.append(figure_marker(asset_id))
    parts.append(tikz_body.rstrip())
    if caption:
        parts.append(f"\\caption{{{caption}}}")
    if label:
        parts.append(f"\\label{{fig:{label}}}")
    parts.append(r"\end{figure}")
    return "\n".join(parts)


_BEGIN_TIKZ_ENV_RE = re.compile(
    r"(\\begin\{(?:tikzpicture|circuitikz|pgfpicture)\}[^\n]*\n)"
)


def _inject_marker_into_tikz_body(body: str, asset_id: str) -> str:
    """Insert `% eddivom-figure: id=<id>` right after the first tikz/circuitikz
    \\begin so the marker lives **inside** the raw environment. This makes the
    Visual Editor's regex-based detection work regardless of whether the
    tikz is wrapped in `figure{}` or spliced bare."""
    marker = figure_marker(asset_id)
    def _sub(m: re.Match) -> str:
        return f"{m.group(1)}{marker}\n"
    new_body, n = _BEGIN_TIKZ_ENV_RE.subn(_sub, body, count=1)
    if n == 0:
        # Unknown env — fall back to prepending the marker as a raw comment line.
        return marker + "\n" + body
    return new_body


def apply_figure_to_source(
    src: str,
    rendered: RenderedFigure,
    *,
    asset_id: str,
    caption: str | None,
    label: str | None,
    float_env: bool,
    anchor_text: str | None,
) -> tuple[str, int]:
    """High-level helper: inject packages + libraries + splice the fragment."""
    new_src = _inject_packages(src, rendered.required_packages)
    new_src = ensure_figure_libraries(new_src, rendered.required_tikzlibraries)
    if "pgfplots" in rendered.required_packages:
        new_src = ensure_pgfplots_libraries_in_src(new_src)

    body_with_marker = _inject_marker_into_tikz_body(rendered.tikz_body, asset_id)
    if float_env:
        # wrap_figure_float also adds a marker near \centering — keep it for
        # redundancy so even if tikz injection fails, the `figure` env still
        # carries the id.
        fragment = wrap_figure_float(body_with_marker, caption, label, asset_id=asset_id)
    else:
        fragment = body_with_marker.rstrip()
    return splice_figure(new_src, fragment, anchor_text=anchor_text)

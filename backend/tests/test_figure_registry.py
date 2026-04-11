"""Unit tests for the figure asset library.

Run from backend/:  python -m pytest tests/test_figure_registry.py -v
(or plain:          python tests/test_figure_registry.py)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.figures.registry import FigureRegistry, get_registry  # noqa: E402
from app.figures.render import (  # noqa: E402
    ParameterError,
    ensure_figure_libraries,
    render_asset,
    sanitize_params,
)
from app.figures.validate import FigureValidationError, validate_asset  # noqa: E402


# ─── registry ──────────────────────────────────────────────────────────

def test_load_all_assets_valid():
    reg = FigureRegistry()
    n = reg.load()
    assert n >= 25, f"expected at least 25 assets, got {n}"
    ids = [f["id"] for f in reg.list(limit=100)["figures"]]
    assert len(ids) == len(set(ids)), "duplicate asset ids detected"
    # Category coverage
    cats = set(reg.categories())
    assert {"math", "circuit", "physics"} <= cats


def test_list_filter_by_category():
    reg = FigureRegistry(); reg.load()
    out = reg.list(category="circuit", limit=100)
    assert out["total"] >= 8
    assert all(f["category"] == "circuit" for f in out["figures"])


def test_list_query_matches_tags():
    reg = FigureRegistry(); reg.load()
    out = reg.list(query="rc", limit=100)
    ids = {f["id"] for f in out["figures"]}
    assert "circuit.rc_series" in ids


def test_get_returns_parameter_schema():
    reg = FigureRegistry(); reg.load()
    data = reg.get("math.quadratic")
    assert data is not None
    assert "parameter_schema" in data
    assert "a" in data["parameter_schema"]
    assert data["preview_url"].endswith("/api/figures/math.quadratic/preview.png")


def test_get_raw_unknown():
    reg = FigureRegistry(); reg.load()
    assert reg.get("math.does_not_exist") is None


# ─── validation ────────────────────────────────────────────────────────

def _base_asset() -> dict:
    return {
        "id": "math.demo",
        "category": "math",
        "title": {"ja": "デモ", "en": "demo"},
        "body": r"\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}",
        "required_packages": ["tikz"],
        "required_tikzlibraries": [],
        "parameters": {},
        "tags": [],
        "preview": {"params": {}},
    }


def test_validate_accepts_minimal_asset():
    asset = validate_asset(_base_asset())
    assert asset["id"] == "math.demo"


def test_validate_rejects_bad_id():
    bad = _base_asset(); bad["id"] = "noDot"
    with pytest.raises(FigureValidationError):
        validate_asset(bad)


def test_validate_rejects_forbidden_package():
    bad = _base_asset(); bad["required_packages"] = ["minted2"]
    with pytest.raises(FigureValidationError, match="package"):
        validate_asset(bad)


def test_validate_rejects_forbidden_tikzlibrary():
    bad = _base_asset(); bad["required_tikzlibraries"] = ["definitely.not.real"]
    with pytest.raises(FigureValidationError, match="tikz library"):
        validate_asset(bad)


def test_validate_rejects_usepackage_in_body():
    bad = _base_asset(); bad["body"] = bad["body"] + r"\usepackage{minted}"
    with pytest.raises(FigureValidationError):
        validate_asset(bad)


def test_validate_rejects_input_in_body():
    bad = _base_asset(); bad["body"] = r"\input{/etc/passwd}"
    with pytest.raises(FigureValidationError):
        validate_asset(bad)


# ─── parameter sanitization ────────────────────────────────────────────

_QUADRATIC = {
    "id": "math.quadratic",
    "category": "math",
    "title": {"en": "q"},
    "body": r"\pgfplots: ({{a}})xx + ({{b}})x + ({{c}}) color={{color}} label={{label}}",
    "required_packages": ["pgfplots"],
    "required_tikzlibraries": [],
    "parameters": {
        "a":     {"type": "number",  "default": 1, "min": -5, "max": 5},
        "b":     {"type": "number",  "default": 0},
        "c":     {"type": "number",  "default": 0},
        "color": {"type": "enum",    "default": "blue", "choices": ["blue", "red", "green"]},
        "label": {"type": "string",  "default": "parabola", "max_len": 40},
    },
    "tags": [], "preview": {"params": {}},
}


def test_render_substitution_integer_coefficients():
    out = render_asset(_QUADRATIC, {"a": 2, "b": -3, "c": 1})
    assert "(2)xx" in out.tikz_body
    assert "(-3)x" in out.tikz_body
    assert "(1)" in out.tikz_body


def test_render_clamps_out_of_range_number():
    # a clamped to max=5
    out = render_asset(_QUADRATIC, {"a": 999, "b": 0, "c": 0})
    assert "(5)xx" in out.tikz_body


def test_render_enum_fallback_to_default():
    out = render_asset(_QUADRATIC, {"color": "purple"})
    assert "color=blue" in out.tikz_body


def test_render_rejects_string_with_backslash():
    with pytest.raises(ParameterError):
        sanitize_params(_QUADRATIC, {"label": r"oops \input{x}"})


def test_render_rejects_string_with_dollar():
    with pytest.raises(ParameterError):
        sanitize_params(_QUADRATIC, {"label": "$1000"})


def test_render_accepts_unicode_string():
    out = sanitize_params(_QUADRATIC, {"label": "放物線"})
    assert out["label"] == "放物線"


# ─── library injection ────────────────────────────────────────────────

_TEMPLATE_WITH_TIKZ = r"""\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{arrows.meta}
\begin{document}
Hi.
\end{document}
"""


def test_ensure_libraries_adds_missing():
    src = ensure_figure_libraries(_TEMPLATE_WITH_TIKZ, ["calc", "positioning"])
    assert "\\usetikzlibrary{calc,positioning}" in src


def test_ensure_libraries_skips_already_present():
    src = ensure_figure_libraries(_TEMPLATE_WITH_TIKZ, ["arrows.meta"])
    # arrows.meta should NOT be re-added
    assert src.count("arrows.meta") == 1


def test_ensure_libraries_idempotent():
    once = ensure_figure_libraries(_TEMPLATE_WITH_TIKZ, ["calc"])
    twice = ensure_figure_libraries(once, ["calc"])
    assert once == twice


# ─── CLI runner fallback ──────────────────────────────────────────────

if __name__ == "__main__":
    import pytest as _pt
    raise SystemExit(_pt.main([__file__, "-v"]))

"""Regression tests for insert_figure pre-compile rollback and draft_figure.

Run from backend/:  python -m pytest tests/test_insert_figure_rollback.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.ai_service import _execute_tool, _compile_latex_snapshot, _syntax_check  # noqa: E402
from app.figures import get_registry  # noqa: E402
from app.figures.snippet import compile_snippet_sync  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _load_registry():
    get_registry().load()
    yield


# ─── _syntax_check --------------------------------------------------

def test_syntax_check_balanced():
    assert _syntax_check(r"\begin{document}hi\end{document}") == []


def test_syntax_check_detects_unbalanced_braces():
    issues = _syntax_check(r"\begin{document}{{{hi\end{document}")
    assert any("開き括弧" in m for m in issues)


def test_syntax_check_detects_unbalanced_env():
    issues = _syntax_check(r"\begin{document}\begin{foo}hi\end{document}")
    assert any("foo" in m and "不一致" in m for m in issues)


# ─── _compile_latex_snapshot -----------------------------------------

def test_compile_snapshot_success_on_valid_doc():
    src = (
        r"\documentclass{article}"
        r"\usepackage[T1]{fontenc}"
        r"\begin{document}Hi.\end{document}"
    )
    result = _compile_latex_snapshot(src, allow_autofix=True)
    assert result.get("success") is True
    assert result.get("phase") == "compile"
    assert "latex_source" in result


def test_compile_snapshot_fails_on_unbalanced_braces():
    src = r"\documentclass{article}\begin{document}{{{\end{document}"
    result = _compile_latex_snapshot(src, allow_autofix=True)
    assert result.get("success") is False
    assert result.get("phase") == "syntax"


# ─── insert_figure rollback ------------------------------------------

_OK_DOC = (
    r"\documentclass{article}"
    "\n\\usepackage[T1]{fontenc}"
    "\n\\begin{document}\nHi.\n\\end{document}"
)


def test_insert_figure_commits_on_success():
    doc = {"latex": _OK_DOC, "metadata": {}}
    r = _execute_tool("insert_figure", doc, {"id": "math.quadratic", "params": {"a": 2}})
    assert r.get("applied") is True
    assert r.get("compile_verified") is True
    assert doc["latex"] != _OK_DOC
    assert "math.quadratic" in doc["latex"]


def test_insert_figure_reverts_on_compile_fail():
    broken = r"\documentclass{article}" + "\n" + r"\begin{document}" + "\n{{{ unbalanced\n" + r"\end{document}"
    doc = {"latex": broken, "metadata": {}}
    before = doc["latex"]
    r = _execute_tool("insert_figure", doc, {"id": "math.quadratic"})
    assert r.get("error") == "compile_failed"
    assert doc["latex"] == before, "document must be unchanged on rollback"
    assert "errors" in r or "phase" in r


def test_insert_figure_unknown_id_returns_not_found():
    doc = {"latex": _OK_DOC, "metadata": {}}
    r = _execute_tool("insert_figure", doc, {"id": "math.totally_fake"})
    assert r.get("error") == "not_found"
    assert doc["latex"] == _OK_DOC  # no mutation on lookup miss


def test_insert_figure_skip_compile_hook():
    """The _skip_compile flag is used by fast tests to bypass lualatex."""
    doc = {"latex": _OK_DOC, "metadata": {}}
    r = _execute_tool(
        "insert_figure",
        doc,
        {"id": "math.quadratic", "_skip_compile": True},
    )
    assert r.get("applied") is True
    assert r.get("compile_verified") is False


# ─── draft_figure ----------------------------------------------------

def test_draft_figure_success_injects_marker():
    doc = {"latex": "", "metadata": {}}
    r = _execute_tool(
        "draft_figure",
        doc,
        {
            "tikz_body": (
                r"\begin{tikzpicture}"
                r"\draw[thick] (0,0) rectangle (2,1); \node at (1,0.5) {ok};"
                r"\end{tikzpicture}"
            ),
            "category_hint": "other",
            "reason": "unit test: custom rectangle with label",
        },
    )
    assert r.get("compile_verified") is True
    assert r.get("snippet_key")
    marked = r.get("tikz_body_marked") or ""
    assert "% eddivom-figure: freestyle key=" in marked


def test_draft_figure_rejects_forbidden_command():
    doc = {"latex": "", "metadata": {}}
    r = _execute_tool(
        "draft_figure",
        doc,
        {
            "tikz_body": r"\begin{tikzpicture}\write18{ls}\end{tikzpicture}",
            "reason": "test forbidden command",
        },
    )
    assert r.get("error") == "compile_failed"
    assert "security" in (r.get("message") or "").lower() or "forbidden" in (r.get("message") or "").lower()


def test_draft_figure_requires_reason():
    doc = {"latex": "", "metadata": {}}
    r = _execute_tool("draft_figure", doc, {"tikz_body": r"\begin{tikzpicture}\end{tikzpicture}"})
    assert r.get("error")


# ─── compile_snippet_sync direct test --------------------------------

def test_compile_snippet_sync_caches_by_hash():
    body = r"\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}"
    p1, k1 = compile_snippet_sync(body, category_hint="test", reason="first")
    p2, k2 = compile_snippet_sync(body, category_hint="test", reason="second")
    assert k1 == k2
    assert p1 == p2
    assert p1.exists()


# ─── TikZ protocol guard -------------------------------------------

_MINIMAL_DOC = (
    r"\documentclass{article}"
    "\n\\usepackage[T1]{fontenc}"
    "\n\\begin{document}\nHello.\n\\end{document}"
)


def test_set_latex_rejects_unmarked_tikz():
    doc = {"latex": _MINIMAL_DOC, "metadata": {}}
    bad = _MINIMAL_DOC.replace(
        "Hello.",
        "Hello.\n\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}",
    )
    r = _execute_tool("set_latex", doc, {"latex": bad})
    assert r.get("error") == "protocol_violation"
    assert "tikzpicture" in (r.get("offender_envs") or [])
    assert doc["latex"] == _MINIMAL_DOC  # unchanged


def test_set_latex_allows_marked_tikz():
    doc = {"latex": _MINIMAL_DOC, "metadata": {}}
    ok = _MINIMAL_DOC.replace(
        "Hello.",
        "Hello.\n\\begin{tikzpicture}\n% eddivom-figure: id=math.quadratic\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
    )
    r = _execute_tool("set_latex", doc, {"latex": ok})
    assert r.get("applied") is True


def test_replace_in_latex_rejects_unmarked_tikz_in_replacement():
    doc = {"latex": _MINIMAL_DOC, "metadata": {}}
    r = _execute_tool("replace_in_latex", doc, {
        "find": "Hello.",
        "replace": "Hello.\n\\begin{circuitikz}\\draw (0,0) -- (1,0);\\end{circuitikz}",
    })
    assert r.get("error") == "protocol_violation"
    assert doc["latex"] == _MINIMAL_DOC  # unchanged


def test_replace_in_latex_allows_marked_tikz_in_replacement():
    doc = {"latex": _MINIMAL_DOC, "metadata": {}}
    r = _execute_tool("replace_in_latex", doc, {
        "find": "Hello.",
        "replace": "Hello.\n\\begin{tikzpicture}\n% eddivom-figure: id=math.quadratic\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
    })
    assert r.get("applied") is True


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

"""Figure asset validation (schema + security allowlist)."""
from __future__ import annotations

import re
from typing import Any

from ..security import (
    ALLOWED_PACKAGES,
    ALLOWED_TIKZ_LIBRARIES,
    _ALWAYS_FORBIDDEN_RE,
    _DANGEROUS_RE,
)

_VALID_ID_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$")
_VALID_CATEGORIES = {"math", "circuit", "physics"}
_VALID_PARAM_TYPES = {"number", "integer", "string", "enum", "boolean"}

_BODY_FORBIDDEN_CMD_RE = re.compile(
    r"\\(?:usepackage|documentclass|input|include|write18|directlua"
    r"|luaexec|luadirect|luacode|latelua|openin|openout|read"
    r"|ShellEscape|pdfshellescape|catcode)"
    r"(?![a-zA-Z])"
)


class FigureValidationError(ValueError):
    """A YAML asset failed schema / allowlist validation."""


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise FigureValidationError(msg)


def validate_asset(raw: dict[str, Any]) -> dict[str, Any]:
    """Validate and normalize a loaded asset dict. Returns the normalized dict.

    Raises :class:`FigureValidationError` if the asset is malformed or references
    packages / tikz libraries outside the security allowlist.
    """
    _require(isinstance(raw, dict), "asset must be a mapping")

    asset_id = raw.get("id")
    _require(isinstance(asset_id, str) and bool(_VALID_ID_RE.match(asset_id)),
             f"invalid id: {asset_id!r} (expected '<category>.<slug>')")

    category = raw.get("category")
    _require(category in _VALID_CATEGORIES,
             f"category must be one of {_VALID_CATEGORIES}, got {category!r}")

    id_category = asset_id.split(".", 1)[0]
    _require(id_category == category,
             f"id prefix '{id_category}' does not match category '{category}'")

    title = raw.get("title") or {}
    _require(isinstance(title, dict) and ("ja" in title or "en" in title),
             "title must have at least 'ja' or 'en'")

    body = raw.get("body")
    _require(isinstance(body, str) and body.strip(), "body must be a non-empty string")

    # Body must not declare its own packages or call dangerous primitives
    m = _BODY_FORBIDDEN_CMD_RE.search(body)
    _require(m is None, f"body contains forbidden command: {m.group() if m else ''}")
    m = _ALWAYS_FORBIDDEN_RE.search(body)
    _require(m is None, f"body contains always-forbidden command: {m.group() if m else ''}")
    m = _DANGEROUS_RE.search(body)
    _require(m is None, f"body contains dangerous command: {m.group() if m else ''}")

    pkgs = raw.get("required_packages") or []
    _require(isinstance(pkgs, list) and all(isinstance(p, str) for p in pkgs),
             "required_packages must be a list of strings")
    for p in pkgs:
        _require(p in ALLOWED_PACKAGES, f"package not in allowlist: {p}")

    libs = raw.get("required_tikzlibraries") or []
    _require(isinstance(libs, list) and all(isinstance(lib, str) for lib in libs),
             "required_tikzlibraries must be a list of strings")
    for lib in libs:
        _require(lib in ALLOWED_TIKZ_LIBRARIES, f"tikz library not in allowlist: {lib}")

    params = raw.get("parameters") or {}
    _require(isinstance(params, dict), "parameters must be a mapping")
    normalized_params: dict[str, dict[str, Any]] = {}
    for name, spec in params.items():
        _require(isinstance(name, str) and name.isidentifier(),
                 f"parameter name must be a valid identifier: {name!r}")
        _require(isinstance(spec, dict), f"parameter {name!r} must be a mapping")
        ptype = spec.get("type")
        _require(ptype in _VALID_PARAM_TYPES,
                 f"parameter {name!r} type must be in {_VALID_PARAM_TYPES}, got {ptype!r}")
        if ptype == "enum":
            choices = spec.get("choices") or []
            _require(isinstance(choices, list) and len(choices) >= 1,
                     f"enum parameter {name!r} needs non-empty 'choices'")
        normalized_params[name] = dict(spec)

    tags = raw.get("tags") or []
    _require(isinstance(tags, list) and all(isinstance(t, str) for t in tags),
             "tags must be a list of strings")

    preview = raw.get("preview") or {}
    _require(isinstance(preview, dict), "preview must be a mapping")
    preview_params = preview.get("params") or {}
    _require(isinstance(preview_params, dict), "preview.params must be a mapping")

    return {
        "id": asset_id,
        "category": category,
        "subcategory": raw.get("subcategory") or "",
        "title": dict(title),
        "description": dict(raw.get("description") or {}),
        "tags": list(tags),
        "required_packages": list(pkgs),
        "required_tikzlibraries": list(libs),
        "parameters": normalized_params,
        "body": body,
        "preview": {"params": dict(preview_params)},
    }

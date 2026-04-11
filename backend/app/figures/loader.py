"""YAML loader for figure assets."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from .validate import FigureValidationError, validate_asset

logger = logging.getLogger(__name__)


def asset_root() -> Path:
    """Return the on-disk root directory of the figure asset catalog."""
    # backend/app/figures/loader.py → backend/assets/figures
    return Path(__file__).resolve().parents[2] / "assets" / "figures"


def load_all(root: Path | None = None) -> list[dict[str, Any]]:
    """Walk the asset directory and return the list of validated assets.

    Assets that fail validation are logged and skipped (the app never crashes
    on one bad YAML).
    """
    base = root or asset_root()
    if not base.exists():
        logger.warning("[figures] asset root missing: %s", base)
        return []

    assets: list[dict[str, Any]] = []
    for yaml_path in sorted(base.rglob("*.yaml")):
        # _previews and any dot-directories are skipped
        if any(part.startswith("_") or part.startswith(".") for part in yaml_path.relative_to(base).parts[:-1]):
            continue
        try:
            raw = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        except yaml.YAMLError as e:
            logger.error("[figures] YAML parse error in %s: %s", yaml_path, e)
            continue
        try:
            asset = validate_asset(raw)
        except FigureValidationError as e:
            logger.error("[figures] invalid asset %s: %s", yaml_path, e)
            continue
        assets.append(asset)
        logger.debug("[figures] loaded %s", asset["id"])

    # Detect duplicate ids
    seen: dict[str, Path] = {}
    deduped: list[dict[str, Any]] = []
    for asset in assets:
        if asset["id"] in seen:
            logger.error("[figures] duplicate id %s — keeping first", asset["id"])
            continue
        seen[asset["id"]] = base
        deduped.append(asset)

    logger.info("[figures] loaded %d assets from %s", len(deduped), base)
    return deduped

"""In-memory registry of figure assets."""
from __future__ import annotations

import logging
import threading
from typing import Any

from .loader import load_all
from .render import RenderedFigure, render_asset

logger = logging.getLogger(__name__)


class FigureRegistry:
    """Thread-safe in-memory store of validated figure assets."""

    def __init__(self) -> None:
        self._assets: dict[str, dict[str, Any]] = {}
        self._by_category: dict[str, list[str]] = {}
        self._lock = threading.RLock()
        self._loaded = False

    # ── lifecycle ────────────────────────────────────────────────
    def load(self) -> int:
        with self._lock:
            self._assets = {}
            self._by_category = {}
            for asset in load_all():
                self._assets[asset["id"]] = asset
                self._by_category.setdefault(asset["category"], []).append(asset["id"])
            self._loaded = True
            return len(self._assets)

    def ensure_loaded(self) -> None:
        if not self._loaded:
            self.load()

    # ── read ─────────────────────────────────────────────────────
    def categories(self) -> list[str]:
        self.ensure_loaded()
        return sorted(self._by_category.keys())

    def list(
        self,
        category: str | None = None,
        query: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Return a compact list of assets (id/category/title/tags only)."""
        self.ensure_loaded()
        limit = max(1, min(int(limit), 100))

        ids: list[str]
        if category:
            ids = list(self._by_category.get(category, []))
        else:
            ids = list(self._assets.keys())

        if query:
            q = query.strip().lower()
            def _match(aid: str) -> bool:
                a = self._assets[aid]
                haystack = " ".join([
                    aid,
                    a.get("title", {}).get("ja", ""),
                    a.get("title", {}).get("en", ""),
                    " ".join(a.get("tags", [])),
                    a.get("subcategory", ""),
                ]).lower()
                return all(tok in haystack for tok in q.split())
            ids = [aid for aid in ids if _match(aid)]

        total = len(ids)
        ids = ids[:limit]
        figures = []
        for aid in ids:
            a = self._assets[aid]
            figures.append({
                "id": aid,
                "category": a["category"],
                "subcategory": a.get("subcategory", ""),
                "title": a.get("title", {}),
                "tags": a.get("tags", []),
            })
        return {"figures": figures, "total": total, "returned": len(figures)}

    def get(self, asset_id: str) -> dict[str, Any] | None:
        self.ensure_loaded()
        a = self._assets.get(asset_id)
        if not a:
            return None
        return {
            "id": a["id"],
            "category": a["category"],
            "subcategory": a.get("subcategory", ""),
            "title": a.get("title", {}),
            "description": a.get("description", {}),
            "tags": a.get("tags", []),
            "required_packages": a.get("required_packages", []),
            "required_tikzlibraries": a.get("required_tikzlibraries", []),
            "parameter_schema": a.get("parameters", {}),
            "preview_url": f"/api/figures/{a['id']}/preview.png",
        }

    def get_raw(self, asset_id: str) -> dict[str, Any] | None:
        """Return the full internal asset dict (body included). Internal use."""
        self.ensure_loaded()
        return self._assets.get(asset_id)

    def render(self, asset_id: str, params: dict[str, Any] | None = None) -> RenderedFigure | None:
        a = self.get_raw(asset_id)
        if not a:
            return None
        return render_asset(a, params)


# ─── singleton ──────────────────────────────────────────────────────
_singleton: FigureRegistry | None = None
_singleton_lock = threading.Lock()


def get_registry() -> FigureRegistry:
    global _singleton
    if _singleton is None:
        with _singleton_lock:
            if _singleton is None:
                _singleton = FigureRegistry()
    return _singleton

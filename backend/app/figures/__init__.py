"""Figure asset library — curated TikZ/pgfplots/circuitikz snippets.

AI ツールからは `registry.list / get / render` で呼び出す。
保管形式は YAML (backend/assets/figures/<category>/<slug>.yaml)。
"""
from .registry import FigureRegistry, get_registry

__all__ = ["FigureRegistry", "get_registry"]

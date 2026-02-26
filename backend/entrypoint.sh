#!/bin/sh
# Docker entrypoint: LuaLaTeX 専用構成
# TEXINPUTS ハックは不要 (luatexja は kpsewhich で解決される)
set -e

echo "[entrypoint] Engine: lualatex only"
echo "[entrypoint] Starting application..."
exec "$@"

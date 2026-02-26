#!/bin/sh
# Docker entrypoint: LuaLaTeX 専用構成 (v2 — ビルドキャッシュ活用)
set -e

echo "[entrypoint] Engine: lualatex only"
echo "[entrypoint] Timeout: ${COMPILE_TIMEOUT_SECONDS:-120}s"

# ビルド時に構築したフォントキャッシュの存在確認
if command -v luaotfload-tool >/dev/null 2>&1; then
    echo "[entrypoint] luaotfload DB status:"
    luaotfload-tool --diagnose=cache 2>&1 | head -5 || true
fi

echo "[entrypoint] Starting application..."
exec "$@"

#!/bin/sh
# Docker entrypoint: LuaLaTeX 専用構成 (v3 — Koyeb PORT 対応)
set -e

echo "[entrypoint] Engine: lualatex only"
echo "[entrypoint] Timeout: ${COMPILE_TIMEOUT_SECONDS:-120}s"
echo "[entrypoint] PORT: ${PORT:-8000}"

# ビルド時に構築したフォントキャッシュの存在確認
if command -v luaotfload-tool >/dev/null 2>&1; then
    echo "[entrypoint] luaotfload DB status:"
    luaotfload-tool --diagnose=cache 2>&1 | head -5 || true
fi

echo "[entrypoint] Starting application..."

# Koyeb等は PORT 環境変数でリッスンポートを指定する
# CMD の引数がなければデフォルトのuvicornコマンドを実行
if [ $# -eq 0 ] || [ "$1" = "uvicorn" ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
else
    exec "$@"
fi

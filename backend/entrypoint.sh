#!/bin/sh
# Docker entrypoint: TeX の TEXINPUTS をランタイムに読み込んでからアプリ起動
# (Dockerfile の RUN ステップで設定した環境変数は ENV に焼き込めないため、
#  ファイル経由でランタイムに反映する)

set -e

# TEXINPUTS の復元
if [ -f /etc/texinputs.env ]; then
    echo "[entrypoint] Loading TEXINPUTS from /etc/texinputs.env"
    . /etc/texinputs.env
    export TEXINPUTS
    echo "[entrypoint] TEXINPUTS=${TEXINPUTS}"
fi

echo "[entrypoint] Starting application..."
exec "$@"

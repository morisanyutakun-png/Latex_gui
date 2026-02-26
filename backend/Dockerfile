FROM python:3.12-slim-bookworm

# ════════════════════════════════════════════════════════════════
# LaTeX PDF生成 Docker — LuaLaTeX 専用 (メモリ最適化 v6)
#
# 方針:
#   - エンジン: lualatex のみ
#   - 日本語: luatexja-preset[haranoaji] (HaranoAji フォント内蔵)
#   - ビルド時に全パッケージ・フォントキャッシュ・フォーマットを事前構築
#   - ランタイムは軽量コンパイルのみ (メモリ最小化)
# ════════════════════════════════════════════════════════════════

ARG DEBIAN_FRONTEND=noninteractive

# ──── 1. システム依存 + TeX Live ────
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        texlive-luatex \
        texlive-latex-base \
        texlive-latex-recommended \
        texlive-latex-extra \
        texlive-pictures \
        texlive-science \
        texlive-fonts-recommended \
        texlive-lang-japanese \
        fonts-noto-cjk \
        poppler-utils \
        fontconfig \
        locales \
    && rm -rf /var/lib/apt/lists/*

# ──── 2. ロケール設定 (ja_JP.UTF-8) ────
RUN sed -i '/ja_JP.UTF-8/s/^# //' /etc/locale.gen \
    && locale-gen ja_JP.UTF-8
ENV LANG=ja_JP.UTF-8 \
    LC_ALL=ja_JP.UTF-8

# ──── 3. フォントキャッシュ + TeX DB 完全構築 ────
RUN fc-cache -fv \
    && mktexlsr \
    && texhash \
    && luaotfload-tool --update --force \
    && fmtutil-sys --byfmt lualatex \
    && echo "=== Font & format caches built ==="

# ──── 4. 包括的スモークテスト (全パッケージのキャッシュ構築) ────
# アプリが使う全パッケージを含むテストをコンパイルし、
# - パッケージ不足を Docker ビルド時に検出
# - lualatex のフォントキャッシュを完全に構築
# - LuaTeX の内部キャッシュ (luaotfload DB) をウォーム
# 3回コンパイルして安定したキャッシュを確保
COPY backend/tests/smoke_full.tex /tmp/smoke_full.tex
WORKDIR /tmp
RUN echo "=== Smoke test 1/3 (cold — building all caches) ===" \
    && lualatex -interaction=nonstopmode -halt-on-error smoke_full.tex \
    && echo "=== Smoke test 2/3 (warming cache) ===" \
    && lualatex -interaction=nonstopmode -halt-on-error smoke_full.tex \
    && echo "=== Smoke test 3/3 (cache fully warm) ===" \
    && lualatex -interaction=nonstopmode -halt-on-error smoke_full.tex \
    && echo "=== All smoke tests passed ===" \
    && rm -f /tmp/smoke_full.*

# ──── 5. luaotfload DB 最終更新 (スモークテスト後) ────
RUN luaotfload-tool --update \
    && echo "=== luaotfload DB finalized ==="

# ──── 6. 環境変数 ────
# Koyeb Free (512MB) 対応:
#   - 同時コンパイルは絶対に1 (LuaLaTeX 1プロセスで300-400MB使用)
#   - タイムアウトは十分確保
ENV MAX_CONCURRENT_COMPILES=1 \
    COMPILE_TIMEOUT_SECONDS=120

WORKDIR /app

# ──── 7. Python 依存 ────
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ──── 8. アプリケーションコード ────
COPY backend/app/ /app/app/
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# ──── 9. non-root ユーザー + キャッシュ共有 ────
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app \
    && mkdir -p /tmp/latex-work && chown appuser:appuser /tmp/latex-work \
    && mkdir -p /home/appuser && chown appuser:appuser /home/appuser \
    && chmod -R a+r /var/lib/texmf \
    && chmod -R a+r /usr/share/texlive \
    && chmod -R a+r /usr/share/texmf \
    && find /root -name "luaotfload*" -exec cp -r {} /home/appuser/ \; 2>/dev/null || true

# luaotfload キャッシュをコピー (存在する場合のみ)
RUN cp -r /root/.texlive* /home/appuser/ 2>/dev/null; \
    cp -r /root/texmf /home/appuser/ 2>/dev/null; \
    chown -R appuser:appuser /home/appuser; \
    echo "=== Cache permissions set ==="

# TEXMFVAR/TEXMFCONFIG を appuser 書き込み可能な場所に設定
ENV TEXMFVAR=/home/appuser/texmf-var \
    TEXMFCONFIG=/home/appuser/texmf-config
RUN mkdir -p /home/appuser/texmf-var /home/appuser/texmf-config \
    && chown -R appuser:appuser /home/appuser

USER appuser

# ──── 10. appuser 環境でフォントキャッシュ構築 ────
COPY backend/tests/warmup.tex /tmp/warmup.tex
WORKDIR /tmp
RUN luaotfload-tool --update 2>/dev/null || true
RUN lualatex -interaction=nonstopmode -halt-on-error warmup.tex \
    && lualatex -interaction=nonstopmode -halt-on-error warmup.tex \
    && rm -f /tmp/warmup.aux /tmp/warmup.log /tmp/warmup.pdf \
    && echo "=== appuser cache warm ==="

WORKDIR /app

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

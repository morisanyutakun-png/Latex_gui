FROM python:3.12-slim

# ──── TeX Live インストール ────
#
# 戦略: pdflatex + bxcjkjatype で日本語対応 (主エンジン)
#        xelatex + fontspec をフォールバックとして追加
# - texlive-latex-base:       pdflatex コア (~80MB)
# - texlive-latex-extra:      booktabs, tcolorbox, enumitem, listings, fancyhdr 等
# - texlive-latex-recommended: BibTeX / makeindex 等 (追加安定性)
# - texlive-pictures:         tikz, circuitikz (回路図)
# - texlive-science:          pgfplots, mhchem (グラフ・化学式)
# - texlive-fonts-recommended: 基本フォント
# - texlive-lang-japanese:    bxcjkjatype (pdflatex 日本語サポート)
# - texlive-lang-cjk:         CJK.sty (bxcjkjatype の依存パッケージ)
# - texlive-xetex:            xelatex (CJK.sty 未検出時のフォールバック)
# - poppler-utils:            pdftocairo (PDF→SVG, プレビュー用)

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        texlive-latex-base \
        texlive-latex-recommended \
        texlive-latex-extra \
        texlive-pictures \
        texlive-science \
        texlive-fonts-recommended \
        texlive-lang-japanese \
        texlive-lang-cjk \
        texlive-xetex \
        fonts-noto-cjk \
        poppler-utils \
        fontconfig \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && fc-cache -fv \
    && texhash

# ── ビルド時検証: 必須パッケージの存在確認 ──
RUN echo "=== TeX Live build-time verification ===" \
    && kpsewhich CJK.sty       && echo "  [OK] CJK.sty" \
    || (echo "  [FAIL] CJK.sty not found!" && exit 1) \
    && kpsewhich bxcjkjatype.sty && echo "  [OK] bxcjkjatype.sty" \
    || (echo "  [FAIL] bxcjkjatype.sty not found!" && exit 1) \
    && which pdflatex           && echo "  [OK] pdflatex" \
    && which xelatex            && echo "  [OK] xelatex" \
    && echo "=== All TeX packages verified ==="

ENV MAX_CONCURRENT_COMPILES=2
ENV COMPILE_MEM_LIMIT_MB=256
ENV REQUEST_TIMEOUT_SECONDS=60
# Docker環境ではNoto CJKフォントを使用
ENV CJK_MAIN_FONT="Noto Serif CJK JP"
ENV CJK_SANS_FONT="Noto Sans CJK JP"

WORKDIR /app

# ── アプリケーションコードのコピー ──
# ビルドコンテキスト自動検出:
#   context=root → backend/requirements.txt が存在
#   context=backend/ → requirements.txt が存在
COPY . /tmp/_ctx/
RUN set -e; \
    if [ -f /tmp/_ctx/requirements.txt ]; then \
        cp /tmp/_ctx/requirements.txt /app/requirements.txt; \
    elif [ -f /tmp/_ctx/backend/requirements.txt ]; then \
        cp /tmp/_ctx/backend/requirements.txt /app/requirements.txt; \
    else \
        echo "FATAL: requirements.txt not found in build context" >&2; exit 1; \
    fi
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
RUN set -e; \
    if [ -d /tmp/_ctx/app ]; then \
        cp -a /tmp/_ctx/app /app/app; \
    elif [ -d /tmp/_ctx/backend/app ]; then \
        cp -a /tmp/_ctx/backend/app /app/app; \
    else \
        echo "FATAL: app/ directory not found in build context" >&2; exit 1; \
    fi \
    && rm -rf /tmp/_ctx

EXPOSE 8000

# ワーカー数1 (メモリ節約。同時処理はセマフォで制御)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

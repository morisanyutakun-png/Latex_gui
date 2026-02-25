FROM python:3.12-slim-bookworm

# ──── TeX Live インストール ────
#
# 重要: python:3.12-slim-bookworm (Debian 12) を使用すること。
#   Debian 13 (Trixie) の texlive-lang-cjk では CJK.sty が
#   kpsewhich から見えない問題があるため、Bookworm にピンしている。
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

ENV DEBIAN_FRONTEND=noninteractive

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
    && rm -rf /var/lib/apt/lists/*

# ── TeX パッケージDB再構築 + フォントキャッシュ ──
# apt-get の post-install triggers が走っているが、
# 念のため明示的に mktexlsr → texhash → fc-cache を実行
RUN mktexlsr \
    && texhash \
    && fc-cache -fv

# ── ビルド時検証: パッケージの存在確認 (診断ログ付き) ──
RUN echo "=== TeX Live build-time verification ===" \
    && echo "--- kpsewhich paths ---" \
    && kpsewhich --var-value=TEXMFDIST || true \
    && kpsewhich --var-value=TEXMFLOCAL || true \
    && echo "--- CJK.sty ---" \
    && (kpsewhich CJK.sty && echo "  [OK] CJK.sty") \
       || (echo "  [WARN] CJK.sty not found by kpsewhich" \
           && echo "  Searching filesystem..." \
           && find /usr -name "CJK.sty" 2>/dev/null || true) \
    && echo "--- bxcjkjatype.sty ---" \
    && (kpsewhich bxcjkjatype.sty && echo "  [OK] bxcjkjatype.sty") \
       || (echo "  [WARN] bxcjkjatype.sty not found by kpsewhich" \
           && find /usr -name "bxcjkjatype.sty" 2>/dev/null || true) \
    && echo "--- Engines ---" \
    && which pdflatex && echo "  [OK] pdflatex" \
    && which xelatex  && echo "  [OK] xelatex" \
    && echo "--- Quick compile test (pdflatex + bxcjkjatype) ---" \
    && ( cd /tmp \
         && echo '\\documentclass{article}\\usepackage[whole]{bxcjkjatype}\\begin{document}Hello テスト\\end{document}' > /tmp/test.tex \
         && pdflatex -interaction=nonstopmode -halt-on-error /tmp/test.tex \
         && echo "  [OK] pdflatex+CJK compile test passed" \
         && rm -f /tmp/test.* ) \
    || echo "  [WARN] pdflatex+CJK compile test failed (xelatex fallback will be used)" \
    && echo "=== Verification complete ==="

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

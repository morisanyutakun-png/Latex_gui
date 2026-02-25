FROM python:3.12-slim

# ──── 軽量 TeX Live インストール (クラウド OOM 対策) ────
#
# 戦略: pdflatex + bxcjkjatype で日本語対応 (xelatex/fontspec 不使用)
# - texlive-latex-base:       pdflatex コア (~80MB)
# - texlive-latex-extra:      booktabs, tcolorbox, enumitem, listings, fancyhdr 等
# - texlive-pictures:         tikz, circuitikz (回路図)
# - texlive-science:          pgfplots, mhchem (グラフ・化学式)
# - texlive-fonts-recommended: 基本フォント
# - texlive-lang-japanese:    bxcjkjatype (pdflatex 日本語サポート, 軽量)
# - poppler-utils:            pdftocairo (PDF→SVG, プレビュー用)
#
# 除外: texlive-xetex (200-500MB メモリ消費), fonts-noto-cjk-extra
# xelatex が必要な場合は ENABLE_XELATEX_FALLBACK=true に加え
# texlive-xetex, fonts-noto-cjk をインストールした Dockerfile を使用

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-pictures \
    texlive-science \
    texlive-fonts-recommended \
    texlive-lang-japanese \
    texlive-lang-cjk \
    fonts-noto-cjk \
    poppler-utils \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && fc-cache -fv

# pdflatex モード: xelatex フォールバック無効 (メモリ節約)
ENV ENABLE_XELATEX_FALLBACK=false
ENV MAX_CONCURRENT_COMPILES=2
ENV COMPILE_MEM_LIMIT_MB=256
ENV REQUEST_TIMEOUT_SECONDS=60
# Docker環境ではNoto CJKフォントを使用
ENV CJK_MAIN_FONT="Noto Serif CJK JP"
ENV CJK_SANS_FONT="Noto Sans CJK JP"

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

# ワーカー数1 (メモリ節約。同時処理はセマフォで制御)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

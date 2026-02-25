FROM python:3.12-slim

# TeX Live + 日本語フォント + SVG変換ツール
# - texlive-xetex:        XeLaTeX (PDF生成)
# - texlive-latex-extra:   booktabs, tcolorbox, enumitem, listings, fancyhdr 等
# - texlive-pictures:      tikz, circuitikz (回路図)
# - texlive-science:       pgfplots (グラフ), mhchem (化学式)
# - texlive-fonts-recommended: 基本フォント
# - texlive-lang-japanese: 日本語TeX基盤
# - fonts-noto-cjk:        Noto CJKフォント
# - poppler-utils:         pdftocairo (PDF→SVG変換。プレビュー用)
# - ghostscript:           dvisvgm フォールバック用 libgs
# - fontconfig:            fc-list (フォント検出)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-latex-extra \
    texlive-pictures \
    texlive-science \
    texlive-fonts-recommended \
    texlive-lang-japanese \
    texlive-lang-cjk \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    poppler-utils \
    ghostscript \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -fv

# Docker環境ではNoto CJKフォントを使用
ENV CJK_MAIN_FONT="Noto Serif CJK JP"
ENV CJK_SANS_FONT="Noto Sans CJK JP"

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

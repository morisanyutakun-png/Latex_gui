FROM python:3.12-slim-bookworm

# ════════════════════════════════════════════════════════════════
# LaTeX PDF生成 Docker — LuaLaTeX 専用構成
#
# 方針:
#   - エンジン: lualatex のみ (pdflatex/xelatex は不使用)
#   - 日本語: luatexja-preset[haranoaji] (HaranoAji フォント内蔵)
#   - 回路図: circuitikz (TikZ/PGF)
#   - 軽量化: 必要最小限のTeX Liveコレクション + キャッシュ削除
# ════════════════════════════════════════════════════════════════

ENV DEBIAN_FRONTEND=noninteractive

# ──── 1. システム依存 + TeX Live ────
#
# パッケージ選定理由:
#   texlive-luatex        … lualatex 本体 + luatexja + HaranoAji
#   texlive-latex-base    … LaTeX カーネル (article, geometry 等)
#   texlive-latex-recommended … booktabs, graphicx, hyperref 等 基本パッケージ
#   texlive-latex-extra   … tcolorbox, enumitem, listings, mathtools 等
#   texlive-pictures      … tikz, pgf, circuitikz
#   texlive-science       … mhchem (化学式), siunitx 等
#   texlive-fonts-recommended … 標準欧文フォント
#   texlive-lang-japanese … luatexja-preset, jlreq, ltjsarticle 等
#   fonts-noto-cjk        … CJK フォント (Noto Sans/Serif CJK JP)
#   poppler-utils         … pdftocairo (PDF→SVG 変換)
#   fontconfig            … fc-cache (フォントキャッシュ)
#   locales               … ja_JP.UTF-8 ロケール生成用
#
# 削除したもの (方針変更):
#   texlive-xetex         … xelatex 不使用
#   texlive-lang-cjk      … CJK 全般 (luatexja には不要)
#   texlive-lang-chinese   … 中国語不要
#   latex-cjk-common      … pdflatex+CJK.sty 用 (不要)

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
ENV LANG=ja_JP.UTF-8
ENV LC_ALL=ja_JP.UTF-8

# ──── 3. TeX パッケージDB + フォントキャッシュ ────
RUN mktexlsr && texhash && fc-cache -fv

# ──── 4. スモークテスト (ビルド時に1回だけ) ────
# 日本語 + 数式 + circuitikz を含む文書をコンパイルし、
# パッケージ不足を Docker ビルド時に検出する。
# 同時に lualatex フォントキャッシュを構築 (ランタイム高速化)。
RUN set -e; cd /tmp \
    && printf '\
\\documentclass{article}\n\
\\usepackage[haranoaji]{luatexja-preset}\n\
\\usepackage{amsmath,amssymb}\n\
\\usepackage{tikz}\n\
\\usepackage{circuitikz}\n\
\\begin{document}\n\
\\section{スモークテスト}\n\
日本語の表示テスト。数式: $E = mc^2$\n\
\\[\n\
  \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n\
\\]\n\
\\begin{circuitikz}[american]\n\
  \\draw (0,0) to[R, l=$R_1$] (2,0);\n\
\\end{circuitikz}\n\
\\end{document}\n' > smoke.tex \
    && lualatex -interaction=nonstopmode -halt-on-error -file-line-error smoke.tex \
    && echo "=== [PASS] lualatex smoke test (1st run — cache built) ===" \
    && lualatex -interaction=nonstopmode -halt-on-error -file-line-error smoke.tex \
    && echo "=== [PASS] lualatex smoke test (2nd run — cache warm) ===" \
    && rm -f /tmp/smoke.* \
    && echo "=== Smoke test complete ==="

# ──── 5. 環境変数 ────
ENV MAX_CONCURRENT_COMPILES=2
ENV COMPILE_MEM_LIMIT_MB=1536
ENV COMPILE_TIMEOUT_SECONDS=30

WORKDIR /app

# ──── 6. Python 依存 (レイヤキャッシュ最適化) ────
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ──── 7. アプリケーションコード ────
COPY app/ /app/app/
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# ──── 8. non-root ユーザー ────
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app \
    && mkdir -p /tmp/latex-work && chown appuser:appuser /tmp/latex-work
USER appuser

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

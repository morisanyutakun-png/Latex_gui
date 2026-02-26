FROM python:3.12-slim-bookworm

# ──── TeX Live インストール ────
#
# 重要: python:3.12-slim-bookworm (Debian 12) を使用すること。
#   Debian 13 (Trixie) の texlive パッケージ構成が異なるため。
#
# 戦略:
#   1) pdflatex + bxcjkjatype で日本語対応 (軽量、主エンジン)
#   2) xelatex + fontspec をフォールバック (重いが確実)

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
RUN mktexlsr && texhash && fc-cache -fv

# ── CJK.sty の所在を確認し、見つからなければ TEXINPUTS で補完 ──
# kpsewhich が DB 不整合で見つけられないケースへの対策
RUN echo "=== TeX Live verification ===" \
    && CJK_PATH=$(find /usr -name "CJK.sty" -type f 2>/dev/null | head -1) \
    && if [ -n "$CJK_PATH" ]; then \
         echo "  CJK.sty found at: $CJK_PATH"; \
         CJK_DIR=$(dirname "$CJK_PATH"); \
         echo "  Testing kpsewhich..."; \
         if ! kpsewhich CJK.sty >/dev/null 2>&1; then \
           echo "  kpsewhich cannot find CJK.sty; adding $CJK_DIR to TEXINPUTS"; \
           echo "export TEXINPUTS=\".:${CJK_DIR}//:\$TEXINPUTS\"" >> /etc/profile.d/texinputs.sh; \
         else \
           echo "  kpsewhich OK: $(kpsewhich CJK.sty)"; \
         fi; \
       else \
         echo "  WARNING: CJK.sty not found on filesystem!"; \
       fi \
    && BXC_PATH=$(find /usr -name "bxcjkjatype.sty" -type f 2>/dev/null | head -1) \
    && if [ -n "$BXC_PATH" ]; then \
         echo "  bxcjkjatype.sty found at: $BXC_PATH"; \
         BXC_DIR=$(dirname "$BXC_PATH"); \
         if ! kpsewhich bxcjkjatype.sty >/dev/null 2>&1; then \
           echo "  Adding $BXC_DIR to TEXINPUTS"; \
           echo "export TEXINPUTS=\".:${BXC_DIR}//:\$TEXINPUTS\"" >> /etc/profile.d/texinputs.sh; \
         fi; \
       fi \
    && which pdflatex && echo "  [OK] pdflatex" \
    && which xelatex  && echo "  [OK] xelatex" \
    && echo "=== Verification complete ==="

# ── TEXINPUTS を ENV に焼き込む (profile.d は subprocess では読まれないため) ──
# シェルスクリプトで生成されたパスを読み取って ENV 化する
RUN if [ -f /etc/profile.d/texinputs.sh ]; then \
      . /etc/profile.d/texinputs.sh && echo "TEXINPUTS=$TEXINPUTS"; \
    fi

# ── 実際のコンパイルテスト (3エンジン) ──
RUN set -e; \
    EXTRA_TEXINPUTS=""; \
    if [ -f /etc/profile.d/texinputs.sh ]; then . /etc/profile.d/texinputs.sh; fi; \
    cd /tmp \
    && printf '\\documentclass{article}\n\\usepackage[whole]{bxcjkjatype}\n\\begin{document}\nHello テスト 日本語\n\\end{document}\n' > test_cjk.tex \
    && if pdflatex -interaction=nonstopmode -halt-on-error test_cjk.tex; then \
         echo "=== [OK] pdflatex + bxcjkjatype PASSED ==="; \
       else \
         echo "=== [WARN] pdflatex + CJK failed ==="; \
       fi \
    && printf '\\documentclass{article}\n\\usepackage{luatexja}\n\\begin{document}\nHello テスト 日本語\n\\end{document}\n' > test_lua.tex \
    && if lualatex -interaction=nonstopmode -halt-on-error test_lua.tex; then \
         echo "=== [OK] lualatex + luatexja PASSED ==="; \
       else \
         echo "=== [WARN] lualatex + luatexja failed ==="; \
       fi \
    && printf '\\documentclass{article}\n\\usepackage{xeCJK}\n\\setCJKmainfont{Noto Sans CJK JP}\n\\begin{document}\nHello テスト 日本語\n\\end{document}\n' > test_xe.tex \
    && if xelatex -interaction=nonstopmode -halt-on-error test_xe.tex; then \
         echo "=== [OK] xelatex + xeCJK PASSED ==="; \
       else \
         echo "=== [WARN] xelatex + xeCJK failed ==="; \
       fi \
    && rm -f /tmp/test_*

ENV MAX_CONCURRENT_COMPILES=2
ENV COMPILE_MEM_LIMIT_MB=512
ENV REQUEST_TIMEOUT_SECONDS=60
ENV CJK_MAIN_FONT="Noto Serif CJK JP"
ENV CJK_SANS_FONT="Noto Sans CJK JP"

WORKDIR /app

# ── アプリケーションコードのコピー ──
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
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

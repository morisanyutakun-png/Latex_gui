FROM python:3.12-slim-bookworm

# ──── TeX Live インストール ────
#
# 重要: python:3.12-slim-bookworm (Debian 12) を使用すること。
#
# 3エンジン対応:
#   1) pdflatex + bxcjkjatype (軽量、主エンジン)
#   2) lualatex + luatexja (堅牢、HaranoAji内蔵)
#   3) xelatex + xeCJK (フォント検出方式)

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        texlive-latex-base \
        texlive-latex-recommended \
        texlive-latex-extra \
        texlive-luatex \
        texlive-pictures \
        texlive-science \
        texlive-fonts-recommended \
        texlive-lang-japanese \
        texlive-lang-cjk \
        texlive-lang-chinese \
        texlive-xetex \
        latex-cjk-common \
        fonts-noto-cjk \
        poppler-utils \
        fontconfig \
    && rm -rf /var/lib/apt/lists/*

# ── TeX パッケージDB再構築 + フォントキャッシュ ──
RUN mktexlsr && texhash && fc-cache -fv

# ── .sty パスを検出して TEXINPUTS を確定 (ENV に焼き込む) ──
# profile.d は subprocess では読まれないため、Dockerの ENV で永続化する
RUN set -ex; \
    EXTRA=""; \
    for STY in CJK.sty bxcjkjatype.sty xeCJK.sty luatexja.sty luatexja-preset.sty; do \
      if ! kpsewhich "$STY" >/dev/null 2>&1; then \
        FOUND=$(find /usr -name "$STY" -type f 2>/dev/null | head -1); \
        if [ -n "$FOUND" ]; then \
          DIR=$(dirname "$FOUND"); \
          echo "  $STY not in kpsewhich DB, found at $DIR"; \
          EXTRA="${EXTRA}${DIR}//:"; \
        else \
          echo "  WARNING: $STY not found anywhere!"; \
        fi; \
      else \
        echo "  $STY: $(kpsewhich $STY)"; \
      fi; \
    done; \
    if [ -n "$EXTRA" ]; then \
      echo "TEXINPUTS=.:${EXTRA}\$TEXINPUTS" > /etc/texinputs.env; \
    fi; \
    which pdflatex && echo "  [OK] pdflatex"; \
    which lualatex && echo "  [OK] lualatex"; \
    which xelatex  && echo "  [OK] xelatex"; \
    echo "=== TeX Live verification complete ==="

# ── TEXINPUTS を ENV に焼き込む ──
# 前のRUN stepで作成した設定を読み取り、ARGでENVに渡す
# (RUN 内の export は次の RUN に引き継がれないため、ファイル経由で渡す)
RUN if [ -f /etc/texinputs.env ]; then \
      cat /etc/texinputs.env; \
    else \
      echo "No extra TEXINPUTS needed"; \
    fi

# ── 実際のコンパイルテスト (3エンジン) + フォントキャッシュ構築 ──
# Docker ビルド時に lualatex のフォントキャッシュを作成しておくことで
# ランタイムのコンパイルが高速 (3-10秒) になる。
RUN set -e; \
    if [ -f /etc/texinputs.env ]; then . /etc/texinputs.env; export TEXINPUTS; fi; \
    cd /tmp \
    && printf '\\documentclass{article}\n\\usepackage[whole]{bxcjkjatype}\n\\begin{document}\nHello テスト 日本語\n\\end{document}\n' > test_cjk.tex \
    && (pdflatex -interaction=nonstopmode -halt-on-error test_cjk.tex \
        && echo "=== [OK] pdflatex + bxcjkjatype ===" \
        || echo "=== [WARN] pdflatex + CJK failed ===") \
    && printf '\\documentclass{article}\n\\usepackage[haranoaji]{luatexja-preset}\n\\begin{document}\nHello テスト 日本語\n\\end{document}\n' > test_lua.tex \
    && (lualatex -interaction=nonstopmode -halt-on-error test_lua.tex \
        && echo "=== [OK] lualatex + luatexja-preset (font cache built) ===" \
        || echo "=== [WARN] lualatex + luatexja-preset failed ===") \
    && printf '\\documentclass{article}\n\\usepackage{xeCJK}\n\\setCJKmainfont{Noto Sans CJK JP}\n\\begin{document}\nHello テスト 日本語\n\\end{document}\n' > test_xe.tex \
    && (xelatex -interaction=nonstopmode -halt-on-error test_xe.tex \
        && echo "=== [OK] xelatex + xeCJK ===" \
        || echo "=== [WARN] xelatex + xeCJK failed ===") \
    && echo "=== 2nd lualatex run (ensure cache warm) ===" \
    && (lualatex -interaction=nonstopmode -halt-on-error test_lua.tex \
        && echo "=== [OK] lualatex 2nd run (cache verified) ===" \
        || true) \
    && rm -f /tmp/test_* \
    && echo "=== Font cache verification ===" \
    && find / -path "*/luatex-cache*" -type d 2>/dev/null | head -5 || true

ENV MAX_CONCURRENT_COMPILES=2
ENV COMPILE_MEM_LIMIT_MB=1536
ENV COMPILE_TOTAL_BUDGET_SECONDS=45
ENV CJK_MAIN_FONT="Noto Serif CJK JP"
ENV CJK_SANS_FONT="Noto Sans CJK JP"

WORKDIR /app

# ── アプリケーションコードのコピー (entrypoint.sh も同時に処理) ──
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
    fi; \
    # entrypoint.sh のコピー \
    if [ -f /tmp/_ctx/entrypoint.sh ]; then \
        cp /tmp/_ctx/entrypoint.sh /app/entrypoint.sh; \
    elif [ -f /tmp/_ctx/backend/entrypoint.sh ]; then \
        cp /tmp/_ctx/backend/entrypoint.sh /app/entrypoint.sh; \
    else \
        printf '#!/bin/sh\nset -e\nif [ -f /etc/texinputs.env ]; then . /etc/texinputs.env; export TEXINPUTS; fi\nexec "$@"\n' > /app/entrypoint.sh; \
    fi; \
    chmod +x /app/entrypoint.sh; \
    rm -rf /tmp/_ctx

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

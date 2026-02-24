FROM python:3.12-slim

# TeX Live + 日本語フォント（Noto CJK）
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-lang-japanese \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    && rm -rf /var/lib/apt/lists/*

# Docker環境ではNoto CJKフォントを使用
ENV CJK_MAIN_FONT="Noto Serif CJK JP"
ENV CJK_SANS_FONT="Noto Sans CJK JP"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

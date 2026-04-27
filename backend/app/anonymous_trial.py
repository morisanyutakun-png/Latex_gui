"""ログインなし無料お試し生成 (Eddivom anonymous trial).

CVR 検証用の最小実装: 未ログインの広告流入ユーザーが「1 回だけ生成を試す」ための
単発 LLM コール → LuaLaTeX コンパイル → PDF 返却。

設計方針:
  - ai_service.py の agent ループ (tools / multi-turn) は使わず、単一 chat completion
    だけで完結させる。理由:
       * 匿名トライアルは 30〜60 秒以内に PDF を返したい (CVR 最適化)。
       * agent は high-cost なので、認証ユーザの quota 設計に合わせている。
  - フロント側 (Next.js proxy + localStorage) と二重に絞る。サーバ側は
    rate_limit.enforce_rate_limit を IP / 匿名 cookie 別で適用するのが本筋。
  - 生成 LaTeX は security.py の validate_latex_security を必ず通す。
    LLM が出力する LaTeX をそのままコンパイルすると \\write18 / minted 等で
    任意コード実行可能 — 必須ガード。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Optional

from .ai_service import MODEL_CHAT, get_client, max_tokens_param
from .models import DocumentModel
from .pdf_service import compile_pdf, PDFGenerationError

logger = logging.getLogger(__name__)


# 匿名トライアルでだけ使う、確実にコンパイルが通る最小プリアンブル。
# テンプレート (templates.ts の JA_BASE) と思想を合わせ、tcolorbox 等は外して
# セキュリティ違反になりそうな表現を最初から避ける。
_TRIAL_PREAMBLE_JA = r"""\documentclass[11pt,a4paper]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage[margin=22mm]{geometry}
\usepackage{amsmath,amssymb,amsthm,mathtools,bm}
\usepackage{enumitem}
\usepackage{xcolor}
\usepackage{hyperref}
\hypersetup{hidelinks}
\title{}
\date{}
"""

_TRIAL_PREAMBLE_EN = r"""\documentclass[11pt,a4paper]{article}
\usepackage[margin=22mm]{geometry}
\usepackage{amsmath,amssymb,amsthm,mathtools,bm}
\usepackage{enumitem}
\usepackage{xcolor}
\usepackage{hyperref}
\hypersetup{hidelinks}
\title{}
\date{}
"""

# トピック文字列の長さ上限 (プロンプト爆発防止)
MAX_TOPIC_LEN = 200


def _system_prompt(locale: str) -> str:
    r"""単発生成用の system prompt。

    重要なポイント:
      * 出力は 1 ファイルの完全な LaTeX ソース (\documentclass〜\end{document}) のみ
      * tikz / minted / shell-escape を使わない (security.py で弾かれるため)
      * 解答は \section*{解答} に分けて入れる (登録への動機付け)
    """
    if locale == "en":
        return (
            "You are Eddivom, an AI worksheet generator. The user is trying the product "
            "without signing in, so produce one beautifully typeset, print-ready LaTeX "
            "worksheet on the topic they describe.\n\n"
            "REQUIREMENTS:\n"
            "  - Output a single, COMPLETE LaTeX document (preamble through \\end{document}).\n"
            "  - Use only: amsmath, amssymb, amsthm, mathtools, bm, enumitem, geometry, "
            "    xcolor, hyperref. Do NOT use tikz, minted, pgfplots, or any \\write18 / "
            "    shell-escape primitive.\n"
            "  - Include 3-5 problems with clearly numbered items.\n"
            "  - Append a separate \\section*{Answers} section with brief solutions.\n"
            "  - Reply with the LaTeX source ONLY — no markdown fences, no commentary."
        )
    return (
        "あなたは Eddivom — AI 教材作成ツールです。ユーザーは未ログインで「お試し」として "
        "教材生成を試しています。指定されたトピックで、印刷品質の LaTeX 問題集を 1 ファイル分 "
        "出力してください。\n\n"
        "出力要件:\n"
        "  - \\documentclass から \\end{document} までを含む完全な LaTeX ソース 1 つのみ。\n"
        "  - 使ってよいパッケージは amsmath, amssymb, amsthm, mathtools, bm, enumitem, "
        "    geometry, xcolor, hyperref のみ。tikz / minted / pgfplots / shell-escape は禁止。\n"
        "  - 問題は 3〜5 問、enumerate で番号付けする。\n"
        "  - 末尾に \\section*{解答} を設けて略解を付ける。\n"
        "  - 返答は LaTeX ソースのみ — マークダウンの ``` フェンスも説明文も付けない。"
    )


def _user_prompt(topic: str, locale: str) -> str:
    topic = (topic or "").strip()[:MAX_TOPIC_LEN]
    if not topic:
        topic = (
            "高校数学・二次関数の基本問題 (グラフ・最大最小・解の配置)"
            if locale != "en"
            else "high school algebra: quadratic functions (graphs, extrema, root placement)"
        )
    if locale == "en":
        return f"Generate a worksheet on this topic:\n\n{topic}"
    return f"次のトピックで問題集を生成してください:\n\n{topic}"


_FENCE_RE = re.compile(r"^```(?:latex|tex)?\s*\n([\s\S]*?)\n```\s*$", re.IGNORECASE)


def _strip_markdown_fences(text: str) -> str:
    """LLM が ```latex ... ``` で囲んで返したときの剥がし処理。"""
    if not text:
        return text
    m = _FENCE_RE.match(text.strip())
    if m:
        return m.group(1).strip()
    return text.strip()


def _ensure_complete_document(latex: str, locale: str) -> str:
    """LLM が preamble を省略 / \\begin{document} 以降だけ返したときの救済。

    本番ユーザはエージェント経由で常に完全な LaTeX を出すが、単発 completion では
    たまに本文だけ返すことがある。最低限コンパイルが通る形に補完する。
    """
    has_class = "\\documentclass" in latex
    has_begin = "\\begin{document}" in latex
    has_end = "\\end{document}" in latex

    if has_class and has_begin and has_end:
        return latex

    preamble = _TRIAL_PREAMBLE_EN if locale == "en" else _TRIAL_PREAMBLE_JA
    body = latex.strip()
    # \begin{document} がある場合は preamble だけ付け足す
    if has_begin and has_end and not has_class:
        return preamble + "\n" + body
    # 本文しか無い場合は丸ごと文書化
    if not has_begin:
        body = "\\begin{document}\n" + body + "\n\\end{document}"
    if not has_class:
        body = preamble + body
    return body


async def generate_anonymous_pdf(topic: str, locale: str = "ja") -> tuple[bytes, str]:
    """匿名トライアル用に LaTeX 1 本生成 → PDF コンパイル。

    Returns:
        (pdf_bytes, latex_source)  ← フロントは PDF だけ表示するが、デバッグ・将来の
        「ログイン後にこのソースを引き継ぐ」フローのために LaTeX も返しておく。
    Raises:
        ValueError: ANTHROPIC_API_KEY 未設定 or LLM 呼び出し失敗
        PDFGenerationError: LaTeX セキュリティ違反 / コンパイル失敗
    """
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise ValueError("ANTHROPIC_API_KEY is not configured on the backend.")

    client = get_client()
    sys_prompt = _system_prompt(locale)
    usr_prompt = _user_prompt(topic, locale)

    logger.info("[anonymous_trial] starting generation: topic=%r locale=%s", topic[:80], locale)

    def _call():
        return client.chat.completions.create(
            model=MODEL_CHAT,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": usr_prompt},
            ],
            temperature=0.6,
            **max_tokens_param(MODEL_CHAT, 4096),
        )

    response = await asyncio.get_event_loop().run_in_executor(None, _call)
    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        raise ValueError("LLM returned empty content for anonymous trial")

    latex = _strip_markdown_fences(raw)
    latex = _ensure_complete_document(latex, locale)

    doc = DocumentModel(
        template="blank",
        latex=latex,
    )
    doc.metadata.title = "Eddivom — 無料お試し" if locale != "en" else "Eddivom — Free trial"

    try:
        pdf_bytes = await compile_pdf(doc)
    except PDFGenerationError:
        # security_violation はそのまま伝播 — ルータ側で 422 にする
        raise

    logger.info("[anonymous_trial] success: %d bytes", len(pdf_bytes))
    return pdf_bytes, latex

"""OMR service — image/PDF → raw LaTeX via OpenAI Vision

方針:
  - 画像/PDF からテキスト・数式・表・図を読み取り、raw LaTeX として返す
  - AI には set_latex ツール (簡略版) を使わせて完全な LaTeX を返させる
  - PDF は PyMuPDF (fitz) → poppler → text-only の3段フォールバック
"""
import base64
import json
import logging
import os
import subprocess
import tempfile

from .ai_service import get_client, MODEL_VISION, max_tokens_param

logger = logging.getLogger(__name__)


# ─── Post-processing constants ──────────────────────────────────────────────
#
# security.py の ALLOWED_PACKAGES にない、かつ AI が「うっかり書きがち」なもの。
# Vision 応答の LaTeX から `\usepackage{...}` 行を削って `autofix_latex` を通すこと
# で、compile 前に「セキュリティポリシー違反」で弾かれるのを防ぐ。
_FORBIDDEN_AI_PACKAGES = frozenset({
    # 疑似コード (tcolorbox で代替)
    "algorithm", "algpseudocode", "algorithmicx", "algorithmic",
    # 著者ブロック (手書きで代替)
    "authblk",
    # 参考文献の拡張 (native \cite で十分)
    "cite", "natbib", "biblatex",
    # 段組バランス (不要)
    "balance",
    # 目次拡張 (手動 \addcontentsline で代替)
    "tocbibind",
    # ポスター系 (article+multicol で代替)
    "beamerposter", "beamer",
    # CJK 系 (luatexja-preset に統一)
    "CJK", "CJKutf8", "cjk",
    # 日本語クラス関連
    "ujarticle", "jsclasses",
})


def _strip_forbidden_packages(latex: str) -> tuple[str, list[str]]:
    """\\usepackage{...} 行から許可リスト外のパッケージを抜く。

    - `\\usepackage{a, b}` のように複数書かれている場合は、該当パッケージだけ外し
      他を残す (例: `a` が禁止で `b` が許可なら `\\usepackage{b}` に縮める)。
    - すべて禁止なら行ごと削除。
    - オプション `\\usepackage[opt]{...}` も同様に処理する。
    """
    import re
    stripped: list[str] = []

    pattern = re.compile(r'\\usepackage(\[[^\]]*\])?\{([^}]+)\}')

    def _repl(m: re.Match) -> str:
        opts = m.group(1) or ""
        pkgs = [p.strip() for p in m.group(2).split(",") if p.strip()]
        kept = [p for p in pkgs if p not in _FORBIDDEN_AI_PACKAGES]
        dropped = [p for p in pkgs if p in _FORBIDDEN_AI_PACKAGES]
        if dropped:
            stripped.extend(dropped)
        if not kept:
            return ""
        return "\\usepackage" + opts + "{" + ", ".join(kept) + "}"

    fixed = pattern.sub(_repl, latex)
    # 空の usepackage 行が残ると空行が連続するので掃除
    fixed = re.sub(r'\n{3,}', "\n\n", fixed)
    return fixed, stripped


def _postprocess_latex(latex: str | None) -> str | None:
    """OMR 応答の LaTeX を compile 前に堅牢化する:
    1. 許可リスト外パッケージの除去
    2. 末尾の改行・バッククォートの trim
    3. `autofix_latex` (文書ラッピング + パッケージ自動補完)
    """
    if not latex or not latex.strip():
        return latex

    latex = latex.strip()
    # AI が Markdown コードフェンスで包むことがあるので剥がす
    if latex.startswith("```"):
        lines = latex.split("\n")
        # 先頭の ```latex 等を削除
        lines = lines[1:]
        # 末尾の ``` を削除
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        latex = "\n".join(lines).strip()

    cleaned, dropped = _strip_forbidden_packages(latex)
    if dropped:
        logger.info("OMR post-process: stripped forbidden packages: %s", dropped)

    # autofix_latex は「裸テキストの wrapping + 不足パッケージの自動注入 + 文字正規化」を行う
    try:
        from . import latex_autofix
        cleaned = latex_autofix.autofix_latex(cleaned)
    except Exception as e:
        logger.warning("OMR post-process: autofix_latex failed (non-fatal): %s", e)

    return cleaned


def _validate_against_security(latex: str | None) -> list[str]:
    """security.validate_latex_security を呼び、違反コードのリストを返す。
    エラーがなければ空リスト。compile 前の最後の関門。"""
    if not latex:
        return []
    try:
        from . import security
        violations = security.validate_latex_security(latex)
        # ユーザに分かりやすいラベルに整形
        labels: list[str] = []
        for v in violations:
            code = v.get("code")
            if code == "package_not_allowed":
                labels.append(f"package:{v.get('package', '?')}")
            elif code == "tikz_library_not_allowed":
                labels.append(f"tikz:{v.get('library', '?')}")
            elif code == "forbidden_command":
                labels.append(f"forbidden_cmd:{v.get('command', '?')}")
            elif code == "dangerous_command":
                labels.append(f"dangerous_cmd:{v.get('command', '?')}")
            else:
                labels.append(str(code))
        return labels
    except Exception as e:
        logger.warning("OMR post-process: security validation failed (non-fatal): %s", e)
        return []


# ─── OMR prompt allow-list ──────────────────────────────────────────────────
#
# 許可パッケージは backend/app/security.py の ALLOWED_PACKAGES と 1:1 で同期すること。
# ここに挙げないパッケージを AI が生成すると security 検証で弾かれる。
_ALLOWED_PKG_JA = (
    "amsmath, amssymb, amsthm, mathtools, bm, siunitx, physics, cancel, "
    "booktabs, tabularx, array, longtable, multirow, colortbl, makecell, "
    "enumitem, tcolorbox, mdframed, framed, graphicx, xcolor, hyperref, "
    "geometry, fancyhdr, titlesec, listings, verbatim, fancyvrb, multicol, "
    "tikz, pgfplots, circuitikz, mhchem, chemfig, float, wrapfig, subcaption, "
    "caption, setspace, comment, url, lastpage, qrcode"
)
_FORBIDDEN_PKG = (
    "algorithm, algpseudocode, algorithmicx, authblk, cite, balance, "
    "tocbibind, beamerposter, biblatex, natbib, CJK, CJKutf8"
)


_OMR_SYSTEM_PROMPT_JA = r"""\
You are the OMR (image/PDF → LaTeX) extraction engine inside a Japanese LaTeX editor.
Your only job: read the uploaded image/PDF and emit ONE complete, compilable LaTeX document
via the `set_latex` tool call. Produce nothing else.

══════════════════════════════════════════════
# PART 1: OUTPUT CONTRACT (必ず守る)
══════════════════════════════════════════════
1. Call `set_latex` exactly once with the FULL source (preamble → `\begin{document}` → body → `\end{document}`).
2. Do NOT write the LaTeX in the chat content; the `content` field should be empty or a one-line status.
3. The document MUST compile under LuaLaTeX with the allow-listed packages only.

══════════════════════════════════════════════
# PART 2: REQUIRED PREAMBLE (日本語ドキュメント向け)
══════════════════════════════════════════════
\documentclass[11pt,a4paper]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\geometry{margin=20mm}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}

必要に応じて以下からのみ追加可:
""" + _ALLOWED_PKG_JA + r"""

**禁止パッケージ (絶対に読み込まない):** """ + _FORBIDDEN_PKG + r"""
→ これらは security 検証で弾かれコンパイル不能になる。疑似コードは `tcolorbox` の箱で代用、
   参考文献は `thebibliography` 環境、著者ブロックは `\author{...}` 手書きで書くこと。

══════════════════════════════════════════════
# PART 3: 抽出ルール (DO EXTRACT)
══════════════════════════════════════════════
| 原本の要素          | LaTeX での書き方                                   |
|---------------------|---------------------------------------------------|
| 大見出し・章         | `\section{...}` (番号付きを保つ)                   |
| 中見出し             | `\subsection{...}`                                |
| 小見出し             | `\subsubsection{...}`                             |
| 本文段落             | 空行で区切るプレーンテキスト                        |
| インライン数式       | `$ ... $` (例: `$x^2 + 1$`)                       |
| 独立数式 (センタリング) | `\[ ... \]` (番号なし) or `\begin{equation}`       |
| 連立・配列           | `\begin{align} ... \end{align}` (番号付き揃え)    |
| 分数                 | `\dfrac{a}{b}` (本文) / `\frac{a}{b}` (数式内)    |
| 平方根・根号         | `\sqrt{x}` / `\sqrt[n]{x}`                        |
| 上下付き             | `x^{2n+1}`, `a_{i,j}` (必ず `{}` で括る)          |
| 総和・積分           | `\sum_{k=1}^{n}`, `\int_a^b f(x)\,dx`             |
| ベクトル             | `\vec{v}` or `\bm{v}`                             |
| 集合・複素・実数     | `\mathbb{R}`, `\mathbb{Z}`, `\mathcal{L}`         |
| 箇条書き (・, -, ●)  | `\begin{itemize}\item ...\end{itemize}`           |
| 番号付きリスト       | `\begin{enumerate}\item ...\end{enumerate}`       |
| (1)(2)…             | `\begin{enumerate}[label=(\arabic*)]\item ...`    |
| 表 (枠線あり)        | `\begin{tabular}{lcr}\toprule ... \bottomrule\end{tabular}` |
| 表 (キャプション付き) | `\begin{table}[h]\centering\caption{...} ...`    |
| 化学式               | `\ce{H2O}`, `\ce{CO2 + H2O -> H2CO3}` (mhchem)    |
| 太字                 | `\textbf{...}`                                    |
| 斜体                 | `\emph{...}` or `\textit{...}`                    |
| 下線                 | `\underline{...}`                                 |
| 注記・コメント       | `% ...` (LaTeX コメント)                          |
| 図 (写真・スキャン)  | `\begin{figure}[h]\centering\fbox{\parbox[c][40mm][c]{80mm}{\centering [図: 説明]}}\caption{...}\end{figure}` |
| 簡単な図形           | `\begin{tikzpicture} ... \end{tikzpicture}` (座標軸・矢印・ノードは TikZ で再現) |
| 選択肢 (① ② ③ ④)    | `\begin{enumerate}[label=\textcircled{\arabic*}]`  |
| 穴埋め空欄           | `\underline{\hspace{20mm}}`                        |

══════════════════════════════════════════════
# PART 4: 避けるべき典型ミス
══════════════════════════════════════════════
1. **全角英数字・記号は半角に正規化** (数式内は特に):
   `ａｂｃ１２３` → `abc 123`、`（）` → `()`、`＋－×÷` → `+ - \times \div`
2. **ギリシャ文字は LaTeX コマンドで書く**:
   `α β γ δ ε θ λ μ π σ ω` → `\alpha \beta \gamma \delta \varepsilon \theta \lambda \mu \pi \sigma \omega`
3. **添字・指数は必ず波括弧**:
   `x^23` ❌ → `x^{23}` ✓   /   `a_10` ❌ → `a_{10}` ✓
4. **大きな括弧は `\left( ... \right)`** を使う (高さ自動調整):
   `( \frac{a}{b} )` → `\left( \dfrac{a}{b} \right)`
5. **数式とテキストの区切り**: テキスト中の変数は必ず `$` で囲む (例: 「関数$f(x)$は」)。
6. **数式中に日本語を入れる場合は `\text{...}`** (`\text{ただし } x > 0`)。
7. **長い LaTeX コマンド名**: `\sqrt` `\frac` `\int` 等は画像から読み取り時に欠落しやすい。
   文脈 (分数バー・√記号・∫) を必ず LaTeX コマンドに写像する。
8. **`$` と `\(` `\)` を混在させない**。本書は `$...$` を統一。
9. **表の区切り文字 `&` を本文で使うときはエスケープ** (`\&`)。`%` `#` `_` も同様 (`\%` `\#` `\_`)。
10. **手書きで打ち消し線が引かれた部分は出力に含めない**。
11. **数字 0 と文字 O、1 と l、2 と Z、5 と S の識別**: 文脈で判断。数式中なら通常 0, 1, 2, 5 の可能性が高い。
12. **段落の先頭インデント**: 段落の視覚的な字下げが見える場合はそのまま `\par` 区切りでよい。

══════════════════════════════════════════════
# PART 5: FEW-SHOT (数式を含む例)
══════════════════════════════════════════════
【原文例 A (試験問題)】
  第 1 問 次の方程式を解け。
  2x² - 5x + 3 = 0

【生成すべき LaTeX】
  \section*{第 1 問}
  次の方程式を解け。
  \[ 2x^{2} - 5x + 3 = 0 \]

【原文例 B (表)】
  | 手法 | 精度 | 時間 |
  | A    | 85.2 | 120  |
  | 提案 | 91.8 | 42   |

【生成すべき LaTeX】
  \begin{table}[h]
    \centering
    \begin{tabular}{lcc}
      \toprule
      手法   & 精度 [\%] & 時間 [s]\\
      \midrule
      A      & 85.2      & 120\\
      \textbf{提案} & \textbf{91.8} & \textbf{42}\\
      \bottomrule
    \end{tabular}
  \end{table}

【原文例 C (化学式)】
  2H₂ + O₂ → 2H₂O

【生成すべき LaTeX】
  \ce{2H2 + O2 -> 2H2O}

══════════════════════════════════════════════
# PART 6: 不確実性の扱い
══════════════════════════════════════════════
- 読み取り不能な箇所は、見えた部分だけ転写し末尾に `% (要確認)` を付ける。
- 完全に読めない図やグラフは `\begin{figure}[h]\centering\fbox{\parbox[c][40mm][c]{80mm}{\centering [図: 読み取れず]}}\caption{要確認}\end{figure}` で代替。
- 推測で内容を補わない。見えるものだけを正確に転写する。

══════════════════════════════════════════════
# PART 7: 言語
══════════════════════════════════════════════
- 原本が日本語なら生成 LaTeX の自然言語部分も日本語で。
- chat 返信 (content フィールド) は最低限 — 基本は空でよい。
"""


_OMR_SYSTEM_PROMPT_EN = r"""\
You are the OMR (image/PDF → LaTeX) extraction engine inside an English-first LaTeX editor.
Your only job: read the uploaded image/PDF and emit ONE complete, compilable LaTeX document
via the `set_latex` tool call. Produce nothing else.

══════════════════════════════════════════════
# PART 1: OUTPUT CONTRACT
══════════════════════════════════════════════
1. Call `set_latex` exactly once with the FULL source (preamble → `\begin{document}` → body → `\end{document}`).
2. Do NOT write the LaTeX in the chat content; the `content` field should be empty or one-line status.
3. The document MUST compile under LuaLaTeX with the allow-listed packages only.

══════════════════════════════════════════════
# PART 2: REQUIRED PREAMBLE (English document)
══════════════════════════════════════════════
\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{geometry}
\geometry{margin=20mm}
\usepackage{amsmath, amssymb, amsthm, mathtools, bm}
\usepackage{booktabs, tabularx, array}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}

You may add ONLY from this allow-list as needed:
""" + _ALLOWED_PKG_JA + r"""

**Forbidden (will fail security check):** """ + _FORBIDDEN_PKG + r"""
→ Use `tcolorbox` for pseudo-code boxes, `thebibliography` for references,
  hand-written `\author{...}` blocks for author lists.

**Do NOT include `luatexja-preset`** — this is an English document.

══════════════════════════════════════════════
# PART 3: EXTRACTION RULES
══════════════════════════════════════════════
| Source element            | LaTeX                                              |
|---------------------------|----------------------------------------------------|
| Title / H1                | `\section{...}`                                    |
| Subtitle / H2             | `\subsection{...}`                                |
| Body paragraph            | Plain text separated by blank lines               |
| Inline math               | `$ ... $` (e.g. `$x^2 + 1$`)                      |
| Display math              | `\[ ... \]`                                       |
| Aligned equations         | `\begin{align} ... \end{align}`                   |
| Fraction                  | `\dfrac{a}{b}` (body) / `\frac{a}{b}` (math-only) |
| Roots                     | `\sqrt{x}` / `\sqrt[n]{x}`                        |
| Sub/superscripts          | `x^{2n+1}`, `a_{i,j}` (ALWAYS brace multi-char)   |
| Sums/integrals            | `\sum_{k=1}^{n}`, `\int_a^b f(x)\,dx`              |
| Vectors                   | `\vec{v}` or `\bm{v}`                             |
| Blackboard / calligraphic | `\mathbb{R}`, `\mathcal{L}`                       |
| Bullet list               | `\begin{itemize}\item ...\end{itemize}`           |
| Numbered list             | `\begin{enumerate}\item ...\end{enumerate}`       |
| (1)(2) labels             | `\begin{enumerate}[label=(\arabic*)]`             |
| Table                     | `\begin{tabular}{lcr}\toprule ... \bottomrule\end{tabular}` |
| Table with caption        | Wrap in `\begin{table}[h]\centering\caption{...}` |
| Chemistry                 | `\ce{H2O}`, `\ce{CO2 + H2O -> H2CO3}` (mhchem)    |
| Bold / italic             | `\textbf{...}` / `\emph{...}`                     |
| Figure (photo / scan)     | `\begin{figure}[h]\centering\fbox{\parbox[c][40mm][c]{80mm}{\centering [Figure: caption]}}\end{figure}` |
| Line drawing              | `\begin{tikzpicture} ... \end{tikzpicture}`       |
| Multiple-choice options   | `\begin{enumerate}[label=\textcircled{\arabic*}]` |
| Fill-in-the-blank         | `\underline{\hspace{20mm}}`                       |

══════════════════════════════════════════════
# PART 4: COMMON MISTAKES TO AVOID
══════════════════════════════════════════════
1. **Full-width chars → half-width** in math: `ａｂｃ` → `abc`, `（）` → `()`, `＋` → `+`.
2. **Greek letters → LaTeX commands**: α β γ δ ε θ λ μ π σ ω → \alpha \beta \gamma \delta \varepsilon \theta \lambda \mu \pi \sigma \omega.
3. **ALWAYS brace multi-char super/subscripts**: `x^23` ❌ → `x^{23}` ✓.
4. **Use `\left( ... \right)`** for auto-sized delimiters around tall expressions.
5. **Wrap text variables in `$...$`** even in running prose (e.g. "the function $f(x)$ satisfies").
6. **Text inside math mode**: wrap in `\text{...}`.
7. **Preserve visual context**: a fraction bar means `\frac`; a √ means `\sqrt`; ∫ means `\int`; Σ means `\sum`. Don't transcribe these as plain characters.
8. **Do NOT mix `$...$` with `\( ... \)`** — stick to `$...$`.
9. **Escape `&`, `%`, `#`, `_` in plain text**: `\&`, `\%`, `\#`, `\_`.
10. **Skip struck-through content**.
11. **Digits 0/O, 1/l, 2/Z, 5/S**: choose based on math-vs-text context.
12. **No forbidden commands**: `\input`, `\include`, `\write18`, `\directlua` — never.

══════════════════════════════════════════════
# PART 5: FEW-SHOT
══════════════════════════════════════════════
【Source A (exam problem)】
  Problem 1. Solve the equation.
  2x² - 5x + 3 = 0

【Expected LaTeX】
  \section*{Problem 1}
  Solve the equation.
  \[ 2x^{2} - 5x + 3 = 0 \]

【Source B (table)】
  | Method | Acc. | Time |
  | A      | 85.2 | 120  |
  | Ours   | 91.8 | 42   |

【Expected LaTeX】
  \begin{table}[h]
    \centering
    \begin{tabular}{lcc}
      \toprule
      Method & Acc. [\%] & Time [s]\\
      \midrule
      A      & 85.2      & 120\\
      \textbf{Ours} & \textbf{91.8} & \textbf{42}\\
      \bottomrule
    \end{tabular}
  \end{table}

【Source C (chemistry)】
  2H₂ + O₂ → 2H₂O

【Expected LaTeX】
  \ce{2H2 + O2 -> 2H2O}

══════════════════════════════════════════════
# PART 6: UNCERTAINTY
══════════════════════════════════════════════
- Unreadable fragments: transcribe what you see and add `% (unclear)` at end of line.
- Completely unreadable figures: use the figure placeholder with `[Figure: unclear]`.
- Do NOT invent content — transcribe only what is visible.
"""


def _omr_prompts(locale: str) -> dict[str, str]:
    """Return the four OMR prompt variants (base / pdf / handwriting / text-only)
    for the given UI locale. Falls back to Japanese for any non-'en' locale."""
    if (locale or "").lower() == "en":
        base = _OMR_SYSTEM_PROMPT_EN
        pdf_extra = (
            "\n\n## PDF-specific instructions\n"
            "- The user uploaded a multi-page PDF. Treat it as one continuous document.\n"
            "- Use the extracted text as the primary source and the page images for verification.\n"
            "- Number sections naturally (e.g. 'Chapter 1', '1.', 'Problem 1') if the original has them.\n"
        )
        hw_extra = (
            "\n\n## Handwriting mode\n"
            "The image is HANDWRITTEN (notebook, whiteboard, exam answer). Be extra careful with:\n"
            "- Greek letters (α/a, β/B, ε/E, θ/0, π/n)\n"
            "- Sub/superscripts\n"
            "- Fractions / square roots / matrices\n"
            "- Crossed-out / struck-through content → SKIP\n"
            "Where unsure, transcribe what you see and mark it '(unclear)'.\n"
        )
        text_extra = (
            "\n\n## Text-only PDF instructions\n"
            "You only have raw extracted text (no images). Reconstruct the logical structure\n"
            "from line breaks and section numbering.\n"
        )
    else:
        base = _OMR_SYSTEM_PROMPT_JA
        pdf_extra = (
            "\n\n## PDF-specific instructions\n"
            "- The user uploaded a multi-page PDF. Treat it as one continuous document.\n"
            "- Use the extracted text as the primary source and the page images for verification.\n"
            '- Number sections naturally (e.g. "第1章", "1.", "問1") if the original has them.\n'
        )
        hw_extra = (
            "\n\n## Handwriting mode\n"
            "The image is HANDWRITTEN (notebook, board, exam answer). Be extra careful with:\n"
            "- Greek letters (α/a, β/B, ε/E, θ/0, π/n)\n"
            "- Sub/superscripts\n"
            "- Fractions / square roots / matrices\n"
            "- 日本語の崩し字\n"
            "- Crossed-out / struck-through content → SKIP\n"
            'Where unsure, transcribe + "(要確認)".\n'
        )
        text_extra = (
            "\n\n## Text-only PDF instructions\n"
            "You only have raw extracted text (no images). Reconstruct the logical structure\n"
            "from line breaks and section numbering.\n"
        )
    return {
        "base": base,
        "pdf": base + pdf_extra,
        "handwriting": base + hw_extra,
        "text_only": base + text_extra,
    }


# Japanese-locale defaults (kept for backward compatibility).
OMR_SYSTEM_PROMPT = _OMR_SYSTEM_PROMPT_JA
OMR_PDF_SYSTEM_PROMPT = _omr_prompts("ja")["pdf"]
OMR_HANDWRITING_PROMPT = _omr_prompts("ja")["handwriting"]
OMR_TEXT_ONLY_PROMPT = _omr_prompts("ja")["text_only"]


def _omr_status(locale: str) -> dict[str, str]:
    """Return status/progress strings for the OMR streaming responses."""
    if (locale or "").lower() == "en":
        return {
            "analyzing_image": "Analyzing image...",
            "detecting_mode": "Detecting handwritten vs printed…",
            "handwriting_mode": "Reading in handwriting mode",
            "ai_recognizing": "AI is recognizing content...",
            "retrying": "Retrying… (attempt {attempt}/{total})",
            "building_latex": "Building LaTeX...",
            "pdf_analyzing": "Analyzing PDF...",
            "pdf_pages": "Detected {pages} page(s) (method: {method})",
            "extract_failed": "Could not extract content from the PDF.",
            "ai_text_images": "AI is analyzing text and page images for {pages} page(s)...",
            "ai_images": "AI is analyzing {pages} page image(s)...",
            "ai_text_only": "AI is reconstructing LaTeX from the extracted text...",
            "ai_error": "AI analysis error: {err}",
            "extracted_summary": "Extracted {chars} characters of LaTeX from the image.",
            "extracted_summary_pdf": "Extracted {chars} characters of LaTeX from the PDF ({pages} pages).",
            "pdf_label_multi": "{pages}-page PDF",
            "pdf_label_single": "1-page PDF",
            "user_prompt_image": "Extract the document structure from this image and return the full LaTeX via the set_latex tool.",
            "user_prompt_image_hinted": "Extract the document structure from this image. {hint}",
            "user_prompt_pdf_multi_with_text": (
                "Review the extracted text and page images from this {label} and return the full "
                "LaTeX source via the set_latex tool. Treat the whole document as one continuous piece."
            ),
            "user_prompt_pdf_multi_with_text_hinted": "Extract the document structure from this {label}. {hint}",
            "user_prompt_pdf_images_only": (
                "Read the text, math and tables from this {label} and return the full LaTeX "
                "source via the set_latex tool. Treat the whole document as one continuous piece."
            ),
            "user_prompt_pdf_images_only_hinted": "Extract the document structure from this {label}. {hint}",
            "user_prompt_pdf_text_only": (
                "Below is the raw text extracted from this {label}.\n"
                "Parse it and return the full LaTeX source via the set_latex tool.\n"
                "Convert headings, body text, math, lists and tables into proper LaTeX syntax.\n\n"
            ),
            "user_prompt_pdf_text_only_hinted": "Below is the raw text extracted from this {label}. {hint}\n\n",
            "page_block_label": "--- Page {i}/{n} ---",
            "page_block_text_label": "--- Page {i}/{n} ---\n[Extracted text]\n{text}",
            "page_block_text_empty": "(no text)",
            "page_separator_text_only": "\n\n=== Page {i}/{n} ===\n\n",
        }
    return {
        "analyzing_image": "画像を解析中...",
        "detecting_mode": "手書き / 活字を判定中...",
        "handwriting_mode": "手書きモードで読み取ります",
        "ai_recognizing": "AIがコンテンツを認識中...",
        "retrying": "再解析中... (試行 {attempt}/{total})",
        "building_latex": "LaTeXを構成中...",
        "pdf_analyzing": "PDFを解析中...",
        "pdf_pages": "{pages}ページを検出 (方式: {method})",
        "extract_failed": "PDFからコンテンツを抽出できませんでした。",
        "ai_text_images": "AIが{pages}ページのテキストと画像を解析中...",
        "ai_images": "AIが{pages}ページの画像を解析中...",
        "ai_text_only": "AIがテキストからLaTeXを構成中...",
        "ai_error": "AI解析エラー: {err}",
        "extracted_summary": "画像から{chars}文字のLaTeXソースを抽出しました。",
        "extracted_summary_pdf": "PDFから{chars}文字のLaTeXソースを抽出しました（{pages}ページ）。",
        "pdf_label_multi": "{pages}ページのPDF",
        "pdf_label_single": "1ページのPDF",
        "user_prompt_image": "この画像からドキュメント構造を抽出して、set_latexツールで完全なLaTeXソースを返してください。",
        "user_prompt_image_hinted": "この画像からドキュメント構造を抽出してください。{hint}",
        "user_prompt_pdf_multi_with_text": (
            "上記の{label}から抽出したテキストとページ画像を確認し、"
            "set_latex ツールで完全なLaTeXソースを返してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        ),
        "user_prompt_pdf_multi_with_text_hinted": "この{label}からドキュメント構造を抽出してください。{hint}",
        "user_prompt_pdf_images_only": (
            "この{label}のページ画像からテキスト・数式・表などを読み取り、"
            "set_latex ツールで完全なLaTeXソースを返してください。"
            "全ページを通して1つの連続したドキュメントとして処理してください。"
        ),
        "user_prompt_pdf_images_only_hinted": "この{label}からドキュメント構造を抽出してください。{hint}",
        "user_prompt_pdf_text_only": (
            "以下は{label}から抽出した生テキストです。\n"
            "このテキストを解析して、set_latex ツールで完全なLaTeXソースを返してください。\n"
            "見出し、本文、数式、リスト、表などを適切な LaTeX 構文に変換してください。\n\n"
        ),
        "user_prompt_pdf_text_only_hinted": "以下は{label}から抽出したテキストです。{hint}\n\n",
        "page_block_label": "--- ページ {i}/{n} ---",
        "page_block_text_label": "--- ページ {i}/{n} ---\n[抽出テキスト]\n{text}",
        "page_block_text_empty": "(テキストなし)",
        "page_separator_text_only": "\n\n=== ページ {i}/{n} ===\n\n",
    }


# ─── Tool definition (simplified set_latex for OMR) ──────────────────────────

def _build_omr_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "set_latex",
                "description": (
                    "Set the full LaTeX source of the document. Provide a complete, "
                    "compilable LaTeX document including \\documentclass and "
                    "\\begin{document} ... \\end{document}."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "latex": {
                            "type": "string",
                            "description": "The full LaTeX source.",
                        },
                    },
                    "required": ["latex"],
                },
            },
        }
    ]


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _image_to_data_url(image_bytes: bytes, media_type: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{media_type};base64,{b64}"


# ─── PDF extraction strategies ──────────────────────────────────────────────

def _pdf_extract_pymupdf(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Extract text + images using PyMuPDF (fitz).

    images は `(bytes, mime, width_px, height_px)` のタプル列。
    後方互換のため、既存呼び出しは `bytes, mime, *_extra = item` でアンパックする。
    """
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = min(len(doc), max_pages)

    texts: list[str] = []
    images: list[tuple] = []

    for i in range(page_count):
        page = doc[i]
        text = page.get_text("text")
        texts.append(text.strip())

        # DPI 220 で描画: 150 では細かい添字・分数バー・ギリシャ文字が潰れるため、
        # OCR の取り違えが増える。220 にすると token コストは約 2 倍になるが、
        # 数式の認識精度が実測で大幅に向上する。
        mat = fitz.Matrix(220 / 72, 220 / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        images.append((img_bytes, "image/png", pix.width, pix.height))

    doc.close()
    return {"texts": texts, "images": images, "page_count": page_count}


def _pdf_extract_poppler(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Fallback: poppler-utils (pdftoppm)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        result = subprocess.run(
            ["pdfinfo", pdf_path],
            capture_output=True, text=True, timeout=10,
        )
        page_count = 1
        for line in result.stdout.splitlines():
            if line.startswith("Pages:"):
                page_count = int(line.split(":")[1].strip())
                break

        pages_to_process = min(page_count, max_pages)

        # 300 DPI (pymupdf フォールバックの poppler パス) — pymupdf より高解像で
        # 細かい添字・罫線を確実に拾う。画像ファイルサイズは増えるが、
        # vision API が扱えるサイズには十分収まる。
        subprocess.run(
            [
                "pdftoppm", "-png", "-r", "300",
                "-l", str(pages_to_process),
                pdf_path, os.path.join(tmpdir, "page"),
            ],
            capture_output=True, timeout=90,
            check=True,
        )

        images: list[tuple] = []
        for fname in sorted(os.listdir(tmpdir)):
            if fname.startswith("page") and fname.endswith(".png"):
                fpath = os.path.join(tmpdir, fname)
                with open(fpath, "rb") as img_f:
                    img_bytes = img_f.read()
                # try to read dimensions via PIL if available; otherwise fall back to 0
                width, height = 0, 0
                try:
                    from PIL import Image
                    import io as _io
                    with Image.open(_io.BytesIO(img_bytes)) as im:
                        width, height = im.size
                except Exception:
                    pass
                images.append((img_bytes, "image/png", width, height))

        texts: list[str] = []
        try:
            text_result = subprocess.run(
                ["pdftotext", "-layout", pdf_path, "-"],
                capture_output=True, text=True, timeout=30,
            )
            if text_result.returncode == 0 and text_result.stdout.strip():
                pages = text_result.stdout.split("\f")
                texts = [p.strip() for p in pages if p.strip()]
        except Exception:
            pass

        return {"texts": texts, "images": images, "page_count": pages_to_process}


def _pdf_extract_text_only(pdf_bytes: bytes, max_pages: int = 10) -> dict:
    """Last resort: text only via PyMuPDF."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = min(len(doc), max_pages)
        texts = []
        for i in range(page_count):
            text = doc[i].get_text("text")
            texts.append(text.strip())
        doc.close()
        return {"texts": texts, "images": [], "page_count": page_count}
    except ImportError:
        return {"texts": [], "images": [], "page_count": 0}


async def _extract_pdf_content(pdf_bytes: bytes):
    import asyncio
    try:
        result = await asyncio.to_thread(_pdf_extract_pymupdf, pdf_bytes)
        if result["page_count"] > 0:
            return {**result, "method": "pymupdf"}
    except ImportError:
        logger.info("PyMuPDF not available, trying poppler")
    except Exception as e:
        logger.warning("PyMuPDF extraction failed: %s", e)

    try:
        result = await asyncio.to_thread(_pdf_extract_poppler, pdf_bytes)
        if result["images"]:
            return {**result, "method": "poppler"}
    except FileNotFoundError:
        logger.info("poppler-utils not installed")
    except Exception as e:
        logger.warning("poppler extraction failed: %s", e)

    try:
        result = await asyncio.to_thread(_pdf_extract_text_only, pdf_bytes)
        if any(result["texts"]):
            return {**result, "method": "text_only"}
    except Exception as e:
        logger.warning("Text-only extraction failed: %s", e)

    return {"texts": [], "images": [], "page_count": 0, "method": "none"}


# ─── Response parsing ──────────────────────────────────────────────────────

def _extract_latex_from_response(response) -> tuple[list[str], str | None]:
    """Extract text and raw LaTeX from an OpenAI response."""
    text_parts: list[str] = []
    latex: str | None = None
    try:
        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            text_parts.append(msg.content)

        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.function.name == "set_latex":
                    try:
                        parsed = json.loads(tc.function.arguments)
                        candidate = parsed.get("latex")
                        if isinstance(candidate, str) and candidate.strip():
                            latex = candidate
                            logger.info("OMR: Extracted %d chars of LaTeX", len(latex))
                    except json.JSONDecodeError as e:
                        logger.warning("OMR: set_latex args parse failed: %s", e)
        else:
            logger.warning("OMR: No tool_calls in response. finish_reason=%s",
                           choice.finish_reason)
    except (IndexError, AttributeError) as e:
        logger.warning("OpenAI OMR response parse failed: %s", e)
    return text_parts, latex


# ─── Image analysis ──────────────────────────────────────────────────────────

async def analyze_image(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
    locale: str = "ja",
) -> dict:
    """OpenAI Vision で画像/PDFを解析し、raw LaTeX を返す。"""
    result = {"description": "", "latex": None}
    async for event_str in analyze_image_stream(
        image_bytes, media_type, document_context, hint, locale=locale,
    ):
        if event_str.startswith("data: "):
            try:
                event = json.loads(event_str[6:])
                if event.get("type") == "done":
                    result["description"] = event.get("description", "")
                    result["latex"] = event.get("latex")
                elif event.get("type") == "error":
                    result["description"] = event.get("message", "")
            except json.JSONDecodeError:
                pass
    return result


async def _detect_handwriting(client, data_url: str) -> bool:
    """画像が手書きかどうかを軽量モデルで判定する。"""
    import asyncio
    try:
        def _call():
            return client.chat.completions.create(
                model=MODEL_VISION,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
                            {"type": "text", "text": (
                                "この画像の主要な内容は手書き(handwritten)ですか、それとも活字(printed)ですか? "
                                "1単語のみで答えてください: 'handwritten' か 'printed'."
                            )},
                        ],
                    }
                ],
                temperature=0,
                **max_tokens_param(MODEL_VISION, 8),
            )
        resp = await asyncio.to_thread(_call)
        ans = (resp.choices[0].message.content or "").strip().lower()
        return "hand" in ans
    except Exception as e:
        logger.warning("handwriting detection failed: %s", e)
        return False


def _hint_forces_handwriting(hint: str) -> bool | None:
    if not hint:
        return None
    h = hint.lower()
    if "handwriting" in h or "handwritten" in h or "手書き" in hint:
        return True
    if "printed" in h or "typeset" in h or "活字" in hint or "印刷" in hint:
        return False
    return None


async def analyze_image_stream(
    image_bytes: bytes,
    media_type: str,
    document_context: dict,
    hint: str = "",
    locale: str = "ja",
):
    """SSEストリーミング版のOMR解析（OpenAI Vision）。"""
    import asyncio

    status = _omr_status(locale)
    prompts = _omr_prompts(locale)

    if media_type == "application/pdf":
        async for event in _analyze_pdf_stream(image_bytes, document_context, hint, locale=locale):
            yield event
        return

    yield _sse({"type": "progress", "phase": "analyzing", "message": status["analyzing_image"]})

    client = get_client()
    data_url = _image_to_data_url(image_bytes, media_type)

    forced = _hint_forces_handwriting(hint)
    if forced is True:
        is_handwriting = True
    elif forced is False:
        is_handwriting = False
    else:
        yield _sse({"type": "progress", "phase": "detecting", "message": status["detecting_mode"]})
        is_handwriting = await _detect_handwriting(client, data_url)

    if is_handwriting:
        yield _sse({"type": "progress", "phase": "mode", "message": status["handwriting_mode"]})
        system_prompt = prompts["handwriting"]
    else:
        system_prompt = prompts["base"]

    prompt_text = (
        status["user_prompt_image_hinted"].format(hint=hint)
        if hint
        else status["user_prompt_image"]
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                {"type": "text", "text": prompt_text},
            ],
        },
    ]

    tools = _build_omr_tools()

    # 再試行 3 回、低温度で決定的な出力に寄せる。
    MAX_RETRIES = 3
    latex: str | None = None
    text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying",
                        "message": status["retrying"].format(attempt=attempt, total=MAX_RETRIES)})

        yield _sse({"type": "progress", "phase": "ai_processing", "message": status["ai_recognizing"]})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.15,
                    **max_tokens_param(MODEL_VISION, 16384),
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("OpenAI OMR API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                # 指数バックオフ (0.5s, 1.0s) で短時間障害を乗り越える
                await asyncio.sleep(0.5 * attempt)
                continue
            yield _sse({"type": "error", "message": status["ai_error"].format(err=str(e)[:200])})
            return

        text_parts, latex = _extract_latex_from_response(response)

        if latex:
            break

    yield _sse({"type": "progress", "phase": "extracting", "message": status["building_latex"]})

    # ── Post-process: 許可外パッケージ削除 + autofix ──
    latex = _postprocess_latex(latex)

    # compile 前の最後の関門: security 検証 (情報目的のみ, block しない)
    warnings = _validate_against_security(latex)
    if warnings:
        logger.warning("OMR: security violations remain after post-process: %s", warnings)

    description = "\n".join(text_parts).strip()
    if not description and latex:
        description = status["extracted_summary"].format(chars=len(latex))

    yield _sse({
        "type": "done",
        "description": description,
        "latex": latex,
        "warnings": warnings,
    })


# ─── PDF analysis ──────────────────────────────────────────────────────────

async def _analyze_pdf_stream(
    pdf_bytes: bytes,
    document_context: dict,
    hint: str = "",
    locale: str = "ja",
):
    """PDFからテキスト+画像を抽出し、OpenAI APIで raw LaTeX に変換する。"""
    import asyncio

    status = _omr_status(locale)
    prompts = _omr_prompts(locale)

    yield _sse({"type": "progress", "phase": "converting", "message": status["pdf_analyzing"]})

    extraction = await _extract_pdf_content(pdf_bytes)

    method = extraction.get("method", "none")
    page_count = extraction.get("page_count", 0)
    texts = extraction.get("texts", [])
    images = extraction.get("images", [])
    has_text = any(t.strip() for t in texts)
    has_images = len(images) > 0

    if page_count == 0 and not has_text:
        yield _sse({"type": "error", "message": status["extract_failed"]})
        return

    yield _sse({"type": "progress", "phase": "converted",
                "message": status["pdf_pages"].format(pages=page_count, method=method)})

    client = get_client()
    tools = _build_omr_tools()

    page_label = (
        status["pdf_label_multi"].format(pages=page_count)
        if page_count > 1
        else status["pdf_label_single"]
    )

    forced = _hint_forces_handwriting(hint)
    is_handwriting = False
    if forced is True:
        is_handwriting = True
    elif forced is False:
        is_handwriting = False
    elif has_images and not has_text:
        yield _sse({"type": "progress", "phase": "detecting", "message": status["detecting_mode"]})
        first_data_url = _image_to_data_url(images[0][0], images[0][1])
        is_handwriting = await _detect_handwriting(client, first_data_url)
        if is_handwriting:
            yield _sse({"type": "progress", "phase": "mode", "message": status["handwriting_mode"]})

    if has_images and has_text:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": status["ai_text_images"].format(pages=page_count)})
        messages = _build_pdf_messages_with_text_and_images(
            texts, images, page_count, page_label, hint, status)
        system_prompt = prompts["pdf"]
    elif has_images:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": status["ai_images"].format(pages=page_count)})
        messages = _build_pdf_messages_images_only(
            images, page_count, page_label, hint, status)
        system_prompt = prompts["handwriting"] if is_handwriting else prompts["pdf"]
    else:
        yield _sse({"type": "progress", "phase": "ai_processing",
                    "message": status["ai_text_only"]})
        messages = _build_pdf_messages_text_only(
            texts, page_count, page_label, hint, status)
        system_prompt = prompts["text_only"]

    messages.insert(0, {"role": "system", "content": system_prompt})

    # 再試行 3 回 + 指数バックオフ + 低温度。
    MAX_RETRIES = 3
    latex: str | None = None
    resp_text_parts: list[str] = []

    for attempt in range(1, MAX_RETRIES + 1):
        if attempt > 1:
            yield _sse({"type": "progress", "phase": "retrying",
                        "message": status["retrying"].format(attempt=attempt, total=MAX_RETRIES)})

        try:
            def _call():
                return client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=messages,
                    tools=tools,
                    tool_choice={"type": "function", "function": {"name": "set_latex"}},
                    temperature=0.15,
                    **max_tokens_param(MODEL_VISION, 16384),
                )
            response = await asyncio.to_thread(_call)
        except Exception as e:
            logger.error("OpenAI OMR PDF API error (attempt %d): %s", attempt, e)
            if attempt < MAX_RETRIES:
                await asyncio.sleep(0.5 * attempt)
                continue
            yield _sse({"type": "error", "message": status["ai_error"].format(err=str(e)[:200])})
            return

        resp_text_parts, latex = _extract_latex_from_response(response)

        if latex:
            break

    yield _sse({"type": "progress", "phase": "extracting", "message": status["building_latex"]})

    # ── Post-process: 許可外パッケージ削除 + autofix ──
    latex = _postprocess_latex(latex)

    warnings = _validate_against_security(latex)
    if warnings:
        logger.warning("OMR (PDF): security violations remain after post-process: %s", warnings)

    description = "\n".join(resp_text_parts).strip()
    if not description and latex:
        description = status["extracted_summary_pdf"].format(chars=len(latex), pages=page_count)

    yield _sse({
        "type": "done",
        "description": description,
        "latex": latex,
        "warnings": warnings,
    })


# ─── Message builders ─────────────────────────────────────────────────────

def _build_pdf_messages_with_text_and_images(
    texts: list[str], images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
    status: dict[str, str],
) -> list[dict]:
    content_parts: list[dict] = []

    for i in range(page_count):
        page_text = texts[i] if i < len(texts) else status["page_block_text_empty"]
        content_parts.append({
            "type": "text",
            "text": status["page_block_text_label"].format(i=i + 1, n=page_count, text=page_text),
        })
        if i < len(images):
            data_url = _image_to_data_url(images[i][0], images[i][1])
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": data_url, "detail": "high"},
            })

    prompt = (
        status["user_prompt_pdf_multi_with_text_hinted"].format(label=page_label, hint=hint)
        if hint
        else status["user_prompt_pdf_multi_with_text"].format(label=page_label)
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_images_only(
    images: list[tuple[bytes, str]],
    page_count: int, page_label: str, hint: str,
    status: dict[str, str],
) -> list[dict]:
    content_parts: list[dict] = []

    for i in range(min(page_count, len(images))):
        if page_count > 1:
            content_parts.append({
                "type": "text",
                "text": status["page_block_label"].format(i=i + 1, n=page_count),
            })
        data_url = _image_to_data_url(images[i][0], images[i][1])
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": data_url, "detail": "high"},
        })

    prompt = (
        status["user_prompt_pdf_images_only_hinted"].format(label=page_label, hint=hint)
        if hint
        else status["user_prompt_pdf_images_only"].format(label=page_label)
    )
    content_parts.append({"type": "text", "text": prompt})

    return [{"role": "user", "content": content_parts}]


def _build_pdf_messages_text_only(
    texts: list[str],
    page_count: int, page_label: str, hint: str,
    status: dict[str, str],
) -> list[dict]:
    combined_text = ""
    for i, text in enumerate(texts):
        if text.strip():
            if page_count > 1:
                combined_text += status["page_separator_text_only"].format(i=i + 1, n=page_count)
            combined_text += text

    prompt = (
        status["user_prompt_pdf_text_only_hinted"].format(label=page_label, hint=hint)
        if hint
        else status["user_prompt_pdf_text_only"].format(label=page_label)
    )

    return [{"role": "user", "content": prompt + combined_text}]

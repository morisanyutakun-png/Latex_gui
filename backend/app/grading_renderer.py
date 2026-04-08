"""採点モード — PDF レンダラ

2 種類の PDF を生成する:
1. フィードバック文書 PDF  (render_feedback_latex → compile_raw_latex で OK)
2. 赤入れ PDF              (render_marked_pdf_latex + 画像 tmpdir コピー)

LaTeX 文字列の生成とコンパイルを分離する。テンプレートは luatexja-preset を前提。
"""
from __future__ import annotations

import asyncio
import base64
import gc
import logging
import re
import subprocess
import tempfile
from pathlib import Path

from .grading_models import BBox, GradingResult, Mark
from .pdf_service import PDFGenerationError

logger = logging.getLogger(__name__)


# ════════════════ 文字列エスケープ ════════════════

_SPECIAL_LATEX = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def _escape(text: str) -> str:
    """自由記述テキスト → LaTeX セーフ文字列。

    transcribedAnswer や comment はAI が LaTeX 記法を含む可能性があるが、
    最初のバージョンではセキュリティ優先で特殊文字をすべてエスケープする。
    数式は`$...$` で書かれていてもそのまま表示されない(将来改善)。
    """
    if not text:
        return ""
    out = []
    for ch in text:
        out.append(_SPECIAL_LATEX.get(ch, ch))
    return "".join(out)


def _sanitize_math(text: str) -> str:
    """数式は `$...$` を保持する版のエスケープ。

    AI の transcribed answer は `$x^2$` のように数式を含むことが多い。
    `$...$` で囲まれた範囲は数式として残し、その外側だけエスケープする。
    """
    if not text:
        return ""
    # split on $...$ (non-greedy)
    parts = re.split(r"(\$[^$]+\$|\\\[.+?\\\])", text, flags=re.DOTALL)
    out = []
    for p in parts:
        if p.startswith("$") and p.endswith("$"):
            out.append(p)
        elif p.startswith("\\[") and p.endswith("\\]"):
            out.append(p)
        else:
            out.append(_escape(p))
    return "".join(out)


# ════════════════ Phase 6: フィードバック PDF ════════════════

FEEDBACK_PREAMBLE = r"""\documentclass[a4paper,11pt]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage[margin=20mm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{xcolor}
\definecolor{fbok}{HTML}{16a34a}
\definecolor{fbmid}{HTML}{f59e0b}
\definecolor{fbng}{HTML}{dc2626}
\definecolor{fbmuted}{HTML}{6b7280}
\usepackage{booktabs}
\usepackage{array}
\usepackage{enumitem}
\setlist[itemize]{leftmargin=*,itemsep=2pt,topsep=2pt}
\usepackage{titlesec}
\titleformat{\section}{\Large\bfseries\color{fbok}}{\thesection}{0.6em}{}
\titleformat{\subsection}{\large\bfseries}{\thesubsection}{0.6em}{}
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{fbmuted}採点フィードバック}
\fancyhead[R]{\small\color{fbmuted}\thepage}
\renewcommand{\headrulewidth}{0.4pt}
"""


def _status_color(awarded: int, maximum: int) -> str:
    if maximum <= 0:
        return "fbmuted"
    ratio = awarded / maximum
    if ratio >= 0.95:
        return "fbok"
    if ratio >= 0.4:
        return "fbmid"
    return "fbng"


def render_feedback_latex(result: GradingResult) -> str:
    """採点結果から個人別フィードバック LaTeX を生成する。"""
    name = _escape(result.student_name) or "(氏名未記入)"
    sid = _escape(result.student_id)
    total = result.total_points
    maximum = result.max_points
    pct = result.percentage

    lines: list[str] = [FEEDBACK_PREAMBLE]
    lines.append(r"\begin{document}")
    lines.append(r"\begin{center}")
    lines.append(r"{\LARGE\bfseries 採点フィードバック}\\[0.5em]")
    lines.append(rf"{{\large {name}}}")
    if sid:
        lines.append(rf"\quad{{\small\color{{fbmuted}}\texttt{{{sid}}}}}")
    lines.append(r"\end{center}")
    lines.append(r"\vspace{1em}")

    # スコアサマリ
    summary_color = _status_color(total, maximum)
    lines.append(r"\begin{center}")
    lines.append(
        rf"\fbox{{\parbox{{0.7\textwidth}}{{\centering "
        rf"\textbf{{合計}}\quad"
        rf"{{\Huge\color{{{summary_color}}}{total}}}"
        rf"\;/\;{maximum}"
        rf"\quad({pct:.1f}\%)}}}}"
    )
    lines.append(r"\end{center}")
    lines.append(r"\vspace{1.2em}")

    # 設問別
    lines.append(r"\section*{設問別評価}")
    for q in result.questions:
        q_label = _escape(q.question_label or q.question_id)
        q_color = _status_color(q.awarded_points, q.max_points)
        lines.append(
            rf"\subsection*{{{q_label}\hfill"
            rf"\normalsize\color{{{q_color}}}{q.awarded_points}/{q.max_points}点}}"
        )

        if q.criteria_results:
            lines.append(r"\begin{itemize}")
            for c in q.criteria_results:
                c_color = _status_color(c.awarded, c.weight)
                desc = _escape(c.description)
                comment = _sanitize_math(c.comment) if c.comment else ""
                line = (
                    rf"\item \textbf{{{desc}}}"
                    rf"\quad{{\small\color{{{c_color}}}{c.awarded}/{c.weight}}}"
                )
                if comment:
                    line += rf"\\{{\small\color{{fbmuted}}{comment}}}"
                lines.append(line)
            lines.append(r"\end{itemize}")

        if q.overall_comment:
            lines.append(
                rf"\par\vspace{{0.3em}}{{\small\itshape {_sanitize_math(q.overall_comment)}}}"
            )

        lines.append(r"\vspace{0.5em}")

    # 全体講評
    if result.overall_feedback:
        lines.append(r"\section*{全体講評}")
        lines.append(_sanitize_math(result.overall_feedback))

    lines.append(r"\end{document}")
    return "\n".join(lines)


# ════════════════ Phase 7: 赤入れ PDF (TikZ overlay) ════════════════

MARKED_PREAMBLE = r"""\documentclass[11pt]{article}
\usepackage[haranoaji]{luatexja-preset}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{tikz}
\usetikzlibrary{positioning, calc}
\usepackage{xcolor}
\definecolor{markred}{HTML}{d92626}
\definecolor{markblue}{HTML}{1d4ed8}
\definecolor{markgreen}{HTML}{16a34a}
\pagestyle{empty}
"""


def _marks_for_page(marks: list[Mark], page_index: int) -> list[tuple[str, BBox, str]]:
    """このページに対応する mark を (kind, bbox, text) 列に変換。bbox なしは除外。"""
    out: list[tuple[str, BBox, str]] = []
    for m in marks:
        if not m.bbox:
            continue
        if m.bbox.page_index != page_index:
            continue
        out.append((m.kind, m.bbox, m.text or ""))
    return out


def _fallback_marks_for_page(marks: list[Mark], page_index: int) -> list[tuple[str, str]]:
    """bbox が無い mark (フォールバック) を (kind, text) 列にして返す。page_index == 0 の時だけ収集。"""
    if page_index != 0:
        return []
    out: list[tuple[str, str]] = []
    for m in marks:
        if m.bbox is not None:
            continue
        if not m.text:
            continue
        out.append((m.kind, m.text))
    return out


def _write_image_file(data_url: str, dest: Path) -> tuple[int, int]:
    """data URL を dest に書き出す。戻り値は (width, height) — 取得失敗時は (0, 0)。"""
    if not data_url.startswith("data:"):
        raise ValueError("answer_pages.image_url must be a data URL")
    header, _, b64 = data_url.partition(",")
    img_bytes = base64.b64decode(b64)
    dest.write_bytes(img_bytes)

    try:
        from PIL import Image
        import io as _io
        with Image.open(_io.BytesIO(img_bytes)) as im:
            return im.size
    except Exception:
        return (0, 0)


def render_marked_pdf_latex(result: GradingResult, image_filenames: list[str]) -> str:
    """採点結果と画像ファイル名列から TikZ overlay LaTeX を生成する。

    画像ファイル名は tmpdir 相対 (例: `page-1.png`)。寸法は紙面サイズ設定に使用するため、
    呼び出し側で width/height を `answer_pages[i].width_px/height_px` に必ず設定しておく。
    """
    # 全 marks を page 別に grouping
    all_marks: list[Mark] = []
    for q in result.questions:
        all_marks.extend(q.marks)

    lines: list[str] = [MARKED_PREAMBLE, r"\begin{document}"]

    for i, page in enumerate(result.answer_pages):
        img_name = image_filenames[i] if i < len(image_filenames) else None
        if not img_name:
            continue

        # 紙面を画像の比率に合わせる (mm 単位、だいたい 210mm 幅基準)
        w_px = page.width_px or 1000
        h_px = page.height_px or 1400
        # 固定 210mm 幅にして高さを比例計算
        paper_w_mm = 210
        paper_h_mm = round(paper_w_mm * h_px / w_px, 1)

        lines.append(
            rf"\newgeometry{{paperwidth={paper_w_mm}mm, paperheight={paper_h_mm}mm,"
            r" left=0mm, right=0mm, top=0mm, bottom=0mm}"
        )

        lines.append(r"\begin{tikzpicture}[remember picture, overlay]")
        lines.append(
            rf"\node[anchor=north west, inner sep=0] (p{i}) at (current page.north west) "
            rf"{{\includegraphics[width=\paperwidth, height=\paperheight]{{{img_name}}}}};"
        )

        # 各 mark を描画
        for kind, bbox, text in _marks_for_page(all_marks, i):
            cx = bbox.x + bbox.w / 2
            cy = bbox.y + bbox.h / 2
            color = "markred"
            # 座標: p{i}.north west を基準に +x, -y 方向
            center = rf"($(p{i}.north west) + ({cx:.4f}\paperwidth, -{cy:.4f}\paperheight)$)"

            if kind == "circle":
                xr = max(bbox.w / 2, 0.02)
                yr = max(bbox.h / 2, 0.015)
                lines.append(
                    rf"\draw[{color}, line width=1.4pt] {center} "
                    rf"ellipse [x radius={xr:.4f}\paperwidth, y radius={yr:.4f}\paperheight];"
                )
            elif kind == "cross":
                xr = max(bbox.w / 2, 0.02)
                yr = max(bbox.h / 2, 0.015)
                p1 = rf"($(p{i}.north west) + ({(bbox.x):.4f}\paperwidth, -{(bbox.y):.4f}\paperheight)$)"
                p2 = rf"($(p{i}.north west) + ({(bbox.x + bbox.w):.4f}\paperwidth, -{(bbox.y + bbox.h):.4f}\paperheight)$)"
                p3 = rf"($(p{i}.north west) + ({(bbox.x + bbox.w):.4f}\paperwidth, -{(bbox.y):.4f}\paperheight)$)"
                p4 = rf"($(p{i}.north west) + ({(bbox.x):.4f}\paperwidth, -{(bbox.y + bbox.h):.4f}\paperheight)$)"
                lines.append(rf"\draw[{color}, line width=1.4pt] {p1} -- {p2};")
                lines.append(rf"\draw[{color}, line width=1.4pt] {p3} -- {p4};")
                _ = xr, yr
            elif kind == "triangle":
                # 三角 ≒ 半分正解の記号
                p1 = rf"($(p{i}.north west) + ({cx:.4f}\paperwidth, -{(bbox.y):.4f}\paperheight)$)"
                p2 = rf"($(p{i}.north west) + ({(bbox.x):.4f}\paperwidth, -{(bbox.y + bbox.h):.4f}\paperheight)$)"
                p3 = rf"($(p{i}.north west) + ({(bbox.x + bbox.w):.4f}\paperwidth, -{(bbox.y + bbox.h):.4f}\paperheight)$)"
                lines.append(rf"\draw[{color}, line width=1.4pt] {p1} -- {p2} -- {p3} -- cycle;")
            elif kind == "score":
                content = _escape(text) if text else ""
                lines.append(
                    rf"\node[{color}, font=\bfseries\Large, anchor=west] "
                    rf"at {center} {{{content}}};"
                )
            else:  # comment
                content = _sanitize_math(text) if text else ""
                lines.append(
                    rf"\node[{color}, font=\small, anchor=north west, "
                    rf"text width={max(bbox.w, 0.2):.4f}\paperwidth] "
                    rf"at {center} {{{content}}};"
                )

        # フォールバック mark (bbox なし) は最初のページの下部にまとめて書く
        fallback = _fallback_marks_for_page(all_marks, i)
        if fallback:
            lines.append(
                rf"\node[markred, font=\footnotesize, anchor=south west, "
                rf"text width=0.9\paperwidth] at "
                rf"($(p{i}.south west) + (0.05\paperwidth, 0.02\paperheight)$) "
                r"{"
            )
            lines.append(r"\textbf{採点メモ:}\\")
            for kind, text in fallback:
                lines.append(rf"{{\textbullet\ {_sanitize_math(text)}\par}}")
            lines.append("};")

        lines.append(r"\end{tikzpicture}")
        lines.append(r"\newpage")

    lines.append(r"\end{document}")
    return "\n".join(lines)


# ════════════════ 専用コンパイル (画像込み) ════════════════

def _compile_with_images_sync(
    latex_source: str,
    images: list[tuple[bytes, str]],  # (bytes, filename)
    timeout: int = 120,
) -> bytes:
    """画像を含む LaTeX を tmpdir に展開してコンパイルする。

    セキュリティ: compile_raw_latex 相当の security 検査を走らせた後、
    tmpdir 内で `lualatex` を直接起動する。
    """
    from .security import validate_latex_security, validate_latex_size, format_violations
    from .tex_env import TEX_ENV, LUALATEX_CMD
    from .security import get_compile_args

    size_error = validate_latex_size(latex_source)
    if size_error:
        raise PDFGenerationError(size_error, code="latex_too_large")
    violations = validate_latex_security(latex_source)
    if violations:
        raise PDFGenerationError(
            f"Security policy violation: {format_violations(violations, lang='en')}",
            detail=str(violations),
            code="security_violation",
            violations=violations,
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "document.tex"
        pdf_path = Path(tmpdir) / "document.pdf"

        # 画像を書き出し
        for img_bytes, filename in images:
            # path traversal 対策: filename は basename のみ
            safe_name = Path(filename).name
            (Path(tmpdir) / safe_name).write_bytes(img_bytes)

        tex_path.write_text(latex_source, encoding="utf-8")

        cmd_args = get_compile_args(LUALATEX_CMD, str(tmpdir), str(tex_path))
        try:
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=tmpdir,
                env=TEX_ENV,
            )
        except FileNotFoundError:
            raise PDFGenerationError(
                "LuaLaTeX エンジンが見つかりません。",
                detail="lualatex command not found",
            )
        except subprocess.TimeoutExpired:
            raise PDFGenerationError(
                "PDF生成に時間がかかりすぎました。",
                detail=f"lualatex timeout ({timeout}s)",
            )

        if result.returncode != 0 or not pdf_path.exists():
            log_output = result.stdout + "\n" + result.stderr
            logger.error("marked/feedback PDF compile failed: %s", log_output[-2000:])
            raise PDFGenerationError(
                "PDF生成に失敗しました。",
                detail=log_output[-2000:],
            )

        pdf_bytes = pdf_path.read_bytes()

    gc.collect()
    return pdf_bytes


async def compile_with_images(
    latex_source: str,
    images: list[tuple[bytes, str]],
    timeout: int = 120,
) -> bytes:
    return await asyncio.to_thread(_compile_with_images_sync, latex_source, images, timeout)

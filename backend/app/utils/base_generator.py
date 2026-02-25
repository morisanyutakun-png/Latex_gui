"""
Canvas-based LaTeX rendering
textpos で絶対配置、tcolorbox でスタイリング
"""
import os

from ..models import (
    CanvasElement, ElementStyle,
    HeadingContent, ParagraphContent, ListContent,
    TableContent, ImageContent, ListStyle,
)
from .latex_utils import escape_latex

# フォント設定（環境変数で上書き可能）
CJK_MAIN_FONT = os.environ.get("CJK_MAIN_FONT", "Hiragino Mincho ProN")
CJK_SANS_FONT = os.environ.get("CJK_SANS_FONT", "Hiragino Sans")


def canvas_preamble() -> str:
    """Canvas 対応 XeLaTeX プリアンブル (zxjatype: 軽量CJK, ctex依存なし)"""
    return rf"""\documentclass[a4paper]{{article}}
\usepackage{{fontspec}}
\usepackage{{zxjatype}}
\setjamainfont{{{CJK_MAIN_FONT}}}
\setjasansfont{{{CJK_SANS_FONT}}}
\usepackage[absolute]{{textpos}}
\setlength{{\TPHorizModule}}{{1mm}}
\setlength{{\TPVertModule}}{{1mm}}
\usepackage{{geometry}}
\geometry{{a4paper, margin=0mm, headheight=0pt, headsep=0pt, footskip=0pt}}
\usepackage{{graphicx}}
\usepackage{{xcolor}}
\usepackage{{tcolorbox}}
\tcbuselibrary{{skins}}
\usepackage{{enumitem}}
\usepackage{{hyperref}}
\pagestyle{{empty}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{0pt}}
"""


# ─── Helpers ────────────────────────────────────────────────

def _hex_to_html(hex_color: str) -> str:
    """#RRGGBB / RRGGBB → 6桁大文字HEX"""
    c = (hex_color or "").lstrip("#").strip()
    if len(c) == 3:
        c = c[0] * 2 + c[1] * 2 + c[2] * 2
    return c.upper() if c else "000000"


def _style_commands(style: ElementStyle) -> str:
    """ElementStyle → LaTeX フォント・配置コマンド列"""
    parts: list[str] = []

    # --- font size ---
    fs = style.fontSize or 11
    leading = fs * 1.35
    parts.append(rf"\fontsize{{{fs:.1f}pt}}{{{leading:.1f}pt}}\selectfont")

    # --- font family (sans のときだけ切替) ---
    if style.fontFamily == "sans":
        parts.append(rf"\fontspec{{{CJK_SANS_FONT}}}")

    # --- weight / shape ---
    if style.bold:
        parts.append(r"\bfseries")
    if style.italic:
        parts.append(r"\itshape")

    # --- alignment ---
    align = style.textAlign or "left"
    if align == "center":
        parts.append(r"\centering")
    elif align == "right":
        parts.append(r"\raggedleft")
    else:
        parts.append(r"\raggedright")

    # --- text color ---
    if style.textColor:
        parts.append(rf"\color[HTML]{{{_hex_to_html(style.textColor)}}}")

    return "\n".join(parts)


# ─── Content renderers ─────────────────────────────────────

def _render_content(elem: CanvasElement) -> str:
    """要素の内容を LaTeX に変換"""
    c = elem.content

    if isinstance(c, HeadingContent):
        return escape_latex(c.text)

    if isinstance(c, ParagraphContent):
        if not c.text:
            return ""
        paragraphs = c.text.strip().split("\n\n")
        parts: list[str] = []
        for p in paragraphs:
            lines = p.split("\n")
            escaped = [escape_latex(ln) for ln in lines]
            parts.append(r" \newline ".join(escaped))
        return "\n\n".join(parts)

    if isinstance(c, ListContent):
        env = "enumerate" if c.style == ListStyle.NUMBERED else "itemize"
        lines = [rf"\begin{{{env}}}[leftmargin=1.5em, nosep, topsep=0pt]"]
        for item in c.items:
            if item.strip():
                lines.append(f"  \\item {escape_latex(item)}")
        lines.append(rf"\end{{{env}}}")
        return "\n".join(lines)

    if isinstance(c, TableContent):
        ncols = len(c.headers)
        if ncols == 0:
            return ""
        col_spec = "|" + "|".join(["l"] * ncols) + "|"
        lines = [rf"\begin{{tabular}}{{{col_spec}}}", r"\hline"]
        hdrs = " & ".join(rf"\textbf{{{escape_latex(h)}}}" for h in c.headers)
        lines.append(f"{hdrs} \\\\")
        lines.append(r"\hline")
        for row in c.rows:
            padded = (row + [""] * ncols)[:ncols]
            cells = " & ".join(escape_latex(ce) for ce in padded)
            lines.append(f"{cells} \\\\")
            lines.append(r"\hline")
        lines.append(r"\end{tabular}")
        return "\n".join(lines)

    if isinstance(c, ImageContent):
        if c.url:
            tex = rf"\includegraphics[width=\linewidth]{{{c.url}}}"
            if c.caption:
                tex += f"\n\n\\small {escape_latex(c.caption)}"
            return tex
        return ""

    return ""


# ─── Element renderer ──────────────────────────────────────

def render_canvas_element(elem: CanvasElement) -> str:
    """1 つの CanvasElement を textblock* で絶対配置"""
    content_tex = _render_content(elem)
    style_cmds = _style_commands(elem.style)

    # 空内容 & 背景なし → スキップ
    if not content_tex.strip() and not elem.style.backgroundColor:
        return ""

    has_box_style = bool(
        elem.style.backgroundColor
        or elem.style.borderColor
        or (elem.style.borderWidth and elem.style.borderWidth > 0)
        or (elem.style.borderRadius and elem.style.borderRadius > 0)
    )

    if has_box_style:
        return _render_styled(elem, style_cmds, content_tex)
    return _render_plain(elem, style_cmds, content_tex)


def _render_plain(elem: CanvasElement, style_cmds: str, content_tex: str) -> str:
    """ボーダー/背景なし → minipage"""
    pos = elem.position
    pad = elem.style.padding or 0
    inner_w = max(pos.width - pad * 2, 5)

    return (
        f"% Element {elem.id[:8]}\n"
        f"\\begin{{textblock*}}{{{pos.width:.1f}mm}}({pos.x:.1f}mm,{pos.y:.1f}mm)%\n"
        f"\\begin{{minipage}}[t][{pos.height:.1f}mm][t]{{{inner_w:.1f}mm}}%\n"
        f"{style_cmds}\n"
        f"{content_tex}\n"
        f"\\end{{minipage}}%\n"
        f"\\end{{textblock*}}"
    )


def _render_styled(elem: CanvasElement, style_cmds: str, content_tex: str) -> str:
    """ボーダー/背景あり → tcolorbox"""
    pos = elem.position
    sty = elem.style

    color_defs: list[str] = []
    opts: list[str] = ["enhanced jigsaw"]
    opts.append(f"width={pos.width:.1f}mm")
    opts.append(f"height={pos.height:.1f}mm")
    opts.append("valign=top")

    # background
    if sty.backgroundColor:
        color_defs.append(rf"\definecolor{{elbg}}{{HTML}}{{{_hex_to_html(sty.backgroundColor)}}}")
        opts.append("colback=elbg")
    else:
        opts.append("colback=white, opacityback=0")

    # border color
    if sty.borderColor:
        color_defs.append(rf"\definecolor{{elfr}}{{HTML}}{{{_hex_to_html(sty.borderColor)}}}")
        opts.append("colframe=elfr")
    else:
        opts.append("colframe=white, opacityframe=0")

    bw = sty.borderWidth if sty.borderWidth and sty.borderWidth > 0 else 0
    opts.append(f"boxrule={bw:.1f}pt")

    br = sty.borderRadius if sty.borderRadius and sty.borderRadius > 0 else 0
    opts.append(f"arc={br:.1f}mm")

    pad = sty.padding or 2
    opts.append(f"left={pad:.1f}mm, right={pad:.1f}mm, top={pad:.1f}mm, bottom={pad:.1f}mm")

    cdefs = "\n".join(color_defs)
    opts_str = ",\n  ".join(opts)

    return (
        f"% Element {elem.id[:8]}\n"
        f"{cdefs}\n"
        f"\\begin{{textblock*}}{{{pos.width:.1f}mm}}({pos.x:.1f}mm,{pos.y:.1f}mm)%\n"
        f"\\begin{{tcolorbox}}[\n  {opts_str}\n]\n"
        f"{style_cmds}\n"
        f"{content_tex}\n"
        f"\\end{{tcolorbox}}%\n"
        f"\\end{{textblock*}}"
    )

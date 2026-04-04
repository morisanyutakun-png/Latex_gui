"""
Structured document → LaTeX generator
Produces clean, natural LaTeX leveraging proper sectioning, math environments, etc.
Auto-detects required packages from blocks used in the document.
"""
from ..models import (
    DocumentModel,
    Block,
    PaperDesign,
    HeadingContent,
    ParagraphContent,
    MathContent,
    ListContent,
    TableContent,
    ImageContent,
    DividerContent,
    CodeContent,
    QuoteContent,
    CircuitContent,
    DiagramContent,
    ChemistryContent,
    ChartContent,
)
from ..utils.latex_utils import escape_latex, text_to_latex_paragraphs
from ..tex_env import DETECTED_CJK_MAIN_FONT, DETECTED_CJK_SANS_FONT
from ..security import validate_custom_preamble, sanitize_code_field, ALLOWED_PACKAGES
import os
import re
import logging

logger = logging.getLogger(__name__)


# ──── Font config ────
# tex_env.py で起動時に検出済みのフォント名を使用 (重複検出を排除)
CJK_MAIN_FONT = DETECTED_CJK_MAIN_FONT
CJK_SANS_FONT = DETECTED_CJK_SANS_FONT


# ──── Package requirements per block type ────
# Maps block types to the packages they need
BLOCK_PACKAGE_MAP: dict[str, list[str]] = {
    "math": [
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{mathtools}",
    ],
    "table": [
        "\\usepackage{booktabs}",
    ],
    "image": [
        "\\usepackage{graphicx}",
    ],
    "code": [
        "\\usepackage{listings}",
    ],
    "quote": [
        "\\usepackage{tcolorbox}",
    ],
    "list": [
        "\\usepackage{enumitem}",
    ],
    "circuit": [
        "\\usepackage{tikz}",
        "\\usepackage{circuitikz}",
        "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,decorations.markings,automata,fit}",
    ],
    "diagram": [
        "\\usepackage{tikz}",
        "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,decorations.markings,automata,fit}",
    ],
    "chemistry": [
        "\\usepackage[version=4]{mhchem}",
        "\\usepackage{amsmath,amssymb,amsthm}",
    ],
    "chart": [
        "\\usepackage{tikz}",
        "\\usepackage{pgfplots}",
        "\\pgfplotsset{compat=1.18}",
    ],
}

# Packages that also need math (inline math in paragraphs)
INLINE_MATH_PACKAGES = [
    "\\usepackage{amsmath,amssymb,amsthm}",
    "\\usepackage{mathtools}",
]


def _detect_required_packages(doc: DocumentModel, engine: str = "lualatex") -> list[str]:
    """Scan all blocks and determine which packages are needed."""
    block_types_used: set[str] = set()
    has_inline_math = False

    for block in doc.blocks:
        block_types_used.add(block.content.type)
        if block.content.type == "paragraph":
            if "$" in block.content.text:
                has_inline_math = True

    seen: set[str] = set()
    packages: list[str] = []

    def add(line: str):
        if line not in seen:
            seen.add(line)
            packages.append(line)

    # Always-required base packages (LuaLaTeX + luatexja)
    # engine 引数は後方互換のため残すが、常に luatexja-preset を使用
    add("\\usepackage[haranoaji]{luatexja-preset}")
    add("\\usepackage{xcolor}")
    add("\\usepackage{hyperref}")

    # If inline math is present, add math packages
    if has_inline_math:
        for pkg in INLINE_MATH_PACKAGES:
            add(pkg)

    # Add packages for each block type used
    for btype in block_types_used:
        if btype in BLOCK_PACKAGE_MAP:
            for pkg in BLOCK_PACKAGE_MAP[btype]:
                add(pkg)

    return packages


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """#rrggbb → (r, g, b) 0-255"""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return (255, 255, 255)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _generate_paper_design_latex(design: PaperDesign) -> list[str]:
    """PaperDesign を LaTeX プリアンブルコマンドに変換する。

    紙の背景色、アクセントカラー、テーマ（罫線/方眼/ドット）、
    ヘッダーボーダー、セクション区切り線を PDF に反映する。
    """
    lines: list[str] = []
    lines.append("% ── Paper Design ──")

    # --- 背景色 ---
    paper_color = design.paper_color or "#ffffff"
    if paper_color.lower() != "#ffffff":
        r, g, b = _hex_to_rgb(paper_color)
        lines.append(f"\\definecolor{{paperbg}}{{RGB}}{{{r},{g},{b}}}")
        lines.append("\\usepackage{pagecolor}")
        lines.append("\\pagecolor{paperbg}")

    # --- アクセントカラー定義 ---
    accent = design.accent_color or "#4f46e5"
    ar, ag, ab = _hex_to_rgb(accent)
    lines.append(f"\\definecolor{{accentcolor}}{{RGB}}{{{ar},{ag},{ab}}}")

    # --- アクセントカラーを見出しに適用 ---
    lines.append("\\titleformat{\\section}{\\Large\\bfseries\\sffamily\\color{accentcolor}}{\\thesection}{0.8em}{}")
    lines.append("\\titleformat{\\subsection}{\\large\\bfseries\\sffamily\\color{accentcolor!80!black}}{\\thesubsection}{0.6em}{}")

    # --- テーマ背景パターン (TikZ で描画) ---
    theme = design.theme or "plain"
    if theme in ("grid", "lined", "dot-grid"):
        lines.append("\\usepackage{tikz}")
        lines.append("\\usepackage{eso-pic}")
        if theme == "grid":
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append(f"    \\draw[accentcolor!8, step=5mm, line width=0.2pt] "
                         f"(current page.south west) grid (current page.north east);")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")
        elif theme == "lined":
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append(f"    \\foreach \\y in {{0,7mm,...,\\paperheight}} {{")
            lines.append(f"      \\draw[accentcolor!10, line width=0.2pt] "
                         f"([yshift=-\\y]current page.north west) -- ([yshift=-\\y]current page.north east);")
            lines.append("    }")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")
        elif theme == "dot-grid":
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append(f"    \\foreach \\x in {{0,5mm,...,\\paperwidth}} {{")
            lines.append(f"      \\foreach \\y in {{0,5mm,...,\\paperheight}} {{")
            lines.append(f"        \\fill[accentcolor!12] ([xshift=\\x, yshift=-\\y]current page.north west) circle (0.3pt);")
            lines.append("      }")
            lines.append("    }")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")

    # --- ヘッダーボーダー (タイトル下に線) ---
    if design.header_border:
        lines.append("% Header border under title")
        lines.append("\\usepackage{etoolbox}")
        lines.append("\\apptocmd{\\maketitle}{\\vspace{-1em}\\noindent\\textcolor{accentcolor}{\\rule{\\textwidth}{1.2pt}}\\vspace{0.5em}}{}{}")

    # --- セクション区切り線 ---
    if design.section_dividers:
        lines.append("% Section dividers")
        lines.append("\\titleformat{\\section}{\\Large\\bfseries\\sffamily\\color{accentcolor}}{\\thesection}{0.8em}{}"
                      "[\\vspace{0.2em}\\textcolor{accentcolor!40}{\\rule{\\textwidth}{0.5pt}}]")

    return lines


def generate_document_latex(doc: DocumentModel, engine: str = "lualatex") -> str:
    """Generate a complete LaTeX document from the block-based model.
    
    engine: 'lualatex' (固定)。luatexja-preset[haranoaji] で日本語処理。
    """
    settings = doc.settings
    meta = doc.metadata

    # Paper & geometry
    paper = settings.paper_size or "a4"
    margins = settings.margins
    geom = (
        f"top={margins.top}mm, bottom={margins.bottom}mm, "
        f"left={margins.left}mm, right={margins.right}mm"
    )

    # Document class options
    doc_opts = [f"{paper}paper"]
    if settings.two_column:
        doc_opts.append("twocolumn")
    opts_str = ",".join(doc_opts)

    # Document class — use from settings, default to article
    doc_class = getattr(settings, "document_class", "article") or "article"
    # Allowed classes (safety check)
    allowed_classes = {"article", "report", "book", "letter", "beamer", "jlreq", "ltjsarticle"}
    if doc_class not in allowed_classes:
        doc_class = "article"

    lines: list[str] = []

    # ──── Preamble ────
    if doc_class == "beamer":
        lines.append(f"\\documentclass{{{doc_class}}}")
        lines.append("\\usetheme{Madrid}")
    elif doc_class in ("jlreq", "ltjsarticle"):
        lines.append(f"\\documentclass[{opts_str},lualatex,ja=standard]{{{doc_class}}}")
    else:
        lines.append(f"\\documentclass[{opts_str}]{{{doc_class}}}")
    lines.append("")

    # ──── Auto-detected packages ────
    packages = _detect_required_packages(doc, engine=engine)
    if packages:
        lines.append("% ── Packages (auto-detected from document content) ──")
        for pkg in packages:
            lines.append(pkg)
        lines.append("")

    # Geometry (always needed)
    lines.append(f"\\usepackage[{geom}]{{geometry}}")
    lines.append("")

    # ──── Fonts ────
    # luatexja-preset[haranoaji] がフォント設定を含むため追加設定不要
    lines.append("% ── luatexja-preset[haranoaji]: fonts pre-configured ──")
    lines.append("")

    # ──── Typography enhancements ────
    lines.append("% ── Typography ──")
    spacing = settings.line_spacing
    effective_spacing = spacing if spacing and spacing != 1.0 else 1.18
    lines.append(f"\\renewcommand{{\\baselinestretch}}{{{effective_spacing:.2f}}}")
    lines.append("\\setlength{\\parindent}{1em}")
    lines.append("\\setlength{\\parskip}{0.3em plus 0.1em minus 0.05em}")
    lines.append("")

    # ──── Section styling (titlesec) ────
    lines.append("\\usepackage{titlesec}")
    lines.append("\\titleformat{\\section}{\\Large\\bfseries\\sffamily}{\\thesection}{0.8em}{}")
    lines.append("\\titleformat{\\subsection}{\\large\\bfseries\\sffamily}{\\thesubsection}{0.6em}{}")
    lines.append("\\titleformat{\\subsubsection}{\\normalsize\\bfseries\\sffamily}{\\thesubsubsection}{0.5em}{}")
    lines.append("\\titlespacing*{\\section}{0pt}{1.8em plus 0.4em minus 0.2em}{0.8em plus 0.2em}")
    lines.append("\\titlespacing*{\\subsection}{0pt}{1.4em plus 0.3em minus 0.1em}{0.6em plus 0.1em}")
    lines.append("\\titlespacing*{\\subsubsection}{0pt}{1.0em plus 0.2em minus 0.1em}{0.4em plus 0.1em}")
    lines.append("")

    # ──── Header / Footer ────
    if settings.page_numbers:
        lines.append("\\usepackage{fancyhdr}")
        lines.append("\\pagestyle{fancy}")
        lines.append("\\fancyhf{}")
        lines.append("\\fancyfoot[C]{\\textcolor{gray}{\\small\\thepage}}")
        lines.append("\\renewcommand{\\headrulewidth}{0pt}")
        lines.append("\\renewcommand{\\footrulewidth}{0pt}")
        lines.append("")
    else:
        lines.append("\\pagestyle{empty}")
        lines.append("")

    # ──── Listings style (only if code blocks used) ────
    block_types_used = {b.content.type for b in doc.blocks}
    if "code" in block_types_used:
        lines.append("\\lstset{")
        lines.append("  basicstyle=\\ttfamily\\small,")
        lines.append("  breaklines=true,")
        lines.append("  frame=l,")
        lines.append("  framerule=2pt,")
        lines.append("  rulecolor=\\color{blue!30},")
        lines.append("  backgroundcolor=\\color{gray!3},")
        lines.append("  xleftmargin=12pt,")
        lines.append("  numberstyle=\\tiny\\color{gray},")
        lines.append("  keywordstyle=\\color{blue!70!black}\\bfseries,")
        lines.append("  commentstyle=\\color{green!50!black}\\itshape,")
        lines.append("  stringstyle=\\color{red!60!black},")
        lines.append("  tabsize=2,")
        lines.append("  showstringspaces=false,")
        lines.append("}")
        lines.append("")

    # ──── Hyperref setup ────
    lines.append("\\hypersetup{")
    lines.append("  colorlinks=true,")
    lines.append("  linkcolor={blue!50!black},")
    lines.append("  urlcolor={blue!50!black},")
    lines.append("  citecolor={green!50!black},")
    lines.append("  pdfstartview=FitH,")
    lines.append("}")
    lines.append("")

    # ──── Paper Design (紙デザイン → PDF反映) ────
    design = getattr(settings, 'paper_design', None)
    if design:
        lines.extend(_generate_paper_design_latex(design))
        lines.append("")

    # ──── 上級者モード: カスタムプリアンブル ────
    advanced = getattr(doc, 'advanced', None)
    if advanced and advanced.enabled:
        # セキュリティ検証
        if advanced.custom_preamble.strip():
            violations = validate_custom_preamble(advanced.custom_preamble)
            if violations:
                logger.warning(f"Custom preamble violations: {violations}")
                lines.append("% WARNING: カスタムプリアンブルにセキュリティ違反があります")
            else:
                lines.append("% ── カスタムプリアンブル (上級者モード) ──")
                lines.append(advanced.custom_preamble)
                lines.append("")
        
        # カスタムコマンド
        if advanced.custom_commands:
            lines.append("% ── カスタムコマンド (上級者モード) ──")
            for cmd in advanced.custom_commands:
                # \newcommand, \renewcommand, \DeclareMathOperator のみ許可
                cmd_stripped = cmd.strip()
                if re.match(r'^\\(re)?newcommand|^\\Declare', cmd_stripped):
                    lines.append(cmd_stripped)
                else:
                    lines.append(f"% BLOCKED: {cmd_stripped[:60]}")
            lines.append("")

    # ──── Title ────
    if meta.title:
        lines.append(f"\\title{{{escape_latex(meta.title)}}}")
    if meta.author:
        lines.append(f"\\author{{{escape_latex(meta.author)}}}")
    if meta.date:
        lines.append(f"\\date{{{escape_latex(meta.date)}}}")
    elif meta.title:
        lines.append("\\date{}")
    lines.append("")

    # ──── Document body ────
    lines.append("\\begin{document}")
    if meta.title:
        lines.append("\\maketitle")
    
    # 上級者モード: pre_document フック
    if advanced and advanced.enabled and advanced.pre_document.strip():
        pre_violations = validate_custom_preamble(advanced.pre_document)
        if not pre_violations:
            lines.append("% ── pre-document hook ──")
            lines.append(advanced.pre_document)
    
    lines.append("")

    # ──── Blocks ────
    for block in doc.blocks:
        latex = _render_block(block)
        if latex:
            lines.append(latex)
            lines.append("")

    # 上級者モード: post_document フック
    if advanced and advanced.enabled and advanced.post_document.strip():
        post_violations = validate_custom_preamble(advanced.post_document)
        if not post_violations:
            lines.append("% ── post-document hook ──")
            lines.append(advanced.post_document)

    lines.append("\\end{document}")
    return "\n".join(lines)


def _render_block(block: Block) -> str:
    """Render a single block to LaTeX."""
    content = block.content
    style = block.style

    # Style wrappers
    prefix_cmds: list[str] = []
    suffix_cmds: list[str] = []

    if style.text_align == "center":
        prefix_cmds.append("\\begin{center}")
        suffix_cmds.insert(0, "\\end{center}")
    elif style.text_align == "right":
        prefix_cmds.append("\\begin{flushright}")
        suffix_cmds.insert(0, "\\end{flushright}")

    if style.font_family == "sans":
        prefix_cmds.append("\\sffamily")

    # Font size mapping
    if style.font_size:
        size_map = {
            9: "\\footnotesize",
            10: "\\small",
            11: "\\normalsize",
            12: "\\large",
            14: "\\Large",
            16: "\\LARGE",
            18: "\\huge",
            24: "\\Huge",
        }
        # Find closest size
        closest = min(size_map.keys(), key=lambda k: abs(k - style.font_size))
        cmd = size_map[closest]
        if cmd != "\\normalsize":
            prefix_cmds.append(cmd)

    inner = _render_content(content, style)
    if not inner.strip():
        return ""

    parts = prefix_cmds + [inner] + suffix_cmds
    return "\n".join(parts)


def _render_content(content, style) -> str:
    """Render block content to LaTeX based on type."""
    t = content.type

    if t == "heading":
        return _render_heading(content, style)
    elif t == "paragraph":
        return _render_paragraph(content, style)
    elif t == "math":
        return _render_math(content)
    elif t == "list":
        return _render_list(content)
    elif t == "table":
        return _render_table(content)
    elif t == "image":
        return _render_image(content)
    elif t == "divider":
        return _render_divider()
    elif t == "code":
        return _render_code(content)
    elif t == "quote":
        return _render_quote(content)
    elif t == "circuit":
        return _render_circuit(content)
    elif t == "diagram":
        return _render_diagram(content)
    elif t == "chemistry":
        return _render_chemistry(content)
    elif t == "chart":
        return _render_chart(content)
    return ""


def _render_heading(c: HeadingContent, style=None) -> str:
    if not c.text.strip():
        return ""
    text = escape_latex(c.text)

    # スタイルがある場合はインライン装飾を適用
    if style:
        if getattr(style, 'italic', False):
            text = f"\\textit{{{text}}}"
        if getattr(style, 'underline', False):
            text = f"\\underline{{{text}}}"
        text_color = getattr(style, 'text_color', None)
        if text_color and text_color != "#000000":
            hex_color = text_color.lstrip("#")
            text = f"\\textcolor[HTML]{{{hex_color}}}{{{text}}}"

    if c.level == 1:
        return f"\\section*{{{text}}}"
    elif c.level == 2:
        return f"\\subsection*{{{text}}}"
    else:
        return f"\\subsubsection*{{{text}}}"


def _render_paragraph(c: ParagraphContent, style) -> str:
    if not c.text.strip():
        return ""
    # Handle inline math: $...$ segments are kept as math, text parts are escaped
    raw = c.text
    text = _render_paragraph_inline_math(raw)
    # Apply inline styles
    if style.bold:
        text = f"\\textbf{{{text}}}"
    if style.italic:
        text = f"\\textit{{{text}}}"
    if style.underline:
        text = f"\\underline{{{text}}}"
    if style.text_color and style.text_color != "#000000":
        hex_color = style.text_color.lstrip("#")
        text = f"\\textcolor[HTML]{{{hex_color}}}{{{text}}}"
    return text


def _render_paragraph_inline_math(raw: str) -> str:
    """Convert paragraph text with $...$ inline math to LaTeX.
    Text parts are escaped normally, math parts are kept as-is (already LaTeX)."""
    parts = re.split(r'(\$[^$]+\$)', raw)
    result = []
    for part in parts:
        if part.startswith('$') and part.endswith('$') and len(part) > 2:
            # Math segment — keep the $...$ as-is (frontend already converts to LaTeX)
            result.append(part)
        else:
            # Text segment — apply normal LaTeX escaping and paragraph handling
            result.append(text_to_latex_paragraphs(part))
    return ''.join(result)


def _render_math(c: MathContent) -> str:
    if not c.latex.strip():
        return ""
    latex = c.latex.strip()
    if c.display_mode:
        return f"\\[\n{latex}\n\\]"
    else:
        return f"${latex}$"


def _render_list(c: ListContent) -> str:
    non_empty = [item for item in c.items if item.strip()]
    if not non_empty:
        return ""
    env = "itemize" if c.style == "bullet" else "enumerate"
    items_str = "\n".join(f"  \\item {escape_latex(item)}" for item in non_empty)
    return f"\\begin{{{env}}}\n{items_str}\n\\end{{{env}}}"


def _render_table(c: TableContent) -> str:
    col_count = len(c.headers)
    if col_count == 0:
        return ""

    lines = [
        "\\begin{table}[h]",
        "\\centering",
        f"\\begin{{tabular}}{{{'|'.join(['l'] * col_count)}}}",
        "\\toprule",
    ]
    header_cells = " & ".join(f"\\textbf{{{escape_latex(h)}}}" for h in c.headers)
    lines.append(f"{header_cells} \\\\")
    lines.append("\\midrule")

    for row in c.rows:
        padded = list(row[:col_count])
        while len(padded) < col_count:
            padded.append("")
        cells = " & ".join(escape_latex(cell) for cell in padded)
        lines.append(f"{cells} \\\\")

    lines.append("\\bottomrule")
    lines.append("\\end{tabular}")
    if c.caption:
        lines.append(f"\\caption{{{escape_latex(c.caption)}}}")
    lines.append("\\end{table}")
    return "\n".join(lines)


def _render_image(c: ImageContent) -> str:
    if not c.url.strip():
        return ""
    width = (c.width / 100) if c.width else 0.8
    lines = [
        "\\begin{figure}[h]",
        "\\centering",
        f"\\includegraphics[width={width:.2f}\\textwidth]{{{c.url}}}",
    ]
    if c.caption:
        lines.append(f"\\caption{{{escape_latex(c.caption)}}}")
    lines.append("\\end{figure}")
    return "\n".join(lines)


def _render_divider() -> str:
    return "\\vspace{0.5em}\\noindent\\rule{\\textwidth}{0.4pt}\\vspace{0.5em}"


def _render_code(c: CodeContent) -> str:
    if not c.code.strip():
        return ""
    lang_opt = f"[language={c.language}]" if c.language else ""
    return f"\\begin{{lstlisting}}{lang_opt}\n{c.code}\n\\end{{lstlisting}}"


def _render_quote(c: QuoteContent) -> str:
    if not c.text.strip():
        return ""
    text = escape_latex(c.text)
    lines = [
        "\\begin{tcolorbox}[colback=blue!2,colframe=blue!25,left=10pt,right=10pt,top=8pt,bottom=8pt,boxrule=0pt,leftrule=3pt,arc=2pt]",
        f"\\textit{{{text}}}",
    ]
    if c.attribution:
        lines.append(f"\\par\\raggedleft\\small\\textcolor{{gray}}{{--- {escape_latex(c.attribution)}}}")
    lines.append("\\end{tcolorbox}")
    return "\n".join(lines)


# ──── Engineering / Science Renderers ────

def _render_circuit(c: CircuitContent) -> str:
    """回路図を circuitikz で描画"""
    if not c.code.strip():
        return ""
    lines = [
        "\\begin{figure}[h]",
        "\\centering",
        "\\begin{circuitikz}[american]",
        c.code,
        "\\end{circuitikz}",
    ]
    if c.caption:
        lines.append(f"\\caption{{{escape_latex(c.caption)}}}")
    lines.append("\\end{figure}")
    return "\n".join(lines)


def _render_diagram(c: DiagramContent) -> str:
    """TikZダイアグラムを描画"""
    if not c.code.strip():
        return ""
    lines = [
        "\\begin{figure}[h]",
        "\\centering",
        "\\begin{tikzpicture}",
        c.code,
        "\\end{tikzpicture}",
    ]
    if c.caption:
        lines.append(f"\\caption{{{escape_latex(c.caption)}}}")
    lines.append("\\end{figure}")
    return "\n".join(lines)


def _render_chemistry(c: ChemistryContent) -> str:
    """化学式を mhchem で描画"""
    if not c.formula.strip():
        return ""
    formula = c.formula.strip()
    if c.display_mode:
        content = f"\\[\n\\ce{{{formula}}}\n\\]"
    else:
        content = f"$\\ce{{{formula}}}$"
    if c.caption:
        return f"\\begin{{figure}}[h]\n\\centering\n{content}\n\\caption{{{escape_latex(c.caption)}}}\n\\end{{figure}}"
    return content


def _render_chart(c: ChartContent) -> str:
    """pgfplots でグラフ描画"""
    if not c.code.strip():
        return ""
    lines = [
        "\\begin{figure}[h]",
        "\\centering",
        "\\begin{tikzpicture}",
        "\\begin{axis}[",
        "  grid=major,",
        "  xlabel={},",
        "  ylabel={},",
        "]",
        c.code,
        "\\end{axis}",
        "\\end{tikzpicture}",
    ]
    if c.caption:
        lines.append(f"\\caption{{{escape_latex(c.caption)}}}")
    lines.append("\\end{figure}")
    return "\n".join(lines)

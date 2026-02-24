"""
Structured document → LaTeX generator
Produces clean, natural LaTeX leveraging proper sectioning, math environments, etc.
"""
from ..models import (
    DocumentModel,
    Block,
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


# ──── Font config (macOS) ────
CJK_MAIN_FONT = "Hiragino Mincho ProN"
CJK_SANS_FONT = "Hiragino Sans"


def generate_document_latex(doc: DocumentModel) -> str:
    """Generate a complete LaTeX document from the block-based model."""
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

    lines: list[str] = []

    # ──── Preamble ────
    lines.append(f"\\documentclass[{opts_str}]{{article}}")
    lines.append("")
    lines.append("% ── Packages ──")
    lines.append("\\usepackage{fontspec}")
    lines.append("\\usepackage{xeCJK}")
    lines.append("\\usepackage{amsmath,amssymb,amsthm}")
    lines.append("\\usepackage{mathtools}")
    lines.append("\\usepackage{graphicx}")
    lines.append("\\usepackage{hyperref}")
    lines.append("\\usepackage{xcolor}")
    lines.append(f"\\usepackage[{geom}]{{geometry}}")
    lines.append("\\usepackage{fancyhdr}")
    lines.append("\\usepackage{enumitem}")
    lines.append("\\usepackage{listings}")
    lines.append("\\usepackage{tcolorbox}")
    lines.append("\\usepackage{booktabs}")
    lines.append("")
    lines.append("% ── Engineering / Science packages ──")
    lines.append("\\usepackage{tikz}")
    lines.append("\\usepackage[siunitx]{circuitikz}")
    lines.append("\\usepackage{pgfplots}")
    lines.append("\\pgfplotsset{compat=1.18}")
    lines.append("\\usepackage[version=4]{mhchem}")
    lines.append("\\usetikzlibrary{shapes,arrows.meta,positioning,calc,decorations.markings,automata,fit}")
    lines.append("")

    # ──── Fonts ────
    lines.append("% ── Fonts ──")
    lines.append(f"\\setCJKmainfont{{{CJK_MAIN_FONT}}}")
    lines.append(f"\\setCJKsansfont{{{CJK_SANS_FONT}}}")
    lines.append(f"\\setCJKmonofont{{{CJK_SANS_FONT}}}")
    lines.append("")

    # ──── Line spacing ────
    spacing = settings.line_spacing
    if spacing and spacing != 1.0:
        lines.append(f"\\renewcommand{{\\baselinestretch}}{{{spacing:.2f}}}")
        lines.append("")

    # ──── Header / Footer ────
    if settings.page_numbers:
        lines.append("\\pagestyle{fancy}")
        lines.append("\\fancyhf{}")
        lines.append("\\fancyfoot[C]{\\thepage}")
        lines.append("\\renewcommand{\\headrulewidth}{0pt}")
        lines.append("")
    else:
        lines.append("\\pagestyle{empty}")
        lines.append("")

    # ──── Listings style ────
    lines.append("\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,frame=single,"
                  "backgroundcolor=\\color{gray!5},rulecolor=\\color{gray!30}}")
    lines.append("")

    # ──── Hyperref setup ────
    lines.append("\\hypersetup{colorlinks=true,linkcolor=blue!60!black,urlcolor=blue!60!black}")
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
    lines.append("")

    # ──── Blocks ────
    for block in doc.blocks:
        latex = _render_block(block)
        if latex:
            lines.append(latex)
            lines.append("")

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
        return _render_heading(content)
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


def _render_heading(c: HeadingContent) -> str:
    if not c.text.strip():
        return ""
    text = escape_latex(c.text)
    if c.level == 1:
        return f"\\section*{{{text}}}"
    elif c.level == 2:
        return f"\\subsection*{{{text}}}"
    else:
        return f"\\subsubsection*{{{text}}}"


def _render_paragraph(c: ParagraphContent, style) -> str:
    if not c.text.strip():
        return ""
    text = text_to_latex_paragraphs(c.text)
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
        "\\begin{tcolorbox}[colback=gray!5,colframe=gray!40,left=8pt,right=8pt,top=6pt,bottom=6pt,boxrule=0pt,leftrule=3pt]",
        f"\\textit{{{text}}}",
    ]
    if c.attribution:
        lines.append(f"\\par\\raggedleft\\small--- {escape_latex(c.attribution)}")
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

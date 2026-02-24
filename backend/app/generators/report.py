"""
レポートテンプレート LaTeX生成
"""
from ..models import DocumentModel
from ..utils.base_generator import base_preamble, render_blocks
from ..utils.latex_utils import escape_latex


def generate_report(doc: DocumentModel) -> str:
    meta = doc.metadata
    preamble = base_preamble(font_size="11pt")

    title_section = ""
    if meta.title:
        title_section += rf"\title{{\Large \textbf{{{escape_latex(meta.title)}}}"
        if meta.subtitle:
            title_section += rf" \\ \large {escape_latex(meta.subtitle)}"
        title_section += "}\n"
    else:
        title_section += "\\title{}\n"

    author_parts = []
    if meta.author:
        author_parts.append(escape_latex(meta.author))
    title_section += f"\\author{{{' '.join(author_parts)}}}\n"

    if meta.date:
        title_section += f"\\date{{{escape_latex(meta.date)}}}\n"
    else:
        title_section += "\\date{\\today}\n"

    body = render_blocks(doc.blocks)

    return f"""{preamble}
% レポートスタイル
\\titleformat{{\\section}}{{\\large\\bfseries}}{{\\thesection.}}{{0.5em}}{{}}
\\titleformat{{\\subsection}}{{\\normalsize\\bfseries}}{{\\thesubsection.}}{{0.5em}}{{}}

{title_section}

\\begin{{document}}
\\maketitle

{body}

\\end{{document}}
"""

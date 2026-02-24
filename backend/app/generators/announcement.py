"""
案内文テンプレート LaTeX生成
"""
from ..models import DocumentModel
from ..utils.base_generator import base_preamble, render_blocks
from ..utils.latex_utils import escape_latex


def generate_announcement(doc: DocumentModel) -> str:
    meta = doc.metadata
    preamble = base_preamble(font_size="12pt")

    body = render_blocks(doc.blocks)

    date_line = escape_latex(meta.date) if meta.date else "\\today"
    author_line = escape_latex(meta.author) if meta.author else ""

    return rf"""{preamble}
% 案内文スタイル
\titleformat{{\section}}{{\large\bfseries}}{{}}{{0em}}{{}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{0.8em}}

\begin{{document}}

\begin{{flushright}}
{date_line}
\end{{flushright}}

\begin{{center}}
{{\LARGE \textbf{{{escape_latex(meta.title)}}}}}

\vspace{{0.3em}}
{{\large {escape_latex(meta.subtitle)}}}
\end{{center}}

\vspace{{1em}}

{body}

\vspace{{2em}}
\begin{{flushright}}
{author_line}
\end{{flushright}}

\end{{document}}
"""

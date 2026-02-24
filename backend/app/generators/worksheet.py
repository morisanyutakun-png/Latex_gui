"""
教材（ワークシート）テンプレート LaTeX生成
"""
from ..models import DocumentModel
from ..utils.base_generator import base_preamble, render_blocks
from ..utils.latex_utils import escape_latex


def generate_worksheet(doc: DocumentModel) -> str:
    meta = doc.metadata
    preamble = base_preamble(font_size="12pt")

    body = render_blocks(doc.blocks)

    date_line = escape_latex(meta.date) if meta.date else "\\today"

    return rf"""{preamble}
% 教材ワークシートスタイル
\usepackage{{tcolorbox}}
\titleformat{{\section}}{{\large\bfseries\color{{blue!70!black}}}}{{}}{{0em}}{{\rule{{\textwidth}}{{0.5pt}}\\}}
\titleformat{{\subsection}}{{\normalsize\bfseries}}{{}}{{0em}}{{}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{0.6em}}

\begin{{document}}

\begin{{center}}
{{\LARGE \textbf{{{escape_latex(meta.title)}}}}}

\vspace{{0.3em}}
{{\large {escape_latex(meta.subtitle)}}}

\vspace{{0.3em}}
{{\small {date_line}}}
\end{{center}}

\vspace{{0.5em}}
\noindent\rule{{\textwidth}}{{0.4pt}}
\vspace{{0.5em}}

{body}

\end{{document}}
"""

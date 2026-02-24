"""
共通LaTeXプリアンブル・ブロック変換
全テンプレートで共有するベース処理
"""
import os

from ..models import (
    Block, HeadingBlock, ParagraphBlock, ListBlock,
    TableBlock, ImageBlock, BlockType, ListStyle,
)
from .latex_utils import (
    escape_latex, text_to_latex_paragraphs,
    build_itemize, build_enumerate, build_table, build_image,
)

# フォント設定（環境変数で上書き可能、Docker環境ではNotoフォントを使用）
CJK_MAIN_FONT = os.environ.get("CJK_MAIN_FONT", "Hiragino Mincho ProN")
CJK_SANS_FONT = os.environ.get("CJK_SANS_FONT", "Hiragino Sans")


def base_preamble(*, font_size: str = "11pt", document_class: str = "article") -> str:
    """日本語対応XeLaTeX用の共通プリアンブル"""
    return rf"""\documentclass[{font_size},a4paper]{{{document_class}}}
\usepackage{{fontspec}}
\usepackage{{xeCJK}}
\setCJKmainfont{{{CJK_MAIN_FONT}}}
\setCJKsansfont{{{CJK_SANS_FONT}}}
\usepackage{{geometry}}
\geometry{{top=25mm, bottom=25mm, left=20mm, right=20mm}}
\usepackage{{graphicx}}
\usepackage{{hyperref}}
\usepackage{{enumitem}}
\usepackage{{xcolor}}
\usepackage{{titlesec}}
\usepackage{{fancyhdr}}
\pagestyle{{fancy}}
\fancyhf{{}}
\fancyfoot[C]{{\thepage}}
\renewcommand{{\headrulewidth}}{{0pt}}
"""


def render_block(block: Block) -> str:
    """ブロックをLaTeXコードに変換"""
    # Discriminated Unionにより正しい型が保証される
    if isinstance(block, HeadingBlock):
        level_map = {1: "section", 2: "subsection", 3: "subsubsection"}
        cmd = level_map.get(block.level, "section")
        return f"\\{cmd}{{{escape_latex(block.text)}}}"

    elif isinstance(block, ParagraphBlock):
        return text_to_latex_paragraphs(block.text)

    elif isinstance(block, ListBlock):
        if block.style == ListStyle.NUMBERED:
            return build_enumerate(block.items)
        return build_itemize(block.items)

    elif isinstance(block, TableBlock):
        return build_table(block.headers, block.rows)

    elif isinstance(block, ImageBlock):
        return build_image(block.url, block.caption, block.width)

    return ""


def render_blocks(blocks: list[Block]) -> str:
    """全ブロックをレンダリング"""
    parts = []
    for block in blocks:
        rendered = render_block(block)
        if rendered:
            parts.append(rendered)
    return "\n\n".join(parts)

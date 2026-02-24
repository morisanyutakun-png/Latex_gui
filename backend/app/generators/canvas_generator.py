"""
Universal canvas PDF generator
全テンプレート共通：ページ内要素を textpos で絶対配置レンダリング
"""

from ..models import DocumentModel
from ..utils.base_generator import canvas_preamble, render_canvas_element


def generate_canvas_pdf(doc: DocumentModel) -> str:
    """DocumentModel (pages/elements) → XeLaTeX ソース"""
    preamble = canvas_preamble()

    page_blocks: list[str] = []
    for i, page in enumerate(doc.pages):
        lines: list[str] = []
        if i > 0:
            lines.append(r"\newpage")

        # ページアンカー（textpos が正しいページに紐付くために必要）
        lines.append(r"\mbox{}")

        # zIndex 昇順でレンダリング（下層 → 上層）
        sorted_elements = sorted(page.elements, key=lambda e: e.zIndex)
        for elem in sorted_elements:
            rendered = render_canvas_element(elem)
            if rendered:
                lines.append(rendered)

        page_blocks.append("\n".join(lines))

    body = "\n\n".join(page_blocks) if page_blocks else r"\mbox{}"

    return f"""{preamble}
\\begin{{document}}

{body}

\\end{{document}}
"""

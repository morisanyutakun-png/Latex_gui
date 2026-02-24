"""
LaTeX特殊文字エスケープ、共通変換ユーティリティ
"""

# LaTeX特殊文字のエスケープマップ
_LATEX_SPECIAL_CHARS = {
    '\\': r'\textbackslash{}',
    '{': r'\{',
    '}': r'\}',
    '#': r'\#',
    '$': r'\$',
    '%': r'\%',
    '&': r'\&',
    '_': r'\_',
    '~': r'\textasciitilde{}',
    '^': r'\textasciicircum{}',
}


def escape_latex(text: str) -> str:
    """ユーザー入力をLaTeX安全な文字列に変換する"""
    if not text:
        return ""
    result = []
    for char in text:
        if char in _LATEX_SPECIAL_CHARS:
            result.append(_LATEX_SPECIAL_CHARS[char])
        else:
            result.append(char)
    return "".join(result)


def text_to_latex_paragraphs(text: str) -> str:
    """複数行テキストをLaTeXの段落に変換"""
    if not text:
        return ""
    paragraphs = text.strip().split("\n\n")
    escaped = [escape_latex(p.replace("\n", " ")) for p in paragraphs]
    return "\n\n".join(escaped)


def build_itemize(items: list[str]) -> str:
    """箇条書き（bullet）を生成"""
    lines = ["\\begin{itemize}"]
    for item in items:
        lines.append(f"  \\item {escape_latex(item)}")
    lines.append("\\end{itemize}")
    return "\n".join(lines)


def build_enumerate(items: list[str]) -> str:
    """番号付きリストを生成"""
    lines = ["\\begin{enumerate}"]
    for item in items:
        lines.append(f"  \\item {escape_latex(item)}")
    lines.append("\\end{enumerate}")
    return "\n".join(lines)


def build_table(headers: list[str], rows: list[list[str]]) -> str:
    """表を生成"""
    col_count = len(headers)
    col_spec = "|".join(["l"] * col_count)
    col_spec = f"|{col_spec}|"

    lines = [
        "\\begin{table}[h]",
        "\\centering",
        f"\\begin{{tabular}}{{{col_spec}}}",
        "\\hline",
    ]
    header_cells = " & ".join(f"\\textbf{{{escape_latex(h)}}}" for h in headers)
    lines.append(f"{header_cells} \\\\")
    lines.append("\\hline")

    for row in rows:
        # 列数が足りない場合は空文字で補完、多い場合は切り捨て
        padded = row[:col_count]
        while len(padded) < col_count:
            padded.append("")
        cells = " & ".join(escape_latex(c) for c in padded)
        lines.append(f"{cells} \\\\")
        lines.append("\\hline")

    lines.append("\\end{tabular}")
    lines.append("\\end{table}")
    return "\n".join(lines)


def build_image(url: str, caption: str = "", width: float = 0.8) -> str:
    """画像ブロックを生成（URL参照）"""
    lines = [
        "\\begin{figure}[h]",
        "\\centering",
        f"\\includegraphics[width={width}\\textwidth]{{{url}}}",
    ]
    if caption:
        lines.append(f"\\caption{{{escape_latex(caption)}}}")
    lines.append("\\end{figure}")
    return "\n".join(lines)

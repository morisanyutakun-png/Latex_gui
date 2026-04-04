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


# ──── Design Preset Definitions (mirrors frontend DESIGN_PRESETS) ────

DESIGN_PRESETS: dict[str, dict] = {
    "none": {
        "colors": {"primary": "#333333", "secondary": "#666666", "background": "#ffffff",
                   "surface": "#f5f5f5", "text": "#1a1a1a", "muted": "#888888"},
        "style": {"headerBorder": False, "sectionDividers": False, "coloredBoxes": False,
                  "gradientHeader": False, "sideStripe": False, "styledCodeBlocks": False,
                  "decorativeFooter": False},
    },
    "ocean-academic": {
        "colors": {"primary": "#1e40af", "secondary": "#3b82f6", "background": "#fafbff",
                   "surface": "#eff6ff", "text": "#1e293b", "muted": "#64748b"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": True, "sideStripe": False, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "forest-nature": {
        "colors": {"primary": "#166534", "secondary": "#22c55e", "background": "#fafff7",
                   "surface": "#f0fdf4", "text": "#1a2e1a", "muted": "#6b8f71"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": False, "sideStripe": True, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "sunset-warm": {
        "colors": {"primary": "#c2410c", "secondary": "#f97316", "background": "#fffbf5",
                   "surface": "#fff7ed", "text": "#27180e", "muted": "#9a7b6b"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": True, "sideStripe": False, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "sakura-soft": {
        "colors": {"primary": "#be185d", "secondary": "#f472b6", "background": "#fffbfd",
                   "surface": "#fdf2f8", "text": "#2d1a24", "muted": "#9f7a8e"},
        "style": {"headerBorder": True, "sectionDividers": False, "coloredBoxes": True,
                  "gradientHeader": False, "sideStripe": True, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "midnight-pro": {
        "colors": {"primary": "#6366f1", "secondary": "#a78bfa", "background": "#fafaff",
                   "surface": "#eef2ff", "text": "#1e1b4b", "muted": "#6b7280"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": True, "sideStripe": False, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "mint-fresh": {
        "colors": {"primary": "#0d9488", "secondary": "#5eead4", "background": "#f8fffd",
                   "surface": "#f0fdfa", "text": "#142f2e", "muted": "#6b9e99"},
        "style": {"headerBorder": False, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": False, "sideStripe": True, "styledCodeBlocks": True,
                  "decorativeFooter": False},
    },
    "coral-pop": {
        "colors": {"primary": "#dc2626", "secondary": "#fb923c", "background": "#fffafa",
                   "surface": "#fef2f2", "text": "#2a1515", "muted": "#a18072"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": True, "sideStripe": False, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "lavender-dream": {
        "colors": {"primary": "#7c3aed", "secondary": "#c4b5fd", "background": "#fdfaff",
                   "surface": "#f5f3ff", "text": "#1f1535", "muted": "#8b7fa3"},
        "style": {"headerBorder": True, "sectionDividers": False, "coloredBoxes": True,
                  "gradientHeader": False, "sideStripe": True, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "slate-minimal": {
        "colors": {"primary": "#334155", "secondary": "#94a3b8", "background": "#fafafa",
                   "surface": "#f1f5f9", "text": "#0f172a", "muted": "#94a3b8"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": False,
                  "gradientHeader": False, "sideStripe": False, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
    "golden-classic": {
        "colors": {"primary": "#92400e", "secondary": "#d97706", "background": "#fffef7",
                   "surface": "#fefce8", "text": "#1c1917", "muted": "#a8977a"},
        "style": {"headerBorder": True, "sectionDividers": True, "coloredBoxes": True,
                  "gradientHeader": True, "sideStripe": False, "styledCodeBlocks": True,
                  "decorativeFooter": True},
    },
}


def _generate_paper_design_latex(design: PaperDesign) -> list[str]:
    """PaperDesign をリッチな LaTeX プリアンブルコマンドに変換する。

    デザインプリセットが指定されていればリッチなスタイルを生成。
    プリセットなしの場合はアクセントカラーのみの軽量スタイル。
    """
    lines: list[str] = []
    lines.append("% ── Paper Design ──")

    preset_id = getattr(design, "design_preset", "none") or "none"
    preset = DESIGN_PRESETS.get(preset_id)

    # --- プリセットが有効なら、プリセットのカラーを使う ---
    if preset and preset_id != "none":
        colors = preset["colors"]
        pstyle = preset["style"]

        # カラー定義
        pr, pg, pb = _hex_to_rgb(colors["primary"])
        sr, sg, sb = _hex_to_rgb(colors["secondary"])
        bgr, bgg, bgb = _hex_to_rgb(colors["background"])
        sfr, sfg, sfb = _hex_to_rgb(colors["surface"])
        tr, tg, tb = _hex_to_rgb(colors["text"])
        mr, mg, mb = _hex_to_rgb(colors["muted"])

        lines.append(f"\\definecolor{{accentcolor}}{{RGB}}{{{pr},{pg},{pb}}}")
        lines.append(f"\\definecolor{{secondcolor}}{{RGB}}{{{sr},{sg},{sb}}}")
        lines.append(f"\\definecolor{{paperbg}}{{RGB}}{{{bgr},{bgg},{bgb}}}")
        lines.append(f"\\definecolor{{surfacecolor}}{{RGB}}{{{sfr},{sfg},{sfb}}}")
        lines.append(f"\\definecolor{{textcolor}}{{RGB}}{{{tr},{tg},{tb}}}")
        lines.append(f"\\definecolor{{mutedcolor}}{{RGB}}{{{mr},{mg},{mb}}}")

        # 背景色
        if colors["background"].lower() != "#ffffff":
            lines.append("\\usepackage{pagecolor}")
            lines.append("\\pagecolor{paperbg}")

        # テキスト色
        lines.append("\\color{textcolor}")

        # tcolorbox (多くのプリセットで使う)
        lines.append("\\usepackage[most]{tcolorbox}")

        # ── グラデーションヘッダーストライプ (ページ上部の装飾帯) ──
        if pstyle["gradientHeader"]:
            lines.append("\\usepackage{tikz}")
            lines.append("\\usepackage{eso-pic}")
            lines.append("\\AddToShipoutPictureFG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append("    \\fill[left color=accentcolor, right color=secondcolor, opacity=0.9]")
            lines.append("      (current page.north west) rectangle ([yshift=-4mm]current page.north east);")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")

        # ── サイドストライプ (左マージンの装飾線) ──
        if pstyle["sideStripe"]:
            if "eso-pic" not in "\n".join(lines):
                lines.append("\\usepackage{tikz}")
                lines.append("\\usepackage{eso-pic}")
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append("    \\fill[accentcolor, opacity=0.7]")
            lines.append("      (current page.north west) rectangle ([xshift=3mm]current page.south west);")
            lines.append("    \\fill[secondcolor, opacity=0.3]")
            lines.append("      ([xshift=3mm]current page.north west) rectangle ([xshift=4.5mm]current page.south west);")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")

        # ── セクション見出しスタイル (色付き＋装飾) ──
        lines.append("% ── Styled section headings ──")
        if pstyle["sectionDividers"]:
            # セクション: 番号バッジ + 下線
            lines.append("\\titleformat{\\section}")
            lines.append("  {\\Large\\bfseries\\sffamily\\color{accentcolor}}")
            lines.append("  {\\colorbox{accentcolor}{\\textcolor{white}{\\,\\thesection\\,}}}")
            lines.append("  {0.8em}")
            lines.append("  {}")
            lines.append("  [\\vspace{0.2em}\\textcolor{secondcolor!50}{\\rule{\\textwidth}{0.6pt}}]")
        else:
            # セクション: 色付きのみ
            lines.append("\\titleformat{\\section}")
            lines.append("  {\\Large\\bfseries\\sffamily\\color{accentcolor}}")
            lines.append("  {\\textcolor{accentcolor}{\\thesection}}")
            lines.append("  {0.8em}")
            lines.append("  {}")

        # サブセクション
        lines.append("\\titleformat{\\subsection}")
        lines.append("  {\\large\\bfseries\\sffamily\\color{accentcolor!80!black}}")
        lines.append("  {\\textcolor{secondcolor}{\\thesubsection}}")
        lines.append("  {0.6em}")
        lines.append("  {}")

        # ── ヘッダーボーダー (タイトル下の装飾線) ──
        if pstyle["headerBorder"]:
            lines.append("\\usepackage{etoolbox}")
            lines.append("\\apptocmd{\\maketitle}{%")
            lines.append("  \\vspace{-0.8em}")
            lines.append("  \\noindent\\textcolor{accentcolor}{\\rule{\\textwidth}{1.5pt}}")
            lines.append("  \\vspace{0.3em}")
            lines.append("}{}{}")

        # ── 装飾フッター ──
        if pstyle["decorativeFooter"]:
            lines.append("% ── Decorative footer ──")
            lines.append("\\usepackage{fancyhdr}")
            lines.append("\\fancypagestyle{presetstyle}{%")
            lines.append("  \\fancyhf{}")
            lines.append("  \\renewcommand{\\headrulewidth}{0pt}")
            lines.append("  \\renewcommand{\\footrulewidth}{0.4pt}")
            lines.append("  \\renewcommand{\\footrule}{\\hbox to\\headwidth{%")
            lines.append("    \\color{secondcolor!40}\\leaders\\hrule height \\footrulewidth\\hfill}}")
            lines.append("  \\fancyfoot[L]{\\small\\textcolor{mutedcolor}{\\leftmark}}")
            lines.append("  \\fancyfoot[R]{\\small\\textcolor{accentcolor}{\\bfseries\\thepage}}")
            lines.append("}")
            lines.append("\\pagestyle{presetstyle}")

        # ── カラーボックス定義 (引用ブロック用) ──
        if pstyle["coloredBoxes"]:
            lines.append("% ── Colored box styles ──")
            lines.append("\\newtcolorbox{accentbox}{")
            lines.append("  colback=surfacecolor,")
            lines.append("  colframe=accentcolor,")
            lines.append("  left=10pt, right=10pt, top=8pt, bottom=8pt,")
            lines.append("  boxrule=0pt, leftrule=3.5pt, arc=2pt")
            lines.append("}")

    else:
        # --- プリセットなし: 従来のシンプルスタイル ---
        paper_color = design.paper_color or "#ffffff"
        if paper_color.lower() != "#ffffff":
            r, g, b = _hex_to_rgb(paper_color)
            lines.append(f"\\definecolor{{paperbg}}{{RGB}}{{{r},{g},{b}}}")
            lines.append("\\usepackage{pagecolor}")
            lines.append("\\pagecolor{paperbg}")

        accent = design.accent_color or "#4f46e5"
        ar, ag, ab = _hex_to_rgb(accent)
        lines.append(f"\\definecolor{{accentcolor}}{{RGB}}{{{ar},{ag},{ab}}}")

        lines.append("\\titleformat{\\section}{\\Large\\bfseries\\sffamily\\color{accentcolor}}{\\thesection}{0.8em}{}")
        lines.append("\\titleformat{\\subsection}{\\large\\bfseries\\sffamily\\color{accentcolor!80!black}}{\\thesubsection}{0.6em}{}")

        if design.header_border:
            lines.append("\\usepackage{etoolbox}")
            lines.append("\\apptocmd{\\maketitle}{\\vspace{-1em}\\noindent\\textcolor{accentcolor}{\\rule{\\textwidth}{1.2pt}}\\vspace{0.5em}}{}{}")

        if design.section_dividers:
            lines.append("\\titleformat{\\section}{\\Large\\bfseries\\sffamily\\color{accentcolor}}{\\thesection}{0.8em}{}"
                          "[\\vspace{0.2em}\\textcolor{accentcolor!40}{\\rule{\\textwidth}{0.5pt}}]")

    # --- テーマ背景パターン (TikZ で描画) --- 両方で有効
    theme = design.theme or "plain"
    if theme in ("grid", "lined", "dot-grid"):
        if "tikz" not in "\n".join(lines):
            lines.append("\\usepackage{tikz}")
        if "eso-pic" not in "\n".join(lines):
            lines.append("\\usepackage{eso-pic}")
        if theme == "grid":
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append("    \\draw[accentcolor!8, step=5mm, line width=0.2pt] "
                         "(current page.south west) grid (current page.north east);")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")
        elif theme == "lined":
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append("    \\foreach \\y in {0,7mm,...,\\paperheight} {")
            lines.append("      \\draw[accentcolor!10, line width=0.2pt] "
                         "([yshift=-\\y]current page.north west) -- ([yshift=-\\y]current page.north east);")
            lines.append("    }")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")
        elif theme == "dot-grid":
            lines.append("\\AddToShipoutPictureBG{%")
            lines.append("  \\begin{tikzpicture}[remember picture, overlay]")
            lines.append("    \\foreach \\x in {0,5mm,...,\\paperwidth} {")
            lines.append("      \\foreach \\y in {0,5mm,...,\\paperheight} {")
            lines.append("        \\fill[accentcolor!12] ([xshift=\\x, yshift=-\\y]current page.north west) circle (0.3pt);")
            lines.append("      }")
            lines.append("    }")
            lines.append("  \\end{tikzpicture}%")
            lines.append("}")

    return lines


def _get_active_preset(doc: DocumentModel) -> dict | None:
    """Return the active design preset dict, or None if none/plain."""
    design = getattr(doc.settings, 'paper_design', None)
    if not design:
        return None
    preset_id = getattr(design, "design_preset", "none") or "none"
    if preset_id == "none":
        return None
    return DESIGN_PRESETS.get(preset_id)


def generate_document_latex(doc: DocumentModel, engine: str = "lualatex") -> str:
    """Generate a complete LaTeX document from the block-based model.

    engine: 'lualatex' (固定)。luatexja-preset[haranoaji] で日本語処理。
    """
    settings = doc.settings
    meta = doc.metadata
    active_preset = _get_active_preset(doc)

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
    # プリセットが decorativeFooter を持つ場合、fancyhdr はプリセット側で設定
    if active_preset and active_preset["style"]["decorativeFooter"]:
        pass  # preset handles footer
    elif settings.page_numbers:
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
    block_types_used = set()
    for b in doc.blocks:
        try:
            block_types_used.add(b.content.type)
        except (AttributeError, TypeError):
            logger.warning("Block %s has invalid content (no type), skipping", getattr(b, 'id', '?'))
    if "code" in block_types_used:
        if active_preset and active_preset["style"]["styledCodeBlocks"]:
            # プリセットのカラーを使ったスタイリッシュなコードブロック
            lines.append("\\lstset{")
            lines.append("  basicstyle=\\ttfamily\\small,")
            lines.append("  breaklines=true,")
            lines.append("  frame=l,")
            lines.append("  framerule=2.5pt,")
            lines.append("  rulecolor=\\color{accentcolor!60},")
            lines.append("  backgroundcolor=\\color{surfacecolor},")
            lines.append("  xleftmargin=14pt,")
            lines.append("  numberstyle=\\tiny\\color{mutedcolor},")
            lines.append("  keywordstyle=\\color{accentcolor!90!black}\\bfseries,")
            lines.append("  commentstyle=\\color{mutedcolor}\\itshape,")
            lines.append("  stringstyle=\\color{secondcolor!80!black},")
            lines.append("  tabsize=2,")
            lines.append("  showstringspaces=false,")
            lines.append("}")
            lines.append("")
        else:
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
    if active_preset:
        lines.append("\\hypersetup{")
        lines.append("  colorlinks=true,")
        lines.append("  linkcolor=accentcolor!70!black,")
        lines.append("  urlcolor=secondcolor!70!black,")
        lines.append("  citecolor=accentcolor!50!black,")
        lines.append("  pdfstartview=FitH,")
        lines.append("}")
    else:
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
        try:
            if not block.content or not hasattr(block.content, 'type'):
                logger.warning("Skipping block %s: invalid content", getattr(block, 'id', '?'))
                continue
            latex = _render_block(block, active_preset)
            if latex:
                lines.append(latex)
        except Exception as e:
            logger.warning("Error rendering block %s (%s): %s",
                          getattr(block, 'id', '?'),
                          getattr(block.content, 'type', '?'), e)
            lines.append(f"% ERROR: block rendering failed: {str(e)[:80]}")
            lines.append("")

    # 上級者モード: post_document フック
    if advanced and advanced.enabled and advanced.post_document.strip():
        post_violations = validate_custom_preamble(advanced.post_document)
        if not post_violations:
            lines.append("% ── post-document hook ──")
            lines.append(advanced.post_document)

    lines.append("\\end{document}")
    return "\n".join(lines)


def _render_block(block: Block, preset: dict | None = None) -> str:
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

    inner = _render_content(content, style, preset)
    if not inner.strip():
        return ""

    parts = prefix_cmds + [inner] + suffix_cmds
    return "\n".join(parts)


def _render_content(content, style, preset: dict | None = None) -> str:
    """Render block content to LaTeX based on type."""
    t = content.type

    if t == "heading":
        return _render_heading(content, style)
    elif t == "paragraph":
        return _render_paragraph(content, style)
    elif t == "math":
        return _render_math(content)
    elif t == "list":
        return _render_list(content, preset)
    elif t == "table":
        return _render_table(content, preset)
    elif t == "image":
        return _render_image(content)
    elif t == "divider":
        return _render_divider(preset)
    elif t == "code":
        return _render_code(content)
    elif t == "quote":
        return _render_quote(content, preset)
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


def _render_list(c: ListContent, preset: dict | None = None) -> str:
    non_empty = [item for item in c.items if item.strip()]
    if not non_empty:
        return ""
    env = "itemize" if c.style == "bullet" else "enumerate"

    # プリセットがある場合、色付きのリストマーカー
    if preset and preset["style"]["coloredBoxes"]:
        if c.style == "bullet":
            items_str = "\n".join(f"  \\item[\\textcolor{{accentcolor}}{{\\textbullet}}] {escape_latex(item)}" for item in non_empty)
        else:
            items_str = "\n".join(f"  \\item {escape_latex(item)}" for item in non_empty)
            return f"\\begin{{{env}}}[label=\\textcolor{{accentcolor}}{{\\arabic*.}}]\n{items_str}\n\\end{{{env}}}"
    else:
        items_str = "\n".join(f"  \\item {escape_latex(item)}" for item in non_empty)

    return f"\\begin{{{env}}}\n{items_str}\n\\end{{{env}}}"


def _render_table(c: TableContent, preset: dict | None = None) -> str:
    col_count = len(c.headers)
    if col_count == 0:
        return ""

    if preset and preset["style"]["coloredBoxes"]:
        # プリセット: 色付きヘッダー行のテーブル
        lines = [
            "\\begin{table}[h]",
            "\\centering",
            f"\\begin{{tabular}}{{{' '.join(['l'] * col_count)}}}",
            "\\toprule",
            "\\rowcolor{surfacecolor}",
        ]
        header_cells = " & ".join(f"\\textcolor{{accentcolor}}{{\\textbf{{{escape_latex(h)}}}}}" for h in c.headers)
    else:
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


def _render_divider(preset: dict | None = None) -> str:
    if preset:
        return "\\vspace{0.5em}\\noindent\\textcolor{secondcolor!40}{\\rule{\\textwidth}{0.4pt}}\\vspace{0.5em}"
    return "\\vspace{0.5em}\\noindent\\rule{\\textwidth}{0.4pt}\\vspace{0.5em}"


def _render_code(c: CodeContent) -> str:
    if not c.code.strip():
        return ""
    lang_opt = f"[language={c.language}]" if c.language else ""
    return f"\\begin{{lstlisting}}{lang_opt}\n{c.code}\n\\end{{lstlisting}}"


def _render_quote(c: QuoteContent, preset: dict | None = None) -> str:
    if not c.text.strip():
        return ""
    text = escape_latex(c.text)

    if preset and preset["style"]["coloredBoxes"]:
        # プリセット: accentbox 使用
        lines = [
            "\\begin{accentbox}",
            f"\\textit{{{text}}}",
        ]
        if c.attribution:
            lines.append(f"\\par\\raggedleft\\small\\textcolor{{mutedcolor}}{{--- {escape_latex(c.attribution)}}}")
        lines.append("\\end{accentbox}")
    else:
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

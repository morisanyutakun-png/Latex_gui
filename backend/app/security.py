"""
LaTeX セキュリティ: サンドボックス化・入力サニタイズ・パッケージ許可リスト

方針:
  - shell-escape 禁止 (コンパイル引数に含めない)
  - 危険な LaTeX コマンドをブラックリストで禁止
  - パッケージはホワイトリスト方式
  - ユーザーの code フィールド (circuit/diagram/chart/code) を検査
  - 上級者モードではフック経由の部分的上書きのみ許可
"""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# 1. 危険コマンドブラックリスト
# ═══════════════════════════════════════════════════════════════

# ファイルシステムアクセス・外部コマンド実行に使われるコマンド
DANGEROUS_COMMANDS = [
    r"\\input",
    r"\\include",
    r"\\openin",
    r"\\openout",
    r"\\read",
    r"\\write(?!18\b)",  # \write18 は shell-escape 無効なら動かないが念のため
    r"\\write18",
    r"\\immediate\\write18",
    r"\\directlua",       # LuaTeX でのLua実行
    r"\\luaexec",
    r"\\luadirect",
    r"\\luacode",
    r"\\latelua",
    r"\\ShellEscape",
    r"\\pdfshellescape",
    r"\\bibliographystyle",
    r"\\bibliography",
    r"\\makeindex",
    r"\\inputminted",
    r"\\verbatiminput",
    r"\\lstinputlisting",
    r"\\includepdf",
    r"\\pdfximage",
    r"\\url\{file:",      # ローカルファイルURL
    r"\\href\{file:",
    r"\\catcode",         # カテゴリーコード変更
    r"\\csname.*endcsname",  # 動的コマンド生成
]

# 上級者モードで許可しないコマンド (フックでも禁止)
ALWAYS_FORBIDDEN = [
    r"\\write18",
    r"\\immediate\\write18",
    r"\\directlua",
    r"\\luaexec",
    r"\\luadirect",
    r"\\luacode",
    r"\\latelua",
    r"\\ShellEscape",
    r"\\pdfshellescape",
    r"\\openin",
    r"\\openout",
    r"\\read(?!\s)",
    r"\\catcode",
]

# コンパイル済み正規表現
_DANGEROUS_RE = re.compile(
    "|".join(DANGEROUS_COMMANDS),
    re.IGNORECASE
)

_ALWAYS_FORBIDDEN_RE = re.compile(
    "|".join(ALWAYS_FORBIDDEN),
    re.IGNORECASE
)


# ═══════════════════════════════════════════════════════════════
# 2. パッケージ許可リスト (ホワイトリスト)
# ═══════════════════════════════════════════════════════════════

# システムが自動挿入するパッケージ + ユーザーが要求可能なパッケージ
ALLOWED_PACKAGES = {
    # ── 基本 ──
    "luatexja-preset",
    "luatexja",
    "xcolor",
    "color",
    "hyperref",
    "geometry",
    "fancyhdr",
    "graphicx",
    "graphics",
    # ── 数式 ──
    "amsmath",
    "amssymb",
    "amsthm",
    "amsfonts",
    "mathtools",
    "bm",
    "siunitx",
    "physics",
    "cancel",
    # ── 表 ──
    "booktabs",
    "tabularx",
    "tabulary",
    "longtable",
    "multirow",
    "array",
    "colortbl",
    "makecell",
    "diagbox",
    "threeparttable",
    "ltablex",
    # ── リスト ──
    "enumitem",
    "paralist",
    # ── コード ──
    "listings",
    "verbatim",
    "fancyvrb",
    "minted",
    # ── 引用・装飾 ──
    "tcolorbox",
    "framed",
    "mdframed",
    "epigraph",
    "csquotes",
    # ── 図・描画 ──
    "tikz",
    "circuitikz",
    "pgfplots",
    "pgf",
    "float",
    "wrapfig",
    "subcaption",
    "caption",
    "subfig",
    "rotating",
    "adjustbox",
    "graphbox",
    "standalone",
    # ── 化学 ──
    "mhchem",
    "chemfig",
    "chemformula",
    # ── レイアウト ──
    "multicol",        # 多段組 — AI が頻繁に要求
    "multicols",
    "setspace",
    "parskip",
    "titlesec",
    "titleformat",
    "titletoc",
    "tocloft",
    "appendix",
    "changepage",
    "afterpage",
    "needspace",
    "nopageno",
    "indentfirst",
    "ragged2e",
    "marginnote",
    # ── ヘッダ・フッタ ──
    "lastpage",
    "extramarks",
    # ── フォント ──
    "fontspec",
    "unicode-math",
    "newtxtext",
    "newtxmath",
    "anyfontsize",
    "relsize",
    # ── 国際化 ──
    "babel",
    "polyglossia",
    "csvsimple",
    # ── その他 ──
    "url",
    "ifthen",
    "etoolbox",
    "xparse",
    "expl3",
    "calc",
    "xstring",
    "textpos",
    "datetime2",
    "datetime",
    "pdfpages",
    "comment",
    "soul",
    "ulem",
    "xfrac",
    "nicefrac",
    "siunitx",
    "qrcode",
    "fontawesome5",
    "fontawesome",
    "academicons",
    "lipsum",    # テスト用
    "blindtext", # テスト用
}

# TikZ ライブラリの許可リスト
ALLOWED_TIKZ_LIBRARIES = {
    "shapes", "arrows", "arrows.meta", "positioning", "calc",
    "decorations", "decorations.markings", "decorations.pathmorphing",
    "decorations.pathreplacing", "decorations.text",
    "automata", "fit", "backgrounds", "chains",
    "matrix", "patterns", "plotmarks", "shadows",
    "trees", "mindmap", "calendar", "circuits",
    "circuits.ee", "circuits.ee.IEC", "circuits.logic",
    "circuits.logic.US", "circuits.logic.IEC",
    "intersections", "through", "babel",
    "external", "folding", "lindenmayersystems",
    "petri", "spy", "turtle", "3d",
}


class SecurityViolation(Exception):
    """セキュリティポリシー違反"""
    def __init__(self, message: str, violations: list[str]):
        self.message = message
        self.violations = violations
        super().__init__(message)


def sanitize_code_field(code: str, block_type: str, advanced_mode: bool = False) -> str:
    """
    ユーザーの code フィールド (circuit/diagram/chart/code) を検査。
    危険なコマンドが含まれていたら SecurityViolation を投げる。
    """
    if not code.strip():
        return code

    violations: list[str] = []

    # 常に禁止するコマンドの検査
    for match in _ALWAYS_FORBIDDEN_RE.finditer(code):
        violations.append(f"禁止コマンド検出: {match.group()}")

    # 通常モードでは追加の危険コマンドも検査
    if not advanced_mode:
        for match in _DANGEROUS_RE.finditer(code):
            cmd = match.group()
            # 既に ALWAYS_FORBIDDEN で検出済みでないもののみ追加
            msg = f"禁止コマンド検出: {cmd}"
            if msg not in violations:
                violations.append(msg)

    # usepackage の検出 (code フィールド内での直接使用は禁止)
    pkg_matches = re.findall(r'\\usepackage(?:\[.*?\])?\{([^}]+)\}', code)
    for pkg_str in pkg_matches:
        for pkg in pkg_str.split(","):
            pkg = pkg.strip()
            if pkg and pkg not in ALLOWED_PACKAGES:
                violations.append(f"未許可パッケージ: {pkg}")

    if violations:
        raise SecurityViolation(
            f"セキュリティポリシー違反 ({block_type}): " + "; ".join(violations[:5]),
            violations
        )

    return code


def validate_document_security(blocks: list, advanced_mode: bool = False) -> list[str]:
    """
    ドキュメント全体のブロックをスキャンし、セキュリティ違反を収集。
    違反があっても例外は投げず、違反リストを返す。
    """
    violations: list[str] = []

    for block in blocks:
        content = block.content
        block_type = content.type

        # code フィールドを持つブロックを検査
        code_value = None
        if hasattr(content, "code"):
            code_value = content.code
        elif hasattr(content, "formula"):
            code_value = content.formula

        if code_value:
            try:
                sanitize_code_field(code_value, block_type, advanced_mode)
            except SecurityViolation as e:
                violations.extend(e.violations)

    return violations


def validate_custom_preamble(preamble: str) -> list[str]:
    """
    上級者モードのカスタムプリアンブルを検証。
    許可: \\newcommand, \\renewcommand, \\DeclareMathOperator, 
          \\usepackage (許可リスト内のみ), \\usetikzlibrary (許可リスト内のみ)
    """
    violations: list[str] = []

    # 常に禁止されるコマンドのチェック
    for match in _ALWAYS_FORBIDDEN_RE.finditer(preamble):
        violations.append(f"プリアンブル内の禁止コマンド: {match.group()}")

    # \input, \include 等の禁止
    file_access = re.findall(r'\\(input|include|openin|openout)\b', preamble)
    for cmd in file_access:
        violations.append(f"プリアンブル内のファイルアクセス: \\{cmd}")

    # usepackage チェック
    pkg_matches = re.findall(r'\\usepackage(?:\[.*?\])?\{([^}]+)\}', preamble)
    for pkg_str in pkg_matches:
        for pkg in pkg_str.split(","):
            pkg = pkg.strip()
            if pkg and pkg not in ALLOWED_PACKAGES:
                violations.append(f"未許可パッケージ: {pkg}")

    # tikz library チェック
    lib_matches = re.findall(r'\\usetikzlibrary\{([^}]+)\}', preamble)
    for lib_str in lib_matches:
        for lib in lib_str.split(","):
            lib = lib.strip()
            if lib and lib not in ALLOWED_TIKZ_LIBRARIES:
                violations.append(f"未許可TikZライブラリ: {lib}")

    return violations


def get_compile_args(base_cmd: str, output_dir: str, tex_path: str) -> list[str]:
    """
    安全なコンパイル引数を生成。
    shell-escape は絶対に含めない。
    --no-shell-escape を明示的に指定。
    """
    return [
        base_cmd,
        "--no-shell-escape",          # 明示的に禁止
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        "-output-directory", output_dir,
        tex_path,
    ]


def validate_input_size(blocks: list, max_blocks: int = 5000, max_total_chars: int = 5_000_000) -> Optional[str]:
    """入力サイズの制限チェック"""
    if len(blocks) > max_blocks:
        return f"ブロック数が上限({max_blocks})を超えています: {len(blocks)}"

    total_chars = 0
    for block in blocks:
        content = block.content
        for field_name in ("text", "latex", "code", "formula"):
            val = getattr(content, field_name, None)
            if val:
                total_chars += len(val)
        if hasattr(content, "items"):
            total_chars += sum(len(item) for item in content.items)
        if hasattr(content, "headers"):
            total_chars += sum(len(h) for h in content.headers)
        if hasattr(content, "rows"):
            for row in content.rows:
                total_chars += sum(len(cell) for cell in row)

    if total_chars > max_total_chars:
        return f"ドキュメントの合計文字数が上限({max_total_chars:,})を超えています: {total_chars:,}"

    return None

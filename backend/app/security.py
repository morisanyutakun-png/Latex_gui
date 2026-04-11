"""
LaTeX セキュリティ: サンドボックス化・入力サニタイズ・パッケージ許可リスト

方針:
  - shell-escape 禁止 (コンパイル引数に含めない)
  - 危険な LaTeX コマンドをブラックリストで禁止
  - パッケージはホワイトリスト方式
  - ユーザーの code フィールド (circuit/diagram/chart/code) を検査
  - 上級者モードではフック経由の部分的上書きのみ許可

エラー報告 (Phase 2 改修):
  - violations は **構造化辞書** のリスト ({"code", ...フィールド}) として返す
  - フロントエンドが i18n でローカライズできるよう、人間向け文字列ではなく
    機械可読なコードと引数のペアで返す
  - 既存呼び出しの互換のため format_violations() で日本語文字列にも変換可能
"""
import re
import logging
from typing import Optional, TypedDict, Literal

logger = logging.getLogger(__name__)


class Violation(TypedDict, total=False):
    """セキュリティポリシー違反の構造化レコード。

    code フィールドはフロントエンドの i18n キーに 1:1 対応する:
      - "package_not_allowed"      : 未許可パッケージ           → params: {"package": str}
      - "tikz_library_not_allowed" : 未許可 TikZ ライブラリ       → params: {"library": str}
      - "forbidden_command"        : 禁止コマンド (常に禁止)       → params: {"command": str}
      - "dangerous_command"        : 危険コマンド (通常モードで禁止) → params: {"command": str}
      - "file_access"              : プリアンブルでのファイルアクセス → params: {"command": str}
    """
    code: Literal[
        "package_not_allowed",
        "tikz_library_not_allowed",
        "forbidden_command",
        "dangerous_command",
        "file_access",
    ]
    package: str
    library: str
    command: str


# ═══════════════════════════════════════════════════════════════
# 1. 危険コマンドブラックリスト
# ═══════════════════════════════════════════════════════════════

# ファイルシステムアクセス・外部コマンド実行に使われるコマンド
# 注: `\\include(?![a-zA-Z])` のように負の先読みを使い、\includegraphics や
#     \includepdf を巻き込まない。長いコマンド名は別途リストする。
DANGEROUS_COMMANDS = [
    r"\\input(?![a-zA-Z])",
    r"\\include(?![a-zA-Z])",
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
    "abstract",
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
    # 英語 / Latin 系フォント (lmodern は Phase 3 で英語テンプレ用に追加)
    "lmodern",
    "mlmodern",
    "fontenc",
    "inputenc",
    "textcomp",
    "ae",
    "times",
    "mathptmx",
    "helvet",
    "courier",
    "palatino",
    "mathpazo",
    "tgtermes",
    "tgheros",
    "tgcursor",
    "tgpagella",
    "tgschola",
    "tgbonum",
    "tgadventor",
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
    "shapes", "shapes.geometric", "shapes.symbols",
    "shapes.arrows", "shapes.misc", "shapes.multipart",
    "shapes.callouts",
    "arrows", "arrows.meta", "positioning", "calc",
    "decorations", "decorations.markings", "decorations.pathmorphing",
    "decorations.pathreplacing", "decorations.text",
    "decorations.shapes", "decorations.fractals", "decorations.footprints",
    "automata", "fit", "backgrounds", "chains",
    "matrix", "patterns", "patterns.meta", "plotmarks", "shadows",
    "trees", "mindmap", "calendar", "circuits",
    "circuits.ee", "circuits.ee.IEC", "circuits.logic",
    "circuits.logic.US", "circuits.logic.IEC",
    "intersections", "through", "babel",
    "external", "folding", "lindenmayersystems",
    "petri", "spy", "turtle", "3d",
    "angles", "quotes",                 # angle labels & `edge[quotes]`
    "pgfplots.groupplots", "pgfplots.fillbetween",
    "pgfplots.statistics", "pgfplots.dateplot",
    "datavisualization", "datavisualization.formats.functions",
    "graphs", "graphdrawing",
}


def get_allowed_packages_doc(lang: str = "en") -> str:
    """AI システムプロンプトに埋め込む「許可パッケージ一覧」を生成する。

    ALLOWED_PACKAGES と ALLOWED_TIKZ_LIBRARIES が単一情報源 (SoT)。
    将来パッケージを追加するときは ALLOWED_PACKAGES だけ更新すれば、
    AI プロンプトも自動的に追従する。

    Returns:
        プロンプトに直接挿入できる Markdown 風テキスト。
        ja / en でラベルだけ言語を切り替える (パッケージ名は同じ)。
    """
    pkgs = sorted(ALLOWED_PACKAGES)
    libs = sorted(ALLOWED_TIKZ_LIBRARIES)

    if lang == "ja":
        header_pkg = "使用可能な LaTeX パッケージ (この一覧の外は禁止)"
        header_lib = "使用可能な TikZ ライブラリ"
        warn = (
            "この一覧外のパッケージは sandbox にロードされておらず、"
            "\\usepackage で読み込もうとするとサーバー側で reject される。"
            "リストにないパッケージが必要な場合はユーザーに確認すること。"
        )
    else:
        header_pkg = "Allowed LaTeX packages (anything outside this list is blocked)"
        header_lib = "Allowed TikZ libraries"
        warn = (
            "Packages outside this list are not installed in the sandbox; any "
            "\\usepackage call referencing them will be rejected by the server. "
            "Do not add new packages without checking with the user."
        )

    pkg_lines = "\n".join(f"  - {p}" for p in pkgs)
    lib_lines = "\n".join(f"  - {lb}" for lb in libs)
    return (
        f"{header_pkg}:\n{pkg_lines}\n\n"
        f"{header_lib}:\n{lib_lines}\n\n"
        f"⚠ {warn}"
    )


class SecurityViolation(Exception):
    """セキュリティポリシー違反"""
    def __init__(self, message: str, violations: list[Violation]):
        self.message = message
        self.violations = violations
        super().__init__(message)


def _violation_already_in(violations: list[Violation], v: Violation) -> bool:
    """同じ違反が既に登録されていないか (重複防止)"""
    for existing in violations:
        if existing.get("code") != v.get("code"):
            continue
        if existing.get("package") == v.get("package") \
           and existing.get("library") == v.get("library") \
           and existing.get("command") == v.get("command"):
            return True
    return False


def format_violations(violations: list[Violation], lang: str = "ja") -> str:
    """構造化違反を 1 行の文字列に整形 (ログ・監査・例外メッセージ用)。

    フロントエンドへ送るユーザー向けメッセージはこの関数を使わず、
    violations の構造化リストをそのまま渡してクライアント側 i18n でレンダリングする。
    この関数は **ログ・監査・サーバー側例外チェーン** 専用。
    """
    if not violations:
        return ""
    parts: list[str] = []
    for v in violations[:5]:
        code = v.get("code", "unknown")
        if code == "package_not_allowed":
            parts.append(f"未許可パッケージ: {v.get('package', '?')}" if lang == "ja"
                         else f"package not allowed: {v.get('package', '?')}")
        elif code == "tikz_library_not_allowed":
            parts.append(f"未許可TikZライブラリ: {v.get('library', '?')}" if lang == "ja"
                         else f"tikz library not allowed: {v.get('library', '?')}")
        elif code == "forbidden_command":
            parts.append(f"禁止コマンド: {v.get('command', '?')}" if lang == "ja"
                         else f"forbidden command: {v.get('command', '?')}")
        elif code == "dangerous_command":
            parts.append(f"危険コマンド: {v.get('command', '?')}" if lang == "ja"
                         else f"dangerous command: {v.get('command', '?')}")
        elif code == "file_access":
            parts.append(f"ファイルアクセス: {v.get('command', '?')}" if lang == "ja"
                         else f"file access: {v.get('command', '?')}")
        else:
            parts.append(code)
    return "; ".join(parts)


def sanitize_code_field(code: str, block_type: str, advanced_mode: bool = False) -> str:
    """
    ユーザーの code フィールド (circuit/diagram/chart/code) を検査。
    危険なコマンドが含まれていたら SecurityViolation を投げる。
    """
    if not code.strip():
        return code

    violations: list[Violation] = []

    # 常に禁止するコマンドの検査
    for match in _ALWAYS_FORBIDDEN_RE.finditer(code):
        v: Violation = {"code": "forbidden_command", "command": match.group()}
        if not _violation_already_in(violations, v):
            violations.append(v)

    # 通常モードでは追加の危険コマンドも検査
    if not advanced_mode:
        forbidden_cmds = {v["command"] for v in violations if v.get("code") == "forbidden_command"}
        for match in _DANGEROUS_RE.finditer(code):
            cmd = match.group()
            if cmd in forbidden_cmds:
                continue
            v = {"code": "dangerous_command", "command": cmd}
            if not _violation_already_in(violations, v):
                violations.append(v)

    # usepackage の検出 (code フィールド内での直接使用は禁止)
    pkg_matches = re.findall(r'\\usepackage(?:\[.*?\])?\{([^}]+)\}', code)
    for pkg_str in pkg_matches:
        for pkg in pkg_str.split(","):
            pkg = pkg.strip()
            if pkg and pkg not in ALLOWED_PACKAGES:
                violations.append({"code": "package_not_allowed", "package": pkg})

    if violations:
        raise SecurityViolation(
            f"セキュリティポリシー違反 ({block_type}): " + format_violations(violations),
            violations,
        )

    return code


def validate_latex_security(latex_source: str) -> list[Violation]:
    """
    raw LaTeX 文字列をスキャンし、セキュリティ違反を収集。
    違反があっても例外は投げず、構造化された違反リストを返す。
    """
    violations: list[Violation] = []
    if not latex_source:
        return violations

    # 常に禁止されるコマンド
    for match in _ALWAYS_FORBIDDEN_RE.finditer(latex_source):
        v: Violation = {"code": "forbidden_command", "command": match.group()}
        if not _violation_already_in(violations, v):
            violations.append(v)

    # 既に forbidden_command として登録済みのコマンド名集合
    # (\directlua 等は ALWAYS_FORBIDDEN と DANGEROUS_COMMANDS の両方にあるため、
    #  二重通知を避ける)
    forbidden_cmds = {v["command"] for v in violations if v.get("code") == "forbidden_command"}

    # 危険コマンド (ファイルアクセス系など)
    for match in _DANGEROUS_RE.finditer(latex_source):
        cmd = match.group()
        if cmd in forbidden_cmds:
            continue
        v = {"code": "dangerous_command", "command": cmd}
        if not _violation_already_in(violations, v):
            violations.append(v)

    # usepackage ホワイトリスト
    pkg_matches = re.findall(r'\\usepackage(?:\[.*?\])?\{([^}]+)\}', latex_source)
    for pkg_str in pkg_matches:
        for pkg in pkg_str.split(","):
            pkg = pkg.strip()
            if pkg and pkg not in ALLOWED_PACKAGES:
                v = {"code": "package_not_allowed", "package": pkg}
                if not _violation_already_in(violations, v):
                    violations.append(v)

    # tikz library ホワイトリスト
    lib_matches = re.findall(r'\\usetikzlibrary\{([^}]+)\}', latex_source)
    for lib_str in lib_matches:
        for lib in lib_str.split(","):
            lib = lib.strip()
            if lib and lib not in ALLOWED_TIKZ_LIBRARIES:
                v = {"code": "tikz_library_not_allowed", "library": lib}
                if not _violation_already_in(violations, v):
                    violations.append(v)

    return violations


def validate_custom_preamble(preamble: str) -> list[Violation]:
    """
    上級者モードのカスタムプリアンブルを検証。
    許可: \\newcommand, \\renewcommand, \\DeclareMathOperator,
          \\usepackage (許可リスト内のみ), \\usetikzlibrary (許可リスト内のみ)
    """
    violations: list[Violation] = []

    # 常に禁止されるコマンドのチェック
    for match in _ALWAYS_FORBIDDEN_RE.finditer(preamble):
        violations.append({"code": "forbidden_command", "command": match.group()})

    # \input, \include 等の禁止
    file_access = re.findall(r'\\(input|include|openin|openout)\b', preamble)
    for cmd in file_access:
        violations.append({"code": "file_access", "command": f"\\{cmd}"})

    # usepackage チェック
    pkg_matches = re.findall(r'\\usepackage(?:\[.*?\])?\{([^}]+)\}', preamble)
    for pkg_str in pkg_matches:
        for pkg in pkg_str.split(","):
            pkg = pkg.strip()
            if pkg and pkg not in ALLOWED_PACKAGES:
                violations.append({"code": "package_not_allowed", "package": pkg})

    # tikz library チェック
    lib_matches = re.findall(r'\\usetikzlibrary\{([^}]+)\}', preamble)
    for lib_str in lib_matches:
        for lib in lib_str.split(","):
            lib = lib.strip()
            if lib and lib not in ALLOWED_TIKZ_LIBRARIES:
                violations.append({"code": "tikz_library_not_allowed", "library": lib})

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


def get_preview_compile_args(base_cmd: str, output_dir: str, tex_path: str) -> list[str]:
    """
    プレビュー専用のコンパイル引数。
    -file-line-error を除いて ! 形式のエラーログを維持し、
    テンポラリパスがエラーメッセージに露出しないようにする。
    """
    return [
        base_cmd,
        "--no-shell-escape",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-output-directory", output_dir,
        tex_path,
    ]


def validate_latex_size(latex_source: str, max_chars: int = 1_000_000) -> Optional[str]:
    """raw LaTeX のサイズ制限チェック"""
    if not latex_source:
        return None
    if len(latex_source) > max_chars:
        return f"LaTeXソースが上限({max_chars:,}文字)を超えています: {len(latex_source):,}"
    return None

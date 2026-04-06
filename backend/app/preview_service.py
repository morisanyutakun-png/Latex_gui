"""
ブロックプレビューサービス: LaTeXブロック → SVG画像
回路図・ダイアグラム等のリアルタイムプレビュー用

LuaLaTeX 専用版:
  - lualatex → PDF → pdftocairo → SVG
  - インメモリ LRU キャッシュ (同一コードの再コンパイル回避)
"""
import re
import subprocess
import tempfile
import hashlib
import logging
import shutil
from pathlib import Path

from .tex_env import TEX_ENV, LUALATEX_CMD, PDFTOCAIRO_CMD, DVISVGM_CMD
from .security import sanitize_code_field, SecurityViolation, get_preview_compile_args
from .cache_service import get_cached_svg, store_cached_svg
from .audit import log_compile_event, log_security_event, AuditEvent

logger = logging.getLogger(__name__)

# LRU cache for compiled SVGs (up to 128 entries)
_svg_cache: dict[str, str] = {}
MAX_CACHE = 128


# standalone+varwidth プレビューに持ち込んでも意味がない / 干渉する
# コマンド名のリスト。`\<name>` 直後の `[opt]` と `{...}` (ネスト対応) を
# 全て飲み込む。`*` バリアントも対象。
_STRIP_COMMANDS = {
    # ページレイアウト
    "geometry",
    "pagestyle", "thispagestyle",
    # fancyhdr
    "fancyhf", "fancyhead", "fancyfoot",
    # hyperref
    "hypersetup",
    # titlesec (\titleformat / \titlespacing — \titlespacing* 形式も対象)
    "titleformat", "titlespacing",
    # 長さ系 (\setlength は専用ハンドラで判定)
    # \renewcommand は専用ハンドラで判定 (\newcommand はユーザマクロなので残す)
}

# 取り除く対象の \usepackage{NAME} (NAME 単体)
_STRIP_PACKAGES = {"hyperref", "geometry", "fancyhdr"}

# \renewcommand 等を取り除く対象。設定したいマクロ名のセット (引数 1 つ目が \name)。
_STRIP_RENEW_TARGETS = {
    "headrulewidth", "footrulewidth",
    "baselinestretch",
    "thesection", "thesubsection", "thesubsubsection",
}


def _skip_optional_arg(s: str, i: int) -> int:
    """`[...]` を飲み込んで終了位置を返す。`[` でなければ i を返す。"""
    n = len(s)
    if i >= n or s[i] != "[":
        return i
    depth = 0
    while i < n:
        c = s[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def _skip_brace_group(s: str, i: int) -> int:
    """`{...}` を飲み込んで終了位置を返す。ネストとエスケープに対応。
    `{` でなければ i を返す。"""
    n = len(s)
    if i >= n or s[i] != "{":
        return i
    depth = 0
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            # \{ や \} を飛ばす
            i += 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def _skip_whitespace(s: str, i: int) -> int:
    n = len(s)
    while i < n and s[i] in " \t":
        i += 1
    return i


def _peek_brace_arg(s: str, i: int) -> tuple[str, int]:
    """`{NAME}` または `\\NAME` を読み取り、(NAME, 終了位置) を返す。
    マッチしなければ ('', i)。"""
    i = _skip_whitespace(s, i)
    n = len(s)
    if i >= n:
        return "", i
    if s[i] == "{":
        end = _skip_brace_group(s, i)
        inner = s[i + 1:end - 1].strip()
        # \name 形式なら name を返す
        if inner.startswith("\\"):
            return inner[1:].split("{")[0].split("[")[0], end
        return inner, end
    if s[i] == "\\":
        # \name 形式 (中括弧なし)
        j = i + 1
        while j < n and (s[j].isalpha() or s[j] == "@"):
            j += 1
        return s[i + 1:j], j
    return "", i


def _sanitize_preamble_for_preview(preamble: str) -> str:
    """文書全体用に書かれたプリアンブルから、standalone+varwidth で意味がない
    / 害になる宣言だけを取り除く。残った宣言 (\\usepackage / \\newcommand 等)
    はそのまま使う。

    ネストした中括弧 (`\\fancyfoot[C]{\\textcolor{gray}{...}}`) も
    バランスを取りながら正確に削除する。
    """
    if not preamble:
        return ""

    s = preamble
    out: list[str] = []
    i = 0
    n = len(s)

    while i < n:
        # `\` で始まらないコマンドはそのまま流す
        if s[i] != "\\":
            out.append(s[i])
            i += 1
            continue

        # コマンド名を読む
        j = i + 1
        while j < n and (s[j].isalpha() or s[j] == "@"):
            j += 1
        cmd_base = s[i + 1:j]
        # `\titlespacing*` の `*` を飲み込む
        if j < n and s[j] == "*":
            j += 1

        # \usepackage[opt]{name} の特別扱い: name が strip 対象なら削除
        if cmd_base == "usepackage":
            after = _skip_optional_arg(s, j)
            arg_name, end = _peek_brace_arg(s, after)
            # 複数パッケージ ("hyperref,xcolor") にも対応
            pkgs = [p.strip() for p in arg_name.split(",") if p.strip()]
            if pkgs and all(p in _STRIP_PACKAGES for p in pkgs):
                i = end
                continue
            # 一部だけ strip 対象なら、strip しないものだけ残した \usepackage を再構築
            keep = [p for p in pkgs if p not in _STRIP_PACKAGES]
            if keep and len(keep) != len(pkgs):
                # オプション引数を保持
                opt = s[j:after] if after > j else ""
                out.append("\\usepackage" + opt + "{" + ",".join(keep) + "}")
                i = end
                continue
            # 通常: そのまま流す
            out.append(s[i:j])
            i = j
            continue

        # \renewcommand{\headrulewidth}{...} の特別扱い
        # (\newcommand はユーザーマクロなので絶対に残す)
        if cmd_base == "renewcommand":
            after = _skip_optional_arg(s, j)
            target_name, after2 = _peek_brace_arg(s, after)
            if target_name in _STRIP_RENEW_TARGETS:
                # 残りの引数 ([opt] や {value}) も飲み込む
                k = _skip_optional_arg(s, after2)
                k = _skip_brace_group(s, _skip_whitespace(s, k))
                i = k
                continue
            # 対象外 — そのまま流す
            out.append(s[i:j])
            i = j
            continue

        # \setlength{\textwidth}{...} 等
        if cmd_base == "setlength" or cmd_base == "addtolength":
            after = _skip_optional_arg(s, j)
            target_name, after2 = _peek_brace_arg(s, after)
            page_lengths = {
                "paperwidth", "paperheight",
                "textwidth", "textheight",
                "topmargin", "oddsidemargin", "evensidemargin",
                "headheight", "headsep", "footskip",
                "marginparwidth", "marginparsep",
            }
            if target_name in page_lengths:
                k = _skip_brace_group(s, _skip_whitespace(s, after2))
                i = k
                continue
            out.append(s[i:j])
            i = j
            continue

        # 単純な strip コマンド: 直後の [opt] と {arg} (ネスト対応) を飲み込む
        if cmd_base in _STRIP_COMMANDS:
            k = _skip_optional_arg(s, j)
            # コマンドによっては引数が複数 (\titleformat は 5つ, \titlespacing は 4つ)
            arg_counts = {
                "titleformat": 5,
                "titlespacing": 4,
                "fancyhf": 1, "fancyhead": 1, "fancyfoot": 1,
                "hypersetup": 1,
                "geometry": 1,
                "pagestyle": 1, "thispagestyle": 1,
            }
            arg_count = arg_counts.get(cmd_base, 1)
            for _ in range(arg_count):
                k = _skip_optional_arg(s, _skip_whitespace(s, k))
                k = _skip_brace_group(s, _skip_whitespace(s, k))
            i = k
            continue

        # その他のコマンドはそのまま流す
        out.append(s[i:j])
        i = j

    cleaned = "".join(out)
    # 連続改行を整理
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# 単体プレビューでブロック先頭・末尾にあると視覚的にズレる空白指定。
# (実 PDF 出力時には残るが、プレビューでは取り除いて中身だけが見えるようにする)
_BLOCK_CODE_TRIM_PATTERNS = [
    re.compile(r"^(?:\s*\\(?:vspace\*?|vfill|bigskip|medskip|smallskip|newpage|clearpage|pagebreak|noindent)\s*(?:\{[^}]*\})?\s*)+", re.MULTILINE),
    re.compile(r"(?:\s*\\(?:vspace\*?|vfill|bigskip|medskip|smallskip|newpage|clearpage|pagebreak)\s*(?:\{[^}]*\})?\s*)+\s*\Z"),
]


def _trim_block_code_for_preview(code: str) -> str:
    """ブロック先頭・末尾の vspace/vfill/newpage 等を取り除き、
    プレビューが空白だらけにならないようにする。"""
    if not code:
        return code
    trimmed = code
    for pat in _BLOCK_CODE_TRIM_PATTERNS:
        trimmed = pat.sub("", trimmed)
    return trimmed.strip() or code  # 全部消えてしまったら原文を返す


def _fix_display_math_in_tcolorbox_options(code: str) -> str:
    r"""tcolorbox の [...] オプション引数内に \[...\] が含まれると
    'LaTeX Error: Something's wrong--perhaps a miss' が発生する。
    オプション引数内では display math は使えないため \[...\] を \(...\) に置換する。

    アルゴリズム: 文字列を走査して \begin{tcolorbox}[ の直後から
    ブレース深さを追跡しながら対応する ] を探し、その範囲だけ置換する。
    ネストした波括弧 (title={...}) は正しく追跡するため誤置換しない。
    """
    out: list[str] = []
    i = 0
    n = len(code)
    marker = "\\begin{tcolorbox}["

    while i < n:
        idx = code.find(marker, i)
        if idx == -1:
            out.append(code[i:])
            break
        # marker 前をそのまま追加
        out.append(code[i : idx + len(marker)])
        j = idx + len(marker)
        opt_start = j
        brace_depth = 0
        # ブレース深さを追いながら対応する ] を探す
        while j < n:
            c = code[j]
            if c == "{":
                brace_depth += 1
            elif c == "}" and brace_depth > 0:
                brace_depth -= 1
            elif c == "]" and brace_depth == 0:
                break
            j += 1
        # オプション範囲内の \[ と \] を \( と \) に置換
        opts = code[opt_start:j]
        opts = opts.replace("\\[", "\\(").replace("\\]", "\\)")
        out.append(opts)
        out.append("]" if j < n else "")
        i = j + 1

    return "".join(out)


_PREVIEW_WRAP_VERSION = "v5"  # _wrap_block_latex のロジック変更時にバンプ → 古いキャッシュを無効化


# -file-line-error フラグによるエラー行プレフィックス: `/path/to/file.tex:NN: `
_FILE_LINE_PREFIX = re.compile(r'^(?:[^\s:]+\.tex|/[^\s]+\.tex):\d+:\s*')


def _strip_file_line_prefix(s: str) -> str:
    """filepath:line: プレフィックスを取り除いてエラー本文だけ返す。"""
    return _FILE_LINE_PREFIX.sub("", s).strip()


def _parse_preview_error(log: str) -> str:
    """LaTeXログからプレビュー向けエラーメッセージを生成。

    -file-line-error フォーマット (path:line: error) と
    従来の ! 形式の両方に対応し、テンポラリパスはユーザーに見せない。
    """
    log_lower = log.lower()

    # -file-line-error 形式と ! 形式の両方を収集し、パスを除去してエラー本文だけ取得
    errors: list[str] = []
    for line in log.split("\n"):
        s = line.strip()
        if s.startswith("!"):
            errors.append(s[1:].strip())
        elif _FILE_LINE_PREFIX.match(s):
            errors.append(_strip_file_line_prefix(s))

    error_detail = errors[0] if errors else ""

    # どちらの形式でも取れなかった場合のフォールバック
    if not error_detail:
        for line in log.split("\n"):
            s = line.strip()
            if ("fatal" in s.lower() or "error" in s.lower()) and 10 < len(s) < 200:
                error_detail = _strip_file_line_prefix(s)
                break

    # 既知エラーパターンへの日本語マッピング
    if "something's wrong" in log_lower or "perhaps a miss" in log_lower:
        return "数式環境の構造に問題があります（\\[ \\] の対応や tcolorbox 内での使い方を確認してください）"
    if "undefined control sequence" in log_lower:
        return f"未定義のコマンドがあります。({error_detail})"
    if "missing $ inserted" in log_lower:
        return "数式記号の処理でエラーが発生しました。"
    if "luatexja" in log_lower and "not found" in log_lower:
        return "luatexjaパッケージが見つかりません。TeX Live を確認してください。"
    if "fontspec error" in log_lower or ("fontspec" in log_lower and "not found" in log_lower):
        return f"フォントの読み込みに問題があります。({error_detail})"
    if "emergency stop" in log_lower:
        return f"重大なエラーが発生しました。({error_detail})"
    if "file not found" in log_lower:
        return f"必要なファイルが見つかりません。({error_detail})"
    if "package not found" in log_lower or "no file" in log_lower:
        return f"パッケージが見つかりません。({error_detail})"
    if "runaway argument" in log_lower:
        return f"引数の構造に問題があります（波括弧の対応を確認してください）。({error_detail})"
    if error_detail:
        return f"コンパイルエラー: {error_detail}"

    # 最終フォールバック: ログ末尾の意味のある行を返す
    meaningful = [l.strip() for l in log.split("\n") if l.strip() and not l.startswith("(")]
    tail = "; ".join(meaningful[-4:])[:300]
    return f"コンパイルエラー: {tail}" if tail else "コンパイルエラー: 原因不明"


def _get_cache_key(code: str, block_type: str, extra: str = "") -> str:
    """Generate a cache key from code + type (+ optional extra context)."""
    return hashlib.md5(f"{_PREVIEW_WRAP_VERSION}:{block_type}:{extra}:{code}".encode()).hexdigest()


def preview_block_svg(
    code: str,
    block_type: str,
    caption: str = "",
    custom_preamble: str = "",
    custom_commands: list[str] | None = None,
) -> str:
    """
    Compile a LaTeX block to SVG for preview.
    Returns SVG string or raises an exception on failure.

    custom_preamble / custom_commands are injected into the standalone
    preamble for `latex` blocks so that previews respect any \\newcommand
    or \\usepackage defined in the document's advanced hooks.
    """
    if not code.strip():
        return ""

    # 上級者モードのプリアンブルが指定されている場合のみ、コードフィールドの
    # セキュリティ検査を緩める (preamble 側で別途検証する)
    advanced_mode = bool(custom_preamble.strip()) or bool(custom_commands)

    # セキュリティ検査
    try:
        sanitize_code_field(code, block_type, advanced_mode=advanced_mode)
    except SecurityViolation as e:
        log_security_event(e.violations, block_type=block_type, action="blocked")
        raise RuntimeError(f"セキュリティポリシー違反: {e.message}")

    # キャッシュキーは preamble/commands + wrap version もハッシュに含める
    extra = _PREVIEW_WRAP_VERSION
    if custom_preamble or custom_commands:
        extra += ":" + hashlib.md5(
            (custom_preamble + "|" + "\n".join(custom_commands or [])).encode()
        ).hexdigest()

    # ディスクベースキャッシュチェック (preamble 込み)
    cached = get_cached_svg(code, block_type + ":" + extra)
    if cached:
        return cached

    # インメモリキャッシュチェック (後方互換)
    cache_key = _get_cache_key(code, block_type, extra)
    if cache_key in _svg_cache:
        return _svg_cache[cache_key]

    latex_source = _wrap_block_latex(
        code, block_type, custom_preamble=custom_preamble, custom_commands=custom_commands
    )
    svg = _compile_to_svg(latex_source)

    # ディスク + インメモリ両方にキャッシュ
    store_cached_svg(code, block_type + ":" + extra, svg)
    if len(_svg_cache) >= MAX_CACHE:
        oldest = next(iter(_svg_cache))
        del _svg_cache[oldest]
    _svg_cache[cache_key] = svg

    return svg


def _wrap_block_latex(
    code: str,
    block_type: str,
    custom_preamble: str = "",
    custom_commands: list[str] | None = None,
) -> str:
    """Wrap block code in a minimal standalone LaTeX document."""

    if block_type == "latex":
        # 生LaTeXブロック専用: varwidth を使わず固定テキスト幅で立ち上げる。
        # varwidth + tcolorbox は幅計算が競合してコンパイル失敗する既知の問題がある。
        # luatexja-preset を最初にロードしてフォント環境を確立してから
        # tcolorbox[most]（全ライブラリ込み）をロードする順序が必須。
        preamble_lines = [
            "\\documentclass[border=4mm]{standalone}",  # varwidth なし
            "\\usepackage{luatexja}",
            "\\usepackage[haranoaji]{luatexja-preset}",
            # tcolorbox が \textwidth を参照できるよう A4 相当の幅を明示設定
            "\\setlength{\\textwidth}{160mm}",
            "\\setlength{\\linewidth}{160mm}",
            "\\usepackage[most]{tcolorbox}",            # 全ライブラリ (skins/breakable 含む)
            # standalone ではページ分割不要 — breakable が shipout フックと衝突する既知問題を回避
            "\\tcbset{breakable=false}",
            "\\usepackage{amsmath,amssymb}",
            "\\usepackage{xcolor}",
            "\\usepackage{multicol}",
            "\\usepackage{booktabs}",
            "\\usepackage{enumitem}",
            "\\usepackage{tikz}",
            "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,"
            "decorations.markings,automata,fit,patterns,backgrounds}",
        ]
        # tcolorbox オプション内の \[...\] を \(...\) に変換 (display math はオプション引数不可)
        sanitized_code = _fix_display_math_in_tcolorbox_options(code)
        # 単体プレビューでブロック先頭・末尾の余白指定を取り除く
        body = _trim_block_code_for_preview(sanitized_code)
    else:
        # 図形系ブロック: varwidth でコンテンツに合わせてサイズ自動調整
        preamble_lines = [
            "\\documentclass[border=5pt,varwidth]{standalone}",
            "\\usepackage{tikz}",
        ]
        if block_type == "circuit":
            preamble_lines.append("\\usepackage{circuitikz}")
            preamble_lines.append(
                "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,"
                "decorations.markings,automata,fit}"
            )
            body = (
                "\\begin{circuitikz}[american]\n"
                f"{code}\n"
                "\\end{circuitikz}"
            )
        elif block_type == "diagram":
            preamble_lines.append(
                "\\usetikzlibrary{shapes,arrows.meta,positioning,calc,"
                "decorations.markings,automata,fit}"
            )
            body = (
                "\\begin{tikzpicture}\n"
                f"{code}\n"
                "\\end{tikzpicture}"
            )
        elif block_type == "chart":
            preamble_lines.append("\\usepackage{pgfplots}")
            preamble_lines.append("\\pgfplotsset{compat=1.18}")
            body = (
                "\\begin{tikzpicture}\n"
                "\\begin{axis}[grid=major]\n"
                f"{code}\n"
                "\\end{axis}\n"
                "\\end{tikzpicture}"
            )
        else:
            body = code

    # 上級者モードのカスタムプリアンブル / マクロ定義を追記
    # → 文書全体コンパイルと同じ環境でブロック単体プレビューを実行できる
    # ただし standalone に持ち込むと害になる宣言 (\geometry, \pagestyle,
    # \hypersetup, titlesec 等) は黙って取り除く
    if custom_preamble and custom_preamble.strip():
        sanitized = _sanitize_preamble_for_preview(custom_preamble)
        if sanitized:
            preamble_lines.append(sanitized)
    if custom_commands:
        for cmd in custom_commands:
            if isinstance(cmd, str) and cmd.strip():
                preamble_lines.append(_sanitize_preamble_for_preview(cmd) or cmd.strip())

    preamble = "\n".join(preamble_lines)
    return f"{preamble}\n\\begin{{document}}\n{body}\n\\end{{document}}"


def _compile_to_svg(latex_source: str) -> str:
    """Compile LaTeX source to SVG (browser-independent).

    Pipeline: lualatex → PDF → dvisvgm(--no-fonts) → SVG
    --no-fonts でテキストをパスに変換し、ブラウザのフォント環境に依存しない。
    フォールバック: pdftocairo PNG → base64 data URL
    """
    import base64

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "preview.tex"
        pdf_path = Path(tmpdir) / "preview.pdf"
        svg_path = Path(tmpdir) / "preview.svg"

        tex_path.write_text(latex_source, encoding="utf-8")

        # Step 1: Compile LaTeX → PDF (lualatex)
        try:
            cmd_args = get_preview_compile_args(
                LUALATEX_CMD,
                str(tmpdir),
                str(tex_path),
            )
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                text=True,
                timeout=15,
                cwd=tmpdir,
                env=TEX_ENV,
            )
        except FileNotFoundError:
            raise RuntimeError("lualatex not found")
        except subprocess.TimeoutExpired:
            raise RuntimeError("LaTeX compilation timeout")

        if result.returncode != 0 or not pdf_path.exists():
            log = result.stdout + "\n" + result.stderr
            error_msg = _parse_preview_error(log)
            logger.error(f"Preview compilation failed: {error_msg}")
            raise RuntimeError(error_msg)

        # Step 2: PDF → SVG (dvisvgm 優先 — --no-fonts でブラウザ非依存)
        # dvisvgm は全テキストをSVGパスに変換するため、CJKフォント問題が発生しない
        if DVISVGM_CMD:
            try:
                result = subprocess.run(
                    [DVISVGM_CMD, "--pdf", "--no-fonts", "--exact-bbox",
                     "-o", str(svg_path), str(pdf_path)],
                    capture_output=True, text=True, timeout=10,
                    cwd=tmpdir, env=TEX_ENV,
                )
                if result.returncode == 0 and svg_path.exists():
                    svg_content = svg_path.read_text(encoding="utf-8")
                    if svg_content.strip():
                        logger.info("Preview SVG generated via dvisvgm (no-fonts)")
                        return svg_content
                logger.warning(f"dvisvgm failed (rc={result.returncode}): {result.stderr[:200]}")
            except Exception as e:
                logger.warning(f"dvisvgm error: {e}")

        # Fallback: pdftocairo → PNG → base64 (フォント問題を完全回避)
        if PDFTOCAIRO_CMD and shutil.which(PDFTOCAIRO_CMD):
            try:
                png_prefix = str(Path(tmpdir) / "preview")
                result = subprocess.run(
                    [PDFTOCAIRO_CMD, "-png", "-r", "200", "-singlefile",
                     str(pdf_path), png_prefix],
                    capture_output=True, text=True, timeout=5,
                    cwd=tmpdir, env=TEX_ENV,
                )
                png_path = Path(tmpdir) / "preview.png"
                if result.returncode == 0 and png_path.exists():
                    import struct
                    png_bytes = png_path.read_bytes()
                    b64 = base64.b64encode(png_bytes).decode("ascii")
                    # PNGヘッダから実際の寸法を読み取る (IHDRチャンク)
                    try:
                        if len(png_bytes) >= 24 and png_bytes[:8] == b'\x89PNG\r\n\x1a\n':
                            png_w = struct.unpack('>I', png_bytes[16:20])[0]
                            png_h = struct.unpack('>I', png_bytes[20:24])[0]
                        else:
                            png_w, png_h = 800, 600
                    except Exception:
                        png_w, png_h = 800, 600
                    # SVG でラップして既存のフロントエンドと互換性を保つ
                    svg_wrapper = (
                        f'<svg xmlns="http://www.w3.org/2000/svg" '
                        f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                        f'viewBox="0 0 {png_w} {png_h}" '
                        f'width="{png_w}" height="{png_h}">'
                        f'<image width="{png_w}" height="{png_h}" '
                        f'href="data:image/png;base64,{b64}" />'
                        f'</svg>'
                    )
                    logger.info("Preview generated via pdftocairo PNG fallback")
                    return svg_wrapper
                logger.warning(f"pdftocairo PNG failed: {result.stderr[:200]}")
            except Exception as e:
                logger.warning(f"pdftocairo PNG error: {e}")

        # Last resort: pdftocairo SVG (フォント依存だが動作はする)
        if PDFTOCAIRO_CMD and shutil.which(PDFTOCAIRO_CMD):
            try:
                result = subprocess.run(
                    [PDFTOCAIRO_CMD, "-svg", str(pdf_path), str(svg_path)],
                    capture_output=True, text=True, timeout=5,
                    cwd=tmpdir, env=TEX_ENV,
                )
                if result.returncode == 0 and svg_path.exists():
                    logger.warning("Preview SVG via pdftocairo (font-dependent, may garble CJK)")
                    return svg_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"pdftocairo SVG error: {e}")

        raise RuntimeError("SVG変換に失敗しました")


def clear_preview_cache():
    """Clear the SVG preview cache."""
    _svg_cache.clear()

"""LaTeX 自動修復レイヤ — AI 出力 / 手書き LaTeX を最大限コンパイル可能に整える。

設計方針:
  1. **非破壊**: 失敗しても元のソースを返すだけ。
  2. **段階的**: ① 表面的な置換 (全角・スマートクォート etc.)
                ② 「未定義コマンド」がよく属するパッケージを自動 \\usepackage 注入
                ③ コンパイルログを見て不足パッケージ / 未定義コマンドを 1 ラウンドだけ追加修復。
  3. **allowlist 内**: 自動注入は security.ALLOWED_PACKAGES に含まれるものに限る。
  4. **テンプレ尊重**: 既に \\usepackage{...} で読み込まれているものは触らない。
                   日本語/英語の言語スキームを途中で切り替えない。

公開関数:
  - autofix_latex(src) -> str
        コンパイル前に呼ぶ「軽量サニタイズ + パッケージ補完」。
  - autofix_after_failure(src, log) -> str | None
        コンパイル失敗ログを見て追加で修復したソースを返す。修復不能なら None。
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from .security import ALLOWED_PACKAGES

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# 1. 表面的な文字置換 (AI が混入させがちな全角 / 特殊記号)
# ─────────────────────────────────────────────────────────────
#
# 注意: 数式モード ($...$, \[...\], \begin{equation}...) の中までは触らない。
# Python の正規表現で簡易的に「外側だけ置換」する。
#
# - スマートクォート → 通常クォート
# - 全角ハイフン → "-"
# - U+2212 (MINUS SIGN) → "-"
# - NBSP → スペース
# - 全角スペース → "\\ " (LaTeX のエスケープスペース) ではなく半角スペース
#
# テキスト部分のみに適用するため、まず数式塊を退避してから戻す。

_TEXT_REPLACEMENTS = {
    "\u2018": "'",   # ‘
    "\u2019": "'",   # ’
    "\u201C": "``",  # “
    "\u201D": "''",  # ”
    "\u2013": "--",  # – en-dash
    "\u2014": "---", # — em-dash
    "\u2212": "-",   # − minus sign
    "\u00A0": " ",   # NBSP
    "\u200B": "",    # ZWSP
    "\uFEFF": "",    # BOM
}

# 数式モードを退避するためのプレースホルダ。NUL バイト + sentinel を使う。
_MATH_SENTINEL = "\x00MATH{n}\x00"

# 数式環境名 — このいずれかに包まれた塊は文字置換から除外する
_MATH_ENV_NAMES = (
    "equation", "equation*",
    "align", "align*",
    "gather", "gather*",
    "multline", "multline*",
    "eqnarray", "eqnarray*",
    "displaymath",
)

# 各環境ごとに別パターンを並べる (バックリファレンスを避けるため)
_MATH_ENV_ALT = "|".join(
    rf"\\begin\{{{re.escape(env)}\}}.*?\\end\{{{re.escape(env)}\}}"
    for env in _MATH_ENV_NAMES
)

_MATH_RE = re.compile(
    r"(\$\$.+?\$\$"          # display $$ ... $$
    r"|\\\[.+?\\\]"           # display \[ ... \]
    r"|\$(?:\\.|[^$])+?\$"    # inline $ ... $
    rf"|{_MATH_ENV_ALT}"
    r")",
    re.DOTALL,
)


def _strip_math(src: str) -> tuple[str, list[str]]:
    """数式塊をプレースホルダに退避し (text, math_list) を返す。"""
    math: list[str] = []

    def _sub(m: re.Match) -> str:
        idx = len(math)
        math.append(m.group(0))
        return _MATH_SENTINEL.format(n=idx)

    text = _MATH_RE.sub(_sub, src)
    return text, math


def _restore_math(text: str, math: list[str]) -> str:
    for i, m in enumerate(math):
        text = text.replace(_MATH_SENTINEL.format(n=i), m)
    return text


def _normalize_text_chars(src: str) -> str:
    """テキスト部分の全角・スマートクォート等を ASCII に正規化する。"""
    if not src:
        return src
    text, math = _strip_math(src)
    for k, v in _TEXT_REPLACEMENTS.items():
        if k in text:
            text = text.replace(k, v)
    return _restore_math(text, math)


# ─────────────────────────────────────────────────────────────
# 2. コマンド → 必要パッケージ マッピング
# ─────────────────────────────────────────────────────────────
#
# 「このコマンド/環境を使うなら、このパッケージが \usepackage されている必要がある」
# 一覧。AI が自然に書いてしまうものを中心に登録。値は必ず ALLOWED_PACKAGES に
# 含まれるものに限る (allowlist の外側は load しない)。

_COMMAND_TO_PACKAGE: dict[str, str] = {
    # ── 数式系 ──
    r"\text": "amsmath",
    r"\dfrac": "amsmath",
    r"\tfrac": "amsmath",
    r"\binom": "amsmath",
    r"\boxed": "amsmath",
    r"\xrightarrow": "amsmath",
    r"\xleftarrow": "amsmath",
    r"\substack": "amsmath",
    r"\overset": "amsmath",
    r"\underset": "amsmath",
    r"\eqref": "amsmath",
    r"\therefore": "amssymb",
    r"\because": "amssymb",
    r"\mathbb": "amssymb",
    r"\mathfrak": "amssymb",
    r"\checkmark": "amssymb",
    r"\square": "amssymb",
    r"\blacksquare": "amssymb",
    r"\varnothing": "amssymb",
    r"\nmid": "amssymb",
    r"\nleq": "amssymb",
    r"\ngeq": "amssymb",
    r"\bm": "bm",
    r"\boldsymbol": "bm",
    r"\cancel": "cancel",
    r"\bcancel": "cancel",
    r"\xcancel": "cancel",
    r"\cancelto": "cancel",
    r"\SI": "siunitx",
    r"\si": "siunitx",
    r"\num": "siunitx",
    r"\ang": "siunitx",
    r"\qty": "siunitx",
    r"\pdv": "physics",
    r"\dv": "physics",
    r"\bra": "physics",
    r"\ket": "physics",
    r"\braket": "physics",
    r"\nicefrac": "nicefrac",
    r"\sfrac": "xfrac",
    # ── 表 / 罫線 ──
    r"\toprule": "booktabs",
    r"\midrule": "booktabs",
    r"\bottomrule": "booktabs",
    r"\cmidrule": "booktabs",
    r"\specialrule": "booktabs",
    r"\multirow": "multirow",
    r"\diagbox": "diagbox",
    r"\makecell": "makecell",
    # ── 図 ──
    r"\includegraphics": "graphicx",
    r"\rotatebox": "graphicx",
    r"\scalebox": "graphicx",
    r"\resizebox": "graphicx",
    r"\subcaption": "subcaption",
    r"\subfloat": "subcaption",
    r"\wrapfigure": "wrapfig",
    r"\begin{wrapfigure}": "wrapfig",
    # ── tcolorbox / 装飾 ──
    r"\tcbox": "tcolorbox",
    r"\tcolorbox": "tcolorbox",
    r"\begin{tcolorbox}": "tcolorbox",
    # ── ハイパーリンク ──
    r"\url": "url",
    r"\href": "hyperref",
    r"\hyperref": "hyperref",
    # ── 色 ──
    r"\textcolor": "xcolor",
    r"\colorbox": "xcolor",
    r"\definecolor": "xcolor",
    r"\color": "xcolor",
    r"\rowcolor": "colortbl",
    r"\columncolor": "colortbl",
    r"\cellcolor": "colortbl",
    # ── 化学 ──
    r"\ce": "mhchem",
    r"\chemfig": "chemfig",
    # ── tikz / pgf ──
    r"\begin{tikzpicture}": "tikz",
    r"\tikz": "tikz",
    r"\begin{circuitikz}": "circuitikz",
    r"\begin{axis}": "pgfplots",
    r"\addplot": "pgfplots",
    # ── enumitem ──
    r"\setlist": "enumitem",
    # ── multicol ──
    r"\begin{multicols}": "multicol",
    # ── code ──
    r"\lstinline": "listings",
    r"\begin{lstlisting}": "listings",
    # ── 取消線・下線 ──
    r"\sout": "ulem",
    r"\uline": "ulem",
    r"\uwave": "ulem",
    r"\xout": "ulem",
    r"\hl": "soul",
    # ── レイアウト ──
    r"\onehalfspacing": "setspace",
    r"\doublespacing": "setspace",
    r"\singlespacing": "setspace",
    r"\titleformat": "titlesec",
    r"\titlespacing": "titlesec",
    r"\fancyhead": "fancyhdr",
    r"\fancyfoot": "fancyhdr",
    r"\pagestyle{fancy}": "fancyhdr",
    r"\Centering": "ragged2e",
    r"\RaggedLeft": "ragged2e",
    r"\RaggedRight": "ragged2e",
    # ── lipsum (テスト用) ──
    r"\lipsum": "lipsum",
    r"\blindtext": "blindtext",
    # ── QR / アイコン ──
    r"\qrcode": "qrcode",
    r"\faIcon": "fontawesome5",
    # ── 数式記号: physics (一部) ──
    r"\abs": "physics",
    r"\norm": "physics",
}

# 環境 → パッケージ (\begin{env} 形式が登場したら必要)
_ENV_TO_PACKAGE: dict[str, str] = {
    "align": "amsmath",
    "align*": "amsmath",
    "gather": "amsmath",
    "gather*": "amsmath",
    "multline": "amsmath",
    "multline*": "amsmath",
    "cases": "amsmath",
    "split": "amsmath",
    "tikzpicture": "tikz",
    "circuitikz": "circuitikz",
    "axis": "pgfplots",
    "tabularx": "tabularx",
    "longtable": "longtable",
    "wraptable": "wrapfig",
    "wrapfigure": "wrapfig",
    "tcolorbox": "tcolorbox",
    "lstlisting": "listings",
    "minted": "minted",
    "multicols": "multicol",
    "enumerate": "enumitem",   # enumerate[label=...] 構文向け
    "itemize": "enumitem",
}


# プリアンブル中に \usepackage{X} があるか
_USEPACKAGE_RE = re.compile(r"\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}")


def _loaded_packages(src: str) -> set[str]:
    loaded: set[str] = set()
    for match in _USEPACKAGE_RE.finditer(src):
        for pkg in match.group(1).split(","):
            loaded.add(pkg.strip())
    return loaded


def _document_uses(src: str, key: str) -> bool:
    """ソースに `key` が出現するか (粗いマッチ — \\foo の後ろがアルファベットの場合は除外)。"""
    if key.startswith("\\begin{"):
        return key in src
    if key.endswith("}"):
        return key in src
    if key.startswith("\\"):
        # 例: \text の後ろが a-zA-Z でない (= \text 単独 or \text{...}) ことを保証
        pattern = re.escape(key) + r"(?![a-zA-Z@])"
        return re.search(pattern, src) is not None
    return key in src


def _detect_required_packages(src: str) -> list[str]:
    """ソースが必要としそうなパッケージを (重複なく) 列挙する。"""
    needed: list[str] = []
    seen: set[str] = set()

    for cmd, pkg in _COMMAND_TO_PACKAGE.items():
        if pkg in seen:
            continue
        if pkg not in ALLOWED_PACKAGES:
            continue
        if _document_uses(src, cmd):
            needed.append(pkg)
            seen.add(pkg)

    # 環境ベース
    env_matches = re.findall(r"\\begin\{([A-Za-z*]+)\}", src)
    for env in set(env_matches):
        pkg = _ENV_TO_PACKAGE.get(env)
        if pkg and pkg in ALLOWED_PACKAGES and pkg not in seen:
            needed.append(pkg)
            seen.add(pkg)

    return needed


# ─────────────────────────────────────────────────────────────
# 3. パッケージ注入
# ─────────────────────────────────────────────────────────────

_DOCUMENTCLASS_RE = re.compile(r"\\documentclass(?:\[[^\]]*\])?\{[^}]+\}")
_BEGIN_DOCUMENT_RE = re.compile(r"\\begin\{document\}")


def _inject_packages(src: str, packages: list[str]) -> str:
    """preamble にパッケージを追加する。

    既にロード済みのもの・allowlist 外のものは捨てる。
    挿入位置は \\documentclass の直後。なければ先頭。
    """
    if not packages:
        return src
    loaded = _loaded_packages(src)
    new_pkgs = [p for p in packages if p not in loaded and p in ALLOWED_PACKAGES]
    if not new_pkgs:
        return src

    block = "\n".join(f"\\usepackage{{{p}}}" for p in new_pkgs)

    m = _DOCUMENTCLASS_RE.search(src)
    if m:
        insert_at = m.end()
        return src[:insert_at] + "\n" + block + src[insert_at:]

    # \documentclass がなければ \begin{document} の前に挿入を試みる
    m = _BEGIN_DOCUMENT_RE.search(src)
    if m:
        insert_at = m.start()
        return src[:insert_at] + block + "\n" + src[insert_at:]

    # それも無ければ完全な fragment 扱い — 触らない
    return src


# ─────────────────────────────────────────────────────────────
# 4. 公開 API
# ─────────────────────────────────────────────────────────────


def autofix_latex(src: str) -> str:
    """コンパイル前に呼ぶ軽量サニタイズ + パッケージ補完。

    - スマートクォート / NBSP 等を ASCII へ
    - コマンド使用パターンから不足パッケージを推定して \\usepackage を追加
    - \\documentclass や preamble が無い fragment は文字置換だけ行う
    """
    if not src:
        return src

    fixed = _normalize_text_chars(src)

    # \documentclass を持たない fragment は preamble をいじれない
    if _DOCUMENTCLASS_RE.search(fixed):
        needed = _detect_required_packages(fixed)
        if needed:
            before = fixed
            fixed = _inject_packages(fixed, needed)
            if fixed != before:
                injected = [p for p in needed if p not in _loaded_packages(before)]
                if injected:
                    logger.info("[autofix] injected packages: %s", injected)

    return fixed


# ── 失敗ログ解析 ──

# 例:
#   ! Undefined control sequence.
#   l.42 \dfrac
#                {1}{2}
_UNDEF_CMD_RE = re.compile(
    r"!\s*Undefined control sequence\.\s*(?:.*?\n)*?.*?(\\[a-zA-Z@]+)",
    re.IGNORECASE,
)

# 例:
#   ! LaTeX Error: File `siunitx.sty' not found.
_FILE_NOT_FOUND_RE = re.compile(
    r"File\s+`([A-Za-z0-9_\-]+)\.sty'\s+not found",
    re.IGNORECASE,
)

# 例:
#   ! LaTeX Error: Environment foo undefined.
_UNDEF_ENV_RE = re.compile(
    r"Environment\s+([A-Za-z*]+)\s+undefined",
    re.IGNORECASE,
)


def _packages_from_log(log: str) -> list[str]:
    """LaTeX ログからリトライで追加すべきパッケージ名を推定する。"""
    pkgs: list[str] = []
    seen: set[str] = set()

    def _add(pkg: Optional[str]) -> None:
        if pkg and pkg in ALLOWED_PACKAGES and pkg not in seen:
            pkgs.append(pkg)
            seen.add(pkg)

    # 未定義コマンド → COMMAND_TO_PACKAGE
    for m in _UNDEF_CMD_RE.finditer(log):
        cmd = m.group(1)
        _add(_COMMAND_TO_PACKAGE.get(cmd))

    # 未定義環境 → ENV_TO_PACKAGE
    for m in _UNDEF_ENV_RE.finditer(log):
        env = m.group(1)
        _add(_ENV_TO_PACKAGE.get(env))

    return pkgs


def autofix_after_failure(src: str, log: str) -> Optional[str]:
    """コンパイル失敗ログを見て追加リペアを試みる。

    Returns:
        リペア済みソース。何も変えられなかった場合は None。
    """
    if not src or not log:
        return None

    pkgs = _packages_from_log(log)
    if not pkgs:
        return None

    if not _DOCUMENTCLASS_RE.search(src):
        return None

    loaded = _loaded_packages(src)
    new_pkgs = [p for p in pkgs if p not in loaded]
    if not new_pkgs:
        return None

    fixed = _inject_packages(src, new_pkgs)
    if fixed == src:
        return None

    logger.info("[autofix-retry] injected packages from log: %s", new_pkgs)
    return fixed

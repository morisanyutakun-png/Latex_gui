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
    # ── 数式系 (amsmath) ──
    r"\text": "amsmath",
    r"\dfrac": "amsmath",
    r"\tfrac": "amsmath",
    r"\cfrac": "amsmath",
    r"\binom": "amsmath",
    r"\dbinom": "amsmath",
    r"\tbinom": "amsmath",
    r"\boxed": "amsmath",
    r"\xrightarrow": "amsmath",
    r"\xleftarrow": "amsmath",
    r"\xRightarrow": "amsmath",
    r"\xLeftarrow": "amsmath",
    r"\xhookrightarrow": "amsmath",
    r"\xhookleftarrow": "amsmath",
    r"\xmapsto": "amsmath",
    r"\substack": "amsmath",
    r"\overset": "amsmath",
    r"\underset": "amsmath",
    r"\overbrace": "amsmath",
    r"\underbrace": "amsmath",
    r"\overleftrightarrow": "amsmath",
    r"\eqref": "amsmath",
    r"\numberwithin": "amsmath",
    r"\intertext": "amsmath",
    r"\shortintertext": "amsmath",
    r"\genfrac": "amsmath",
    r"\sideset": "amsmath",
    r"\smash": "amsmath",
    r"\DeclareMathOperator": "amsmath",
    # ── 数式記号 (amssymb) ──
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
    r"\nleqslant": "amssymb",
    r"\ngeqslant": "amssymb",
    r"\leqslant": "amssymb",
    r"\geqslant": "amssymb",
    r"\nsubseteq": "amssymb",
    r"\nsupseteq": "amssymb",
    r"\subsetneq": "amssymb",
    r"\supsetneq": "amssymb",
    r"\nparallel": "amssymb",
    r"\nleftrightarrow": "amssymb",
    r"\circledast": "amssymb",
    r"\complement": "amssymb",
    r"\multimap": "amssymb",
    r"\rightleftharpoons": "amssymb",
    # ── 定理環境 (amsthm) ──
    r"\newtheorem": "amsthm",
    r"\theoremstyle": "amsthm",
    r"\newtheoremstyle": "amsthm",
    r"\proof": "amsthm",
    r"\qedhere": "amsthm",
    r"\qedsymbol": "amsthm",
    r"\swapnumbers": "amsthm",
    # ── mathtools ──
    r"\coloneqq": "mathtools",
    r"\eqcolon": "mathtools",
    r"\coloneq": "mathtools",
    r"\eqqcolon": "mathtools",
    r"\Coloneqq": "mathtools",
    r"\dblcolon": "mathtools",
    r"\Aboxed": "mathtools",
    r"\DeclarePairedDelimiter": "mathtools",
    r"\mathclap": "mathtools",
    r"\mathllap": "mathtools",
    r"\mathrlap": "mathtools",
    r"\smashoperator": "mathtools",
    r"\prescript": "mathtools",
    r"\xmathstrut": "mathtools",
    # ── bm ──
    r"\bm": "bm",
    r"\boldsymbol": "bm",
    # ── cancel ──
    r"\cancel": "cancel",
    r"\bcancel": "cancel",
    r"\xcancel": "cancel",
    r"\cancelto": "cancel",
    # ── siunitx ──
    r"\SI": "siunitx",
    r"\si": "siunitx",
    r"\num": "siunitx",
    r"\ang": "siunitx",
    r"\qty": "siunitx",
    r"\unit": "siunitx",
    r"\SIrange": "siunitx",
    r"\numrange": "siunitx",
    r"\numlist": "siunitx",
    r"\SIlist": "siunitx",
    r"\qtyrange": "siunitx",
    r"\qtylist": "siunitx",
    r"\qtyproduct": "siunitx",
    r"\complexnum": "siunitx",
    r"\complexqty": "siunitx",
    # ── physics ──
    r"\pdv": "physics",
    r"\dv": "physics",
    r"\bra": "physics",
    r"\ket": "physics",
    r"\braket": "physics",
    r"\ketbra": "physics",
    r"\expval": "physics",
    r"\matrixel": "physics",
    r"\grad": "physics",
    r"\curl": "physics",
    r"\divergence": "physics",
    r"\laplacian": "physics",
    r"\Tr": "physics",
    r"\tr": "physics",
    r"\rank": "physics",
    r"\erf": "physics",
    r"\Res": "physics",
    r"\principalvalue": "physics",
    r"\fdv": "physics",
    r"\var": "physics",
    r"\order": "physics",
    r"\eval": "physics",
    r"\evaluated": "physics",
    r"\differential": "physics",
    r"\dd": "physics",
    r"\abs": "physics",
    r"\norm": "physics",
    r"\Re": "physics",  # 注: \Re はカーネル定義もあるが、physics で再定義される
    r"\Im": "physics",
    # ── 分数 ──
    r"\nicefrac": "nicefrac",
    r"\sfrac": "xfrac",
    # ── 表 / 罫線 ──
    r"\toprule": "booktabs",
    r"\midrule": "booktabs",
    r"\bottomrule": "booktabs",
    r"\cmidrule": "booktabs",
    r"\specialrule": "booktabs",
    r"\addlinespace": "booktabs",
    r"\multirow": "multirow",
    r"\diagbox": "diagbox",
    r"\makecell": "makecell",
    r"\thead": "makecell",
    # ── 図 / graphics ──
    r"\includegraphics": "graphicx",
    r"\rotatebox": "graphicx",
    r"\scalebox": "graphicx",
    r"\resizebox": "graphicx",
    r"\reflectbox": "graphicx",
    r"\graphicspath": "graphicx",
    r"\subcaption": "subcaption",
    r"\subfloat": "subcaption",
    r"\subcaptionbox": "subcaption",
    r"\wrapfigure": "wrapfig",
    r"\begin{wrapfigure}": "wrapfig",
    r"\captionof": "caption",
    r"\captionsetup": "caption",
    r"\DeclareCaptionFormat": "caption",
    # ── tcolorbox / 装飾 ──
    r"\tcbox": "tcolorbox",
    r"\tcolorbox": "tcolorbox",
    r"\begin{tcolorbox}": "tcolorbox",
    r"\newtcolorbox": "tcolorbox",
    r"\newtcbtheorem": "tcolorbox",
    r"\renewtcolorbox": "tcolorbox",
    r"\tcbset": "tcolorbox",
    r"\tcbuselibrary": "tcolorbox",
    r"\tcblower": "tcolorbox",
    r"\tcbline": "tcolorbox",
    # ── mdframed / framed ──
    r"\begin{mdframed}": "mdframed",
    r"\newmdenv": "mdframed",
    r"\mdfdefinestyle": "mdframed",
    r"\begin{framed}": "framed",
    r"\begin{shaded}": "framed",
    # ── ハイパーリンク ──
    r"\url": "url",
    r"\nolinkurl": "url",
    r"\href": "hyperref",
    r"\hyperref": "hyperref",
    r"\hypersetup": "hyperref",
    r"\autoref": "hyperref",
    r"\nameref": "hyperref",
    r"\phantomsection": "hyperref",
    # ── 色 ──
    r"\textcolor": "xcolor",
    r"\colorbox": "xcolor",
    r"\fcolorbox": "xcolor",
    r"\definecolor": "xcolor",
    r"\colorlet": "xcolor",
    r"\color": "xcolor",
    r"\rowcolor": "colortbl",
    r"\columncolor": "colortbl",
    r"\cellcolor": "colortbl",
    r"\arrayrulecolor": "colortbl",
    # ── 化学 ──
    r"\ce": "mhchem",
    r"\cee": "mhchem",
    r"\chemfig": "chemfig",
    r"\polymerdelim": "chemfig",
    r"\definesubmol": "chemfig",
    # ── tikz / pgf ──
    r"\begin{tikzpicture}": "tikz",
    r"\tikz": "tikz",
    r"\tikzset": "tikz",
    r"\usetikzlibrary": "tikz",
    r"\begin{circuitikz}": "circuitikz",
    r"\begin{axis}": "pgfplots",
    r"\begin{semilogxaxis}": "pgfplots",
    r"\begin{semilogyaxis}": "pgfplots",
    r"\begin{loglogaxis}": "pgfplots",
    r"\addplot": "pgfplots",
    r"\addplot3": "pgfplots",
    r"\pgfplotsset": "pgfplots",
    # ── enumitem ──
    r"\setlist": "enumitem",
    r"\setlistdepth": "enumitem",
    r"\newlist": "enumitem",
    r"\restartlist": "enumitem",
    # ── multicol ──
    r"\begin{multicols}": "multicol",
    r"\columnbreak": "multicol",
    # ── code ──
    r"\lstinline": "listings",
    r"\begin{lstlisting}": "listings",
    r"\lstset": "listings",
    r"\lstdefinestyle": "listings",
    r"\lstdefinelanguage": "listings",
    # ── 取消線・下線 ──
    r"\sout": "ulem",
    r"\uline": "ulem",
    r"\uuline": "ulem",
    r"\uwave": "ulem",
    r"\xout": "ulem",
    r"\dashuline": "ulem",
    r"\dotuline": "ulem",
    r"\hl": "soul",
    r"\sethlcolor": "soul",
    # ── レイアウト ──
    r"\onehalfspacing": "setspace",
    r"\doublespacing": "setspace",
    r"\singlespacing": "setspace",
    r"\setstretch": "setspace",
    r"\titleformat": "titlesec",
    r"\titlespacing": "titlesec",
    r"\titlerule": "titlesec",
    r"\titleline": "titlesec",
    r"\fancyhead": "fancyhdr",
    r"\fancyfoot": "fancyhdr",
    r"\fancyhf": "fancyhdr",
    r"\fancypagestyle": "fancyhdr",
    r"\headrulewidth": "fancyhdr",
    r"\footrulewidth": "fancyhdr",
    r"\pagestyle{fancy}": "fancyhdr",
    r"\Centering": "ragged2e",
    r"\RaggedLeft": "ragged2e",
    r"\RaggedRight": "ragged2e",
    r"\justifying": "ragged2e",
    # ── adjustbox ──
    r"\adjustbox": "adjustbox",
    r"\adjustimage": "adjustbox",
    # ── lipsum (テスト用) ──
    r"\lipsum": "lipsum",
    r"\blindtext": "blindtext",
    r"\Blindtext": "blindtext",
    # ── QR / アイコン ──
    r"\qrcode": "qrcode",
    r"\faIcon": "fontawesome5",
    r"\faicon": "fontawesome5",
    # ── pdfpages ──
    r"\includepdf": "pdfpages",
    # ── csvsimple ──
    r"\csvreader": "csvsimple",
    r"\csvautotabular": "csvsimple",
    # ── xparse ──
    r"\NewDocumentCommand": "xparse",
    r"\NewDocumentEnvironment": "xparse",
    r"\DeclareDocumentCommand": "xparse",
    r"\DeclareDocumentEnvironment": "xparse",
    r"\RenewDocumentCommand": "xparse",
    r"\ProvideDocumentCommand": "xparse",
    # ── etoolbox ──
    r"\AtBeginEnvironment": "etoolbox",
    r"\AtEndEnvironment": "etoolbox",
    r"\BeforeBeginEnvironment": "etoolbox",
    r"\AfterEndEnvironment": "etoolbox",
    r"\newtoggle": "etoolbox",
    r"\settoggle": "etoolbox",
    r"\iftoggle": "etoolbox",
    r"\patchcmd": "etoolbox",
    r"\apptocmd": "etoolbox",
    r"\pretocmd": "etoolbox",
    # ── needspace ──
    r"\needspace": "needspace",
    # ── tabularx 系 ──
    r"\begin{tabularx}": "tabularx",
    r"\begin{tabulary}": "tabulary",
    r"\begin{longtable}": "longtable",
    r"\endhead": "longtable",
    r"\endfoot": "longtable",
    r"\endlastfoot": "longtable",
    r"\endfirsthead": "longtable",
    # ── threeparttable ──
    r"\begin{threeparttable}": "threeparttable",
    r"\begin{tablenotes}": "threeparttable",
    # ── float ──
    r"\newfloat": "float",
    r"\floatstyle": "float",
    r"\restylefloat": "float",
}

# 環境 → パッケージ (\begin{env} 形式が登場したら必要)
_ENV_TO_PACKAGE: dict[str, str] = {
    # ── 数式 (amsmath) ──
    "align": "amsmath",
    "align*": "amsmath",
    "alignat": "amsmath",
    "alignat*": "amsmath",
    "flalign": "amsmath",
    "flalign*": "amsmath",
    "gather": "amsmath",
    "gather*": "amsmath",
    "multline": "amsmath",
    "multline*": "amsmath",
    "cases": "amsmath",
    "dcases": "mathtools",
    "rcases": "mathtools",
    "drcases": "mathtools",
    "split": "amsmath",
    "subequations": "amsmath",
    "matrix": "amsmath",
    "pmatrix": "amsmath",
    "bmatrix": "amsmath",
    "Bmatrix": "amsmath",
    "vmatrix": "amsmath",
    "Vmatrix": "amsmath",
    "smallmatrix": "amsmath",
    # ── 定理環境 ──
    "theorem": "amsthm",
    "lemma": "amsthm",
    "proposition": "amsthm",
    "corollary": "amsthm",
    "definition": "amsthm",
    "proof": "amsthm",
    # ── 図 / 表 ──
    "tikzpicture": "tikz",
    "circuitikz": "circuitikz",
    "axis": "pgfplots",
    "semilogxaxis": "pgfplots",
    "semilogyaxis": "pgfplots",
    "loglogaxis": "pgfplots",
    "tabularx": "tabularx",
    "tabulary": "tabulary",
    "longtable": "longtable",
    "wraptable": "wrapfig",
    "wrapfigure": "wrapfig",
    "subfigure": "subcaption",
    "threeparttable": "threeparttable",
    "tablenotes": "threeparttable",
    # ── tcolorbox / 装飾 ──
    "tcolorbox": "tcolorbox",
    "tcblisting": "tcolorbox",
    "mdframed": "mdframed",
    "framed": "framed",
    "shaded": "framed",
    "leftbar": "framed",
    # ── code ──
    "lstlisting": "listings",
    "minted": "minted",
    # ── レイアウト ──
    "multicols": "multicol",
    "spacing": "setspace",
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
#
# lualatex のエラーログは `-file-line-error` 有無で形式が変わる:
#
#   without -file-line-error:
#     ! Undefined control sequence.
#     l.42 \dfrac
#                 {1}{2}
#
#   with -file-line-error:
#     /tmp/xxx/document.tex:42: Undefined control sequence.
#     l.42 \dfrac
#                 {1}{2}
#
# どちらの形式でも検出できるよう、`!` 行頭または `path:line:` 行頭の両方を許す。

# 「Undefined control sequence」行の次以降に出てくる `l.NNN \cmd` から
# コマンド名を抜き出すパターン (formats: l.42 \cmd  or  l.42 \cmd ...)
_UNDEF_CMD_RE = re.compile(
    r"(?:!\s*Undefined control sequence|:\s*Undefined control sequence)"
    r"[.\s]*"
    r"(?:.*?\n)*?"
    r"(?:l\.\d+\s*|.*?)"
    r"(\\[a-zA-Z@]+)",
)

# 「Undefined control sequence」を経由せず、エラー行の直後に来る `\cmd` も拾う
# (lualatex 一部バージョンでは `! Undefined control sequence. \cmd` のように
#  同一行で出ることがある)
_UNDEF_CMD_INLINE_RE = re.compile(
    r"Undefined control sequence\.?\s*(\\[a-zA-Z@]+)",
)

# 例:
#   ! LaTeX Error: File `siunitx.sty' not found.
#   /tmp/.../document.tex:5: LaTeX Error: File `siunitx.sty' not found.
_FILE_NOT_FOUND_RE = re.compile(
    r"File\s+[`'\"]([A-Za-z0-9_\-]+)\.sty[`'\"]\s+not\s+found",
    re.IGNORECASE,
)

# 例:
#   ! LaTeX Error: Environment foo undefined.
#   /tmp/.../document.tex:8: LaTeX Error: Environment foo undefined.
_UNDEF_ENV_RE = re.compile(
    r"Environment\s+([A-Za-z*]+)\s+undefined",
    re.IGNORECASE,
)

# `! Package XXX Error: Unknown option ...` のような行から欠けてそうな
# パッケージを拾うのは難しいので、このカテゴリは扱わない。

def _unwrap_tex_log(log: str) -> str:
    """lualatex のログは `max_print_line` (デフォルト 79) で行折り返しされ、
    `Un\\ndefined control sequence` のようにキーワードが分断されることがある。

    `tex_env.py` で `max_print_line=10000` を設定して再現を抑えているが、
    既存ログ・外部ログに備えて、ここでも 2 段階の再結合を行う:
      1. 既知のキーワード分断 ("Undefined control sequence", "Emergency stop"
         など) を強制的にスペース置換で繋ぐ
      2. ぴったり 79 字終端 + 次行の先頭が非空白 → 折り返しと判定して連結
    """
    if not log:
        return log

    # 1) 既知のキーワード分断パターンを矯正する
    #    (空白が改行で表現されているのでスペースに戻す)
    known_breaks = [
        ("Un\ndefined control sequence", "Undefined control sequence"),
        ("Emergency\nstop", "Emergency stop"),
        ("Missing }\ninserted", "Missing } inserted"),
        ("Missing {\ninserted", "Missing { inserted"),
        ("Runaway\nargument", "Runaway argument"),
        ("Extra\nalignment", "Extra alignment"),
        ("Misplaced\nalignment", "Misplaced alignment"),
        ("LaTeX\nError", "LaTeX Error"),
        ("Package\nError", "Package Error"),
        ("Environment\n", "Environment "),
    ]
    for broken, fixed in known_breaks:
        if broken in log:
            log = log.replace(broken, fixed)

    # 2) 79 字終端の継続行を連結
    out: list[str] = []
    lines = log.split("\n")
    i = 0
    while i < len(lines):
        cur = lines[i]
        while (
            len(cur) == 79
            and i + 1 < len(lines)
            and lines[i + 1]
            and not lines[i + 1][0].isspace()
        ):
            cur = cur + lines[i + 1]
            i += 1
        out.append(cur)
        i += 1
    return "\n".join(out)


# `\providecommand` 用に、ログ中で出てきた未定義コマンド名をすべて集めるヘルパ
def extract_undefined_commands(log: str) -> list[str]:
    r"""ログから未定義コントロールシーケンス名 (\\cmd) を重複排除して列挙する。"""
    log = _unwrap_tex_log(log or "")
    cmds: list[str] = []
    seen: set[str] = set()

    for m in _UNDEF_CMD_INLINE_RE.finditer(log):
        cmd = m.group(1)
        if cmd and cmd not in seen:
            cmds.append(cmd)
            seen.add(cmd)

    for m in _UNDEF_CMD_RE.finditer(log):
        cmd = m.group(1)
        if cmd and cmd not in seen:
            cmds.append(cmd)
            seen.add(cmd)

    return cmds


def extract_undefined_environments(log: str) -> list[str]:
    """ログから未定義環境名を重複排除して列挙する。"""
    log = _unwrap_tex_log(log or "")
    envs: list[str] = []
    seen: set[str] = set()
    for m in _UNDEF_ENV_RE.finditer(log):
        env = m.group(1)
        if env and env not in seen:
            envs.append(env)
            seen.add(env)
    return envs


def extract_missing_sty_files(log: str) -> list[str]:
    """ログから「File `xxx.sty' not found」の xxx を重複排除して列挙する。"""
    log = _unwrap_tex_log(log or "")
    files: list[str] = []
    seen: set[str] = set()
    for m in _FILE_NOT_FOUND_RE.finditer(log):
        f = m.group(1)
        if f and f not in seen:
            files.append(f)
            seen.add(f)
    return files


def _packages_from_log(log: str) -> list[str]:
    """LaTeX ログからリトライで追加すべきパッケージ名を推定する。"""
    pkgs: list[str] = []
    seen: set[str] = set()

    def _add(pkg: Optional[str]) -> None:
        if pkg and pkg in ALLOWED_PACKAGES and pkg not in seen:
            pkgs.append(pkg)
            seen.add(pkg)

    # 未定義コマンド → COMMAND_TO_PACKAGE
    for cmd in extract_undefined_commands(log):
        _add(_COMMAND_TO_PACKAGE.get(cmd))

    # 未定義環境 → ENV_TO_PACKAGE
    for env in extract_undefined_environments(log):
        _add(_ENV_TO_PACKAGE.get(env))

    # 「File `xxx.sty' not found」 → そのまま xxx パッケージとして補完を試みる
    # (allowlist にないものは _add() で弾かれる)
    for sty in extract_missing_sty_files(log):
        _add(sty)

    return pkgs


# ─────────────────────────────────────────────────────────────
# 5. 未定義コマンド/環境を no-op として stub する最終手段
# ─────────────────────────────────────────────────────────────
#
# パッケージ補完で救えない場合 (typo / allowlist 外のコマンド) でも、
# 「とにかく PDF を出す」ことを優先するための最後の砦。
# 未定義コマンドは `\providecommand{\foo}[N]{#1}` (引数を素通し) として
# プリアンブルに注入し、未定義環境は `\newenvironment{foo}{}{}` を注入する。
#
# 注意:
#   - 引数の数 (arity) はソースを目視走査して推定する (高々 9)
#   - 既に \newcommand / \def 等で定義されているコマンドはスキップ
#   - allowlist 外パッケージで本来定義されるべきコマンドは
#     見た目が崩れるが、コンパイルは通る

# LaTeX カーネル + 主要パッケージで定義済みの「触ってはいけない」コマンドの粗いリスト。
# stub_unknown_commands() がこれらを誤って no-op 化してしまうのを防ぐ。
# (網羅は不要 — \providecommand は既に定義されている場合は何もしないため、
#  最悪でも上書きは発生しない。ただし stub するか否かの判断時に無駄を省く目的で使う)
_KNOWN_KERNEL_COMMANDS = {
    r"\begin", r"\end", r"\section", r"\subsection", r"\subsubsection",
    r"\paragraph", r"\subparagraph", r"\chapter", r"\part",
    r"\textbf", r"\textit", r"\texttt", r"\textsf", r"\textrm",
    r"\emph", r"\underline", r"\textsc", r"\textsl", r"\textnormal",
    r"\large", r"\Large", r"\LARGE", r"\huge", r"\Huge",
    r"\small", r"\footnotesize", r"\scriptsize", r"\tiny", r"\normalsize",
    r"\item", r"\label", r"\ref", r"\cite", r"\pageref",
    r"\newpage", r"\clearpage", r"\pagebreak", r"\linebreak", r"\\",
    r"\hspace", r"\vspace", r"\quad", r"\qquad", r"\bigskip",
    r"\smallskip", r"\medskip", r"\noindent", r"\indent",
    r"\frac", r"\sqrt", r"\sum", r"\int", r"\prod", r"\lim",
    r"\alpha", r"\beta", r"\gamma", r"\delta", r"\epsilon", r"\zeta",
    r"\eta", r"\theta", r"\iota", r"\kappa", r"\lambda", r"\mu",
    r"\nu", r"\xi", r"\pi", r"\rho", r"\sigma", r"\tau", r"\upsilon",
    r"\phi", r"\chi", r"\psi", r"\omega",
    r"\Gamma", r"\Delta", r"\Theta", r"\Lambda", r"\Xi", r"\Pi",
    r"\Sigma", r"\Upsilon", r"\Phi", r"\Psi", r"\Omega",
    r"\centering", r"\raggedright", r"\raggedleft",
    r"\par", r"\input", r"\include",  # 安全側 — そもそも検出されたらセキュリティで弾かれる
    r"\caption", r"\title", r"\author", r"\date", r"\maketitle",
    r"\thanks", r"\tableofcontents", r"\listoffigures", r"\listoftables",
    r"\appendix", r"\bibliography", r"\bibitem",
    r"\setcounter", r"\addtocounter", r"\value", r"\stepcounter",
    r"\renewcommand", r"\newcommand", r"\providecommand",
    r"\newenvironment", r"\renewenvironment",
    r"\def", r"\let", r"\edef", r"\gdef", r"\xdef",
    r"\if", r"\fi", r"\else", r"\ifnum", r"\ifx",
    r"\foreach",
}

# プリアンブル中で定義されたコマンド・環境を抽出するパターン
_NEWCOMMAND_RE = re.compile(
    r"\\(?:re)?newcommand\*?\s*\{?\s*(\\[a-zA-Z@]+)"
)
_PROVIDECOMMAND_RE = re.compile(
    r"\\providecommand\*?\s*\{?\s*(\\[a-zA-Z@]+)"
)
_DEF_RE = re.compile(r"\\def\s*(\\[a-zA-Z@]+)")
_LET_RE = re.compile(r"\\let\s*(\\[a-zA-Z@]+)")
_NEWENV_RE = re.compile(
    r"\\(?:re)?newenvironment\*?\s*\{\s*([A-Za-z*]+)\s*\}"
)
_NEWTHM_RE = re.compile(
    r"\\newtheorem\*?\s*\{\s*([A-Za-z*]+)\s*\}"
)
_NEWTCB_RE = re.compile(
    r"\\(?:re)?newtcolorbox\*?\s*(?:\[[^\]]*\])?\s*\{\s*([A-Za-z*]+)\s*\}"
)
_DECLARE_OP_RE = re.compile(
    r"\\DeclareMathOperator\*?\s*\{?\s*(\\[a-zA-Z@]+)"
)


def _user_defined_commands(src: str) -> set[str]:
    r"""ソース中で \newcommand / \def / \providecommand / \DeclareMathOperator
    などにより既に定義されているコマンド名 (`\foo`) の集合を返す。"""
    defined: set[str] = set()
    for rx in (_NEWCOMMAND_RE, _PROVIDECOMMAND_RE, _DEF_RE, _LET_RE, _DECLARE_OP_RE):
        for m in rx.finditer(src):
            defined.add(m.group(1))
    return defined


def _user_defined_environments(src: str) -> set[str]:
    """ソース中で \newenvironment / \newtheorem / \newtcolorbox 等で
    定義された環境名の集合を返す。"""
    defined: set[str] = set()
    for rx in (_NEWENV_RE, _NEWTHM_RE, _NEWTCB_RE):
        for m in rx.finditer(src):
            defined.add(m.group(1))
    return defined


def _guess_command_arity(src: str, cmd: str) -> int:
    """ソース中で `cmd` の直後に続く `{...}` 引数の最大個数を推定する。

    例えば `\foo{a}{b}` が出てきたら 2、`\foo{a}` なら 1、`\foo` 単独なら 0。
    高々 9 個まで。
    """
    pattern = re.escape(cmd) + r"(?![a-zA-Z@])"
    max_args = 0
    for m in re.finditer(pattern, src):
        i = m.end()
        n = 0
        while n < 9 and i < len(src):
            # 空白をスキップ (改行は引数区切りとみなす — 改行があっても空白扱い)
            j = i
            while j < len(src) and src[j] in " \t":
                j += 1
            if j >= len(src) or src[j] != "{":
                break
            # 対応する `}` までスキップ
            depth = 1
            k = j + 1
            while k < len(src) and depth > 0:
                if src[k] == "\\" and k + 1 < len(src):
                    k += 2
                    continue
                if src[k] == "{":
                    depth += 1
                elif src[k] == "}":
                    depth -= 1
                k += 1
            if depth != 0:
                break
            n += 1
            i = k
        if n > max_args:
            max_args = n
    return max_args


def _build_stub_block(
    cmd_arities: list[tuple[str, int]],
    envs: list[str],
) -> str:
    r"""`\providecommand` / `\newenvironment` 行を組み立てる。"""
    lines: list[str] = []
    if cmd_arities:
        lines.append("% [autofix] no-op stubs for unresolved commands")
        for cmd, arity in cmd_arities:
            if arity <= 0:
                lines.append(f"\\providecommand{{{cmd}}}{{}}")
            else:
                # 第一引数を素通し、それ以降は捨てる
                lines.append(f"\\providecommand{{{cmd}}}[{arity}]{{#1}}")
    if envs:
        lines.append("% [autofix] no-op stubs for unresolved environments")
        for env in envs:
            # `\newenvironment` は既存定義があればエラーになる。
            # `\providecommand` 相当の安全版は無いので、`\@ifundefined` で包む。
            lines.append(
                f"\\makeatletter\\@ifundefined{{{env}}}{{"
                f"\\newenvironment{{{env}}}{{}}{{}}"
                f"}}{{}}\\makeatother"
            )
    return "\n".join(lines)


def stub_unknown_commands(src: str, log: str) -> Optional[str]:
    r"""コンパイル失敗ログから未定義コマンド/環境を抽出し、
    ``\providecommand`` / ``\newenvironment`` で no-op stub を注入する。

    パッケージ補完では救えなかった場合の **最終手段**:
      - typo の場合: 内容は崩れるがコンパイルは通り、ユーザーが間違いを目視できる
      - allowlist 外パッケージのコマンド: 同上
      - 自作コマンドのつもりで定義し忘れ: 同上

    Returns:
        stub 注入済みソース。注入対象が無ければ None。
    """
    if not src or not log:
        return None
    if not _DOCUMENTCLASS_RE.search(src):
        return None

    # 既知 / ユーザー定義 / カーネル定義のコマンドは除外
    user_defined = _user_defined_commands(src)
    user_envs = _user_defined_environments(src)

    cmd_candidates: list[tuple[str, int]] = []
    seen_cmd: set[str] = set()
    for cmd in extract_undefined_commands(log):
        if cmd in seen_cmd:
            continue
        seen_cmd.add(cmd)
        if cmd in _KNOWN_KERNEL_COMMANDS:
            continue
        if cmd in user_defined:
            continue
        # ソース中に実際に出現していなければ無視 (ログのノイズかもしれない)
        if not _document_uses(src, cmd):
            continue
        arity = _guess_command_arity(src, cmd)
        cmd_candidates.append((cmd, arity))

    env_candidates: list[str] = []
    seen_env: set[str] = set()
    for env in extract_undefined_environments(log):
        if env in seen_env:
            continue
        seen_env.add(env)
        if env in user_envs:
            continue
        if not _document_uses(src, f"\\begin{{{env}}}"):
            continue
        env_candidates.append(env)

    if not cmd_candidates and not env_candidates:
        return None

    block = _build_stub_block(cmd_candidates, env_candidates)
    if not block:
        return None

    # \begin{document} の直前にも入れたいが、preamble の最後 (= 直前) に挿入する
    m = _BEGIN_DOCUMENT_RE.search(src)
    if not m:
        return None
    insert_at = m.start()
    fixed = src[:insert_at] + block + "\n" + src[insert_at:]
    logger.info(
        "[autofix-stub] stubbed commands=%s envs=%s",
        [c for c, _ in cmd_candidates], env_candidates,
    )
    return fixed


def autofix_after_failure(src: str, log: str) -> Optional[str]:
    """コンパイル失敗ログを見て追加リペアを試みる。

    優先順:
      1. ログから不足パッケージを推定して `\\usepackage` を追加
      2. それでも足りなければ no-op stub を注入してとにかくコンパイルを通す

    Returns:
        リペア済みソース。何も変えられなかった場合は None。
    """
    if not src or not log:
        return None
    if not _DOCUMENTCLASS_RE.search(src):
        return None

    # ── 1) パッケージ補完 ──
    pkgs = _packages_from_log(log)
    loaded = _loaded_packages(src)
    new_pkgs = [p for p in pkgs if p not in loaded]
    if new_pkgs:
        fixed = _inject_packages(src, new_pkgs)
        if fixed != src:
            logger.info("[autofix-retry] injected packages from log: %s", new_pkgs)
            return fixed

    # ── 2) パッケージで救えない: stub fallback ──
    stubbed = stub_unknown_commands(src, log)
    if stubbed and stubbed != src:
        return stubbed

    return None

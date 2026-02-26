"""
TeX Live環境ユーティリティ — 3エンジン対応版

3エンジン対応 (優先順):
  1. pdflatex + bxcjkjatype  — 最軽量 (~50MB)、CJK.sty 必須
  2. lualatex + luatexja     — 最も堅牢。HaranoAji フォント内蔵、外部フォント不要
  3. xelatex  + xeCJK        — フォント検出を Python 側で事前に行い確実に設定

起動時に **実際の日本語テキスト** でコンパイルテストを実施し、
確実に動くエンジンだけを使う。
"""
import os
import shutil
import subprocess
import platform
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════
# 1. PATH 構築
# ══════════════════════════════════════════════════════════════════

_TEXLIVE_PATHS = [
    "/Library/TeX/texbin",
    "/usr/local/texlive/2025/bin/universal-darwin",
    "/usr/local/texlive/2025/bin/x86_64-darwin",
    "/usr/local/texlive/2025/bin/aarch64-darwin",
    "/usr/local/texlive/2025/bin/x86_64-linux",
    "/usr/local/texlive/2025/bin/aarch64-linux",
    "/usr/local/texlive/2024/bin/x86_64-linux",
    "/usr/local/texlive/2024/bin/aarch64-linux",
    "/usr/bin",
]


def _build_texlive_env() -> dict[str, str]:
    """TeX Live のパスを含む環境変数を構築"""
    env = os.environ.copy()
    current_path = env.get("PATH", "")
    extra = [p for p in _TEXLIVE_PATHS if Path(p).is_dir() and p not in current_path]
    if extra:
        env["PATH"] = ":".join(extra) + ":" + current_path
        logger.info(f"Added TeX Live paths: {extra}")

    # Docker ビルド時に /etc/texinputs.env に保存された TEXINPUTS を復元
    _texinputs_env_file = Path("/etc/texinputs.env")
    if _texinputs_env_file.is_file():
        try:
            for line in _texinputs_env_file.read_text().strip().split("\n"):
                line = line.strip()
                if line.startswith("TEXINPUTS="):
                    val = line.split("=", 1)[1]
                    # シェル変数 $TEXINPUTS の展開
                    val = val.replace("$TEXINPUTS", env.get("TEXINPUTS", ""))
                    env["TEXINPUTS"] = val
                    logger.info(f"Loaded TEXINPUTS from {_texinputs_env_file}: {val}")
        except Exception as e:
            logger.warning(f"Failed to read {_texinputs_env_file}: {e}")

    return env


def find_command(name: str) -> str:
    """TeX Live コマンドのフルパスを返す"""
    found = shutil.which(name)
    if found:
        return found
    for base in _TEXLIVE_PATHS:
        candidate = Path(base) / name
        if candidate.is_file():
            return str(candidate)
    return name


# ── 環境とコマンドのキャッシュ ──
TEX_ENV = _build_texlive_env()
XELATEX_CMD = find_command("xelatex")
PDFLATEX_CMD = find_command("pdflatex")
LUALATEX_CMD = find_command("lualatex")
DVISVGM_CMD = find_command("dvisvgm")
PDFTOCAIRO_CMD = find_command("pdftocairo")


# ══════════════════════════════════════════════════════════════════
# 2. .sty パッケージ検出 (pdflatex 用)
# ══════════════════════════════════════════════════════════════════

def _check_sty_kpsewhich(name: str, env: dict) -> str | None:
    try:
        r = subprocess.run(
            [find_command("kpsewhich"), name],
            capture_output=True, text=True, timeout=10, env=env,
        )
        path = r.stdout.strip()
        if r.returncode == 0 and path:
            return path
    except Exception:
        pass
    return None


def _find_sty_filesystem(name: str) -> str | None:
    search_dirs = [
        "/usr/share/texmf",
        "/usr/share/texlive",
        "/usr/local/texlive",
        "/usr/share/texmf-dist",
        "/nix/store",  # nixpacks環境
    ]
    for search_dir in search_dirs:
        if not Path(search_dir).is_dir():
            continue
        try:
            r = subprocess.run(
                ["find", search_dir, "-name", name, "-type", "f"],
                capture_output=True, text=True, timeout=30,
            )
            for line in r.stdout.strip().split("\n"):
                if line.strip():
                    logger.info(f"Filesystem search: {name} → {line.strip()}")
                    return line.strip()
        except Exception as e:
            logger.warning(f"find {name} in {search_dir} failed: {e}")
    return None


def _ensure_sty_available(name: str, env: dict) -> bool:
    """kpsewhich → texhash → ファイルシステム検索 → TEXINPUTS 追加"""
    if _check_sty_kpsewhich(name, env):
        logger.info(f"{name}: found by kpsewhich")
        return True

    try:
        subprocess.run([find_command("texhash")], capture_output=True, timeout=30, env=env)
    except Exception:
        pass
    if _check_sty_kpsewhich(name, env):
        logger.info(f"{name}: found after texhash")
        return True

    fs_path = _find_sty_filesystem(name)
    if fs_path:
        sty_dir = str(Path(fs_path).parent)
        current = env.get("TEXINPUTS", "")
        if sty_dir not in current:
            env["TEXINPUTS"] = f".:{sty_dir}//:{current}" if current else f".:{sty_dir}//"
            logger.info(f"Added {sty_dir} to TEXINPUTS for {name}")
        return True

    logger.warning(f"{name}: NOT found on system")
    return False


CJK_STY_AVAILABLE = _ensure_sty_available("CJK.sty", TEX_ENV)
BXCJKJATYPE_AVAILABLE = _ensure_sty_available("bxcjkjatype.sty", TEX_ENV)
XECJK_STY_AVAILABLE = _ensure_sty_available("xeCJK.sty", TEX_ENV)
LUATEXJA_STY_AVAILABLE = _ensure_sty_available("luatexja.sty", TEX_ENV)


# ══════════════════════════════════════════════════════════════════
# 3. CJK フォント検出 (xelatex 用 — Python 側で事前に確定)
# ══════════════════════════════════════════════════════════════════

def _detect_available_cjk_font() -> tuple[str, str]:
    """fc-list で実際に使える CJK フォント名を (main, sans) で返す。
    
    見つからない場合は空文字列を返す。
    """
    env_main = os.environ.get("CJK_MAIN_FONT", "").strip()
    env_sans = os.environ.get("CJK_SANS_FONT", "").strip()
    if env_main and env_sans:
        logger.info(f"CJK fonts from env: main={env_main}, sans={env_sans}")
        return (env_main, env_sans)

    system = platform.system()
    if system == "Darwin":
        candidates = [
            ("Hiragino Mincho ProN", "Hiragino Sans"),
            ("Hiragino Mincho Pro", "Hiragino Kaku Gothic Pro"),
        ]
    else:
        candidates = [
            ("Noto Serif CJK JP", "Noto Sans CJK JP"),
            ("Noto Sans CJK JP", "Noto Sans CJK JP"),
            ("IPAexMincho", "IPAexGothic"),
            ("IPAMincho", "IPAGothic"),
        ]

    if shutil.which("fc-list"):
        try:
            r = subprocess.run(
                ["fc-list", ":lang=ja", "family"],
                capture_output=True, text=True, timeout=5,
            )
            available = r.stdout
            for main, sans in candidates:
                if main in available:
                    logger.info(f"CJK fonts detected: main={main}, sans={sans}")
                    return (main, sans)
        except Exception as e:
            logger.warning(f"fc-list failed: {e}")

    main, sans = candidates[0]
    logger.warning(f"CJK fonts (unverified fallback): main={main}, sans={sans}")
    return (main, sans)


DETECTED_CJK_MAIN_FONT, DETECTED_CJK_SANS_FONT = _detect_available_cjk_font()


# ══════════════════════════════════════════════════════════════════
# 4. 起動時エンジンテスト — 実際の日本語テキストでコンパイル
# ══════════════════════════════════════════════════════════════════

_JP_TEST_TEXT = "日本語テスト ABCabc 123"


def _test_compile(cmd: str, tex_source: str, env: dict, label: str) -> bool:
    """汎用コンパイルテスト。成功すれば True"""
    if not shutil.which(cmd) and not Path(cmd).is_file():
        logger.info(f"[{label}] command not found: {cmd}")
        return False
    try:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "test.tex"
            p.write_text(tex_source, encoding="utf-8")
            r = subprocess.run(
                [cmd, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", d, str(p)],
                capture_output=True, text=True, timeout=45, cwd=d, env=env,
            )
            ok = r.returncode == 0 and (Path(d) / "test.pdf").exists()
            if ok:
                logger.info(f"[{label}] compile test: OK")
            else:
                tail = (r.stdout + r.stderr).strip().split("\n")[-5:]
                logger.warning(f"[{label}] compile test FAILED (rc={r.returncode}): {' | '.join(tail)}")
            return ok
    except Exception as e:
        logger.warning(f"[{label}] compile test exception: {e}")
        return False


def _test_pdflatex_cjk() -> bool:
    if not CJK_STY_AVAILABLE and not BXCJKJATYPE_AVAILABLE:
        return False
    tex = (
        "\\documentclass{article}\n"
        "\\usepackage[whole]{bxcjkjatype}\n"
        f"\\begin{{document}}\n{_JP_TEST_TEXT}\n\\end{{document}}\n"
    )
    return _test_compile(PDFLATEX_CMD, tex, TEX_ENV, "pdflatex+CJK")


def _test_lualatex_ja() -> bool:
    if not LUATEXJA_STY_AVAILABLE:
        logger.info("[lualatex+luatexja] luatexja.sty not found, skipping")
        return False
    tex = (
        "\\documentclass{article}\n"
        "\\usepackage{luatexja}\n"
        f"\\begin{{document}}\n{_JP_TEST_TEXT}\n\\end{{document}}\n"
    )
    return _test_compile(LUALATEX_CMD, tex, TEX_ENV, "lualatex+luatexja")


def _test_xelatex_cjk() -> bool:
    if not XECJK_STY_AVAILABLE:
        logger.info("[xelatex+xeCJK] xeCJK.sty not found, skipping")
        return False
    if not DETECTED_CJK_MAIN_FONT:
        logger.info("[xelatex+xeCJK] No CJK font detected, skipping")
        return False
    tex = (
        "\\documentclass{article}\n"
        "\\usepackage{xeCJK}\n"
        f"\\setCJKmainfont{{{DETECTED_CJK_MAIN_FONT}}}\n"
        f"\\begin{{document}}\n{_JP_TEST_TEXT}\n\\end{{document}}\n"
    )
    return _test_compile(XELATEX_CMD, tex, TEX_ENV, "xelatex+xeCJK")


# ── 起動テスト実行 ──
PDFLATEX_CJK_OK = _test_pdflatex_cjk()
LUALATEX_JA_OK = _test_lualatex_ja()
XELATEX_OK = _test_xelatex_cjk()

# ── デフォルトエンジン決定 (軽量順) ──
if PDFLATEX_CJK_OK:
    DEFAULT_ENGINE = "pdflatex"
elif LUALATEX_JA_OK:
    DEFAULT_ENGINE = "lualatex"
elif XELATEX_OK:
    DEFAULT_ENGINE = "xelatex"
else:
    # 全て失敗 — フォールバック優先順位
    if shutil.which(LUALATEX_CMD) or Path(LUALATEX_CMD).is_file():
        DEFAULT_ENGINE = "lualatex"
    elif shutil.which(XELATEX_CMD) or Path(XELATEX_CMD).is_file():
        DEFAULT_ENGINE = "xelatex"
    else:
        DEFAULT_ENGINE = "pdflatex"

# ── フォールバック順序 ──
_ALL_ENGINES = ["pdflatex", "lualatex", "xelatex"]
FALLBACK_ENGINES = [e for e in _ALL_ENGINES if e != DEFAULT_ENGINE]

logger.info(
    f"Engine tests: pdflatex+CJK={'OK' if PDFLATEX_CJK_OK else 'NG'}, "
    f"lualatex+luatexja={'OK' if LUALATEX_JA_OK else 'NG'}, "
    f"xelatex+xeCJK={'OK' if XELATEX_OK else 'NG'} "
    f"→ DEFAULT={DEFAULT_ENGINE}, fallbacks={FALLBACK_ENGINES}"
)
logger.info(
    f"Packages: CJK.sty={'OK' if CJK_STY_AVAILABLE else 'NG'}, "
    f"bxcjkjatype={'OK' if BXCJKJATYPE_AVAILABLE else 'NG'}, "
    f"xeCJK.sty={'OK' if XECJK_STY_AVAILABLE else 'NG'}, "
    f"luatexja.sty={'OK' if LUATEXJA_STY_AVAILABLE else 'NG'}"
)
logger.info(f"CJK fonts: main={DETECTED_CJK_MAIN_FONT or '(none)'}, sans={DETECTED_CJK_SANS_FONT or '(none)'}")


# ══════════════════════════════════════════════════════════════════
# 5. Ghostscript (dvisvgm 用)
# ══════════════════════════════════════════════════════════════════

_LIBGS_CANDIDATES = [
    "/opt/homebrew/lib/libgs.dylib",
    "/usr/local/lib/libgs.dylib",
    "/usr/lib/x86_64-linux-gnu/libgs.so",
    "/usr/lib/aarch64-linux-gnu/libgs.so",
    "/usr/lib64/libgs.so",
    "/usr/lib/libgs.so",
]
for _p in _LIBGS_CANDIDATES:
    if Path(_p).is_file():
        TEX_ENV["LIBGS"] = _p
        logger.info(f"LIBGS set to {_p}")
        break

logger.info(
    f"TeX commands: pdflatex={PDFLATEX_CMD}, lualatex={LUALATEX_CMD}, "
    f"xelatex={XELATEX_CMD}, dvisvgm={DVISVGM_CMD}, pdftocairo={PDFTOCAIRO_CMD}"
)

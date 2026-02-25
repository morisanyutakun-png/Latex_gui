"""
TeX Live環境ユーティリティ
subprocessからTeX Liveのコマンドを確実に実行するための環境設定
"""
import os
import shutil
import subprocess
import platform
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# TeX Live の標準インストールパス
_TEXLIVE_PATHS = [
    "/Library/TeX/texbin",                          # macOS TeX Live
    "/usr/local/texlive/2025/bin/universal-darwin",  # macOS universal
    "/usr/local/texlive/2025/bin/x86_64-darwin",     # macOS x86
    "/usr/local/texlive/2025/bin/aarch64-darwin",    # macOS ARM
    "/usr/local/texlive/2025/bin/x86_64-linux",      # Linux
    "/usr/local/texlive/2025/bin/aarch64-linux",     # Linux ARM
    "/usr/bin",                                       # System fallback
]


def _build_texlive_env() -> dict[str, str]:
    """
    TeX Live のパスを含む環境変数を構築。
    subprocess.run(env=...) に渡して使う。
    """
    env = os.environ.copy()
    current_path = env.get("PATH", "")

    # 既にTeX Liveパスが含まれているか確認し、無ければ先頭に追加
    extra_paths = []
    for p in _TEXLIVE_PATHS:
        if Path(p).is_dir() and p not in current_path:
            extra_paths.append(p)

    if extra_paths:
        env["PATH"] = ":".join(extra_paths) + ":" + current_path
        logger.info(f"Added TeX Live paths to env: {extra_paths}")

    return env


def find_xelatex() -> str:
    """xelatex コマンドのフルパスを返す"""
    found = shutil.which("xelatex")
    if found:
        return found

    for base in _TEXLIVE_PATHS:
        candidate = Path(base) / "xelatex"
        if candidate.is_file():
            return str(candidate)

    return "xelatex"


def find_command(name: str) -> str:
    """任意のTeX Live コマンドのフルパスを返す"""
    found = shutil.which(name)
    if found:
        return found

    for base in _TEXLIVE_PATHS:
        candidate = Path(base) / name
        if candidate.is_file():
            return str(candidate)

    return name


# モジュール読み込み時に環境を構築してキャッシュ
TEX_ENV = _build_texlive_env()
XELATEX_CMD = find_xelatex()
PDFLATEX_CMD = find_command("pdflatex")
DVISVGM_CMD = find_command("dvisvgm")
PDFTOCAIRO_CMD = find_command("pdftocairo")


# ── 起動時にエンジン可用性をテスト ──

def _test_pdflatex_cjk(env: dict) -> bool:
    """pdflatex + bxcjkjatype (CJK.sty) が使えるか実際にコンパイルして確認"""
    try:
        with tempfile.TemporaryDirectory() as d:
            tex = (
                "\\documentclass{article}\n"
                "\\usepackage[whole]{bxcjkjatype}\n"
                "\\begin{document}\ntest\n\\end{document}\n"
            )
            p = Path(d) / "t.tex"
            p.write_text(tex)
            r = subprocess.run(
                [PDFLATEX_CMD, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", d, str(p)],
                capture_output=True, text=True, timeout=15, cwd=d, env=env,
            )
            return r.returncode == 0 and (Path(d) / "t.pdf").exists()
    except Exception as e:
        logger.warning(f"pdflatex CJK test failed: {e}")
        return False


def _test_xelatex(env: dict) -> bool:
    """xelatex が使えるか確認"""
    try:
        with tempfile.TemporaryDirectory() as d:
            tex = (
                "\\documentclass{article}\n"
                "\\usepackage{fontspec}\n"
                "\\begin{document}\ntest\n\\end{document}\n"
            )
            p = Path(d) / "t.tex"
            p.write_text(tex)
            r = subprocess.run(
                [XELATEX_CMD, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", d, str(p)],
                capture_output=True, text=True, timeout=20, cwd=d, env=env,
            )
            return r.returncode == 0 and (Path(d) / "t.pdf").exists()
    except Exception as e:
        logger.warning(f"xelatex test failed: {e}")
        return False


# 起動時テスト結果をキャッシュ
PDFLATEX_CJK_OK = _test_pdflatex_cjk(TEX_ENV)
XELATEX_OK = _test_xelatex(TEX_ENV)

# デフォルトエンジンの決定
# - pdflatex + CJK が動く → pdflatex (軽量)
# - 動かない → xelatex にフォールバック
if PDFLATEX_CJK_OK:
    DEFAULT_ENGINE = "pdflatex"
elif XELATEX_OK:
    DEFAULT_ENGINE = "xelatex"
else:
    DEFAULT_ENGINE = "pdflatex"  # 最後の手段

logger.info(
    f"Engine test results: pdflatex+CJK={'OK' if PDFLATEX_CJK_OK else 'NG'}, "
    f"xelatex={'OK' if XELATEX_OK else 'NG'} → default={DEFAULT_ENGINE}"
)


# Ghostscript 共有ライブラリ (dvisvgm --pdf に必要)
_LIBGS_CANDIDATES = [
    "/opt/homebrew/lib/libgs.dylib",          # macOS Homebrew ARM
    "/usr/local/lib/libgs.dylib",              # macOS Intel
    "/usr/lib/x86_64-linux-gnu/libgs.so",      # Debian/Ubuntu x86_64
    "/usr/lib/aarch64-linux-gnu/libgs.so",     # Debian/Ubuntu ARM64
    "/usr/lib64/libgs.so",                     # RHEL/Fedora
    "/usr/lib/libgs.so",                       # Generic Linux
]
for _p in _LIBGS_CANDIDATES:
    if Path(_p).is_file():
        TEX_ENV["LIBGS"] = _p
        logger.info(f"LIBGS set to {_p}")
        break

logger.info(f"TeX commands: xelatex={XELATEX_CMD}, pdflatex={PDFLATEX_CMD}, dvisvgm={DVISVGM_CMD}, pdftocairo={PDFTOCAIRO_CMD}")

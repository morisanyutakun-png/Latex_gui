"""
TeX Live環境ユーティリティ
subprocessからTeX Liveのコマンドを確実に実行するための環境設定
"""
import os
import shutil
import platform
import logging
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
    # 1. shutil.which で見つかればそれを使う
    found = shutil.which("xelatex")
    if found:
        return found

    # 2. 既知のパスを順に探す
    for base in _TEXLIVE_PATHS:
        candidate = Path(base) / "xelatex"
        if candidate.is_file():
            return str(candidate)

    # 3. フォールバック
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
DVISVGM_CMD = find_command("dvisvgm")

logger.info(f"TeX environment: xelatex={XELATEX_CMD}, dvisvgm={DVISVGM_CMD}")

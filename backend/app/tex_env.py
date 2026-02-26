"""
TeX Live環境ユーティリティ
subprocessからTeX Liveのコマンドを確実に実行するための環境設定

起動時にCJK.styの所在を確認し、kpsewhichで見つからない場合はファイルシステム検索で
TEXINPUTSに追加する。これによりDebian 12/13のTeXパッケージDB不整合問題を回避する。
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
    """TeX Live のパスを含む環境変数を構築。"""
    env = os.environ.copy()
    current_path = env.get("PATH", "")

    extra_paths = []
    for p in _TEXLIVE_PATHS:
        if Path(p).is_dir() and p not in current_path:
            extra_paths.append(p)

    if extra_paths:
        env["PATH"] = ":".join(extra_paths) + ":" + current_path
        logger.info(f"Added TeX Live paths to env: {extra_paths}")

    return env


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


# ── モジュール読み込み時に環境を構築してキャッシュ ──
TEX_ENV = _build_texlive_env()
XELATEX_CMD = find_command("xelatex")
PDFLATEX_CMD = find_command("pdflatex")
DVISVGM_CMD = find_command("dvisvgm")
PDFTOCAIRO_CMD = find_command("pdftocairo")


# ══════════════════════════════════════════════════════════════════
# CJK.sty / bxcjkjatype.sty のスマート検出
#
# kpsewhich がDB不整合で見つけられないケースがある。
# その場合、find コマンドでファイルシステムを検索し、
# 見つかったディレクトリを TEXINPUTS に追加する。
# ══════════════════════════════════════════════════════════════════

def _check_sty_kpsewhich(name: str, env: dict) -> str | None:
    """kpsewhich で .sty ファイルのパスを取得。見つからなければ None"""
    try:
        r = subprocess.run(
            [find_command("kpsewhich"), name],
            capture_output=True, text=True, timeout=10, env=env,
        )
        path = r.stdout.strip()
        if r.returncode == 0 and path:
            logger.info(f"kpsewhich {name} → {path}")
            return path
    except Exception as e:
        logger.warning(f"kpsewhich {name} failed: {e}")
    return None


def _find_sty_filesystem(name: str) -> str | None:
    """ファイルシステムを検索して .sty ファイルのパスを取得"""
    search_dirs = ["/usr/share/texmf", "/usr/share/texlive", "/usr/local/texlive"]
    for search_dir in search_dirs:
        if not Path(search_dir).is_dir():
            continue
        try:
            r = subprocess.run(
                ["find", search_dir, "-name", name, "-type", "f"],
                capture_output=True, text=True, timeout=15,
            )
            for line in r.stdout.strip().split("\n"):
                if line.strip():
                    logger.info(f"find {name} → {line.strip()}")
                    return line.strip()
        except Exception as e:
            logger.warning(f"find {name} in {search_dir} failed: {e}")
    return None


def _ensure_sty_available(name: str, env: dict) -> bool:
    """
    .sty ファイルが TeX から使えることを保証する。
    1. kpsewhich で検索
    2. 失敗 → texhash 実行後に再検索
    3. 失敗 → ファイルシステム検索して TEXINPUTS に追加
    """
    # Step 1: kpsewhich
    if _check_sty_kpsewhich(name, env):
        return True

    # Step 2: texhash して再試行
    logger.warning(f"{name} not found by kpsewhich. Running texhash...")
    try:
        subprocess.run(
            [find_command("texhash")],
            capture_output=True, text=True, timeout=30, env=env,
        )
    except Exception:
        pass

    if _check_sty_kpsewhich(name, env):
        return True

    # Step 3: ファイルシステム検索 → TEXINPUTS に追加
    logger.warning(f"{name} still not found by kpsewhich. Searching filesystem...")
    fs_path = _find_sty_filesystem(name)
    if fs_path:
        sty_dir = str(Path(fs_path).parent)
        # TEXINPUTS に追加 (末尾 // で再帰検索)
        current = env.get("TEXINPUTS", "")
        if sty_dir not in current:
            new_val = f".:{sty_dir}//:{current}" if current else f".:{sty_dir}//"
            env["TEXINPUTS"] = new_val
            logger.info(f"Added {sty_dir} to TEXINPUTS for {name}")
            logger.info(f"TEXINPUTS = {new_val}")
        return True

    logger.error(f"{name} not found anywhere on the system!")
    return False


# ── .sty ファイルの可用性チェック ──
CJK_STY_AVAILABLE = _ensure_sty_available("CJK.sty", TEX_ENV)
BXCJKJATYPE_AVAILABLE = _ensure_sty_available("bxcjkjatype.sty", TEX_ENV)

logger.info(
    f"Package availability: CJK.sty={'OK' if CJK_STY_AVAILABLE else 'NG'}, "
    f"bxcjkjatype.sty={'OK' if BXCJKJATYPE_AVAILABLE else 'NG'}, "
    f"TEXINPUTS={TEX_ENV.get('TEXINPUTS', '(not set)')}"
)


# ══════════════════════════════════════════════════════════════════
# 起動時エンジンテスト
# ══════════════════════════════════════════════════════════════════

def _test_pdflatex_cjk(env: dict) -> bool:
    """pdflatex + bxcjkjatype (CJK.sty) が使えるか実際にコンパイルして確認"""
    if not CJK_STY_AVAILABLE and not BXCJKJATYPE_AVAILABLE:
        logger.info("Skipping pdflatex CJK test: CJK.sty/bxcjkjatype not found")
        return False
    try:
        with tempfile.TemporaryDirectory() as d:
            tex = (
                "\\documentclass{article}\n"
                "\\usepackage[whole]{bxcjkjatype}\n"
                "\\begin{document}\ntest テスト\n\\end{document}\n"
            )
            p = Path(d) / "t.tex"
            p.write_text(tex)
            r = subprocess.run(
                [PDFLATEX_CMD, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", d, str(p)],
                capture_output=True, text=True, timeout=30, cwd=d, env=env,
            )
            ok = r.returncode == 0 and (Path(d) / "t.pdf").exists()
            if not ok:
                logger.warning(f"pdflatex CJK test failed (rc={r.returncode})")
                if r.stdout:
                    tail = r.stdout.strip().split("\n")[-5:]
                    logger.warning(f"pdflatex log: {' | '.join(tail)}")
            else:
                logger.info("pdflatex CJK test: OK")
            return ok
    except Exception as e:
        logger.warning(f"pdflatex CJK test exception: {e}")
        return False


def _test_xelatex(env: dict) -> bool:
    """xelatex + fontspec が使えるか確認 (フォント無しでも OK)"""
    try:
        with tempfile.TemporaryDirectory() as d:
            # 最小限のテスト — fontspec のみ (フォント設定なし)
            # フォントが無くてもコンパイル自体は成功する
            tex = (
                "\\documentclass{article}\n"
                "\\usepackage{fontspec}\n"
                "\\begin{document}\nHello World\n\\end{document}\n"
            )
            p = Path(d) / "t.tex"
            p.write_text(tex)
            r = subprocess.run(
                [XELATEX_CMD, "-interaction=nonstopmode", "-halt-on-error",
                 "-output-directory", d, str(p)],
                capture_output=True, text=True, timeout=30, cwd=d, env=env,
            )
            ok = r.returncode == 0 and (Path(d) / "t.pdf").exists()
            if ok:
                logger.info("xelatex test: OK")
            else:
                logger.warning(f"xelatex test failed (rc={r.returncode})")
                if r.stdout:
                    tail = r.stdout.strip().split("\n")[-5:]
                    logger.warning(f"xelatex log: {' | '.join(tail)}")
                if r.stderr:
                    logger.warning(f"xelatex stderr: {r.stderr[-300:]}")
            return ok
    except Exception as e:
        logger.warning(f"xelatex test exception: {e}")
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
    # どちらも失敗 — 最終手段として xelatex を優先 (フォント問題は
    # document_generator 側のフォールバックチェーンで吸収できる可能性あり)
    if shutil.which(XELATEX_CMD):
        DEFAULT_ENGINE = "xelatex"
    else:
        DEFAULT_ENGINE = "pdflatex"

logger.info(
    f"Engine test results: pdflatex+CJK={'OK' if PDFLATEX_CJK_OK else 'NG'}, "
    f"xelatex={'OK' if XELATEX_OK else 'NG'} → default={DEFAULT_ENGINE}"
)
logger.info(
    f"Package availability: CJK.sty={'OK' if CJK_STY_AVAILABLE else 'NG'}, "
    f"bxcjkjatype.sty={'OK' if BXCJKJATYPE_AVAILABLE else 'NG'}"
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

"""
TeX Live環境ユーティリティ — LuaLaTeX 専用版 (v5 — ビルド時キャッシュ活用)

方針:
  - エンジン: lualatex のみ
  - 日本語: luatexja-preset[haranoaji] (HaranoAji フォント内蔵)
  - Docker ビルド時にフォントキャッシュ・パッケージDB を完全構築済み
  - ウォームアップは軽量確認のみ (ビルドキャッシュがあるため高速)
"""
import os
import shutil
import subprocess
import platform
import logging
import tempfile
import threading
import time
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
LUALATEX_CMD = find_command("lualatex")
PDFTOCAIRO_CMD = find_command("pdftocairo")
DVISVGM_CMD = find_command("dvisvgm")

# 後方互換のため残す (preview_service 等が参照する可能性)
PDFLATEX_CMD = LUALATEX_CMD
XELATEX_CMD = LUALATEX_CMD

# 固定エンジン
DEFAULT_ENGINE = "lualatex"
FALLBACK_ENGINES: list[str] = []  # フォールバックなし

# ══════════════════════════════════════════════════════════════════
# 2. パッケージ検出 (luatexja のみ確認すれば十分)
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


def _cmd_exists(cmd: str) -> bool:
    return bool(shutil.which(cmd) or Path(cmd).is_file())


LUATEXJA_STY_AVAILABLE = bool(_check_sty_kpsewhich("luatexja.sty", TEX_ENV))
LUATEXJA_PRESET_AVAILABLE = bool(_check_sty_kpsewhich("luatexja-preset.sty", TEX_ENV))
LUALATEX_AVAILABLE = _cmd_exists(LUALATEX_CMD) and LUATEXJA_STY_AVAILABLE

# 後方互換エイリアス
CJK_STY_AVAILABLE = False
PDFLATEX_AVAILABLE = False
XELATEX_AVAILABLE = False
PDFLATEX_CJK_OK = False
LUALATEX_JA_OK = False
XELATEX_OK = False

# CJK フォント (luatexja-preset[haranoaji] 使用時は不要だが、canvas等で参照される)
DETECTED_CJK_MAIN_FONT = os.environ.get("CJK_MAIN_FONT", "").strip() or "Noto Serif CJK JP"
DETECTED_CJK_SANS_FONT = os.environ.get("CJK_SANS_FONT", "").strip() or "Noto Sans CJK JP"


# ══════════════════════════════════════════════════════════════════
# 3. バックグラウンド・ウォームアップ (lualatex フォントキャッシュ構築)
# ══════════════════════════════════════════════════════════════════

_JP_TEST_TEXT = "日本語テスト ABCabc 123"

_warmup_lock = threading.Lock()
_warmup_event = threading.Event()
_warmup_started = False
_lualatex_cache_warm = False


def _test_compile(cmd: str, tex_source: str, env: dict, label: str, timeout: int = 30) -> bool:
    """コンパイルテスト。成功すれば True
    
    Docker ビルドでキャッシュ構築済みなので通常 5-10 秒で完了。
    """
    if not _cmd_exists(cmd):
        logger.info(f"[{label}] command not found: {cmd}")
        return False
    try:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "test.tex"
            p.write_text(tex_source, encoding="utf-8")
            t0 = time.monotonic()
            r = subprocess.run(
                [cmd, "-interaction=nonstopmode", "-halt-on-error",
                 "-file-line-error", "-output-directory", d, str(p)],
                capture_output=True, text=True, timeout=timeout, cwd=d, env=env,
            )
            elapsed = time.monotonic() - t0
            ok = r.returncode == 0 and (Path(d) / "test.pdf").exists()
            if ok:
                logger.info(f"[{label}] compile test: OK ({elapsed:.1f}s)")
            else:
                tail = (r.stdout + r.stderr).strip().split("\n")[-5:]
                logger.warning(f"[{label}] compile test FAILED (rc={r.returncode}, {elapsed:.1f}s): {' | '.join(tail)}")
            return ok
    except subprocess.TimeoutExpired:
        logger.warning(f"[{label}] compile test TIMEOUT ({timeout}s)")
        return False
    except Exception as e:
        logger.warning(f"[{label}] compile test exception: {e}")
        return False


def _run_warmup():
    """バックグラウンドで lualatex 動作確認 (ビルドキャッシュ活用で高速)"""
    global LUALATEX_JA_OK, _lualatex_cache_warm

    logger.info("[warmup] Starting lualatex verification (build cache should exist)...")
    t0 = time.monotonic()

    if LUALATEX_AVAILABLE:
        tex = (
            "\\documentclass{article}\n"
            "\\usepackage[haranoaji]{luatexja-preset}\n"
            f"\\begin{{document}}\n{_JP_TEST_TEXT}\n\\end{{document}}\n"
        )
        LUALATEX_JA_OK = _test_compile(LUALATEX_CMD, tex, TEX_ENV, "warmup:lualatex", timeout=30)
        if LUALATEX_JA_OK:
            _lualatex_cache_warm = True
    else:
        logger.error("[warmup] lualatex not available! Check TeX Live installation.")

    elapsed = time.monotonic() - t0
    logger.info(
        f"[warmup] Complete ({elapsed:.1f}s): lualatex={'OK' if LUALATEX_JA_OK else 'NG'}"
    )
    _warmup_event.set()


def start_background_warmup():
    """バックグラウンドでウォームアップスレッドを開始"""
    global _warmup_started
    with _warmup_lock:
        if _warmup_started:
            return
        _warmup_started = True

    t = threading.Thread(target=_run_warmup, daemon=True, name="tex-warmup")
    t.start()
    logger.info("[warmup] Background warmup thread started")


def wait_for_warmup(timeout: float = 10.0) -> bool:
    """ウォームアップ完了を待つ"""
    if _warmup_event.is_set():
        return True
    logger.info(f"[warmup] Waiting for warmup (max {timeout}s)...")
    return _warmup_event.wait(timeout=timeout)


def is_warmup_done() -> bool:
    return _warmup_event.is_set()


def is_lualatex_cache_warm() -> bool:
    return _lualatex_cache_warm


# ── ログ出力 ──
logger.info(
    f"[init] LuaLaTeX-only mode: "
    f"lualatex={'avail' if LUALATEX_AVAILABLE else 'N/A'}, "
    f"luatexja.sty={'OK' if LUATEXJA_STY_AVAILABLE else 'NG'}, "
    f"luatexja-preset.sty={'OK' if LUATEXJA_PRESET_AVAILABLE else 'NG'}"
)
logger.info(f"[init] Commands: lualatex={LUALATEX_CMD}, pdftocairo={PDFTOCAIRO_CMD}")


# ══════════════════════════════════════════════════════════════════
# 4. Ghostscript (dvisvgm 用)
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

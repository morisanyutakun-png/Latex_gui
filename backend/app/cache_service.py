"""
コンパイルキャッシュサービス: ハッシュベースのPDF/SVGキャッシュ

方針:
  - ドキュメントのハッシュ値でキャッシュキーを生成
  - ディスクベース（メモリ節約、512MB環境対応）
  - LRU 方式で古いキャッシュを自動削除
  - .aux ファイル再利用による差分コンパイル高速化
"""
import hashlib
import json
import logging
import os
import shutil
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ─── 設定 ─────────────────────────────────────────────
CACHE_DIR = Path(os.environ.get("CACHE_DIR", "/tmp/latex-gui-cache"))
PDF_CACHE_DIR = CACHE_DIR / "pdf"
SVG_CACHE_DIR = CACHE_DIR / "svg"
AUX_CACHE_DIR = CACHE_DIR / "aux"  # .aux ファイル再利用用

# キャッシュサイズ制限
MAX_PDF_CACHE_MB = int(os.environ.get("MAX_PDF_CACHE_MB", "100"))
MAX_SVG_CACHE_ENTRIES = int(os.environ.get("MAX_SVG_CACHE_ENTRIES", "256"))
MAX_AUX_CACHE_ENTRIES = int(os.environ.get("MAX_AUX_CACHE_ENTRIES", "50"))

# キャッシュ有効期限 (秒)
CACHE_TTL = int(os.environ.get("CACHE_TTL_SECONDS", "3600"))  # 1時間


def _ensure_dirs():
    """キャッシュディレクトリを作成"""
    for d in (PDF_CACHE_DIR, SVG_CACHE_DIR, AUX_CACHE_DIR):
        d.mkdir(parents=True, exist_ok=True)


_ensure_dirs()


def _hash_document(doc_dict: dict) -> str:
    """ドキュメント辞書から安定したハッシュを生成"""
    # blocks と settings のみをハッシュ対象にする（metadata の変更はPDFに影響するので含む）
    canonical = json.dumps(doc_dict, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


def _hash_string(s: str) -> str:
    """文字列のハッシュ"""
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:32]


# ═══════════════════════════════════════════════════════════════
# PDF キャッシュ
# ═══════════════════════════════════════════════════════════════

def get_cached_pdf(doc_dict: dict) -> Optional[bytes]:
    """キャッシュされたPDFを取得。なければ None"""
    cache_key = _hash_document(doc_dict)
    pdf_path = PDF_CACHE_DIR / f"{cache_key}.pdf"
    meta_path = PDF_CACHE_DIR / f"{cache_key}.meta"

    if not pdf_path.exists() or not meta_path.exists():
        return None

    # TTL チェック
    try:
        meta = json.loads(meta_path.read_text())
        if time.time() - meta.get("created", 0) > CACHE_TTL:
            # 期限切れ
            pdf_path.unlink(missing_ok=True)
            meta_path.unlink(missing_ok=True)
            logger.info(f"[cache] PDF expired: {cache_key}")
            return None
    except Exception:
        return None

    try:
        pdf_bytes = pdf_path.read_bytes()
        # アクセス時刻を更新 (LRU)
        pdf_path.touch()
        meta_path.touch()
        logger.info(f"[cache] PDF hit: {cache_key}")
        return pdf_bytes
    except Exception:
        return None


def store_cached_pdf(doc_dict: dict, pdf_bytes: bytes) -> str:
    """PDFをキャッシュに保存。キャッシュキーを返す"""
    _ensure_dirs()
    cache_key = _hash_document(doc_dict)
    pdf_path = PDF_CACHE_DIR / f"{cache_key}.pdf"
    meta_path = PDF_CACHE_DIR / f"{cache_key}.meta"

    try:
        pdf_path.write_bytes(pdf_bytes)
        meta_path.write_text(json.dumps({
            "created": time.time(),
            "size": len(pdf_bytes),
        }))
        logger.info(f"[cache] PDF stored: {cache_key} ({len(pdf_bytes)} bytes)")

        # キャッシュサイズ制限の適用
        _enforce_pdf_cache_limit()
    except Exception as e:
        logger.warning(f"[cache] Failed to store PDF: {e}")

    return cache_key


def _enforce_pdf_cache_limit():
    """PDFキャッシュの合計サイズを制限"""
    try:
        pdf_files = sorted(
            PDF_CACHE_DIR.glob("*.pdf"),
            key=lambda p: p.stat().st_mtime
        )
        total_size = sum(f.stat().st_size for f in pdf_files)
        max_bytes = MAX_PDF_CACHE_MB * 1024 * 1024

        while total_size > max_bytes and pdf_files:
            oldest = pdf_files.pop(0)
            total_size -= oldest.stat().st_size
            oldest.unlink(missing_ok=True)
            # メタファイルも削除
            meta = oldest.with_suffix(".meta")
            meta.unlink(missing_ok=True)
            logger.info(f"[cache] Evicted PDF: {oldest.name}")
    except Exception as e:
        logger.warning(f"[cache] Eviction error: {e}")


# ═══════════════════════════════════════════════════════════════
# SVG キャッシュ (改良版: ディスクベース)
# ═══════════════════════════════════════════════════════════════

def get_cached_svg(code: str, block_type: str) -> Optional[str]:
    """キャッシュされたSVGを取得。なければ None"""
    cache_key = _hash_string(f"{block_type}:{code}")
    svg_path = SVG_CACHE_DIR / f"{cache_key}.svg"

    if not svg_path.exists():
        return None

    # TTL チェック
    try:
        mtime = svg_path.stat().st_mtime
        if time.time() - mtime > CACHE_TTL:
            svg_path.unlink(missing_ok=True)
            return None
    except Exception:
        return None

    try:
        svg = svg_path.read_text(encoding="utf-8")
        svg_path.touch()  # LRU 更新
        logger.debug(f"[cache] SVG hit: {cache_key}")
        return svg
    except Exception:
        return None


def store_cached_svg(code: str, block_type: str, svg: str) -> str:
    """SVGをキャッシュに保存"""
    _ensure_dirs()
    cache_key = _hash_string(f"{block_type}:{code}")
    svg_path = SVG_CACHE_DIR / f"{cache_key}.svg"

    try:
        svg_path.write_text(svg, encoding="utf-8")
        _enforce_svg_cache_limit()
    except Exception as e:
        logger.warning(f"[cache] Failed to store SVG: {e}")

    return cache_key


def _enforce_svg_cache_limit():
    """SVGキャッシュのエントリ数を制限"""
    try:
        svg_files = sorted(
            SVG_CACHE_DIR.glob("*.svg"),
            key=lambda p: p.stat().st_mtime
        )
        while len(svg_files) > MAX_SVG_CACHE_ENTRIES:
            oldest = svg_files.pop(0)
            oldest.unlink(missing_ok=True)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════
# .aux ファイルキャッシュ (差分コンパイル)
# ═══════════════════════════════════════════════════════════════

def get_cached_aux(latex_hash: str) -> Optional[Path]:
    """前回コンパイルの .aux ファイルがあればそのディレクトリパスを返す"""
    aux_dir = AUX_CACHE_DIR / latex_hash
    aux_file = aux_dir / "document.aux"

    if aux_file.exists():
        logger.debug(f"[cache] AUX hit: {latex_hash}")
        return aux_dir
    return None


def store_aux_files(latex_hash: str, compile_dir: Path):
    """コンパイル後の .aux ファイルをキャッシュに保存"""
    _ensure_dirs()
    aux_dir = AUX_CACHE_DIR / latex_hash
    aux_dir.mkdir(exist_ok=True)

    try:
        for ext in (".aux", ".toc", ".lot", ".lof", ".out"):
            src = compile_dir / f"document{ext}"
            if src.exists():
                shutil.copy2(str(src), str(aux_dir / src.name))
        _enforce_aux_cache_limit()
    except Exception as e:
        logger.warning(f"[cache] Failed to store AUX: {e}")


def _enforce_aux_cache_limit():
    """AUXキャッシュのエントリ数を制限"""
    try:
        aux_dirs = sorted(
            [d for d in AUX_CACHE_DIR.iterdir() if d.is_dir()],
            key=lambda d: d.stat().st_mtime
        )
        while len(aux_dirs) > MAX_AUX_CACHE_ENTRIES:
            oldest = aux_dirs.pop(0)
            shutil.rmtree(str(oldest), ignore_errors=True)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════
# キャッシュ統計
# ═══════════════════════════════════════════════════════════════

def get_cache_stats() -> dict:
    """キャッシュの統計情報を返す"""
    stats = {}

    try:
        pdf_files = list(PDF_CACHE_DIR.glob("*.pdf"))
        stats["pdf"] = {
            "entries": len(pdf_files),
            "total_mb": round(sum(f.stat().st_size for f in pdf_files) / (1024 * 1024), 2),
            "max_mb": MAX_PDF_CACHE_MB,
        }
    except Exception:
        stats["pdf"] = {"entries": 0, "total_mb": 0, "max_mb": MAX_PDF_CACHE_MB}

    try:
        svg_files = list(SVG_CACHE_DIR.glob("*.svg"))
        stats["svg"] = {
            "entries": len(svg_files),
            "max_entries": MAX_SVG_CACHE_ENTRIES,
        }
    except Exception:
        stats["svg"] = {"entries": 0, "max_entries": MAX_SVG_CACHE_ENTRIES}

    try:
        aux_dirs = [d for d in AUX_CACHE_DIR.iterdir() if d.is_dir()]
        stats["aux"] = {
            "entries": len(aux_dirs),
            "max_entries": MAX_AUX_CACHE_ENTRIES,
        }
    except Exception:
        stats["aux"] = {"entries": 0, "max_entries": MAX_AUX_CACHE_ENTRIES}

    return stats


def clear_all_caches():
    """全キャッシュをクリア"""
    for d in (PDF_CACHE_DIR, SVG_CACHE_DIR, AUX_CACHE_DIR):
        try:
            if d.exists():
                shutil.rmtree(str(d))
        except Exception:
            pass
    _ensure_dirs()
    logger.info("[cache] All caches cleared")

"""
PDF生成サービス: LaTeX生成 → LuaLaTeX コンパイル → PDF返却 (v8 — 512MBメモリ最適化)

方針:
  - エンジン: lualatex のみ (フォールバックなし)
  - 日本語: luatexja-preset[haranoaji]
  - shell-escape 原則禁止
  - Docker ビルド時にフォントキャッシュ・パッケージDB を完全構築済み
  - ランタイムは純粋なコンパイルのみ
  - Koyeb Free (512MB) での動作を保証:
    - 同時コンパイル=1 (同時に2プロセス走ると即OOM)
    - コンパイル前後で積極的にGC
    - RLIMIT_AS制限廃止 (LuaTeXの仮想メモリが大きいだけで実メモリは少ない)
"""
import asyncio
import gc
import os
import shutil
import subprocess
import tempfile
import logging
import time
from pathlib import Path

from .models import DocumentModel
from .generators.document_generator import generate_document_latex
from .tex_env import (
    TEX_ENV, LUALATEX_CMD, LUALATEX_AVAILABLE,
    wait_for_warmup, is_lualatex_cache_warm,
)
from .security import (
    validate_document_security, validate_input_size,
    SecurityViolation, get_compile_args,
)
from .cache_service import (
    get_cached_pdf, store_cached_pdf,
    get_cached_aux, store_aux_files,
)
from .audit import log_compile_event, log_security_event, AuditEvent

logger = logging.getLogger(__name__)

# ── 同時コンパイル制限 ──
# Koyeb Free (512MB) では絶対に1。LuaLaTeX 1プロセスで300-400MB使う。
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT_COMPILES", "1"))
_compile_semaphore = asyncio.Semaphore(MAX_CONCURRENT)

# コンパイルタイムアウト (秒) — ビルド時キャッシュ済みなので通常3-10秒で完了
COMPILE_TIMEOUT = int(os.environ.get("COMPILE_TIMEOUT_SECONDS", "300"))


def _log_memory(label: str) -> None:
    """現在のRSSメモリをログ出力 (デバッグ用)"""
    try:
        import resource
        import platform
        usage = resource.getrusage(resource.RUSAGE_SELF)
        maxrss = usage.ru_maxrss
        if platform.system() == "Linux":
            maxrss *= 1024  # Linux: KB → bytes
        rss_mb = maxrss / (1024 * 1024)
        logger.info(f"[memory:{label}] RSS={rss_mb:.1f}MB")
    except Exception:
        pass


class PDFGenerationError(Exception):
    """PDF生成時のエラー（ユーザー向けメッセージ付き）"""
    def __init__(self, user_message: str, detail: str = ""):
        self.user_message = user_message
        self.detail = detail
        super().__init__(user_message)


def generate_latex(doc: DocumentModel) -> str:
    """DocumentModelからLaTeXソースを生成 (lualatex 固定)"""
    return generate_document_latex(doc, engine="lualatex")


async def compile_pdf(doc: DocumentModel) -> bytes:
    """LaTeX生成 → LuaLaTeX コンパイル → PDFバイト列"""
    async with _compile_semaphore:
        return await asyncio.get_event_loop().run_in_executor(
            None, _compile_pdf_sync, doc
        )


def _compile_pdf_sync(doc: DocumentModel) -> bytes:
    """同期版 PDF 生成 — LuaLaTeX 一本
    
    512MB環境でのメモリ管理:
    - コンパイル前にGCでPython側のメモリを解放
    - コンパイル後もGCでPDFバイト以外を解放
    
    セキュリティ:
    - サンドボックスコンパイル (--no-shell-escape)
    - 入力サイズ制限
    - 危険コマンド検出
    
    キャッシュ:
    - ドキュメントハッシュによるPDFキャッシュ
    - .aux ファイル再利用による差分高速化
    """
    t0 = time.monotonic()

    # ── セキュリティ検査 ──
    advanced_mode = getattr(doc, 'advanced', None) and doc.advanced.enabled
    
    # 入力サイズ制限
    size_error = validate_input_size(doc.blocks)
    if size_error:
        raise PDFGenerationError(size_error)
    
    # 危険コマンド検査
    violations = validate_document_security(doc.blocks, advanced_mode=advanced_mode)
    if violations:
        log_security_event(violations, action="blocked")
        raise PDFGenerationError(
            f"セキュリティポリシー違反: {'; '.join(violations[:3])}",
            detail=str(violations)
        )

    # ── PDFキャッシュチェック ──
    doc_dict = doc.model_dump(by_alias=False)
    cached_pdf = get_cached_pdf(doc_dict)
    if cached_pdf:
        elapsed = time.monotonic() - t0
        log_compile_event(
            AuditEvent.COMPILE_PDF,
            template=doc.template,
            block_count=len(doc.blocks),
            compile_time_ms=elapsed * 1000,
            cache_hit=True,
            pdf_size=len(cached_pdf),
        )
        return cached_pdf

    # GCでPython側のメモリを事前解放
    gc.collect()
    _log_memory("pre-compile")

    # ウォームアップ待ち (コマンド確認のみなので即完了)
    wait_for_warmup(timeout=2.0)

    # lualatex コマンド存在確認
    cmd_exists = bool(shutil.which(LUALATEX_CMD) or Path(LUALATEX_CMD).is_file())
    if not cmd_exists:
        raise PDFGenerationError(
            "LuaLaTeX エンジンがシステムに見つかりません。",
            detail=f"{LUALATEX_CMD} not found in PATH"
        )

    timeout = COMPILE_TIMEOUT
    logger.info(f"[compile] lualatex (timeout={timeout}s)")

    try:
        latex_source = generate_document_latex(doc, engine="lualatex")
        pdf = _compile_latex(latex_source, timeout=timeout)
        elapsed = time.monotonic() - t0
        logger.info(f"[compile] PDF generated with lualatex ({elapsed:.1f}s)")
        _log_memory("post-compile")
        
        # キャッシュに保存
        store_cached_pdf(doc_dict, pdf)
        
        # 監査ログ
        log_compile_event(
            AuditEvent.COMPILE_PDF,
            template=doc.template,
            block_count=len(doc.blocks),
            compile_time_ms=elapsed * 1000,
            cache_hit=False,
            pdf_size=len(pdf),
        )
        
        return pdf
    except PDFGenerationError:
        raise
    except Exception as e:
        log_compile_event(
            AuditEvent.COMPILE_PDF,
            template=doc.template,
            block_count=len(doc.blocks),
            error=str(e),
        )
        raise PDFGenerationError(
            f"PDF生成中に予期しないエラーが発生しました: {e}",
            detail=str(e),
        )
    finally:
        gc.collect()


def _compile_latex(latex_source: str, timeout: int = 120) -> bytes:
    """LuaLaTeX でコンパイルしPDFバイト列を返す"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "document.tex"
        pdf_path = Path(tmpdir) / "document.pdf"

        tex_path.write_text(latex_source, encoding="utf-8")
        logger.info("Compiling with lualatex...")

        cmd_args = get_compile_args(
            LUALATEX_CMD,
            str(tmpdir),
            str(tex_path),
        )

        try:
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=tmpdir,
                env=TEX_ENV,
            )
        except FileNotFoundError:
            raise PDFGenerationError(
                "LuaLaTeX エンジンが見つかりません。",
                detail="lualatex command not found"
            )
        except subprocess.TimeoutExpired:
            raise PDFGenerationError(
                "PDF生成に時間がかかりすぎました。内容を短くして再度お試しください。",
                detail=f"lualatex compilation timeout ({timeout}s)"
            )

        if result.returncode != 0:
            log_output = result.stdout + "\n" + result.stderr
            logger.error(f"lualatex failed (exit={result.returncode}):\n{log_output[-3000:]}")

            # OOM / signal kill 検出
            if result.returncode < 0:
                import signal as _signal
                try:
                    sig_name = _signal.Signals(-result.returncode).name
                except (ValueError, AttributeError):
                    sig_name = str(-result.returncode)
                raise PDFGenerationError(
                    f"PDF生成プロセスが強制終了されました (signal: {sig_name})。メモリ不足の可能性があります。",
                    detail=f"Process killed by {sig_name}. Log: {log_output[-1000:]}"
                )

            user_msg = _parse_latex_error(log_output)
            raise PDFGenerationError(user_msg, detail=log_output[-2000:])

        if not pdf_path.exists():
            raise PDFGenerationError(
                "PDFファイルの生成に失敗しました。",
                detail="PDF not found after lualatex compilation"
            )

        pdf_bytes = pdf_path.read_bytes()

    gc.collect()
    return pdf_bytes


async def compile_raw_latex(latex_source: str) -> bytes:
    """生のLaTeXソースをそのままコンパイルしてPDFバイト列を返す（LaTeXソースビューワ編集用）"""
    async with _compile_semaphore:
        return await asyncio.get_event_loop().run_in_executor(
            None, _compile_raw_latex_sync, latex_source
        )


def _compile_raw_latex_sync(latex_source: str) -> bytes:
    """同期版: 生LaTeXソースをコンパイル"""
    if len(latex_source) > 1_000_000:
        raise PDFGenerationError("LaTeXソースが大きすぎます (上限: 1MB)")
    # 危険なコマンドのみ簡易チェック
    _DANGEROUS = ["\\write18", "\\immediate\\write18", "\\input{/", "\\include{/"]
    for cmd in _DANGEROUS:
        if cmd in latex_source:
            raise PDFGenerationError(f"使用禁止のコマンドが含まれています: {cmd}")
    gc.collect()
    timeout = COMPILE_TIMEOUT
    pdf = _compile_latex(latex_source, timeout=timeout)
    gc.collect()
    return pdf


def _parse_latex_error(log: str) -> str:
    """LaTeXログからユーザー向けエラーメッセージを推定"""
    log_lower = log.lower()

    # Extract actual error lines (lines starting with !)
    error_lines = [l.strip() for l in log.split("\n") if l.strip().startswith("!")]
    error_detail = error_lines[0] if error_lines else ""

    if not error_detail:
        for line in log.split("\n"):
            line_s = line.strip()
            if "fatal" in line_s.lower() or "error" in line_s.lower():
                if 10 < len(line_s) < 200:
                    error_detail = line_s
                    break

    if "undefined control sequence" in log_lower:
        return f"未定義のコマンドがあります。入力内容を確認してください。({error_detail})"
    if "missing $ inserted" in log_lower:
        return "数式記号の処理でエラーが発生しました。$や%などの記号が入力に含まれていないか確認してください。"
    if "extra alignment tab" in log_lower or "misplaced" in log_lower:
        return "表の列数が一致していない可能性があります。表の内容を確認してください。"
    if "file not found" in log_lower and "image" in log_lower:
        return "画像の読み込みに失敗しました。画像URLが正しいか確認してください。"
    if "luatexja" in log_lower and "not found" in log_lower:
        return "luatexjaパッケージが見つかりません。TeX Live が正しくインストールされているか確認してください。"
    if "fontspec error" in log_lower or ("fontspec" in log_lower and "not found" in log_lower):
        return f"フォントの読み込みに問題があります。({error_detail})"
    if "emergency stop" in log_lower:
        return f"文書の処理中に重大なエラーが発生しました。({error_detail})"
    if "file not found" in log_lower:
        return f"必要なファイルが見つかりません。({error_detail})"

    if error_detail:
        return f"PDF生成エラー: {error_detail}"

    meaningful_lines = [l.strip() for l in log.split("\n") if l.strip() and not l.startswith("(")]
    tail = meaningful_lines[-5:] if meaningful_lines else []
    tail_str = "; ".join(tail)[:200]
    return f"PDFコンパイルに失敗しました。(ログ: {tail_str})" if tail_str else "PDFの作成中にエラーが発生しました。サーバーログを確認してください。"

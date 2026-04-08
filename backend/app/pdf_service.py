"""
PDF生成サービス: raw LaTeX → LuaLaTeX コンパイル → PDF返却

方針:
  - DocumentModel.latex を直接コンパイルする
  - エンジン: lualatex のみ (フォールバックなし)
  - 日本語: luatexja-preset[haranoaji]
  - shell-escape 原則禁止
  - Koyeb Free (512MB) 同時コンパイル=1
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
from .tex_env import (
    TEX_ENV, LUALATEX_CMD,
    wait_for_warmup,
)
from .security import (
    validate_latex_security, validate_latex_size,
    get_compile_args, format_violations,
)
from .cache_service import (
    get_cached_pdf, store_cached_pdf,
)
from .audit import log_compile_event, log_security_event, AuditEvent

logger = logging.getLogger(__name__)

MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT_COMPILES", "1"))
_compile_semaphore = asyncio.Semaphore(MAX_CONCURRENT)
COMPILE_TIMEOUT = int(os.environ.get("COMPILE_TIMEOUT_SECONDS", "300"))


def _log_memory(label: str) -> None:
    try:
        import resource
        import platform
        usage = resource.getrusage(resource.RUSAGE_SELF)
        maxrss = usage.ru_maxrss
        if platform.system() == "Linux":
            maxrss *= 1024
        rss_mb = maxrss / (1024 * 1024)
        logger.info(f"[memory:{label}] RSS={rss_mb:.1f}MB")
    except Exception:
        pass


class PDFGenerationError(Exception):
    """PDF生成時のエラー（ユーザー向けメッセージ付き）

    Phase 2 改修:
      - code / params / violations フィールドを追加
      - フロントエンドが i18n でローカライズできるよう、機械可読な形でも情報を保持
      - user_message は **フォールバック** 文字列 (ロケール解決できないクライアント用)
    """
    def __init__(
        self,
        user_message: str,
        detail: str = "",
        *,
        code: str | None = None,
        params: dict | None = None,
        violations: list | None = None,
    ):
        self.user_message = user_message
        self.detail = detail
        self.code = code
        self.params = params or {}
        self.violations = violations or []
        super().__init__(user_message)


def generate_latex(doc: DocumentModel) -> str:
    """DocumentModel から LaTeX ソースを取得（raw latex をそのまま返す）"""
    return doc.latex or ""


async def compile_pdf(doc: DocumentModel) -> bytes:
    """raw LaTeX → LuaLaTeX コンパイル → PDFバイト列"""
    async with _compile_semaphore:
        return await asyncio.get_event_loop().run_in_executor(
            None, _compile_pdf_sync, doc
        )


def _compile_pdf_sync(doc: DocumentModel) -> bytes:
    """同期版 PDF 生成 — LuaLaTeX 一本"""
    t0 = time.monotonic()

    latex_source = doc.latex or ""

    # 入力サイズ制限
    size_error = validate_latex_size(latex_source)
    if size_error:
        raise PDFGenerationError(size_error)

    # 危険コマンド検査
    violations = validate_latex_security(latex_source)
    if violations:
        log_security_event(violations, action="blocked")
        # user_message は **英語のフォールバック** にする (locale-aware なクライアントは
        # violations[] と code を見て自前で i18n するため、ここの文字列は最後の砦)
        raise PDFGenerationError(
            f"Security policy violation: {format_violations(violations, lang='en')}",
            detail=str(violations),
            code="security_violation",
            violations=violations,
        )

    # PDFキャッシュチェック
    doc_dict = doc.model_dump(by_alias=False)
    cached_pdf = get_cached_pdf(doc_dict)
    if cached_pdf:
        elapsed = time.monotonic() - t0
        log_compile_event(
            AuditEvent.COMPILE_PDF,
            template=doc.template,
            compile_time_ms=elapsed * 1000,
            cache_hit=True,
            pdf_size=len(cached_pdf),
        )
        return cached_pdf

    gc.collect()
    _log_memory("pre-compile")

    wait_for_warmup(timeout=2.0)

    cmd_exists = bool(shutil.which(LUALATEX_CMD) or Path(LUALATEX_CMD).is_file())
    if not cmd_exists:
        raise PDFGenerationError(
            "LuaLaTeX エンジンがシステムに見つかりません。",
            detail=f"{LUALATEX_CMD} not found in PATH"
        )

    timeout = COMPILE_TIMEOUT
    logger.info(f"[compile] lualatex (timeout={timeout}s)")

    try:
        pdf = _compile_latex(latex_source, timeout=timeout)
        elapsed = time.monotonic() - t0
        logger.info(f"[compile] PDF generated with lualatex ({elapsed:.1f}s)")
        _log_memory("post-compile")

        store_cached_pdf(doc_dict, pdf)

        log_compile_event(
            AuditEvent.COMPILE_PDF,
            template=doc.template,
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
    """生のLaTeXソースをそのままコンパイルしてPDFバイト列を返す"""
    async with _compile_semaphore:
        return await asyncio.get_event_loop().run_in_executor(
            None, _compile_raw_latex_sync, latex_source
        )


def _compile_raw_latex_sync(latex_source: str) -> bytes:
    """同期版: 生LaTeXソースをコンパイル"""
    size_error = validate_latex_size(latex_source)
    if size_error:
        raise PDFGenerationError(size_error, code="latex_too_large")
    violations = validate_latex_security(latex_source)
    if violations:
        log_security_event(violations, action="blocked")
        raise PDFGenerationError(
            f"Security policy violation: {format_violations(violations, lang='en')}",
            detail=str(violations),
            code="security_violation",
            violations=violations,
        )
    gc.collect()
    timeout = COMPILE_TIMEOUT
    pdf = _compile_latex(latex_source, timeout=timeout)
    gc.collect()
    return pdf


def _parse_latex_error(log: str) -> str:
    """LaTeXログからユーザー向けエラーメッセージを推定"""
    log_lower = log.lower()

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

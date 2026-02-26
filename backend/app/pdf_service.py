"""
PDF生成サービス: LaTeX生成 → コンパイル → PDF返却

軽量クラウド対応:
  - 起動時にエンジンを自動テスト (pdflatex+CJK → xelatex の優先度)
  - CJK.sty が無い環境では自動的に xelatex にフォールバック
  - asyncio Semaphore で最大同時コンパイル数を制限 (OOM 防止)
"""
import asyncio
import gc
import os
import platform
import shutil
import subprocess
import tempfile
import logging
from pathlib import Path

from .models import DocumentModel
from .generators.document_generator import generate_document_latex
from .tex_env import (
    TEX_ENV, XELATEX_CMD, PDFLATEX_CMD, LUALATEX_CMD,
    DEFAULT_ENGINE, FALLBACK_ENGINES,
    CJK_STY_AVAILABLE, PDFLATEX_CJK_OK, LUALATEX_JA_OK, XELATEX_OK,
)

logger = logging.getLogger(__name__)

# ── 同時コンパイル制限 ──
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT_COMPILES", "2"))
_compile_semaphore = asyncio.Semaphore(MAX_CONCURRENT)

# メモリ上限 (bytes)。Linux で resource.setrlimit に使用。
# xelatex は仮想メモリ 500MB+ 必要なため、十分な値を設定する
MEM_LIMIT_MB = int(os.environ.get("COMPILE_MEM_LIMIT_MB", "512"))
MEM_LIMIT_BYTES = MEM_LIMIT_MB * 1024 * 1024

# エンジンコマンドマップ
ENGINE_CMD = {
    "pdflatex": PDFLATEX_CMD,
    "lualatex": LUALATEX_CMD,
    "xelatex": XELATEX_CMD,
}


class PDFGenerationError(Exception):
    """PDF生成時のエラー（ユーザー向けメッセージ付き）"""
    def __init__(self, user_message: str, detail: str = ""):
        self.user_message = user_message
        self.detail = detail
        super().__init__(user_message)


def _make_preexec_fn():
    """subprocess 実行前にメモリ上限を設定する関数を返す (Linux のみ)"""
    if platform.system() != "Linux":
        return None
    def _set_limits():
        try:
            import resource
            # RLIMIT_AS: 仮想メモリ上限
            resource.setrlimit(resource.RLIMIT_AS, (MEM_LIMIT_BYTES, MEM_LIMIT_BYTES))
        except Exception:
            pass  # 設定失敗しても続行
    return _set_limits


def generate_latex(doc: DocumentModel) -> str:
    """DocumentModelからLaTeXソースを生成 (自動検出エンジン用)"""
    return generate_document_latex(doc, engine=DEFAULT_ENGINE)


async def compile_pdf(doc: DocumentModel) -> bytes:
    """LaTeX生成 → コンパイル → PDFバイト列

    非同期セマフォで同時コンパイル数を制限し、クラウド環境の OOM を防止。
    起動時テスト済みのエンジンを優先使用。
    """
    async with _compile_semaphore:
        return await asyncio.get_event_loop().run_in_executor(
            None, _compile_pdf_sync, doc
        )


def _compile_pdf_sync(doc: DocumentModel) -> bytes:
    """同期版 PDF 生成 (スレッドプールで実行される)

    3エンジンフォールバック:
      1. DEFAULT_ENGINE (起動時テスト済み)
      2. FALLBACK_ENGINES (残りのエンジンを順に試行)
    """
    engines_to_try = [DEFAULT_ENGINE] + FALLBACK_ENGINES

    logger.info(
        f"PDF compilation: engines={engines_to_try}, "
        f"pdflatex_cjk={'OK' if PDFLATEX_CJK_OK else 'NG'}, "
        f"lualatex_ja={'OK' if LUALATEX_JA_OK else 'NG'}, "
        f"xelatex={'OK' if XELATEX_OK else 'NG'}"
    )

    errors: list[tuple[str, PDFGenerationError]] = []

    # ── 全エンジンを順に試行 ──
    for engine_name in engines_to_try:
        engine_cmd = ENGINE_CMD.get(engine_name)
        if not engine_cmd:
            continue

        # コマンドの存在確認 (PATH + 直接パス)
        cmd_exists = bool(shutil.which(engine_cmd) or Path(engine_cmd).is_file())
        if not cmd_exists:
            logger.warning(f"{engine_name} ({engine_cmd}) not found on system, skipping")
            errors.append((engine_name, PDFGenerationError(
                f"{engine_name}がシステムに見つかりません",
                detail=f"{engine_cmd} not found in PATH"
            )))
            continue

        try:
            latex_source = generate_document_latex(doc, engine=engine_name)
            pdf = _compile_latex(latex_source, engine_cmd, timeout=45)
            logger.info(f"PDF generated successfully with {engine_name}")
            return pdf
        except PDFGenerationError as e:
            logger.warning(f"{engine_name} failed: {e.user_message}")
            errors.append((engine_name, e))

    # ── 全エンジン失敗 ──
    # 実際のエラー内容を全て含めたメッセージを構築
    error_details = []
    user_messages = []
    for eng, err in errors:
        user_messages.append(f"[{eng}] {err.user_message}")
        error_details.append(f"--- {eng} ---\n{err.detail}")

    combined_detail = "\n".join(error_details)
    combined_msg = " / ".join(user_messages)

    raise PDFGenerationError(
        f"PDF生成に失敗しました: {combined_msg}",
        detail=combined_detail,
    )


def _compile_latex(latex_source: str, engine_cmd: str, timeout: int = 30) -> bytes:
    """指定エンジンでLaTeXソースをコンパイルしPDFバイト列を返す"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "document.tex"
        pdf_path = Path(tmpdir) / "document.pdf"

        tex_path.write_text(latex_source, encoding="utf-8")
        engine_name = Path(engine_cmd).name
        logger.info(f"Compiling with {engine_name}...")

        try:
            result = subprocess.run(
                [
                    engine_cmd,
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-no-shell-escape",
                    "-output-directory", str(tmpdir),
                    str(tex_path),
                ],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=tmpdir,
                env=TEX_ENV,
                preexec_fn=_make_preexec_fn(),
            )
        except FileNotFoundError:
            raise PDFGenerationError(
                f"PDF生成エンジン({engine_name})が見つかりません。",
                detail=f"{engine_name} command not found"
            )
        except subprocess.TimeoutExpired:
            raise PDFGenerationError(
                "PDF生成に時間がかかりすぎました。内容を短くして再度お試しください。",
                detail=f"{engine_name} compilation timeout ({timeout}s)"
            )

        if result.returncode != 0:
            log_output = result.stdout + "\n" + result.stderr
            logger.error(f"{engine_name} failed (exit={result.returncode}):\n{log_output[-3000:]}")

            # Detect OOM kill / signal kill (negative return codes)
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
                detail=f"PDF not found after {engine_name} compilation"
            )

        pdf_bytes = pdf_path.read_bytes()

    # コンパイル後に GC を促進 (メモリ逼迫時の回収)
    gc.collect()
    return pdf_bytes


def _parse_latex_error(log: str) -> str:
    """LaTeXログからユーザー向けエラーメッセージを推定"""
    log_lower = log.lower()

    # Extract actual error lines (lines starting with !)
    error_lines = [l.strip() for l in log.split("\n") if l.strip().startswith("!")]
    error_detail = error_lines[0] if error_lines else ""

    # Also look for key error patterns in the full log
    if not error_detail:
        # fontspec errors use a different format
        for line in log.split("\n"):
            line_s = line.strip()
            if "fatal" in line_s.lower() or "error" in line_s.lower():
                if len(line_s) > 10 and len(line_s) < 200:
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
    # CJK.sty / bxcjkjatype missing (pdflatex Japanese support package)
    if "cjk.sty" in log_lower and "not found" in log_lower:
        return "日本語サポートパッケージ(CJK.sty)が見つかりません。"
    if "bxcjkjatype.sty" in log_lower and "not found" in log_lower:
        return "日本語サポートパッケージ(bxcjkjatype.sty)が見つかりません。"
    if "luatexja.sty" in log_lower and "not found" in log_lower:
        return "luatexjaパッケージが見つかりません。"
    if "xecjk.sty" in log_lower and "not found" in log_lower:
        return "xeCJKパッケージが見つかりません。"
    # CJK font errors — setCJKmainfont / setCJKsansfont コマンドの実行エラーのみ検出
    # (LaTeX変数名 CJKmainfontset 等の誤検出を防ぐため、厳密にパターンを限定)
    if "\\setcjkmainfont" in log_lower or "\\setcjksansfont" in log_lower:
        if "not found" in log_lower or "cannot" in log_lower:
            return "CJKフォントが見つかりません。システムにフォントがインストールされているか確認してください。"
    # Generic font error (e.g. setmainfont used with non-existent font)
    if "fontspec error" in log_lower or "fontspec" in log_lower and "not found" in log_lower:
        return f"フォントの読み込みに問題があります。({error_detail})"
    if "emergency stop" in log_lower:
        return f"文書の処理中に重大なエラーが発生しました。({error_detail})"
    if "file not found" in log_lower:
        return f"必要なファイルが見つかりません。({error_detail})"

    # Default: include the first error line for diagnosis
    if error_detail:
        return f"PDF生成エラー: {error_detail}"

    # Last resort: include last meaningful log lines for diagnosis
    meaningful_lines = [l.strip() for l in log.split("\n") if l.strip() and not l.startswith("(")]
    tail = meaningful_lines[-5:] if meaningful_lines else []
    tail_str = "; ".join(tail)[:200]
    return f"PDFコンパイルに失敗しました。(ログ: {tail_str})" if tail_str else "PDFの作成中にエラーが発生しました。サーバーログを確認してください。"

"""
PDF生成サービス: LaTeX生成 → コンパイル → PDF返却

メモリ効率のため pdflatex を優先使用し、失敗時のみ xelatex にフォールバック。
pdflatex: ~50MB / xelatex: ~200-500MB (クラウド環境で OOM 回避)
"""
import subprocess
import tempfile
import logging
from pathlib import Path

from .models import DocumentModel
from .generators.document_generator import generate_document_latex
from .tex_env import TEX_ENV, XELATEX_CMD, PDFLATEX_CMD

logger = logging.getLogger(__name__)


class PDFGenerationError(Exception):
    """PDF生成時のエラー（ユーザー向けメッセージ付き）"""
    def __init__(self, user_message: str, detail: str = ""):
        self.user_message = user_message
        self.detail = detail
        super().__init__(user_message)


def generate_latex(doc: DocumentModel) -> str:
    """DocumentModelからLaTeXソースを生成 (pdflatex互換)"""
    return generate_document_latex(doc, engine="pdflatex")


def compile_pdf(doc: DocumentModel) -> bytes:
    """LaTeX生成 → コンパイル → PDFバイト列 (pdflatex優先、xelatexフォールバック)

    pdflatex は ~50MB、xelatex は ~200-500MB のメモリを使用。
    クラウド環境（Koyeb等）での OOM SIGKILL を回避するため pdflatex を優先。
    """
    # ── Strategy 1: pdflatex (low memory, fast) ──
    try:
        latex_source = generate_document_latex(doc, engine="pdflatex")
        pdf = _compile_latex(latex_source, PDFLATEX_CMD, timeout=30)
        logger.info("PDF generated successfully with pdflatex")
        return pdf
    except PDFGenerationError as e:
        logger.warning(f"pdflatex failed: {e.user_message}")

    # ── Strategy 2: xelatex fallback (better font/unicode, more memory) ──
    logger.info("Falling back to xelatex...")
    latex_source = generate_document_latex(doc, engine="xelatex")
    pdf = _compile_latex(latex_source, XELATEX_CMD, timeout=45)
    logger.info("PDF generated successfully with xelatex (fallback)")
    return pdf


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

        return pdf_path.read_bytes()


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
    # CJK font errors
    if ("cjkmainfont" in log_lower or "cjksansfont" in log_lower) and ("not found" in log_lower or "cannot" in log_lower):
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

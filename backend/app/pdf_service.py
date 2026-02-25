"""
PDF生成サービス: LaTeX生成 → XeLaTeXコンパイル → PDF返却
"""
import subprocess
import tempfile
import logging
from pathlib import Path

from .models import DocumentModel
from .generators.document_generator import generate_document_latex
from .tex_env import TEX_ENV, XELATEX_CMD

logger = logging.getLogger(__name__)


class PDFGenerationError(Exception):
    """PDF生成時のエラー（ユーザー向けメッセージ付き）"""
    def __init__(self, user_message: str, detail: str = ""):
        self.user_message = user_message
        self.detail = detail
        super().__init__(user_message)


def generate_latex(doc: DocumentModel) -> str:
    """DocumentModelからLaTeXソースを生成"""
    return generate_document_latex(doc)


def compile_pdf(doc: DocumentModel) -> bytes:
    """LaTeX生成 → XeLaTeXコンパイル → PDFバイト列を返す"""
    latex_source = generate_latex(doc)

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "document.tex"
        pdf_path = Path(tmpdir) / "document.pdf"

        tex_path.write_text(latex_source, encoding="utf-8")
        logger.info(f"LaTeX source written to {tex_path}")

        try:
            result = subprocess.run(
                [
                    XELATEX_CMD,
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-no-shell-escape",
                    "-output-directory", str(tmpdir),
                    str(tex_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=tmpdir,
                env=TEX_ENV,
            )
        except FileNotFoundError:
            raise PDFGenerationError(
                "PDF生成エンジンが見つかりません。サーバーの設定を確認してください。",
                detail="xelatex command not found"
            )
        except subprocess.TimeoutExpired:
            raise PDFGenerationError(
                "PDF生成に時間がかかりすぎました。内容を短くして再度お試しください。",
                detail="XeLaTeX compilation timeout (30s)"
            )

        if result.returncode != 0:
            log_output = result.stdout + "\n" + result.stderr
            logger.error(f"XeLaTeX compilation failed:\n{log_output}")

            user_msg = _parse_latex_error(log_output)
            raise PDFGenerationError(user_msg, detail=log_output[-2000:])

        if not pdf_path.exists():
            raise PDFGenerationError(
                "PDFファイルの生成に失敗しました。内容を確認してもう一度お試しください。",
                detail="PDF file not found after compilation"
            )

        return pdf_path.read_bytes()


def _parse_latex_error(log: str) -> str:
    """LaTeXログからユーザー向けエラーメッセージを推定"""
    log_lower = log.lower()

    # Extract actual error lines (lines starting with !)
    error_lines = [l.strip() for l in log.split("\n") if l.strip().startswith("!")]
    error_detail = error_lines[0] if error_lines else ""

    if "undefined control sequence" in log_lower:
        return f"未定義のコマンドがあります。入力内容を確認してください。({error_detail})"
    if "missing $ inserted" in log_lower:
        return "数式記号の処理でエラーが発生しました。$や%などの記号が入力に含まれていないか確認してください。"
    if "extra alignment tab" in log_lower or "misplaced" in log_lower:
        return "表の列数が一致していない可能性があります。表の内容を確認してください。"
    if "file not found" in log_lower and "image" in log_lower:
        return "画像の読み込みに失敗しました。画像URLが正しいか確認してください。"
    # CJK font errors — very specific pattern
    if ("cjkmainfont" in log_lower or "cjksansfont" in log_lower) and ("not found" in log_lower or "cannot" in log_lower):
        return "CJKフォントが見つかりません。システムにフォントがインストールされているか確認してください。"
    # Generic font error (e.g. setmainfont used with non-existent font)
    if "fontspec error" in log_lower:
        return f"フォントの読み込みに問題があります。({error_detail})"
    if "emergency stop" in log_lower:
        return f"文書の処理中に重大なエラーが発生しました。({error_detail})"
    if "file not found" in log_lower:
        return f"必要なファイルが見つかりません。({error_detail})"

    # Default: include the first error line for diagnosis
    if error_detail:
        return f"PDF生成エラー: {error_detail}"
    return "PDFの作成中にエラーが発生しました。入力内容を確認してもう一度お試しください。"

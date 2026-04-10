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
import re
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
from .latex_autofix import autofix_latex, autofix_after_failure

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


_AUTOFIX_MAX_ROUNDS = int(os.environ.get("LATEX_AUTOFIX_MAX_ROUNDS", "3"))


def _compile_latex(latex_source: str, timeout: int = 120) -> bytes:
    """LuaLaTeX でコンパイルしPDFバイト列を返す。

    AI 出力や手書き LaTeX の細かいミスを救うため、ここでは
      1. autofix_latex() で先に軽量サニタイズ + 不足パッケージ補完
      2. 失敗したら autofix_after_failure() でログを解析しパッケージ補完 / no-op stub を
         注入し、最大 LATEX_AUTOFIX_MAX_ROUNDS 回までリトライ
    の段階で挑戦する。最後まで失敗したら PDFGenerationError を投げる。

    各ラウンドで autofix_after_failure が「変化なし」を返した場合は早期に打ち切る
    (同じ修復を何度も試しても無意味なため)。
    """
    # 1) コンパイル前サニタイズ
    fixed_source = autofix_latex(latex_source)

    pdf_bytes, log_output = _try_compile_once(fixed_source, timeout)
    if pdf_bytes is not None:
        gc.collect()
        return pdf_bytes

    # 2) 失敗ログから不足パッケージ / stub を補ってリトライ — 最大 N 回
    current_source = fixed_source
    for round_idx in range(1, _AUTOFIX_MAX_ROUNDS + 1):
        retried_source = autofix_after_failure(current_source, log_output or "")
        if not retried_source or retried_source == current_source:
            break
        logger.info(f"[autofix] retry round {round_idx}/{_AUTOFIX_MAX_ROUNDS}")
        retry_pdf, retry_log = _try_compile_once(retried_source, timeout)
        if retry_pdf is not None:
            logger.info(f"[autofix] recovered after round {round_idx}")
            gc.collect()
            return retry_pdf
        # 次のラウンドに向けてソースとログを更新
        current_source = retried_source
        log_output = retry_log or log_output

    # ここまで来たら救えない — 元のエラー扱いで投げ直す
    user_msg = _parse_latex_error(log_output or "")
    raise PDFGenerationError(user_msg, detail=(log_output or "")[-2000:])


def _try_compile_once(latex_source: str, timeout: int) -> tuple[bytes | None, str | None]:
    """1 回だけ lualatex を呼ぶ。成功なら (bytes, None)、失敗なら (None, log)。

    タイムアウトや FileNotFoundError は救済不能なので即 PDFGenerationError を投げる。
    シグナル kill (returncode<0) もメモリ不足が疑われるため救済しない。
    """
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

            return None, log_output

        if not pdf_path.exists():
            raise PDFGenerationError(
                "PDFファイルの生成に失敗しました。",
                detail="PDF not found after lualatex compilation"
            )

        return pdf_path.read_bytes(), None


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


def _strip_temp_paths(text: str) -> str:
    """エラーメッセージからテンポラリファイルのパス断片を除去する。

    例: '/var/folders/.../tmpabc/document.tex:118:' → '(line 118):'
        '/tmp/tmpevc2ejh1/document.tex:118: ==> Fatal' → '(line 118): ==> Fatal'
    """
    if not text:
        return text
    # tmpXXX/document.tex:NNN: パターン → (line NNN):
    text = re.sub(
        r"(?:/[^\s/]+)*?/tmp[^/\s]*/document\.tex:(\d+):?",
        r"(line \1):",
        text,
    )
    # 残った /tmp/.../foo.sty などの絶対パスは末尾だけ残す
    text = re.sub(r"/(?:tmp|var)/[^\s'\"]*/", "", text)
    return text


def _extract_error_line_number(log: str) -> int | None:
    """LaTeX ログから最初に出てくる行番号を抽出する。

    対応形式:
      - `l.42 \\foo`              (古典的な lualatex 出力)
      - `/tmp/.../document.tex:42:`  (-file-line-error 出力)
    """
    if not log:
        return None
    m = re.search(r"document\.tex:(\d+):", log)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass
    m = re.search(r"\bl\.(\d+)\b", log)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass
    return None


def _extract_undefined_command_name(log: str) -> str | None:
    """ログから「未定義コントロールシーケンス」のコマンド名 (\\foo) を抽出する。

    lualatex の出力フォーマットは複数あり:
      1) `! Undefined control sequence.`        (改行)
         `l.42 \\foo`                            ← ここに名前
                       `{arg}`
      2) `/tmp/.../document.tex:42: Undefined control sequence.` (改行)
         `l.42 \\foo`
      3) `! Undefined control sequence. \\foo`   (一行版 — 一部のバージョン)

    どの形式でも `l.NN \\name` ペアが必ず付随するので、`Undefined control
    sequence` 付近で最初に出てくる `\\foo` を返す。
    """
    if not log:
        return None
    # 「Undefined control sequence」マーカー以降のスライスから探す
    idx = log.lower().find("undefined control sequence")
    if idx < 0:
        return None
    snippet = log[idx: idx + 800]
    # まず `l.NN \\foo` パターン優先
    m = re.search(r"\bl\.\d+\s+(\\[a-zA-Z@]+)", snippet)
    if m:
        return m.group(1)
    # 次に snippet 内の任意の `\\foo` を拾う
    m = re.search(r"(\\[a-zA-Z@]+)", snippet)
    if m:
        cmd = m.group(1)
        # `\foo` の `\foo` 自身が "control" の一部にならないように長さ判定
        if len(cmd) > 1 and cmd not in (r"\foo",):
            return cmd
    return None


def _extract_undefined_environment_name(log: str) -> str | None:
    if not log:
        return None
    m = re.search(r"Environment\s+([A-Za-z*]+)\s+undefined", log, re.IGNORECASE)
    return m.group(1) if m else None


def _parse_latex_error(log: str) -> str:
    """LaTeXログからユーザー向けエラーメッセージを推定。

    Phase 4 改修:
      - `-file-line-error` 形式 (`!` で始まらない) のエラー行も拾う
      - 「未定義コマンド」エラーは具体的な `\\foo` 名と行番号を本文に含める
      - 「==> Fatal error occurred ...」のような末尾フッタは error_detail として
        採用しない (本来の原因行を優先する)
      - lualatex の 79 字行折り返し (`Un\\ndefined ...`) を再結合してから解析
    """
    if not log:
        return "PDFの作成中にエラーが発生しました。サーバーログを確認してください。"

    # 行折り返しを再結合してからキーワード判定する
    from .latex_autofix import _unwrap_tex_log
    log = _unwrap_tex_log(log)
    log_lower = log.lower()

    # 1) `! ...` で始まる本物のエラー行を集める。
    #    ただし「==> Fatal error occurred」だけは中身が無いので除外する。
    error_lines = [
        l.strip()
        for l in log.split("\n")
        if l.strip().startswith("!") and "fatal error occurred" not in l.lower()
    ]
    error_detail = error_lines[0] if error_lines else ""

    # 2) `-file-line-error` 形式 (`/path/document.tex:42: foo`) も拾う。
    #    こちらも Fatal フッタは除外する。
    if not error_detail:
        for line in log.split("\n"):
            line_s = line.strip()
            if "document.tex:" in line_s and ":" in line_s:
                lower = line_s.lower()
                if "fatal error occurred" in lower:
                    continue
                if "error" in lower or "undefined" in lower or "missing" in lower:
                    if 10 < len(line_s) < 300:
                        error_detail = line_s
                        break

    # 3) 上記いずれも無ければ、最後の手段として「fatal/error」を含む行を拾う
    if not error_detail:
        for line in log.split("\n"):
            line_s = line.strip()
            if "fatal error occurred" in line_s.lower():
                continue
            if "fatal" in line_s.lower() or "error" in line_s.lower():
                if 10 < len(line_s) < 300:
                    error_detail = line_s
                    break

    error_detail = _strip_temp_paths(error_detail)

    line_no = _extract_error_line_number(log)
    line_hint = f"行 {line_no}" if line_no else ""

    if "undefined control sequence" in log_lower:
        cmd = _extract_undefined_command_name(log)
        if cmd:
            base = f"未定義のコマンド {cmd} があります"
        else:
            base = "未定義のコマンドがあります"
        if line_hint:
            base += f" ({line_hint})"
        base += "。コマンド名のスペルを確認してください。"
        return base

    if "environment" in log_lower and "undefined" in log_lower:
        env = _extract_undefined_environment_name(log)
        target = f"環境 {env} " if env else "環境"
        if line_hint:
            return f"未定義の{target}があります ({line_hint})。環境名と \\begin / \\end の対応を確認してください。"
        return f"未定義の{target}があります。環境名と \\begin / \\end の対応を確認してください。"

    if "missing $ inserted" in log_lower:
        suffix = f" ({line_hint})" if line_hint else ""
        return f"数式記号の処理でエラーが発生しました{suffix}。$や%などの記号が入力に含まれていないか確認してください。"
    if "extra alignment tab" in log_lower or "misplaced alignment" in log_lower:
        suffix = f" ({line_hint})" if line_hint else ""
        return f"表の列数が一致していない可能性があります{suffix}。表の内容を確認してください。"
    if "missing } inserted" in log_lower or "missing { inserted" in log_lower:
        suffix = f" ({line_hint})" if line_hint else ""
        return f"波括弧 {{ }} の対応が取れていません{suffix}。"
    if "runaway argument" in log_lower:
        suffix = f" ({line_hint})" if line_hint else ""
        return f"閉じられていない引数 (Runaway argument) があります{suffix}。{{ }} の対応を確認してください。"
    if "paragraph ended before" in log_lower:
        suffix = f" ({line_hint})" if line_hint else ""
        return f"段落が想定外の位置で終わりました{suffix}。引数の途中で空行が入っていないか確認してください。"
    if "file not found" in log_lower and "image" in log_lower:
        return "画像の読み込みに失敗しました。画像URLが正しいか確認してください。"
    if "luatexja" in log_lower and "not found" in log_lower:
        return "luatexjaパッケージが見つかりません。TeX Live が正しくインストールされているか確認してください。"
    if "fontspec error" in log_lower or ("fontspec" in log_lower and "not found" in log_lower):
        return f"フォントの読み込みに問題があります。({error_detail})"
    if "emergency stop" in log_lower:
        # Emergency stop は副次エラー — 直前の本物のエラーがあればそちらを優先
        if error_detail and "emergency stop" not in error_detail.lower():
            return f"PDF生成エラー: {error_detail}"
        return f"文書の処理中に重大なエラーが発生しました。({error_detail or 'emergency stop'})"
    if "file" in log_lower and "not found" in log_lower:
        return f"必要なファイルが見つかりません。({error_detail})"

    if error_detail:
        return f"PDF生成エラー: {error_detail}"

    meaningful_lines = [l.strip() for l in log.split("\n") if l.strip() and not l.startswith("(")]
    tail = meaningful_lines[-5:] if meaningful_lines else []
    tail_str = "; ".join(tail)[:200]
    return f"PDFコンパイルに失敗しました。(ログ: {tail_str})" if tail_str else "PDFの作成中にエラーが発生しました。サーバーログを確認してください。"

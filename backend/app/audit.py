"""
監査ログシステム: テンプレ・変数・本文の変更を追跡

方針:
  - JSON 構造化ログ (機械可読)
  - リクエストベースのミドルウェアでアクセスログ
  - 操作ごとの詳細監査ログ
  - ファイル + stdout 出力
"""
import json
import logging
import time
import uuid
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Any
from contextvars import ContextVar

logger = logging.getLogger(__name__)

# ─── 設定 ─────────────────────────────────────────────
AUDIT_LOG_DIR = Path(os.environ.get("AUDIT_LOG_DIR", "/tmp/latex-gui-audit"))
AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)

# リクエストコンテキスト
_request_id: ContextVar[str] = ContextVar("request_id", default="")
_client_id: ContextVar[str] = ContextVar("client_id", default="anonymous")


# ═══════════════════════════════════════════════════════════════
# 監査イベント種別
# ═══════════════════════════════════════════════════════════════

class AuditEvent:
    """監査イベント定義"""
    # ドキュメント操作
    DOC_CREATE = "document.create"
    DOC_UPDATE = "document.update"
    DOC_DELETE = "document.delete"

    # テンプレート操作
    TEMPLATE_SELECT = "template.select"
    TEMPLATE_MODIFY = "template.modify"

    # 変数操作 (量産用)
    VARIABLE_SET = "variable.set"
    VARIABLE_BATCH_IMPORT = "variable.batch_import"

    # コンパイル
    COMPILE_PDF = "compile.pdf"
    COMPILE_PREVIEW = "compile.preview"
    COMPILE_BATCH = "compile.batch"

    # セキュリティ
    SECURITY_VIOLATION = "security.violation"
    SECURITY_BLOCKED = "security.blocked"

    # 上級者モード
    ADVANCED_PREAMBLE = "advanced.preamble"
    ADVANCED_HOOK = "advanced.hook"

    # キャッシュ
    CACHE_HIT = "cache.hit"
    CACHE_MISS = "cache.miss"
    CACHE_CLEAR = "cache.clear"


def _get_audit_file() -> Path:
    """日付ベースの監査ログファイルパスを返す"""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return AUDIT_LOG_DIR / f"audit-{date_str}.jsonl"


def log_audit(
    event: str,
    *,
    client_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    document_hash: Optional[str] = None,
    template: Optional[str] = None,
    success: bool = True,
    error: Optional[str] = None,
):
    """
    監査ログエントリを記録。

    Args:
        event: イベント種別 (AuditEvent.* を使用)
        client_id: クライアント識別子
        details: 追加詳細情報
        document_hash: ドキュメントのハッシュ値
        template: テンプレート名
        success: 成功/失敗
        error: エラーメッセージ
    """
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "request_id": _request_id.get(""),
        "client_id": client_id or _client_id.get("anonymous"),
        "success": success,
    }

    if document_hash:
        entry["document_hash"] = document_hash
    if template:
        entry["template"] = template
    if details:
        entry["details"] = details
    if error:
        entry["error"] = error

    # JSON文字列化
    log_line = json.dumps(entry, ensure_ascii=False, default=str)

    # stdout ログ
    logger.info(f"[audit] {log_line}")

    # ファイル出力
    try:
        audit_file = _get_audit_file()
        with open(audit_file, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")
    except Exception as e:
        logger.warning(f"[audit] Failed to write audit log: {e}")


def log_compile_event(
    event_type: str,
    *,
    template: Optional[str] = None,
    block_count: int = 0,
    compile_time_ms: Optional[float] = None,
    cache_hit: bool = False,
    pdf_size: Optional[int] = None,
    error: Optional[str] = None,
):
    """コンパイルイベント用のショートカット"""
    details: dict[str, Any] = {
        "block_count": block_count,
        "cache_hit": cache_hit,
    }
    if compile_time_ms is not None:
        details["compile_time_ms"] = round(compile_time_ms, 1)
    if pdf_size is not None:
        details["pdf_size_bytes"] = pdf_size

    log_audit(
        event_type,
        template=template,
        details=details,
        success=error is None,
        error=error,
    )


def log_security_event(
    violations: list[str],
    *,
    block_type: Optional[str] = None,
    action: str = "blocked",
):
    """セキュリティイベント用のショートカット"""
    log_audit(
        AuditEvent.SECURITY_VIOLATION if action == "detected" else AuditEvent.SECURITY_BLOCKED,
        details={
            "violations": violations[:10],  # 最大10件
            "block_type": block_type,
            "action": action,
        },
        success=False,
    )


def log_batch_event(
    *,
    template: Optional[str] = None,
    variable_count: int = 0,
    row_count: int = 0,
    success_count: int = 0,
    error_count: int = 0,
    total_time_ms: Optional[float] = None,
):
    """バッチ生成イベント用のショートカット"""
    log_audit(
        AuditEvent.COMPILE_BATCH,
        template=template,
        details={
            "variable_count": variable_count,
            "row_count": row_count,
            "success_count": success_count,
            "error_count": error_count,
            "total_time_ms": round(total_time_ms, 1) if total_time_ms else None,
        },
        success=error_count == 0,
    )


# ═══════════════════════════════════════════════════════════════
# FastAPI ミドルウェア
# ═══════════════════════════════════════════════════════════════

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class AuditMiddleware(BaseHTTPMiddleware):
    """
    リクエストレベルの監査ログミドルウェア。
    各リクエストに一意のIDを付与し、処理時間を記録。
    """

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        _request_id.set(request_id)

        # クライアントID (ヘッダーまたはIP)
        client_id = request.headers.get("X-Client-Id", "")
        if not client_id:
            client_id = request.client.host if request.client else "unknown"
        _client_id.set(client_id)

        start_time = time.monotonic()
        
        try:
            response = await call_next(request)
            elapsed_ms = (time.monotonic() - start_time) * 1000

            # API エンドポイントのみログ (静的ファイル等は除外)
            path = request.url.path
            if path.startswith("/api/"):
                logger.info(
                    f"[request] {request_id} {request.method} {path} "
                    f"→ {response.status_code} ({elapsed_ms:.0f}ms) "
                    f"client={client_id}"
                )

            return response
        except Exception as e:
            elapsed_ms = (time.monotonic() - start_time) * 1000
            logger.error(
                f"[request] {request_id} {request.method} {request.url.path} "
                f"→ ERROR ({elapsed_ms:.0f}ms): {e}"
            )
            raise


# ═══════════════════════════════════════════════════════════════
# 監査ログ閲覧
# ═══════════════════════════════════════════════════════════════

def get_recent_audit_logs(limit: int = 100) -> list[dict]:
    """最近の監査ログを取得"""
    logs: list[dict] = []

    try:
        log_files = sorted(AUDIT_LOG_DIR.glob("audit-*.jsonl"), reverse=True)
        for log_file in log_files[:7]:  # 直近7日分
            with open(log_file, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        logs.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        continue
            if len(logs) >= limit:
                break
    except Exception as e:
        logger.warning(f"[audit] Failed to read audit logs: {e}")

    return logs[-limit:]

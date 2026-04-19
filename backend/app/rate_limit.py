"""依存関係なしの軽量 rate limiter (in-memory sliding window)。

単一プロセスの FastAPI を前提とする。マルチワーカ (Gunicorn workers > 1) や
マルチインスタンス環境では各プロセスが独立したカウンタを持つため、実効 rate は
`N_workers` 倍になる点に注意 (それでも無制限よりは格段に良い)。

使い方:
    @app.post("/api/expensive")
    async def expensive(request: Request, ...):
        enforce_rate_limit(request, "expensive", limit=10, window_seconds=60)
        ...

設計:
    - キーは (ルート名, クライアント識別子) の組。認証済みユーザーは user_id、
      未認証は IP (X-Forwarded-For 先頭) を使う。
    - 各キーごとに直近 N 件のリクエスト timestamp を deque で保持し、
      window から古いものを削除してから長さを見る。
    - メモリリークを防ぐため 5 分ごとに古いキーを GC する。
"""
from __future__ import annotations

import os
import time
from collections import deque
from threading import Lock
from typing import Optional

from fastapi import HTTPException, Request


# key → deque[timestamp] / 最終アクセス時刻
_buckets: dict[str, deque[float]] = {}
_last_seen: dict[str, float] = {}
_lock = Lock()
_last_gc: float = 0.0
_GC_INTERVAL_SECONDS = 300.0
_GC_EXPIRE_SECONDS = 3600.0  # 1 時間アクセスがなかったキーは破棄


def _client_key(request: Request) -> str:
    """認証済みなら user_id、未認証なら X-Forwarded-For / client IP を返す。"""
    # 同一プロセス内で設定された Depends の値を拾う方法はないため、ヘッダ由来の
    # user_id を直接見る。フロントの proxy が必ず転送するのでほぼ一致する。
    uid = request.headers.get("x-user-id", "").strip()
    if uid:
        return f"u:{uid}"
    xff = request.headers.get("x-forwarded-for", "").strip()
    if xff:
        # 複数ホップの場合は先頭が真のクライアント IP
        ip = xff.split(",")[0].strip()
        if ip:
            return f"ip:{ip}"
    # 最終 fallback
    if request.client and request.client.host:
        return f"ip:{request.client.host}"
    return "ip:unknown"


def _maybe_gc(now: float) -> None:
    """古いキーを破棄。呼び出し元で _lock を取得している前提。"""
    global _last_gc
    if now - _last_gc < _GC_INTERVAL_SECONDS:
        return
    _last_gc = now
    cutoff = now - _GC_EXPIRE_SECONDS
    stale = [k for k, t in _last_seen.items() if t < cutoff]
    for k in stale:
        _buckets.pop(k, None)
        _last_seen.pop(k, None)


def check_and_record(
    key: str,
    *,
    limit: int,
    window_seconds: float,
) -> tuple[bool, int, float]:
    """key に対するアクセスを記録して、制限を超えていないか判定する。

    Returns (allowed, remaining, retry_after_seconds)
      allowed=True なら通す。False なら HTTP 429 を返すべき。
    """
    now = time.monotonic()
    with _lock:
        _maybe_gc(now)
        bucket = _buckets.get(key)
        if bucket is None:
            bucket = deque()
            _buckets[key] = bucket
        # window 外の古いエントリを落とす
        threshold = now - window_seconds
        while bucket and bucket[0] < threshold:
            bucket.popleft()
        _last_seen[key] = now
        if len(bucket) >= limit:
            oldest = bucket[0]
            retry_after = max(0.0, window_seconds - (now - oldest))
            return (False, 0, retry_after)
        bucket.append(now)
        return (True, limit - len(bucket), 0.0)


# 環境変数で rate limit 自体を無効化できるようにする (テスト・ローカル用)。
# 既定で有効 — env 未設定でも正しい動作。
def _enabled() -> bool:
    return os.environ.get("RATE_LIMIT_DISABLED", "").lower() not in ("1", "true", "yes")


def enforce_rate_limit(
    request: Request,
    route_name: str,
    *,
    limit: int,
    window_seconds: float,
    error_message: Optional[str] = None,
) -> None:
    """rate limit を強制する。超えていたら 429 を raise する。"""
    if not _enabled():
        return
    key = f"{route_name}|{_client_key(request)}"
    allowed, remaining, retry_after = check_and_record(
        key, limit=limit, window_seconds=window_seconds
    )
    if not allowed:
        msg = error_message or (
            f"リクエストが多すぎます。{int(retry_after) + 1} 秒後に再度お試しください。"
        )
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMITED",
                "message": msg,
                "retry_after_seconds": int(retry_after) + 1,
            },
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
    _ = remaining  # 将来的に X-RateLimit-Remaining ヘッダを返す余地

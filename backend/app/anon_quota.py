"""匿名ユーザの「無料 1 枚」を、シークレットウィンドウを跨いでも追跡する軽量ストア。

仕様:
  - フロントが計算した安定指紋 (`x-eddivom-fp`, sha256 16〜32 桁の hex) を受け取り、
    「直近 7 日でこの指紋が無料生成を成功させたか」を記録する。
  - 指紋単独だと衝突 / 共用端末の事故が出るので、IP も AND 条件にしたい場面では
    `mark_used(fp, ip=...)` で複合キーも追加できる。本実装ではまず指紋のみ。
  - 1 プロセス内 in-memory。マルチワーカでは worker ごとに独立する点に注意
    (現行の rate_limit.py と同じ設計方針 — 完璧な不正対策ではなく濫用抑止)。

成功時のみ `mark_used` を呼ぶこと。失敗で消費するとユーザーが正規 1 回を
失うので必ず PDF レスポンスを返したあとに記録する。
"""
from __future__ import annotations

import re
import time
from threading import Lock


_USED_AT: dict[str, float] = {}
_lock = Lock()
_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 日
_LAST_GC: float = 0.0
_GC_INTERVAL = 600.0  # 10 分

_FP_RE = re.compile(r"^[a-f0-9]{16,64}$")


def _maybe_gc(now: float) -> None:
    global _LAST_GC
    if now - _LAST_GC < _GC_INTERVAL:
        return
    _LAST_GC = now
    cutoff = now - _TTL_SECONDS
    stale = [k for k, t in _USED_AT.items() if t < cutoff]
    for k in stale:
        _USED_AT.pop(k, None)


def normalize_fp(raw: str | None) -> str | None:
    """ヘッダ値を正規化する。形式不正なら None。"""
    if not raw:
        return None
    s = raw.strip().lower()
    if not _FP_RE.match(s):
        return None
    return s


def is_used(fp: str) -> bool:
    """指紋がまだ TTL 内で「無料消費済み」か。"""
    now = time.monotonic()
    with _lock:
        _maybe_gc(now)
        ts = _USED_AT.get(fp)
        if ts is None:
            return False
        if now - ts > _TTL_SECONDS:
            _USED_AT.pop(fp, None)
            return False
        return True


def mark_used(fp: str) -> None:
    """指紋を消費済みにする。"""
    if not fp:
        return
    now = time.monotonic()
    with _lock:
        _maybe_gc(now)
        _USED_AT[fp] = now


def reset_for_test() -> None:
    """テスト用: ストアを完全クリア。"""
    with _lock:
        _USED_AT.clear()

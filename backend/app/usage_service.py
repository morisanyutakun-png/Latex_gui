"""サーバサイド利用量トラッキング。

UsageLog テーブルへの記録と、月次/日次の使用量集計、
プラン上限に照らした quota 判定を提供する。
"""
from __future__ import annotations

import datetime
import logging
from typing import TypedDict

from sqlalchemy import func
from sqlalchemy.orm import Session

from .db_models import UsageLog
from .plan_limits import Action, PlanId, get_limits


logger = logging.getLogger(__name__)


class QuotaCheck(TypedDict):
    allowed: bool
    reason: str
    code: str          # "OK" / "AI_DAILY_LIMIT" / "AI_MONTHLY_LIMIT" / "PDF_MONTHLY_LIMIT"
    plan_id: str
    used_day: int
    used_month: int
    limit_day: int
    limit_month: int


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _start_of_month_utc(now: datetime.datetime) -> datetime.datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _start_of_day_utc(now: datetime.datetime) -> datetime.datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def count_since(db: Session, user_id: str, action: Action, since: datetime.datetime) -> int:
    q = (
        db.query(func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.action == action,
            UsageLog.created_at >= since,
        )
    )
    return int(q.scalar() or 0)


def count_month(db: Session, user_id: str, action: Action) -> int:
    return count_since(db, user_id, action, _start_of_month_utc(_utcnow()))


def count_day(db: Session, user_id: str, action: Action) -> int:
    return count_since(db, user_id, action, _start_of_day_utc(_utcnow()))


def log_usage(db: Session, user_id: str, action: Action) -> None:
    """アクションを記録する。失敗してもエンドポイントは落とさない。

    成功/失敗の両方を `logger.info` / `logger.error` で出力する。
    「DBに保存されていないのでは?」という疑いが出たとき、Koyeb のログを
    この出力で grep すれば事実を確認できる。
    """
    try:
        row = UsageLog(user_id=user_id, action=action)
        db.add(row)
        db.commit()
        # info レベルで積む (個人情報ではないので本番でもログ出力して OK)
        logger.info(
            "[usage] logged user=%s action=%s row_id=%s",
            user_id, action, row.id,
        )
    except Exception as e:
        # ERROR レベル: サイレントに吞まない。書き込み失敗 = 課金上の重大事故。
        logger.error(
            "[usage] FAILED to log usage user=%s action=%s err=%s",
            user_id, action, e,
            exc_info=True,
        )
        db.rollback()


def check_ai_quota(db: Session, user_id: str, plan_id: PlanId) -> QuotaCheck:
    limits = get_limits(plan_id)
    used_day = count_day(db, user_id, "ai_request")
    used_month = count_month(db, user_id, "ai_request")
    limit_day = limits["ai_per_day"]
    limit_month = limits["ai_per_month"]

    if used_day >= limit_day:
        return QuotaCheck(
            allowed=False,
            reason=f"本日の高性能AI上限 ({limit_day}回) に達しました。プランをアップグレードすると上限が増えます。",
            code="AI_DAILY_LIMIT",
            plan_id=plan_id,
            used_day=used_day,
            used_month=used_month,
            limit_day=limit_day,
            limit_month=limit_month,
        )
    if used_month >= limit_month:
        return QuotaCheck(
            allowed=False,
            reason=f"今月の高性能AI上限 ({limit_month:,}回) に達しました。プランをアップグレードすると上限が増えます。",
            code="AI_MONTHLY_LIMIT",
            plan_id=plan_id,
            used_day=used_day,
            used_month=used_month,
            limit_day=limit_day,
            limit_month=limit_month,
        )
    return QuotaCheck(
        allowed=True, reason="", code="OK",
        plan_id=plan_id, used_day=used_day, used_month=used_month,
        limit_day=limit_day, limit_month=limit_month,
    )


def check_pdf_quota(db: Session, user_id: str, plan_id: PlanId) -> QuotaCheck:
    limits = get_limits(plan_id)
    limit_month = limits["pdf_per_month"]
    used_month = count_month(db, user_id, "pdf_export")

    if limit_month == 0:
        return QuotaCheck(
            allowed=True, reason="", code="OK",
            plan_id=plan_id, used_day=0, used_month=used_month,
            limit_day=0, limit_month=0,
        )

    if used_month >= limit_month:
        return QuotaCheck(
            allowed=False,
            reason=f"今月の教材PDF出力上限 ({limit_month}回) に達しました。Starterプラン以上でPDF出力が無制限になります。",
            code="PDF_MONTHLY_LIMIT",
            plan_id=plan_id,
            used_day=0,
            used_month=used_month,
            limit_day=0,
            limit_month=limit_month,
        )
    return QuotaCheck(
        allowed=True, reason="", code="OK",
        plan_id=plan_id, used_day=0, used_month=used_month,
        limit_day=0, limit_month=limit_month,
    )

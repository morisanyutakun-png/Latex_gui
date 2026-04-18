"""プラン別の上限値定義と、ユーザーの有効プラン解決。

フロントエンド `frontend/lib/plans.ts` と数値を一致させること。
バックエンドがサーバサイド強制のための単一のソース・オブ・トゥルース。
"""
from __future__ import annotations

from typing import Literal, Optional, TypedDict

from sqlalchemy.orm import Session

from .db_models import Subscription


PlanId = Literal["free", "starter", "pro", "premium"]
Action = Literal["ai_request", "pdf_export"]


class PlanLimits(TypedDict):
    ai_per_day: int       # 1日のAIリクエスト上限
    ai_per_month: int     # 月間AIリクエスト上限
    pdf_per_month: int    # 月間PDF出力上限 (0 = 無制限)
    batch_max_rows: int   # バッチ処理の最大行数 (0 = 利用不可)


# ── 各プランの上限値 ──────────────────────────────────────────────────────────
PLAN_LIMITS: dict[PlanId, PlanLimits] = {
    "free": {
        "ai_per_day": 3,
        "ai_per_month": 3,
        "pdf_per_month": 1,
        "batch_max_rows": 0,
    },
    "starter": {
        "ai_per_day": 15,
        "ai_per_month": 150,
        "pdf_per_month": 0,
        "batch_max_rows": 0,
    },
    "pro": {
        "ai_per_day": 40,
        "ai_per_month": 500,
        "pdf_per_month": 0,
        "batch_max_rows": 100,
    },
    "premium": {
        "ai_per_day": 150,
        "ai_per_month": 2000,
        "pdf_per_month": 0,
        "batch_max_rows": 300,
    },
}


def get_limits(plan_id: PlanId) -> PlanLimits:
    return PLAN_LIMITS.get(plan_id, PLAN_LIMITS["free"])


def get_effective_plan(db: Session, user_id: Optional[str]) -> PlanId:
    """ユーザーの現在の有効プランを返す。

    `active` / `trialing` のサブスクのみを有効と見なし、`past_due` や `canceled` は
    Free に降格させる（未払い状態で有料サービスを使わせない）。
    サブスクが無い or 未ログインなら `"free"`。
    """
    if not user_id:
        return "free"

    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status.in_(["active", "trialing"]),
        )
        .order_by(Subscription.updated_at.desc())
        .first()
    )
    if not sub:
        return "free"

    plan = sub.plan_id
    if plan in PLAN_LIMITS:
        return plan  # type: ignore[return-value]
    return "free"

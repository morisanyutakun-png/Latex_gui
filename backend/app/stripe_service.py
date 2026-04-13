"""Stripe SDK 呼び出しをまとめたサービスモジュール"""
import os
import datetime
import logging
from typing import Optional

import stripe
from sqlalchemy.orm import Session

from .db_models import User, Subscription

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# plan_id → Stripe Price ID のマッピング
PLAN_PRICE_IDS: dict[str, str] = {
    "starter": os.environ.get("STRIPE_PRICE_ID_STARTER", ""),
    "pro": os.environ.get("STRIPE_PRICE_ID_PRO", ""),
    "premium": os.environ.get("STRIPE_PRICE_ID_PREMIUM", ""),
}

# Stripe Price ID → plan_id の逆引き (webhook 処理で使用)
PRICE_TO_PLAN: dict[str, str] = {v: k for k, v in PLAN_PRICE_IDS.items() if v}


def create_or_get_customer(db: Session, user: User) -> str:
    """Stripe Customer を取得または作成し、stripe_customer_id を DB に保存して返す。"""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email or "",
        name=user.name or "",
        metadata={"user_id": user.id},
    )
    user.stripe_customer_id = customer.id
    db.commit()
    logger.info("Created Stripe customer %s for user %s", customer.id, user.id)
    return customer.id


def create_checkout_session(customer_id: str, plan_id: str, user_id: str = "") -> str:
    """Stripe Checkout Session を作成してURLを返す。"""
    price_id = PLAN_PRICE_IDS.get(plan_id)
    if not price_id:
        raise ValueError(f"Unknown plan_id or price not configured: {plan_id}")

    session = stripe.checkout.Session.create(
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/editor?checkout=success&plan={plan_id}",
        cancel_url=f"{FRONTEND_URL}/",
        metadata={"plan_id": plan_id, "user_id": user_id},
        subscription_data={"metadata": {"user_id": user_id, "plan_id": plan_id}},
    )
    return session.url


def create_portal_session(customer_id: str) -> str:
    """Stripe Customer Portal Session を作成してURLを返す。"""
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/",
    )
    return session.url


def _ts_to_dt(ts: Optional[int]) -> Optional[datetime.datetime]:
    if ts is None:
        return None
    return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)


def handle_webhook_event(payload: bytes, sig_header: str, db: Session) -> None:
    """Stripe Webhook イベントを検証して処理する。"""
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError as e:
        logger.warning("Stripe webhook signature verification failed: %s", e)
        raise

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info("Stripe webhook received: %s", event_type)

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data, db)

    elif event_type == "customer.subscription.created":
        _handle_subscription_created(data, db)

    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data, db)

    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data, db)

    elif event_type == "invoice.payment_succeeded":
        _handle_invoice_succeeded(data, db)

    elif event_type == "invoice.payment_failed":
        _handle_invoice_failed(data, db)

    else:
        logger.debug("Unhandled Stripe event type: %s", event_type)


# ── 個別イベントハンドラ ─────────────────────────────────────────────────────

def _handle_checkout_completed(session_obj: dict, db: Session) -> None:
    """checkout.session.completed: stripe_customer_id をユーザーに紐付ける。"""
    customer_id = session_obj.get("customer")
    if not customer_id:
        return

    # metadata.user_id でユーザーを特定
    meta_user_id = (session_obj.get("metadata") or {}).get("user_id")
    if not meta_user_id:
        # customer_id からユーザーを引く (フォールバック)
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            logger.info("checkout.completed: user %s already linked to customer %s", user.id, customer_id)
        else:
            logger.warning("checkout.completed: no user_id in metadata and no user for customer %s", customer_id)
        return

    user = db.query(User).filter(User.id == meta_user_id).first()
    if not user:
        logger.warning("checkout.completed: user %s not found in DB", meta_user_id)
        return

    if not user.stripe_customer_id:
        user.stripe_customer_id = customer_id
        db.commit()
        logger.info("Linked Stripe customer %s to user %s", customer_id, meta_user_id)

    # subscription が webhook の順番によってまだ来ていない場合があるので、
    # checkout session の subscription ID を使って即座に subscription を作成
    sub_id = session_obj.get("subscription")
    if sub_id:
        existing = db.query(Subscription).filter(Subscription.id == sub_id).first()
        if not existing:
            plan_id = (session_obj.get("metadata") or {}).get("plan_id", "unknown")
            sub = Subscription(
                id=sub_id,
                user_id=meta_user_id,
                stripe_price_id=PLAN_PRICE_IDS.get(plan_id, ""),
                plan_id=plan_id,
                status="active",
                cancel_at_period_end=False,
            )
            db.add(sub)
            db.commit()
            logger.info("Created subscription %s from checkout for user %s plan=%s", sub_id, meta_user_id, plan_id)


def _get_plan_from_subscription(sub_obj: dict) -> str:
    """Stripe Subscription オブジェクトから plan_id を解決する。"""
    # 1. Price ID から逆引き
    items = sub_obj.get("items", {}).get("data", [])
    if items:
        price_id = items[0].get("price", {}).get("id", "")
        plan = PRICE_TO_PLAN.get(price_id)
        if plan:
            return plan
    # 2. metadata.plan_id フォールバック (subscription_data で設定した値)
    meta_plan = (sub_obj.get("metadata") or {}).get("plan_id")
    if meta_plan:
        return meta_plan
    return "unknown"


def _get_user_id_from_customer(customer_id: str, db: Session) -> Optional[str]:
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    return user.id if user else None


def _handle_subscription_created(sub_obj: dict, db: Session) -> None:
    """customer.subscription.created: subscriptions テーブルに新規追加。"""
    sub_id = sub_obj["id"]
    customer_id = sub_obj.get("customer")
    user_id = _get_user_id_from_customer(customer_id, db)
    # subscription metadata からのフォールバック
    if not user_id:
        meta_user_id = (sub_obj.get("metadata") or {}).get("user_id")
        if meta_user_id:
            user = db.query(User).filter(User.id == meta_user_id).first()
            if user:
                user_id = user.id
                # customer_id も紐付け
                if not user.stripe_customer_id and customer_id:
                    user.stripe_customer_id = customer_id
                    db.commit()
    if not user_id:
        logger.warning("subscription.created: no user found for customer %s", customer_id)
        return

    plan_id = _get_plan_from_subscription(sub_obj)
    items = sub_obj.get("items", {}).get("data", [])
    price_id = items[0].get("price", {}).get("id", "") if items else ""

    existing = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if existing:
        return  # 冪等性: 既に存在する場合はスキップ

    sub = Subscription(
        id=sub_id,
        user_id=user_id,
        stripe_price_id=price_id,
        plan_id=plan_id,
        status=sub_obj.get("status", "active"),
        current_period_start=_ts_to_dt(sub_obj.get("current_period_start")),
        current_period_end=_ts_to_dt(sub_obj.get("current_period_end")),
        cancel_at_period_end=sub_obj.get("cancel_at_period_end", False),
    )
    db.add(sub)
    db.commit()
    logger.info("Created subscription %s for user %s plan=%s", sub_id, user_id, plan_id)


def _handle_subscription_updated(sub_obj: dict, db: Session) -> None:
    """customer.subscription.updated: ステータス/プランを更新。"""
    sub_id = sub_obj["id"]
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        # 存在しない場合は created と同様に作成
        _handle_subscription_created(sub_obj, db)
        return

    plan_id = _get_plan_from_subscription(sub_obj)
    items = sub_obj.get("items", {}).get("data", [])
    price_id = items[0].get("price", {}).get("id", "") if items else sub.stripe_price_id

    sub.stripe_price_id = price_id
    sub.plan_id = plan_id
    sub.status = sub_obj.get("status", sub.status)
    sub.current_period_start = _ts_to_dt(sub_obj.get("current_period_start"))
    sub.current_period_end = _ts_to_dt(sub_obj.get("current_period_end"))
    sub.cancel_at_period_end = sub_obj.get("cancel_at_period_end", False)
    db.commit()
    logger.info("Updated subscription %s plan=%s status=%s", sub_id, plan_id, sub.status)


def _handle_subscription_deleted(sub_obj: dict, db: Session) -> None:
    """customer.subscription.deleted: ステータスを canceled に更新。"""
    sub_id = sub_obj["id"]
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub:
        sub.status = "canceled"
        db.commit()
        logger.info("Canceled subscription %s", sub_id)


def _handle_invoice_succeeded(invoice_obj: dict, db: Session) -> None:
    """invoice.payment_succeeded: past_due を active にリセット。"""
    sub_id = invoice_obj.get("subscription")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub and sub.status == "past_due":
        sub.status = "active"
        sub.current_period_end = _ts_to_dt(invoice_obj.get("period_end"))
        db.commit()
        logger.info("Reset subscription %s to active after payment", sub_id)


def _handle_invoice_failed(invoice_obj: dict, db: Session) -> None:
    """invoice.payment_failed: ステータスを past_due に更新。"""
    sub_id = invoice_obj.get("subscription")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub and sub.status == "active":
        sub.status = "past_due"
        db.commit()
        logger.info("Set subscription %s to past_due after payment failure", sub_id)

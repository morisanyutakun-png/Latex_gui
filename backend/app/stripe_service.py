"""Stripe SDK 呼び出しをまとめたサービスモジュール"""
import os
import contextlib
import datetime
import logging
from typing import Optional

import stripe
from sqlalchemy.orm import Session

from .db_models import User, Subscription

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

# Stripe 呼び出しが詰まって Koyeb の request timeout (60s) に達し
# "no healthy service" の 502 で切られるのを防ぐ。15s で強制エラーにする。
stripe.max_network_retries = 1
with contextlib.suppress(Exception):
    from stripe.http_client import RequestsClient  # type: ignore
    stripe.default_http_client = RequestsClient(timeout=15)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# plan_id → Stripe Price ID のマッピング
PLAN_PRICE_IDS: dict[str, str] = {
    "free": os.environ.get("STRIPE_PRICE_ID_FREE", ""),
    "starter": os.environ.get("STRIPE_PRICE_ID_STARTER", ""),
    "pro": os.environ.get("STRIPE_PRICE_ID_PRO", ""),
    "premium": os.environ.get("STRIPE_PRICE_ID_PREMIUM", ""),
}

# Stripe Price ID → plan_id の逆引き (webhook 処理で使用)
PRICE_TO_PLAN: dict[str, str] = {v: k for k, v in PLAN_PRICE_IDS.items() if v}


def _ensure_api_key() -> None:
    if not stripe.api_key:
        stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not stripe.api_key:
        raise ValueError(
            "STRIPE_SECRET_KEY が未設定です。バックエンドの環境変数を確認してください。"
        )


@contextlib.contextmanager
def _api_key_for_plan(plan_id: str):
    """プラン固有の `STRIPE_SECRET_KEY_<PLAN>` が設定されていれば、その呼び出し中だけ
    差し替える。未設定ならデフォルトの STRIPE_SECRET_KEY のまま。

    用途: Pro だけ test モードのサンドボックスで動作確認したい、など。
    """
    override = os.environ.get(f"STRIPE_SECRET_KEY_{plan_id.upper()}", "").strip()
    if not override:
        yield stripe.api_key
        return
    prev = stripe.api_key
    stripe.api_key = override
    try:
        yield override
    finally:
        stripe.api_key = prev


def _create_new_customer(user: User) -> str:
    customer = stripe.Customer.create(
        email=user.email or "",
        name=user.name or "",
        metadata={"user_id": user.id},
    )
    return customer.id


def create_or_get_customer(db: Session, user: User) -> str:
    """Stripe Customer を取得または作成し、stripe_customer_id を DB に保存して返す。

    DB に保存されている customer_id が現在の Stripe 環境に存在しない場合
    (test/live キー切替、Stripe 側で手動削除、別プロジェクトの customer 等) は
    自動的に無効化して新しい customer を作成する。
    """
    _ensure_api_key()

    if user.stripe_customer_id:
        try:
            retrieved = stripe.Customer.retrieve(user.stripe_customer_id)
            # 削除済み customer は deleted=True で返る
            if getattr(retrieved, "deleted", False):
                raise stripe.error.InvalidRequestError(
                    "customer deleted", param="customer"
                )
            return user.stripe_customer_id
        except stripe.error.InvalidRequestError as e:
            logger.warning(
                "Stale stripe_customer_id %s for user %s (%s); recreating",
                user.stripe_customer_id, user.id, e,
            )
            user.stripe_customer_id = None
            try:
                db.commit()
            except Exception:
                db.rollback()

    customer_id = _create_new_customer(user)
    user.stripe_customer_id = customer_id
    db.commit()
    logger.info("Created Stripe customer %s for user %s", customer_id, user.id)
    return customer_id


def create_checkout_session(
    db: Session,
    user: User,
    plan_id: str,
) -> str:
    """Stripe Checkout Session を作成してURLを返す。有料プラン専用。

    `STRIPE_PRICE_ID_<PLAN>` は以下のどちらでもよい:
      1. 通常の Price ID (`price_xxx`) — その場で Checkout Session を作成する
      2. Stripe Payment Link / Checkout URL (`https://...`) — そのURLをそのまま返す
         (サンドボックスや test mode のリンクを貼って動作確認したい場合に使う)

    stale な customer_id は自動で無効化して 1 回だけリトライする。
    """
    _ensure_api_key()

    # env 優先で毎回解決 (モジュール import 時の値を使わない)
    env_key = f"STRIPE_PRICE_ID_{plan_id.upper()}"
    raw = (os.environ.get(env_key, "") or PLAN_PRICE_IDS.get(plan_id, "")).strip()
    if not raw:
        raise ValueError(
            f"{env_key} が未設定です。バックエンドの環境変数に Price ID を設定してください。"
        )

    # ── ① URL が入っている場合は Payment Link としてそのまま返す ─────────────
    # 例: https://buy.stripe.com/test_xxx (Stripe サンドボックスの Payment Link)
    if raw.startswith("http://") or raw.startswith("https://"):
        logger.info("Using direct payment URL for plan=%s (%s)", plan_id, raw[:60])
        return raw

    # ── ② Price ID として通常の Checkout Session を作成 ────────────────────
    if not raw.startswith("price_"):
        # よくあるコピペミス (例: prod_xxx や plan_xxx) を早期に弾く
        raise ValueError(
            f"{env_key} の値が Price ID 形式ではありません ('{raw[:40]}...')。 "
            f"Stripe Dashboard > Products > 各プランの『Price ID』(price_ で始まる) "
            f"または Payment Link URL (https://...) を設定してください。"
        )

    price_id = raw
    # `{CHECKOUT_SESSION_ID}` は Stripe がリダイレクト時に実セッションID に置換するテンプレート変数
    success_url = (
        f"{FRONTEND_URL}/editor?checkout=success&plan={plan_id}"
        f"&session_id={{CHECKOUT_SESSION_ID}}"
    )

    def _create(customer_id: str) -> str:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=success_url,
            cancel_url=f"{FRONTEND_URL}/",
            metadata={"plan_id": plan_id, "user_id": user.id},
            subscription_data={"metadata": {"user_id": user.id, "plan_id": plan_id}},
            # 同一 Customer で複数サブスクを許可 (Free→Pro 等の一段飛ばしにも対応)
            allow_promotion_codes=True,
        )
        return session.url

    # プラン固有のシークレットキーがあれば、customer の retrieve/create と
    # checkout session 作成をその key の下で実行する (test price は test key が必要)
    with _api_key_for_plan(plan_id):
        override_key = os.environ.get(f"STRIPE_SECRET_KEY_{plan_id.upper()}", "").strip()
        if override_key:
            # test/live をプラン単位で混ぜる場合、DB に紐づいた customer は
            # 別モードのものかもしれないので、毎回フレッシュな customer を作る
            logger.info("Using plan-specific secret key for %s; creating fresh customer", plan_id)
            customer_id = _create_new_customer(user)
        else:
            customer_id = create_or_get_customer(db, user)
        try:
            return _create(customer_id)
        except stripe.error.InvalidRequestError as e:
            msg = str(e).lower()
            # customer 側の問題なら無効化して 1 回だけリトライ
            if "customer" in msg or "no such customer" in msg:
                logger.warning(
                    "Checkout failed due to customer (%s); invalidating and retrying", e,
                )
                if not override_key:
                    user.stripe_customer_id = None
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
                fresh_cid = (
                    _create_new_customer(user) if override_key
                    else create_or_get_customer(db, user)
                )
                return _create(fresh_cid)
            # customer 以外 (例: "No such price") はそのまま上位へ
            raise


# Stripe の zero-decimal currencies (JPY等はそもそも「sen」単位がないので amount_total が yen そのまま)
_ZERO_DECIMAL_CURRENCIES = {
    "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
    "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
}


def _to_decimal_amount(amount: Optional[int], currency: str) -> float:
    """Stripe の最小単位金額 → Google Ads が期待する 10 進金額へ変換。

    JPY は既に yen 単位、USD などは cents 単位なので /100 が必要。
    """
    if amount is None:
        return 0.0
    if (currency or "").lower() in _ZERO_DECIMAL_CURRENCIES:
        return float(amount)
    return amount / 100.0


def verify_checkout_session(session_id: str, user_id: str) -> dict:
    """Stripe Checkout Session の支払い状況をサーバサイドで検証する。

    URL パラメータだけでは成功扱いしないための要。
    ほかのユーザーのセッションで発火されないよう metadata.user_id と照合する。
    """
    session = stripe.checkout.Session.retrieve(session_id)

    # セッションが当該ユーザーのものかを確認
    meta_user_id = (session.get("metadata") or {}).get("user_id")
    if meta_user_id and meta_user_id != user_id:
        raise PermissionError("Session does not belong to the authenticated user")

    payment_status = session.get("payment_status")  # "paid" / "unpaid" / "no_payment_required"
    # subscription の初回支払いが完了している状態は "paid" で表現される。
    paid = payment_status == "paid"

    currency = (session.get("currency") or "").lower()
    amount_total = session.get("amount_total")
    value = _to_decimal_amount(amount_total, currency)
    plan_id = (session.get("metadata") or {}).get("plan_id", "")

    return {
        "paid": paid,
        "payment_status": payment_status,
        "value": value,
        "currency": currency.upper(),
        "transaction_id": session_id,
        "plan_id": plan_id,
    }


def activate_free_plan(db: Session, user: User) -> None:
    """Free プランを DB に直接登録する（Stripe Checkout 不要）。"""
    customer_id = create_or_get_customer(db, user)
    fake_sub_id = f"free_{user.id}"
    existing = db.query(Subscription).filter(Subscription.id == fake_sub_id).first()
    if not existing:
        sub = Subscription(
            id=fake_sub_id,
            user_id=user.id,
            stripe_price_id="",
            plan_id="free",
            status="active",
            cancel_at_period_end=False,
        )
        db.add(sub)
        db.commit()
        logger.info("Activated free plan for user %s (customer %s)", user.id, customer_id)


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

    plan_id = (session_obj.get("metadata") or {}).get("plan_id", "unknown")

    # ── 有料プラン: subscription ID を使って即座に subscription を作成 ──
    sub_id = session_obj.get("subscription")
    if sub_id:
        existing = db.query(Subscription).filter(Subscription.id == sub_id).first()
        if not existing:
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

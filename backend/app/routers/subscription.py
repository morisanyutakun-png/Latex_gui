"""サブスクリプション関連 API ルーター"""
import os
import logging
from typing import Optional
from urllib.parse import unquote

import stripe
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..db_models import User, Subscription
from .. import stripe_service
from ..plan_limits import get_effective_plan, get_limits
from ..usage_service import count_day, count_month

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "")


# ── 認証ヘルパー ──────────────────────────────────────────────────────────────

def get_current_user(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    x_user_email: Optional[str] = Header(default=None, alias="x-user-email"),
    x_internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    X-Internal-Secret が設定されている環境では、一致しない場合は X-User-Id を無視する。
    (ブラウザからの直接偽造を防ぐ)

    id が一致する行が無い場合は email でフォールバック検索する
    (AUTH_SECRET 変更等で session id が変わっても同じ Google アカウントを追従する)。
    """
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        return None
    if not x_user_id:
        return None
    user = db.query(User).filter(User.id == x_user_id).first()
    if not user and x_user_email:
        user = db.query(User).filter(User.email == x_user_email).first()
    return user


def get_or_create_user(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    x_user_email: Optional[str] = Header(default=None, alias="x-user-email"),
    x_user_name: Optional[str] = Header(default=None, alias="x-user-name"),
    x_internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """ユーザーを取得。存在しない場合は新規作成 (upsert)。

    id が一致する行が無くても、email が一致する既存行があれば再利用する。
    (AUTH_SECRET 変更 / DB 移行 / 旧 NextAuth 設定 などで session id が
    切り替わっても、email は Google アカウントに紐づく安定 ID なので、
    unique(email) 制約に衝突して 500 にならないようにする)。
    """
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        return None
    if not x_user_id:
        return None
    # フロントエンドで encodeURIComponent された日本語名をデコード
    decoded_name = unquote(x_user_name) if x_user_name else x_user_name
    return _upsert_user(db, x_user_id, x_user_email, decoded_name)


def _upsert_user(
    db: Session,
    user_id: str,
    email: Optional[str],
    name: Optional[str],
) -> User:
    """id または email で既存ユーザーを探し、無ければ新規作成して返す。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user and email:
        # id が違っても email が一致する既存ユーザーを再利用する
        user = db.query(User).filter(User.email == email).first()
        if user:
            logger.info(
                "Reusing existing user by email: session_id=%s existing_id=%s email=%s",
                user_id, user.id, email,
            )

    if not user:
        user = User(id=user_id, email=email, name=name)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # 並行リクエストで別プロセスが先に作成した可能性。rollback して再取得。
            db.rollback()
            if email:
                user = db.query(User).filter(User.email == email).first()
            if not user:
                user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise
            logger.info("Recovered user after IntegrityError: id=%s email=%s", user.id, email)
        else:
            db.refresh(user)
            logger.info("Created new user %s (%s)", user_id, email)
        return user

    # 既存ユーザー: 名前/メールを最新に同期 (unique 衝突しない範囲で)
    changed = False
    if email and user.email != email:
        # 別ユーザーに email が割り当たっていないかを確認してから更新
        other = db.query(User).filter(User.email == email, User.id != user.id).first()
        if not other:
            user.email = email
            changed = True
    if name and user.name != name:
        user.name = name
        changed = True
    if changed:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return user


# ── エンドポイント ────────────────────────────────────────────────────────────

class SubscriptionStatus(BaseModel):
    plan_id: str
    status: str
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False
    stripe_customer_id: Optional[str] = None


@router.get("/me", response_model=SubscriptionStatus)
async def get_my_subscription(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現在のユーザーのサブスクリプション状態を返す。"""
    if not user:
        return SubscriptionStatus(plan_id="free", status="free")

    # active/trialing/past_due のサブスクを優先して取得
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(["active", "trialing", "past_due"]),
        )
        .order_by(Subscription.updated_at.desc())
        .first()
    )

    if not sub:
        return SubscriptionStatus(plan_id="free", status="free")

    return SubscriptionStatus(
        plan_id=sub.plan_id,
        status=sub.status,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        cancel_at_period_end=sub.cancel_at_period_end or False,
        stripe_customer_id=user.stripe_customer_id,
    )


class CheckoutRequest(BaseModel):
    plan_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: Optional[User] = Depends(get_or_create_user),
    db: Session = Depends(get_db),
):
    """Stripe Checkout Session を作成して URL を返す。"""
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")

    if body.plan_id not in ("free", "starter", "pro", "premium"):
        raise HTTPException(status_code=400, detail="無効なプランIDです")

    # ── Free プラン: Stripe Checkout 不要。DB に直接登録してリダイレクト先を返す ──
    if body.plan_id == "free":
        try:
            stripe_service.activate_free_plan(db, user)
        except Exception as e:
            logger.error("Free plan activation error: %s", e)
            raise HTTPException(status_code=500, detail=f"Free プランの有効化に失敗: {e}")
        frontend_url = stripe_service.FRONTEND_URL
        return CheckoutResponse(checkout_url=f"{frontend_url}/editor?checkout=success&plan=free")

    # ── 有料プラン: Stripe Checkout ──
    try:
        checkout_url = stripe_service.create_checkout_session(db, user, body.plan_id)
    except ValueError as e:
        # 設定不備 (env 未設定など) はクライアントに原因を返す
        logger.error("Stripe checkout config error (plan=%s): %s", body.plan_id, e)
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        logger.error("Stripe API error (plan=%s): %s", body.plan_id, e, exc_info=True)
        user_msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(
            status_code=502,
            detail=f"Stripe API エラー: {type(e).__name__}: {user_msg[:200]}",
        )
    except Exception as e:
        logger.error("Stripe checkout error (plan=%s): %s", body.plan_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Stripe決済の初期化に失敗しました: {type(e).__name__}: {str(e)[:200]}",
        )

    if not checkout_url:
        raise HTTPException(status_code=502, detail="Stripe から checkout URL が返りませんでした")

    return CheckoutResponse(checkout_url=checkout_url)


class UsageStatus(BaseModel):
    plan_id: str
    ai_used_day: int
    ai_used_month: int
    ai_limit_day: int
    ai_limit_month: int
    pdf_used_month: int
    pdf_limit_month: int   # 0 = 無制限
    batch_max_rows: int


@router.get("/usage", response_model=UsageStatus)
async def get_my_usage(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現在のユーザーの今月/今日の利用状況を返す。未ログインなら Free プランの空利用状況を返す。"""
    if not user:
        free_limits = get_limits("free")
        return UsageStatus(
            plan_id="free",
            ai_used_day=0, ai_used_month=0,
            ai_limit_day=free_limits["ai_per_day"],
            ai_limit_month=free_limits["ai_per_month"],
            pdf_used_month=0,
            pdf_limit_month=free_limits["pdf_per_month"],
            batch_max_rows=free_limits["batch_max_rows"],
        )

    plan_id = get_effective_plan(db, user.id)
    limits = get_limits(plan_id)
    return UsageStatus(
        plan_id=plan_id,
        ai_used_day=count_day(db, user.id, "ai_request"),
        ai_used_month=count_month(db, user.id, "ai_request"),
        ai_limit_day=limits["ai_per_day"],
        ai_limit_month=limits["ai_per_month"],
        pdf_used_month=count_month(db, user.id, "pdf_export"),
        pdf_limit_month=limits["pdf_per_month"],
        batch_max_rows=limits["batch_max_rows"],
    )


class VerifyCheckoutResponse(BaseModel):
    paid: bool
    payment_status: Optional[str] = None
    value: float = 0.0
    currency: str = ""
    transaction_id: str = ""
    plan_id: str = ""


@router.get("/verify-checkout", response_model=VerifyCheckoutResponse)
async def verify_checkout_endpoint(
    session_id: str,
    user: Optional[User] = Depends(get_current_user),
):
    """Stripe Checkout Session が実際に支払い済みかサーバサイドで検証する。

    Google Ads の Purchase conversion を、URL パラメータだけではなく
    サーバ確認済みの成功データに基づいて発火させるため。
    """
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id が空です")

    try:
        result = stripe_service.verify_checkout_session(session_id, user.id)
    except PermissionError:
        raise HTTPException(status_code=403, detail="このセッションを検証する権限がありません")
    except Exception as e:
        logger.error("verify_checkout error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Stripe検証に失敗しました: {type(e).__name__}")

    return VerifyCheckoutResponse(**result)


def _classify_price_value(v: str) -> str:
    v = (v or "").strip()
    if not v:
        return "empty"
    if v.startswith("price_"):
        return "price_id"
    if v.startswith(("http://", "https://")):
        return "url"
    return f"invalid({v[:20]}...)"


def _classify_secret_key(v: str) -> str:
    v = (v or "").strip()
    if not v:
        return "empty"
    if v.startswith("sk_live_"):
        return "live"
    if v.startswith("sk_test_"):
        return "test"
    return "invalid"


@router.get("/stripe-config-check")
async def stripe_config_check():
    """Stripe 関連の環境変数の種別を返す (値そのものは返さない)。

    LP のアップグレードボタンがプランごとに失敗する原因を切り分けるための診断用。
    例: Pro だけ test の price を、SECRET は live にしていると必ず失敗する。
    """
    default_mode = _classify_secret_key(os.environ.get("STRIPE_SECRET_KEY", ""))
    plan_modes = {
        plan: _classify_secret_key(
            os.environ.get(f"STRIPE_SECRET_KEY_{plan.upper()}", "")
        )
        for plan in ("starter", "pro", "premium")
    }
    plan_price_types = {
        plan: _classify_price_value(os.environ.get(f"STRIPE_PRICE_ID_{plan.upper()}", ""))
        for plan in ("starter", "pro", "premium")
    }
    # 実効モード: プラン別 override があればそれを、無ければデフォルト
    effective_modes = {
        plan: (plan_modes[plan] if plan_modes[plan] != "empty" else default_mode)
        for plan in plan_modes
    }
    # price が price_id 形式なのに secret key のモードが一致していない可能性を警告
    warnings: list[str] = []
    for plan in ("starter", "pro", "premium"):
        if plan_price_types[plan] == "price_id" and effective_modes[plan] == "live":
            # live キー × price_id は問題ないので警告しない。test キー × live price_id のパターンのみ警告
            pass
        if plan_price_types[plan] == "price_id" and effective_modes[plan] not in ("live", "test"):
            warnings.append(f"{plan}: price_id が設定されているが、使える secret key が無効/空")
    return {
        "stripe_secret_key_mode": default_mode,
        "plan_secret_key_overrides": plan_modes,
        "effective_mode_per_plan": effective_modes,
        "stripe_webhook_secret_set": bool(os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()),
        "price_ids": plan_price_types,
        "frontend_url": os.environ.get("FRONTEND_URL", ""),
        "internal_api_secret_set": bool(os.environ.get("INTERNAL_API_SECRET", "").strip()),
        "warnings": warnings,
        "hint": (
            "price_id が 'price_' で始まる値なら、その Price が作られた Stripe のモード "
            "(test / live) と、effective_mode_per_plan が一致している必要があります。"
        ),
    }


class PortalResponse(BaseModel):
    portal_url: str


@router.post("/portal", response_model=PortalResponse)
async def create_portal(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stripe Customer Portal Session を作成して URL を返す。"""
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    if not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Stripeカスタマーが存在しません")

    try:
        portal_url = stripe_service.create_portal_session(user.stripe_customer_id)
    except Exception as e:
        logger.error("Stripe portal error: %s", e)
        raise HTTPException(status_code=500, detail="ポータルURLの生成に失敗しました")

    return PortalResponse(portal_url=portal_url)

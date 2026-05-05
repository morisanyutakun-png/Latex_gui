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

from ..auth_deps import _ensure_free_subscription_row
from ..database import get_db, get_db_info
from ..db_models import User, Subscription, UsageLog
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

    email フォールバックは INTERNAL_SECRET 検証通過時のみ許可。
    """
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        return None
    if not x_user_id:
        return None
    user = db.query(User).filter(User.id == x_user_id).first()
    if not user and x_user_email and INTERNAL_SECRET:
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
    """id または email で既存ユーザーを探し、無ければ新規作成して返す。

    email フォールバックは INTERNAL_API_SECRET 検証通過経路 (= 呼び出し元が
    get_or_create_user 依存性から来ていて内部シークレット検証済み) でのみ動く。
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user and email and INTERNAL_SECRET:
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
            # users と subscriptions の整合を保つため、新規 User 作成と同時に
            # Free pseudo 行を入れる。Stripe を叩かない軽量版なので待ち時間ゼロ。
            _ensure_free_subscription_row(db, user.id)
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
    """現在のユーザーのサブスクリプション状態を返す。

    Self-heal: subscription 行が 1 件も無いレガシーユーザーに限り、Free 行を
    1 回だけ挿入する。重複挿入はしない (`_ensure_free_subscription_row` が
    存在チェック付きで挿入する)。canceled 行だけ持つユーザーには新規挿入
    せず、従来通り "free" を返すだけにする。
    """
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
        # 既に何らかの subscription 行を持っているか (canceled 含む) を確認。
        # 1 件も無い時だけ Free 行を挿入。canceled 行を持つ人には触らない。
        try:
            _ensure_free_subscription_row(db, user.id)
        except Exception as e:
            logger.warning("self-heal free row failed for user=%s: %s", user.id, e)
            return SubscriptionStatus(plan_id="free", status="free")
        sub = (
            db.query(Subscription)
            .filter(
                Subscription.user_id == user.id,
                Subscription.status.in_(["active", "trialing"]),
            )
            .order_by(Subscription.updated_at.desc())
            .first()
        )
        if not sub:
            # 挿入されなかった (canceled 行が既存 / 並行挿入失敗 / DB エラー) 場合
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
    # "already_on_plan" = 既に当該プラン以上を契約済みなので、クライアントは
    # Stripe を挟まずそのまま checkout_url (=/editor) へ遷移すれば良い。
    action: str = "checkout"
    current_plan: Optional[str] = None


# プランのランク (アップグレード判定のためサーバ側でも持つ)。
# フロント `frontend/lib/plans.ts` の PLAN_RANK と一致させること。
_PLAN_RANK: dict[str, int] = {"free": 0, "starter": 1, "pro": 2, "premium": 3}


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: Optional[User] = Depends(get_or_create_user),
    db: Session = Depends(get_db),
):
    """Stripe Checkout Session を作成して URL を返す。

    サーバサイドで "これは本当にアップグレードか" を最終判定する。
    クライアントの現プラン表示は改ざん可能なので信用しない。
    """
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")

    if body.plan_id not in _PLAN_RANK:
        raise HTTPException(status_code=400, detail="無効なプランIDです")

    frontend_url = stripe_service.FRONTEND_URL

    # DB を直接見て active/trialing 行があるかを確認 (毎回クエリ、キャッシュなし)
    active_row = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(["active", "trialing"]),
        )
        .order_by(Subscription.updated_at.desc())
        .first()
    )
    current_plan = active_row.plan_id if active_row else "free"

    # ── Free プラン要求 ────────────────────────────────────────────────────
    # DB に active 行が「無ければ必ず作る」 (Free の pseudo 行を挿入)。
    # 既に何らかの active 行があれば (Free 含む) 何も書かずに already_on_plan。
    # 有料契約中に Free を押した場合も同様 (ダウングレードは Stripe portal 経由で)。
    if body.plan_id == "free":
        if active_row is None:
            try:
                stripe_service.activate_free_plan(db, user)
            except Exception as e:
                logger.error("Free plan activation error: %s", e)
                raise HTTPException(status_code=500, detail=f"Free プランの有効化に失敗: {e}")
            logger.info("Activated Free plan for user %s (no prior active row)", user.id)
            return CheckoutResponse(
                checkout_url=f"{frontend_url}/editor?checkout=success&plan=free",
                action="free_activated",
                current_plan="free",
            )
        # 既に何か active 行がある → 書き込み不要、editor へ戻す
        logger.info(
            "Skip Free activation: user=%s already has active row (plan=%s)",
            user.id, current_plan,
        )
        return CheckoutResponse(
            checkout_url=f"{frontend_url}/editor",
            action="already_on_plan",
            current_plan=current_plan,
        )

    # ── 有料プラン要求: アップグレードでなければブロック ──────────────────
    if _PLAN_RANK[body.plan_id] <= _PLAN_RANK.get(current_plan, 0):
        logger.info(
            "Skip checkout: user=%s already on %s (requested %s)",
            user.id, current_plan, body.plan_id,
        )
        return CheckoutResponse(
            checkout_url=f"{frontend_url}/editor",
            action="already_on_plan",
            current_plan=current_plan,
        )

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

    return CheckoutResponse(
        checkout_url=checkout_url,
        action="checkout",
        current_plan=current_plan,
    )


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
    # backend で DB upsert した結果。フロントで成功/失敗とその理由が見える。
    upsert: Optional[dict] = None


@router.get("/verify-checkout", response_model=VerifyCheckoutResponse)
async def verify_checkout_endpoint(
    session_id: str,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stripe Checkout Session が実際に支払い済みかサーバサイドで検証し、
    paid ならその場で DB の Subscription を upsert する。

    Webhook が届かない/遅い環境 (test mode 別エンドポイント、Koyeb への到達失敗 等)
    でも redirect 直後にプランが即反映される。冪等なので webhook が後から来ても OK。
    Google Ads / GA4 の purchase event もここで paid を確認した後に発火される。
    """
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id が空です")

    try:
        result = stripe_service.verify_checkout_session(db, session_id, user)
    except PermissionError:
        raise HTTPException(status_code=403, detail="このセッションを検証する権限がありません")
    except Exception as e:
        logger.error("verify_checkout error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Stripe検証に失敗しました: {type(e).__name__}")

    return VerifyCheckoutResponse(**result)


@router.post("/sync", response_model=SubscriptionStatus)
async def sync_subscription(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現ユーザーの `stripe_customer_id` に紐づくサブスクを Stripe から引いて DB を同期する。

    用途: webhook 取りこぼし時の self-heal、「反映されていない気がする」のワンクリック修復。
    Stripe が単一の真実で、DB はそのリプリカ。
    """
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    if not user.stripe_customer_id:
        # Stripe に customer がないなら Free として同期完了
        return SubscriptionStatus(plan_id="free", status="free")

    try:
        synced_plan = stripe_service.sync_subscriptions_for_customer(db, user)
    except Exception as e:
        logger.error("sync_subscriptions error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Stripeとの同期に失敗しました: {type(e).__name__}")

    # 最新の DB 状態を返す
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
        return SubscriptionStatus(plan_id=synced_plan or "free", status="free")
    return SubscriptionStatus(
        plan_id=sub.plan_id,
        status=sub.status,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        cancel_at_period_end=sub.cancel_at_period_end or False,
        stripe_customer_id=user.stripe_customer_id,
    )


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


@router.post("/backfill-free-rows")
async def backfill_free_subscriptions(
    db: Session = Depends(get_db),
    x_internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
):
    """既存ユーザーで `subscriptions` に active 行が無い人へ Free pseudo 行を一括 upsert。

    旧コードでは User 作成時に Free 行を挿入しておらず、`POST /subscription/checkout`
    を `plan_id=free` で踏まない限り subscriptions に行が無いまま蓄積していた。
    その結果「users 行 > subscriptions 行」のズレが発生する。これは一回叩いて整合
    させるためのバックフィル。複数回叩いても冪等 (active 行が既にある人はスキップ)。

    INTERNAL_SECRET 必須 (本番でブラウザから叩かれない保証)。
    """
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="invalid internal secret")

    # Subscription 行が 1 件も無い User だけを抽出 (status 問わず)。
    # canceled だけ持つユーザーには Free 行を新規挿入しない方針 (重複回避)。
    users_without_any_sub = db.query(User).filter(
        ~db.query(Subscription).filter(
            Subscription.user_id == User.id,
        ).exists()
    ).all()

    inserted = 0
    failed = 0
    for u in users_without_any_sub:
        try:
            _ensure_free_subscription_row(db, u.id)
            inserted += 1
        except Exception as e:
            logger.warning("backfill: failed for user %s: %s", u.id, e)
            failed += 1

    logger.info("backfill-free-rows: inserted=%d failed=%d", inserted, failed)
    return {"inserted": inserted, "failed": failed, "total_users_checked": len(users_without_any_sub)}


@router.post("/dedupe")
async def dedupe_subscriptions(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """現ユーザーの subscriptions 行を「1ユーザ=1レコード」に整理する。

    既存のユーザが複数行を抱えている場合の self-heal 用 (今回の仕様変更前に
    積み重なった重複を掃除するため)。
    - active/trialing のうち最上位プランを残す
    - 他 (pseudo free 含む) を削除
    - 有料の stale 行については Stripe 側も best-effort で cancel
    """
    if not user:
        raise HTTPException(status_code=401, detail="認証が必要です")

    rows = db.query(Subscription).filter(Subscription.user_id == user.id).all()
    if len(rows) <= 1:
        return {"removed": 0, "kept": rows[0].id if rows else None, "note": "no dedupe needed"}

    rank = {"free": 0, "starter": 1, "pro": 2, "premium": 3}
    # 優先順位: status in (active, trialing) > plan rank > updated_at desc
    def _score(r: Subscription) -> tuple[int, int]:
        s = 1 if r.status in ("active", "trialing") else 0
        p = rank.get(r.plan_id, -1)
        return (s, p)

    best = max(rows, key=_score)
    removed = stripe_service._ensure_single_subscription_per_user(db, user.id, best.id)
    return {
        "removed": removed,
        "kept": best.id,
        "kept_plan": best.plan_id,
        "kept_status": best.status,
    }


@router.get("/whoami")
async def whoami(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """認証済みユーザーの DB 上の全情報を返す診断用。

    「PRO で購入したのに Free のまま」問題のピンポイント調査に使う。
    - user row (id, email, stripe_customer_id)
    - subscriptions 行 全部 (id, plan_id, status, user_id)
    - get_effective_plan の結果
    """
    if not user:
        return {
            "authenticated": False,
            "note": "x-user-id ヘッダ無効または INTERNAL_API_SECRET 不一致",
        }

    subs = db.query(Subscription).filter(Subscription.user_id == user.id).all()
    effective = get_effective_plan(db, user.id)

    # email で引いた場合に id 違いの残骸がないかもチェック
    by_email = []
    if user.email:
        by_email_users = db.query(User).filter(User.email == user.email).all()
        for u in by_email_users:
            u_subs = db.query(Subscription).filter(Subscription.user_id == u.id).all()
            by_email.append({
                "user_id": u.id,
                "subscription_count": len(u_subs),
                "subscriptions": [
                    {"id": s.id, "plan_id": s.plan_id, "status": s.status}
                    for s in u_subs
                ],
            })

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "stripe_customer_id": user.stripe_customer_id,
        },
        "effective_plan": effective,
        "subscription_count": len(subs),
        "subscriptions": [
            {
                "id": s.id,
                "plan_id": s.plan_id,
                "status": s.status,
                "user_id": s.user_id,
                "stripe_price_id": s.stripe_price_id,
                "cancel_at_period_end": s.cancel_at_period_end,
            }
            for s in subs
        ],
        "users_with_same_email": by_email,
    }


@router.get("/version")
async def subscription_version():
    """このエンドポイントが存在するなら、verify-checkout が DB upsert する
    コード (2026-04 以降) が Koyeb に反映済みの目印。存在しない = 要再デプロイ。"""
    return {
        "verify_upserts_db": True,
        "sync_endpoint": True,
        "per_plan_key_override": True,
        "debug_mode_on_test_sessions": True,
    }


@router.get("/db-health")
async def db_health(db: Session = Depends(get_db)):
    """DB 永続化の健康診断。

    「AI使用量がDBに保存されていないのでは?」を即座に切り分けるため:
    - DB エンジン種別 (sqlite は本番 NG)
    - 全体の件数 (users / subscriptions / usage_logs)
    - 直近 24h の AI/PDF 使用ログの件数

    を返す。Koyeb のコンテナが再起動した直後にも叩いて、
    件数が激減していれば永続化できていない証拠になる。
    """
    import datetime as _dt
    now = _dt.datetime.now(_dt.timezone.utc)
    since_24h = now - _dt.timedelta(hours=24)

    info = get_db_info()
    users_count = db.query(User).count()
    subs_count = db.query(Subscription).count()
    usage_total = db.query(UsageLog).count()
    ai_last_24h = (
        db.query(UsageLog)
        .filter(UsageLog.action == "ai_request", UsageLog.created_at >= since_24h)
        .count()
    )
    pdf_last_24h = (
        db.query(UsageLog)
        .filter(UsageLog.action == "pdf_export", UsageLog.created_at >= since_24h)
        .count()
    )
    # 最も古いUsageLogを見ることで "このDBは何日前から生きているか" を判定できる。
    oldest_usage = (
        db.query(UsageLog.created_at)
        .order_by(UsageLog.created_at.asc())
        .first()
    )
    oldest_iso = oldest_usage[0].isoformat() if oldest_usage else None

    return {
        "db": info,
        "counts": {
            "users": users_count,
            "subscriptions": subs_count,
            "usage_logs_total": usage_total,
            "ai_requests_last_24h": ai_last_24h,
            "pdf_exports_last_24h": pdf_last_24h,
        },
        "oldest_usage_log_at": oldest_iso,
        "now": now.isoformat(),
        "hint": (
            "If db.is_sqlite is true in production, usage is being wiped on every "
            "container restart. Set DATABASE_URL to a persistent PostgreSQL URL."
        ) if info["is_sqlite"] and info["is_production_env"] else None,
    }


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

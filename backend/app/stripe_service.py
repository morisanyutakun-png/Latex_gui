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


def _warn_on_prod_test_keys() -> None:
    """本番環境で sk_test_ / STRIPE_SECRET_KEY_<PLAN>=sk_test_ が残っていたら警告。

    残したまま本番リリースすると、そのプランだけ test mode で決済が通って
    DB に Pro を書き込める "無料 Pro" バックドアになる。
    """
    _frontend = FRONTEND_URL.lower()
    is_prod = (
        _frontend
        and "localhost" not in _frontend
        and "127.0.0.1" not in _frontend
        and "0.0.0.0" not in _frontend
    )
    if not is_prod:
        return
    main_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if main_key.startswith("sk_test_"):
        logger.error(
            "SECURITY: STRIPE_SECRET_KEY looks like a test key (sk_test_*) in a "
            "production-like environment. Real payments will not go through, and "
            "test charges will be mistaken for real ones."
        )
    for p in ("starter", "pro", "premium"):
        override = os.environ.get(f"STRIPE_SECRET_KEY_{p.upper()}", "").strip()
        if override.startswith("sk_test_"):
            logger.error(
                "SECURITY: STRIPE_SECRET_KEY_%s is a test key in production. "
                "Users can activate %s for free by paying with 4242 test card.",
                p.upper(), p,
            )


_warn_on_prod_test_keys()


def _sg(obj, key, default=None):
    """Stripe object / ListObject / dict / None から安全に値を取り出すヘルパー。

    Stripe SDK v8+ では ListObject (及び一部の StripeObject) が dict の `.get()` を
    継承していない。`.get` への attribute access は __getattr__ 経由でキー "get" を
    探しに行き AttributeError を投げるため、verify/sync が silent に 502 に落ちる
    バグの原因になっていた。必ずこの関数経由で取り出すこと。
    """
    if obj is None:
        return default
    # StripeObject/ListObject は __getattr__ が _data[key] を返してくれる。
    # getattr の 3 引数形式を使えば AttributeError を default に潰してくれる。
    try:
        val = getattr(obj, key, None)
        if val is not None:
            return val
    except Exception:
        pass
    # 素の dict、または __getitem__ だけ実装されているオブジェクトのフォールバック
    try:
        return obj[key]
    except (KeyError, TypeError, AttributeError):
        return default

# plan_id → Stripe Price ID のマッピング
PLAN_PRICE_IDS: dict[str, str] = {
    "free": os.environ.get("STRIPE_PRICE_ID_FREE", ""),
    "starter": os.environ.get("STRIPE_PRICE_ID_STARTER", ""),
    "pro": os.environ.get("STRIPE_PRICE_ID_PRO", ""),
    "premium": os.environ.get("STRIPE_PRICE_ID_PREMIUM", ""),
}

# Stripe Price ID → plan_id の逆引き (webhook 処理で使用)
PRICE_TO_PLAN: dict[str, str] = {v: k for k, v in PLAN_PRICE_IDS.items() if v}


def _all_candidate_keys() -> list[str]:
    """default + 各プラン override の Stripe API キーを重複排除で順に返す。"""
    keys: list[str] = []
    seen: set[str] = set()
    def _add(k: str) -> None:
        k = (k or "").strip()
        if k and k not in seen:
            seen.add(k)
            keys.append(k)
    _add(stripe.api_key or os.environ.get("STRIPE_SECRET_KEY", ""))
    for p in ("starter", "pro", "premium"):
        _add(os.environ.get(f"STRIPE_SECRET_KEY_{p.upper()}", ""))
    return keys


def _cancel_stripe_subscription_best_effort(sub_id: str) -> bool:
    """古い Stripe サブスクを安全にキャンセルする。失敗しても続行。

    pseudo id (`free_<user>`) はスキップ。
    複数のキーで順に試し、どれかで成功すれば OK。
    全キーで失敗した場合は **ERROR ログ** で記録 (= double-billing リスクなので
    監視側でアラート化する想定)。
    """
    if not sub_id or sub_id.startswith("free_"):
        return False
    last_err: Optional[Exception] = None
    prev = stripe.api_key
    try:
        for key in _all_candidate_keys():
            stripe.api_key = key
            try:
                stripe.Subscription.cancel(sub_id)
                logger.info("Canceled old Stripe subscription %s", sub_id)
                return True
            except stripe.error.InvalidRequestError as e:
                last_err = e
                continue
            except Exception as e:
                last_err = e
                continue
        # 全滅: double-billing の可能性を明示的に ERROR で残す
        logger.error(
            "BILLING: Failed to cancel Stripe subscription %s with any key — "
            "user may be double-billed. Manual cancellation required. Last error: %s",
            sub_id, last_err,
        )
        return False
    finally:
        stripe.api_key = prev


def _ensure_single_subscription_per_user(
    db: Session,
    user_id: str,
    keep_sub_id: str,
    cancel_in_stripe: bool = True,
) -> int:
    """「1ユーザ=1レコード」不変条件を強制。keep_sub_id 以外の行を削除する。

    削除した行に対応する Stripe subscription もオプションで cancel する
    (double-billing 防止)。pseudo id (`free_<user>`) は Stripe には無いのでスキップ。

    Returns: 削除した行数。
    """
    stale_rows = db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.id != keep_sub_id,
    ).all()

    removed = 0
    for row in stale_rows:
        old_id = row.id
        if cancel_in_stripe and old_id and not old_id.startswith("free_"):
            _cancel_stripe_subscription_best_effort(old_id)
        db.delete(row)
        removed += 1

    if removed > 0:
        try:
            db.commit()
            logger.info(
                "Enforced one-sub-per-user: removed %d stale rows for user %s (kept=%s)",
                removed, user_id, keep_sub_id,
            )
        except Exception as e:
            db.rollback()
            logger.error("Failed to delete stale subscription rows for user %s: %s", user_id, e)
    return removed


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


def _retrieve_session_any_mode(session_id: str) -> tuple[object, str]:
    """Checkout Session を取得する。デフォルトキーで失敗したら、
    `STRIPE_SECRET_KEY_<PLAN>` オーバーライドを順に試す。

    Returns: (session, matched_api_key) — 見つけた key を呼び出し側に返して、
    同じ key で `stripe.Subscription.retrieve` 等の追撃 API 呼び出しができるようにする。
    """
    _ensure_api_key()

    # `cs_test_` で始まる session は必ず test キーが必要 (Stripe の命名規約)。
    prefer_test = session_id.startswith("cs_test_")

    candidates: list[str] = []
    seen: set[str] = set()

    def _add(k: str) -> None:
        k = (k or "").strip()
        if k and k not in seen:
            seen.add(k)
            candidates.append(k)

    override_keys = [
        os.environ.get(f"STRIPE_SECRET_KEY_{p.upper()}", "")
        for p in ("starter", "pro", "premium")
    ]
    if prefer_test:
        for k in override_keys:
            if k.startswith("sk_test_"):
                _add(k)
        _add(stripe.api_key)
        for k in override_keys:
            _add(k)
    else:
        _add(stripe.api_key)
        for k in override_keys:
            _add(k)

    last_err: Optional[Exception] = None
    prev = stripe.api_key
    try:
        for key in candidates:
            stripe.api_key = key
            try:
                sess = stripe.checkout.Session.retrieve(session_id)
                return sess, key
            except stripe.error.InvalidRequestError as e:
                last_err = e
                continue
    finally:
        stripe.api_key = prev

    raise last_err or stripe.error.InvalidRequestError(
        f"No such checkout session: {session_id}", param="session_id"
    )


def _upsert_subscription_from_session(
    db: Session,
    user: User,
    session: object,
    matched_key: str,
) -> dict:
    """Checkout Session の内容から DB の Subscription 行を冪等に upsert する。

    Webhook (checkout.session.completed / subscription.updated) に頼らず、
    redirect 直後の verify でも DB に反映させるため。

    Returns: 診断 dict — フロントに upsert の結果を返すために使う。
    """
    report: dict = {"attempted": True, "success": False, "error": None}
    sub_id = _sg(session, "subscription")
    metadata = _sg(session, "metadata")
    plan_id = _sg(metadata, "plan_id", "") or ""
    customer_id = _sg(session, "customer")
    is_test_session = bool(customer_id and isinstance(customer_id, str) and "test" in (matched_key or ""))
    report.update({
        "sub_id": sub_id,
        "plan_id": plan_id,
        "customer_id": customer_id,
        "is_test_session": is_test_session,
        "user_id_written": user.id,
    })

    if not sub_id or not plan_id:
        msg = f"missing sub_id or plan_id in session: sub_id={sub_id} plan_id={plan_id}"
        logger.warning(msg)
        report["error"] = msg
        return report

    # customer_id を User に紐付ける (test session でも紐付ける。同期に使うため)
    # 以前は test 時にスキップしていたが、/sync が stripe_customer_id を必要とするので、
    # test session でも保存する (test customer と live customer は異なる ID 空間だが
    # DB の 1 列しかないため、最新のものを採用する方針にする)。
    if customer_id and user.stripe_customer_id != customer_id:
        user.stripe_customer_id = customer_id
        try:
            db.commit()
            report["customer_linked"] = True
        except Exception as e:
            db.rollback()
            report["customer_link_error"] = str(e)[:200]

    period_start = None
    period_end = None
    status = "active"
    price_id = PLAN_PRICE_IDS.get(plan_id, "") or os.environ.get(
        f"STRIPE_PRICE_ID_{plan_id.upper()}", ""
    )
    prev = stripe.api_key
    try:
        stripe.api_key = matched_key
        sub_obj = stripe.Subscription.retrieve(sub_id)
        status = _sg(sub_obj, "status", "active") or "active"
        period_start = _ts_to_dt(_sg(sub_obj, "current_period_start"))
        period_end = _ts_to_dt(_sg(sub_obj, "current_period_end"))
        items_obj = _sg(sub_obj, "items")
        items_data = _sg(items_obj, "data", []) or []
        if items_data:
            first_price = _sg(items_data[0], "price")
            price_id = _sg(first_price, "id", "") or price_id
        report["stripe_status"] = status
    except Exception as e:
        logger.warning("Subscription.retrieve(%s) failed: %s", sub_id, e)
        report["subscription_retrieve_error"] = f"{type(e).__name__}: {str(e)[:200]}"
    finally:
        stripe.api_key = prev

    existing = db.query(Subscription).filter(Subscription.id == sub_id).first()
    try:
        if existing:
            existing.user_id = user.id
            existing.stripe_price_id = price_id or existing.stripe_price_id
            existing.plan_id = plan_id
            existing.status = status
            if period_start is not None:
                existing.current_period_start = period_start
            if period_end is not None:
                existing.current_period_end = period_end
            existing.cancel_at_period_end = False
            db.commit()
            report["db_action"] = "updated"
        else:
            db.add(Subscription(
                id=sub_id,
                user_id=user.id,
                stripe_price_id=price_id,
                plan_id=plan_id,
                status=status,
                current_period_start=period_start,
                current_period_end=period_end,
                cancel_at_period_end=False,
            ))
            db.commit()
            report["db_action"] = "created"

        # 書き込み後に確認クエリ (本当に見えるか)
        verify_row = db.query(Subscription).filter(Subscription.id == sub_id).first()
        report["verified_after_commit"] = bool(verify_row)
        if verify_row:
            report["verified_user_id"] = verify_row.user_id
            report["verified_plan_id"] = verify_row.plan_id
            report["verified_status"] = verify_row.status
        report["success"] = bool(verify_row and verify_row.status in ("active", "trialing"))

        logger.info(
            "Upserted subscription %s user=%s plan=%s status=%s action=%s",
            sub_id, user.id, plan_id, status, report.get("db_action"),
        )

        # ★ 1ユーザ=1レコード不変条件を強制。Free から上げた場合は pseudo "free_<uid>" 行が、
        #   有料→有料の場合は旧サブスク行が削除される (Stripe 側も best-effort で cancel)。
        if report["success"]:
            removed = _ensure_single_subscription_per_user(db, user.id, sub_id)
            report["stale_rows_removed"] = removed
    except Exception as e:
        db.rollback()
        msg = f"{type(e).__name__}: {str(e)[:300]}"
        logger.error("DB upsert failed for sub %s user %s: %s", sub_id, user.id, msg, exc_info=True)
        report["error"] = msg

    return report


def verify_checkout_session(db: Session, session_id: str, user: User) -> dict:
    """Stripe Checkout Session の支払い状況をサーバサイドで検証する。

    URL パラメータだけでは成功扱いしないための要。
    ほかのユーザーのセッションで発火されないよう metadata.user_id と照合する。

    重要: paid と判定した場合、**この関数内で DB の Subscription を upsert する**。
    webhook 未着/遅延/mode 違いで取りこぼしても、redirect 時に必ず DB に反映される。
    冪等なので webhook が後から来ても二重にはならない。
    """
    session, matched_key = _retrieve_session_any_mode(session_id)

    # ★ Critical: セッションが当該ユーザーのものかを厳格確認。
    # metadata.user_id 空の session は我々が作ったものではない (Dashboard 手作業等) ので
    # 絶対に DB upsert / purchase 発火に使わせない。空値 = 詐称の可能性として一律拒否。
    metadata = _sg(session, "metadata")
    meta_user_id = _sg(metadata, "user_id")
    if not meta_user_id:
        raise PermissionError("Session has no user_id in metadata — refuse to verify")
    if meta_user_id != user.id:
        raise PermissionError("Session does not belong to the authenticated user")

    payment_status = _sg(session, "payment_status")
    # subscription の初回支払いが完了している状態は "paid"、
    # 100%クーポン / ¥0 トライアル初回は "no_payment_required" で成立扱いになる。
    paid = payment_status in ("paid", "no_payment_required")

    currency = (_sg(session, "currency", "") or "").lower()
    amount_total = _sg(session, "amount_total")
    value = _to_decimal_amount(amount_total, currency)
    plan_id = _sg(metadata, "plan_id", "") or ""

    # ★ DB upsert — webhook 未着でもここで反映させる
    upsert_report: dict = {"attempted": False}
    if paid:
        try:
            upsert_report = _upsert_subscription_from_session(db, user, session, matched_key)
        except Exception as e:
            logger.error("Failed to upsert subscription from verify: %s", e, exc_info=True)
            upsert_report = {"attempted": True, "success": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}

    return {
        "paid": paid,
        "payment_status": payment_status,
        "value": value,
        "currency": currency.upper(),
        "transaction_id": session_id,
        "plan_id": plan_id,
        "upsert": upsert_report,
    }


def sync_subscriptions_for_customer(db: Session, user: User) -> str:
    """Stripe から現ユーザーの全サブスクを引き、DB を Stripe 側に寄せて同期する。

    Stripe が single source of truth。DB はそのミラー。
    - active/trialing/past_due を DB に upsert
    - canceled は DB 側も "canceled" に更新
    - 返り値は同期後の最有力プラン (active/trialing の最新)
    """
    _ensure_api_key()
    if not user.stripe_customer_id:
        return "free"

    # 複数のキーで customer を試す (test/live 両対応)
    candidate_keys: list[str] = []
    seen: set[str] = set()
    def _add(k: str) -> None:
        k = (k or "").strip()
        if k and k not in seen:
            seen.add(k)
            candidate_keys.append(k)
    _add(stripe.api_key)
    for p in ("starter", "pro", "premium"):
        _add(os.environ.get(f"STRIPE_SECRET_KEY_{p.upper()}", ""))

    subs_list = None
    prev = stripe.api_key
    last_err: Optional[Exception] = None
    try:
        for key in candidate_keys:
            stripe.api_key = key
            try:
                subs_list = stripe.Subscription.list(
                    customer=user.stripe_customer_id,
                    status="all",
                    limit=20,
                )
                break
            except stripe.error.InvalidRequestError as e:
                last_err = e
                continue
    finally:
        stripe.api_key = prev

    if subs_list is None:
        raise last_err or stripe.error.InvalidRequestError(
            "Could not list subscriptions", param="customer"
        )

    best_plan: str = "free"
    best_rank: int = -1
    best_sub_id: Optional[str] = None
    _rank = {"free": 0, "starter": 1, "pro": 2, "premium": 3}

    subs_data = _sg(subs_list, "data", []) or []
    for sub_obj in subs_data:
        sub_id = _sg(sub_obj, "id")
        if not sub_id:
            continue
        status = _sg(sub_obj, "status", "canceled") or "canceled"
        items_obj = _sg(sub_obj, "items")
        items_data = _sg(items_obj, "data", []) or []
        price_id = ""
        if items_data:
            price_obj = _sg(items_data[0], "price")
            price_id = _sg(price_obj, "id", "") or ""
        meta = _sg(sub_obj, "metadata")
        plan_id = (
            PRICE_TO_PLAN.get(price_id)
            or _sg(meta, "plan_id")
            or "unknown"
        )
        if plan_id not in _rank:
            plan_id = "unknown"

        existing = db.query(Subscription).filter(Subscription.id == sub_id).first()
        period_start = _ts_to_dt(_sg(sub_obj, "current_period_start"))
        period_end = _ts_to_dt(_sg(sub_obj, "current_period_end"))
        cancel_at_period_end = bool(_sg(sub_obj, "cancel_at_period_end", False))

        if existing:
            existing.user_id = user.id
            existing.stripe_price_id = price_id or existing.stripe_price_id
            if plan_id != "unknown":
                existing.plan_id = plan_id
            existing.status = status
            existing.current_period_start = period_start
            existing.current_period_end = period_end
            existing.cancel_at_period_end = cancel_at_period_end
        else:
            db.add(Subscription(
                id=sub_id,
                user_id=user.id,
                stripe_price_id=price_id,
                plan_id=plan_id if plan_id != "unknown" else "free",
                status=status,
                current_period_start=period_start,
                current_period_end=period_end,
                cancel_at_period_end=cancel_at_period_end,
            ))

        if status in ("active", "trialing") and plan_id in _rank:
            if _rank[plan_id] > best_rank:
                best_rank = _rank[plan_id]
                best_plan = plan_id
                best_sub_id = sub_id

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("DB commit in sync failed: %s", e)
        raise

    # 1ユーザ=1レコード不変条件: 最上位の active subscription だけ残し、他は削除。
    # (Stripe 側の cancel はしない — sync は認知の修復が目的で、実サブスク状態を変えない)
    if best_sub_id:
        _ensure_single_subscription_per_user(db, user.id, best_sub_id, cancel_in_stripe=False)
    else:
        # active/trialing が一つも無ければ、全行削除して Free 扱いにする
        db.query(Subscription).filter(Subscription.user_id == user.id).delete(synchronize_session=False)
        db.commit()

    logger.info(
        "Synced %d subscriptions for user %s (best_plan=%s, kept=%s)",
        len(subs_data), user.id, best_plan, best_sub_id,
    )
    return best_plan


def activate_free_plan(db: Session, user: User) -> None:
    """Free プランを DB に直接登録する（Stripe Checkout 不要）。

    1ユーザ=1レコード不変条件。既に有料プランがあった場合は
    それを Stripe 上で cancel し、DB 行も削除して Free の pseudo 行だけ残す。
    """
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
    # Free に戻す場合も旧有料サブスク行 / Stripe 側をクリーンアップ
    _ensure_single_subscription_per_user(db, user.id, fake_sub_id)


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
    """Stripe Webhook イベントを検証して処理する。

    Webhook secret が未設定だと署名検証を素通りさせる実装は絶対に避ける。
    未設定時は全ての webhook を拒否する。
    """
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
    if not webhook_secret:
        logger.error(
            "SECURITY: STRIPE_WEBHOOK_SECRET is not set. All webhook requests will be rejected."
        )
        raise stripe.error.SignatureVerificationError(
            "Webhook secret not configured", sig_header, payload,
        )
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

    elif event_type in ("charge.refunded", "charge.dispute.created"):
        # 返金 / チャージバックは即座に関連サブスクを canceled 扱いにする。
        # これらは決済プラットフォーム起点の強制失効なのでユーザー権限に関係なく適用。
        _handle_charge_revoked(data, db, event_type)

    else:
        logger.debug("Unhandled Stripe event type: %s", event_type)


def _handle_charge_revoked(obj, db: Session, reason: str) -> None:
    """charge.refunded / charge.dispute.created: 該当サブスクを canceled にする。

    Charge の `invoice` → `subscription` を逆引きして DB を demote。
    Stripe 側のキャンセルは別途 webhook (customer.subscription.deleted) が来るはずだが、
    届くまでの間に有料機能を使われないようここで即座に Free 降格させる。
    """
    invoice_id = _sg(obj, "invoice")
    if not invoice_id:
        logger.info("%s without invoice, skipping", reason)
        return
    # invoice → subscription
    sub_id: Optional[str] = None
    prev = stripe.api_key
    try:
        for key in _all_candidate_keys():
            stripe.api_key = key
            try:
                invoice = stripe.Invoice.retrieve(invoice_id)
                sub_id = _sg(invoice, "subscription")
                if sub_id:
                    break
            except stripe.error.InvalidRequestError:
                continue
    finally:
        stripe.api_key = prev

    if not sub_id:
        logger.warning("%s: could not resolve subscription from invoice %s", reason, invoice_id)
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub and sub.status != "canceled":
        sub.status = "canceled"
        db.commit()
        logger.warning(
            "Demoted subscription %s to canceled due to %s (invoice %s)",
            sub_id, reason, invoice_id,
        )


# ── 個別イベントハンドラ ─────────────────────────────────────────────────────

def _handle_checkout_completed(session_obj, db: Session) -> None:
    """checkout.session.completed: stripe_customer_id をユーザーに紐付ける。"""
    customer_id = _sg(session_obj, "customer")
    if not customer_id:
        return

    meta = _sg(session_obj, "metadata")
    meta_user_id = _sg(meta, "user_id")
    if not meta_user_id:
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

    plan_id = _sg(meta, "plan_id", "unknown") or "unknown"

    sub_id = _sg(session_obj, "subscription")
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
        # 1ユーザ=1レコード不変条件: 旧サブスク行 (pseudo free 行含む) を掃除
        _ensure_single_subscription_per_user(db, meta_user_id, sub_id)


def _get_plan_from_subscription(sub_obj) -> str:
    """Stripe Subscription オブジェクトから plan_id を解決する。"""
    items_obj = _sg(sub_obj, "items")
    items_data = _sg(items_obj, "data", []) or []
    if items_data:
        first_price = _sg(items_data[0], "price")
        price_id = _sg(first_price, "id", "") or ""
        plan = PRICE_TO_PLAN.get(price_id)
        if plan:
            return plan
    meta = _sg(sub_obj, "metadata")
    meta_plan = _sg(meta, "plan_id")
    if meta_plan:
        return meta_plan
    return "unknown"


def _get_user_id_from_customer(customer_id: str, db: Session) -> Optional[str]:
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    return user.id if user else None


def _handle_subscription_created(sub_obj, db: Session) -> None:
    """customer.subscription.created: subscriptions テーブルに新規追加。"""
    sub_id = _sg(sub_obj, "id")
    if not sub_id:
        return
    customer_id = _sg(sub_obj, "customer")
    user_id = _get_user_id_from_customer(customer_id, db) if customer_id else None
    if not user_id:
        meta = _sg(sub_obj, "metadata")
        meta_user_id = _sg(meta, "user_id")
        if meta_user_id:
            user = db.query(User).filter(User.id == meta_user_id).first()
            if user:
                user_id = user.id
                if not user.stripe_customer_id and customer_id:
                    user.stripe_customer_id = customer_id
                    db.commit()
    if not user_id:
        logger.warning("subscription.created: no user found for customer %s", customer_id)
        return

    plan_id = _get_plan_from_subscription(sub_obj)
    items_obj = _sg(sub_obj, "items")
    items_data = _sg(items_obj, "data", []) or []
    price_id = ""
    if items_data:
        first_price = _sg(items_data[0], "price")
        price_id = _sg(first_price, "id", "") or ""

    existing = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if existing:
        return

    sub = Subscription(
        id=sub_id,
        user_id=user_id,
        stripe_price_id=price_id,
        plan_id=plan_id,
        status=_sg(sub_obj, "status", "active") or "active",
        current_period_start=_ts_to_dt(_sg(sub_obj, "current_period_start")),
        current_period_end=_ts_to_dt(_sg(sub_obj, "current_period_end")),
        cancel_at_period_end=bool(_sg(sub_obj, "cancel_at_period_end", False)),
    )
    db.add(sub)
    db.commit()
    logger.info("Created subscription %s for user %s plan=%s", sub_id, user_id, plan_id)
    # 1ユーザ=1レコード不変条件
    _ensure_single_subscription_per_user(db, user_id, sub_id)


def _handle_subscription_updated(sub_obj, db: Session) -> None:
    """customer.subscription.updated: ステータス/プランを更新。"""
    sub_id = _sg(sub_obj, "id")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        _handle_subscription_created(sub_obj, db)
        return

    plan_id = _get_plan_from_subscription(sub_obj)
    items_obj = _sg(sub_obj, "items")
    items_data = _sg(items_obj, "data", []) or []
    if items_data:
        first_price = _sg(items_data[0], "price")
        price_id = _sg(first_price, "id", "") or sub.stripe_price_id
    else:
        price_id = sub.stripe_price_id

    sub.stripe_price_id = price_id
    sub.plan_id = plan_id
    sub.status = _sg(sub_obj, "status", sub.status) or sub.status
    sub.current_period_start = _ts_to_dt(_sg(sub_obj, "current_period_start"))
    sub.current_period_end = _ts_to_dt(_sg(sub_obj, "current_period_end"))
    sub.cancel_at_period_end = bool(_sg(sub_obj, "cancel_at_period_end", False))
    db.commit()
    logger.info("Updated subscription %s plan=%s status=%s", sub_id, plan_id, sub.status)


def _handle_subscription_deleted(sub_obj, db: Session) -> None:
    """customer.subscription.deleted: ステータスを canceled に更新。"""
    sub_id = _sg(sub_obj, "id")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub:
        sub.status = "canceled"
        db.commit()
        logger.info("Canceled subscription %s", sub_id)


def _handle_invoice_succeeded(invoice_obj, db: Session) -> None:
    """invoice.payment_succeeded: past_due を active にリセット。"""
    sub_id = _sg(invoice_obj, "subscription")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub and sub.status == "past_due":
        sub.status = "active"
        sub.current_period_end = _ts_to_dt(_sg(invoice_obj, "period_end"))
        db.commit()
        logger.info("Reset subscription %s to active after payment", sub_id)


def _handle_invoice_failed(invoice_obj, db: Session) -> None:
    """invoice.payment_failed: ステータスを past_due に更新。"""
    sub_id = _sg(invoice_obj, "subscription")
    if not sub_id:
        return
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if sub and sub.status == "active":
        sub.status = "past_due"
        db.commit()
        logger.info("Set subscription %s to past_due after payment failure", sub_id)

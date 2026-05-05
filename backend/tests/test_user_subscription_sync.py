"""User と Subscription の同期ロジックの動作確認テスト。

シナリオ全部:
    - 新規ユーザー登録 (ログイン直後): users 1 行 + Free subscription 1 行
    - 同じユーザーが再ログイン: 重複挿入されない
    - レガシーユーザー (users 行のみ、subscription 無し) の self-heal
    - canceled 行だけ持つユーザーへの非介入 (蘇生しない)
    - 既に有料プラン active 行を持つユーザーへの非介入
    - 並行挿入時の IntegrityError 回復 (重複ゼロ保証)
    - バックフィル endpoint が「行が完全に無いユーザー」だけを対象にする

SQLite in-memory で Neon を触らずに動かす。

実行:
    cd backend/
    python -m pytest tests/test_user_subscription_sync.py -v
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 環境変数を import 時点で安全側にセット (auth_deps の本番ガードを抑止)
os.environ.setdefault("ALLOW_UNSIGNED_INTERNAL_AUTH", "1")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.db_models import Subscription, User  # noqa: E402
from app.auth_deps import _ensure_free_subscription_row, _resolve_user  # noqa: E402


# ─── pytest fixture: 各テストごとに in-memory SQLite を作り直す ──────────────


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _count_subs(db, user_id: str, *, status: str | None = None) -> int:
    q = db.query(Subscription).filter(Subscription.user_id == user_id)
    if status is not None:
        q = q.filter(Subscription.status == status)
    return q.count()


# ─── 1. 新規ユーザー登録 ─────────────────────────────────────────────────────


def test_new_user_via_resolve_user_creates_user_and_free_sub(db):
    """ログイン直後に require_user 経路で来た新規ユーザーは
    users 行と Free subscription 行が同時に作られる。"""
    user = _resolve_user(
        db,
        x_user_id="u1",
        x_user_email="alice@example.com",
        x_user_name="Alice",
        x_internal_secret=None,
    )
    assert user is not None
    assert user.id == "u1"
    assert user.email == "alice@example.com"

    # users 1 行
    assert db.query(User).count() == 1
    # subscription も同時に 1 行
    assert _count_subs(db, "u1") == 1
    sub = db.query(Subscription).filter(Subscription.user_id == "u1").one()
    assert sub.id == "free_u1"
    assert sub.plan_id == "free"
    assert sub.status == "active"


# ─── 2. 同じユーザーが再ログイン ─────────────────────────────────────────────


def test_relogin_does_not_create_duplicate_subscription(db):
    """同じユーザーが何度ログインしても subscription 行は 1 行のまま。"""
    for _ in range(5):
        _resolve_user(db, "u1", "alice@example.com", "Alice", None)

    assert db.query(User).count() == 1
    assert _count_subs(db, "u1") == 1


# ─── 3. レガシーユーザー (users 行のみ、subscription 無し) ───────────────────


def test_legacy_user_self_heal_inserts_free_row(db):
    """旧コード時代に作られた users 行のみのユーザー → ヘルパー呼び出しで Free 行が入る。"""
    legacy = User(id="legacy1", email="bob@example.com", name="Bob")
    db.add(legacy)
    db.commit()

    assert db.query(User).count() == 1
    assert _count_subs(db, "legacy1") == 0

    _ensure_free_subscription_row(db, "legacy1")

    assert _count_subs(db, "legacy1") == 1
    sub = db.query(Subscription).filter(Subscription.user_id == "legacy1").one()
    assert sub.plan_id == "free"
    assert sub.status == "active"


def test_helper_idempotent_when_called_repeatedly(db):
    """ヘルパーを何度呼んでも 1 行のまま (= 重複挿入されない)。"""
    legacy = User(id="legacy2", email="b@example.com", name="B")
    db.add(legacy)
    db.commit()

    for _ in range(10):
        _ensure_free_subscription_row(db, "legacy2")

    assert _count_subs(db, "legacy2") == 1


# ─── 4. canceled 行だけ持つユーザーへの非介入 ────────────────────────────────


def test_user_with_only_canceled_row_is_not_touched(db):
    """canceled 行だけ持つユーザーには新規挿入しない (重複・蘇生回避の方針)。

    Free に戻したい時は明示的に POST /subscription/checkout 経路を踏む設計。"""
    legacy = User(id="legacy3", email="c@example.com", name="C")
    db.add(legacy)
    db.add(Subscription(
        id="free_legacy3",
        user_id="legacy3",
        stripe_price_id="",
        plan_id="free",
        status="canceled",
        cancel_at_period_end=False,
    ))
    db.commit()

    assert _count_subs(db, "legacy3") == 1
    assert _count_subs(db, "legacy3", status="canceled") == 1

    _ensure_free_subscription_row(db, "legacy3")

    # 1 行のままで status も canceled のまま (蘇生しない)
    assert _count_subs(db, "legacy3") == 1
    assert _count_subs(db, "legacy3", status="canceled") == 1
    assert _count_subs(db, "legacy3", status="active") == 0


# ─── 5. 有料プランを既に持つユーザーへの非介入 ───────────────────────────────


def test_user_with_active_paid_subscription_is_not_touched(db):
    """有料プラン active 行を持つユーザーに Free を「追加挿入しない」。"""
    paid_user = User(id="paid1", email="p@example.com", name="P")
    db.add(paid_user)
    db.add(Subscription(
        id="sub_pro_real",
        user_id="paid1",
        stripe_price_id="price_pro",
        plan_id="pro",
        status="active",
        cancel_at_period_end=False,
    ))
    db.commit()

    _ensure_free_subscription_row(db, "paid1")

    # 1 行のまま、Pro が維持される
    assert _count_subs(db, "paid1") == 1
    sub = db.query(Subscription).filter(Subscription.user_id == "paid1").one()
    assert sub.plan_id == "pro"
    assert sub.status == "active"


def test_user_with_trialing_subscription_is_not_touched(db):
    """trialing 行を持つユーザーにも追加挿入しない。"""
    u = User(id="trial1", email="t@example.com", name="T")
    db.add(u)
    db.add(Subscription(
        id="sub_trial_real",
        user_id="trial1",
        stripe_price_id="price_pro",
        plan_id="pro",
        status="trialing",
        cancel_at_period_end=False,
    ))
    db.commit()

    _ensure_free_subscription_row(db, "trial1")

    assert _count_subs(db, "trial1") == 1
    assert db.query(Subscription).filter(Subscription.user_id == "trial1").one().status == "trialing"


def test_user_with_past_due_subscription_is_not_touched(db):
    """past_due も既存行扱い → 追加挿入しない (再決済対応中で Free にダウングレード
    したくないため)。"""
    u = User(id="pd1", email="pd@example.com", name="PD")
    db.add(u)
    db.add(Subscription(
        id="sub_past_due",
        user_id="pd1",
        stripe_price_id="price_pro",
        plan_id="pro",
        status="past_due",
        cancel_at_period_end=False,
    ))
    db.commit()

    _ensure_free_subscription_row(db, "pd1")

    assert _count_subs(db, "pd1") == 1
    assert db.query(Subscription).filter(Subscription.user_id == "pd1").one().status == "past_due"


# ─── 6. 並行挿入時の IntegrityError 回復 ─────────────────────────────────────


def test_concurrent_insert_does_not_duplicate(db):
    """同じ Free ID を別セッションで先に挿入されたケース → IntegrityError を
    rollback で吸収して、最終的に行は 1 行のまま。"""
    u = User(id="race1", email="r@example.com", name="R")
    db.add(u)
    db.commit()

    # 別セッションが先に挿入したことをシミュレート
    other_engine = db.bind
    OtherSession = sessionmaker(bind=other_engine, autoflush=False, autocommit=False, future=True)
    other = OtherSession()
    try:
        other.add(Subscription(
            id="free_race1",
            user_id="race1",
            stripe_price_id="",
            plan_id="free",
            status="active",
            cancel_at_period_end=False,
        ))
        other.commit()
    finally:
        other.close()

    # こちらのセッションでは「行が無い」と認識した直後に挿入を試みる状況を
    # シミュレートしたい。SQLite in-memory + 同一プロセスでは exists() が
    # 即座に True を返すので、強制的に挿入を試みて IntegrityError を発生させる。
    db.add(Subscription(
        id="free_race1",  # PK 衝突
        user_id="race1",
        stripe_price_id="",
        plan_id="free",
        status="active",
        cancel_at_period_end=False,
    ))
    from sqlalchemy.exc import IntegrityError
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 最終的に行は 1 行
    assert _count_subs(db, "race1") == 1


# ─── 7. 同期取れているか: users 数 == subscriptions ユニーク user_id 数 ────


def test_users_and_subscriptions_stay_in_sync_across_signups(db):
    """3 人連続でサインアップした時、users 数と「sub 行を持つ user 数」が一致する。
    これが本機能で最も大事な不変条件 (ユーザー登録で詰まらない & 集計が合う)。"""
    _resolve_user(db, "u_a", "a@example.com", "A", None)
    _resolve_user(db, "u_b", "b@example.com", "B", None)
    _resolve_user(db, "u_c", "c@example.com", "C", None)

    n_users = db.query(User).count()
    n_users_with_sub = (
        db.query(Subscription.user_id).distinct().count()
    )

    assert n_users == 3
    assert n_users_with_sub == 3
    assert n_users == n_users_with_sub  # ← 集計の整合性


def test_users_with_sub_match_after_legacy_self_heal(db):
    """レガシーユーザー (sub 行なし) と新規ユーザーが混在しても、
    全員 self-heal/新規挿入後に 1:1 同期が取れる。"""
    # レガシー 2 人 (sub 行なしで users だけ insert)
    db.add(User(id="leg1", email="leg1@example.com", name="L1"))
    db.add(User(id="leg2", email="leg2@example.com", name="L2"))
    db.commit()
    # 新規 1 人 (resolve 経由で Free 行同時作成)
    _resolve_user(db, "new1", "new1@example.com", "N1", None)

    assert db.query(User).count() == 3
    assert db.query(Subscription.user_id).distinct().count() == 1  # 新規だけ

    # レガシー側を self-heal
    _ensure_free_subscription_row(db, "leg1")
    _ensure_free_subscription_row(db, "leg2")

    assert db.query(User).count() == 3
    assert db.query(Subscription.user_id).distinct().count() == 3
    # 全員 active な Free / paid を持つ
    actives = db.query(Subscription).filter(Subscription.status == "active").count()
    assert actives == 3


# ─── 8. バックフィル endpoint のフィルタ条件 ─────────────────────────────────


def test_backfill_filter_targets_only_users_with_no_sub_rows(db):
    """バックフィルが「subscription 行が 1 件も無いユーザー」だけを抽出する SQL
    のテスト (canceled 行を持つユーザーは対象から外れる)。"""
    # 4 人:
    #   noSub: 行無し → バックフィル対象
    #   onlyCanceled: canceled 行あり → 対象外 (蘇生しない)
    #   active: active 行あり → 対象外
    #   newWithFree: Free active 行あり → 対象外
    db.add_all([
        User(id="noSub",        email="ns@x.com", name="NS"),
        User(id="onlyCanceled", email="oc@x.com", name="OC"),
        User(id="active",       email="ac@x.com", name="AC"),
        User(id="newWithFree",  email="nw@x.com", name="NW"),
    ])
    db.add_all([
        Subscription(id="free_onlyCanceled", user_id="onlyCanceled",
                     stripe_price_id="", plan_id="free", status="canceled"),
        Subscription(id="sub_active_real", user_id="active",
                     stripe_price_id="price_pro", plan_id="pro", status="active"),
        Subscription(id="free_newWithFree", user_id="newWithFree",
                     stripe_price_id="", plan_id="free", status="active"),
    ])
    db.commit()

    # subscription.py の backfill_free_subscriptions と同じクエリを再現
    users_without_any_sub = db.query(User).filter(
        ~db.query(Subscription).filter(
            Subscription.user_id == User.id,
        ).exists()
    ).all()
    target_ids = {u.id for u in users_without_any_sub}

    # noSub だけが対象
    assert target_ids == {"noSub"}

    # ヘルパーをかけても、onlyCanceled / active / newWithFree は変化しない
    for uid in ["onlyCanceled", "active", "newWithFree"]:
        before = _count_subs(db, uid)
        _ensure_free_subscription_row(db, uid)
        after = _count_subs(db, uid)
        assert before == after, f"helper should not have inserted for {uid}"

    # noSub にだけ Free 行が入る
    _ensure_free_subscription_row(db, "noSub")
    assert _count_subs(db, "noSub") == 1
    assert (
        db.query(Subscription)
        .filter(Subscription.user_id == "noSub")
        .one()
        .plan_id
        == "free"
    )


# ─── 9. 既存ユーザーの email/name 更新時に Free 行が壊れない ──────────────────


def test_existing_user_email_update_does_not_disturb_subscription(db):
    """ログイン後にメール/名前が変わって _resolve_user に再度入っても、
    既存の subscription 行は影響を受けない。"""
    _resolve_user(db, "u1", "alice@example.com", "Alice", None)
    # paid プランをシミュレート (Free 行を消して paid 行に置き換え)
    db.query(Subscription).filter(Subscription.user_id == "u1").delete()
    db.add(Subscription(id="sub_pro_real", user_id="u1", stripe_price_id="price_pro",
                        plan_id="pro", status="active"))
    db.commit()

    # 名前変更後に再ログイン
    _resolve_user(db, "u1", "alice@example.com", "Alice (Renamed)", None)

    # subscription はそのまま pro
    assert _count_subs(db, "u1") == 1
    sub = db.query(Subscription).filter(Subscription.user_id == "u1").one()
    assert sub.plan_id == "pro"
    assert sub.status == "active"

    # User の name は更新されている
    user = db.query(User).filter(User.id == "u1").one()
    assert user.name == "Alice (Renamed)"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))

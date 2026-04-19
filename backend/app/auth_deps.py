"""FastAPI 依存性注入: ユーザー認証と quota 強制。

- `require_user`: 認証必須。ユーザーが解決できない場合は 401。
- `enforce_ai_quota`: AIリクエスト quota を事前チェック。越えていたら 429。
- `enforce_pdf_quota`: PDF出力 quota を事前チェック。越えていたら 429。

いずれもサーバサイドで強制される。フロント改変/API直叩きでバイパス不可。
"""
from __future__ import annotations

import os
from typing import Optional
from urllib.parse import unquote

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from .db_models import User
from .plan_limits import Feature, FEATURE_MIN_PLAN, can_use_feature, get_effective_plan
from .usage_service import check_ai_quota, check_pdf_quota


# プラン表示用 (日本語)
_PLAN_LABEL_JA = {
    "free": "Free", "starter": "Starter", "pro": "Pro", "premium": "Premium",
}
_FEATURE_LABEL_JA: dict[str, str] = {
    "grading":         "採点・自動採点",
    "ocr":             "PDF・画像取り込み (OCR)",
    "latexExport":     "LaTeXソースエクスポート",
    "allTemplates":    "全テンプレート利用",
    "batch":           "バッチ処理",
}


INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "")

# ★ 本番環境 (FRONTEND_URL が localhost 以外) では INTERNAL_API_SECRET 未設定を
# 起動時に明示的に警告する。未設定だと x-user-id 詐称でバックエンドを直叩きされる。
if not INTERNAL_SECRET:
    _frontend = os.environ.get("FRONTEND_URL", "").lower()
    _is_prod = _frontend and "localhost" not in _frontend and "127.0.0.1" not in _frontend
    if _is_prod:
        import logging as _logging
        _logging.getLogger(__name__).error(
            "SECURITY: INTERNAL_API_SECRET is not set in a production-like environment. "
            "Requests to this backend can be forged with arbitrary x-user-id headers. "
            "Set this env var to match the Next.js layer's INTERNAL_API_SECRET."
        )


def _resolve_user(
    db: Session,
    x_user_id: Optional[str],
    x_user_email: Optional[str],
    x_user_name: Optional[str],
    x_internal_secret: Optional[str],
) -> Optional[User]:
    """x-user-id から User を取得。存在しない場合は upsert。

    id が違っても email が一致する既存行があれば再利用する
    (unique(email) 制約衝突で 500 にならないようにする)。
    ただし email フォールバックは内部シークレット検証を通過した時のみ許可。
    """
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        return None
    if not x_user_id:
        return None

    decoded_name = unquote(x_user_name) if x_user_name else x_user_name

    user = db.query(User).filter(User.id == x_user_id).first()
    # email フォールバックは INTERNAL_SECRET 検証済みの経路のみ
    # (未設定環境では id 完全一致のみ受け付け、なりすまし耐性を底上げ)
    if not user and x_user_email and INTERNAL_SECRET:
        user = db.query(User).filter(User.email == x_user_email).first()

    if not user:
        user = User(id=x_user_id, email=x_user_email, name=decoded_name)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if x_user_email:
                user = db.query(User).filter(User.email == x_user_email).first()
            if not user:
                user = db.query(User).filter(User.id == x_user_id).first()
            if not user:
                raise
        else:
            db.refresh(user)
        return user

    changed = False
    if x_user_email and user.email != x_user_email:
        other = db.query(User).filter(User.email == x_user_email, User.id != user.id).first()
        if not other:
            user.email = x_user_email
            changed = True
    if decoded_name and user.name != decoded_name:
        user.name = decoded_name
        changed = True
    if changed:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return user


def require_user(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    x_user_email: Optional[str] = Header(default=None, alias="x-user-email"),
    x_user_name: Optional[str] = Header(default=None, alias="x-user-name"),
    x_internal_secret: Optional[str] = Header(default=None, alias="x-internal-secret"),
    db: Session = Depends(get_db),
) -> User:
    """認証必須の依存性。未認証なら 401。"""
    user = _resolve_user(db, x_user_id, x_user_email, x_user_name, x_internal_secret)
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "ログインが必要です。サインインしてからもう一度お試しください。"},
        )
    return user


def enforce_ai_quota(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> User:
    """AI quota を事前チェック。越えていたら 429。呼び出し側で log_usage を行うこと。"""
    plan_id = get_effective_plan(db, user.id)
    check = check_ai_quota(db, user.id, plan_id)
    if not check["allowed"]:
        raise HTTPException(
            status_code=429,
            detail={
                "code": check["code"],
                "message": check["reason"],
                "plan_id": check["plan_id"],
                "used_day": check["used_day"],
                "used_month": check["used_month"],
                "limit_day": check["limit_day"],
                "limit_month": check["limit_month"],
            },
        )
    return user


def enforce_pdf_quota(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> User:
    """PDF quota を事前チェック。越えていたら 429。"""
    plan_id = get_effective_plan(db, user.id)
    check = check_pdf_quota(db, user.id, plan_id)
    if not check["allowed"]:
        raise HTTPException(
            status_code=429,
            detail={
                "code": check["code"],
                "message": check["reason"],
                "plan_id": check["plan_id"],
                "used_month": check["used_month"],
                "limit_month": check["limit_month"],
            },
        )
    return user


def require_feature(feature: Feature):
    """プラン別 feature gate の依存性ファクトリ。

    当該機能を使えるプラン未満のユーザーは 403 FEATURE_NOT_AVAILABLE を返す。
    認証は `require_user` に委ねるので、未認証は 401 になる。
    サーバ側が最終権限 (LP の Free プラン表示との整合を保つ)。
    """
    def _dep(
        user: User = Depends(require_user),
        db: Session = Depends(get_db),
    ) -> User:
        plan_id = get_effective_plan(db, user.id)
        if not can_use_feature(plan_id, feature):
            required = FEATURE_MIN_PLAN[feature]
            label = _FEATURE_LABEL_JA.get(feature, feature)
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FEATURE_NOT_AVAILABLE",
                    "feature": feature,
                    "plan_id": plan_id,
                    "required_plan": required,
                    "message": (
                        f"「{label}」は {_PLAN_LABEL_JA[required]} プラン以上でご利用いただけます。"
                    ),
                },
            )
        return user
    return _dep


def enforce_ai_quota_with_feature(feature: Feature):
    """`require_feature` と `enforce_ai_quota` を同時に適用する依存性。

    AI を消費する機能 (OMR / Grading) ではプラン + quota の両方を見る必要があるので、
    ルータ側での `Depends` 2 段重ねを 1 箇所にまとめる。
    """
    def _dep(
        user: User = Depends(require_feature(feature)),
        db: Session = Depends(get_db),
    ) -> User:
        plan_id = get_effective_plan(db, user.id)
        check = check_ai_quota(db, user.id, plan_id)
        if not check["allowed"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": check["code"],
                    "message": check["reason"],
                    "plan_id": check["plan_id"],
                    "used_day": check["used_day"],
                    "used_month": check["used_month"],
                    "limit_day": check["limit_day"],
                    "limit_month": check["limit_month"],
                },
            )
        return user
    return _dep

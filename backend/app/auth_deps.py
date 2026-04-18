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
from sqlalchemy.orm import Session

from .database import get_db
from .db_models import User
from .plan_limits import get_effective_plan
from .usage_service import check_ai_quota, check_pdf_quota


INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "")


def _resolve_user(
    db: Session,
    x_user_id: Optional[str],
    x_user_email: Optional[str],
    x_user_name: Optional[str],
    x_internal_secret: Optional[str],
) -> Optional[User]:
    """x-user-id から User を取得。存在しない場合は upsert。"""
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        return None
    if not x_user_id:
        return None

    user = db.query(User).filter(User.id == x_user_id).first()
    decoded_name = unquote(x_user_name) if x_user_name else x_user_name
    if not user:
        user = User(id=x_user_id, email=x_user_email, name=decoded_name)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        changed = False
        if x_user_email and user.email != x_user_email:
            user.email = x_user_email
            changed = True
        if decoded_name and user.name != decoded_name:
            user.name = decoded_name
            changed = True
        if changed:
            db.commit()
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

"""SQLAlchemy ORM モデル (User / Subscription / UsageLog)"""
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Index
from sqlalchemy.orm import relationship
from .database import Base


def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


class User(Base):
    __tablename__ = "users"

    # Google OAuth の sub 値をそのまま PK に使う
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=True)
    stripe_customer_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    subscriptions = relationship("Subscription", back_populates="user")


class Subscription(Base):
    __tablename__ = "subscriptions"

    # Stripe subscription ID ("sub_xxx")
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    stripe_price_id = Column(String, nullable=False)
    plan_id = Column(String, nullable=False)  # "starter" / "pro" / "premium"
    status = Column(String, nullable=False)   # "active" / "past_due" / "canceled" / "trialing"
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="subscriptions")


class UsageLog(Base):
    """
    課金対象アクションの利用記録。プラン別の月次/日次上限判定に使う。
    action: "ai_request" (AIチャット/OMR) または "pdf_export" (教材PDF出力)。
    """
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("ix_usage_logs_user_action_created", "user_id", "action", "created_at"),
    )

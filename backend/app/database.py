"""SQLAlchemy データベース設定

本番運用 (Koyeb など) では必ず永続化される PostgreSQL を使用すること。
SQLite (デフォルト) はエフェメラルなコンテナで動くと **コンテナ再起動のたびに
UsageLog が全部消える** ため、AI回数の上限がリセットされてしまう (= 無限に使える)。

FRONTEND_URL が localhost 以外を指している = 本番相当とみなし、
SQLite の場合は起動時に ERROR を吐いて運用者に気付かせる。
"""
import logging
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./eddivom.db")


def _mask_db_url(url: str) -> str:
    """ログ出力用に DATABASE_URL のパスワード部分をマスクした文字列を返す。"""
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    creds, host = rest.split("@", 1)
    if ":" in creds:
        user, _pw = creds.split(":", 1)
        return f"{scheme}://{user}:***@{host}"
    return url


def _is_production_env() -> bool:
    """本番相当環境の判定。FRONTEND_URL が localhost/127/空 以外なら本番。"""
    frontend = (os.environ.get("FRONTEND_URL") or "").lower().strip()
    if not frontend:
        return False
    if "localhost" in frontend or "127.0.0.1" in frontend:
        return False
    return True


_is_sqlite = DATABASE_URL.startswith("sqlite")
_prod_env = _is_production_env()

# 起動時に DB 接続方式を明示ログ (診断のため必須)。
logger.info(
    "[database] DATABASE_URL=%s dialect=%s prod=%s",
    _mask_db_url(DATABASE_URL),
    "sqlite" if _is_sqlite else "postgresql/other",
    _prod_env,
)

# 本番で SQLite は極めて危険 (エフェメラルコンテナで再起動のたび UsageLog が飛ぶ)。
# デフォルト挙動 = 起動は続けるが、非常に目立つ ERROR ログを毎回吐く。
# ENFORCE_DB_PERSISTENCE=1 を設定している環境では `RuntimeError` で起動を止める
# (= Koyeb などで再起動ループさせて気付かせる)。
_SQLITE_PROD_WARNING = (
    "SECURITY/BILLING: DATABASE_URL is SQLite in a production-like environment "
    f"(FRONTEND_URL={os.environ.get('FRONTEND_URL')}). "
    "SQLite in an ephemeral container loses all UsageLog rows on restart, "
    "which allows Free users to bypass AI quota by waiting for a container restart. "
    "Set DATABASE_URL to a persistent PostgreSQL URL (e.g. Neon) before serving traffic."
)
_sqlite_prod_violation = _is_sqlite and _prod_env

if _sqlite_prod_violation:
    logger.error(_SQLITE_PROD_WARNING)
    if os.environ.get("ENFORCE_DB_PERSISTENCE", "").lower() in ("1", "true", "yes"):
        # Strict モード: 明示的に要求された場合のみ起動を拒否する。
        raise RuntimeError(_SQLITE_PROD_WARNING)

# SQLite の場合は check_same_thread=False が必要
connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_info() -> dict:
    """診断用: 現在の DB 接続の概要を返す。パスワードは含めない。"""
    return {
        "url_masked": _mask_db_url(DATABASE_URL),
        "dialect": engine.dialect.name,
        "is_sqlite": _is_sqlite,
        "is_production_env": _prod_env,
        # True = 本番想定でエフェメラル SQLite を使っている = データが消える
        "persistence_at_risk": _sqlite_prod_violation,
    }

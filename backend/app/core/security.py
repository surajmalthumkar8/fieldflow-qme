"""Password hashing + JWT issue/verify."""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import get_settings

settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd.verify(password, password_hash)


def create_access_token(*, sub: str, jti: str, extra: dict | None = None) -> tuple[str, datetime]:
    """Return (token, expires_at)."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": sub, "jti": jti, "exp": expires_at, "iat": datetime.now(timezone.utc)}
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None

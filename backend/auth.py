"""Authentication and authorisation primitives.

Owns three concerns previously inlined in main.py (lines ~100–292 and
~4520–4556):

* **JWT lifecycle** — HMAC-SHA256 encode/decode plus the persisted
  revocation list (``revoked_tokens`` table, with an in-memory
  fallback for the rare case the DB write fails).
* **Password hashing** — bcrypt wrappers that degrade gracefully when
  the optional bcrypt library is missing.
* **FastAPI dependencies** — three styles of auth gate:
    - ``require_admin``: Bearer / cookie / X-Admin-Token → admin only.
    - ``verify_token``:  Bearer / cookie / X-Admin-Token → any role.
    - ``require_dual_role(*roles)``: same dual-scheme but any of
      ``roles`` (also accepts the X-Admin-Token shortcut).
    - ``get_session_user`` + ``require_session_role(*roles)``:
      cookie-only flow.

JWT_SECRET is read from the environment at import time; if missing,
the helpers raise HTTP 503 at call time rather than crashing the
process. main.py performs its own fail-fast on startup so production
boots are blocked early if JWT_SECRET is unset.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import config as shared_config

# bcrypt is optional at import time — endpoints that need it raise 503 if missing.
try:
    import bcrypt  # type: ignore
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False


logger = logging.getLogger("phoenix-auth")

# Read once at module load. main.py's fail-fast guarantees this is set
# in any production boot path; tests use a deterministic placeholder
# from backend/conftest.py.
JWT_SECRET: Optional[str] = os.getenv("JWT_SECRET")
JWT_TTL_MINUTES: int = int(os.getenv("JWT_TTL_MINUTES", "120"))

SESSION_COOKIE = "fnx_access_token"
IMPERSONATOR_COOKIE = "fnx_impersonator"

auth_scheme = HTTPBearer(auto_error=False)

# Persistent JWT revocation: a row in ``revoked_tokens`` is the source
# of truth. The in-memory dict is a fallback used only when the DB
# write fails, so logout still invalidates the token for the current
# process.
_REVOKED_TOKENS: dict[str, int] = {}


def _utcnow() -> datetime:
    """Drop-in replacement for the deprecated ``datetime.utcnow``.

    Returns naive UTC so ``.isoformat()`` output matches the legacy
    format (no ``+00:00`` suffix) and existing string comparisons keep
    working.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ----- JWT revocation list ----------------------------------------------------


def _revoke_token_signature(signature: str, exp: int) -> None:
    """Persist a revoked JWT signature until its original exp."""
    try:
        conn = sqlite3.connect(shared_config.DB_NAME)
        try:
            conn.execute(
                "INSERT OR REPLACE INTO revoked_tokens (signature, exp, revoked_at) VALUES (?, ?, ?)",
                (signature, int(exp), _utcnow().isoformat()),
            )
            conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as e:
        logger.error(f"Failed to persist revoked token, falling back to memory: {e}")
        _REVOKED_TOKENS[signature] = int(exp)


def _is_token_revoked(signature: str, now_ts: int) -> bool:
    """Check the DB blacklist (with opportunistic cleanup) plus in-memory fallback."""
    if signature in _REVOKED_TOKENS:
        return True
    try:
        conn = sqlite3.connect(shared_config.DB_NAME)
        try:
            conn.execute("DELETE FROM revoked_tokens WHERE exp <= ?", (now_ts,))
            conn.commit()
            row = conn.execute(
                "SELECT 1 FROM revoked_tokens WHERE signature = ? LIMIT 1",
                (signature,),
            ).fetchone()
            return row is not None
        finally:
            conn.close()
    except sqlite3.Error as e:
        logger.warning(f"Revoked-token lookup failed: {e}")
        return False


# ----- JWT codec --------------------------------------------------------------


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad_len = len(data) % 4
    if pad_len:
        data += "=" * (4 - pad_len)
    return base64.urlsafe_b64decode(data.encode("ascii"))


def _encode_jwt(payload: dict) -> str:
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET is not configured on server",
        )
    header_segment = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload_segment = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_segment}.{payload_segment}.{_b64url_encode(signature)}"


def _decode_jwt(token: str) -> dict:
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET is not configured on server",
        )
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
    header_segment, payload_segment, signature_segment = parts
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    expected = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    received = _b64url_decode(signature_segment)
    if not secrets.compare_digest(received, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")
    payload = json.loads(_b64url_decode(payload_segment).decode("utf-8"))
    exp = int(payload.get("exp", 0))
    now_ts = int(_utcnow().timestamp())
    if exp and now_ts >= exp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    # Check server-side revocation blacklist (DB-persisted, survives restarts).
    if _is_token_revoked(signature_segment, now_ts):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    return payload


# ----- Password hashing -------------------------------------------------------


def _hash_password(plain: str) -> str:
    if not BCRYPT_AVAILABLE:
        raise HTTPException(status_code=503, detail="bcrypt not installed (pip install bcrypt)")
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    if not BCRYPT_AVAILABLE:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _make_session_token(payload: dict) -> str:
    """Encode a session-style JWT with iat / exp populated from JWT_TTL_MINUTES."""
    issued_at = int(_utcnow().timestamp())
    return _encode_jwt({**payload, "iat": issued_at, "exp": issued_at + JWT_TTL_MINUTES * 60})


# ----- FastAPI dependencies ---------------------------------------------------


async def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme),
    fnx_access_token: Optional[str] = Cookie(default=None),
    x_admin_token: Optional[str] = Header(default=None),
) -> dict:
    """Accepts either a Bearer token (from /api/auth/unlock), the session cookie
    (from /api/auth/login), or the X-Admin-Token header. The first scheme found wins."""
    admin_token_env = os.getenv("ADMIN_API_TOKEN")
    if x_admin_token and admin_token_env and x_admin_token == admin_token_env:
        return {"role": "admin", "email": "admin@phoenix.com"}

    payload: Optional[dict] = None
    if credentials and credentials.scheme.lower() == "bearer":
        payload = _decode_jwt(credentials.credentials)
    elif fnx_access_token:
        payload = _decode_jwt(fnx_access_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return payload


async def verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme),
    fnx_access_token: Optional[str] = Cookie(default=None),
    x_admin_token: Optional[str] = Header(default=None),
) -> dict:
    """Same dual-scheme support — Bearer, cookie, or X-Admin-Token. Any role."""
    admin_token_env = os.getenv("ADMIN_API_TOKEN")
    if x_admin_token and admin_token_env and x_admin_token == admin_token_env:
        return {"role": "admin", "email": "admin@phoenix.com"}

    if credentials and credentials.scheme.lower() == "bearer":
        return _decode_jwt(credentials.credentials)
    if fnx_access_token:
        return _decode_jwt(fnx_access_token)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")


def require_dual_role(*allowed_roles: str):
    """Factory: dual-scheme (Bearer or cookie) dependency that allows any of `allowed_roles`.

    Companion to require_admin/require_session_role — those are admin-only or
    cookie-only respectively. Use this when an endpoint should be reachable from
    both auth flows (legacy /api/auth/unlock Bearer + new cookie session) and by
    multiple roles (e.g. admin + hrbp).
    """
    async def _checker(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme),
        fnx_access_token: Optional[str] = Cookie(default=None),
        x_admin_token: Optional[str] = Header(default=None),
    ) -> dict:
        admin_token_env = os.getenv("ADMIN_API_TOKEN")
        if x_admin_token and admin_token_env and x_admin_token == admin_token_env:
            return {"role": "admin", "email": "admin@phoenix.com"}

        payload: Optional[dict] = None
        if credentials and credentials.scheme.lower() == "bearer":
            payload = _decode_jwt(credentials.credentials)
        elif fnx_access_token:
            payload = _decode_jwt(fnx_access_token)
        if not payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")
        if payload.get("role") not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return payload
    return _checker


def get_session_user(fnx_access_token: Optional[str] = Cookie(default=None)) -> dict:
    """Cookie-based session dependency. Returns JWT payload or raises 401."""
    if not fnx_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _decode_jwt(fnx_access_token)


def require_session_role(*allowed_roles: str):
    """Role-gated dependency for the cookie session (mirrors `require_admin` for Bearer)."""
    def _checker(user: dict = Depends(get_session_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _checker


# ----- Cookie helpers ---------------------------------------------------------


def _set_session_cookie(response: Response, token: str, *, key: str = SESSION_COOKIE) -> None:
    """Attach a session JWT to the response as an httponly cookie.

    ``COOKIE_SECURE`` env flag toggles the ``Secure`` attribute — set
    to ``false`` only in local dev (HTTP). ``samesite=lax`` is enough
    for the same-origin frontend; ``max_age`` mirrors the JWT's own
    lifetime so the browser stops sending the cookie at roughly the
    moment the token expires.
    """
    secure_cookie = os.getenv("COOKIE_SECURE", "true").lower() != "false"
    response.set_cookie(
        key=key, value=token, httponly=True, secure=secure_cookie,
        samesite="lax", max_age=JWT_TTL_MINUTES * 60, path="/",
    )

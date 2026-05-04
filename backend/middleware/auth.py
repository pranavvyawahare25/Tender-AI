"""
Clerk JWT verification middleware for FastAPI.

Verifies Clerk session tokens from the Authorization header.
Uses Clerk's JWKS endpoint to validate RS256 signed JWTs.
"""

import os
import jwt
import httpx
from functools import lru_cache
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "")

# Derive the Clerk JWKS URL from the publishable key
# Format: pk_test_<base64(domain)> → domain → https://domain/.well-known/jwks.json
def _get_clerk_domain():
    """Extract Clerk frontend API domain from publishable key."""
    try:
        import base64
        # Remove 'pk_test_' or 'pk_live_' prefix
        key_part = CLERK_PUBLISHABLE_KEY.split("_", 2)[-1]
        # Add padding if needed
        padding = 4 - len(key_part) % 4
        if padding != 4:
            key_part += "=" * padding
        domain = base64.b64decode(key_part).decode("utf-8").rstrip("$")
        return domain
    except Exception:
        return None

CLERK_DOMAIN = _get_clerk_domain()
JWKS_URL = f"https://{CLERK_DOMAIN}/.well-known/jwks.json" if CLERK_DOMAIN else None

# ── JWKS Cache ───────────────────────────────────────────────────

_jwks_cache = None

async def _get_jwks():
    """Fetch and cache Clerk's JWKS keys."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    if not JWKS_URL:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(JWKS_URL, timeout=10)
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except Exception as e:
        print(f"⚠️ Failed to fetch JWKS from {JWKS_URL}: {e}")
        return None


def _get_public_key(jwks, token):
    """Extract the correct public key from JWKS based on the token's kid header."""
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

        # If no matching kid, try the first key
        if jwks.get("keys"):
            return jwt.algorithms.RSAAlgorithm.from_jwk(jwks["keys"][0])
    except Exception:
        pass
    return None


# ── User Info Model ──────────────────────────────────────────────

class ClerkUser:
    """Minimal user info extracted from the verified JWT."""

    def __init__(self, user_id: str, email: Optional[str] = None, name: Optional[str] = None):
        self.user_id = user_id
        self.email = email
        self.name = name

    def __repr__(self):
        return f"ClerkUser(id={self.user_id}, email={self.email})"


# ── FastAPI Dependencies ─────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[ClerkUser]:
    """
    Verify the Clerk session token and return user info.

    Returns None if:
    - No Authorization header
    - Auth is not configured (no CLERK_SECRET_KEY)
    - Token verification fails

    This allows the API to work both with and without auth.
    """
    if not credentials:
        return None

    if not CLERK_SECRET_KEY or not JWKS_URL:
        # Auth not configured — pass through
        return None

    token = credentials.credentials

    try:
        # Get JWKS keys
        jwks = await _get_jwks()
        if not jwks:
            return None

        # Get public key
        public_key = _get_public_key(jwks, token)
        if not public_key:
            return None

        # Verify and decode token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "verify_exp": True,
                "verify_aud": False,  # Clerk tokens don't always have audience
                "verify_iss": False,  # Issuer varies by instance
            },
        )

        user_id = payload.get("sub", "")
        email = payload.get("email")
        name = payload.get("name")

        return ClerkUser(user_id=user_id, email=email, name=name)

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except jwt.InvalidTokenError as e:
        print(f"⚠️ Invalid token: {e}")
        return None
    except Exception as e:
        print(f"⚠️ Auth error: {e}")
        return None


async def require_auth(
    user: Optional[ClerkUser] = Depends(get_current_user),
) -> ClerkUser:
    """
    Strict auth dependency — returns 401 if not authenticated.
    Use this for endpoints that must be protected.
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

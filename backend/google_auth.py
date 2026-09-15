"""Google Sign-In verification.

Verifies the ID token Google hands the app, against Google's published signing
keys. Nothing here talks to a third-party platform: the only external call is to
Google's own JWKS endpoint, and the keys are cached until they rotate.
"""
import logging
import time
from typing import Optional

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

logger = logging.getLogger(__name__)

CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("accounts.google.com", "https://accounts.google.com")
# Google rotates its keys roughly daily; re-fetch well inside that window.
CACHE_TTL = 3600


class GoogleAuthError(Exception):
    pass


class GoogleVerifier:
    def __init__(self, client_ids: list[str]):
        # Every platform (web, iOS, Android) gets its own client id, and any of
        # them may legitimately appear in the token's `aud`.
        self.client_ids = [c for c in client_ids if c]
        self._keys: dict[str, object] = {}
        self._fetched_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(self.client_ids)

    async def _load_keys(self, force: bool = False) -> dict:
        if self._keys and not force and (time.time() - self._fetched_at) < CACHE_TTL:
            return self._keys
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get(CERTS_URL)
        if r.status_code != 200:
            raise GoogleAuthError("Google-ийн түлхүүр татаж чадсангүй")
        self._keys = {k["kid"]: RSAAlgorithm.from_jwk(k) for k in r.json().get("keys", [])}
        self._fetched_at = time.time()
        return self._keys

    async def verify(self, id_token: str) -> dict:
        """Returns the token claims, or raises GoogleAuthError."""
        if not self.configured:
            raise GoogleAuthError("Google нэвтрэлт тохируулагдаагүй байна")
        try:
            kid = jwt.get_unverified_header(id_token).get("kid")
        except jwt.PyJWTError as e:
            raise GoogleAuthError("Токен буруу форматтай") from e
        if not kid:
            raise GoogleAuthError("Токен буруу форматтай")

        keys = await self._load_keys()
        if kid not in keys:
            # Unknown key id usually means Google rotated; refresh once.
            keys = await self._load_keys(force=True)
        key = keys.get(kid)
        if key is None:
            raise GoogleAuthError("Токены түлхүүр танигдсангүй")

        try:
            claims = jwt.decode(
                id_token,
                key=key,
                algorithms=["RS256"],
                audience=self.client_ids,
                issuer=ISSUERS,
                options={"require": ["exp", "iat", "aud", "iss", "sub"]},
            )
        except jwt.ExpiredSignatureError as e:
            raise GoogleAuthError("Нэвтрэх хугацаа дууссан, дахин оролдоно уу") from e
        except jwt.InvalidAudienceError as e:
            raise GoogleAuthError("Энэ апп-д зориулагдаагүй токен") from e
        except jwt.PyJWTError as e:
            logger.warning("Google token rejected: %s", e)
            raise GoogleAuthError("Нэвтрэлт баталгаажсангүй") from e

        if not claims.get("email"):
            raise GoogleAuthError("Google хаягийн мэдээлэл дутуу")
        if claims.get("email_verified") is False:
            raise GoogleAuthError("Баталгаажаагүй Google хаяг")
        return claims


def profile_from_claims(claims: dict) -> dict:
    return {
        "google_sub": claims["sub"],
        "email": claims["email"],
        "name": claims.get("name") or claims.get("given_name"),
        "picture": claims.get("picture"),
    }


def build_verifier(*client_ids: Optional[str]) -> GoogleVerifier:
    return GoogleVerifier([c for c in client_ids if c])

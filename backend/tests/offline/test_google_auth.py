"""Google Sign-In: token verification and session issuing, with a fake Google."""
import os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.update({
    "MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "zhd_test",
    "GOOGLE_CLIENT_ID_WEB": "web-client.apps.googleusercontent.com",
    "GOOGLE_CLIENT_ID_ANDROID": "android-client.apps.googleusercontent.com",
    "SESSION_DAYS": "30",
})

from mongomock_motor import AsyncMongoMockClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402
motor.motor_asyncio.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

import types  # noqa: E402
_fake = types.ModuleType("seed_data")


async def _skip(db):
    return {"skipped": True}


_fake.seed = _skip
sys.modules["seed_data"] = _fake

import jwt  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from anyio.from_thread import start_blocking_portal  # noqa: E402

# A throwaway key pair stands in for Google's signing key.
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
KID = "test-kid"
server.google._keys = {KID: KEY.public_key()}
server.google._fetched_at = time.time()


def make_token(**overrides):
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "web-client.apps.googleusercontent.com",
        "sub": "google-user-1",
        "email": "bat@gmail.com",
        "email_verified": True,
        "name": "Bat",
        "picture": "https://example.com/p.png",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    for k, v in list(claims.items()):
        if v is None:
            claims.pop(k)
    return jwt.encode(claims, KEY, algorithm="RS256", headers={"kid": KID})


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


with TestClient(server.app) as c:
    print("\n1) a valid Google token creates a user and a session")
    r = c.post("/api/auth/google", json={"id_token": make_token()})
    check(r.status_code == 200, f"signed in ({r.status_code}) {r.text[:200]}")
    body = r.json()
    token = body["session_token"]
    check(len(token) >= 32, f"opaque session token issued ({len(token)} chars)")
    check(token.count(".") == 0, "our token is not the Google token")
    check(body["user"]["email"] == "bat@gmail.com", "email stored")
    check(body["user"]["profileName"] is None, "new user still needs a profile name")
    check(body["user"]["isPro"] is False, "new user is free")

    print("\n2) the session works on protected endpoints")
    me = c.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    check(me.status_code == 200 and me.json()["email"] == "bat@gmail.com", "auth/me works")
    check(c.get("/api/auth/me").status_code == 401, "no token -> 401")

    print("\n3) signing in again reuses the same account")
    again = c.post("/api/auth/google", json={"id_token": make_token()}).json()
    check(again["user"]["user_id"] == body["user"]["user_id"], "same user_id")
    check(again["session_token"] != token, "but a fresh session token")
    with start_blocking_portal() as portal:
        n = portal.call(lambda: server.db.users.count_documents({}))
    check(n == 1, f"still one user, got {n}")

    print("\n4) the Google account id wins over a changed email")
    moved = c.post("/api/auth/google",
                   json={"id_token": make_token(email="bat.new@gmail.com")}).json()
    check(moved["user"]["user_id"] == body["user"]["user_id"], "same account after email change")
    check(moved["user"]["email"] == "bat.new@gmail.com", "email updated")

    print("\n5) a different Google account is a different user")
    other = c.post("/api/auth/google",
                   json={"id_token": make_token(sub="google-user-2", email="dorj@gmail.com")}).json()
    check(other["user"]["user_id"] != body["user"]["user_id"], "separate user")

    print("\n6) bad tokens are refused")
    cases = {
        "expired": make_token(exp=int(time.time()) - 10, iat=int(time.time()) - 3600),
        "wrong audience": make_token(aud="someone-elses-app.apps.googleusercontent.com"),
        "wrong issuer": make_token(iss="https://evil.example.com"),
        "unverified email": make_token(email_verified=False),
        "garbage": "not-a-jwt",
        "unsigned": jwt.encode({"sub": "x", "aud": "web-client.apps.googleusercontent.com"},
                               "secret", algorithm="HS256", headers={"kid": KID}),
    }
    for label, bad in cases.items():
        r = c.post("/api/auth/google", json={"id_token": bad})
        check(r.status_code == 401, f"{label} -> 401 (got {r.status_code})")

    print("\n7) a token for the Android client is accepted too")
    r = c.post("/api/auth/google",
               json={"id_token": make_token(aud="android-client.apps.googleusercontent.com")})
    check(r.status_code == 200, f"android client accepted ({r.status_code})")

    print("\n8) logout drops the session")
    t = c.post("/api/auth/google", json={"id_token": make_token()}).json()["session_token"]
    H = {"Authorization": f"Bearer {t}"}
    check(c.post("/api/auth/logout", headers=H).status_code == 200, "logged out")
    check(c.get("/api/auth/me", headers=H).status_code == 401, "token no longer valid")

    print("\n9) with no client ids configured the endpoint reports it")
    saved = server.google.client_ids
    server.google.client_ids = []
    check(c.post("/api/auth/google", json={"id_token": make_token()}).status_code == 503,
          "503 when unconfigured")
    server.google.client_ids = saved

    print("\n10) no third-party auth endpoints remain")
    paths = server.app.openapi()["paths"]
    check("/api/auth/session" not in paths, "old session endpoint gone")
    check("/api/auth/google" in paths, "google endpoint present")
    source = (Path(__file__).resolve().parents[2] / "server.py").read_text(encoding="utf-8")
    check("emergent" not in source.lower(), "no emergent references in server.py")

print("\nALL PASS")

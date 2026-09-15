"""CORS: a browser must actually be allowed through.

Regression guard — a blank CORS_ORIGINS used to produce an empty allow-list,
which blocked every browser origin while curl and the mobile app still worked,
so the breakage was invisible from the server side.
"""
import importlib
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from mongomock_motor import AsyncMongoMockClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402
motor.motor_asyncio.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

import types  # noqa: E402
_fake = types.ModuleType("seed_data")


async def _skip(db):
    return {"skipped": True}


_fake.seed = _skip
sys.modules["seed_data"] = _fake

from fastapi.testclient import TestClient  # noqa: E402

ORIGIN = "http://localhost:8081"


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


def load(cors_value):
    """Re-import the app with a given CORS_ORIGINS setting."""
    os.environ.update({"MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "zhd_test"})
    if cors_value is None:
        os.environ.pop("CORS_ORIGINS", None)
    else:
        os.environ["CORS_ORIGINS"] = cors_value
    sys.modules.pop("server", None)
    return importlib.import_module("server")


def headers_for(server, origin=ORIGIN):
    with TestClient(server.app) as c:
        r = c.get("/api/health", headers={"Origin": origin})
        return r.status_code, {k.lower(): v for k, v in r.headers.items()}


print("\n1) CORS_ORIGINS тохируулаагүй үед бүх домэйн зөвшөөрөгдөнө")
status, h = headers_for(load(None))
check(status == 200, "request succeeded")
check(h.get("access-control-allow-origin") == "*", f"allow-origin: {h.get('access-control-allow-origin')!r}")

print("\n2) хоосон утга ч мөн адил (өмнө нь бүгдийг хаадаг байсан)")
for blank in ("", "   ", ",", " , "):
    status, h = headers_for(load(blank))
    check(
        h.get("access-control-allow-origin") == "*",
        f"{blank!r} -> allow-origin {h.get('access-control-allow-origin')!r}",
    )

print("\n3) '*' нь итгэмжлэлгүй байх ёстой (стандартаар хослуулж болохгүй)")
_, h = headers_for(load("*"))
check(h.get("access-control-allow-origin") == "*", "allow-origin: *")
check(
    h.get("access-control-allow-credentials") is None,
    f"credentials тавигдаагүй: {h.get('access-control-allow-credentials')!r}",
)

print("\n4) тодорхой домэйн зааж өгвөл зөвхөн тэр нь")
server = load("https://app.example.mn,http://localhost:8081")
_, h = headers_for(server, ORIGIN)
check(h.get("access-control-allow-origin") == ORIGIN, f"жагсаалтад байгаа: {ORIGIN}")
check(h.get("access-control-allow-credentials") == "true", "итгэмжлэл идэвхтэй")

_, h = headers_for(server, "https://evil.example.com")
check(
    h.get("access-control-allow-origin") is None,
    f"жагсаалтад байхгүй домэйн хаагдсан: {h.get('access-control-allow-origin')!r}",
)

print("\n5) preflight (OPTIONS) ажиллана")
server = load("*")
with TestClient(server.app) as c:
    r = c.options(
        "/api/auth/google",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    h = {k.lower(): v for k, v in r.headers.items()}
check(r.status_code in (200, 204), f"preflight {r.status_code}")
check(h.get("access-control-allow-origin") == "*", "preflight allow-origin")
check("POST" in (h.get("access-control-allow-methods") or ""), "POST зөвшөөрөгдсөн")

print("\nALL PASS")

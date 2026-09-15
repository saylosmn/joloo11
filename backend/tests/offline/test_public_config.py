"""The /config endpoint the app reads its OAuth client ids from."""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.update({
    "MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "zhd_test",
    "GOOGLE_CLIENT_ID_WEB": "web-id.apps.googleusercontent.com",
    "GOOGLE_CLIENT_ID_ANDROID": "android-id.apps.googleusercontent.com",
    "PRO_PRICE_MNT": "19900",
    "BANK_NAME": "Хаан банк", "BANK_ACCOUNT_NUMBER": "5041234567",
    "BANK_ACCOUNT_NAME": "Б. БАТ",
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

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


with TestClient(server.app) as c:
    print("\n1) config is public — the app needs it before anyone signs in")
    r = c.get("/api/config")
    check(r.status_code == 200, f"no auth required ({r.status_code})")
    cfg = r.json()

    print("\n2) it carries the OAuth client ids")
    g = cfg["google"]
    check(g["webClientId"] == "web-id.apps.googleusercontent.com", "web client id served")
    check(g["androidClientId"] == "android-id.apps.googleusercontent.com", "android client id served")
    check(g["iosClientId"] is None, "unset platform reported as null, not empty string")

    print("\n3) the ids match what the verifier actually accepts")
    accepted = set(server.google.client_ids)
    served = {v for v in g.values() if v}
    check(served == accepted, f"served {served} == accepted {accepted}")

    print("\n4) no secret is exposed")
    body = r.text.lower()
    for leak in ["client_secret", "clientsecret", "password", "mongo", "token", "webhook"]:
        check(leak not in body, f"no {leak!r} in the response")

    print("\n5) it also carries what the app would otherwise hardcode")
    check(cfg["pro"]["price"] == 19900, "price")
    check(cfg["pro"]["bankTransfer"] is True, "bank transfer availability")
    check(cfg["pro"]["qpay"] is False, "qpay availability")
    check(cfg["limits"]["freeCategoryLimit"] == server.FREE_CATEGORY_LIMIT, "free category limit")
    check(cfg["limits"]["freeDailyQuestions"] == server.FREE_DAILY_QUESTIONS, "daily questions")
    check(cfg["exam"]["size"] == server.EXAM_SIZE, "exam size")
    check(cfg["exam"]["durationSeconds"] == server.EXAM_DURATION_SECONDS, "exam duration")

    print("\n6) an unconfigured server reports nulls rather than failing")
    saved = dict(os.environ)
    for k in ("GOOGLE_CLIENT_ID_WEB", "GOOGLE_CLIENT_ID_ANDROID"):
        os.environ.pop(k, None)
    blank = c.get("/api/config").json()["google"]
    check(all(v is None for v in blank.values()), f"all null: {blank}")
    os.environ.update(saved)

print("\nALL PASS")

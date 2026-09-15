"""Telegram admin commands: /stats, /pending, /pro, /check, /list."""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.update({
    "MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "zhd_test",
    "TELEGRAM_BOT_TOKEN": "fake", "TELEGRAM_ADMIN_ID": "777",
    "TELEGRAM_WEBHOOK_SECRET": "s3cret",
    "BANK_NAME": "Хаан банк", "BANK_ACCOUNT_NUMBER": "5041234567",
    "BANK_ACCOUNT_NAME": "Б. БАТ", "PRO_PRICE_MNT": "19900",
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
from anyio.from_thread import start_blocking_portal  # noqa: E402

SENT = []


async def fake_tg_send(chat_id, text, reply_markup=None):
    SENT.append({"chat_id": chat_id, "text": text, "reply_markup": reply_markup})


async def fake_tg_api(method, payload):
    SENT.append({"method": method, "payload": payload})


server.tg_send = fake_tg_send
server.tg_api = fake_tg_api

TOK = "tok"


async def seed():
    today = server.today_str()
    await server.db.questions.insert_one({
        "question_id": "q1", "num": 1, "category_id": "c0", "category_name": "Бүлэг",
        "questionText": "Асуулт", "options": [{"key": "a", "text": "A"}],
        "correctKey": "a", "sourceRow": 0})
    await server.db.users.insert_many([
        {"user_id": "u1", "email": "a@a.mn", "profileName": "ann", "profileNameLower": "ann",
         "isPro": False, "createdAt": today + "T01:00:00+00:00"},
        {"user_id": "u2", "email": "b@b.mn", "profileName": "bob", "profileNameLower": "bob",
         "isPro": True, "createdAt": "2020-01-01T00:00:00+00:00"},
    ])
    await server.db.user_sessions.insert_one({
        "session_token": TOK, "user_id": "u1",
        "expires_at": (server.now_utc() + server.timedelta(days=1)).isoformat()})
    await server.db.dailyUsage.insert_one(
        {"user_id": "u1", "date": today, "questionsAnswered": 3, "examsTaken": 0})
    await server.db.attempts.insert_one({
        "attempt_id": "att1", "user_id": "u1", "score": 18, "total": 20,
        "finishedAt": today + "T02:00:00+00:00"})
    await server.db.payments.insert_many([
        {"payment_id": "p1", "user_id": "u2", "method": "qpay", "status": "PAID",
         "amount": 19900, "paidAt": today + "T03:00:00+00:00",
         "createdAt": today + "T03:00:00+00:00"},
        {"payment_id": "p2", "user_id": "u1", "method": "bank", "status": "PAID",
         "amount": 19900, "paidAt": "2020-05-05T00:00:00+00:00",
         "createdAt": "2020-05-05T00:00:00+00:00"},
        {"payment_id": "p3", "user_id": "u1", "method": "bank", "status": "PENDING",
         "ref": "ZHD-AAAAA", "amount": 19900, "createdAt": server.now_utc().isoformat()},
    ])


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


def admin(text):
    SENT.clear()
    r = c.post("/api/telegram/webhook",
               headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
               json={"message": {"chat": {"id": 777}, "from": {"id": 777}, "text": text}})
    assert r.status_code == 200, r.text
    return SENT[-1]["text"] if SENT else ""


with start_blocking_portal() as portal:
    portal.call(seed)

with TestClient(server.app) as c:
    print("\n1) /stats summarises users, activity and revenue")
    out = admin("/stats")
    check("Хэрэглэгч: <b>2</b>" in out, f"2 users: {out!r}")
    check("(PRO: 1)" in out, "1 PRO")
    check("Өнөөдөр шинээр: <b>1</b>" in out, "1 signed up today")
    check("Өнөөдөр идэвхтэй: <b>1</b>" in out, "1 active today")
    check("Өнөөдрийн шалгалт: <b>1</b>" in out, "1 exam today")
    check("Нийт орлого: <b>39,800₮</b>" in out, f"total revenue: {out!r}")
    check("Өнөөдөр: <b>19,900₮</b>" in out, "today revenue excludes the old payment")
    check("Баталгаажаагүй шилжүүлэг: <b>1</b>" in out, "pending transfer flagged")

    print("\n2) /pending re-sends the approve buttons")
    SENT.clear()
    c.post("/api/telegram/webhook",
           headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
           json={"message": {"chat": {"id": 777}, "from": {"id": 777}, "text": "/pending"}})
    with_buttons = [m for m in SENT if m.get("reply_markup")]
    check(len(with_buttons) == 1, f"one request re-sent, got {len(with_buttons)}")
    check("ZHD-AAAAA" in with_buttons[0]["text"], "shows the reference code")
    check(with_buttons[0]["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == "payok:p3",
          "approve button wired to the right payment")

    print("\n3) PRO activation by profile name")
    check("PRO идэвхжлээ" in admin("ann"), "plain name activates")
    check("аль хэдийн PRO" in admin("/pro ann"), "second time is a no-op")
    check("олдсонгүй" in admin("/pro nobody"), "unknown name reported")
    check("PRO цуцлагдлаа" in admin("/unpro ann"), "unpro works")

    print("\n4) /check and /list")
    out = admin("/check bob")
    check("bob" in out and "PRO" in out, f"check shows status: {out[:60]!r}")
    out = admin("/list")
    check("bob" in out and "ann" not in out, f"only PRO users listed: {out!r}")

    print("\n5) non-admins get nothing")
    SENT.clear()
    c.post("/api/telegram/webhook",
           headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
           json={"message": {"chat": {"id": 5}, "from": {"id": 5}, "text": "/stats"}})
    check(len(SENT) == 1 and "эрх байхгүй" in SENT[0]["text"], f"refused: {SENT}")

    print("\n6) /help lists every command")
    out = admin("/help")
    for cmd in ["/pro", "/unpro", "/check", "/list", "/pending", "/stats"]:
        check(cmd in out, f"{cmd} documented")

print("\nALL PASS")

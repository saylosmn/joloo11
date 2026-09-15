"""End-to-end test of the bank-transfer PRO flow against a fake Mongo + fake Telegram."""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.update({
    "MONGO_URL": "mongodb://localhost:27017",
    "DB_NAME": "zhd_test",
    "BANK_NAME": "Хаан банк",
    "BANK_ACCOUNT_NUMBER": "5041234567",
    "BANK_ACCOUNT_NAME": "Б. БАТ",
    "PRO_PRICE_MNT": "19900",
    "TELEGRAM_BOT_TOKEN": "fake-token",
    "TELEGRAM_ADMIN_ID": "12345",
    "TELEGRAM_WEBHOOK_SECRET": "s3cret",
})

from mongomock_motor import AsyncMongoMockClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TG_SENT = []
TG_CALLS = []


async def fake_tg_send(chat_id, text, reply_markup=None):
    TG_SENT.append({"chat_id": chat_id, "text": text, "reply_markup": reply_markup})


async def fake_tg_api(method, payload):
    TG_CALLS.append({"method": method, "payload": payload})


server.tg_send = fake_tg_send
server.tg_api = fake_tg_api

TOKEN = "sess-token-1"
USER_ID = "user_test1"


async def seed():
    await server.db.users.insert_one({
        "user_id": USER_ID, "email": "t@t.mn", "name": "T", "profileName": "tester",
        "profileNameLower": "tester", "isPro": False, "createdAt": server.now_utc().isoformat(),
    })
    await server.db.user_sessions.insert_one({
        "session_token": TOKEN, "user_id": USER_ID,
        "expires_at": (server.now_utc() + server.timedelta(days=1)).isoformat(),
    })


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


with TestClient(server.app) as c:
    import asyncio
    asyncio.get_event_loop().run_until_complete(seed()) if False else None
    # TestClient runs startup; seed through the app's own loop via a portal request
    c.portal = None
    import anyio
    from anyio.from_thread import start_blocking_portal
    with start_blocking_portal() as portal:
        portal.call(seed)

    H = {"Authorization": f"Bearer {TOKEN}"}

    print("\n1) plan advertises bank transfer")
    plan = c.get("/api/payments/plan").json()
    check(plan["bankTransfer"] is True and plan["qpay"] is False, f"plan={plan}")
    check(plan["enabled"] is True and plan["amount"] == 19900, "price/enabled correct")

    print("\n2) create request")
    r = c.post("/api/payments/bank/create", headers=H)
    check(r.status_code == 200, f"status {r.status_code} {r.text[:200]}")
    req = r.json()
    pid, ref = req["payment_id"], req["ref"]
    check(req["method"] == "bank" and req["status"] == "NEW", f"method/status {req['method']}/{req['status']}")
    check(ref.startswith("ZHD-") and len(ref) == 9, f"ref={ref}")
    check(req["bank"]["accountNumber"] == "5041234567", "bank details returned")
    check(req["bank"]["qrUrl"] is None, "no QR configured -> qrUrl null")

    print("\n3) create again reuses the same open request (same ref)")
    again = c.post("/api/payments/bank/create", headers=H).json()
    check(again["ref"] == ref and again["payment_id"] == pid, "same request reused")

    print("\n4) claim -> PENDING + admin notified with buttons")
    cl = c.post(f"/api/payments/bank/{pid}/claim", headers=H).json()
    check(cl["status"] == "PENDING", f"status={cl['status']}")
    check(len(TG_SENT) == 1, f"one telegram message, got {len(TG_SENT)}")
    kb = TG_SENT[0]["reply_markup"]["inline_keyboard"][0]
    check(kb[0]["callback_data"] == f"payok:{pid}", "approve button wired")
    check(kb[1]["callback_data"] == f"payno:{pid}", "reject button wired")
    check(ref in TG_SENT[0]["text"] and "19,900" in TG_SENT[0]["text"], "message shows ref + amount")

    print("\n5) still not PRO before approval")
    me = c.get("/api/auth/me", headers=H).json()
    check(me["isPro"] is False, "user is not PRO yet")
    st = c.get(f"/api/payments/{pid}", headers=H).json()
    check(st["status"] == "PENDING", "status endpoint shows PENDING (no QPay call)")

    print("\n6) non-admin cannot approve")
    c.post("/api/telegram/webhook", headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
           json={"callback_query": {"id": "cq0", "from": {"id": 999},
                                   "data": f"payok:{pid}",
                                   "message": {"message_id": 5, "chat": {"id": 999}, "text": "x"}}})
    me = c.get("/api/auth/me", headers=H).json()
    check(me["isPro"] is False, "stranger's button press ignored")
    check(TG_CALLS[-1]["payload"].get("text") == "Эрх байхгүй", "stranger told no permission")

    print("\n7) bad webhook secret rejected")
    bad = c.post("/api/telegram/webhook", headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
                 json={"callback_query": {"id": "cq", "from": {"id": 12345}, "data": f"payok:{pid}"}})
    check(bad.status_code == 403, f"expected 403, got {bad.status_code}")

    print("\n8) admin approves -> PRO granted")
    c.post("/api/telegram/webhook", headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
           json={"callback_query": {"id": "cq1", "from": {"id": 12345},
                                   "data": f"payok:{pid}",
                                   "message": {"message_id": 7, "chat": {"id": 12345}, "text": "req"}}})
    me = c.get("/api/auth/me", headers=H).json()
    check(me["isPro"] is True, "user is PRO")
    check(me["proSource"] == "bank", "proSource recorded")
    st = c.get(f"/api/payments/{pid}", headers=H).json()
    check(st["status"] == "PAID" and st["paidAt"], "payment marked PAID")
    edit = [x for x in TG_CALLS if x["method"] == "editMessageText"][-1]
    check("баталгаажлаа" in edit["payload"]["text"], "buttons replaced with outcome")

    print("\n9) double approval does not re-grant / errors")
    before = len(TG_CALLS)
    c.post("/api/telegram/webhook", headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
           json={"callback_query": {"id": "cq2", "from": {"id": 12345},
                                   "data": f"payok:{pid}",
                                   "message": {"message_id": 7, "chat": {"id": 12345}, "text": "req"}}})
    edit = [x for x in TG_CALLS[before:] if x["method"] == "editMessageText"][-1]
    check("аль хэдийн" in edit["payload"]["text"], "second press reports already-confirmed")

    print("\n10) PRO user cannot open a new request")
    r = c.post("/api/payments/bank/create", headers=H)
    check(r.status_code == 400, f"expected 400, got {r.status_code}")

    print("\n11) unlocked content is actually reachable now")
    lim = c.get("/api/me/limits", headers=H).json()
    check(lim["isPro"] is True, "limits report PRO")

    print("\n12) rejection path")
    # new user to test reject
    with start_blocking_portal() as portal:
        async def seed2():
            await server.db.users.insert_one({"user_id": "u2", "email": "b@b.mn", "profileName": "bob",
                                              "profileNameLower": "bob", "isPro": False,
                                              "createdAt": server.now_utc().isoformat()})
            await server.db.user_sessions.insert_one({"session_token": "tok2", "user_id": "u2",
                                                      "expires_at": (server.now_utc() + server.timedelta(days=1)).isoformat()})
        portal.call(seed2)
    H2 = {"Authorization": "Bearer tok2"}
    p2 = c.post("/api/payments/bank/create", headers=H2).json()
    c.post(f"/api/payments/bank/{p2['payment_id']}/claim", headers=H2)
    c.post("/api/telegram/webhook", headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
           json={"callback_query": {"id": "cq3", "from": {"id": 12345},
                                   "data": f"payno:{p2['payment_id']}",
                                   "message": {"message_id": 9, "chat": {"id": 12345}, "text": "req"}}})
    st2 = c.get(f"/api/payments/{p2['payment_id']}", headers=H2).json()
    check(st2["status"] == "REJECTED", f"status={st2['status']}")
    check(c.get("/api/auth/me", headers=H2).json()["isPro"] is False, "rejected user stays free")

    print("\n13) cannot claim someone else's request")
    p3 = c.post("/api/payments/bank/create", headers=H2)
    r = c.post(f"/api/payments/bank/{p2['payment_id']}/claim",
               headers={"Authorization": f"Bearer {TOKEN}"})
    check(r.status_code in (400, 404), f"expected 404/400, got {r.status_code}")

    print("\n14) unauthenticated create is rejected")
    check(c.post("/api/payments/bank/create").status_code == 401, "401 without token")

    print("\n15) refs are unique across users")
    check(p2["ref"] != ref, f"{p2['ref']} != {ref}")

print("\nALL PASS")

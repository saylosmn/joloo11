"""End-to-end test of the QPay PRO flow with a stubbed QPay client."""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.update({
    "MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "zhd_test",
    "QPAY_USERNAME": "u", "QPAY_PASSWORD": "p", "QPAY_INVOICE_CODE": "INV",
    "PUBLIC_URL": "https://api.example.mn", "PRO_PRICE_MNT": "19900",
})

from mongomock_motor import AsyncMongoMockClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402
motor.motor_asyncio.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from anyio.from_thread import start_blocking_portal  # noqa: E402

STATE = {"paid": False, "checks": 0, "created": []}


class FakeQPay:
    configured = True

    async def invoice_create(self, **kw):
        STATE["created"].append(kw)
        return {"invoice_id": "inv-1", "qr_text": "0002...", "qr_image": "B64",
                "qPay_shortUrl": "https://s.qpay.mn/a",
                "urls": [{"name": "khan", "description": "Хаан", "logo": "l", "link": "k://1"}]}

    async def payment_check(self, invoice_id):
        STATE["checks"] += 1
        return ({"paid": True, "amount": "19900.00", "payment_id": "pmt-1"}
                if STATE["paid"] else {"paid": False, "amount": None, "payment_id": None})

    async def invoice_cancel(self, invoice_id):
        return True


server.qpay = FakeQPay()

TOKEN, USER_ID = "tok", "u1"


async def seed():
    await server.db.users.insert_one({"user_id": USER_ID, "email": "a@a.mn", "profileName": "ann",
                                      "profileNameLower": "ann", "isPro": False,
                                      "createdAt": server.now_utc().isoformat()})
    await server.db.user_sessions.insert_one({
        "session_token": TOKEN, "user_id": USER_ID,
        "expires_at": (server.now_utc() + server.timedelta(days=1)).isoformat()})


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


with TestClient(server.app) as c:
    with start_blocking_portal() as portal:
        portal.call(seed)
    H = {"Authorization": f"Bearer {TOKEN}"}

    print("\n1) plan")
    plan = c.get("/api/payments/plan").json()
    check(plan["qpay"] is True and plan["enabled"] is True, f"plan={plan}")

    print("\n2) create invoice")
    p = c.post("/api/payments/create", headers=H, json={"plan": "pro"}).json()
    pid = p["payment_id"]
    check(p["qr_image"] == "B64" and p["short_url"].startswith("https://"), "QR + short url returned")
    check(p["urls"][0]["link"] == "k://1", "bank deeplink returned")
    sent = STATE["created"][0]
    check(sent["amount"] == 19900, f"amount={sent['amount']}")
    check(sent["callback_url"] == f"https://api.example.mn/api/payments/qpay/callback?payment_id={pid}",
          "callback url carries payment_id")
    check(sent["sender_invoice_no"] == pid, "sender_invoice_no = our payment id")

    print("\n3) reuses the pending invoice instead of creating another")
    p2 = c.post("/api/payments/create", headers=H, json={"plan": "pro"}).json()
    check(p2["payment_id"] == pid and len(STATE["created"]) == 1, "no duplicate invoice")

    print("\n4) polling while unpaid")
    st = c.get(f"/api/payments/{pid}", headers=H).json()
    check(st["status"] == "NEW", "still NEW")
    check(c.get("/api/auth/me", headers=H).json()["isPro"] is False, "not PRO yet")

    print("\n5) callback while unpaid does NOT grant PRO (verified against QPay)")
    r = c.post(f"/api/payments/qpay/callback?payment_id={pid}")
    check(r.status_code == 200, f"callback returned {r.status_code}")
    check(c.get("/api/auth/me", headers=H).json()["isPro"] is False, "spoofed callback ignored")

    print("\n6) callback for an unknown payment is 404")
    check(c.post("/api/payments/qpay/callback?payment_id=nope").status_code == 404, "404 for unknown id")

    print("\n7) QPay reports PAID -> callback grants PRO")
    STATE["paid"] = True
    c.post(f"/api/payments/qpay/callback?payment_id={pid}")
    me = c.get("/api/auth/me", headers=H).json()
    check(me["isPro"] is True and me["proSource"] == "qpay", "PRO granted via callback")
    st = c.get(f"/api/payments/{pid}", headers=H).json()
    check(st["status"] == "PAID" and st["paidAt"], "payment PAID")

    print("\n8) a later poll is a no-op (no extra QPay call, still PRO)")
    before = STATE["checks"]
    st = c.get(f"/api/payments/{pid}", headers=H).json()
    check(STATE["checks"] == before, "already-PAID short-circuits before hitting QPay")
    check(st["status"] == "PAID", "still PAID")

    print("\n9) PRO user cannot create another invoice")
    check(c.post("/api/payments/create", headers=H, json={"plan": "pro"}).status_code == 400, "400")

    print("\n10) another user cannot read this payment")
    with start_blocking_portal() as portal:
        async def seed2():
            await server.db.users.insert_one({"user_id": "u2", "email": "b@b.mn", "isPro": False,
                                              "createdAt": server.now_utc().isoformat()})
            await server.db.user_sessions.insert_one({
                "session_token": "tok2", "user_id": "u2",
                "expires_at": (server.now_utc() + server.timedelta(days=1)).isoformat()})
        portal.call(seed2)
    r = c.get(f"/api/payments/{pid}", headers={"Authorization": "Bearer tok2"})
    check(r.status_code == 404, f"expected 404, got {r.status_code}")

    print("\n11) history hides the bulky QR fields")
    h = c.get("/api/payments", headers=H).json()
    check(len(h) == 1 and "qr_image" not in h[0] and h[0]["status"] == "PAID", f"history={h}")

print("\nALL PASS")

"""Stub QPay v2 server + client smoke test."""
import asyncio, base64, sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi import FastAPI, Request, HTTPException
import uvicorn
from qpay_client import QPayClient, QPayError

stub = FastAPI()
STATE = {"token_calls": 0, "refresh_calls": 0, "paid": False, "invoices": []}


@stub.post("/v2/auth/token")
async def token(request: Request):
    auth = request.headers.get("authorization", "")
    assert auth.startswith("Basic ")
    user, pwd = base64.b64decode(auth.split(" ")[1]).decode().split(":")
    if (user, pwd) != ("u", "p"):
        raise HTTPException(401, "bad creds")
    STATE["token_calls"] += 1
    return {"access_token": f"acc{STATE['token_calls']}", "expires_in": 2,
            "refresh_token": "ref1", "refresh_expires_in": 3600}


@stub.post("/v2/auth/refresh")
async def refresh(request: Request):
    assert request.headers.get("authorization") == "Bearer ref1"
    STATE["refresh_calls"] += 1
    return {"access_token": f"ref-acc{STATE['refresh_calls']}", "expires_in": 600,
            "refresh_token": "ref1", "refresh_expires_in": 3600}


@stub.post("/v2/invoice")
async def invoice(request: Request):
    assert request.headers.get("authorization", "").startswith("Bearer ")
    body = await request.json()
    STATE["invoices"].append(body)
    return {"invoice_id": "inv-1", "qr_text": "0002010102...", "qr_image": "BASE64",
            "qPay_shortUrl": "https://s.qpay.mn/x",
            "urls": [{"name": "khanbank", "description": "Хаан банк", "logo": "l", "link": "k://x"}]}


@stub.post("/v2/payment/check")
async def check(request: Request):
    body = await request.json()
    assert body["object_id"] == "inv-1"
    if not STATE["paid"]:
        return {"count": 0, "rows": []}
    return {"count": 1, "rows": [{"payment_id": "pmt-9", "payment_status": "PAID",
                                 "payment_amount": "19900.00"}]}


@stub.delete("/v2/invoice/{iid}")
async def cancel(iid: str):
    return {}


def serve():
    uvicorn.run(stub, host="127.0.0.1", port=8931, log_level="error")


async def main():
    c = QPayClient("http://127.0.0.1:8931/v2/", "u", "p", "TEST_INVOICE")
    assert c.configured

    inv = await c.invoice_create(sender_invoice_no="pay_1", invoice_receiver_code="tester",
                                 description="PRO", amount=19900,
                                 callback_url="http://x/cb?payment_id=pay_1")
    assert inv["invoice_id"] == "inv-1", inv
    sent = STATE["invoices"][0]
    assert sent["invoice_code"] == "TEST_INVOICE" and sent["amount"] == "19900", sent
    print("invoice_create ok ->", sent)

    assert (await c.payment_check("inv-1"))["paid"] is False
    STATE["paid"] = True
    res = await c.payment_check("inv-1")
    assert res == {"paid": True, "amount": "19900.00", "payment_id": "pmt-9"}, res
    print("payment_check ok ->", res)

    # token cached (no second login), then refreshed after expiry
    assert STATE["token_calls"] == 1, STATE
    await asyncio.sleep(2.2)
    await c.payment_check("inv-1")
    assert STATE["token_calls"] == 1 and STATE["refresh_calls"] == 1, STATE
    print("token cache + refresh ok ->", STATE["token_calls"], STATE["refresh_calls"])

    assert await c.invoice_cancel("inv-1") is True
    print("invoice_cancel ok")

    bad = QPayClient("http://127.0.0.1:8931/v2/", "u", "WRONG", "T")
    try:
        await bad.payment_check("inv-1")
        raise AssertionError("expected QPayError")
    except QPayError as e:
        print("bad creds ok ->", e)

    print("\nALL PASS")


threading.Thread(target=serve, daemon=True).start()
time.sleep(2.5)
asyncio.run(main())

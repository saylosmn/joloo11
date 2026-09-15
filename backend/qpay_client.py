"""Async QPay v2 client.

The official `qpay-python` SDK is synchronous (requests); this backend is async
FastAPI, so the same v2 flow — token/refresh auth, invoice create, payment check —
is reimplemented on top of httpx.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)


class QPayError(Exception):
    pass


class QPayClient:
    """Keeps a cached access token and refreshes it before it expires."""

    def __init__(
        self,
        host: str,
        username: str,
        password: str,
        invoice_code: str,
        account: Optional[dict] = None,
    ):
        # host must end with a slash so urljoin keeps the /v2/ path segment
        self._host = host if host.endswith("/") else host + "/"
        self._username = username
        self._password = password
        self.invoice_code = invoice_code
        # Optional settlement account. When unset, QPay pays out to the default
        # account registered on the merchant contract.
        self.account = account or None
        self._access_token: Optional[str] = None
        self._access_expires: Optional[datetime] = None
        self._refresh_token: Optional[str] = None
        self._refresh_expires: Optional[datetime] = None
        self._lock = asyncio.Lock()

    @property
    def configured(self) -> bool:
        return bool(self._username and self._password and self.invoice_code)

    # ---------------- auth ----------------
    async def _fetch_token(self, use_refresh: bool) -> None:
        now = datetime.now(timezone.utc)
        async with httpx.AsyncClient(timeout=30) as hc:
            if use_refresh:
                r = await hc.post(
                    urljoin(self._host, "auth/refresh"),
                    headers={"Authorization": f"Bearer {self._refresh_token}"},
                )
            else:
                r = await hc.post(
                    urljoin(self._host, "auth/token"),
                    auth=(self._username, self._password),
                )
        if r.status_code == 401 and use_refresh:
            # refresh token rejected — fall back to a full re-login
            await self._fetch_token(use_refresh=False)
            return
        if r.status_code >= 400:
            raise QPayError(f"QPay auth failed [{r.status_code}]: {r.text[:300]}")
        data = r.json()
        self._access_token = data["access_token"]
        # A small safety margin so a token never expires mid-request.
        self._access_expires = now + timedelta(seconds=int(data["expires_in"]) - 60)
        self._refresh_token = data.get("refresh_token")
        if data.get("refresh_expires_in"):
            self._refresh_expires = now + timedelta(seconds=int(data["refresh_expires_in"]) - 60)

    async def _token(self) -> str:
        async with self._lock:
            now = datetime.now(timezone.utc)
            if self._access_token and self._access_expires and self._access_expires > now:
                return self._access_token
            use_refresh = bool(
                self._refresh_token and self._refresh_expires and self._refresh_expires > now
            )
            await self._fetch_token(use_refresh)
            return self._access_token  # type: ignore[return-value]

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        if not self.configured:
            raise QPayError("QPay тохиргоо дутуу байна")
        token = await self._token()
        async with httpx.AsyncClient(timeout=30) as hc:
            r = await hc.request(
                method,
                urljoin(self._host, path),
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
        if r.status_code >= 400:
            logger.error("QPay %s %s -> %s %s", method, path, r.status_code, r.text[:500])
            raise QPayError(f"QPay алдаа [{r.status_code}] {method.upper()} {path}")
        return r.json()

    # ---------------- services ----------------
    async def invoice_create(
        self,
        *,
        sender_invoice_no: str,
        invoice_receiver_code: str,
        description: str,
        amount: int,
        callback_url: str,
    ) -> dict:
        payload = {
            "invoice_code": self.invoice_code,
            "sender_invoice_no": sender_invoice_no,
            "invoice_receiver_code": invoice_receiver_code or "terminal",
            "invoice_description": description,
            "amount": str(amount),
            "callback_url": callback_url,
        }
        if self.account:
            # Route the payout to a specific account. QPay only accepts accounts
            # already registered under the merchant contract.
            payload["transactions"] = [
                {
                    "description": description,
                    "amount": str(amount),
                    "accounts": [
                        {
                            "account_bank_code": self.account["bank_code"],
                            "account_number": self.account["number"],
                            "account_name": self.account["name"],
                            "account_currency": self.account.get("currency", "MNT"),
                        }
                    ],
                }
            ]
        return await self._request("post", "invoice", json=payload)

    async def invoice_cancel(self, invoice_id: str) -> bool:
        try:
            response = await self._request("delete", f"invoice/{invoice_id}")
        except QPayError:
            return False
        return "error" not in (response or {})

    async def payment_check(self, invoice_id: str) -> dict:
        """Returns {"paid": bool, "amount": Decimal-ish str|None, "payment_id": str|None}."""
        response = await self._request(
            "post",
            "payment/check",
            json={
                "object_type": "INVOICE",
                "object_id": invoice_id,
                "offset": {"page_number": 1, "page_limit": 100},
            },
        )
        for row in response.get("rows") or []:
            if row.get("payment_status") == "PAID":
                return {
                    "paid": True,
                    "amount": row.get("payment_amount"),
                    "payment_id": row.get("payment_id"),
                }
        return {"paid": False, "amount": None, "payment_id": None}

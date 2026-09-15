from fastapi import FastAPI, APIRouter, Header, HTTPException, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne
import os
import re
import random
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import secrets
import uuid

from google_auth import GoogleAuthError, build_verifier, profile_from_claims
from qpay_client import QPayClient, QPayError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_ID = os.environ.get("TELEGRAM_ADMIN_ID", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")

# ---- Google Sign-In ----
# One OAuth client per platform; a token minted for any of them is accepted.
google = build_verifier(
    os.environ.get("GOOGLE_CLIENT_ID_WEB"),
    os.environ.get("GOOGLE_CLIENT_ID_IOS"),
    os.environ.get("GOOGLE_CLIENT_ID_ANDROID"),
)
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))

FREE_CATEGORY_LIMIT = 2          # first N categories unlocked for free users
FREE_DAILY_QUESTIONS = 30        # practice question answers per day
FREE_DAILY_EXAMS = 1             # exams per day
EXAM_SIZE = 20
EXAM_DURATION_SECONDS = 25 * 60
EXAM_PASS_PERCENT = 75           # >=75% (i.e. >=15/20) to pass

# ---- QPay (PRO purchase) ----
QPAY_HOST = os.environ.get("QPAY_HOST", "https://merchant.qpay.mn/v2/")
QPAY_USERNAME = os.environ.get("QPAY_USERNAME", "")
QPAY_PASSWORD = os.environ.get("QPAY_PASSWORD", "")
QPAY_INVOICE_CODE = os.environ.get("QPAY_INVOICE_CODE", "")
PRO_PRICE_MNT = int(os.environ.get("PRO_PRICE_MNT", "19900"))
PRO_PRODUCT_NAME = os.environ.get("PRO_PRODUCT_NAME", "ЗХД Шалгалт PRO")
INVOICE_TTL_HOURS = int(os.environ.get("INVOICE_TTL_HOURS", "24"))

# Optional: pay out to a specific account instead of the merchant's default one.
# All three parts must be set, and the account must be registered with QPay.
QPAY_ACCOUNT = (
    {
        "bank_code": os.environ["QPAY_ACCOUNT_BANK_CODE"],
        "number": os.environ["QPAY_ACCOUNT_NUMBER"],
        "name": os.environ["QPAY_ACCOUNT_NAME"],
        "currency": os.environ.get("QPAY_ACCOUNT_CURRENCY", "MNT"),
    }
    if os.environ.get("QPAY_ACCOUNT_BANK_CODE")
    and os.environ.get("QPAY_ACCOUNT_NUMBER")
    and os.environ.get("QPAY_ACCOUNT_NAME")
    else None
)

qpay = QPayClient(QPAY_HOST, QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE, QPAY_ACCOUNT)

# ---- Direct bank transfer (no QPay merchant contract needed) ----
# The user transfers manually and the admin confirms in Telegram.
BANK_NAME = os.environ.get("BANK_NAME", "")
BANK_ACCOUNT_NUMBER = os.environ.get("BANK_ACCOUNT_NUMBER", "")
BANK_ACCOUNT_NAME = os.environ.get("BANK_ACCOUNT_NAME", "")
# Optional personal QR exported from your banking app, placed in backend/data/.
BANK_QR_FILE = os.environ.get("BANK_QR_FILE", "")
BANK_TRANSFER_ENABLED = bool(BANK_ACCOUNT_NUMBER and BANK_ACCOUNT_NAME and BANK_NAME)

IMAGES_DIR = ROOT_DIR / "data" / "images"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ============================ Helpers ============================
# Daily limits reset at Mongolia local midnight (UTC+8), not UTC.
MN_TZ = timezone(timedelta(hours=8))


def now_utc():
    return datetime.now(timezone.utc)


def today_str():
    # Current calendar day in Mongolia time — used for daily-usage buckets.
    return datetime.now(MN_TZ).strftime("%Y-%m-%d")


def strip_id(doc):
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Нэвтрэх шаардлагатай")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Сесс хүчингүй")
    exp = session.get("expires_at")
    if isinstance(exp, str):
        try:
            exp = datetime.fromisoformat(exp)
        except Exception:
            exp = None
    if exp is not None:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            raise HTTPException(status_code=401, detail="Сесс дууссан")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Хэрэглэгч олдсонгүй")
    return user


async def get_daily_usage(user_id: str):
    d = today_str()
    doc = await db.dailyUsage.find_one({"user_id": user_id, "date": d}, {"_id": 0})
    if not doc:
        doc = {"user_id": user_id, "date": d, "questionsAnswered": 0, "examsTaken": 0}
    return doc


async def bump_daily(user_id: str, field: str, inc: int = 1):
    d = today_str()
    await db.dailyUsage.update_one(
        {"user_id": user_id, "date": d},
        {"$inc": {field: inc}, "$setOnInsert": {"user_id": user_id, "date": d}},
        upsert=True,
    )


# ============================ Models ============================
class GoogleSignIn(BaseModel):
    id_token: str


class NameRequest(BaseModel):
    name: str


class PracticeAnswer(BaseModel):
    question_id: str
    selectedKey: str


class ExamAnswerItem(BaseModel):
    question_id: str
    selectedKey: Optional[str] = None


class ExamSubmit(BaseModel):
    # New flow: the server owns the question set, so only the session id is needed.
    # `answers` stays accepted so a client can flush anything autosave missed, and
    # so the pre-session API keeps working.
    session_id: Optional[str] = None
    answers: Optional[List[ExamAnswerItem]] = None
    durationSeconds: Optional[int] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None


class ExamAnswerSave(BaseModel):
    session_id: str
    question_id: str
    selectedKey: Optional[str] = None


NAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")


# ============================ Auth ============================
async def issue_session(user_id: str) -> str:
    """Mint our own opaque session token. Google is only ever used to prove identity."""
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
    })
    return token


@api_router.post("/auth/google")
async def auth_google(body: GoogleSignIn):
    """Exchange a Google ID token for a session of ours."""
    if not google.configured:
        raise HTTPException(status_code=503, detail="Google нэвтрэлт тохируулагдаагүй байна")
    try:
        claims = await google.verify(body.id_token)
    except GoogleAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    p = profile_from_claims(claims)
    # Match on the Google account id first: an email can be reassigned, sub cannot.
    existing = await db.users.find_one({"google_sub": p["google_sub"]}) or \
        await db.users.find_one({"email": p["email"]})

    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "google_sub": p["google_sub"],
                "email": p["email"],
                "name": p["name"],
                "picture": p["picture"],
                "lastLoginAt": now_utc().isoformat(),
            }},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "google_sub": p["google_sub"],
            "email": p["email"],
            "name": p["name"],
            "picture": p["picture"],
            "profileName": None,
            "profileNameLower": None,
            "isPro": False,
            "proActivatedAt": None,
            "createdAt": now_utc().isoformat(),
            "lastLoginAt": now_utc().isoformat(),
        })

    token = await issue_session(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": token, "user": user}


@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return user


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============================ Profile ============================
@api_router.get("/profile/check-name")
async def check_name(name: str = Query(...), authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    name = name.strip()
    if not NAME_RE.match(name):
        return {"available": False, "valid": False, "reason": "3-20 тэмдэгт, латин үсэг/тоо/доогуур зураас"}
    lower = name.lower()
    existing = await db.users.find_one({"profileNameLower": lower})
    if existing and existing["user_id"] != user["user_id"]:
        return {"available": False, "valid": True, "reason": "Энэ нэр аль хэдийн ашиглагдсан байна"}
    return {"available": True, "valid": True}


@api_router.post("/profile/set-name")
async def set_name(body: NameRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    name = body.name.strip()
    if not NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="3-20 тэмдэгт, латин үсэг/тоо/доогуур зураас байх ёстой")
    lower = name.lower()
    existing = await db.users.find_one({"profileNameLower": lower})
    if existing and existing["user_id"] != user["user_id"]:
        raise HTTPException(status_code=409, detail="Энэ нэр аль хэдийн ашиглагдсан байна")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"profileName": name, "profileNameLower": lower}},
    )
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated


# ============================ Categories & Questions ============================
def q_public(q, include_answer=False):
    out = {
        "question_id": q["question_id"],
        "num": q.get("num"),
        "category_id": q.get("category_id"),
        "category_name": q.get("category_name"),
        "questionText": q.get("questionText"),
        "options": [{"key": o["key"], "text": o["text"]} for o in q.get("options", [])],
        "imageUrl": q.get("imageUrl"),
    }
    if include_answer:
        out["correctKey"] = q.get("correctKey")
        out["explanation"] = q.get("explanation")
    return out


@api_router.get("/categories")
async def get_categories(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    # Count this user's correct answers per category inside Mongo rather than
    # pulling every question and every progress row into the request.
    rows = await db.userProgress.aggregate([
        {"$match": {"user_id": user["user_id"], "isCorrect": True}},
        {"$lookup": {
            "from": "questions",
            "localField": "question_id",
            "foreignField": "question_id",
            "as": "q",
        }},
        {"$unwind": "$q"},
        {"$group": {"_id": "$q.category_id", "count": {"$sum": 1}}},
    ]).to_list(1000)
    cat_correct = {r["_id"]: r["count"] for r in rows}
    result = []
    for i, c in enumerate(cats):
        locked = (not user.get("isPro")) and (i >= FREE_CATEGORY_LIMIT)
        done = cat_correct.get(c["category_id"], 0)
        total = c["questionCount"]
        result.append({
            **c,
            "locked": locked,
            "completed": done,
            "progressPercent": round((done / total) * 100) if total else 0,
        })
    return result


@api_router.get("/categories/{category_id}/questions")
async def category_questions(category_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    idx = next((i for i, c in enumerate(cats) if c["category_id"] == category_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Бүлэг олдсонгүй")
    if (not user.get("isPro")) and idx >= FREE_CATEGORY_LIMIT:
        raise HTTPException(status_code=403, detail="Энэ бүлэг зөвхөн PRO хэрэглэгчид нээлттэй")
    qs = await db.questions.find({"category_id": category_id}, {"_id": 0}).sort("sourceRow", 1).to_list(2000)
    # attach user progress (bookmark) info
    prog = await db.userProgress.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100000)
    pmap = {p["question_id"]: p for p in prog}
    out = []
    for q in qs:
        pub = q_public(q, include_answer=True)
        p = pmap.get(q["question_id"])
        pub["isBookmarked"] = bool(p and p.get("isBookmarked"))
        out.append(pub)
    return out


@api_router.post("/practice/answer")
async def practice_answer(body: PracticeAnswer, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    q = await db.questions.find_one({"question_id": body.question_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Асуулт олдсонгүй")
    existing = await db.userProgress.find_one(
        {"user_id": user["user_id"], "question_id": body.question_id}
    )
    # Only questions seen for the first time consume the daily quota, so only those
    # are gated by it — revisiting a question you already answered stays free.
    if existing is None and not user.get("isPro"):
        usage = await get_daily_usage(user["user_id"])
        if usage.get("questionsAnswered", 0) >= FREE_DAILY_QUESTIONS:
            raise HTTPException(
                status_code=429,
                detail=f"Өдрийн {FREE_DAILY_QUESTIONS} асуултын хязгаарт хүрлээ. PRO болно уу.",
            )
    is_correct = body.selectedKey == q["correctKey"]
    await db.userProgress.update_one(
        {"user_id": user["user_id"], "question_id": body.question_id},
        {"$set": {
            "user_id": user["user_id"],
            "question_id": body.question_id,
            "isCorrect": is_correct,
            "lastAnsweredAt": now_utc().isoformat(),
        }, "$setOnInsert": {"isBookmarked": False}},
        upsert=True,
    )
    if existing is None:
        await bump_daily(user["user_id"], "questionsAnswered", 1)
    return {"isCorrect": is_correct, "correctKey": q["correctKey"], "explanation": q.get("explanation")}


@api_router.post("/questions/{question_id}/bookmark")
async def toggle_bookmark(question_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    p = await db.userProgress.find_one({"user_id": user["user_id"], "question_id": question_id})
    new_val = not (p and p.get("isBookmarked"))
    await db.userProgress.update_one(
        {"user_id": user["user_id"], "question_id": question_id},
        {"$set": {"isBookmarked": new_val, "user_id": user["user_id"], "question_id": question_id}},
        upsert=True,
    )
    return {"isBookmarked": new_val}


@api_router.get("/questions/bookmarked")
async def bookmarked_questions(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    prog = await db.userProgress.find(
        {"user_id": user["user_id"], "isBookmarked": True}, {"_id": 0}
    ).to_list(100000)
    ids = [p["question_id"] for p in prog]
    if not ids:
        return []
    qs = await db.questions.find({"question_id": {"$in": ids}}, {"_id": 0}).to_list(2000)
    return [q_public(q, include_answer=True) for q in qs]


@api_router.get("/questions/wrong")
async def wrong_questions(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("isPro"):
        raise HTTPException(status_code=403, detail="Алдаатай асуултын горим зөвхөн PRO хэрэглэгчид")
    prog = await db.userProgress.find(
        {"user_id": user["user_id"], "isCorrect": False}, {"_id": 0}
    ).to_list(100000)
    ids = [p["question_id"] for p in prog]
    if not ids:
        return []
    qs = await db.questions.find({"question_id": {"$in": ids}}, {"_id": 0}).to_list(2000)
    return [q_public(q, include_answer=True) for q in qs]


# ---- Exam sessions -------------------------------------------------------
# The question set, the clock and the answers live on the server, so closing the
# app mid-exam no longer loses the attempt - which matters because starting an
# exam is what consumes the daily allowance of a free user.
def session_expiry(started: datetime) -> datetime:
    return started + timedelta(seconds=EXAM_DURATION_SECONDS)


def parse_iso(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


async def session_questions(session) -> List[dict]:
    qs = await db.questions.find(
        {"question_id": {"$in": session["question_ids"]}}, {"_id": 0}
    ).to_list(EXAM_SIZE * 2)
    order = {qid: i for i, qid in enumerate(session["question_ids"])}
    qs.sort(key=lambda q: order.get(q["question_id"], 0))
    return qs


def remaining_seconds(session) -> int:
    expires = parse_iso(session.get("expiresAt"))
    if not expires:
        return 0
    return max(0, int((expires - now_utc()).total_seconds()))


async def score_attempt(user, items, category_id, category_name, duration):
    """Grade a list of {question_id, selectedKey}, record progress, store the attempt."""
    ids = [a["question_id"] for a in items]
    qs = await db.questions.find({"question_id": {"$in": ids}}, {"_id": 0}).to_list(2000)
    qmap = {q["question_id"]: q for q in qs}
    detail = []
    score = 0
    progress_ops = []
    for a in items:
        q = qmap.get(a["question_id"])
        if not q:
            continue
        correct = a.get("selectedKey") == q["correctKey"]
        if correct:
            score += 1
        progress_ops.append(UpdateOne(
            {"user_id": user["user_id"], "question_id": a["question_id"]},
            {"$set": {
                "user_id": user["user_id"], "question_id": a["question_id"],
                "isCorrect": correct, "lastAnsweredAt": now_utc().isoformat(),
            }, "$setOnInsert": {"isBookmarked": False}},
            upsert=True,
        ))
        detail.append({
            "question_id": q["question_id"],
            "questionText": q["questionText"],
            "imageUrl": q.get("imageUrl"),
            "options": [{"key": o["key"], "text": o["text"]} for o in q["options"]],
            "selectedKey": a.get("selectedKey"),
            "correctKey": q["correctKey"],
            "explanation": q.get("explanation"),
            "isCorrect": correct,
        })
    if progress_ops:  # B4: one round trip instead of one per answer
        await db.userProgress.bulk_write(progress_ops, ordered=False)

    total = len(items)
    percent = round((score / total) * 100) if total else 0
    attempt = {
        "attempt_id": f"att_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "type": "exam",
        "score": score,
        "total": total,
        "percent": percent,
        "passed": percent >= EXAM_PASS_PERCENT,
        "durationSeconds": duration,
        "category_id": category_id,
        "category_name": category_name,
        "detail": detail,
        "finishedAt": now_utc().isoformat(),
    }
    await db.attempts.insert_one(attempt)
    return strip_id(attempt)


async def finalize_session(user, session, extra_answers=None, duration=None):
    """Grade a session exactly once, whatever triggered it (submit or timeout)."""
    claimed = await db.examSessions.update_one(
        {"session_id": session["session_id"], "status": "ACTIVE"},
        {"$set": {"status": "SUBMITTED", "finishedAt": now_utc().isoformat()}},
    )
    if not claimed.modified_count:
        existing = await db.attempts.find_one(
            {"session_id": session["session_id"]}, {"_id": 0}
        )
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Энэ шалгалт аль хэдийн дууссан байна")

    answers = dict(session.get("answers") or {})
    for a in extra_answers or []:
        if a.question_id in session["question_ids"]:
            answers[a.question_id] = a.selectedKey

    if duration is None:
        started = parse_iso(session.get("startedAt"))
        duration = int((now_utc() - started).total_seconds()) if started else None
    if duration is not None:
        duration = min(duration, EXAM_DURATION_SECONDS)

    items = [{"question_id": qid, "selectedKey": answers.get(qid)} for qid in session["question_ids"]]
    attempt = await score_attempt(
        user, items, session.get("category_id"), session.get("category_name"), duration
    )
    await db.attempts.update_one(
        {"attempt_id": attempt["attempt_id"]}, {"$set": {"session_id": session["session_id"]}}
    )
    attempt["session_id"] = session["session_id"]
    return attempt


async def active_session(user):
    """The live session, auto-grading it first if the clock has already run out."""
    session = await db.examSessions.find_one(
        {"user_id": user["user_id"], "status": "ACTIVE"}, {"_id": 0}, sort=[("startedAt", -1)]
    )
    if not session:
        return None, None
    if remaining_seconds(session) > 0:
        return session, None
    # Time is up: grade whatever was saved rather than leaving it hanging.
    attempt = await finalize_session(user, session, duration=EXAM_DURATION_SECONDS)
    logger.info("Exam session %s expired and was auto-graded", session["session_id"])
    return None, attempt


async def session_public(session, include_questions=True):
    out = {
        "session_id": session["session_id"],
        "durationSeconds": EXAM_DURATION_SECONDS,
        "remainingSeconds": remaining_seconds(session),
        "category_id": session.get("category_id"),
        "category_name": session.get("category_name"),
        "answers": session.get("answers") or {},
        "startedAt": session.get("startedAt"),
    }
    if include_questions:
        qs = await session_questions(session)
        out["questions"] = [q_public(q, include_answer=False) for q in qs]
    return out


@api_router.get("/exam/active")
async def exam_active(authorization: Optional[str] = Header(None)):
    """Lets the app offer a resume without starting anything."""
    user = await get_current_user(authorization)
    session, expired = await active_session(user)
    if session:
        return {"active": await session_public(session)}
    return {"active": None, "expiredAttempt": expired}


@api_router.get("/exam/start")
async def exam_start(category_id: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    # Resuming costs nothing - the allowance was already spent when it started.
    session, _ = await active_session(user)
    if session:
        return {**await session_public(session), "resumed": True}

    if not user.get("isPro"):
        usage = await get_daily_usage(user["user_id"])
        if usage.get("examsTaken", 0) >= FREE_DAILY_EXAMS:
            raise HTTPException(status_code=429, detail="Free хэрэглэгч өдөрт 1 шалгалт өгнө. PRO болно уу.")

    category_name = None
    query: dict = {}
    if category_id:
        cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
        idx = next((i for i, c in enumerate(cats) if c["category_id"] == category_id), None)
        if idx is None:
            raise HTTPException(status_code=404, detail="Бүлэг олдсонгүй")
        if (not user.get("isPro")) and idx >= FREE_CATEGORY_LIMIT:
            raise HTTPException(status_code=403, detail="Энэ бүлэг зөвхөн PRO хэрэглэгчид нээлттэй")
        category_name = cats[idx]["name"]
        query = {"category_id": category_id}

    # B3: let Mongo do the sampling instead of pulling every question id into memory.
    pipeline = ([{"$match": query}] if query else []) + [
        {"$sample": {"size": EXAM_SIZE}},
        {"$project": {"_id": 0}},
    ]
    qs = await db.questions.aggregate(pipeline).to_list(EXAM_SIZE)
    if not qs:
        raise HTTPException(status_code=404, detail="Асуулт олдсонгүй")

    # B1: a started exam counts against the daily limit. Counting it on submit
    # instead let a free user start, abandon and restart without ever using it up.
    if not user.get("isPro"):
        await bump_daily(user["user_id"], "examsTaken", 1)

    started = now_utc()
    session = {
        "session_id": f"exs_{uuid.uuid4().hex[:16]}",
        "user_id": user["user_id"],
        "status": "ACTIVE",
        "question_ids": [q["question_id"] for q in qs],
        "answers": {},
        "category_id": category_id,
        "category_name": category_name,
        "startedAt": started.isoformat(),
        "expiresAt": session_expiry(started).isoformat(),
    }
    await db.examSessions.insert_one(dict(session))
    return {**await session_public(session), "resumed": False}


@api_router.post("/exam/answer")
async def exam_save_answer(body: ExamAnswerSave, authorization: Optional[str] = Header(None)):
    """Autosave, so a crash costs at most the answer being tapped right now."""
    user = await get_current_user(authorization)
    session = await db.examSessions.find_one(
        {"session_id": body.session_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Шалгалт олдсонгүй")
    if session["status"] != "ACTIVE":
        raise HTTPException(status_code=409, detail="Энэ шалгалт аль хэдийн дууссан байна")
    if body.question_id not in session["question_ids"]:
        raise HTTPException(status_code=400, detail="Энэ асуулт шалгалтад байхгүй")
    if remaining_seconds(session) <= 0:
        raise HTTPException(status_code=409, detail="Хугацаа дууссан")
    await db.examSessions.update_one(
        {"session_id": body.session_id},
        {"$set": {f"answers.{body.question_id}": body.selectedKey}},
    )
    return {"ok": True, "remainingSeconds": remaining_seconds(session)}


@api_router.post("/exam/abandon")
async def exam_abandon(authorization: Optional[str] = Header(None)):
    """Give up without grading. The daily allowance stays spent."""
    user = await get_current_user(authorization)
    res = await db.examSessions.update_one(
        {"user_id": user["user_id"], "status": "ACTIVE"},
        {"$set": {"status": "ABANDONED", "finishedAt": now_utc().isoformat()}},
    )
    return {"ok": True, "abandoned": bool(res.modified_count)}


@api_router.post("/exam/submit")
async def exam_submit(body: ExamSubmit, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    if body.session_id:
        session = await db.examSessions.find_one(
            {"session_id": body.session_id, "user_id": user["user_id"]}, {"_id": 0}
        )
        if not session:
            raise HTTPException(status_code=404, detail="Шалгалт олдсонгүй")
        return await finalize_session(user, session, body.answers, body.durationSeconds)

    # Legacy path: the client sends the whole answer sheet and there is no session.
    if not body.answers:
        raise HTTPException(status_code=400, detail="session_id эсвэл answers шаардлагатай")
    items = [{"question_id": a.question_id, "selectedKey": a.selectedKey} for a in body.answers]
    return await score_attempt(
        user, items, body.category_id, body.category_name, body.durationSeconds
    )


@api_router.get("/attempts")
async def get_attempts(limit: int = 10, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    docs = await db.attempts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("finishedAt", -1).to_list(limit)
    return docs


@api_router.get("/attempts/{attempt_id}")
async def get_attempt(attempt_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.attempts.find_one(
        {"attempt_id": attempt_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Шалгалт олдсонгүй")
    return doc


@api_router.get("/stats")
async def get_stats(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    prog = await db.userProgress.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100000)
    answered = [p for p in prog if "isCorrect" in p]
    total_answered = len(answered)
    correct = sum(1 for p in answered if p.get("isCorrect"))
    correct_pct = round((correct / total_answered) * 100) if total_answered else 0

    # per-category
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    q_all = await db.questions.find({}, {"_id": 0, "question_id": 1, "category_id": 1}).to_list(100000)
    qcat = {q["question_id"]: q["category_id"] for q in q_all}
    per_cat = {}
    pmap = {p["question_id"]: p for p in answered}
    for qid, cid in qcat.items():
        per_cat.setdefault(cid, {"answered": 0, "correct": 0})
    for p in answered:
        cid = qcat.get(p["question_id"])
        if cid:
            per_cat[cid]["answered"] += 1
            if p.get("isCorrect"):
                per_cat[cid]["correct"] += 1
    cat_stats = []
    for c in cats:
        s = per_cat.get(c["category_id"], {"answered": 0, "correct": 0})
        cat_stats.append({
            "category_id": c["category_id"],
            "name": c["name"],
            "questionCount": c["questionCount"],
            "answered": s["answered"],
            "correct": s["correct"],
            "percent": round((s["correct"] / c["questionCount"]) * 100) if c["questionCount"] else 0,
        })

    attempts = await db.attempts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("finishedAt", -1).to_list(10)
    exams_taken = await db.attempts.count_documents({"user_id": user["user_id"]})
    exams_passed = await db.attempts.count_documents({"user_id": user["user_id"], "passed": True})
    bookmarks = sum(1 for p in prog if p.get("isBookmarked"))
    wrong = sum(1 for p in answered if not p.get("isCorrect"))

    # Study streak from dailyUsage (days with any activity), in Mongolia time.
    usage_docs = await db.dailyUsage.find(
        {"user_id": user["user_id"]}, {"_id": 0, "date": 1, "questionsAnswered": 1, "examsTaken": 1}
    ).to_list(100000)
    active_days = sorted(
        {d["date"] for d in usage_docs if (d.get("questionsAnswered", 0) or d.get("examsTaken", 0))},
        reverse=True,
    )
    current_streak = 0
    today = datetime.now(MN_TZ).date()
    cursor = today
    active_set = set(active_days)
    # Allow the streak to count from today or yesterday (grace for not having studied yet today).
    if today.isoformat() not in active_set and (today - timedelta(days=1)).isoformat() in active_set:
        cursor = today - timedelta(days=1)
    while cursor.isoformat() in active_set:
        current_streak += 1
        cursor = cursor - timedelta(days=1)

    return {
        "totalAnswered": total_answered,
        "correct": correct,
        "wrong": wrong,
        "correctPercent": correct_pct,
        "bookmarks": bookmarks,
        "examsTaken": exams_taken,
        "examsPassed": exams_passed,
        "currentStreak": current_streak,
        "studyDays": len(active_days),
        "perCategory": cat_stats,
        "recentExams": [
            {"attempt_id": a["attempt_id"], "score": a["score"], "total": a["total"],
             "percent": a["percent"], "passed": a["passed"], "finishedAt": a["finishedAt"],
             "category_name": a.get("category_name")}
            for a in attempts
        ],
    }


@api_router.get("/me/limits")
async def me_limits(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    usage = await get_daily_usage(user["user_id"])
    return {
        "isPro": bool(user.get("isPro")),
        "profileName": user.get("profileName"),
        "questionsAnswered": usage.get("questionsAnswered", 0),
        "examsTaken": usage.get("examsTaken", 0),
        "freeDailyQuestions": FREE_DAILY_QUESTIONS,
        "freeDailyExams": FREE_DAILY_EXAMS,
        "freeCategoryLimit": FREE_CATEGORY_LIMIT,
    }


# ============================ Payments ============================
# Reference codes use an unambiguous alphabet: no 0/O/1/I/L to avoid transcription
# errors when a user types the code into a transfer description.
REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


async def make_ref_code() -> str:
    for _ in range(20):
        code = "ZHD-" + "".join(random.choice(REF_ALPHABET) for _ in range(5))
        if not await db.payments.find_one({"ref": code}):
            return code
    raise HTTPException(status_code=500, detail="Код үүсгэж чадсангүй")


# ============================ Payments (QPay) ============================
class CreatePaymentRequest(BaseModel):
    # Reserved for future multi-plan support; only "pro" exists today.
    plan: Optional[str] = "pro"


def payment_public(doc):
    return {
        "payment_id": doc["payment_id"],
        "method": doc.get("method", "qpay"),
        "ref": doc.get("ref"),
        "status": doc["status"],
        "amount": doc["amount"],
        "description": doc.get("description"),
        "qr_text": doc.get("qr_text"),
        "qr_image": doc.get("qr_image"),
        "short_url": doc.get("short_url"),
        "urls": doc.get("urls") or [],
        "createdAt": doc.get("createdAt"),
        "paidAt": doc.get("paidAt"),
    }


async def activate_pro(user_id: str, source: str):
    """Flip a user to PRO. Safe to call repeatedly (payments can be confirmed twice:
    once by the QPay callback, once by the app polling)."""
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"isPro": True, "proActivatedAt": now_utc().isoformat(), "proSource": source}},
    )


async def settle_payment(doc) -> dict:
    """Ask QPay whether this invoice is paid; on first PAID mark it and grant PRO."""
    if doc["status"] == "PAID" or doc.get("method") == "bank":
        return doc
    result = await qpay.payment_check(doc["invoice_id"])
    if not result["paid"]:
        return doc
    # Mongo re-checks the filter under the document lock, so exactly one caller
    # flips NEW -> PAID even if the callback and a poll land at the same moment.
    res = await db.payments.update_one(
        {"payment_id": doc["payment_id"], "status": {"$ne": "PAID"}},
        {"$set": {
            "status": "PAID",
            "paidAt": now_utc().isoformat(),
            "qpayPaymentId": result.get("payment_id"),
            "paidAmount": str(result.get("amount")) if result.get("amount") is not None else None,
        }},
    )
    updated = await db.payments.find_one({"payment_id": doc["payment_id"]}, {"_id": 0})
    if res.modified_count:
        await activate_pro(updated["user_id"], "qpay")
        logger.info("Payment %s settled, PRO granted to %s", doc["payment_id"], updated["user_id"])
    return updated


@api_router.get("/payments/plan")
async def payment_plan():
    """Price/availability, so the app can show the real amount and hide the
    QPay button when the merchant credentials are not configured."""
    return {
        "plan": "pro",
        "name": PRO_PRODUCT_NAME,
        "amount": PRO_PRICE_MNT,
        "currency": "MNT",
        "enabled": qpay.configured or BANK_TRANSFER_ENABLED,
        "qpay": qpay.configured,
        "bankTransfer": BANK_TRANSFER_ENABLED,
    }


@api_router.post("/payments/create")
async def create_payment(body: CreatePaymentRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if user.get("isPro"):
        raise HTTPException(status_code=400, detail="Та аль хэдийн PRO хэрэглэгч байна")
    if not qpay.configured:
        raise HTTPException(status_code=503, detail="Төлбөрийн систем тохируулагдаагүй байна")
    if not PUBLIC_URL:
        raise HTTPException(status_code=503, detail="PUBLIC_URL тохируулагдаагүй байна")

    # Reuse a still-pending invoice instead of creating a duplicate on every open.
    existing = await db.payments.find_one(
        {"user_id": user["user_id"], "method": "qpay", "status": "NEW"},
        {"_id": 0},
        sort=[("createdAt", -1)],
    )
    if existing:
        settled = await settle_payment(existing)
        if settled["status"] == "PAID":
            return {**payment_public(settled), "alreadyPro": True}
        if settled.get("amount") == PRO_PRICE_MNT:
            return payment_public(settled)
        # Price changed since the invoice was made — drop it and issue a new one.
        await qpay.invoice_cancel(settled["invoice_id"])
        await db.payments.update_one({"payment_id": settled["payment_id"]}, {"$set": {"status": "CANCELED"}})

    payment_id = f"pay_{uuid.uuid4().hex[:16]}"
    callback_url = f"{PUBLIC_URL.rstrip('/')}/api/payments/qpay/callback?payment_id={payment_id}"
    try:
        invoice = await qpay.invoice_create(
            sender_invoice_no=payment_id,
            invoice_receiver_code=user.get("profileName") or user["user_id"],
            description=f"{PRO_PRODUCT_NAME} — {user.get('profileName') or user['user_id']}",
            amount=PRO_PRICE_MNT,
            callback_url=callback_url,
        )
    except QPayError as e:
        logger.error("QPay invoice create failed: %s", e)
        raise HTTPException(status_code=502, detail="Нэхэмжлэх үүсгэж чадсангүй. Дахин оролдоно уу.")

    doc = {
        "payment_id": payment_id,
        "user_id": user["user_id"],
        "plan": "pro",
        "method": "qpay",
        "status": "NEW",
        "amount": PRO_PRICE_MNT,
        "currency": "MNT",
        "description": PRO_PRODUCT_NAME,
        "invoice_id": invoice.get("invoice_id"),
        "qr_text": invoice.get("qr_text"),
        "qr_image": invoice.get("qr_image"),
        "short_url": invoice.get("qPay_shortUrl"),
        "urls": invoice.get("urls") or [],
        "createdAt": now_utc().isoformat(),
        "paidAt": None,
    }
    await db.payments.insert_one(dict(doc))
    return payment_public(doc)


@api_router.post("/payments/qpay/callback")
@api_router.get("/payments/qpay/callback")
async def qpay_callback(payment_id: str = Query(...)):
    """Called by QPay once the invoice is paid. The payment_id is only a lookup
    key — the paid state is always verified against QPay before granting PRO."""
    doc = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    try:
        await settle_payment(doc)
    except QPayError as e:
        logger.error("QPay callback check failed for %s: %s", payment_id, e)
        raise HTTPException(status_code=502, detail="check failed")
    return {"ok": True}


@api_router.get("/payments/{payment_id}")
async def payment_status(payment_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not doc or doc["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Гүйлгээ олдсонгүй")
    doc = await settle_payment(doc)
    return {**payment_public(doc), "isPro": doc["status"] == "PAID" or bool(user.get("isPro"))}


@api_router.get("/payments")
async def payment_history(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    docs = await db.payments.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "qr_image": 0, "qr_text": 0, "urls": 0},
    ).sort("createdAt", -1).to_list(100)
    return docs


# ============================ Payments (bank transfer) ============================
def bank_info_public():
    return {
        "enabled": BANK_TRANSFER_ENABLED,
        "bankName": BANK_NAME,
        "accountNumber": BANK_ACCOUNT_NUMBER,
        "accountName": BANK_ACCOUNT_NAME,
        "amount": PRO_PRICE_MNT,
        "currency": "MNT",
        "qrUrl": f"/api/payments/bank/qr" if (BANK_QR_FILE and (ROOT_DIR / "data" / BANK_QR_FILE).exists()) else None,
    }


@api_router.get("/payments/bank/info")
async def bank_info():
    return bank_info_public()


@api_router.get("/payments/bank/qr")
async def bank_qr():
    """Serves the personal QR exported from the admin's banking app."""
    if not BANK_QR_FILE:
        raise HTTPException(status_code=404, detail="QR тохируулаагүй")
    path = ROOT_DIR / "data" / BANK_QR_FILE
    if not path.exists():
        raise HTTPException(status_code=404, detail="QR файл олдсонгүй")
    return FileResponse(path)


@api_router.post("/payments/bank/create")
async def bank_create(authorization: Optional[str] = Header(None)):
    """Issues a reference code the user must put in the transfer description."""
    user = await get_current_user(authorization)
    if user.get("isPro"):
        raise HTTPException(status_code=400, detail="Та аль хэдийн PRO хэрэглэгч байна")
    if not BANK_TRANSFER_ENABLED:
        raise HTTPException(status_code=503, detail="Дансаар төлөх боломж тохируулагдаагүй байна")

    # Reuse an open request so the code a user already transferred with stays valid.
    existing = await db.payments.find_one(
        {"user_id": user["user_id"], "method": "bank", "status": {"$in": ["NEW", "PENDING"]}},
        {"_id": 0},
        sort=[("createdAt", -1)],
    )
    if existing and existing["amount"] == PRO_PRICE_MNT:
        return {**payment_public(existing), "bank": bank_info_public()}

    doc = {
        "payment_id": f"pay_{uuid.uuid4().hex[:16]}",
        "user_id": user["user_id"],
        "plan": "pro",
        "method": "bank",
        "status": "NEW",
        "ref": await make_ref_code(),
        "amount": PRO_PRICE_MNT,
        "currency": "MNT",
        "description": PRO_PRODUCT_NAME,
        "createdAt": now_utc().isoformat(),
        "paidAt": None,
    }
    await db.payments.insert_one(dict(doc))
    return {**payment_public(doc), "bank": bank_info_public()}


@api_router.post("/payments/bank/{payment_id}/claim")
async def bank_claim(payment_id: str, authorization: Optional[str] = Header(None)):
    """User says they have transferred. Moves the request to PENDING and pings the
    admin in Telegram with approve/reject buttons. Nothing is granted here."""
    user = await get_current_user(authorization)
    doc = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not doc or doc["user_id"] != user["user_id"] or doc.get("method") != "bank":
        raise HTTPException(status_code=404, detail="Хүсэлт олдсонгүй")
    if doc["status"] == "PAID":
        return payment_public(doc)
    if doc["status"] == "PENDING":
        return payment_public(doc)

    res = await db.payments.update_one(
        {"payment_id": payment_id, "status": "NEW"},
        {"$set": {"status": "PENDING", "claimedAt": now_utc().isoformat()}},
    )
    updated = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if res.modified_count:  # only ping the admin once
        await notify_admin_transfer(updated, user)
    return payment_public(updated)


async def notify_admin_transfer(doc, user):
    who = user.get("profileName") or user.get("name") or user["user_id"]
    text = "\n".join([
        "💸 <b>Шилжүүлгийн хүсэлт</b>",
        "",
        f"Хэрэглэгч: <b>{who}</b>",
        f"Дүн: <b>{doc['amount']:,}₮</b>",
        f"Гүйлгээний утга: <code>{doc['ref']}</code>",
        "",
        "Дансаа шалгаад доорх товчоор баталгаажуулна уу.",
    ])
    await tg_send(
        TELEGRAM_ADMIN_ID,
        text,
        reply_markup={
            "inline_keyboard": [[
                {"text": "✅ Зөвшөөрөх", "callback_data": f"payok:{doc['payment_id']}"},
                {"text": "❌ Татгалзах", "callback_data": f"payno:{doc['payment_id']}"},
            ]]
        },
    )


async def resolve_bank_payment(payment_id: str, approve: bool) -> str:
    """Admin decision from Telegram. Returns a message to show back in the chat."""
    doc = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not doc:
        return "❌ Хүсэлт олдсонгүй."
    if doc["status"] == "PAID":
        return f"ℹ️ <code>{doc['ref']}</code> аль хэдийн баталгаажсан."
    if doc["status"] == "REJECTED":
        return f"ℹ️ <code>{doc['ref']}</code> аль хэдийн татгалзсан."

    if not approve:
        await db.payments.update_one(
            {"payment_id": payment_id},
            {"$set": {"status": "REJECTED", "resolvedAt": now_utc().isoformat()}},
        )
        return f"❌ <code>{doc['ref']}</code> татгалзлаа."

    res = await db.payments.update_one(
        {"payment_id": payment_id, "status": {"$ne": "PAID"}},
        {"$set": {"status": "PAID", "paidAt": now_utc().isoformat()}},
    )
    if not res.modified_count:
        return "ℹ️ Аль хэдийн баталгаажсан."
    updated = await db.payments.find_one({"payment_id": payment_id}, {"_id": 0})
    await activate_pro(updated["user_id"], "bank")
    u = await db.users.find_one({"user_id": updated["user_id"]}, {"_id": 0})
    who = (u or {}).get("profileName") or updated["user_id"]
    logger.info("Bank payment %s approved, PRO granted to %s", payment_id, updated["user_id"])
    return f"✅ <code>{updated['ref']}</code> баталгаажлаа. «{who}» PRO боллоо."


# ============================ Telegram Bot ============================
async def tg_send(chat_id, text, reply_markup=None):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    async with httpx.AsyncClient(timeout=15) as hc:
        await hc.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", json=payload
        )


async def tg_api(method: str, payload: dict):
    if not TELEGRAM_BOT_TOKEN:
        return
    async with httpx.AsyncClient(timeout=15) as hc:
        await hc.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}", json=payload)


async def handle_admin_command(chat_id, text):
    text = (text or "").strip()
    low = text.lower()

    async def activate(pname):
        u = await db.users.find_one({"profileNameLower": pname.lower()})
        if not u:
            return f"❌ «{pname}» гэсэн профайл нэртэй хэрэглэгч олдсонгүй."
        if u.get("isPro"):
            return f"ℹ️ «{u['profileName']}» аль хэдийн PRO байна."
        await db.users.update_one({"user_id": u["user_id"]},
                                  {"$set": {"isPro": True, "proActivatedAt": now_utc().isoformat()}})
        return f"✅ «{u['profileName']}» хэрэглэгчийн PRO идэвхжлээ."

    async def deactivate(pname):
        u = await db.users.find_one({"profileNameLower": pname.lower()})
        if not u:
            return f"❌ «{pname}» гэсэн профайл нэртэй хэрэглэгч олдсонгүй."
        if not u.get("isPro"):
            return f"ℹ️ «{u['profileName']}» PRO биш байна."
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": {"isPro": False}})
        return f"✅ «{u['profileName']}» хэрэглэгчийн PRO цуцлагдлаа."

    async def check(pname):
        u = await db.users.find_one({"profileNameLower": pname.lower()})
        if not u:
            return f"❌ «{pname}» гэсэн профайл нэртэй хэрэглэгч олдсонгүй."
        attempts = await db.attempts.count_documents({"user_id": u["user_id"]})
        prog = await db.userProgress.count_documents({"user_id": u["user_id"]})
        status = "PRO ✅" if u.get("isPro") else "Free"
        created = (u.get("createdAt") or "")[:10]
        return (f"👤 <b>{u['profileName']}</b>\n"
                f"Төлөв: {status}\n"
                f"Бүртгүүлсэн: {created}\n"
                f"Хариулсан асуулт: {prog}\n"
                f"Өгсөн шалгалт: {attempts}")

    if low == "/stats":
        today = today_str()
        users_total = await db.users.count_documents({})
        pros = await db.users.count_documents({"isPro": True})
        new_today = await db.users.count_documents({"createdAt": {"$gte": today}})
        active_today = len(await db.dailyUsage.find(
            {"date": today}, {"_id": 0, "user_id": 1}
        ).to_list(100000))
        attempts_today = await db.attempts.count_documents({"finishedAt": {"$gte": today}})
        pending = await db.payments.count_documents({"method": "bank", "status": "PENDING"})
        paid = await db.payments.find(
            {"status": "PAID"}, {"_id": 0, "amount": 1, "paidAt": 1}
        ).to_list(100000)
        revenue = sum(p.get("amount") or 0 for p in paid)
        revenue_today = sum(
            p.get("amount") or 0 for p in paid if (p.get("paidAt") or "") >= today
        )
        lines = [
            "📊 <b>Тойм</b>",
            "",
            f"Хэрэглэгч: <b>{users_total}</b> (PRO: {pros})",
            f"Өнөөдөр шинээр: <b>{new_today}</b>",
            f"Өнөөдөр идэвхтэй: <b>{active_today}</b>",
            f"Өнөөдрийн шалгалт: <b>{attempts_today}</b>",
            "",
            f"Нийт орлого: <b>{revenue:,}₮</b>",
            f"Өнөөдөр: <b>{revenue_today:,}₮</b>",
        ]
        if pending:
            lines += ["", f"⏳ Баталгаажаагүй шилжүүлэг: <b>{pending}</b> (/pending)"]
        return "\n".join(lines)

    if low == "/pending":
        # Re-send the approve/reject buttons for anything still awaiting a decision.
        reqs = await db.payments.find(
            {"method": "bank", "status": "PENDING"}, {"_id": 0}
        ).sort("claimedAt", 1).to_list(50)
        if not reqs:
            return "Хүлээгдэж буй шилжүүлэг алга байна."
        for r in reqs:
            u = await db.users.find_one({"user_id": r["user_id"]}, {"_id": 0})
            await notify_admin_transfer(r, u or {"user_id": r["user_id"]})
        return f"Хүлээгдэж буй {len(reqs)} хүсэлтийг дээр гаргалаа."

    if low == "/list":
        pros = await db.users.find({"isPro": True}, {"_id": 0, "profileName": 1}).to_list(1000)
        if not pros:
            return "PRO хэрэглэгч алга байна."
        names = "\n".join(f"• {p.get('profileName')}" for p in pros)
        return f"<b>PRO хэрэглэгчид ({len(pros)}):</b>\n{names}"
    if low.startswith("/pro "):
        return await activate(text[5:].strip())
    if low.startswith("/unpro "):
        return await deactivate(text[7:].strip())
    if low.startswith("/check "):
        return await check(text[7:].strip())
    if low in ("/start", "/help"):
        return ("Админ командууд:\n"
                "<code>&lt;профайл нэр&gt;</code> эсвэл /pro нэр → PRO идэвхжүүлэх\n"
                "/unpro нэр → PRO цуцлах\n"
                "/check нэр → төлөв харах\n"
                "/list → PRO хэрэглэгчид\n"
                "/pending → баталгаажаагүй шилжүүлгүүд\n"
                "/stats → хэрэглэгч, идэвх, орлогын тойм")
    # plain text = profile name to activate
    if text and not text.startswith("/"):
        return await activate(text)
    return "Танихгүй команд. /help бичнэ үү."


@api_router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if TELEGRAM_WEBHOOK_SECRET and secret != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="forbidden")
    update = await request.json()

    # Approve/reject buttons on a bank-transfer request.
    cq = update.get("callback_query")
    if cq:
        if str(cq.get("from", {}).get("id")) != str(TELEGRAM_ADMIN_ID):
            await tg_api("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "Эрх байхгүй"})
            return {"ok": True}
        data = cq.get("data") or ""
        action, _, payment_id = data.partition(":")
        if action in ("payok", "payno") and payment_id:
            reply = await resolve_bank_payment(payment_id, approve=action == "payok")
        else:
            reply = "Танихгүй үйлдэл."
        await tg_api("answerCallbackQuery", {"callback_query_id": cq["id"]})
        message = cq.get("message") or {}
        if message.get("message_id"):
            # Replace the buttons with the outcome so it cannot be pressed twice.
            await tg_api("editMessageText", {
                "chat_id": message["chat"]["id"],
                "message_id": message["message_id"],
                "text": (message.get("text") or "") + "\n\n" + reply,
                "parse_mode": "HTML",
            })
        else:
            await tg_send(cq.get("from", {}).get("id"), reply)
        return {"ok": True}

    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return {"ok": True}
    chat_id = msg.get("chat", {}).get("id")
    from_id = str(msg.get("from", {}).get("id"))
    text = msg.get("text", "")
    if from_id != str(TELEGRAM_ADMIN_ID):
        await tg_send(chat_id, "⛔ Танд энэ ботыг ашиглах эрх байхгүй.")
        return {"ok": True}
    reply = await handle_admin_command(chat_id, text)
    await tg_send(chat_id, reply)
    return {"ok": True}


@api_router.get("/telegram/set-webhook")
async def set_webhook():
    if not (TELEGRAM_BOT_TOKEN and PUBLIC_URL):
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN эсвэл PUBLIC_URL дутуу")
    url = f"{PUBLIC_URL}/api/telegram/webhook"
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook",
            json={"url": url, "secret_token": TELEGRAM_WEBHOOK_SECRET,
                  "allowed_updates": ["message", "edited_message", "callback_query"]},
        )
    return r.json()


@api_router.get("/config")
async def public_config():
    """Client settings the app fetches at launch.

    OAuth *client ids* are public by design — they ship inside every app binary.
    Serving them means the app and this server can never disagree about which
    Google clients are valid, and changing one does not require a new build.
    The client *secret* is never used by this project and is not exposed here.
    """
    return {
        "google": {
            "webClientId": os.environ.get("GOOGLE_CLIENT_ID_WEB") or None,
            "iosClientId": os.environ.get("GOOGLE_CLIENT_ID_IOS") or None,
            "androidClientId": os.environ.get("GOOGLE_CLIENT_ID_ANDROID") or None,
        },
        "pro": {
            "price": PRO_PRICE_MNT,
            "currency": "MNT",
            "qpay": qpay.configured,
            "bankTransfer": BANK_TRANSFER_ENABLED,
        },
        "limits": {
            "freeCategoryLimit": FREE_CATEGORY_LIMIT,
            "freeDailyQuestions": FREE_DAILY_QUESTIONS,
            "freeDailyExams": FREE_DAILY_EXAMS,
        },
        "exam": {"size": EXAM_SIZE, "durationSeconds": EXAM_DURATION_SECONDS},
    }


@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "ЗХД шалгалт API"}


# ============================ App wiring ============================
app.include_router(api_router)

if IMAGES_DIR.exists():
    app.mount("/api/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# The app authenticates with a Bearer header, not cookies, so credentialed
# requests are not needed — and "*" with credentials is rejected by browsers anyway.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=CORS_ORIGINS != ["*"],
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def cleanup_stale():
    """Drop rows nothing will ever read again: expired sessions and invoices that
    were opened but never paid. Cheap, and keeps the collections from growing forever."""
    try:
        gone = await db.user_sessions.delete_many({"expires_at": {"$lt": now_utc().isoformat()}})
        cutoff = (now_utc() - timedelta(hours=INVOICE_TTL_HOURS)).isoformat()
        stale = await db.payments.delete_many({"status": "NEW", "createdAt": {"$lt": cutoff}})
        old_cutoff = (now_utc() - timedelta(days=7)).isoformat()
        await db.examSessions.delete_many(
            {"status": {"$ne": "ACTIVE"}, "startedAt": {"$lt": old_cutoff}}
        )
        if gone.deleted_count or stale.deleted_count:
            logger.info(
                "Cleanup: %s expired sessions, %s stale invoices",
                gone.deleted_count, stale.deleted_count,
            )
    except Exception as e:
        logger.warning(f"Cleanup skipped: {e}")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("profileNameLower", unique=True, sparse=True)
    await db.users.create_index("google_sub", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.userProgress.create_index([("user_id", 1), ("question_id", 1)], unique=True)
    await db.dailyUsage.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.attempts.create_index([("user_id", 1), ("finishedAt", -1)])
    await db.attempts.create_index("session_id", sparse=True)
    await db.examSessions.create_index("session_id", unique=True)
    await db.examSessions.create_index([("user_id", 1), ("status", 1)])
    await db.payments.create_index("payment_id", unique=True)
    await db.payments.create_index([("user_id", 1), ("createdAt", -1)])
    await db.payments.create_index("ref", sparse=True)
    # Without these every practice answer and every category fetch is a full scan.
    await db.questions.create_index("question_id", unique=True)
    await db.questions.create_index("category_id")
    await db.categories.create_index("category_id", unique=True)
    await db.userProgress.create_index([("user_id", 1), ("isBookmarked", 1)])
    await db.userProgress.create_index([("user_id", 1), ("isCorrect", 1)])
    logger.info("Indexes ready")
    await cleanup_stale()
    # Auto-seed questions/categories on an empty DB so a fresh deploy works out of the box.
    try:
        from seed_data import seed
        report = await seed(db)
        if report.get("skipped"):
            logger.info("Seed: DB already populated, skipping.")
        else:
            logger.info(f"Seed: inserted categories={report['categories']} questions={report['questions']}")
    except Exception as e:
        logger.warning(f"Auto-seed skipped/failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

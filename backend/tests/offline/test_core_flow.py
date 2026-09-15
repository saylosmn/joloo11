"""Limits, exam flow, category progress and cleanup."""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.update({"MONGO_URL": "mongodb://localhost:27017", "DB_NAME": "zhd_test"})

from mongomock_motor import AsyncMongoMockClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402
motor.motor_asyncio.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

# Keep the app's auto-seed out of the way; this test supplies its own fixture data.
import types  # noqa: E402
_fake = types.ModuleType("seed_data")


async def _skip(db):
    return {"skipped": True}


_fake.seed = _skip
sys.modules["seed_data"] = _fake

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from anyio.from_thread import start_blocking_portal  # noqa: E402

TOKEN, UID = "tok", "u1"
PRO_TOKEN, PRO_UID = "ptok", "u2"


async def seed():
    cats = [{"category_id": f"c{i}", "name": f"Бүлэг {i}", "order": i, "questionCount": 5}
            for i in range(4)]
    await server.db.categories.insert_many(cats)
    qs = []
    for ci in range(4):
        for j in range(5):
            qs.append({
                "question_id": f"q{ci}_{j}", "num": ci * 5 + j, "category_id": f"c{ci}",
                "category_name": f"Бүлэг {ci}", "questionText": f"Асуулт {ci}-{j}",
                "options": [{"key": "a", "text": "A"}, {"key": "b", "text": "B"}],
                "correctKey": "a", "explanation": "тайлбар", "sourceRow": j,
            })
    await server.db.questions.insert_many(qs)
    for tok, uid, pro in [(TOKEN, UID, False), (PRO_TOKEN, PRO_UID, True)]:
        await server.db.users.insert_one({
            "user_id": uid, "email": f"{uid}@t.mn", "profileName": uid,
            "profileNameLower": uid, "isPro": pro,
            "createdAt": server.now_utc().isoformat()})
        await server.db.user_sessions.insert_one({
            "session_token": tok, "user_id": uid,
            "expires_at": (server.now_utc() + server.timedelta(days=1)).isoformat()})
    # an already-expired session and a stale invoice, for the cleanup check
    await server.db.user_sessions.insert_one({
        "session_token": "dead", "user_id": UID,
        "expires_at": (server.now_utc() - server.timedelta(days=2)).isoformat()})
    await server.db.payments.insert_one({
        "payment_id": "old", "user_id": UID, "method": "qpay", "status": "NEW", "amount": 1,
        "createdAt": (server.now_utc() - server.timedelta(days=3)).isoformat()})
    await server.db.payments.insert_one({
        "payment_id": "kept", "user_id": UID, "method": "qpay", "status": "PAID", "amount": 1,
        "createdAt": (server.now_utc() - server.timedelta(days=3)).isoformat()})


# mongomock's bulk_write shim is too old for this pymongo (it chokes on UpdateOne's
# `sort`). Apply the ops one by one instead, and record the calls so the test can
# still assert the endpoint issues a single bulk round trip.
BULK_CALLS = []


def install_bulk_shim():
    import mongomock_motor

    async def shim(self, ops, ordered=True):
        BULK_CALLS.append(len(ops))
        for op in ops:
            await self.update_one(op._filter, op._doc, upsert=op._upsert)

    mongomock_motor.AsyncMongoMockCollection.bulk_write = shim


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


# Seed before startup so the app's auto-seed sees a populated DB and skips.
with start_blocking_portal() as portal:
    portal.call(seed)

with TestClient(server.app) as c:
    with start_blocking_portal() as portal:
        portal.call(server.cleanup_stale)
    install_bulk_shim()

    H = {"Authorization": f"Bearer {TOKEN}"}
    P = {"Authorization": f"Bearer {PRO_TOKEN}"}

    print("\nB8) cleanup removed only what is dead")
    with start_blocking_portal() as portal:
        n_sess = portal.call(lambda: server.db.user_sessions.count_documents({}))
        pays = portal.call(lambda: server.db.payments.find({}, {"_id": 0}).to_list(10))
    check(n_sess == 2, f"expired session dropped, {n_sess} live sessions left")
    check([p["payment_id"] for p in pays] == ["kept"], f"stale NEW invoice dropped, kept={pays}")
    check(c.get("/api/auth/me", headers={"Authorization": "Bearer dead"}).status_code == 401,
          "expired token rejected")

    print("\nB2) indexes exist on questions/categories")
    with start_blocking_portal() as portal:
        idx = portal.call(lambda: server.db.questions.index_information())
    keys = {tuple(v["key"][0]) for v in idx.values() if v.get("key")}
    check(("question_id", 1) in keys, f"question_id indexed: {keys}")
    check(("category_id", 1) in keys, "category_id indexed")

    print("\nB7) auth_me has no stray query parameter")
    params = server.app.openapi()["paths"]["/api/auth/me"]["get"].get("parameters", [])
    check(not any(p["name"] == "user" for p in params), f"params={[p['name'] for p in params]}")

    print("\nFREE limits: categories")
    cats = c.get("/api/categories", headers=H).json()
    check(len(cats) == 4, f"{len(cats)} categories")
    check([x["locked"] for x in cats] == [False, False, True, True], "first 2 unlocked for free")
    check(all(x["locked"] is False for x in c.get("/api/categories", headers=P).json()),
          "all unlocked for PRO")
    check(c.get("/api/categories/c3/questions", headers=H).status_code == 403, "locked category 403")

    print("\nB5) category progress counts correct answers")
    for j in range(3):
        r = c.post("/api/practice/answer", headers=H,
                   json={"question_id": f"q0_{j}", "selectedKey": "a" if j < 2 else "b"})
        check(r.status_code == 200, f"answer {j} accepted")
    cats = c.get("/api/categories", headers=H).json()
    c0 = next(x for x in cats if x["category_id"] == "c0")
    check(c0["completed"] == 2, f"2 correct counted, got {c0['completed']}")
    check(c0["progressPercent"] == 40, f"40%, got {c0['progressPercent']}")
    check(next(x for x in cats if x["category_id"] == "c1")["completed"] == 0, "other category 0")

    print("\nB1) a started exam counts against the free daily limit")
    lim = c.get("/api/me/limits", headers=H).json()
    check(lim["examsTaken"] == 0, "no exams yet")
    ex = c.get("/api/exam/start", headers=H)
    check(ex.status_code == 200, f"first exam starts ({ex.status_code})")
    check(len(ex.json()["questions"]) == 20, f"20 questions, got {len(ex.json()['questions'])}")
    check("correctKey" not in ex.json()["questions"][0], "answers not leaked to the client")
    check(c.get("/api/me/limits", headers=H).json()["examsTaken"] == 1, "counted on start")
    # Restarting resumes the live session rather than handing out a second exam;
    # test_exam_session.py covers the resume semantics in detail.
    second = c.get("/api/exam/start", headers=H)
    check(second.status_code == 200 and second.json()["resumed"] is True, "restart resumes")
    check(second.json()["session_id"] == ex.json()["session_id"], "same session")
    check(c.get("/api/me/limits", headers=H).json()["examsTaken"] == 1, "still one exam used")
    check(c.get("/api/exam/start", headers=P).status_code == 200, "PRO unaffected")

    print("\nB4) submitting records progress for every answer")
    body = {"session_id": ex.json()["session_id"],
            "answers": [{"question_id": q["question_id"], "selectedKey": "a"}
                        for q in ex.json()["questions"]], "durationSeconds": 60}
    res = c.post("/api/exam/submit", headers=H, json=body).json()
    check(res["score"] == 20 and res["percent"] == 100 and res["passed"] is True,
          f"scored {res['score']}/{res['total']}")
    check(len(res["detail"]) == 20, "full breakdown returned")
    with start_blocking_portal() as portal:
        n = portal.call(lambda: server.db.userProgress.count_documents({"user_id": UID}))
    check(n == 20, f"20 progress rows written, got {n}")
    check(BULK_CALLS == [20], f"exactly one bulk call with 20 ops, got {BULK_CALLS}")
    check(c.get("/api/me/limits", headers=H).json()["examsTaken"] == 1,
          "submitting does not double-count")

    print("\nFREE limits: daily questions")
    # The cap counts questions answered for the FIRST time; the exam above already
    # recorded progress for every question in the fixture, so add a fresh one.
    with start_blocking_portal() as portal:
        async def add_q():
            await server.db.questions.insert_one({
                "question_id": "qNEW", "num": 99, "category_id": "c0",
                "category_name": "Бүлэг 0", "questionText": "Шинэ асуулт",
                "options": [{"key": "a", "text": "A"}], "correctKey": "a", "sourceRow": 99})
        portal.call(add_q)
    server.FREE_DAILY_QUESTIONS = c.get("/api/me/limits", headers=H).json()["questionsAnswered"]
    r = c.post("/api/practice/answer", headers=H,
               json={"question_id": "qNEW", "selectedKey": "a"})
    check(r.status_code == 429, f"new question blocked at the cap ({r.status_code})")
    check("PRO" in r.json()["detail"], "message points at PRO")
    again = c.post("/api/practice/answer", headers=H,
                   json={"question_id": "q0_0", "selectedKey": "b"})
    check(again.status_code == 200, "re-answering an already-seen question still allowed")
    check(c.post("/api/practice/answer", headers=P,
                 json={"question_id": "qNEW", "selectedKey": "a"}).status_code == 200,
          "PRO has no daily cap")
    server.FREE_DAILY_QUESTIONS = 30

    print("\nwrong/bookmark modes")
    check(c.get("/api/questions/wrong", headers=H).status_code == 403, "wrong mode is PRO only")
    c.post("/api/questions/q0_0/bookmark", headers=H)
    bm = c.get("/api/questions/bookmarked", headers=H).json()
    check(len(bm) == 1 and bm[0]["question_id"] == "q0_0", f"bookmark saved: {bm}")
    c.post("/api/questions/q0_0/bookmark", headers=H)
    check(len(c.get("/api/questions/bookmarked", headers=H).json()) == 0, "bookmark toggles off")

print("\nALL PASS")

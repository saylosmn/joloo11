"""Server-side exam sessions: resume, autosave, timeout, abandon."""
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

BULK_CALLS = []


def install_bulk_shim():
    """mongomock's bulk_write shim is too old for this pymongo; apply ops one by one."""
    import mongomock_motor

    async def shim(self, ops, ordered=True):
        BULK_CALLS.append(len(ops))
        for op in ops:
            await self.update_one(op._filter, op._doc, upsert=op._upsert)

    mongomock_motor.AsyncMongoMockCollection.bulk_write = shim


TOKEN, UID = "tok", "u1"
PRO_TOKEN, PRO_UID = "ptok", "u2"


async def seed():
    await server.db.categories.insert_many(
        [{"category_id": f"c{i}", "name": f"Бүлэг {i}", "order": i, "questionCount": 15}
         for i in range(2)])
    qs = []
    for ci in range(2):
        for j in range(15):
            qs.append({
                "question_id": f"q{ci}_{j}", "num": ci * 15 + j, "category_id": f"c{ci}",
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


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok:", msg)


def expire(session_id, portal):
    """Push a session's deadline into the past."""
    async def go():
        await server.db.examSessions.update_one(
            {"session_id": session_id},
            {"$set": {"expiresAt": (server.now_utc() - server.timedelta(minutes=1)).isoformat()}})
    portal.call(go)


with start_blocking_portal() as portal:
    portal.call(seed)

with TestClient(server.app) as c:
    install_bulk_shim()
    H = {"Authorization": f"Bearer {TOKEN}"}
    P = {"Authorization": f"Bearer {PRO_TOKEN}"}

    print("\n1) nothing active before the first start")
    check(c.get("/api/exam/active", headers=H).json()["active"] is None, "no active session")

    print("\n2) start creates a session")
    ex = c.get("/api/exam/start", headers=H).json()
    sid = ex["session_id"]
    check(ex["resumed"] is False, "flagged as a fresh start")
    check(len(ex["questions"]) == 20, f"20 questions, got {len(ex['questions'])}")
    check("correctKey" not in ex["questions"][0], "answers not leaked")
    check(0 < ex["remainingSeconds"] <= 25 * 60, f"clock running: {ex['remainingSeconds']}s")
    check(c.get("/api/me/limits", headers=H).json()["examsTaken"] == 1, "counted once")

    print("\n3) autosave stores answers on the server")
    first = ex["questions"][0]["question_id"]
    r = c.post("/api/exam/answer", headers=H,
               json={"session_id": sid, "question_id": first, "selectedKey": "a"})
    check(r.status_code == 200, f"answer saved ({r.status_code})")
    active = c.get("/api/exam/active", headers=H).json()["active"]
    check(active["answers"] == {first: "a"}, f"answer persisted: {active['answers']}")
    check(active["session_id"] == sid, "same session")

    print("\n4) restarting resumes instead of burning another exam")
    again = c.get("/api/exam/start", headers=H).json()
    check(again["resumed"] is True, "flagged as resumed")
    check(again["session_id"] == sid, "same session id")
    check(again["answers"] == {first: "a"}, "answers came back")
    check([q["question_id"] for q in again["questions"]] ==
          [q["question_id"] for q in ex["questions"]], "same questions in the same order")
    check(c.get("/api/me/limits", headers=H).json()["examsTaken"] == 1, "still only one exam used")

    print("\n5) autosave is validated")
    in_exam = {q["question_id"] for q in ex["questions"]}
    outsider = next(f"q{ci}_{j}" for ci in range(2) for j in range(15)
                    if f"q{ci}_{j}" not in in_exam)
    check(c.post("/api/exam/answer", headers=H,
                 json={"session_id": sid, "question_id": outsider, "selectedKey": "a"}
                 ).status_code == 400, f"real question outside this exam rejected ({outsider})")
    check(c.post("/api/exam/answer", headers=P,
                 json={"session_id": sid, "question_id": first, "selectedKey": "b"}
                 ).status_code == 404, "another user cannot write to this session")
    check(c.get("/api/exam/active", headers=H).json()["active"]["answers"][first] == "a",
          "answer untouched by the rejected writes")

    print("\n6) submit grades the stored answers")
    for q in ex["questions"][1:11]:
        c.post("/api/exam/answer", headers=H,
               json={"session_id": sid, "question_id": q["question_id"], "selectedKey": "a"})
    res = c.post("/api/exam/submit", headers=H, json={"session_id": sid}).json()
    check(res["score"] == 11, f"11 correct, got {res['score']}")
    check(res["total"] == 20, f"unanswered ones still count, total={res['total']}")
    check(res["percent"] == 55 and res["passed"] is False, f"{res['percent']}% -> failed")
    check(len(res["detail"]) == 20, "full breakdown returned")
    check(c.get("/api/exam/active", headers=H).json()["active"] is None, "session closed")

    print("\n7) submitting twice returns the same attempt, not a second one")
    dup = c.post("/api/exam/submit", headers=H, json={"session_id": sid}).json()
    check(dup["attempt_id"] == res["attempt_id"], "same attempt returned")
    with start_blocking_portal() as portal:
        n = portal.call(lambda: server.db.attempts.count_documents({"user_id": UID}))
    check(n == 1, f"one attempt stored, got {n}")
    check(c.post("/api/exam/answer", headers=H,
                 json={"session_id": sid, "question_id": first, "selectedKey": "b"}
                 ).status_code == 409, "cannot answer a finished exam")

    print("\n8) a free user is still capped after finishing")
    check(c.get("/api/exam/start", headers=H).status_code == 429, "second exam blocked")

    print("\n9) timeout auto-grades whatever was saved")
    ex2 = c.get("/api/exam/start", headers=P).json()
    sid2 = ex2["session_id"]
    c.post("/api/exam/answer", headers=P,
           json={"session_id": sid2, "question_id": ex2["questions"][0]["question_id"],
                 "selectedKey": "a"})
    with start_blocking_portal() as portal:
        expire(sid2, portal)
    out = c.get("/api/exam/active", headers=P).json()
    check(out["active"] is None, "expired session is no longer active")
    check(out["expiredAttempt"] and out["expiredAttempt"]["score"] == 1,
          f"auto-graded: {out['expiredAttempt'] and out['expiredAttempt']['score']}")
    check(out["expiredAttempt"]["durationSeconds"] == 25 * 60, "recorded as the full duration")
    check(c.post("/api/exam/answer", headers=P,
                 json={"session_id": sid2, "question_id": ex2["questions"][1]["question_id"],
                       "selectedKey": "a"}).status_code == 409, "cannot answer after timeout")

    print("\n10) starting after a timeout gives a brand new exam")
    ex3 = c.get("/api/exam/start", headers=P).json()
    check(ex3["session_id"] != sid2 and ex3["resumed"] is False, "new session")

    print("\n11) abandon closes the session without grading")
    ab = c.post("/api/exam/abandon", headers=P).json()
    check(ab["abandoned"] is True, "abandoned")
    check(c.get("/api/exam/active", headers=P).json()["active"] is None, "nothing active")
    with start_blocking_portal() as portal:
        n = portal.call(lambda: server.db.attempts.count_documents({"user_id": PRO_UID}))
    check(n == 1, f"no attempt recorded for the abandoned exam (still {n} from the timeout)")
    check(c.post("/api/exam/abandon", headers=P).json()["abandoned"] is False, "nothing left to abandon")

    print("\n12) submit can flush answers autosave missed")
    ex4 = c.get("/api/exam/start", headers=P).json()
    flushed = [{"question_id": q["question_id"], "selectedKey": "a"} for q in ex4["questions"][:5]]
    res4 = c.post("/api/exam/submit", headers=P,
                  json={"session_id": ex4["session_id"], "answers": flushed}).json()
    check(res4["score"] == 5, f"5 correct from the flushed answers, got {res4['score']}")

    print("\n13) unknown or foreign sessions are refused")
    check(c.post("/api/exam/submit", headers=H, json={"session_id": "exs_nope"}).status_code == 404,
          "unknown session 404")
    check(c.post("/api/exam/submit", headers=H, json={}).status_code == 400,
          "empty submit rejected")

    print("\n14) the pre-session API still works")
    legacy = c.post("/api/exam/submit", headers=P, json={
        "answers": [{"question_id": "q0_0", "selectedKey": "a"},
                    {"question_id": "q0_1", "selectedKey": "b"}],
        "durationSeconds": 42}).json()
    check(legacy["score"] == 1 and legacy["total"] == 2, f"legacy scoring: {legacy['score']}/2")
    check(legacy["durationSeconds"] == 42, "legacy duration kept")

print("\nALL PASS")

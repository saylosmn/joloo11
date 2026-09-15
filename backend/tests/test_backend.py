"""Backend tests for ЗХД Шалгалт (Mongolian driving license) app."""
import os
import time
import pytest
import requests
from pathlib import Path

# Target backend: BACKEND_URL env var wins, otherwise read frontend/.env.
# The repo root is found relative to this file so the suite runs outside /app too.
REPO_ROOT = Path(__file__).resolve().parents[2]
CANDIDATES = [REPO_ROOT / "frontend" / ".env", Path("/app/frontend/.env")]

BASE_URL = os.environ.get("BACKEND_URL", "").strip().rstrip("/") or None
if not BASE_URL:
    for env_file in CANDIDATES:
        if not env_file.exists():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        if BASE_URL:
            break

# These tests hit a running backend over HTTP; skip rather than fail when there
# is nothing to point them at.
pytestmark = pytest.mark.skipif(
    not BASE_URL,
    reason="Set BACKEND_URL or EXPO_PUBLIC_BACKEND_URL in frontend/.env",
)

FREE_TOKEN = "TESTTOKEN_FREE"
PRO_TOKEN = "TESTTOKEN_PRO"
# Never hardcode these: they must match the deployment under test.
TG_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
ADMIN_ID = int(os.environ.get("TELEGRAM_ADMIN_ID", "0") or 0)


def H(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Auth gating ----------------
def test_auth_no_token_401():
    r = requests.get(f"{BASE_URL}/api/categories", timeout=15)
    assert r.status_code == 401


def test_auth_me_free():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("profileName") == "free_tester"
    assert d.get("isPro") is False


def test_auth_me_pro():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(PRO_TOKEN), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("profileName") == "pro_tester"
    assert d.get("isPro") is True


def test_auth_invalid_token_401():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H("BAD_TOKEN_XYZ"), timeout=15)
    assert r.status_code == 401


# ---------------- Limits ----------------
def test_limits_free():
    r = requests.get(f"{BASE_URL}/api/me/limits", headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["isPro"] is False
    assert d["freeDailyQuestions"] == 30
    assert d["freeDailyExams"] == 1
    assert d["freeCategoryLimit"] == 2


def test_limits_pro():
    r = requests.get(f"{BASE_URL}/api/me/limits", headers=H(PRO_TOKEN), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["isPro"] is True


# ---------------- Categories ----------------
def test_categories_free_locked():
    r = requests.get(f"{BASE_URL}/api/categories", headers=H(FREE_TOKEN), timeout=20)
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) == 33
    assert cats[0]["locked"] is False
    assert cats[1]["locked"] is False
    for c in cats[2:]:
        assert c["locked"] is True, f"cat {c['category_id']} should be locked"


def test_categories_pro_all_unlocked():
    r = requests.get(f"{BASE_URL}/api/categories", headers=H(PRO_TOKEN), timeout=20)
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) == 33
    for c in cats:
        assert c["locked"] is False


def test_category_questions_free_cat1_ok():
    r = requests.get(f"{BASE_URL}/api/categories/cat_1/questions", headers=H(FREE_TOKEN), timeout=20)
    assert r.status_code == 200
    qs = r.json()
    assert isinstance(qs, list) and len(qs) > 0
    q0 = qs[0]
    for k in ("question_id", "questionText", "options", "correctKey"):
        assert k in q0


def test_category_questions_free_cat3_forbidden():
    r = requests.get(f"{BASE_URL}/api/categories/cat_3/questions", headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 403


def test_category_questions_pro_cat3_ok():
    r = requests.get(f"{BASE_URL}/api/categories/cat_3/questions", headers=H(PRO_TOKEN), timeout=20)
    assert r.status_code == 200
    assert len(r.json()) > 0


def test_category_not_found():
    r = requests.get(f"{BASE_URL}/api/categories/cat_9999/questions", headers=H(PRO_TOKEN), timeout=15)
    assert r.status_code == 404


# ---------------- Practice ----------------
def test_practice_answer_returns_correctness_pro():
    # PRO to avoid affecting FREE daily limit
    r = requests.get(f"{BASE_URL}/api/categories/cat_1/questions", headers=H(PRO_TOKEN), timeout=15)
    q = r.json()[0]
    payload = {"question_id": q["question_id"], "selectedKey": q["correctKey"]}
    r2 = requests.post(f"{BASE_URL}/api/practice/answer", json=payload, headers=H(PRO_TOKEN), timeout=15)
    assert r2.status_code == 200
    d = r2.json()
    assert d["isCorrect"] is True
    assert d["correctKey"] == q["correctKey"]
    assert "explanation" in d

    # Wrong answer
    wrong = "b" if q["correctKey"] != "b" else "a"
    r3 = requests.post(f"{BASE_URL}/api/practice/answer", headers=H(PRO_TOKEN),
                       json={"question_id": q["question_id"], "selectedKey": wrong}, timeout=15)
    assert r3.status_code == 200
    assert r3.json()["isCorrect"] is False


# ---------------- Wrong questions gating ----------------
def test_wrong_forbidden_free():
    r = requests.get(f"{BASE_URL}/api/questions/wrong", headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 403


def test_wrong_ok_pro():
    r = requests.get(f"{BASE_URL}/api/questions/wrong", headers=H(PRO_TOKEN), timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------- Bookmarks ----------------
def test_bookmark_toggle():
    r = requests.get(f"{BASE_URL}/api/categories/cat_1/questions", headers=H(PRO_TOKEN), timeout=15)
    qid = r.json()[0]["question_id"]

    # Toggle to true
    r1 = requests.post(f"{BASE_URL}/api/questions/{qid}/bookmark", headers=H(PRO_TOKEN), timeout=15)
    assert r1.status_code == 200
    first = r1.json()["isBookmarked"]

    r2 = requests.get(f"{BASE_URL}/api/questions/bookmarked", headers=H(PRO_TOKEN), timeout=15)
    assert r2.status_code == 200
    ids = [q["question_id"] for q in r2.json()]
    if first:
        assert qid in ids
    else:
        assert qid not in ids

    # Toggle back
    r3 = requests.post(f"{BASE_URL}/api/questions/{qid}/bookmark", headers=H(PRO_TOKEN), timeout=15)
    assert r3.status_code == 200
    assert r3.json()["isBookmarked"] == (not first)


# ---------------- Exam ----------------
def test_exam_start_no_answers_exposed_pro():
    r = requests.get(f"{BASE_URL}/api/exam/start", headers=H(PRO_TOKEN), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["durationSeconds"] == 1500
    qs = d["questions"]
    assert len(qs) == 20
    for q in qs:
        assert "correctKey" not in q
        assert "explanation" not in q
        assert "options" in q and len(q["options"]) >= 2


def test_exam_submit_and_attempts_pro():
    r = requests.get(f"{BASE_URL}/api/exam/start", headers=H(PRO_TOKEN), timeout=20)
    qs = r.json()["questions"]
    # answer 'a' for all
    payload = {"answers": [{"question_id": q["question_id"], "selectedKey": "a"} for q in qs],
               "durationSeconds": 60}
    r2 = requests.post(f"{BASE_URL}/api/exam/submit", json=payload, headers=H(PRO_TOKEN), timeout=30)
    assert r2.status_code == 200
    d = r2.json()
    assert d["total"] == 20
    assert 0 <= d["percent"] <= 100
    assert d["passed"] == (d["percent"] >= 75)
    assert len(d["detail"]) == 20
    assert "correctKey" in d["detail"][0]

    # attempts history
    r3 = requests.get(f"{BASE_URL}/api/attempts", headers=H(PRO_TOKEN), timeout=15)
    assert r3.status_code == 200
    attempts = r3.json()
    assert isinstance(attempts, list) and len(attempts) >= 1
    assert attempts[0]["attempt_id"] == d["attempt_id"]


# ---------------- Stats ----------------
def test_stats_pro():
    r = requests.get(f"{BASE_URL}/api/stats", headers=H(PRO_TOKEN), timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("totalAnswered", "correctPercent", "perCategory", "recentExams",
              "examsTaken", "examsPassed"):
        assert k in d
    assert isinstance(d["perCategory"], list)


# ---------------- Profile name ----------------
def test_check_name_invalid():
    # too short
    r = requests.get(f"{BASE_URL}/api/profile/check-name?name=ab", headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 200
    assert r.json()["valid"] is False

    # too long
    r = requests.get(f"{BASE_URL}/api/profile/check-name?name={'a'*21}", headers=H(FREE_TOKEN), timeout=15)
    assert r.json()["valid"] is False

    # spaces
    r = requests.get(f"{BASE_URL}/api/profile/check-name", params={"name": "has space"}, headers=H(FREE_TOKEN), timeout=15)
    assert r.json()["valid"] is False

    # non-latin (cyrillic)
    r = requests.get(f"{BASE_URL}/api/profile/check-name", params={"name": "монгол"}, headers=H(FREE_TOKEN), timeout=15)
    assert r.json()["valid"] is False


def test_check_name_valid_but_taken():
    r = requests.get(f"{BASE_URL}/api/profile/check-name?name=pro_tester", headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["valid"] is True
    assert d["available"] is False  # taken by pro_tester


def test_check_name_valid_own():
    # own name should still be "available" (or valid)
    r = requests.get(f"{BASE_URL}/api/profile/check-name?name=free_tester", headers=H(FREE_TOKEN), timeout=15)
    assert r.json()["valid"] is True
    assert r.json()["available"] is True


def test_set_name_duplicate_409():
    # Try to set free_tester's name to pro_tester (case-insensitive)
    r = requests.post(f"{BASE_URL}/api/profile/set-name", json={"name": "Pro_Tester"},
                      headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 409


def test_set_name_invalid_400():
    r = requests.post(f"{BASE_URL}/api/profile/set-name", json={"name": "ab"},
                      headers=H(FREE_TOKEN), timeout=15)
    assert r.status_code == 400


# ---------------- Telegram webhook ----------------
def _tg_send(text, from_id=ADMIN_ID, secret=TG_SECRET):
    headers = {"Content-Type": "application/json"}
    if secret is not None:
        headers["X-Telegram-Bot-Api-Secret-Token"] = secret
    body = {"message": {"chat": {"id": from_id}, "from": {"id": from_id}, "text": text}}
    return requests.post(f"{BASE_URL}/api/telegram/webhook", json=body, headers=headers, timeout=15)


def test_telegram_no_secret_403():
    r = _tg_send("/list", secret=None)
    assert r.status_code == 403


def test_telegram_wrong_secret_403():
    r = _tg_send("/list", secret="wrong")
    assert r.status_code == 403


def test_telegram_non_admin_refused():
    # non-admin from.id but valid secret → server returns 200 but sends refusal;
    # We just verify status ok (it doesn't do db mutations)
    r = _tg_send("/pro pro_tester", from_id=99999999)
    assert r.status_code == 200


def test_telegram_admin_check_pro_tester():
    r = _tg_send("/check pro_tester")
    assert r.status_code == 200


def test_telegram_admin_pro_and_unpro_free_tester():
    """Flip free_tester to PRO, verify DB, then back to FREE."""
    # Ensure starting state = FREE
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15).json()
    assert me["isPro"] is False

    # /pro free_tester
    r1 = _tg_send("/pro free_tester")
    assert r1.status_code == 200
    time.sleep(0.5)
    me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15).json()
    assert me2["isPro"] is True, "free_tester should be PRO after /pro"

    # /unpro free_tester (restore)
    r2 = _tg_send("/unpro free_tester")
    assert r2.status_code == 200
    time.sleep(0.5)
    me3 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15).json()
    assert me3["isPro"] is False, "free_tester should be back to FREE"


def test_telegram_plain_name_activates_and_case_insensitive():
    """Plain text 'FREE_TESTER' (mixed case) should activate; then /unpro to restore."""
    r1 = _tg_send("FREE_TESTER")
    assert r1.status_code == 200
    time.sleep(0.5)
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15).json()
    assert me["isPro"] is True

    r2 = _tg_send("/unpro free_tester")
    assert r2.status_code == 200
    time.sleep(0.5)
    me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15).json()
    assert me2["isPro"] is False


def test_telegram_check_nonexistent_returns_ok():
    r = _tg_send("/check does_not_exist_zzz")
    assert r.status_code == 200


# Final safety: ensure test users end in expected state
def test_zz_final_state_preserved():
    free = requests.get(f"{BASE_URL}/api/auth/me", headers=H(FREE_TOKEN), timeout=15).json()
    pro = requests.get(f"{BASE_URL}/api/auth/me", headers=H(PRO_TOKEN), timeout=15).json()
    assert free["isPro"] is False, "free_tester must remain FREE"
    assert pro["isPro"] is True, "pro_tester must remain PRO"

"""
Shared seed helpers. Seeds `categories` and `questions` from the committed
JSON exports (data/categories.json, data/questions.json) — no Excel/openpyxl
needed at runtime. Used both by scripts/seed_from_json.py (manual) and by the
server startup hook (auto-seed on an empty DB, so a fresh deploy just works).
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
CATEGORIES_JSON = DATA_DIR / "categories.json"
QUESTIONS_JSON = DATA_DIR / "questions.json"


def load_json():
    with open(CATEGORIES_JSON, "r", encoding="utf-8") as f:
        categories = json.load(f)
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)
    return categories, questions


async def seed(db, *, force: bool = False):
    """Seed categories + questions into MongoDB.

    Returns a dict report. When force=False, skips collections that already
    hold the expected number of documents (idempotent, safe on every boot).
    """
    categories, questions = load_json()
    report = {"categories": 0, "questions": 0, "skipped": False}

    existing_q = await db.questions.count_documents({})
    existing_c = await db.categories.count_documents({})

    if not force and existing_q == len(questions) and existing_c == len(categories):
        report["skipped"] = True
        return report

    if force or existing_c != len(categories):
        await db.categories.delete_many({})
        if categories:
            await db.categories.insert_many([dict(c) for c in categories])
        report["categories"] = len(categories)

    if force or existing_q != len(questions):
        await db.questions.delete_many({})
        if questions:
            await db.questions.insert_many([dict(q) for q in questions])
        report["questions"] = len(questions)

    # Helpful indexes for lookups.
    await db.questions.create_index("question_id", unique=True)
    await db.questions.create_index("category_id")
    await db.categories.create_index("category_id", unique=True)

    return report

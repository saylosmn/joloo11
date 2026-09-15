"""
Manual seed from JSON exports (no Excel needed).

Run:  cd backend && python scripts/seed_from_json.py [--force]

Reads data/categories.json + data/questions.json and seeds MongoDB.
The server also auto-seeds an empty DB on startup, so this is only needed
to force a re-seed after the data changes.
"""
import os
import sys
import asyncio
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seed_data import seed, load_json  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


async def main():
    force = "--force" in sys.argv
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    categories, questions = load_json()
    print(f"Loaded {len(categories)} categories / {len(questions)} questions from JSON.")
    report = await seed(db, force=force)
    if report["skipped"]:
        print("DB already seeded (counts match) — nothing to do. Use --force to reseed.")
    else:
        print(f"Seeded: categories={report['categories']} questions={report['questions']}")

    qc = await db.questions.count_documents({})
    cc = await db.categories.count_documents({})
    img = await db.questions.count_documents({"imageUrl": {"$ne": None}})
    print(f"MongoDB now: {cc} categories, {qc} questions, {img} with images.")
    assert qc == len(questions), "question count mismatch!"
    assert cc == len(categories), "category count mismatch!"
    print("OK ✓")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

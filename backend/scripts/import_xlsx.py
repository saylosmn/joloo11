"""Import questions, categories and images from the source workbook.

Reads the `Асуултууд` sheet, pulls the picture anchored to each row, and rewrites
`data/categories.json`, `data/questions.json`, `data/image_map.json` and
`data/images/`. When the workbook has a `Хураангуй` sheet, the per-chapter counts
and answer distribution there are used to cross-check the import.

Nothing is written unless every row validates, so a broken workbook cannot leave
the data half-replaced.

    python backend/scripts/import_xlsx.py <workbook.xlsx> [--dry-run]
"""
import argparse
import collections
import json
import shutil
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
IMAGES = DATA / "images"

SHEET = "Асуултууд"
SUMMARY_SHEET = "Хураангуй"
LETTERS = ["А", "Б", "В", "Г"]

# Column layout of the questions sheet.
COL_NUM, COL_CAT, COL_TEXT = 0, 1, 2
COL_OPTIONS = (4, 5, 6, 7)
COL_CORRECT, COL_EXPLANATION = 8, 9


def clean(value) -> str:
    return "" if value is None else str(value).strip()


def read_questions(ws):
    """Returns (rows, problems). A row is a dict; problems are human-readable strings."""
    rows, problems = [], []
    for excel_row, raw in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(c is not None for c in raw):
            continue

        num_text = clean(raw[COL_NUM])
        category = clean(raw[COL_CAT])
        text = clean(raw[COL_TEXT])
        options = [clean(raw[c]) for c in COL_OPTIONS]
        correct = clean(raw[COL_CORRECT]).upper()
        explanation = clean(raw[COL_EXPLANATION])

        bad = []
        if not num_text.isdigit():
            bad.append(f"№ нь тоо биш: {num_text!r}")
        if not category:
            bad.append("бүлэг хоосон")
        if not text:
            bad.append("асуулт хоосон")
        if any(not o for o in options):
            bad.append("сонголт дутуу")
        if correct not in LETTERS:
            bad.append(f"зөв хариулт буруу: {correct!r}")
        if bad:
            problems.append(f"мөр {excel_row}: " + ", ".join(bad))
            continue

        rows.append({
            "excel_row": excel_row,
            "num": int(num_text),
            "category_name": category,
            "questionText": text,
            "options": options,
            "correctKey": correct,
            "explanation": explanation,
        })
    return rows, problems


def read_images(ws):
    """Maps a sheet row number to (bytes, extension) for the picture anchored there."""
    found = {}
    for image in ws._images:
        anchor = getattr(image.anchor, "_from", None)
        if anchor is None:
            continue
        excel_row = anchor.row + 1  # anchors are 0-indexed
        data = image.ref.getvalue() if hasattr(image.ref, "getvalue") else Path(image.ref).read_bytes()
        ext = (getattr(image, "format", "") or "png").lower()
        if ext == "jpeg":
            ext = "jpg"
        found[excel_row] = (data, ext)
    return found


def read_summary(wb):
    """Expected {chapter: count} from the summary sheet, if present."""
    if SUMMARY_SHEET not in wb.sheetnames:
        return None
    expected = {}
    for raw in wb[SUMMARY_SHEET].iter_rows(min_row=2, values_only=True):
        name, count = clean(raw[0]), raw[1]
        if not name or name.upper().startswith("НИЙТ") or not isinstance(count, int):
            continue
        expected[name] = count
    return expected or None


def build(rows, images):
    """Turns validated rows into the JSON documents the app seeds from."""
    order = []
    for r in rows:
        if r["category_name"] not in order:
            order.append(r["category_name"])

    # Ids are numbered by display order and zero-padded so they sort naturally.
    # They must be unique: a previous export derived them from the leading number
    # in the chapter name, which restarts inside the appendices and collided.
    cat_id = {name: f"cat_{i + 1:02d}" for i, name in enumerate(order)}
    counts = collections.Counter(r["category_name"] for r in rows)

    categories = [
        {
            "category_id": cat_id[name],
            "name": name,
            "order": i,
            "questionCount": counts[name],
        }
        for i, name in enumerate(order)
    ]

    questions, image_map, files = [], {}, {}
    for r in rows:
        num = r["num"]
        image_url = None
        if r["excel_row"] in images:
            data, ext = images[r["excel_row"]]
            filename = f"q_{num}.{ext}"
            files[filename] = data
            image_map[str(num)] = filename
            image_url = f"/api/images/{filename}"

        questions.append({
            "question_id": f"q_{num}",
            "num": num,
            "sourceRow": r["excel_row"],
            "category_id": cat_id[r["category_name"]],
            "category_name": r["category_name"],
            "questionText": r["questionText"],
            "options": [
                {"key": key, "text": text} for key, text in zip(LETTERS, r["options"])
            ],
            "correctKey": r["correctKey"],
            "explanation": r["explanation"],
            "imageUrl": image_url,
        })

    return categories, questions, image_map, files


def check(categories, questions, expected):
    """Returns a list of mismatches; empty means the import is consistent."""
    errors = []

    nums = [q["num"] for q in questions]
    if len(set(nums)) != len(nums):
        dupes = [n for n, c in collections.Counter(nums).items() if c > 1]
        errors.append(f"давхардсан № : {dupes[:10]}")

    ids = [c["category_id"] for c in categories]
    if len(set(ids)) != len(ids):
        errors.append("давхардсан category_id")

    known = {c["category_id"] for c in categories}
    orphans = {q["category_id"] for q in questions} - known
    if orphans:
        errors.append(f"бүлэггүй асуулт: {orphans}")

    counts = collections.Counter(q["category_id"] for q in questions)
    for c in categories:
        if counts[c["category_id"]] != c["questionCount"]:
            errors.append(
                f"{c['name']}: questionCount={c['questionCount']} "
                f"бодит={counts[c['category_id']]}"
            )

    if expected:
        by_name = {c["name"]: c["questionCount"] for c in categories}
        for name, want in expected.items():
            got = by_name.get(name)
            if got is None:
                errors.append(f"хураангуйд байгаа бүлэг эх хуудсанд алга: {name}")
            elif got != want:
                errors.append(f"{name}: хураангуй={want} бодит={got}")
        for name in by_name:
            if name not in expected:
                errors.append(f"хураангуйд байхгүй бүлэг: {name}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="шалгаад юу ч бичихгүй")
    args = parser.parse_args()

    if not args.workbook.exists():
        print(f"Файл олдсонгүй: {args.workbook}")
        return 1

    wb = openpyxl.load_workbook(args.workbook)
    if SHEET not in wb.sheetnames:
        print(f"'{SHEET}' хуудас олдсонгүй. Байгаа: {wb.sheetnames}")
        return 1
    ws = wb[SHEET]

    rows, problems = read_questions(ws)
    images = read_images(ws)
    expected = read_summary(wb)

    print(f"Асуулт     : {len(rows)}")
    print(f"Зураг      : {len(images)}")
    print(f"Алдаатай   : {len(problems)}")
    for p in problems[:15]:
        print("   ", p)
    if problems:
        print("\nАлдаатай мөр байгаа тул юу ч бичсэнгүй.")
        return 1

    categories, questions, image_map, files = build(rows, images)
    errors = check(categories, questions, expected)

    print(f"Бүлэг      : {len(categories)}")
    print(f"Зурагтай   : {sum(1 for q in questions if q['imageUrl'])}/{len(questions)}")
    dist = collections.Counter(q["correctKey"] for q in questions)
    print("Хариултын хуваарилалт:", " / ".join(f"{k}={dist[k]}" for k in LETTERS))

    if errors:
        print(f"\n{len(errors)} зөрчил олдлоо — юу ч бичсэнгүй:")
        for e in errors[:20]:
            print("   ", e)
        return 1

    if args.dry_run:
        print("\n--dry-run: бүх шалгалт давлаа, файл бичсэнгүй.")
        return 0

    # Only now touch the repo.
    if IMAGES.exists():
        shutil.rmtree(IMAGES)
    IMAGES.mkdir(parents=True)
    for name, data in files.items():
        (IMAGES / name).write_bytes(data)

    for path, payload in (
        (DATA / "categories.json", categories),
        (DATA / "questions.json", questions),
        (DATA / "image_map.json", image_map),
    ):
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    print(f"\nБичсэн: {len(files)} зураг, categories.json, questions.json, image_map.json")
    print("Дараа нь DB-г шинэчилнэ:  python backend/scripts/seed_from_json.py --force")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Diagnose a MongoDB connection string before deploying with it.

Reads MONGO_URL from backend/.env (or the environment, or argv[1]), reports the
common misconfigurations by name, and tries a real connection. The password is
never printed.

    python backend/scripts/check_mongo.py
    python backend/scripts/check_mongo.py "mongodb+srv://user:pass@cluster.mongodb.net/"
"""
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus, unquote

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, OperationFailure, ServerSelectionTimeoutError

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# Characters that MUST be percent-encoded inside the userinfo part of a URI.
MUST_ESCAPE = set(":/?#[]@")
PLACEHOLDERS = ("<db_password>", "<password>", "<username>", "<user>", "<PASSWORD>")


def split_uri(uri: str):
    """Splits a MongoDB URI into (scheme, user, password, rest).

    Done by hand rather than with urlsplit: an unescaped "/" or "?" inside the
    password derails the standard parser before it reaches the host, which is
    exactly the case worth diagnosing. A host can never contain "@", so the last
    "@" is always the userinfo separator.
    """
    scheme, _, remainder = uri.partition("://")
    if not remainder or "@" not in remainder:
        return scheme, None, None, remainder
    userinfo, _, rest = remainder.rpartition("@")
    user, sep, password = userinfo.partition(":")
    return scheme, user, (password if sep else None), rest


def inspect(uri: str) -> tuple[list[str], bool]:
    """Static checks that catch the mistakes people actually make.

    Returns (problems, encoding_is_the_issue).
    """
    problems = []
    encoding_issue = False

    for ph in PLACEHOLDERS:
        if ph in uri:
            problems.append(
                f"Холболтын мөрөнд `{ph}` гэсэн орлуулагч үлдсэн байна — "
                "бодит утгаараа солино уу."
            )
            return problems, False  # nothing else is worth checking yet

    if not uri.startswith(("mongodb://", "mongodb+srv://")):
        problems.append("`mongodb://` эсвэл `mongodb+srv://`-ээр эхлэх ёстой.")
        return problems, encoding_issue

    scheme, user, password, rest = split_uri(uri)
    if user is None:
        problems.append("Хэрэглэгчийн нэр/нууц үг байхгүй байна (`user:pass@` хэсэг дутуу).")
        return problems, encoding_issue
    if password is None:
        problems.append("Нууц үг байхгүй байна (`user:pass` хэлбэртэй байх ёстой).")
        return problems, encoding_issue
    if not user:
        problems.append("Хэрэглэгчийн нэр хоосон байна.")
    if not password:
        problems.append("Нууц үг хоосон байна.")

    # A raw special character here is the classic cause of "bad auth".
    decoded = unquote(password)
    stray = MUST_ESCAPE & set(decoded)
    if stray and quote_plus(decoded) != password:
        encoding_issue = True
        shown = " ".join(sorted(stray))
        problems.append(
            f"Нууц үгэнд тусгай тэмдэгт байна ({shown}) — URL-encode хийх шаардлагатай."
        )

    host = rest.split("/")[0].split("?")[0]
    if scheme == "mongodb+srv" and ":" in host:
        problems.append("`mongodb+srv://` хэлбэрт порт бичихгүй.")
    if host and "." not in host:
        problems.append(
            f"Хостын нэр эргэлзээтэй байна ({host!r}) — нууц үгийн escape хийгээгүйгээс "
            "холболтын мөр буруу задарсан байж болзошгүй."
        )

    return problems, encoding_issue


def fixed_uri(uri: str) -> str | None:
    """Re-encodes user and password, when that is what is wrong."""
    scheme, user, password, rest = split_uri(uri)
    if user is None or password is None:
        return None
    rebuilt = f"{quote_plus(unquote(user))}:{quote_plus(unquote(password))}"
    if rebuilt == f"{user}:{password}":
        return None
    return f"{scheme}://{rebuilt}@{rest}"


def redact(uri: str) -> str:
    scheme, user, password, rest = split_uri(uri)
    if user is None:
        return uri
    return f"{scheme}://{user}:***@{rest}"


def try_connect(uri: str) -> tuple[bool, str]:
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        info = client.server_info()
        dbs = client.list_database_names()
        return True, f"MongoDB {info['version']} · сангууд: {', '.join(dbs) or '(хоосон)'}"
    except OperationFailure as e:
        if "bad auth" in str(e).lower() or getattr(e, "code", None) == 8000:
            return False, (
                "bad auth — хэрэглэгчийн нэр эсвэл нууц үг буруу.\n"
                "   • Atlas → Database Access → хэрэглэгчээ шалгах, эсвэл\n"
                "     «Edit → Edit Password → Autogenerate» дараад шинэ нууц үг авах\n"
                "   • Нууц үгээ хуулахдаа хоосон зай, мөр таслалт орсон эсэхийг шалгах\n"
                "   • Хэрэглэгчийн эрх «Read and write to any database» байх"
            )
        return False, f"Нэвтрэлтийн алдаа: {e}"
    except ServerSelectionTimeoutError as e:
        return False, (
            "Сервер олдсонгүй / холбогдож чадсангүй.\n"
            "   • Atlas → Network Access → 0.0.0.0/0 нэмсэн эсэхийг шалгах\n"
            "   • Кластер унтарсан эсэхийг шалгах\n"
            f"   ({str(e)[:160]})"
        )
    except ConfigurationError as e:
        return False, f"Холболтын мөрийн бүтэц буруу: {e}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def main() -> int:
    uri = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MONGO_URL", "")).strip()
    # A shell may keep surrounding quotes when the value is pasted with them.
    uri = uri.strip('"').strip("'")

    if not uri:
        print("MONGO_URL олдсонгүй. backend/.env-д бичих эсвэл аргумент болгон дамжуулна уу.")
        return 1

    print(f"Шалгаж буй: {redact(uri)}\n")

    problems, encoding_issue = inspect(uri)
    for p in problems:
        print(f"  ✗ {p}")

    # Only offer a rewrite when re-encoding is actually the fix.
    suggestion = fixed_uri(uri) if encoding_issue else None
    if suggestion:
        print(f"\n  Зассан хувилбар: {redact(suggestion)}")
        print("  (нууц үг нь зөв encode хийгдсэн — Render дээрх MONGO_URL-ээ үүгээр солино уу)")

    print()
    ok, message = try_connect(uri)
    print(("  ✓ " if ok else "  ✗ ") + message)

    if not ok and suggestion:
        print("\n  Зассан хувилбараар дахин оролдож байна…")
        ok2, message2 = try_connect(suggestion)
        print(("  ✓ " if ok2 else "  ✗ ") + message2)
        if ok2:
            print("\n  → Нууц үгийн encode нь шалтгаан байна. Дээрх зассан мөрийг ашиглана уу.")
            return 0

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

"""Run every offline suite in its own process.

Each suite imports `server` and swaps in an in-memory Mongo, so they must not
share an interpreter — hence subprocesses rather than one pytest session.

    python backend/tests/offline/run_all.py
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUITES = [
    "test_google_auth.py",
    "test_public_config.py",
    "test_qpay_client.py",
    "test_qpay_flow.py",
    "test_bank_flow.py",
    "test_core_flow.py",
    "test_exam_session.py",
    "test_admin_bot.py",
]


def main() -> int:
    failed = []
    for name in SUITES:
        print(f"\n{'=' * 60}\n{name}\n{'=' * 60}")
        proc = subprocess.run(
            [sys.executable, str(HERE / name)],
            env={**__import__("os").environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        out = proc.stdout or ""
        checks = out.count("  ok:")
        if proc.returncode == 0:
            print(f"PASS — {checks} checks" if checks else "PASS")
        else:
            failed.append(name)
            print(out[-3000:])
            print(proc.stderr[-3000:])

    print(f"\n{'=' * 60}")
    if failed:
        print("FAILED:", ", ".join(failed))
        return 1
    print(f"All {len(SUITES)} suites passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

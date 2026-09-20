"""Upscale the question illustrations extracted from the source workbook.

The workbook only embedded 240x150 JPEGs, so the browser had to stretch them
and they looked blurry. The artwork is flat-colour vector-style road diagrams,
which upscales very well: bilateral filtering removes the JPEG ringing, Lanczos
carries the shapes up to 4x, and an unsharp pass restores crisp edges.

The result is written next to the original as `q_<n>.webp` (roughly 14 KB each
at 960x600, i.e. sharper *and* only a little larger than the 240x150 JPEG).
`/api/images/q_<n>.jpg` keeps working — see `serve_question_image` in server.py,
which prefers the WebP rendition.

Usage: python backend/scripts/enhance_images.py [--scale 4] [--quality 92]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

IMAGES = Path(__file__).resolve().parent.parent / "data" / "images"


def unsharp(img, sigma: float, amount: float):
    return cv2.addWeighted(img, 1 + amount, cv2.GaussianBlur(img, (0, 0), sigma), -amount, 0)


def enhance(img, scale: int):
    # 1. knock out the JPEG ringing while keeping the hard edges of the artwork
    clean = cv2.bilateralFilter(img, 7, 45, 45)
    # 2. carry it up with Lanczos, which keeps straight lines straight
    up = cv2.resize(clean, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)
    # 3. flatten the interpolated gradients back into flat colour areas
    up = cv2.bilateralFilter(up, 9, 30, 9)
    # 4. and put the edge contrast back
    return unsharp(up, 2.0, 0.9)


def main() -> int:
    # the Windows console defaults to cp1252, which cannot print the Cyrillic report
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--quality", type=int, default=92)
    ap.add_argument("--force", action="store_true", help="re-render images that already exist")
    args = ap.parse_args()

    sources = sorted(IMAGES.glob("*.jpg"))
    if not sources:
        print(f"Зураг олдсонгүй: {IMAGES}")
        return 1

    written = skipped = 0
    for i, src in enumerate(sources, 1):
        dest = src.with_suffix(".webp")
        if dest.exists() and not args.force:
            skipped += 1
            continue
        img = cv2.imread(str(src))
        if img is None:
            print(f"  уншиж чадсангүй: {src.name}")
            continue
        cv2.imwrite(str(dest), enhance(img, args.scale), [cv2.IMWRITE_WEBP_QUALITY, args.quality])
        written += 1
        if i % 100 == 0:
            print(f"  {i}/{len(sources)}")

    total_mb = sum(p.stat().st_size for p in IMAGES.glob("*.webp")) / 1024 / 1024
    print(f"Бичсэн: {written}, алгассан: {skipped}, нийт webp: {total_mb:.1f}MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

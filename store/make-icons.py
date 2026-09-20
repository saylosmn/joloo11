"""Generate the app icon, adaptive icon, splash mark and favicon.

The mark is a road seen in perspective with a dashed centre line, inside the
app's blue. Geometric, legible at 48px, and nothing borrowed from anyone.
"""
import io
import math
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "assets", "images")

BRAND_TOP = (59, 130, 246)     # #3B82F6
BRAND_BOTTOM = (29, 78, 216)   # #1D4ED8
WHITE = (255, 255, 255, 255)


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size[1]))
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        img.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize(size, Image.BILINEAR)


def road_mark(size, color=WHITE, scale=1.0):
    """Transparent layer with the road glyph centred."""
    S = size
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    cx = S / 2
    top_y = S * (0.5 - 0.30 * scale)
    bot_y = S * (0.5 + 0.34 * scale)
    top_half = S * 0.085 * scale     # half width of the road at the horizon
    bot_half = S * 0.26 * scale      # half width at the bottom

    # Road surface (trapezoid).
    d.polygon(
        [
            (cx - top_half, top_y),
            (cx + top_half, top_y),
            (cx + bot_half, bot_y),
            (cx - bot_half, bot_y),
        ],
        fill=color,
    )

    # Dashed centre line punched back out, narrowing towards the horizon.
    dash_count = 4
    y = bot_y
    gap = (bot_y - top_y) / (dash_count * 2 - 0.5)
    for i in range(dash_count):
        y2 = max(top_y, y - gap)
        t1 = (bot_y - y) / (bot_y - top_y)
        t2 = (bot_y - y2) / (bot_y - top_y)
        w1 = S * 0.035 * scale * (1 - t1 * 0.75)
        w2 = S * 0.035 * scale * (1 - t2 * 0.75)
        d.polygon(
            [(cx - w1, y), (cx + w1, y), (cx + w2, y2), (cx - w2, y2)],
            fill=(0, 0, 0, 0),
        )
        y = y2 - gap * 0.9
        if y <= top_y:
            break

    # Horizon arc above the road, like the curve of the earth / a sign edge.
    r = S * 0.30 * scale
    d.arc(
        [cx - r, top_y - r * 0.62, cx + r, top_y + r * 1.38],
        start=200,
        end=340,
        fill=color,
        width=max(2, int(S * 0.035 * scale)),
    )
    return layer


def rounded_mask(size, radius_ratio=0.2237):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return mask


def make_icon(size=1024):
    bg = vertical_gradient((size, size), BRAND_TOP, BRAND_BOTTOM).convert("RGBA")
    # Soft highlight in the upper-left so the tile is not flat.
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-size * 0.25, -size * 0.45, size * 0.75, size * 0.35], fill=(255, 255, 255, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.06))
    bg.alpha_composite(glow)
    bg.alpha_composite(road_mark(size, scale=0.70))
    return bg


os.makedirs(OUT, exist_ok=True)

# iOS / general icon: square, opaque, rounded by the OS.
icon = make_icon(1024)
icon.convert("RGB").save(os.path.join(OUT, "icon.png"))
print("icon.png")

# Android adaptive foreground: glyph only, inside the 66% safe zone.
adaptive = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
adaptive.alpha_composite(road_mark(1024, scale=0.52))
adaptive.save(os.path.join(OUT, "adaptive-icon.png"))
print("adaptive-icon.png")

# Splash mark: the glyph in brand blue on transparent, so it works on both themes.
splash = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
splash.alpha_composite(road_mark(512, color=(37, 99, 235, 255), scale=0.80))
splash.save(os.path.join(OUT, "splash-image.png"))
print("splash-image.png")

# Web favicon.
fav = make_icon(256)
fav.putalpha(rounded_mask(256))
fav.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, "favicon.png"))
print("favicon.png")

"""Draws docs/banner.png, the README banner, in the layout of the whale widget's
banner (dark ground, light swooshes, a big title with a glowing subtitle, a
lightning underline, a thought bubble) recoloured in Claude's warm tones.

    python tools/banner.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1280, 640
S = 2  # draw at twice the size, then scale down for smooth edges

GROUND = (52, 26, 14)        # deep roast brown
SWOOSH = (240, 168, 120)     # peach
TITLE = (255, 214, 102)      # warm gold
GLOW = (255, 196, 150)       # soft orange glow
SUB = (205, 120, 82)         # muted terracotta
ZAP = (255, 140, 66)         # Claude orange
INK = (40, 20, 12)
CREAM = (255, 248, 238)

FONTS = Path("C:/Windows/Fonts")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size * S)


def swoosh(draw, points, width, color):
    """A thick, round-capped curve through the given points (Catmull-Rom)."""
    pts = []
    for i in range(len(points) - 1):
        p0 = points[max(i - 1, 0)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(i + 2, len(points) - 1)]
        for k in range(24):
            t = k / 24
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            pts.append((x * S, y * S))
    pts.append((points[-1][0] * S, points[-1][1] * S))
    # Stamp round dots densely along the curve: PIL's wide polylines leave
    # notches at every joint, dots give a clean, even ribbon.
    r = width * S / 2
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = max(1, int(math.hypot(x1 - x0, y1 - y0) / 2))
        for k in range(steps + 1):
            x = x0 + (x1 - x0) * k / steps
            y = y0 + (y1 - y0) * k / steps
            draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def glow_text(base, xy, text, fnt, color, glow, radius):
    """Text with a soft neon halo."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((xy[0] * S, xy[1] * S), text, font=fnt, fill=glow + (255,))
    halo = layer.filter(ImageFilter.GaussianBlur(radius * S))
    base.alpha_composite(halo)
    base.alpha_composite(halo)
    ImageDraw.Draw(base).text((xy[0] * S, xy[1] * S), text, font=fnt, fill=color)


def main():
    img = Image.new("RGBA", (W * S, H * S), GROUND + (255,))
    d = ImageDraw.Draw(img)

    # Light swooshes, like the whale banner's: one along the top left, one bottom left, one top right.
    swoosh(d, [(-40, 70), (60, 20), (170, 60), (260, 150), (380, 130), (470, 60)], 34, SWOOSH)
    swoosh(d, [(-30, 470), (50, 520), (95, 600), (110, 680)], 34, SWOOSH)
    swoosh(d, [(1150, -30), (1215, 60), (1300, 110)], 34, SWOOSH)
    # A few small stars.
    for x, y, r in [(560, 110, 5), (930, 70, 4), (640, 560, 4), (1010, 600, 5), (210, 300, 3)]:
        d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), fill=SWOOSH + (200,))

    # Thought bubble at the top, opening into the frame.
    d.ellipse((470 * S, -170 * S, 880 * S, 80 * S), fill=CREAM, outline=ZAP, width=8 * S)
    d.ellipse((585 * S, 112 * S, 655 * S, 152 * S), fill=CREAM, outline=ZAP, width=6 * S)

    # Big title, glowing subtitle, Chinese subtitle.
    title = font("ariblk.ttf", 146)
    d.text((112 * S, 210 * S), "CLAUDE", font=title, fill=TITLE)
    sub = font("ariblk.ttf", 40)
    glow_text(img, (122, 168), "CLAUDE DESKTOP", sub, (255, 236, 200), GLOW, 7)
    zh = font("msyhbd.ttc", 92)
    d.text((118 * S, 394 * S), "额度小桌宠", font=zh, fill=SUB)

    # Lightning underline.
    d.line([(120 * S, 572 * S), (330 * S, 522 * S), (300 * S, 548 * S), (640 * S, 520 * S)],
           fill=ZAP, width=16 * S, joint="curve")
    for x, y in [(120, 572), (640, 520)]:
        d.ellipse(((x - 8) * S, (y - 8) * S, (x + 8) * S, (y + 8) * S), fill=ZAP)

    # Claude-chan on the right, cropped by the bottom edge like the whale girl.
    chan = Image.open(ROOT / "assets" / "claude-chan.png").convert("RGBA")
    scale = (H * 1.18 * S) / chan.height
    chan = chan.resize((int(chan.width * scale), int(chan.height * scale)), Image.LANCZOS)
    # A soft warm halo behind her so she separates from the dark ground.
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hx, hy = W * S - chan.width + 40 * S, 70 * S
    shape = Image.new("RGBA", chan.size, GLOW + (0,))
    shape.putalpha(chan.getchannel("A").point(lambda a: 150 if a > 10 else 0))
    halo.alpha_composite(shape, (hx, hy))
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(26 * S)))
    img.alpha_composite(chan, (hx, hy))

    out = img.resize((W, H), Image.LANCZOS).convert("RGB")
    (ROOT / "docs").mkdir(exist_ok=True)
    out.save(ROOT / "docs" / "banner.png", optimize=True)
    print("saved", ROOT / "docs" / "banner.png")


if __name__ == "__main__":
    main()

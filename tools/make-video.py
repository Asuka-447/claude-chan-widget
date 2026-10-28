"""Builds docs/intro.mp4 (and a short docs/intro.gif) from the frames filmed by
tools/film.js (run the widget with CHAN_FILM=<folder> to film them).

    python tools/make-video.py <film folder>

Needs Pillow and imageio-ffmpeg (pip install pillow imageio-ffmpeg).
"""
import glob
import math
import os
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FILM = Path(sys.argv[1])
W, H, FPS = 1280, 720, 30
FADE = 0.35  # seconds of cross-fade between scenes

GROUND = (52, 26, 14)
SWOOSH = (240, 168, 120)
GOLD = (255, 214, 102)
CREAM = (255, 244, 230)
MUTED = (215, 160, 125)
ORANGE = (255, 140, 66)
FONTS = Path("C:/Windows/Fonts")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


ZH_BOLD = font("msyhbd.ttc", 54)
ZH = font("msyh.ttc", 28)
ZH_SMALL = font("msyh.ttc", 24)
EN = font("ariblk.ttf", 22)


# ---- Background: the banner's ground and swooshes, drawn once ----
def make_backdrop():
    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)

    def ribbon(points, width):
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            steps = max(1, int(math.hypot(x1 - x0, y1 - y0) / 2))
            for k in range(steps + 1):
                x = x0 + (x1 - x0) * k / steps
                y = y0 + (y1 - y0) * k / steps
                r = width / 2
                d.ellipse((x - r, y - r, x + r, y + r), fill=SWOOSH)

    def curve(points, n=20):
        out = []
        for i in range(len(points) - 1):
            p0, p1 = points[max(i - 1, 0)], points[i]
            p2, p3 = points[i + 1], points[min(i + 2, len(points) - 1)]
            for k in range(n):
                t = k / n
                out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t
                                        + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                        + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in (0, 1)))
        return out + [points[-1]]

    ribbon(curve([(-40, 60), (60, 20), (170, 55), (250, 130), (360, 115), (440, 55)]), 26)
    ribbon(curve([(-30, 560), (40, 600), (80, 680), (95, 760)]), 26)
    ribbon(curve([(1160, -30), (1220, 50), (1300, 95)]), 26)
    for x, y, r in [(520, 100, 4), (900, 60, 3), (600, 660, 3), (1000, 690, 4)]:
        d.ellipse((x - r, y - r, x + r, y + r), fill=SWOOSH)
    return img


BACKDROP = make_backdrop()


def captioned(title, lines, en=None):
    """The backdrop with a title and a few lines on the left."""
    img = BACKDROP.copy()
    d = ImageDraw.Draw(img)
    y = 230
    if en:
        d.text((90, y - 44), en, font=EN, fill=MUTED)
    d.text((90, y), title, font=ZH_BOLD, fill=GOLD)
    y += 92
    for line in lines:
        d.text((92, y), line, font=ZH, fill=CREAM)
        y += 46
    d.line([(92, y + 14), (300, y + 2), (284, y + 14), (480, y + 4)], fill=ORANGE, width=8, joint="curve")
    return img


# ---- The filmed frames of each scene, by time since the scene started ----
def frames(scene):
    found = []
    for f in glob.glob(str(FILM / f"{scene}-*.png")):
        ms = int(Path(f).stem.split("-")[1])
        found.append((ms / 1000, f))
    return sorted(found)


_cache = {}


def widget_frame(scene, t):
    """Her frame closest before time t, scaled to fit the right of the video."""
    shots = frames(scene)
    path = shots[0][1]
    for at, f in shots:
        if at <= t:
            path = f
    if path not in _cache:
        im = Image.open(path).convert("RGBA")
        scale = 700 / im.height
        _cache[path] = im.resize((int(im.width * scale), 700), Image.LANCZOS)
    return _cache[path]


def with_widget(base, scene, t):
    img = base.copy().convert("RGBA")
    chan = widget_frame(scene, t)
    img.alpha_composite(chan, (W - chan.width - 90, H - chan.height + 10))
    return img.convert("RGB")


# ---- Scenes: (seconds, draw(t) -> frame) ----
banner = Image.open(ROOT / "docs" / "banner.png").convert("RGB").resize((W, int(W / 2)), Image.LANCZOS)


def intro(t):
    # The banner, slowly pushing in, on the ground colour.
    img = Image.new("RGB", (W, H), GROUND)
    zoom = 1 + 0.04 * t / 3.2
    b = banner.resize((int(W * zoom), int(W / 2 * zoom)), Image.LANCZOS)
    img.paste(b, ((W - b.width) // 2, (H - b.height) // 2))
    return img


POP = captioned("气泡分步弹出", ["先冒小泡泡，再冒大泡泡", "文字最后淡入（0.6 倍慢放）"], "POP")
POP_SLOW = 0.6
JELLY = captioned("果冻一样跟着走", ["拖她的时候气泡慢半拍", "被甩开、拉扁，再晃回来"], "JELLY")
MEME = captioned("点气泡出表情包", ["平时显示额度", "点一下换成表情包"], "MEMES")
WORK_STEPS = ["收到，正在想…", "在翻书…读文件", "在写代码", "在跑命令", "做完啦，撒小花！"]


def work(t):
    step = min(len(WORK_STEPS) - 1, int(t / 1.4))
    lines = [("● " if i == step else "    ") + s for i, s in enumerate(WORK_STEPS)]
    img = BACKDROP.copy()
    d = ImageDraw.Draw(img)
    d.text((90, 186), "WORKING WITH CLAUDE", font=EN, fill=MUTED)
    d.text((90, 230), "跟着 Claude 干活", font=ZH_BOLD, fill=GOLD)
    y = 322
    for i, line in enumerate(lines):
        d.text((92, y), line, font=ZH, fill=CREAM if i == step else MUTED)
        y += 46
    return with_widget(img, "work", t)


settings_shot = None
if frames("settings"):
    settings_shot = Image.open(frames("settings")[-1][1]).convert("RGB")


def settings_scene(t):
    img = captioned("右键 → 设置", ["声音、台词、表情包", "工作状态台词、气泡、大小"], "SETTINGS")
    if settings_shot:
        shot = settings_shot
        scale = 600 / shot.height
        shot = shot.resize((int(shot.width * scale), 600), Image.LANCZOS)
        # Slowly scroll down the panel.
        img.paste(shot, (W - shot.width - 90, 60 - int(min(t, 3) * 6)))
    return img


def outro(t):
    img = BACKDROP.copy()
    d = ImageDraw.Draw(img)
    d.text((W // 2, 250), "Claude 娘 · 额度桌宠", font=font("msyhbd.ttc", 64), fill=GOLD, anchor="mm")
    d.text((W // 2, 340), "github.com/Asuka-447/claude-chan-widget", font=font("ariblk.ttf", 30), fill=CREAM, anchor="mm")
    d.text((W // 2, 410), "Claude Desktop → 插件 → 添加插件市场 → Asuka-447/claude-chan-widget",
           font=ZH_SMALL, fill=MUTED, anchor="mm")
    d.text((W // 2, 450), "免费 · 开源 · Windows    粉丝自制，与 Anthropic 无关", font=ZH_SMALL, fill=MUTED, anchor="mm")
    return img


SCENES = [
    (3.2, intro),
    (2.7, lambda t: with_widget(POP, "pop", t * POP_SLOW)),
    (3.2, lambda t: with_widget(JELLY, "jelly", t)),
    (7.4, work),
    (2.6, lambda t: with_widget(MEME, "meme", t)),
    (3.4, settings_scene),
    (4.0, outro),
]


def render():
    """Yield every frame of the video, cross-fading at scene joins."""
    for i, (length, draw) in enumerate(SCENES):
        n = int(length * FPS)
        for k in range(n):
            t = k / FPS
            img = draw(t)
            # Fade in from the previous scene's last frame.
            if i > 0 and t < FADE:
                prev_len, prev_draw = SCENES[i - 1]
                img = Image.blend(prev_draw(prev_len - 1 / FPS), img, t / FADE)
            # Fade from and to black at the very start and end.
            total_left = sum(s for s, _ in SCENES[i + 1:]) + length - t
            edge = min(t if i == 0 else 9, total_left)
            if edge < 0.5:
                img = Image.blend(Image.new("RGB", (W, H)), img, max(0, edge) / 0.5)
            yield img


def main():
    out = ROOT / "docs" / "intro.mp4"
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    enc = subprocess.Popen([
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "medium",
        "-movflags", "+faststart", str(out)
    ], stdin=subprocess.PIPE)
    count = 0
    for img in render():
        enc.stdin.write(img.tobytes())
        count += 1
    enc.stdin.close()
    enc.wait()
    print("mp4", out, count, "frames", f"{os.path.getsize(out) / 1e6:.1f} MB")

    # A short GIF for the README: the jelly and the work scenes, smaller and slower.
    gif = ROOT / "docs" / "intro.gif"
    subprocess.run([
        ffmpeg, "-y", "-loglevel", "error", "-ss", "5.9", "-t", "10.6", "-i", str(out),
        "-vf", "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer",
        str(gif)
    ], check=True)
    print("gif", gif, f"{os.path.getsize(gif) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

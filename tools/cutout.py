"""Cut the front-view chibi out of the reference sheet and make the background transparent."""
import sys
from collections import deque

from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")

# Front view sits in the top-left third of the sheet.
im = im.crop((0, 52, 540, 625))
w, h = im.size
px = im.load()


def is_bg(c):
    # The sheet background is a warm off-white; the floor shadow is a pale grey.
    r, g, b = c
    return min(r, g, b) > 228 and max(r, g, b) - min(r, g, b) < 22


# Flood fill the background from every edge pixel.
bg = [[False] * w for _ in range(h)]
q = deque()
for x in range(w):
    q.extend([(x, 0), (x, h - 1)])
for y in range(h):
    q.extend([(0, y), (w - 1, y)])
while q:
    x, y = q.popleft()
    if not (0 <= x < w and 0 <= y < h) or bg[y][x] or not is_bg(px[x, y]):
        continue
    bg[y][x] = True
    q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

# Keep only the largest connected foreground region (drops the side text and sparkles).
label = [[0] * w for _ in range(h)]
sizes = {}
n = 0
for y in range(h):
    for x in range(w):
        if bg[y][x] or label[y][x]:
            continue
        n += 1
        label[y][x] = n
        q = deque([(x, y)])
        count = 0
        while q:
            cx, cy = q.popleft()
            count += 1
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and not label[ny][nx]:
                    label[ny][nx] = n
                    q.append((nx, ny))
        sizes[n] = count
keep = max(sizes, key=sizes.get)

mask = Image.new("L", (w, h), 0)
mp = mask.load()
for y in range(h):
    for x in range(w):
        if label[y][x] == keep:
            mp[x, y] = 255
# Soften the edge a little so it does not look jagged on dark wallpapers.
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))

out = im.convert("RGBA")
out.putalpha(mask)
out = out.crop(out.getbbox())
out.save(dst)
print("saved", dst, out.size)

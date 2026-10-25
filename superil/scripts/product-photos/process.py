"""Download, crop and prepare Open Food Facts front photos for SUPERIL products (see README.md).

Usage: OFF_IMAGES_JSONL=images.jsonl python3 process.py picks.json OUTDIR
picks.json: {productId: {"code": "...", "imgid": "N", "cutout": bool?, "rot": deg?, "box": [x0,y0,x1,y1]?, "small": bool?}}
Requires: pip install pillow numpy opencv-python-headless
"""
import io, json, os, re, sys, urllib.request
import numpy as np
import cv2
from PIL import Image, ImageDraw

S3 = "https://openfoodfacts-images.s3.eu-west-3.amazonaws.com/data/"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
IMAGES = {}
for line in open(os.environ.get("OFF_IMAGES_JSONL", os.path.join(HERE, "images.jsonl"))):
    r = json.loads(line)
    IMAGES[r["code"]] = r["images"]
# Packaging shape per product id, read from the catalog source.
CATALOG = {
    m.group(1): {"shape": m.group(2)}
    for m in re.finditer(r'^\s*\["([^"]+)",(?:[^,]*,){6} "(\w+)"', open(os.path.join(ROOT, "src/data/seed-products.ts")).read(), re.M)
}
ROUND = {"bottle", "can", "jar", "tub"}


def code_path(code):
    if len(code) > 8:
        c = code.zfill(13)
        return f"{c[0:3]}/{c[3:6]}/{c[6:9]}/{c[9:]}"
    return code


def fetch(url, cache):
    if not os.path.exists(cache):
        with urllib.request.urlopen(url, timeout=90) as r:
            open(cache, "wb").write(r.read())
    return open(cache, "rb").read()


def selected_front(code):
    imgs = IMAGES.get(code) or {}
    sel = (imgs.get("selected") or {}).get("front") or {}
    for lang in ("he", "en", "ar", "fr"):
        if lang in sel:
            return sel[lang], lang
    if sel:
        k = next(iter(sel))
        return sel[k], k
    return None, None


def uploader(code, imgid):
    up = ((IMAGES.get(code) or {}).get("uploaded") or {}).get(str(imgid)) or {}
    return up.get("uploader")


def load_front(code, imgid=None, small=False):
    """Returns (PIL image RGB, imgid, cropped_by_off)."""
    sel, _ = selected_front(code)
    gen = {}
    if imgid is None:
        if not sel:
            raise RuntimeError(f"{code}: no selected front, pass imgid")
        imgid = sel["imgid"]
        gen = sel.get("generation") or {}
    elif sel and str(sel.get("imgid")) == str(imgid):
        gen = sel.get("generation") or {}
    os.makedirs(os.path.join(HERE, "raw"), exist_ok=True)  # download cache (not committed)
    suffix = ".400.jpg" if small else ".jpg"
    data = fetch(f"{S3}{code_path(code)}/{imgid}{suffix}", os.path.join(HERE, "raw", f"{code}_{imgid}{suffix}"))
    im = Image.open(io.BytesIO(data)).convert("RGB")
    angle = int(float(gen.get("angle") or 0))
    if angle:
        im = im.rotate(-angle, expand=True)
    cropped = False
    try:
        x1, y1, x2, y2 = (float(gen.get(k, -1)) for k in ("x1", "y1", "x2", "y2"))
    except (TypeError, ValueError):
        x1 = y1 = x2 = y2 = -1
    if x1 >= 0 and x2 > x1 + 5 and y2 > y1 + 5:
        if (gen.get("coordinates_image_size") or "400") != "full":
            sc = max(im.size) / 400.0
            x1, y1, x2, y2 = (v * sc for v in (x1, y1, x2, y2))
        im = im.crop((int(x1), int(y1), int(x2), int(y2)))
        cropped = True
    return im, str(imgid), cropped


def grabcut_alpha(rgb):
    """Foreground mask for a product photographed on a (mostly) plain background."""
    a = np.array(rgb)[:, :, ::-1].copy()
    h, w = a.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    m = max(2, int(min(h, w) * 0.015))
    rect = (m, m, w - 2 * m, h - 2 * m)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(a, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    # keep the largest component, fill holes
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(labels == big, 255, 0).astype(np.uint8)
    inv = 255 - fg
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n2):
        x, y, ww, hh, area = st2[i]
        if x > 0 and y > 0 and x + ww < w and y + hh < h:
            fg[lab2 == i] = 255
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return fg


def symmetric_profile(alpha, rows=32):
    """Half-width of the silhouette per row (bottom → top), normalized to the image width."""
    h, w = alpha.shape
    prof = []
    for i in range(rows):
        y0 = int(h - (i + 1) * h / rows)
        y1 = int(h - i * h / rows)
        band = alpha[max(0, y0):max(y0 + 1, y1)]
        cols = np.where(band.max(axis=0) > 127)[0]
        if len(cols) == 0:
            prof.append(0.0)
            continue
        prof.append(round(float((cols[-1] - cols[0] + 1) / 2 / w), 4))
    return prof


def side_color(rgb, alpha=None):
    a = np.array(rgb).astype(np.float32)
    h, w = a.shape[:2]
    k = max(2, w // 25)
    edge = np.concatenate([a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3)])
    if alpha is not None:
        al = np.concatenate([alpha[:, :k].reshape(-1), alpha[:, -k:].reshape(-1)])
        if (al > 127).sum() > 20:
            edge = edge[al > 127]
    c = np.median(edge, axis=0)
    return "#%02x%02x%02x" % tuple(int(v) for v in c)


def process(pid, pick, outdir):
    p = CATALOG[pid]
    im, imgid, cropped = load_front(pick["code"], pick.get("imgid"), pick.get("small", False))
    if pick.get("rot"):
        im = im.rotate(-int(pick["rot"]), expand=True)
    if pick.get("box"):
        fx0, fy0, fx1, fy1 = pick["box"]
        im = im.crop((int(fx0 * im.width), int(fy0 * im.height), int(fx1 * im.width), int(fy1 * im.height)))
    # normalize size
    max_h = 512
    if im.height > max_h:
        im = im.resize((max(1, round(im.width * max_h / im.height)), max_h), Image.LANCZOS)
    if im.width > 512:
        im = im.resize((512, max(1, round(im.height * 512 / im.width))), Image.LANCZOS)
    cutout = pick.get("cutout")
    if cutout is None:
        cutout = p["shape"] in ROUND
    rec = {"code": pick["code"], "imgid": imgid, "uploader": uploader(pick["code"], imgid), "offCropped": cropped}
    if cutout:
        alpha = grabcut_alpha(im)
        ys, xs = np.where(alpha > 127)
        if len(xs) < 50:
            raise RuntimeError(f"{pid}: empty cutout")
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        im = im.crop((x0, y0, x1, y1))
        alpha = alpha[y0:y1, x0:x1]
        alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
        rgba = im.copy()
        rgba.putalpha(Image.fromarray(alpha))
        rec.update(cutout=True, profile=symmetric_profile(alpha), side=side_color(im, alpha))
        out = rgba
    else:
        rec.update(cutout=False, side=side_color(im))
        if p["shape"] in ROUND:
            rec["profile"] = [0.48] * 32  # plain cylinder carrying the photo
        out = im
    rec["aspect"] = round(out.width / out.height, 4)
    os.makedirs(outdir, exist_ok=True)
    out.save(os.path.join(outdir, f"{pid}.webp"), "WEBP", quality=82, method=6)
    return rec, out


def checker(size, s=12):
    w, h = size
    bg = Image.new("RGB", size, "#ffffff")
    d = ImageDraw.Draw(bg)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill="#cccccc")
    return bg


if __name__ == "__main__":
    picks = json.load(open(sys.argv[1]))
    outdir = sys.argv[2]
    manifest_path = os.path.join(HERE, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    thumbs = []
    for pid, pick in picks.items():
        try:
            rec, out = process(pid, pick, outdir)
        except Exception as e:  # noqa
            print("FAIL", pid, e)
            continue
        manifest[pid] = rec
        t = out.copy()
        t.thumbnail((200, 200))
        bg = checker(t.size)
        if t.mode == "RGBA":
            bg.paste(t, (0, 0), t)
        else:
            bg.paste(t, (0, 0))
        thumbs.append((pid, bg))
        print("ok", pid, rec["aspect"], rec.get("cutout"))
    json.dump(manifest, open(manifest_path, "w"), ensure_ascii=False, indent=1)
    if thumbs:
        cell = 210
        cols = 7
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * (cell + 16)), "#555")
        d = ImageDraw.Draw(sheet)
        for i, (pid, t) in enumerate(thumbs):
            x = (i % cols) * cell
            y = (i // cols) * (cell + 16)
            sheet.paste(t, (x + (cell - t.width) // 2, y + 16))
            d.text((x + 3, y + 2), pid, fill="white")
        sheet.save(os.path.join(HERE, "review.png"))

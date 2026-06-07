#!/usr/bin/env python3
"""Generate all local PNG assets for bingo-caller.html, fully offline (Pillow).

  assets/assyrian-flag.png   The Assyrian flag (star + wavy rays + Ashur).
  assets/lamassu-bg.png      Navy stone banner with two gold-lit Lamassu reliefs.
  assets/shamash-emblem.png  Silver Shamash sun-star medallion (transparent).
"""
import math
import random
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

random.seed(7)
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "assets")
os.makedirs(OUT, exist_ok=True)

GOLD = (212, 168, 70)
GOLD_HI = (255, 222, 130)
RED = (200, 16, 46)
BLUE = (20, 52, 120)
NAVY = (22, 42, 86)


def shift(img, dx, dy):
    return ImageChops.offset(img, dx, dy)


# ===========================================================================
# 1) Assyrian flag
# ===========================================================================
def wavy_band(d, cx, cy, ang, length, w0, w1, amp, freq, color, steps=60):
    """Draw a tapering, undulating band from centre outwards along `ang`."""
    ca, sa = math.cos(ang), math.sin(ang)
    pa, pb = math.cos(ang + math.pi / 2), math.sin(ang + math.pi / 2)
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        bx = cx + ca * length * t
        by = cy + sa * length * t
        off = amp * math.sin(t * freq * math.pi) * t          # wobble grows outward
        w = (w0 + (w1 - w0) * t) / 2
        left.append((bx + pa * (off + w), by + pb * (off + w)))
        right.append((bx + pa * (off - w), by + pb * (off - w)))
    d.polygon(left + right[::-1], fill=color)


def ashur_symbol(d, cx, cy, s, color):
    """Stylized winged sun-disk (the god Ashur) in `color`."""
    # wings
    for sign in (-1, 1):
        pts = [(cx, cy)]
        for k in range(4):
            pts.append((cx + sign * s * (0.5 + k * 0.45),
                        cy - s * 0.18 + (k % 2) * s * 0.16))
            pts.append((cx + sign * s * (0.5 + k * 0.45),
                        cy + s * 0.10 + (k % 2) * s * 0.10))
        d.polygon(pts, fill=color)
    # central disk + tail
    d.ellipse([cx - s * 0.42, cy - s * 0.42, cx + s * 0.42, cy + s * 0.42], fill=color)
    d.polygon([(cx - s * 0.18, cy), (cx + s * 0.18, cy),
               (cx + s * 0.34, cy + s * 1.1), (cx - s * 0.34, cy + s * 1.1)], fill=color)


def build_flag():
    W, H = 660, 440
    img = Image.new("RGBA", (W, H), (252, 252, 250, 255))   # white field
    big = 3
    flag = Image.new("RGBA", (W * big, H * big), (252, 252, 250, 255))
    d = ImageDraw.Draw(flag)
    cx, cy = W * big / 2, H * big / 2
    L = math.hypot(cx, cy)

    # four rays to the corners, each = blue (outer) / gold / red (inner)
    for corner in (math.atan2(-cy, -cx), math.atan2(-cy, cx),
                   math.atan2(cy, -cx), math.atan2(cy, cx)):
        wavy_band(d, cx, cy, corner, L, 26 * big, 150 * big, 26 * big, 4, BLUE)
        wavy_band(d, cx, cy, corner, L, 18 * big, 96 * big, 22 * big, 4, GOLD)
        wavy_band(d, cx, cy, corner, L, 10 * big, 50 * big, 18 * big, 4, RED)

    # central four-pointed star (gold) with concave sides
    star = []
    for k in range(8):
        a = math.radians(k * 45 - 90)
        r = 150 * big if k % 2 == 0 else 52 * big
        star.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(star, fill=GOLD_HI)
    # inner star outline / disk
    d.polygon([(cx + (130 * big if k % 2 == 0 else 44 * big) * math.cos(math.radians(k * 45 - 90)),
                cy + (130 * big if k % 2 == 0 else 44 * big) * math.sin(math.radians(k * 45 - 90)))
               for k in range(8)], outline=GOLD, width=4 * big)
    d.ellipse([cx - 46 * big, cy - 46 * big, cx + 46 * big, cy + 46 * big],
              fill=(245, 200, 70, 255), outline=GOLD, width=3 * big)

    # Ashur above the star
    ashur_symbol(d, cx, cy - 130 * big, 46 * big, GOLD)

    flag = flag.resize((W, H), Image.LANCZOS)
    img = Image.alpha_composite(img, flag)

    # subtle frame so it reads as a badge on dark header
    fr = ImageDraw.Draw(img)
    fr.rectangle([0, 0, W - 1, H - 1], outline=(*GOLD, 230), width=4)
    img.save(os.path.join(OUT, "assyrian-flag.png"))
    print("wrote assyrian-flag.png", img.size)


# ===========================================================================
# 2) Lamassu banner  (navy stone, gold-lit relief)
# ===========================================================================
def lamassu_mask(W, H, facing_right=True):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    F = 255

    d.rounded_rectangle([70, 215, 360, 350], radius=46, fill=F)
    d.ellipse([40, 205, 200, 360], fill=F)
    d.ellipse([300, 210, 410, 360], fill=F)
    for lx in (78, 150, 300, 366):
        d.rounded_rectangle([lx, 338, lx + 30, 428], radius=8, fill=F)
    for lx in (74, 146, 296, 362):
        d.rounded_rectangle([lx, 420, lx + 38, 432], radius=4, fill=F)

    d.polygon([(320, 230), (404, 222), (430, 120), (350, 130)], fill=F)
    d.ellipse([372, 70, 452, 156], fill=F)
    d.polygon([(440, 95), (470, 110), (452, 140)], fill=F)
    d.polygon([(372, 130), (452, 134), (446, 250), (430, 268),
               (392, 262), (382, 220)], fill=F)
    for by in (170, 200, 230):
        d.ellipse([384, by, 446, by + 30], fill=F)
    d.rounded_rectangle([374, 36, 452, 78], radius=6, fill=F)
    d.rounded_rectangle([384, 14, 442, 44], radius=6, fill=F)
    d.polygon([(372, 60), (392, 20), (398, 60)], fill=F)
    d.polygon([(452, 60), (434, 20), (428, 60)], fill=F)

    ridges = Image.new("L", (W, H), 0)
    rd = ImageDraw.Draw(ridges)
    d.polygon([(150, 230), (175, 165), (250, 105), (322, 70), (350, 96),
               (330, 150), (288, 185), (240, 205), (190, 225)], fill=F)
    for i in range(4):
        t = i / 3.0
        ax, ay = 175 + t * 150, 210 - t * 120
        bx, by = 330 + t * 18, 150 - t * 110
        rd.line([(ax, ay), (bx, by)], fill=160, width=5)
        for s in range(5):
            u = s / 4.0
            fx = ax + (bx - ax) * u
            fy = ay + (by - ay) * u
            d.ellipse([fx - 12, fy - 12, fx + 12, fy + 12], fill=F)

    m = m.filter(ImageFilter.GaussianBlur(0.8))
    m = m.point(lambda p: 255 if p > 110 else 0)
    ridges = ridges.filter(ImageFilter.GaussianBlur(0.8))
    if not facing_right:
        m = m.transpose(Image.FLIP_LEFT_RIGHT)
        ridges = ridges.transpose(Image.FLIP_LEFT_RIGHT)
    return m, ridges


def navy_stone(W, H):
    base = Image.new("RGB", (W, H), NAVY)
    noise = Image.effect_noise((W, H), 14).convert("L").convert("RGB")
    base = Image.blend(base, ImageChops.overlay(base, noise), 0.6)
    coarse = (Image.effect_noise((max(1, W // 12), max(1, H // 12)), 40)
              .resize((W, H)).filter(ImageFilter.GaussianBlur(4))
              .convert("L").convert("RGB"))
    base = Image.blend(base, ImageChops.overlay(base, coarse), 0.4)
    # gentle top light
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), int(40 * (1 - y / H)))
    grad = grad.resize((W, H))
    light = Image.new("RGB", (W, H), (90, 120, 200))
    base = Image.composite(light, base, grad).point(lambda p: p)  # noop guard
    base = Image.blend(Image.new("RGB", (W, H), NAVY), base, 1.0)
    # re-apply: simple highlight blend
    base = ImageChops.add(base, Image.composite(
        Image.new("RGB", (W, H), (26, 34, 64)), Image.new("RGB", (W, H), (0, 0, 0)), grad))
    return base


def carve_gold(stone, mask, ridges):
    W, H = stone.size
    lighter = ImageEnhance.Brightness(stone).enhance(1.22)
    stone = Image.composite(lighter, stone, mask)
    hi = ImageChops.subtract(mask, shift(mask, 5, 5)).filter(ImageFilter.GaussianBlur(1.3))
    lo = ImageChops.subtract(mask, shift(mask, -5, -5)).filter(ImageFilter.GaussianBlur(1.3))
    gold_layer = Image.new("RGB", (W, H), (224, 184, 96))
    dark_layer = Image.new("RGB", (W, H), (8, 16, 40))
    stone = Image.composite(gold_layer, stone, hi.point(lambda p: int(p * 0.85)))
    stone = Image.composite(dark_layer, stone, lo.point(lambda p: int(p * 0.9)))
    stone = Image.composite(dark_layer, stone, ridges.point(lambda p: int(p * 0.55)))
    return stone


def build_lamassu():
    W, H = 1600, 520
    stone = navy_stone(W, H)
    LW, LH = 480, 460
    yoff = H - LH - 10

    mL, rL = lamassu_mask(LW, LH, True)
    maskL = Image.new("L", (W, H), 0); ridL = Image.new("L", (W, H), 0)
    maskL.paste(mL, (50, yoff)); ridL.paste(rL, (50, yoff))
    stone = carve_gold(stone, maskL, ridL)

    mR, rR = lamassu_mask(LW, LH, False)
    maskR = Image.new("L", (W, H), 0); ridR = Image.new("L", (W, H), 0)
    maskR.paste(mR, (W - LW - 50, yoff)); ridR.paste(rR, (W - LW - 50, yoff))
    stone = carve_gold(stone, maskR, ridR)

    out = stone.convert("P", palette=Image.ADAPTIVE, colors=128)
    out.save(os.path.join(OUT, "lamassu-bg.png"), optimize=True)
    print("wrote lamassu-bg.png", stone.size)


# ===========================================================================
# 3) Shamash emblem  (unchanged silver medallion)
# ===========================================================================
def radial_silver(size, cx, cy, r, c_in, c_out):
    img = Image.new("RGB", (size, size), c_out)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = min(1.0, math.hypot(x - cx, y - cy) / r)
            px[x, y] = tuple(int(c_in[i] + (c_out[i] - c_in[i]) * t) for i in range(3))
    return img


def build_shamash():
    S = 640
    cx = cy = S / 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    SILVER_IN = (248, 250, 255); SILVER_MID = (196, 204, 218); SILVER_LO = (120, 130, 150)

    star = Image.new("L", (S, S), 0); sd = ImageDraw.Draw(star)
    r_long, r_short, r_base = S * 0.46, S * 0.30, S * 0.12
    pts = []
    for k in range(8):
        a_tip = math.radians(k * 45 - 90)
        r_tip = r_long if k % 2 == 0 else r_short
        a_l = math.radians(k * 45 - 90 - 22.5); a_r = math.radians(k * 45 - 90 + 22.5)
        pts += [(cx + r_base * math.cos(a_l), cy + r_base * math.sin(a_l)),
                (cx + r_tip * math.cos(a_tip), cy + r_tip * math.sin(a_tip)),
                (cx + r_base * math.cos(a_r), cy + r_base * math.sin(a_r))]
    sd.polygon(pts, fill=255)
    img.paste(radial_silver(S, int(cx), int(cy - S * 0.05), int(r_long), SILVER_IN, SILVER_LO),
              (0, 0), star)
    for k in range(8):
        a = math.radians(k * 45 - 90)
        r_tip = r_long if k % 2 == 0 else r_short
        d.line([(cx, cy), (cx + r_tip * math.cos(a), cy + r_tip * math.sin(a))],
               fill=(90, 100, 120, 120), width=2)
    for k in range(8):
        a = math.radians(k * 45 - 90 + 22.5)
        for j, rr in enumerate((r_short * 0.95, r_short * 1.12)):
            wob = 10 if j == 0 else -10
            x0 = cx + r_base * 1.2 * math.cos(a); y0 = cy + r_base * 1.2 * math.sin(a)
            x1 = cx + rr * math.cos(a) + wob * math.cos(a + math.pi / 2)
            y1 = cy + rr * math.sin(a) + wob * math.sin(a + math.pi / 2)
            d.line([(x0, y0), (x1, y1)], fill=(*SILVER_MID, 200), width=4)
    r_disk = S * 0.20
    dmask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(dmask).ellipse([cx - r_disk, cy - r_disk, cx + r_disk, cy + r_disk], fill=255)
    img.paste(radial_silver(S, int(cx - r_disk * 0.3), int(cy - r_disk * 0.3),
                            int(r_disk * 1.6), SILVER_IN, SILVER_MID), (0, 0), dmask)
    d.ellipse([cx - r_disk, cy - r_disk, cx + r_disk, cy + r_disk], outline=GOLD, width=8)
    d.ellipse([cx - r_disk + 8, cy - r_disk + 8, cx + r_disk - 8, cy + r_disk - 8],
              outline=GOLD_HI, width=2)
    rb = r_disk * 0.42
    bmask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(bmask).ellipse([cx - rb, cy - rb, cx + rb, cy + rb], fill=255)
    img.paste(radial_silver(S, int(cx - rb * 0.4), int(cy - rb * 0.4), int(rb * 2),
                            SILVER_IN, SILVER_LO), (0, 0), bmask)
    d.ellipse([cx - rb, cy - rb, cx + rb, cy + rb], outline=GOLD, width=4)
    r_ring = S * 0.485
    d.ellipse([cx - r_ring, cy - r_ring, cx + r_ring, cy + r_ring], outline=(*GOLD, 90), width=3)
    img.save(os.path.join(OUT, "shamash-emblem.png"))
    print("wrote shamash-emblem.png", img.size)


if __name__ == "__main__":
    build_flag()
    build_lamassu()
    build_shamash()

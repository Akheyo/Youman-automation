#!/usr/bin/env python3
"""Generate the two PNG assets used by bingo-caller.html, fully offline.

  assets/lamassu-bg.png      Horizontal stone banner with two Lamassu reliefs.
  assets/shamash-emblem.png  Silver Shamash sun-star medallion (transparent).

Procedural / Pillow only -- no external images or network.
"""
import math
import random
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

random.seed(42)
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "assets")
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def shift(img, dx, dy):
    return ImageChops.offset(img, dx, dy)


def lamassu_mask(W, H, facing_right=True):
    """Return ('L' silhouette, 'L' ridge-detail) of a stylized winged-bull.

    Drawn facing right (human head toward the right edge); mirrored on request.
    Anatomy: bull body + four legs, tall neck, bearded human head under a
    tiered horned polos crown, and a large layered wing sweeping up behind.
    """
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    F = 255

    # --- bull body ---------------------------------------------------------
    d.rounded_rectangle([70, 215, 360, 350], radius=46, fill=F)   # torso
    d.ellipse([40, 205, 200, 360], fill=F)                        # hindquarter
    d.ellipse([300, 210, 410, 360], fill=F)                       # chest

    # legs (front pair stepping forward, characteristic of reliefs)
    for lx in (78, 150, 300, 366):
        d.rounded_rectangle([lx, 338, lx + 30, 428], radius=8, fill=F)
    # hooves
    for lx in (74, 146, 296, 362):
        d.rounded_rectangle([lx, 420, lx + 38, 432], radius=4, fill=F)

    # --- neck & human head -------------------------------------------------
    d.polygon([(320, 230), (404, 222), (430, 120), (350, 130)], fill=F)  # neck
    d.ellipse([372, 70, 452, 156], fill=F)                                # head
    d.polygon([(440, 95), (470, 110), (452, 140)], fill=F)               # face/nose

    # square Assyrian beard, stepped, hanging to the chest
    d.polygon([(372, 130), (452, 134), (446, 250), (430, 268),
               (392, 262), (382, 220)], fill=F)
    for by in (170, 200, 230):                                            # curl steps
        d.ellipse([384, by, 446, by + 30], fill=F)

    # --- tiered horned polos crown ----------------------------------------
    d.rounded_rectangle([374, 36, 452, 78], radius=6, fill=F)             # lower band
    d.rounded_rectangle([384, 14, 442, 44], radius=6, fill=F)             # upper band
    d.polygon([(372, 60), (392, 20), (398, 60)], fill=F)                  # horn (back)
    d.polygon([(452, 60), (434, 20), (428, 60)], fill=F)                  # horn (front)

    # --- wing: stacked curved feather rows sweeping up & back -------------
    ridges = Image.new("L", (W, H), 0)
    rd = ImageDraw.Draw(ridges)
    # solid wing base
    d.polygon([(150, 230), (175, 165), (250, 105), (322, 70), (350, 96),
               (330, 150), (288, 185), (240, 205), (190, 225)], fill=F)
    # feather rows (carved ridges + extend silhouette with scalloped tips)
    for i in range(4):
        t = i / 3.0
        ax = 175 + t * 150
        ay = 210 - t * 120
        bx = 330 + t * 18
        by = 150 - t * 110
        rd.line([(ax, ay), (bx, by)], fill=140, width=4)
        # scalloped feather tips along the row
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


def stone_base(W, H):
    """Warm limestone texture with mottling, striations and a vignette."""
    base = Image.new("RGB", (W, H), (190, 178, 154))

    fine = Image.effect_noise((W, H), 22).convert("L").convert("RGB")
    base = ImageChops.overlay(base, fine)

    coarse = (Image.effect_noise((max(1, W // 10), max(1, H // 10)), 46)
              .resize((W, H)).filter(ImageFilter.GaussianBlur(3))
              .convert("L").convert("RGB"))
    base = ImageChops.overlay(base, coarse)

    # faint horizontal striations (sedimentary feel)
    d = ImageDraw.Draw(base, "RGBA")
    for _ in range(26):
        y = random.randint(0, H)
        a = random.randint(8, 22)
        d.line([(0, y), (W, y)], fill=(120, 108, 92, a), width=random.randint(1, 3))

    # vignette
    vig = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-W * 0.25, -H * 0.5, W * 1.25, H * 1.5], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(W // 8))
    dark = ImageEnhance.Brightness(base).enhance(0.6)
    base = Image.composite(base, dark, vig)
    return base


def carve(stone, mask, ridges):
    """Emboss the silhouette into the stone as a relief."""
    W, H = stone.size
    # recessed (slightly darker) fill inside the silhouette
    darker = ImageEnhance.Brightness(stone).enhance(0.86)
    darker = ImageEnhance.Color(darker).enhance(0.9)
    stone = Image.composite(darker, stone, mask)

    # carved edges: light rim top-left, dark rim bottom-right
    hi = ImageChops.subtract(mask, shift(mask, 4, 4))     # top-left rim
    lo = ImageChops.subtract(mask, shift(mask, -4, -4))   # bottom-right rim
    hi = hi.filter(ImageFilter.GaussianBlur(1.2))
    lo = lo.filter(ImageFilter.GaussianBlur(1.2))

    light_layer = Image.new("RGB", (W, H), (245, 238, 222))
    shadow_layer = Image.new("RGB", (W, H), (70, 60, 46))
    stone = Image.composite(light_layer, stone, hi.point(lambda p: int(p * 0.8)))
    stone = Image.composite(shadow_layer, stone, lo.point(lambda p: int(p * 0.85)))

    # wing ridge shadows
    stone = Image.composite(shadow_layer, stone,
                            ridges.point(lambda p: int(p * 0.5)))
    return stone


# ---------------------------------------------------------------------------
# 1) Lamassu banner
# ---------------------------------------------------------------------------
def build_lamassu():
    W, H = 1600, 520
    stone = stone_base(W, H)

    LW, LH = 480, 460
    yoff = H - LH - 10

    # left lamassu (faces right -> toward center)
    mL, rL = lamassu_mask(LW, LH, facing_right=True)
    maskL = Image.new("L", (W, H), 0)
    ridL = Image.new("L", (W, H), 0)
    maskL.paste(mL, (40, yoff))
    ridL.paste(rL, (40, yoff))
    stone = carve(stone, maskL, ridL)

    # right lamassu (faces left -> toward center)
    mR, rR = lamassu_mask(LW, LH, facing_right=False)
    maskR = Image.new("L", (W, H), 0)
    ridR = Image.new("L", (W, H), 0)
    maskR.paste(mR, (W - LW - 40, yoff))
    ridR.paste(rR, (W - LW - 40, yoff))
    stone = carve(stone, maskR, ridR)

    # a base/ground band along the bottom
    d = ImageDraw.Draw(stone, "RGBA")
    d.rectangle([0, H - 26, W, H], fill=(60, 50, 38, 70))

    # quantize to keep the banner light-weight while preserving the look
    out = stone.convert("P", palette=Image.ADAPTIVE, colors=128)
    out.save(os.path.join(OUT, "lamassu-bg.png"), optimize=True)
    print("wrote lamassu-bg.png", stone.size)


# ---------------------------------------------------------------------------
# 2) Shamash emblem
# ---------------------------------------------------------------------------
def radial_silver(size, cx, cy, r, c_in, c_out):
    img = Image.new("RGB", (size, size), c_out)
    px = img.load()
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            t = min(1.0, math.hypot(dx, dy) / r)
            px[x, y] = tuple(int(c_in[i] + (c_out[i] - c_in[i]) * t) for i in range(3))
    return img


def build_shamash():
    S = 640
    cx = cy = S / 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    GOLD = (212, 168, 70)
    GOLD_HI = (255, 222, 130)
    SILVER_IN = (248, 250, 255)
    SILVER_MID = (196, 204, 218)
    SILVER_LO = (120, 130, 150)

    # ---- star rays (8-point, cardinals longer) drawn as a mask, then filled
    star = Image.new("L", (S, S), 0)
    sd = ImageDraw.Draw(star)
    r_long = S * 0.46
    r_short = S * 0.30
    r_base = S * 0.12
    pts = []
    for k in range(8):
        a_tip = math.radians(k * 45 - 90)
        r_tip = r_long if k % 2 == 0 else r_short
        a_l = math.radians(k * 45 - 90 - 22.5)
        a_r = math.radians(k * 45 - 90 + 22.5)
        pts.append((cx + r_base * math.cos(a_l), cy + r_base * math.sin(a_l)))
        pts.append((cx + r_tip * math.cos(a_tip), cy + r_tip * math.sin(a_tip)))
        pts.append((cx + r_base * math.cos(a_r), cy + r_base * math.sin(a_r)))
    sd.polygon(pts, fill=255)

    # silver gradient fill for the star
    silver = radial_silver(S, int(cx), int(cy - S * 0.05), int(r_long),
                           SILVER_IN, SILVER_LO)
    img.paste(silver, (0, 0), star)

    # ray separators (subtle dark) for facet definition
    for k in range(8):
        a = math.radians(k * 45 - 90)
        r_tip = r_long if k % 2 == 0 else r_short
        d.line([(cx, cy), (cx + r_tip * math.cos(a), cy + r_tip * math.sin(a))],
               fill=(90, 100, 120, 120), width=2)

    # ---- wavy rays between the points (classic sun disk)
    for k in range(8):
        a = math.radians(k * 45 - 90 + 22.5)
        for j, rr in enumerate((r_short * 0.95, r_short * 1.12)):
            wob = 10 if j == 0 else -10
            x0 = cx + r_base * 1.2 * math.cos(a)
            y0 = cy + r_base * 1.2 * math.sin(a)
            x1 = cx + rr * math.cos(a) + wob * math.cos(a + math.pi / 2)
            y1 = cy + rr * math.sin(a) + wob * math.sin(a + math.pi / 2)
            d.line([(x0, y0), (x1, y1)], fill=(*SILVER_MID, 200), width=4)

    # ---- central medallion disk
    r_disk = S * 0.20
    disk = radial_silver(S, int(cx - r_disk * 0.3), int(cy - r_disk * 0.3),
                         int(r_disk * 1.6), SILVER_IN, SILVER_MID)
    dmask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(dmask).ellipse(
        [cx - r_disk, cy - r_disk, cx + r_disk, cy + r_disk], fill=255)
    img.paste(disk, (0, 0), dmask)

    # gold rim around the disk
    d.ellipse([cx - r_disk, cy - r_disk, cx + r_disk, cy + r_disk],
              outline=GOLD, width=8)
    d.ellipse([cx - r_disk + 8, cy - r_disk + 8, cx + r_disk - 8, cy + r_disk - 8],
              outline=GOLD_HI, width=2)

    # central boss
    rb = r_disk * 0.42
    boss = radial_silver(S, int(cx - rb * 0.4), int(cy - rb * 0.4), int(rb * 2),
                         SILVER_IN, SILVER_LO)
    bmask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(bmask).ellipse([cx - rb, cy - rb, cx + rb, cy + rb], fill=255)
    img.paste(boss, (0, 0), bmask)
    d.ellipse([cx - rb, cy - rb, cx + rb, cy + rb], outline=GOLD, width=4)

    # subtle outer gold ring framing the whole emblem
    r_ring = S * 0.485
    d.ellipse([cx - r_ring, cy - r_ring, cx + r_ring, cy + r_ring],
              outline=(*GOLD, 90), width=3)

    img.save(os.path.join(OUT, "shamash-emblem.png"))
    print("wrote shamash-emblem.png", img.size)


if __name__ == "__main__":
    build_lamassu()
    build_shamash()

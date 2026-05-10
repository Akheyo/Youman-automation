"""Generiert das Windows-App-Icon (ICO mit 7 Auflösungen) per Pillow.

Bevorzugt eine vorhandene ``assets/youman_logo.png`` als Quelle. Wenn die
nicht da ist, wird ein einfacher Fallback (abgerundete Navy-Box mit
gelbem Y) gezeichnet.

Aufruf:
    python build/generate_icon.py [zielpfad]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


NAVY = (26, 41, 68, 255)
GELB = (251, 191, 36, 255)


GROESSEN = [16, 24, 32, 48, 64, 128, 256]


def fallback_icon(size: int = 256) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = max(2, size // 8)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=NAVY)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", int(size * 0.7))
    except OSError:
        font = ImageFont.load_default()
    text = "Y"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.04),
        text,
        fill=GELB,
        font=font,
    )
    return img


def quelle_einlesen() -> Image.Image:
    """Sucht eine Logo-PNG im Repo. Fällt auf Fallback zurück."""
    repo_root = Path(__file__).resolve().parent.parent
    kandidaten = [
        repo_root / "assets" / "youman_logo.png",
        repo_root / "data" / "youman_logo.png",
        repo_root / "youman_logo.png",
    ]
    for k in kandidaten:
        if k.is_file():
            try:
                img = Image.open(k).convert("RGBA")
                # Auf 256x256 mit Padding skalieren, Seitenverhältnis erhalten.
                ziel = 256
                w, h = img.size
                skala = min(ziel / w, ziel / h)
                neu_w, neu_h = int(w * skala), int(h * skala)
                resized = img.resize((neu_w, neu_h), Image.LANCZOS)
                canvas = Image.new("RGBA", (ziel, ziel), (0, 0, 0, 0))
                canvas.paste(resized, ((ziel - neu_w) // 2, (ziel - neu_h) // 2), resized)
                print(f"Logo-Quelle: {k}")
                return canvas
            except Exception as exc:
                print(f"Konnte {k} nicht lesen ({exc}), versuche nächste Quelle.")
    print("Keine Logo-Quelle gefunden, nutze Fallback.")
    return fallback_icon(256)


def main(ziel: str = "icon.ico") -> None:
    quelle = quelle_einlesen()
    out = Path(ziel)
    out.parent.mkdir(parents=True, exist_ok=True)
    quelle.save(out, format="ICO", sizes=[(g, g) for g in GROESSEN])
    print(f"Icon geschrieben: {out} ({len(GROESSEN)} Auflösungen)")


if __name__ == "__main__":
    z = sys.argv[1] if len(sys.argv) > 1 else "icon.ico"
    main(z)

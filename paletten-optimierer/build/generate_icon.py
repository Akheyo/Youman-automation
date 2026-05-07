"""Generiert das App-Icon (ICO mit 7 Auflösungen) per Pillow.

Aufruf::

    python build/generate_icon.py [zielpfad]

Das Icon zeigt eine abgerundete Navy-Box mit einem Karton-Symbol und einem
gelben Klebeband-Streifen.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw


NAVY = (26, 41, 68, 255)
GELB = (251, 191, 36, 255)
KARTON_HELL = (217, 195, 156, 255)
KARTON_DUNKEL = (181, 156, 116, 255)
WHITE = (255, 255, 255, 255)


def zeichne_icon(groesse: int) -> Image.Image:
    img = Image.new("RGBA", (groesse, groesse), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = max(2, groesse // 8)
    draw.rounded_rectangle(
        (0, 0, groesse - 1, groesse - 1),
        radius=radius,
        fill=NAVY,
    )

    # Karton (Box) zentriert
    pad = groesse // 5
    box_x0 = pad
    box_y0 = int(groesse * 0.32)
    box_x1 = groesse - pad
    box_y1 = groesse - pad
    draw.rectangle((box_x0, box_y0, box_x1, box_y1), fill=KARTON_HELL, outline=KARTON_DUNKEL, width=max(1, groesse // 64))

    # Klappen-Linie oben
    mitte_x = (box_x0 + box_x1) // 2
    draw.line(((mitte_x, box_y0), (mitte_x, box_y1)), fill=KARTON_DUNKEL, width=max(1, groesse // 64))

    # Klebeband-Streifen
    streifen_h = max(2, groesse // 14)
    streifen_y = (box_y0 + box_y1) // 2 - streifen_h // 2
    draw.rectangle(
        (box_x0 - 2, streifen_y, box_x1 + 2, streifen_y + streifen_h),
        fill=GELB,
    )

    # Kleines Layer-Indikator-Quadrat oben links auf dem Karton
    s = max(2, groesse // 10)
    draw.rectangle(
        (box_x0 + s // 2, box_y0 - s // 2, box_x0 + s // 2 + s, box_y0 + s // 2),
        fill=GELB,
    )

    return img


def main(ziel: str = "icon.ico") -> None:
    groessen = [16, 24, 32, 48, 64, 128, 256]
    quelle = zeichne_icon(256)

    out = Path(ziel)
    out.parent.mkdir(parents=True, exist_ok=True)
    quelle.save(
        out,
        format="ICO",
        sizes=[(g, g) for g in groessen],
    )
    print(f"Icon geschrieben: {out} ({len(groessen)} Auflösungen)")


if __name__ == "__main__":
    ziel = sys.argv[1] if len(sys.argv) > 1 else "icon.ico"
    main(ziel)

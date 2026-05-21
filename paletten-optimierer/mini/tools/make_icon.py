"""Erzeugt eine Multi-Resolution .ico aus einer PNG-Logo-Datei.

Wird im CI-Build genutzt, um aus paletten-optimierer/assets/youman_logo.png
das EXE-Icon zu generieren. Logo ist Breitformat → wird in ein
quadratisches Canvas zentriert.

Aufruf:
    python make_icon.py <src.png> <dest.ico>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main(src: str, dest: str) -> int:
    src_p = Path(src)
    dest_p = Path(dest)
    if not src_p.exists():
        print(f"WARN: {src_p} nicht gefunden, erzeuge Fallback-Icon.",
              file=sys.stderr)
        Image.new("RGBA", (256, 256), (37, 99, 235, 255)).save(dest_p)
        return 0

    logo = Image.open(src_p).convert("RGBA")
    w, h = logo.size
    size = 512
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    # Proportional einpassen (max. 90 % der Canvas)
    scale = min((size * 0.9) / w, (size * 0.9) / h)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    logo_resized = logo.resize((new_w, new_h), Image.LANCZOS)
    pos = ((size - new_w) // 2, (size - new_h) // 2)
    canvas.paste(logo_resized, pos, logo_resized)
    canvas.save(
        dest_p,
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"icon.ico erzeugt aus {src_p} ({w}×{h} → {size}×{size})")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: make_icon.py <src.png> <dest.ico>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))

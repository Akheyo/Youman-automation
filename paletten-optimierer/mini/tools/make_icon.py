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


def _lanczos():
    """Pillow >= 10 nutzt Image.Resampling.LANCZOS; <10 nutzt Image.LANCZOS."""
    try:
        return Image.Resampling.LANCZOS
    except AttributeError:
        return Image.LANCZOS  # type: ignore[attr-defined]


def main(src: str, dest: str) -> int:
    src_p = Path(src).resolve()
    dest_p = Path(dest).resolve()
    print(f"make_icon: src={src_p}", flush=True)
    print(f"make_icon: dest={dest_p}", flush=True)
    print(f"make_icon: PIL/Pillow Version = {Image.__version__}", flush=True)

    if not src_p.exists():
        print(f"WARN: {src_p} nicht gefunden, erzeuge Fallback-Icon.",
              file=sys.stderr, flush=True)
        fb = Image.new("RGBA", (256, 256), (37, 99, 235, 255))
        fb.save(dest_p, format="ICO",
                  sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
        return 0

    logo = Image.open(src_p).convert("RGBA")
    w, h = logo.size
    print(f"make_icon: Logo geladen ({w}×{h})", flush=True)

    size = 512
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    scale = min((size * 0.9) / w, (size * 0.9) / h)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    logo_resized = logo.resize((new_w, new_h), _lanczos())
    pos = ((size - new_w) // 2, (size - new_h) // 2)
    canvas.paste(logo_resized, pos, logo_resized)
    print(f"make_icon: Resized auf {new_w}×{new_h}, eingepasst in {size}×{size}",
          flush=True)

    # Multi-Resolution ICO. Pillow erstellt automatisch alle Größen
    # wenn man sie via 'sizes=' angibt. Bei Fehler: einfaches Single-Size-ICO
    # als Fallback.
    try:
        canvas.save(
            dest_p,
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64),
                    (128, 128), (256, 256)],
        )
        print(f"make_icon: Multi-Resolution ICO gespeichert ({dest_p})",
              flush=True)
    except Exception as exc:
        print(f"make_icon: Multi-Resolution failed ({exc}), "
              f"versuche Single-Size 256×256.", file=sys.stderr, flush=True)
        canvas.resize((256, 256), _lanczos()).save(dest_p, format="ICO")
        print(f"make_icon: Single-Size ICO gespeichert ({dest_p})",
              flush=True)
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: make_icon.py <src.png> <dest.ico>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))

"""Bruecke zu den Engine-Modulen in paletten-optimierer/mini/.

Wir importieren die bestehenden Module 1:1 wieder. Sie behalten ihre
JSON-Persistenz unter ~/.palettenmini/ — sowohl Streamlit-Variante als
auch Desktop-App nutzen denselben Speicherort.
"""
from __future__ import annotations

import sys
from pathlib import Path


def _mini_pfad() -> Path:
    """Findet den 'mini'-Ordner — entweder im Dev-Layout oder im
    PyInstaller-Bundle."""
    # Dev
    p1 = Path(__file__).resolve().parent.parent / "mini"
    if p1.exists():
        return p1
    # Bundle (_MEIPASS) — Module liegen flat
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return Path(meipass)
    return p1


_mini = _mini_pfad()
if str(_mini) not in sys.path:
    sys.path.insert(0, str(_mini))


# Re-exports — alle bestehenden Engines unverändert wiederverwenden
import palettenkatalog as katalog  # noqa: E402
import auftraege  # noqa: E402
import import_excel  # noqa: E402
import optimierer_kern  # noqa: E402
import import_verlauf  # noqa: E402

__all__ = ["katalog", "auftraege", "import_excel", "optimierer_kern",
            "import_verlauf"]

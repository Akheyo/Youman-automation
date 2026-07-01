"""WCAG-Kontrast-Test: alle Vordergrund/Hintergrund-Paare aus dem
Design-System sind kontraststark genug.

Regel:
  Body (< 24 px normal / < 18.5 px bold) -> Ratio >= 4.5:1
  Large Text (>= 24 px normal / >= 18.5 px bold) -> Ratio >= 3.0:1

Formel: WCAG 2.0 relative Luminanz.
"""
from __future__ import annotations

import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))


def _srgb_to_linear(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def _luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r = int(h[0:2], 16); g = int(h[2:4], 16); b = int(h[4:6], 16)
    return (0.2126 * _srgb_to_linear(r)
             + 0.7152 * _srgb_to_linear(g)
             + 0.0722 * _srgb_to_linear(b))


def contrast_ratio(fg: str, bg: str) -> float:
    l1 = _luminance(fg); l2 = _luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# --- Pflicht-Paare aus dem Design-System (Spec §2 Kontrast-Map) ---
PFLICHT = [
    # (Name,                       BG,        FG,        min_ratio)
    ("Primary-Button (BG/Text)",   "#00236E", "#FFFFFF", 4.5),
    ("Primary-Hover (BG/Text)",    "#001A55", "#FFFFFF", 4.5),
    ("Danger-Banner (BG/Text)",    "#DC2626", "#FFFFFF", 3.0),
    ("Success-Text (large)",       "#16A34A", "#FFFFFF", 3.0),
    ("Detail Standard-Zeile",      "#DCFCE7", "#14532D", 4.5),
    ("Detail Sonder-Zeile",        "#FEE2E2", "#7F1D1D", 4.5),
    ("Detail Kombi-Zeile",         "#EFF6FF", "#1E3A8A", 4.5),
    ("Surface (Card BG/Body-Text)","#FFFFFF", "#1F2937", 4.5),
]


def test_pflichtpaare_alle_kontrast_ok():
    """Alle vordefinierten Farb-Paare erreichen ihre Ziel-Ratio."""
    fails = []
    for name, bg, fg, min_ratio in PFLICHT:
        ratio = contrast_ratio(fg, bg)
        if ratio < min_ratio:
            fails.append(
                f"  {name}: {ratio:.2f}:1 < {min_ratio}:1 (BG {bg}, FG {fg})"
            )
    assert not fails, "Kontrast unzureichend:\n" + "\n".join(fails)


def _extract_tokens_from_ui_chrome() -> dict[str, str]:
    """Parst _ui_chrome.py und liest die Farb-Tokens (PRIMARY, STD_BG, etc.).
    So knallt der Test, wenn jemand die Tokens veraendert, ohne den Kontrast
    neu zu pruefen."""
    src = (HIER.parent / "_ui_chrome.py").read_text(encoding="utf-8")
    import re
    tokens = {}
    for name in ("PRIMARY", "PRIMARY_LIGHT", "PRIMARY_TEXT",
                  "DANGER", "DANGER_TEXT", "GREEN", "GREEN_TEXT",
                  "STD_BG", "STD_TEXT", "SON_BG", "SON_TEXT",
                  "KOMBI_BG", "KOMBI_TEXT", "SURFACE", "SURFACE_TEXT",
                  "MUTED"):
        m = re.search(rf'^{name}\s*=\s*"(#[0-9A-Fa-f]{{6}})"', src, re.M)
        if m:
            tokens[name] = m.group(1).upper()
    return tokens


def test_ui_chrome_tokens_haben_alle_pflichtwerte():
    """_ui_chrome.py muss die 8 Pflicht-Farbtokens definieren."""
    tk = _extract_tokens_from_ui_chrome()
    for name in ("PRIMARY", "PRIMARY_LIGHT", "PRIMARY_TEXT",
                  "DANGER", "DANGER_TEXT",
                  "STD_BG", "STD_TEXT",
                  "SON_BG", "SON_TEXT",
                  "KOMBI_BG", "KOMBI_TEXT",
                  "SURFACE", "SURFACE_TEXT"):
        assert name in tk, f"Token {name} fehlt in _ui_chrome.py"


def test_ui_chrome_paare_matchen_kontrast_map():
    """Die _ui_chrome.py-Tokens sind exakt die aus dem Design-System.
    So bleibt der Test-Bezug hart verdrahtet."""
    tk = _extract_tokens_from_ui_chrome()
    assert tk.get("PRIMARY") == "#00236E"
    assert tk.get("PRIMARY_LIGHT") == "#001A55"
    assert tk.get("PRIMARY_TEXT") == "#FFFFFF"
    assert tk.get("DANGER") == "#DC2626"
    assert tk.get("DANGER_TEXT") == "#FFFFFF"
    assert tk.get("STD_BG") == "#DCFCE7"
    assert tk.get("STD_TEXT") == "#14532D"
    assert tk.get("SON_BG") == "#FEE2E2"
    assert tk.get("SON_TEXT") == "#7F1D1D"
    assert tk.get("KOMBI_BG") == "#EFF6FF"
    assert tk.get("KOMBI_TEXT") == "#1E3A8A"
    assert tk.get("SURFACE") == "#FFFFFF"
    assert tk.get("SURFACE_TEXT") == "#1F2937"


def test_report_ratios_ausgeben():
    """Zeigt alle Ratios im Log, damit man sie im CI ablesen kann."""
    for name, bg, fg, min_r in PFLICHT:
        r = contrast_ratio(fg, bg)
        print(f"  {name:32s}  bg={bg} fg={fg}  ratio={r:5.2f}:1  min={min_r}")


if __name__ == "__main__":
    tests = [test_pflichtpaare_alle_kontrast_ok,
             test_ui_chrome_tokens_haben_alle_pflichtwerte,
             test_ui_chrome_paare_matchen_kontrast_map,
             test_report_ratios_ausgeben]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}:\n  {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Kontrast-Tests bestanden.")

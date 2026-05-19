"""Pflicht-Tests für den verifizierten Optimierungskern v2.

Die drei __main__-Selbsttests aus optimierer_kern.py werden hier
1:1 als CI-Pflichttests ausgeführt. Build bricht ab wenn einer
fällt. Zusätzlich: statische Verifikation dass die App den Kern
direkt benutzt (kein Schatten-Code).

Test 3 läuft gegen mini/tests/fixtures/Paletten_DM.xlsx wenn
vorhanden, sonst gegen data/draht_mueller_palettenliste.xlsx
als Surrogat. Beide werden ueber import_excel.importiere()
gelesen (dynamische Header-Erkennung), damit der Test unabhängig
davon ist, in welcher Zeile der Header steht.

Schreibt am Ende selbsttest_status.json fuer das UI-Banner.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import io
import json as _json
import sys
from pathlib import Path

# stdout/stderr auf UTF-8 zwingen (Windows-Default cp1252 verschluckt
# sonst Unicode in assert-Meldungen).
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere, _passt_einzeln  # noqa: E402


# ---------------------------------------------------------------------
# Selbsttest 1 — Cluster -> 1 Standard, deckt alle, einseitig
# ---------------------------------------------------------------------
def test_1_cluster_ein_standard_deckt_alle():
    cluster = [
        {'L': 1520, 'B': 720, 'menge': 1, 'auftrag': 'A', 'name': ''},
        {'L': 1550, 'B': 700, 'menge': 1, 'auftrag': 'B', 'name': ''},
        {'L': 1500, 'B': 750, 'menge': 1, 'auftrag': 'C', 'name': ''},
        {'L': 1530, 'B': 710, 'menge': 1, 'auftrag': 'D', 'name': ''},
    ]
    r = optimiere(cluster, tol_mm=200, kombinieren=False)
    print(f"\n  Cluster: {r['standards']} | Sonder: {r['sonder']} "
          f"| invariante_ok: {r['invariante_ok']}")
    assert len(r['standards']) == 1, (
        f"erwartet genau 1 Standard, bekam {r['standards']}"
    )
    assert len(r['sonder']) == 0
    assert r['invariante_ok']
    s = r['standards'][0]
    for o in cluster:
        # Standard muss in beiden Maßen >= Last (einseitig)
        assert min(s) >= min(o['L'], o['B']) and max(s) >= max(o['L'], o['B']), (
            f"Standard {s} deckt Last {(o['L'], o['B'])} NICHT physisch ab"
        )


# ---------------------------------------------------------------------
# Selbsttest 2 — Kombi-Fallback: Typ A + Typ B
# ---------------------------------------------------------------------
def test_2_kombi_fallback_a_plus_b():
    base = [
        {'L': 1200, 'B': 800, 'menge': 9, 'auftrag': 'S1', 'name': ''},
        {'L':  400, 'B': 800, 'menge': 9, 'auftrag': 'S2', 'name': ''},
        {'L': 1500, 'B': 700, 'menge': 1, 'auftrag': 'X',  'name': ''},
    ]
    ro = optimiere(base, tol_mm=200, kombinieren=False)
    rk = optimiere(base, tol_mm=200, kombinieren=True)
    tx_o = [z['typ'] for z in ro['zuordnung'] if z['auftrag'] == 'X'][0]
    tx_k = [z for z in rk['zuordnung'] if z['auftrag'] == 'X'][0]
    print(f"\n  X ohne Kombi: {tx_o} | mit Kombi: {tx_k['typ']} -> {tx_k['ziel']}")
    assert tx_o == 'Sonder', (
        f"Ohne Kombi muss X als Sonder ausgewiesen sein, war {tx_o}"
    )
    assert tx_k['typ'] == 'Kombination', (
        f"Mit Kombi muss X als Kombination ausgewiesen sein, war {tx_k['typ']}"
    )
    assert rk['invariante_ok'], "Kombi-Auflösung darf Invariante nicht verletzen"
    # Format "TypA + TypB" muss aus mind. 2 Maßen bestehen
    assert " + " in tx_k['ziel'], (
        f"Kombi-Ziel sollte 'TypA + TypB' enthalten, war {tx_k['ziel']!r}"
    )


# ---------------------------------------------------------------------
# Selbsttest 3 — echte Datei T=200 (oder Surrogat), invariante_ok
# ---------------------------------------------------------------------
def _finde_test_datei() -> Path:
    """Bevorzugt: tests/fixtures/Paletten_DM.xlsx (echte Datei).
    Surrogat: data/draht_mueller_palettenliste.xlsx im Repo."""
    real = HIER / "fixtures" / "Paletten_DM.xlsx"
    if real.exists():
        return real
    surrogat = HIER.parent.parent / "data" / "draht_mueller_palettenliste.xlsx"
    return surrogat


def _lade_aus_excel(pfad: Path) -> list[dict]:
    """Liest Excel ueber den Mini-Importer (dynamische Header-Erkennung)
    und konvertiert in das Kern-Format {L, B, menge, auftrag, name}."""
    dat = importiere(pfad)
    return [
        {'L': p['laenge'], 'B': p['breite'], 'menge': p['anzahl'],
         'auftrag': p['auftrag'], 'name': p['name']}
        for p in dat['mit_mass']
    ]


def test_3_echte_datei_invariante_ok():
    pfad = _finde_test_datei()
    assert pfad.exists(), f"Keine Test-Datei gefunden: {pfad}"
    print(f"\n  Test-Datei: {pfad.name}")
    ords = _lade_aus_excel(pfad)
    assert len(ords) > 0, "Keine Aufträge mit Maß in der Datei"
    print(f"  Aufträge mit Maß: {len(ords)}")

    for T in (100, 200):
        rr = optimiere(ords, tol_mm=T, kombinieren=True)
        print(f"  T={T}: Std={len(rr['standards'])} "
              f"Sonder={len(rr['sonder'])} Gesamt={rr['gesamt']} "
              f"invariante_ok={rr['invariante_ok']} "
              f"Verletzungen={len(rr['verletzungen'])}")
        assert rr['invariante_ok'], (
            f"T={T}: PHYSIKALISCHE INVARIANTE VERLETZT, "
            f"{len(rr['verletzungen'])} Verletzungen — der Kern darf "
            f"NIE eine Zuordnung liefern, bei der Last > Standard ist."
        )


# ---------------------------------------------------------------------
# Strukturtest — App nutzt den Kern direkt, kein Schatten-Code
# ---------------------------------------------------------------------
def test_app_importiert_kern_direkt():
    """Verifiziere: app_mini.py importiert optimiere() direkt aus
    dem Kern und definiert KEINE eigene optimiere()-Funktion."""
    app_src = (HIER.parent / "app_mini.py").read_text(encoding="utf-8")
    assert "from optimierer_kern import optimiere" in app_src, (
        "app_mini.py importiert optimiere() NICHT aus dem Kern"
    )
    assert "\ndef optimiere(" not in app_src, (
        "app_mini.py definiert eine eigene optimiere()-Funktion — "
        "Kern muss 1:1 verwendet werden, keine Schatten-Impl"
    )


# ---------------------------------------------------------------------
# Runner — sammelt Failures, schreibt selbsttest_status.json
# ---------------------------------------------------------------------
if __name__ == "__main__":
    tests = [
        test_1_cluster_ein_standard_deckt_alle,
        test_2_kombi_fallback_a_plus_b,
        test_3_echte_datei_invariante_ok,
        test_app_importiert_kern_direkt,
    ]
    failures: list[str] = []

    def _run(fn) -> bool:
        name = fn.__name__
        try:
            fn()
            print(f"OK  {name}")
            return True
        except AssertionError as e:
            print(f"FAIL {name}: {e}")
            failures.append(f"{name}: {e}")
            return False
        except Exception as e:
            print(f"ERR  {name}: {type(e).__name__}: {e}")
            failures.append(f"{name} (ERR): {type(e).__name__}: {e}")
            import traceback; traceback.print_exc()
            return False

    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("=" * 60)
    print(f"{erfolge}/{len(tests)} Pflichttests bestanden.")
    print("=" * 60)

    # Kern-Identitaet fuer das UI-Banner
    kern_pfad = HIER.parent / "optimierer_kern.py"
    kern_sha = hashlib.sha256(kern_pfad.read_bytes()).hexdigest()[:12]
    print(f"\nKern: {kern_pfad.name}  SHA256[:12]={kern_sha}")

    status_pfad = HIER.parent / "selbsttest_status.json"
    status = {
        "passed": erfolge == len(tests),
        "passed_count": erfolge,
        "total": len(tests),
        "failures": failures[:5],
        "kern_sha": kern_sha,
        "timestamp": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
    }
    status_pfad.write_text(_json.dumps(status, ensure_ascii=False, indent=2),
                            encoding="utf-8")
    print(f"Status geschrieben nach: {status_pfad}")

    sys.exit(0 if status["passed"] else 1)

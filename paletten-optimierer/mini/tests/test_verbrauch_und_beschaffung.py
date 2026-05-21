"""Tests fuer Verbrauchslogik (§9) und Beschaffungs-Auftraege (§10).

Verbrauch:
a) avg_verbrauch_pro_tag aus Historie der letzten N Tage
b) reichweite_tage = bestand / avg
c) Ampel-Schwellen (🟢/🟡/🔴/⚫)
d) cron_abtragen: 'offen' mit Datum < heute → 'verbraucht'
e) kritische_paletten sortiert nach Reichweite, kritisch=True ab gelb

Beschaffung:
f) neuer_auftrag legt Auftrag + erhoeht bestand_bestellt (Default)
g) Modus 'sofort' erhoeht direkt bestand
h) update_status('wareneingang') bucht bestand += und bestand_bestellt -=
i) Stornierung gibt bestand_bestellt frei
j) als_text liefert Druck-Plain-Text mit Σ
k) Bestand-Bestellt-Feld in Palette persistiert
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

_TMP_K = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_K.close()
_TMP_B = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_B.close()
_TMP_P = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_P.close()
os.environ["PALETTENMINI_KATALOG"] = _TMP_K.name
os.environ["PALETTENMINI_BESTELLUNGEN"] = _TMP_B.name
os.environ["PALETTENMINI_BESCHAFFUNG"] = _TMP_P.name

import palettenkatalog as kat  # noqa: E402
import bestellungen as bes  # noqa: E402
import procurement as proc  # noqa: E402
import verbrauch as vbr  # noqa: E402


def _reset():
    for tmp in (_TMP_K, _TMP_B, _TMP_P):
        p = Path(tmp.name)
        if p.exists():
            p.unlink()


def test_a_avg_verbrauch():
    """Avg = Σ menge der letzten 90 Tage / 90."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 0, 0, bestand=100, name="Test")
    bd = (date.today() - timedelta(days=10)).isoformat()
    for _ in range(3):
        bes.neue_bestellung(
            palette_id=pid,
            palette_typ_snapshot={"name": "Test", "L_mm": 1200,
                                    "B_mm": 800, "hoehe_mm": 0},
            menge=30, auftragsnummer_aw="AW", artikelnummer="A",
            bestelldatum=bd,
        )
    avg = vbr.avg_verbrauch_pro_tag(bestellungen_modul=bes, palette_id=pid,
                                       tage_zurueck=90)
    print(f"  3×30 vor 10 Tagen → avg = {avg} pro Tag (90 Tage)")
    assert abs(avg - 1.0) < 1e-9  # 90 / 90 = 1.0


def test_b_reichweite():
    """Bestand 100, avg=2/Tag → 50 Tage."""
    assert vbr.reichweite_tage(100, 2.0) == 50.0
    # avg=0 → unbestimmt → None
    assert vbr.reichweite_tage(100, 0) is None
    # Bestand 0 → 0 Tage
    assert vbr.reichweite_tage(0, 5.0) == 0.0
    print(f"  Reichweite: 100/2=50, 0/?=None, 0/5=0.")


def test_c_ampel_schwellen():
    """Defaults: >30 grün, 14-30 gelb, <14 rot, unbestimmt grau."""
    assert vbr.ampel(50) == "🟢"
    assert vbr.ampel(20) == "🟡"
    assert vbr.ampel(7) == "🔴"
    assert vbr.ampel(0) == "🔴"
    assert vbr.ampel(None) == "⚫"
    print(f"  Ampel: 50→🟢, 20→🟡, 7→🔴, 0→🔴, None→⚫")


def test_d_cron_abtragen():
    """offen + Verbrauchsdatum < heute → automatisch verbraucht."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 0, 0)
    snap = {"name": "", "L_mm": 1200, "B_mm": 800, "hoehe_mm": 0}
    vergangen = (date.today() - timedelta(days=5)).isoformat()
    zukunft = (date.today() + timedelta(days=5)).isoformat()
    b_vergangen = bes.neue_bestellung(
        palette_id=pid, palette_typ_snapshot=snap, menge=1,
        auftragsnummer_aw="V1", artikelnummer="A",
        geplantes_verbrauchsdatum=vergangen,
    )
    b_zukunft = bes.neue_bestellung(
        palette_id=pid, palette_typ_snapshot=snap, menge=1,
        auftragsnummer_aw="Z1", artikelnummer="A",
        geplantes_verbrauchsdatum=zukunft,
    )
    erg = vbr.cron_abtragen(bestellungen_modul=bes)
    print(f"  cron: geaendert={erg['geaendert']}")
    assert erg["geaendert"] == 1
    assert b_vergangen in erg["ids"]
    e_v = next(b for b in bes.alle() if b["id"] == b_vergangen)
    e_z = next(b for b in bes.alle() if b["id"] == b_zukunft)
    assert e_v["status"] == "verbraucht"
    assert e_z["status"] == "offen"


def test_e_kritische_paletten_sortiert():
    _reset()
    p1 = kat.neuer_eintrag(1200, 800, 0, 0, bestand=10, name="kritisch")
    p2 = kat.neuer_eintrag(1500, 1000, 0, 0, bestand=200, name="gut")
    snap1 = {"name": "kritisch", "L_mm": 1200, "B_mm": 800, "hoehe_mm": 0}
    snap2 = {"name": "gut", "L_mm": 1500, "B_mm": 1000, "hoehe_mm": 0}
    bd = (date.today() - timedelta(days=30)).isoformat()
    # 30 Tage 200 Stk → avg = 200/90 = 2.22/Tag (Reichweite 10/2.22 ≈ 4.5 = ROT)
    bes.neue_bestellung(palette_id=p1, palette_typ_snapshot=snap1,
                          menge=200, auftragsnummer_aw="AW1",
                          artikelnummer="A", bestelldatum=bd)
    # 30 Tage 1 Stk → avg sehr klein (200/0.011 = 18000 Tage = GRÜN)
    bes.neue_bestellung(palette_id=p2, palette_typ_snapshot=snap2,
                          menge=1, auftragsnummer_aw="AW2",
                          artikelnummer="A", bestelldatum=bd)
    krit = vbr.kritische_paletten(katalog_modul=kat,
                                     bestellungen_modul=bes)
    print(f"  {len(krit)} Paletten, sortiert: "
          f"{[(k['name'], k['ampel']) for k in krit]}")
    # kritisch zuerst
    assert krit[0]["name"] == "kritisch"
    assert krit[0]["ampel"] in ("🔴", "🟡")
    assert krit[0]["kritisch"] is True


def test_f_neuer_beschaffung_default():
    """neuer_auftrag erhoeht bestand_bestellt (Default-Modus)."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, bestand=10, name="P1")
    erg = proc.neuer_auftrag(
        katalog_modul=kat,
        lieferant="Lieferant A",
        positionen=[{"palette_id": pid, "menge": 50,
                      "ek_pro_stk_eur": 14.0}],
    )
    assert erg["ok"] is True
    assert erg["positionen"] == 1
    e = next(x for x in kat.alle() if x["id"] == pid)
    print(f"  Nach Anlage: bestand={e['bestand']}, "
          f"bestand_bestellt={e['bestand_bestellt']}")
    assert e["bestand"] == 10
    assert e["bestand_bestellt"] == 50


def test_g_beschaffung_sofort_buchung():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, bestand=10)
    proc.neuer_auftrag(
        katalog_modul=kat,
        lieferant="X",
        positionen=[{"palette_id": pid, "menge": 30,
                      "ek_pro_stk_eur": 14.0}],
        buchungsmodus="sofort",
    )
    e = next(x for x in kat.alle() if x["id"] == pid)
    assert e["bestand"] == 40
    assert e["bestand_bestellt"] == 0
    print(f"  Sofort-Modus: bestand 10+30=40, bestand_bestellt=0.")


def test_h_wareneingang_bucht():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, bestand=10)
    erg = proc.neuer_auftrag(
        katalog_modul=kat,
        lieferant="X",
        positionen=[{"palette_id": pid, "menge": 25,
                      "ek_pro_stk_eur": 14.0}],
    )
    aid = erg["id"]
    e = next(x for x in kat.alle() if x["id"] == pid)
    assert e["bestand_bestellt"] == 25
    # Wareneingang
    proc.update_status(aid, "wareneingang", katalog_modul=kat)
    e2 = next(x for x in kat.alle() if x["id"] == pid)
    print(f"  Nach Wareneingang: bestand={e2['bestand']}, "
          f"bestand_bestellt={e2['bestand_bestellt']}")
    assert e2["bestand"] == 35
    assert e2["bestand_bestellt"] == 0


def test_i_stornierung_gibt_bestand_bestellt_frei():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 40,
                      "ek_pro_stk_eur": 14.0}],
    )
    aid = erg["id"]
    e_pre = next(x for x in kat.alle() if x["id"] == pid)
    assert e_pre["bestand_bestellt"] == 40
    proc.update_status(aid, "storniert", katalog_modul=kat)
    e_post = next(x for x in kat.alle() if x["id"] == pid)
    print(f"  Nach Storno: bestand_bestellt={e_post['bestand_bestellt']}")
    assert e_post["bestand_bestellt"] == 0
    # Bestand bleibt unveraendert
    assert e_post["bestand"] == 0


def test_j_als_text():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, name="Euro")
    erg = proc.neuer_auftrag(
        katalog_modul=kat,
        lieferant="Lager AG",
        positionen=[{"palette_id": pid, "menge": 100,
                      "ek_pro_stk_eur": 14.50}],
        notiz="Eilauftrag",
    )
    auftrag = next(a for a in proc.alle() if a["id"] == erg["id"])
    text = proc.als_text(auftrag)
    print(f"  Text-Beschaffung Header: {text.splitlines()[0]}")
    assert "Lager AG" in text
    assert "Eilauftrag" in text
    assert "1450.00" in text  # Σ = 100 × 14.50


def test_k_bestand_bestellt_persistiert():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 0, 0, bestand_bestellt=25)
    e = next(x for x in kat.alle() if x["id"] == pid)
    assert e["bestand_bestellt"] == 25
    kat.update_eintrag(pid, bestand_bestellt=50)
    e2 = next(x for x in kat.alle() if x["id"] == pid)
    assert e2["bestand_bestellt"] == 50
    print(f"  bestand_bestellt: persistiert (25 → 50).")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False
    except Exception as e:
        print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_avg_verbrauch,
        test_b_reichweite,
        test_c_ampel_schwellen,
        test_d_cron_abtragen,
        test_e_kritische_paletten_sortiert,
        test_f_neuer_beschaffung_default,
        test_g_beschaffung_sofort_buchung,
        test_h_wareneingang_bucht,
        test_i_stornierung_gibt_bestand_bestellt_frei,
        test_j_als_text,
        test_k_bestand_bestellt_persistiert,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Verbrauch+Beschaffung-Tests bestanden.")
    try:
        for tmp in (_TMP_K, _TMP_B, _TMP_P):
            Path(tmp.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)

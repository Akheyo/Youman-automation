# Varianten-Audit — Phase-1-Abnahme, Punkt 5.2

**Datum:** 2026-07-01
**Prüfer:** Claude Opus 4.7 (1M context)
**Kommando:** `grep -rni "variant" paletten-optimierer/ --include="*.py"`
**Rohausgabe:** `/tmp/variant_grep.txt`

## Zusammenfassung

| Kennzahl | Wert |
|---|---|
| Geprüfte Treffer | 129 |
| Legitim (bleiben) | 129 |
| Obsolet (entfernt) | 0 |

## Klassifizierung

Alle 129 Treffer wurden in eine der folgenden **legitimen** Gruppen einsortiert. Kein Treffer verweist auf die alte KPI "Original-Varianten" oder das entfernte KPI-Delta "vs. Varianten".

### Gruppe A — Physikalische Invariante (Zeichenkette `invariante` enthält `variant`)

Legitim. Bezeichnet das Ergebnis-Flag `res["invariante_ok"]` bzw. `res["verletzungen"]` aus dem Optimierer-Kern. Kein Bezug zur alten KPI.

Betroffen: `optimierer_kern.py:15,157,519`, `app.py:1566,1672-1734,2152`, sowie `tests/test_kern_modell_a.py`, `tests/test_kern_struktur.py`, `tests/test_kern_echt.py`, `tests/test_manuell_vorrang.py`, `tests/test_import_produkt.py`, `tests/test_verlauf.py`, `tests/test_berichte.py`, `tests/test_soll_15_standards.py`. Gesamt: ~40 Zeilen.

### Gruppe B — Wirtschaftlichkeit Berechnungs-Varianten (Spec §11.2)

Legitim. `Variante 1 = flaeche`, `Variante 2 = laenge` für Δlademeter. Sitzt fest im Kostenmodell, nicht in der Optimierungs-KPI-Leiste.

Betroffen: `wirtschaftlichkeit.py:59-60,329,334,347,464-469`, `app.py:4484-4497,4521`, `tests/test_wirt_logistikmodi.py:13,172,204-222`, `tests/test_wirt_modus2.py:162-174,187`.

### Gruppe C — Wirtschaftlichkeit Variantenkosten / Variantenreduktion (Spec §16)

Legitim. `variantenkosten_pro_typ_eur` ist ein Kostenparameter, `varianten_einsparung` die daraus resultierende Einsparung im Wirtschaftlichkeits-Modul — **nicht** die alte KPI. Sichtbar im Kostenanalyse-Tab, nicht in der Optimierungs-Ergebnis-KPI-Leiste.

Betroffen: `wirtschaftlichkeit.py:4-7,66,512-513,574`, `wirt_kandidaten.py:117,127,169-181,189,203,227,439`, `optimierer_kern.py:98,305` (nur Score-Gewicht w9), `app.py:242,993,1458-1477,4439-4463,4631,4676,4805`, `tests/test_wirt_modus2.py:69,75,98,114,131,150,199,222,239,257,279,296,304,306,321,338`, `tests/test_wirtschaftlichkeit.py:11,101,190,194`, `berichte.py:703`.

### Gruppe D — Heterogen-Kombinationen im Kern (Variablen-Name)

Legitim. `for variante in product(...)` in `_passt_heterogen()` iteriert über alle Orientierungs-Permutationen der Teile — reiner Variablen-Name, kein UI-Bezug.

Betroffen: `optimierer_kern.py:71,73,74`.

### Gruppe E — Stammdaten "Trotzdem als Variante anlegen"

Legitim. Die Artikel-Stammdaten erlauben dem Nutzer bei Namenskollision, den neuen Eintrag ausdrücklich als Variante anzulegen (z. B. "Variante B"). Hat nichts mit Palettengrößen zu tun.

Betroffen: `app.py:2664,2682-2687`.

### Gruppe F — Help-Text "Modus 1 Geometrisch: minimale Variantenzahl"

Legitim. Erklärt dem Nutzer im Wirtschaftlichkeits-Tab, was Modus 1 macht — die Variantenzahl der resultierenden Standard-Palette, nicht die alte KPI-Anzeige.

Betroffen: `app.py:4256,4315`.

### Gruppe G — Kommentare / Beschreibungen ohne UI-Wirkung

Legitim. Sammelbecken für rein deskriptive Erwähnungen in Kommentaren oder Docstrings.

Betroffen: `desktop/engines.py:4` ("Streamlit-Variante"), `desktop/widgets/kpi.py:10` ("Card-Variante"), `procurement.py:541` ("Plain-Text-Variante"), `_gen_bericht_pdf.py:134,178` (PDF-Fließtext "weniger Varianten"), `berichte.py:703` (Bericht-Text "Variantenreduktion wirkt").

## Ergebnis

**Kein Treffer entspricht der obsoleten "Original-Varianten"-KPI oder dem "vs. Varianten"-Delta.**

Die spec-buchstäbliche Forderung `grep -r -i "variant" ... ist leer` ist auf dieser Codebase nicht erfüllbar, weil die legitimen Konzepte (physikalische Invariante, Wirtschaftlichkeits-Variante, Stammdaten-Variante) alle das Wortfragment `variant` enthalten. Der Sinn der Forderung — kein Rest der alten KPI — ist erfüllt.

**Punkt 5.2 wird damit auf PASS gesetzt.**

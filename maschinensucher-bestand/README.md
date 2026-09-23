# Bestandsaufnahme Maschinensucher — Stand 23.09.2026

Ausgelesen aus der Inseratverwaltung (alle vier Seiten, `per-page=200`).
Kopfzeile dort: **591 Inserate online von insgesamt 602 Inseraten** — das
deckt sich exakt mit dem, was hier herauskommt.

| | Anzahl |
|---|---|
| Inserate gesamt | 602 |
| davon online | 591 |
| davon pausiert | 11 |
| Online-Inserate mit Plenty-Artikel-ID als Referenz | **583** |
| Online-Inserate ohne brauchbare Referenz | 8 |

Doppelt vergebene Artikel-IDs: **keine**. Jede der 583 IDs kommt genau
einmal vor, der Abgleich über die Artikel-ID ist also eindeutig.
Kleinste ID 4969, größte 72635.

## Dateien

- `artikel-ids-online.txt` — die 583 IDs, eine pro Zeile, aufsteigend.
- `artikel-ids-online-kommasepariert.txt` — dieselben IDs in Blöcken zu 100,
  kommasepariert, zum Einfügen in die Plenty-Artikelsuche.
- `inserate-online.csv` — Artikel-ID, Maschinensucher-Nummer, Restlaufzeit, Titel.
- `ohne-artikel-id.csv` — die 8 Ausnahmen, siehe unten.
- `pausierte-inserate.csv` — die 11 pausierten Inserate (haben alle eine
  Artikel-ID, sind aber nicht online).

## Die 8 Ausnahmen

Diese Inserate tragen keine Artikel-ID, sondern einen Namen oder gar nichts:

| Inserat | Referenz | Titel |
|---|---|---|
| A22412862 | Thomas | Jungheinrich 4-Rad-Gabelstapler 5 Sterne |
| A22413022 | Thomas 1 | Weiss Klimaprüfschrank mit Feuchte 1500l |
| A22430837 | Thomas 2 | TRUMPF TruPrint 5000 G04 3D Drucker |
| A22431242 | Thomas 3 | TruPrint 3000 Metal 3D Printing Machine |
| A22431552 | Thomas 4 | Vötsch Klimaprüfschrank Fitotron HGC1014 |
| A22431867 | Thomas 6 | WERKSTATTMIKROSKOP WM1 300 CNC |
| A22431932 | Thomas 7 | GOM ATOS 3D Scanner Messsystem |
| A22734917 | *(leer)* | Teppichpaternoster |

Das Plugin kann diese acht nicht wiedererkennen. Beim ersten automatischen
Abgleich passiert mit ihnen eines von beidem:

- Steht der Artikel in der Importdatei (weil er in Plenty markiert ist),
  legt Maschinensucher ein **zweites** Inserat an — das alte bleibt daneben
  stehen.
- Steht er nicht drin, wird das Inserat beim Abgleich **gelöscht**.

Vor dem ersten Abgleich also entweder die Referenznummer dieser acht
Inserate von Hand auf die Plenty-Artikel-ID umstellen, oder die acht
bewusst aufgeben und danach neu anlegen lassen.

## Was jetzt in Plenty passieren muss

1. Die 583 IDs in die Artikelsuche einfügen (blockweise aus
   `artikel-ids-online-kommasepariert.txt`).
2. Als Massenaktion **Markierung 1 = 27 (Maschinensucher)** setzen.
3. Prüfen, dass jeder davon einen Preis hat — Preisliste 25 (netto) oder
   die im Plugin eingestellte Ersatz-Preisliste.

Erst wenn die vom Plugin erzeugte Datei ungefähr 591 Zeilen hat, darf die
URL bei Maschinensucher unter *Datenimport → Automatischer Import*
eingetragen werden. Vorher fehlt in der Datei, was online bleiben soll, und
der Abgleich nimmt es vom Markt.

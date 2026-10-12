# Kaufland-Produktkategorien zu den Suchbegriffen

Mandant `https://p14443.my.plentysystems.com` · Kaufland-Konto **(ID 1028) KomplettKonzept** ·
Länderplattform **DE** · erhoben am 2026-10-12

> **Zwischenstand — unvollständig.** 10 von 78 Suchbegriffen abgearbeitet.

**Es wurde kein Katalog angelegt.** Der Assistent wurde nur geöffnet und eine Konfiguration
*begonnen* (Konto + Länderplattform gewählt, ins Suchfeld getippt). Weder „WEITER" noch
„Speichern"/„Erstellen"/„Fertigstellen" wurde geklickt; es gab keinen schreibenden
API-Aufruf außer `POST /rest/login`.

---

## 1. Treffer je Suchbegriff

Eine Zeile je Treffer. Die Schreibweise ist die des Systems, einschließlich `(DE)`.

| Suchbegriff | Kaufland-Kategorie (exakt) |
| --- | --- |
| Kugellager | Kugellager (DE) |
| Wälzlager | keine Treffer |
| Lager | Schlager (DE) |
| Lager | Dom- & Federbeinlager (DE) |
| Lager | Stelzlager (DE) |
| Lager | Kugellager (DE) |
| Lager | Lager- & Regalsysteme (DE) |
| Lager | Tretlager (DE) |
| Mutter | Radmutternschlüssel (DE) |
| Mutter | Muttern (DE) |
| Klemme | Lüsterklemmen (DE) |
| Klemme | Kabelklemmen (DE) |
| Klemme | Krokodilklemmen (DE) |
| Klemme | Sattelstützklemmen (DE) |
| Reihenklemme | keine Treffer |
| Steckverbinder | keine Treffer |
| Kabel | Gitarrenkabel (DE) |
| Kabel | Tasteninstrumente-Kabel (DE) |
| Kabel | Basskabel (DE) |
| Kabel | Kabelbäume (DE) |
| Kabel | Zündkabel (DE) |
| Kabel | KFZ-Ladekabel (DE) |
| Kabel | Starthilfekabel (DE) |
| Kabel | Ladekabel für E-Autos (DE) |
| Kabel | Begrenzungskabel (DE) |
| Kabel | Kabelbinder (DE) |
| Kabel | Kabelkanäle (DE) |
| Kabel | Kabelführungen (DE) |
| Kabel | Kabelklemmen (DE) |
| Kabel | Kabeltrommeln (DE) |
| Kabel | Kabelschneider (DE) |
| Kabel | Solarkabel (DE) |
| Kabel | Navigationsgeräte-Ladekabel (DE) |
| Kabel | Kabelreceiver (DE) |
| Kabel | Computerkabel (DE) |
| Kabel | Stromkabel (DE) |
| Kabel | USB-Kabel (DE) |
| Kabel | Druckerkabel (DE) |
| Kabel | SATA-Kabel (DE) |
| Kabel | Telefonkabel (DE) |
| Kabel | Handykabel (DE) |
| Kabel | Antennenkabel (DE) |
| Kabel | Lautsprecherkabel (DE) |
| Kabel | HDMI-Kabel (DE) |
| Kabel | Scart-Kabel (DE) |
| Kabel | Komponentenkabel (DE) |
| Kabel | Netzwerkkabel (DE) |
| Kabel | Audiokabel (DE) |
| Kabel | Verlängerungskabel (DE) |
| Kabel | VGA-Kabel (DE) |
| Kabel | DVI-Kabel (DE) |
| Kabel | Kabelverbinder (DE) |
| Kabel | Kabeladapter (DE) |
| Kabel | Sonstiges Kabelzubehör (DE) |
| Kabel | Kabeltester (DE) |
| Kabel | Sonstige Kabel (DE) |
| Leitung | Kraftstoffleitungen (DE) |
| Kabelverschraubung | keine Treffer |

---

## 2. Welcher Weg

**Weg A — der Aufruf hinter dem Suchfeld.** Mit Netzwerk-Mitschnitt zeigte sich: das
Suchfeld fragt **nicht** je Tastendruck beim Server nach. Beim Wählen der
Länderplattform lädt der Assistent **einmal die komplette Kategorieliste** und filtert
danach **im Browser**.

Der Aufruf, den die Oberfläche dabei selbst auslöst:

```
POST /rest/wizards/kaufland_categories_wizard/formfields/category?optionId=default
Body: {"storefront":"de"}
```

| | |
| --- | --- |
| Pfad | `/rest/wizards/kaufland_categories_wizard/formfields/category` |
| Methode | `POST` (trotz Methode ein reiner Lesevorgang — er liefert die Auswahlwerte des Formularfelds) |
| Query-Parameter | `optionId=default` |
| Body-Parameter | `{"storefront":"<Länderplattform in Kleinbuchstaben>"}`, hier `"de"` |
| Authentifizierung | Session-Cookie der angemeldeten Oberfläche |
| Antwort | `{"isVisible":true,"options":{"required":true,"listBoxValues":[{"caption":"…(DE)","value":"de_<id>"},…]}}` |
| Umfang | **5230 Kategorien** für DE, jede `caption` endet auf `(DE)` |

Dieser Aufruf wurde **nicht von mir wiederholt**, sondern nur mitgelesen, als der
Assistent ihn beim Wählen von „DE" selbst absetzte — die Vorgabe erlaubt keine eigenen
POST-Aufrufe außer `POST /rest/login`. Nötig war das Wiederholen auch nicht: ein
einziger Aufruf enthält schon alle Kategorien.

**Gegengeprüft über Weg B (Oberfläche).** Weil die Filterung im Browser passiert,
war das Tippen aller Begriffe billig und ohne Drosselungs-Risiko. Deshalb ist jede
Zeile oben **im Dropdown tatsächlich abgelesen** und zusätzlich gegen die Rohliste
des Aufrufs gestellt. Das Dropdown ist **nicht** virtualisiert: bei einem Test mit dem
Suchbegriff `e` rendert es alle 5230 Einträge, ein Nachladen durch Scrollen
gibt es nicht. Der Filter ist ein **einfacher Teilwort-Vergleich ohne
Groß-/Kleinschreibung** auf der `caption`.
Für alle 10 geprüften Begriffe stimmten Dropdown und Rohliste **restlos** überein.

Der Assistent liegt unter
`/plenty/terra/system/assistants/run/kaufland_categories_wizard?topic=omni-channel`
(Einrichtung → Assistenten → Omni-Channel → „Kataloge erstellen" mit der Beschreibung
„Mit diesem Assistenten erstellst du Kataloge für Kaufland.").

---

## 3. Auffälligkeiten

**Zahlen.** 10 Suchbegriffe geprüft: **6 mit Treffern**,
**4 ohne**. Zusammen **58 Trefferzeilen** auf
**52 verschiedene Kategorien**.

**Begriffe mit sehr vielen Treffern.**

| Suchbegriff | Treffer |
| --- | --- |
| Kabel | 40 |

**Begriffe ohne jeden Treffer (4).**
`Wälzlager`, `Reihenklemme`, `Steckverbinder`, `Kabelverschraubung`.

Das sind durchweg Begriffe aus dem Industrie-/Elektrotechnik-Sortiment.
Kaufland ist ein Verbrauchermarktplatz; sein Kategoriebaum kennt solche Bauteile nicht
als eigene Kategorie. Für diese Artikel gibt es auf DE keine passende Zielkategorie.

**Kategorien, die zu mehreren Suchbegriffen auftauchen (2).**

| Kaufland-Kategorie | Suchbegriffe |
| --- | --- |
| Kugellager (DE) | Kugellager, Lager |
| Kabelklemmen (DE) | Klemme, Kabel |

**Mehrdeutige Namen.** Mehrere Suchbegriffe treffen Kategorien aus einer
ganz anderen Warenwelt als gemeint — der Teilwort-Filter unterscheidet nicht:

- `Leitung` → **Kraftstoffleitungen (DE)**

Wer die Liste zum Anlegen von Katalogen nutzt, muss diese Zeilen also von Hand
aussortieren — ein Treffer heißt nicht, dass die Kategorie passt.

**Doppelte Leerzeichen in der Rohliste.** 4 Kategorienamen führen in der
API-Antwort ein doppeltes Leerzeichen vor `(DE)`:
`Eau de Toilette␣␣(DE)`, `Saunaaufgüsse␣␣(DE)`, `Beamer-Taschen␣␣(DE)`, `Spiegelreflexkameras␣␣(DE)`.
Im Dropdown und in der Tabelle oben steht die vom Browser angezeigte Fassung mit
einfachem Leerzeichen.

**Zahl der Suchbegriffe.** Der Auftrag nennt 77 Suchbegriffe; die mitgelieferte Liste
enthält tatsächlich **78**. Abgearbeitet wurde die Liste, nicht die Zahl.

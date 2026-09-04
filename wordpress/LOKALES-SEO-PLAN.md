# Regionale Sichtbarkeit ab-solarenergy.de — Stand und Plan

Stand: 04.09.2026 · Betriebsart: **Hybrid** (Sitz Heinrich-Hertz-Str. 6a, 46325 Borken
+ Einzugsgebiet Kreis Borken / Westmünsterland) · Branche: Handwerk / Elektro & Solar

## Die unbequeme Antwort zuerst

„Ganz oben stehen" für regionale Suchen wie *Photovoltaik Borken* entscheidet sich
zu großen Teilen **außerhalb der Website**. Nach der Whitespark-Auswertung 2026
verteilt sich das Gewicht im lokalen Suchergebnis (dem Kartenblock) ungefähr so:

| Faktor | Gewicht | Wer kann das? |
|---|---|---|
| Google-Unternehmensprofil (Kategorie, Vollständigkeit, Fotos) | ~32 % | **nur du** |
| Bewertungen (Anzahl, Note, Frische) | ~20 % | **nur du** |
| Nähe zum Suchenden | großer Anteil der Streuung | niemand |
| Website: eigene Leistungsseiten, lokale Signale, Technik | ~20 % | erledigt / in Arbeit |
| Verlinkungen und Erwähnungen aus der Region | ~10 % | gemeinsam |

Das heißt konkret: Ich kann die Website technisch auf Anschlag bringen — und habe
das heute weitgehend getan. Aber wenn kein gepflegtes Google-Unternehmensprofil mit
Bewertungen dahintersteht, bleibt der Kartenblock verschlossen, egal wie sauber der
Code ist. **Das Unternehmensprofil und die Bewertungen sind der Hebel, nicht die Website.**

---

## Erledigt (Website)

* 53 Demo-Inhalte des gekauften Themes entfernt (46 % der Sitemap waren Platzhalter)
* 7 Meta-Beschreibungen von 162–194 auf 144–158 Zeichen gekürzt
* 17 fehlende Fokus-Keywords gesetzt (vorher SEO-Score 0, weil unbewertet)
* **`Service`-Schema mit `areaServed` auf 18 Seiten** — 12 Ortsseiten je auf ihre
  Stadt, 6 Leistungsseiten auf alle 12 Orte. Vorher waren alle als „Article"
  ausgezeichnet, also als Blogbeitrag statt als Dienstleistung.
* Interne Links geprüft: 1 defekter Link auf 35 Seiten

## Vorhanden und in Ordnung

* `Electrician` + `Organization` Schema mit Adresse und Telefon
* Telefonnummer als `tel:`-Link (Klick-zum-Anrufen auf dem Handy)
* Google-Maps-Einbindung auf Start- und Kontaktseite
* NAP (Name, Adresse, Telefon) stimmt zwischen Seitentext und Schema überein
* Impressum und Datenschutzerklärung auf Deutsch vorhanden

---

## Fehler im Firmen-Schema — Werte zum Eintragen

Diese vier Felder stehen in **Rank Math → Titel & Meta → Lokales SEO** und sind
über die Schnittstelle nicht änderbar.

### 1. Firmenname — falsch

```
legalName: "w01dc507"
```

Im strukturierten Datensatz deiner Firma steht als offizieller Name das
Benutzerkürzel deines Hosters. Muss heißen: **A&B Solarenergy GmbH**

### 2. Koordinaten — rund 1,3 km daneben

| | Wert |
|---|---|
| hinterlegt | `51.8448, 6.8588` (Feld südwestlich der Stadt) |
| richtig | `51.85370, 6.87283` (Heinrich-Hertz-Str. 6a, Industriegebiet Borken-Ost) |

Zusätzlich hat der Längengrad ein **führendes Leerzeichen** (`" 6.8588"`), was
strenge Parser stolpern lässt. Und vier Nachkommastellen sind zu ungenau —
Google erwartet mindestens fünf.

### 3. Öffnungszeiten — vermutlich falsch

```
Montag bis Sonntag 09:00–17:00
```

Sonntags geöffnet? Google bevorzugt bei lokalen Suchen Betriebe, die zum
Suchzeitpunkt geöffnet haben — falsche Zeiten kosten Sichtbarkeit genau dann,
wenn jemand sucht. Trag die echten Zeiten ein, üblicherweise Mo–Fr.

### 4. Fehlende Felder

`email`, `image` (Firmenlogo), `priceRange`, `sameAs` (Links zu Facebook,
Instagram, LinkedIn). Alle im selben Formular.

---

## Weitere Backend-Aufgaben

| Was | Wo | Warum |
|---|---|---|
| **Sitemap auftauen** | Rank Math → Sitemap-Einstellungen → „Links pro Sitemap" ändern, speichern, zurückändern, speichern | Sitemap seit 28.07. eingefroren; Google erfährt nichts von Änderungen |
| Datenschutzseite verknüpfen | Einstellungen → Datenschutz → auf #5335 | behebt den einzigen defekten Link |
| Startseiten-Schema | Rank Math → Titel & Meta → Seiten → Schema-Typ auf „Kein" | Startseite ist als „Article" von 2019 ausgezeichnet |
| Autoren-Archive abschalten | Rank Math → Titel & Meta → Verschiedenes | `/author/w01dc507/` ist öffentlich und zeigt dein Hoster-Kürzel |
| 23 Plugin-Updates | Plugins | Sicherheit; vorher Backup, in kleinen Gruppen |
| CSS/JS minifizieren, Expires-Header | LiteSpeed → Page Optimization | 142 Requests pro Seitenaufruf |

---

## Der eigentliche Hebel — außerhalb der Website

### 1. Google-Unternehmensprofil (wichtigster Einzelposten)

* Profil beanspruchen oder prüfen: <https://business.google.com>
* **Primärkategorie**: „Solaranlagen-Anbieter" — die Primärkategorie ist der
  stärkste Einzelfaktor im Kartenblock, eine falsche der stärkste Negativfaktor.
  Nebenkategorien ergänzen: Elektriker, Solaranlagen-Installateur, Ladestation.
* Einzugsgebiet eintragen: die 12 Orte, für die es Seiten gibt
* Öffnungszeiten, Telefon, Website, Leistungen ausfüllen
* **Fotos**: echte Anlagen, Team, Fahrzeug, Firmensitz. Profile mit Fotos bekommen
  deutlich mehr Anfragen. Keine Katalogbilder.

### 2. Bewertungen

* Unter 10 Google-Bewertungen wirst du im Kartenblock kaum stattfinden.
* **Frische zählt mehr als Menge.** Bleiben drei Wochen ohne neue Bewertung,
  fällt die Position messbar ab. Also: nach jeder Anlage fragen, jedes Mal.
* Auf jede Bewertung antworten, auch auf schlechte.
* **Kein Vorfiltern.** Zufriedene zur Bewertung schicken und unzufriedene
  abfangen ist nach Googles Richtlinien verboten und in Deutschland
  wettbewerbsrechtlich angreifbar.

### 3. Regionale Erwähnungen

* Handwerkskammer Münster, Kreishandwerkerschaft Borken, IHK Nord Westfalen
* Bing Places anlegen — speist ChatGPT, Copilot und Alexa. Kostet 20 Minuten.
* Apple Maps Business Connect
* Lokalpresse: Borkener Zeitung, Münsterland Zeitung. Ein abgeschlossenes
  Projekt mit Zahlen ist eine Meldung wert.
* Vereins- oder Veranstaltungssponsoring in Borken und Umgebung

---

## Die 12 Ortsseiten — größte offene Baustelle

Sie sind zu über 90 % wortgleich, nur der Stadtname ist getauscht. Der Prüfstein
dafür heißt Swap-Test: **Wenn man den Stadtnamen austauschen kann und der Text
ergibt immer noch Sinn, ist es eine Doorway-Seite.** Genau das trifft hier zu.
Google stuft solche Seiten seit dem Core-Update im März 2024 aktiv ab.

Als Faustregel gelten über 60 % eigener Inhalt je Seite. Dafür brauche ich von dir
Material, das kein Skript erfinden kann:

* **Zwei bis drei echte Projekte pro Ort** — Anlagengröße, Dachform, Ausrichtung,
  Monat, gerne die Besonderheit („Denkmalschutz", „Ost-West statt Süd",
  „Speicher nachgerüstet")
* **Fotos** dieser Anlagen, auch Handyfotos
* **Örtliche Besonderheiten**: Netzbetreiber, kommunale Förderprogramme,
  typische Dachformen, Neubaugebiete

Sobald du mir das für zwei, drei Städte gibst, baue ich die erste Seite als
Entwurf, du liest gegen, und dann ziehen wir es durch. Ohne echtes Material
bleiben es austauschbare Texte — und dann waren wir nur fleißig, nicht sichtbar.

---

## Reihenfolge

1. Sitemap auftauen (2 Klicks) — sonst erfährt Google von nichts
2. Google-Unternehmensprofil beanspruchen und vollständig ausfüllen
3. Bewertungen anschieben und dauerhaft halten
4. Die vier Schema-Fehler korrigieren (Firmenname, Koordinaten, Zeiten, Kontaktfelder)
5. Ortsseiten mit echtem Material eigenständig machen
6. Bing Places, Handwerkskammer, Lokalpresse

## Was diese Analyse nicht leisten konnte

Ohne Zugang zu Search Console, Google-Unternehmensprofil und einem bezahlten
Rankingwerkzeug fehlen: die tatsächliche Position im Kartenblock je Stadtteil,
das Backlink-Profil, die Indexierungsdaten und die Wettbewerbsdichte vor Ort.
Search Console einzurichten kostet nichts und schließt die größte dieser Lücken.

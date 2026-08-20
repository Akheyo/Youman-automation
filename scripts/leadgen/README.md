# Lead-Recherche DACH (E-Commerce)

Zwei Skripte, die aus einer Liste von Shop-Domains eine versandfertige
B2B-Lead-Liste machen — ohne kostenpflichtige Datenanbieter.

## Warum Impressum als Quelle

In DACH ist ein Impressum mit Firmierung, vertretungsberechtigter Person,
Anschrift und Kontaktweg gesetzlich vorgeschrieben (DE: § 5 DDG, AT: § 5 ECG,
CH: Art. 3 lit. s UWG). Diese Daten sind damit
**absichtlich veröffentlichte Pflichtangaben** — die sauberste verfügbare
Quelle für Entscheidernamen, und deutlich belastbarer als geratene
`vorname.nachname@`-Muster.

## Ablauf

```bash
# 1) Impressen auslesen (Kandidaten -> Rohdaten)
python3 impressum_scraper.py kandidaten-dach-ecommerce.txt leads_raw.csv 10

# 2) Filtern, deduplizieren, auf die besten 100 kürzen
python3 build_leadlist.py leads_raw.csv leads.csv 100
```

`kandidaten-dach-ecommerce.txt` enthält eine Zeile pro Firma im Format
`domain,branche`. Zeilen mit `#` sind Kommentare.

## Was das erste Skript tut

- probiert die üblichen Impressum-Pfade, sonst folgt es dem Impressum-Link
  auf der Startseite
- wählt den **inhaltlich passenden** Abschnitt: „Impressum" steht auf fast
  jeder Seite auch in der Navigation, deshalb wird der Abschnitt mit den
  meisten echten Merkmalen (Rechtsform, Registereintrag, USt-ID …) genommen
- macht Anti-Spam-Schreibweisen (`name (at) firma.de`) rückgängig
- extrahiert Firmierung, Geschäftsführung/Inhaber, E-Mail, Telefon, Anschrift,
  Handelsregister- und USt-Nummer
- verwirft alles, was sich nicht live verifizieren lässt (`status`-Spalte)

## Die Spalte `firma_geprueft`

Impressen nennen manchmal nicht den Shop-Betreiber, sondern die Agentur oder
eine Gesellschafterin (z.B. „RYZE Digital GmbH" auf gepa-shop.de). Solche Namen
lassen sich nicht einfach verwerfen — „Bauer + Kirch GmbH" ist für
bike-components.de ja die richtige Betreibergesellschaft. Deshalb wird nur
markiert:

| Wert | Bedeutung |
|---|---|
| `ja` | Firmierung passt zur Domain oder zur Mail-Domain |
| `pruefen` | Firmierung weicht ab — meist trotzdem korrekt, vor der Ansprache kurz gegenprüfen |
| *(leer)* | keine Firmierung gefunden, es steht die Domain in der Spalte |

## Grenzen (ehrlich)

- **Rund ein Drittel der Shops ist nicht auslesbar.** Große Händler setzen
  Bot-Schutz (Cloudflare, Akamai) ein und liefern 403. Diese Datensätze
  erscheinen als `kein_impressum_erreichbar` und fallen raus.
- **Es entstehen keine persönlichen Direkt-Mails.** Das Impressum nennt den
  Geschäftsführer namentlich, aber als Kontakt meist ein Sammelpostfach
  (`info@`). Die Spalte `datenqualitaet` gewichtet spezifischere Postfächer höher.
- **Konzern-Impressen nennen die Holding-Geschäftsführung**, nicht die für
  einen Einkauf zuständige Person.
- **Rund jede achte Firmierung fehlt** (JS-gerenderte Impressen); dort steht
  die Domain in der Spalte `firma`. Kontaktdaten und Entscheidername sind in
  diesen Fällen trotzdem vorhanden.

## Tests

`python3 test_extraktion.py` prüft die Extraktionsmuster. Die Muster sind
regex-lastig, und zwei Fehler sind hier bereits durchgerutscht: eine fehlende
Wortgrenze schnitt „Max Mustermann" zu „Max M" ab (das Stoppwort `USt` traf
das „ust" in „M**ust**ermann"), und Datumsangaben wurden als Telefonnummern
erfasst. Beide Fälle sind jetzt abgedeckt — bei Änderungen an den Mustern
bitte laufen lassen.

## Datenschutz

Die Liste enthält mit dem Namen der Geschäftsführung personenbezogene Daten.
Für B2B-Ansprache im eigenen Geschäftsinteresse kommt Art. 6 Abs. 1 lit. f
DSGVO als Grundlage in Betracht; für **E-Mail-Werbung** gilt zusätzlich § 7
UWG (in Deutschland ist Kaltakquise per Mail ohne Einwilligung grundsätzlich
unzulässig). Telefonische B2B-Ansprache setzt eine mutmaßliche Einwilligung
voraus. Beim ersten Kontakt sind die Informationspflichten nach Art. 14 DSGVO
zu erfüllen und ein Widerspruch jederzeit zu ermöglichen.
Das ist ein Hinweis, keine Rechtsberatung.

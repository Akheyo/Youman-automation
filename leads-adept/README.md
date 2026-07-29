# B2B-Lead-Liste adept&

Zielgruppe: mittelständische Unternehmen in Deutschland (Schwerpunkt NRW),
ca. 50–1000 Mitarbeiter, bevorzugt familien-/inhabergeführt, keine Konzerne.
Branchen: Automobil & Zulieferer, Maschinenbau & Fertigung,
Logistik & Supply Chain, Chemie & Prozessindustrie.

## Dateien

| Datei | Inhalt |
|---|---|
| `leads-adept.xlsx` | Lead-Tabelle (Blatt „Leads"), Zusammenfassung je Branche, Liste der verworfenen Kandidaten |
| `leads-adept.csv` | Dieselbe Lead-Tabelle als CSV (Semikolon-getrennt, UTF-8 mit BOM für Excel) |
| `rohdaten/*.json` | Rohergebnisse der Recherche je Branche/Region, inkl. wörtlichem Beleg-Zitat und Quell-URL pro E-Mail |
| `build_leads.py` | Baut CSV und XLSX aus den Rohdaten, prüft die Qualitätsregeln und entfernt Dubletten |
| `verify_leads.py` | Ruft je Lead die Quell-URL erneut ab und belegt die Adresse wörtlich im HTML |
| `pruefe_qualitaet.py` | Meldet Leads zur Nachkontrolle: fremde Domain, unklare Position, Größe, Mehrfachkontakte |

## Ergebnis

| Branche | Leads | Verworfene Kandidaten |
|---|---:|---:|
| Automobil & Zulieferer | 52 | 151 |
| Maschinenbau & Fertigung | 68 | 323 |
| Logistik & Supply Chain | 64 | 122 |
| Chemie & Prozessindustrie | 49 | 226 |
| **Gesamt** | **233** | **822** |

Geprüft wurden damit über 1.000 Firmen. Verworfen wurde überwiegend, wer keine
persönliche Entscheidungsträger-Adresse veröffentlicht, dazu Konzerne und
Betriebe außerhalb des Größenkorridors.

## Qualitätsregeln

1. Nur E-Mail-Adressen, die beim Crawl wörtlich auf einer Seite standen
   (mailto-Links zählen). Adressen werden nie geraten oder aus Namensmustern
   abgeleitet.
2. Jede Angabe hat die Quell-URL, auf der sie steht.
3. Zentrale Adressen (`info@`, `kontakt@`, `vertrieb@`, `office@` …) gelten
   nicht als Lead — solche Firmen wurden verworfen und ersetzt.
4. Nicht auffindbare Angaben bleiben leer bzw. sind mit „nicht öffentlich"
   markiert.
5. Adressen von Webdesignern, Agenturen oder Handelsvertretern aus dem
   Impressum zählen nicht als Entscheidungsträger-Kontakt.
6. Reine Vertriebsrollen (Key Account, Gebietsvertrieb, Leiter Vertrieb) sind
   keine Entscheidungsträger für ein Prozess- und ERP-Projekt und fallen
   heraus. Doppelrollen mit Geschäftsführung, Produktions-, Logistik- oder
   IT-Leitung bleiben drin.

Regel 1 ist nicht nur eine Vorgabe an die Recherche, sondern wird erzwungen:
`verify_leads.py` ruft jede Quell-URL erneut ab und sucht die Adresse wörtlich
im ausgelieferten HTML (inklusive Cloudflare-Verschleierung und URL-kodierter
mailto-Links). Nur bestätigte Adressen nimmt `build_leads.py` in die Tabelle
auf. Diese Stufe hat sieben frei erfundene Adressen abgefangen — auf den
angegebenen Seiten standen dort nur Funktionspostfächer oder andere Personen.

## Neu bauen

```bash
pip install openpyxl
python3 verify_leads.py           # belegt jede Adresse gegen ihre Quelle
python3 verify_leads.py --erneut  # prüft auch bereits bestätigte Adressen neu
python3 build_leads.py            # liest ./rohdaten
python3 build_leads.py <ordner>   # oder ein anderes Rohdaten-Verzeichnis
python3 pruefe_qualitaet.py       # inhaltliche Nachkontrolle
```

Erweitern: weitere Recherche-Ergebnisse als JSON nach `rohdaten/` legen (Format
siehe vorhandene Dateien), dann die drei Schritte oben erneut ausführen.

## Datenschutz-Hinweis

Die Liste enthält geschäftliche Kontaktdaten, die die Unternehmen selbst
öffentlich auf ihren Websites veröffentlicht haben. Für die werbliche
Ansprache gelten DSGVO und UWG: Bei E-Mail-Werbung an Unternehmen ist ein
berechtigtes Interesse bzw. eine Einwilligung erforderlich, jede Nachricht
braucht Absenderkennzeichnung und Widerspruchsmöglichkeit, und einem
Widerspruch ist unverzüglich nachzukommen.

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

## Neu bauen

```bash
pip install openpyxl
python3 build_leads.py            # liest ./rohdaten
python3 build_leads.py <ordner>   # oder ein anderes Rohdaten-Verzeichnis
```

## Datenschutz-Hinweis

Die Liste enthält geschäftliche Kontaktdaten, die die Unternehmen selbst
öffentlich auf ihren Websites veröffentlicht haben. Für die werbliche
Ansprache gelten DSGVO und UWG: Bei E-Mail-Werbung an Unternehmen ist ein
berechtigtes Interesse bzw. eine Einwilligung erforderlich, jede Nachricht
braucht Absenderkennzeichnung und Widerspruchsmöglichkeit, und einem
Widerspruch ist unverzüglich nachzukommen.

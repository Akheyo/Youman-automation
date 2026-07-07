# 📡 Anfragen-Radar

Interne Windows-Desktop-Software der **Komplett Konzept Verwertungs GmbH**
(B2B-Gebrauchtmaschinen-Handel).

Die App überwacht das Postfach `maschinensucher@komplett-konzept.de`,
erkennt Maschinensucher-**Kategorie-Anfragen** (Kaufgesuche), analysiert sie
per Anthropic-LLM (Übersetzung, technische Anforderungen, Suchbegriffe) und
sucht automatisch passende Maschinen – **zuerst im eigenen Bestand**
(PlentyONE + eigene Maschinensucher-Inserate), dann auf dem
Maschinensucher-Marktplatz, auf externen Marktplätzen (eBay, Kleinanzeigen,
Surplex, TradeMachines, RESALE, Exapro, Mascus, Machinio, Machineseeker.com,
gebrauchtmaschinen.de) und im freien Netz. Die Treffer erscheinen in einem
internen Dashboard, damit der Vertrieb aktiv Angebote machen kann.

> **Kein automatischer Mailversand** – die App zeigt nur intern an.

## Architektur

```
anfragen-radar/
├── run.py            # Endnutzer-Einstieg (startet Streamlit + Browser)
├── app.py            # Streamlit-Hauptdatei (Navigation, Bootstrap)
├── core/             # Logik
│   ├── config.py         # Einstellungen, lokal verschlüsselt (Fernet)
│   ├── mail_listener.py  # IMAP IDLE + Polling-Fallback + Reconnect
│   ├── mail_parser.py    # Parser für Kategorie-Anfragen-Mails
│   ├── llm.py            # Anthropic: Übersetzung, Extraktion, Suchbegriffe
│   ├── pipeline.py       # Mail -> Anfrage -> Analyse -> Suche -> DB
│   └── search.py         # Parallele Suche über alle Quellen + Ranking
├── sources/          # Suchquellen als Plugins (sources/base.py = Interface)
├── ui/               # Streamlit-Seiten (Übersicht, Detail, Einstellungen, Logs)
├── db/               # SQLite (Schema, Migrationen, CRUD)
├── tests/            # Unit-Tests + Beispiel-Mail-Fixtures
└── packaging/        # PyInstaller-Spec + Inno-Setup-Skript
```

Alle Daten liegen lokal unter `%APPDATA%/AnfragenRadar/`:
`anfragen_radar.sqlite3` (Datenbank), `config.enc` (verschlüsselte
Einstellungen), `config.key` (lokaler Schlüssel), `logs/`.

## Entwicklung

Voraussetzungen: Python 3.11+

```bash
cd anfragen-radar
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements-dev.txt

# Tests
python -m pytest tests/ -v

# App starten
streamlit run app.py
```

Beim ersten Start auf die Seite **Einstellungen** gehen und eintragen:

1. **IMAP**: Host, Port, Benutzer, Passwort (+ „IMAP-Verbindung testen“)
2. **Anthropic-API-Key** (für Übersetzung/Analyse; Modell konfigurierbar)
3. **PlentyONE**- und **Maschinensucher-API**-Zugangsdaten (eigener Bestand)
4. Optional: Brave-Search-/SerpAPI-Key (sonst DuckDuckGo-Fallback)

Der Mail-Listener startet automatisch als Hintergrund-Thread und läuft,
solange der Streamlit-Server läuft – auch ohne offenen Browser-Tab.
Zusätzlich gibt es auf der Übersichtsseite den Button
**„Postfach jetzt prüfen“**.

### Neue Suchquelle ergänzen

1. Klasse von `sources.base.Source` ableiten (`search(terms, context) -> list[Hit]`),
2. in `sources/__init__.py` bei `ALL_SOURCES` registrieren,
3. Schalter in `core/config.py` unter `DEFAULTS["sources_enabled"]` ergänzen.

Für einfache Marktplatz-Scraper reicht eine Subklasse von
`sources.marketplaces.ScrapedMarketplace` (nur Such-URL + Link-Muster).

**Hinweis Scraper:** Die Portale ändern ihr Markup gelegentlich. Die Plugins
nutzen bewusst eine generische Link-Heuristik; wenn eine Quelle keine
Treffer mehr liefert, zuerst Such-URL/`href_pattern` des Plugins prüfen
(Fehler pro Quelle sind im Dashboard und auf der Log-Seite sichtbar).

## Endnutzer-Installation (Setup.exe)

1. Unter GitHub-Releases die aktuelle `AnfragenRadar-Setup-<version>.exe`
   herunterladen und installieren (keine Admin-Rechte nötig).
2. „Anfragen-Radar“ starten – der Server läuft unsichtbar im Hintergrund,
   der Browser mit dem Dashboard öffnet sich automatisch
   (http://127.0.0.1:8531).
3. Einstellungen ausfüllen (siehe oben). Fertig.
4. Optional beim Setup „Beim Windows-Start automatisch starten“ anhaken,
   damit die App auf dem Firmen-PC dauerhaft läuft.

Hinweise:

- Browser-Tab schließen beendet die App **nicht** – die Mail-Überwachung
  läuft im Hintergrund weiter. Erneuter Doppelklick auf „Anfragen-Radar“
  öffnet das Dashboard wieder (startet keinen zweiten Server).
- Komplett beenden: Einstellungen → „Anfragen-Radar beenden“.
- Server-Logs liegen in `%APPDATA%/AnfragenRadar/logs/`.

## Release bauen

Ein Git-Tag `radar-v<version>` pushen – GitHub Actions
(`.github/workflows/anfragen-radar-release.yml`) baut automatisch:

```
Tests -> PyInstaller (onedir) -> Inno Setup -> Setup.exe als Release-Asset
```

```bash
git tag radar-v1.0.0
git push origin radar-v1.0.0
```

Manueller Build (auf Windows):

```bash
pip install -r requirements-dev.txt
pyinstaller packaging/anfragen_radar.spec --noconfirm
ISCC.exe packaging\installer.iss /DAppVersion=1.0.0
```

## Sicherheit

- Zugangsdaten werden **nur lokal** gespeichert, verschlüsselt mit Fernet
  (`config.enc` + lokaler Schlüssel `config.key`), nichts im Repo.
- Postfach-Zugriff ist read-only: Mails werden nie gelöscht/verschoben;
  „als gelesen markieren“ ist optional (Standard: aus).
- Scraper mit respektvollem Rate-Limit (min. 2 s pro Domain) und
  Browser-User-Agent.

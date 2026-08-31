# Umsetzung: SEO live in WordPress ausrollen

Diese Skripte setzen die **automatisierbaren** Maßnahmen aus dem Audit direkt in WordPress um —
per REST API mit einem **Application Password**. Du startest sie **lokal** (die Cloud-Session
kann die Domain netzwerkseitig nicht erreichen).

## Was automatisiert wird
| Maßnahme | Weg | REST-schreibbar? |
|----------|-----|:----------------:|
| Bild-Alt-Texte | `/wp/v2/media` `alt_text` | ✅ direkt |
| Seiten-Inhalte | `/wp/v2/pages` `content` | ✅ direkt |
| SEO-Metas (Title/Desc/Focus) | Yoast/Rank-Math Meta-Keys | ⚠️ erst nach mu-Plugin |
| Schema (LocalBusiness/FAQ) | mu-Plugin gibt JSON-LD im `<head>` aus | ✅ via mu-Plugin |

## Voraussetzungen
- **Node.js ≥ 18** (für `wp-seo-apply.mjs`) — oder `bash`+`curl` für `wp-seo-check.sh`.
- Ein **Application Password**: WordPress → *Benutzer → Profil → Anwendungspasswörter*.
- Nutzer mit Rolle **Administrator** oder **Editor** (Rechte `edit_pages`).

## Schritt 1 — Zugang einrichten
```bash
cd seo-output/implementation
cp .env.example .env
# .env öffnen und WP_BASE_URL / WP_USER / WP_APP_PASSWORD eintragen
```
> 🔒 `.env` niemals committen (steht in `.gitignore`). App-Passwörter gehören nicht ins Repo/den Chat.

## Schritt 2 — Verbindung testen (nichts wird geändert)
```bash
set -a; source .env; set +a
node wp-seo-apply.mjs          # Dry-Run: Auth, SEO-Plugin, Seiten, Bilder-ohne-Alt
# alternativ, ohne Node:
./wp-seo-check.sh
```

## Schritt 3 — mu-Plugin installieren (macht SEO-Metas REST-schreibbar + Schema)
1. `mu-plugin-seo.php` öffnen, **Platzhalter** (Telefon, E-Mail, Logo-Pfad, Öffnungszeiten,
   Social-URLs) ersetzen.
2. Falls Yoast/Rank Math bereits Organization/LocalBusiness ausgeben → im mu-Plugin
   `define('ABSE_EMIT_SCHEMA', false);` setzen (Teil 1/REST bleibt aktiv, Schema-Duplikat vermeiden).
3. Datei hochladen nach `wp-content/mu-plugins/seo-abse.php` (Ordner ggf. anlegen).
   Upload via SFTP/Hosting-Dateimanager. mu-Plugins sind sofort aktiv.

## Schritt 4 — Änderungen ausrollen
```bash
# Zuerst Mapping-Dateien prüfen/anpassen:
#   meta-map.json   (Slugs an echte WP-Slugs anpassen; Dry-Run listet sie)
#   alt-texts.json  (IDs/Dateinamen aus dem Dry-Run eintragen)

node wp-seo-apply.mjs --apply --meta        # SEO-Metas setzen
node wp-seo-apply.mjs --apply --alt         # Alt-Texte setzen
node wp-seo-apply.mjs --apply --meta --alt  # beides
```
Das Skript meldet je Seite ✅/⚠️. Ein ⚠️ bei Metas heißt: Meta-Key ist (noch) nicht
REST-registriert → mu-Plugin installieren **oder** Metas manuell aus `../02-META-COPY-PASTE.md`.

## Schritt 5 — validieren
- Schema: https://search.google.com/test/rich-results (nach Freigabe der Domain)
- Metas: Seitenquelltext prüfen (`<title>`, `<meta name="description">`)
- Alt-Texte: erneuter Dry-Run → „Bilder ohne Alt-Text: 0"

## Manuell (nicht per API)
- 301-Weiterleitung Domain-Dublette (energy/energie) — Hoster/`.htaccess`
- `robots.txt` (`../04-robots.txt`) — falls physische Datei, sonst SEO-Plugin
- Google Business Profile, Bewertungen, Citations — `../05-LOCAL-SEO-GEO.md`
- Core Web Vitals (Caching, Bildoptimierung-Plugin) — `../01-ACTION-PLAN.md` H4

## Sicherheit
- Skripte lesen Zugangsdaten **nur** aus Umgebung/`.env`, loggen sie **nie**.
- Standard ist **Dry-Run** — Schreiben nur mit explizitem `--apply`.
- App-Passwort jederzeit in WordPress widerrufbar (Profil → Anwendungspasswörter).

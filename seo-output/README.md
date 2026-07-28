# SEO-Optimierung — ab-solarenergy.de (A&B Solarenergy GmbH)

Komplettes SEO-Paket: Audit, priorisierter Maßnahmenplan, fertige Assets (Schema, Metas,
robots.txt) und ein lauffähiges Skript, das die automatisierbaren Änderungen per
**WordPress REST API** (Application Password) ausrollt.

> **Wichtig — Warum „Paket" statt „live umgesetzt":**
> Diese Cloud-Session kann `ab-solarenergy.de` **netzwerkseitig nicht erreichen**
> (Egress-Policy der Web-Umgebung blockt ausgehendes HTTPS; auch die WP-REST-API ist damit
> unerreichbar — ein Application Password würde daran nichts ändern). Deshalb sind alle
> API-Schreibvorgänge als **lokal ausführbares Skript** vorbereitet. Wie du echten Live-Zugriff
> in einer Folge-Session bekommst: `NETWORK-POLICY.md`.

## Inhalt
| Datei | Inhalt |
|-------|--------|
| `00-AUDIT-REPORT.md` | Voller Audit (Technik, E-E-A-T, Schema, Sitemap, CWV, Bilder, Local, GEO) + Health-Score |
| `01-ACTION-PLAN.md` | Priorisierte Fundliste (Critical→Low) mit Aufwand, Prüfkriterien, Reihenfolge |
| `02-META-COPY-PASTE.md` | Fertige Yoast/Rank-Math Titles & Descriptions je Seite |
| `03-schema/` | JSON-LD: Organization+LocalBusiness, Service, FAQ, Breadcrumb, WebSite (+ Einbau-README) |
| `04-robots.txt` | Empfohlene robots.txt |
| `05-LOCAL-SEO-GEO.md` | GBP, NAP-Standard, Citations, Bewertungen, GEO/AI-Search |
| `06-CONTENT-PLAN.md` | Site-Architektur, Keyword-Cluster, Landingpage-Bausteine, Redaktionsplan |
| `implementation/` | REST-API-Skript, mu-Plugin, Config-Vorlagen, Anleitung |
| `NETWORK-POLICY.md` | Wie man die Domain für echten Live-Zugriff freigibt |

## Schnellstart (live ausrollen)
```bash
cd seo-output/implementation
cp .env.example .env      # Zugangsdaten eintragen (App-Password)
set -a; source .env; set +a
node wp-seo-apply.mjs                     # 1) Dry-Run/Audit (nichts wird geändert)
# mu-plugin-seo.php nach wp-content/mu-plugins/ hochladen (Metas REST-schreibbar + Schema)
node wp-seo-apply.mjs --apply --meta --alt  # 2) ausrollen
```
Details: `implementation/README.md`.

## Datengrundlage / Ehrlichkeit
Firmendaten (Name, Adresse Borken, Geschäftsführer) sind über öffentliche Register
**verifiziert**. Live-HTML/Schema/CWV konnten **nicht** gemessen werden — jeder Befund im Audit
ist als ✅ verifiziert / 🔶 Annahme / 🔍 zu prüfen gekennzeichnet. Platzhalter `<<…>>` vor dem
Ausrollen durch echte Werte ersetzen. **Keine erfundenen Bewertungen** ins Schema (siehe
`03-schema/README.md`).

*Erstellt mit der vendored claude-seo Skill-Suite (v2.2.4, MIT) — `.claude/skills/`.*

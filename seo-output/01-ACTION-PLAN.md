# Maßnahmenplan (priorisiert) — ab-solarenergy.de

Reihenfolge nach **Impact × Dringlichkeit ÷ Aufwand**. Jede Maßnahme mit Nachweis-/Prüfkriterium
(Falsifizierbarkeit) und Umsetzungsweg (🤖 automatisierbar per Skript / ✍️ manuell / ⚙️ Server/DNS).

Legende Aufwand: S = klein (<30 min), M = mittel (0,5–2 h), L = groß (>2 h).

---

## 🔴 CRITICAL — zuerst

| # | Maßnahme | Weg | Aufwand | Prüfkriterium |
|---|----------|-----|:-------:|---------------|
| C1 | **Kanonische Domain festlegen** (energy **oder** energie) und **alle** Varianten per **301** dorthin leiten (mit/ohne www, http→https, die jeweils andere Schreibweise). | ⚙️ Hoster/DNS + `.htaccess`/Server | M | `curl -I` auf alle Varianten → 301 auf 1 Ziel; `site:`-Abfrage zeigt nur 1 Domain |
| C2 | **Google Search Console** für die kanonische Domain (Domain-Property) einrichten + Sitemap einreichen. | ✍️ | S | GSC verifiziert, Sitemap „Erfolgreich" |
| C3 | **Impressum & Datenschutz** vollständig & rechtssicher (HRB, GF, USt-IdNr., Kontakt). | ✍️ (WP-Seite, teils 🤖) | M | Seiten vorhanden, alle Pflichtangaben |
| C4 | **LocalBusiness/Organization-Schema** einbauen (JSON-LD `03-schema/`). | 🤖 mu-Plugin | S | Rich Results Test: „LocalBusiness" erkannt, 0 Fehler |

## 🟠 HIGH

| # | Maßnahme | Weg | Aufwand | Prüfkriterium |
|---|----------|-----|:-------:|---------------|
| H1 | **SEO-Metas** (Title/Description/Focus-KW) für Startseite + alle Service-Seiten setzen. | 🤖 (mit mu-Plugin) / ✍️ (`02-META-COPY-PASTE.md`) | M | Jede Seite: einzigartiger Title ≤ 60 Z., Description 140–160 Z. |
| H2 | **Eigene Service-Landingpages** je Leistung (PV, Speicher, Wallbox, Wärmepumpe) mit lokalem Bezug. | ✍️/🤖 (Grundgerüst) | L | 4+ Seiten, je ≥ 600 Wörter, H1 mit Keyword+Ort |
| H3 | **Bild-Alt-Texte** flächendeckend setzen. | 🤖 REST `/wp/v2/media` | S | 0 Bilder ohne Alt-Text (Skript-Report) |
| H4 | **Core Web Vitals**: Hero-Bild WebP + dimensioniert, Caching-Plugin, ungenutzte Plugins entfernen. | ✍️ | M | PSI mobil: LCP < 2,5 s, INP < 200 ms, CLS < 0,1 |
| H5 | **Über-uns/Team-Seite** mit echten Personen, Zertifikaten, Fotos (E-E-A-T). | ✍️/🤖 | M | Seite live, Personen + Qualifikationen genannt |
| H6 | **FAQ-Seite/-Block + FAQPage-Schema** (Kosten, Förderung NRW, Ablauf, Speicher). | 🤖 Schema + ✍️ Text | M | Rich Results Test: „FAQ" erkannt |

## 🟡 MEDIUM

| # | Maßnahme | Weg | Aufwand | Prüfkriterium |
|---|----------|-----|:-------:|---------------|
| M1 | **Google Business Profile** optimieren (Kategorien, Fotos, Leistungen, Beiträge). | ✍️ | M | GBP vollständig, ≥ 10 Fotos |
| M2 | **NAP-Konsistenz** über Website + GBP + Verzeichnisse herstellen. | ✍️ | M | NAP identisch auf allen Citations (`05-…`) |
| M3 | **Bewertungsstrategie** (Google/ProvenExpert) starten. | ✍️ | S | Prozess aktiv, erste neue Bewertungen |
| M4 | **Interne Verlinkung** Hub→Spoke (Start → Service-Seiten → Referenzen/FAQ). | 🤖/✍️ | M | Jede Service-Seite ≥ 3 interne Links |
| M5 | **Ratgeber/Blog** (2–4 Artikel: „PV Kosten Borken", „Förderung NRW 2026", „Speicher lohnt sich?"). | ✍️ | L | Artikel live, BreadcrumbList-Schema |
| M6 | **Bilder** WebP/AVIF-Konvertierung + Kompression (Plugin). | ✍️ | M | Alle > 200 KB komprimiert |

## 🟢 LOW

| # | Maßnahme | Weg | Aufwand | Prüfkriterium |
|---|----------|-----|:-------:|---------------|
| L1 | **BreadcrumbList-Schema** sitewide. | 🤖 mu-Plugin/Plugin | S | Breadcrumbs in Rich Results |
| L2 | **WebSite + SearchAction**-Schema (Sitelinks-Searchbox). | 🤖 mu-Plugin | S | Schema valide |
| L3 | **GEO/AI**: klare Frage-Antwort-Blöcke, optional `llms.txt`. | ✍️ | S | FAQ-Blöcke zitierfähig |
| L4 | **HSTS + Security-Header** setzen. | ⚙️ Server | S | securityheaders.com ≥ A |

---

## Abhängigkeiten / Reihenfolge

```
C1 (Domain) ──► C2 (GSC) ──► H1 (Metas) ──► H2 (Service-Seiten) ──► M4/M5 (Links/Blog)
C4 (Schema) ──► H6/L1/L2 (weitere Schemas)
H3/H4/M6 (Bilder/CWV) parallel möglich
M1/M2/M3 (Local) parallel, unabhängig von Technik
```
**C1 zuerst** — sonst optimiert man auf die falsche/dublette Domain.

---

## Health-Score-Rubrik (für exakte Neuberechnung nach Live-Check)

Pro Dimension 0–100, gewichtet (siehe `00-AUDIT-REPORT.md` §2). Punktvergabe:

- **Technik:** je −15 für: fehlende 301-Kanonik, `noindex`/robots-Fehler, kein HTTPS, defekte Canonicals.
- **Content/E-E-A-T:** +20 Über-uns m. Personen, +20 Referenzen, +20 Impressum vollständig, +20 Service-Tiefe, +20 Bewertungen sichtbar.
- **Schema:** +30 LocalBusiness valide, +25 Service, +25 FAQ, +20 Breadcrumb/WebSite.
- **Sitemap:** +50 valide in GSC, +50 nur kanonische URLs.
- **CWV:** LCP<2,5s=+40, INP<200ms=+35, CLS<0,1=+25 (jeweils mobil, Felddaten).
- **Bilder:** +50 alle Alt-Texte, +30 WebP, +20 dimensioniert.
- **Local:** +40 GBP optimiert, +30 NAP konsistent, +30 Bewertungen aktiv.
- **GEO:** +50 FAQ/zitierfähig, +30 Marken-Mentions, +20 AI-Crawler-Zugriff.

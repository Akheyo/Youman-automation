# JSON-LD Schemas — Einbau & Hinweise

## Dateien
| Datei | Typ | Wohin |
|-------|-----|-------|
| `organization-localbusiness.jsonld` | Organization + LocalBusiness | **sitewide** (jede Seite, `<head>`) |
| `website-searchaction.jsonld` | WebSite + SearchAction | **sitewide** (`<head>`) |
| `service-photovoltaik.jsonld` | Service | nur `/photovoltaik/` (Vorlage für weitere Services) |
| `faq.jsonld` | FAQPage | nur FAQ-Seite / Seiten mit sichtbarem FAQ-Block |
| `breadcrumb-example.jsonld` | BreadcrumbList | je Seite mit passendem Pfad |

## Einbau-Optionen (Reihenfolge nach Empfehlung)
1. **🤖 Automatisch (empfohlen):** mu-Plugin `implementation/mu-plugin-seo.php` — gibt
   Organization/LocalBusiness + WebSite + FAQ automatisch im `<head>` aus. Kein manueller Schritt.
2. **SEO-Plugin:** Yoast/Rank Math erzeugen Teile automatisch — dann NICHT doppeln. Nur ergänzen,
   was fehlt (LocalBusiness-Details, Service, FAQ).
3. **Manuell:** Inhalt der `.jsonld` in ein `<script type="application/ld+json"> … </script>`
   im `<head>` einfügen (z. B. via „Insert Headers and Footers"-Plugin oder Theme-Header).

## ⚠️ Pflicht: Platzhalter ersetzen
Alle `<<…>>` durch **echte** Werte ersetzen: `<<+49-TELEFON>>`, `<<E-MAIL>>`, `<<LAT>>/<<LON>>`,
`<<GOOGLE-MAPS-URL>>`, Social-URLs, Logo-/Bild-Pfade.

## ⚠️ Integrität: `aggregateRating`
Der Block `aggregateRating` in `organization-localbusiness.jsonld` darf **nur echte** Bewertungen
abbilden (z. B. reale Google-Bewertungen). **Erfinde keine Sterne/Anzahl** — Google straft
Fake-Review-Markup ab (Manual Action) und es ist schlicht falsch. Wenn (noch) keine belastbaren
Bewertungen vorliegen: **den kompletten `aggregateRating`-Block entfernen**, bis echte da sind.

## Validieren (nach Einbau, sobald Domain erreichbar)
- Rich Results Test: https://search.google.com/test/rich-results
- Schema Validator: https://validator.schema.org/

## Domain-Hinweis
Alle `@id`/URLs nutzen `ab-solarenergy.de`. Ist die **kanonische** Domain `…energie.de`,
per Suchen/Ersetzen anpassen (muss zur 301-Kanonik aus `01-ACTION-PLAN.md` C1 passen).

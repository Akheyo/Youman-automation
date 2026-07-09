---
name: seo-audit
description: Führt ein technisches SEO-Audit für eine Domain oder URL durch (Meta-Tags, Überschriften, Indexierbarkeit, Sitemap, strukturierte Daten, Performance-Hinweise) und erstellt einen priorisierten Bericht auf Deutsch. Nutzen, wenn der Nutzer /seo-audit <domain> aufruft oder eine Website auf SEO prüfen lassen will.
argument-hint: <domain-oder-url>
---

# SEO-Audit

Führe ein technisches SEO-Audit für die übergebene Domain durch: `$ARGUMENTS`

Wenn keine Domain übergeben wurde, frage nach der zu prüfenden Domain.

## Vorgehen

Normalisiere die Eingabe zuerst zu einer URL (`https://<domain>/`, ohne Schema angegeben → `https://` annehmen).

### 1. Erreichbarkeit & Basis-Setup

Prüfe mit `curl -sIL` (Redirects folgen, max. 10):

- HTTP-Statuscode der Startseite (Ziel: 200)
- Redirect-Kette: `http://` → `https://`, `www` vs. non-`www` — genau eine kanonische Variante, alle anderen per 301 dorthin
- HTTPS-Zertifikat gültig
- Antwortzeit (TTFB) der Startseite: `curl -so /dev/null -w '%{time_starttransfer}s'`
- Wichtige Header: `content-type` (Charset), Caching (`cache-control`), Kompression (`content-encoding` bei Request mit `Accept-Encoding: gzip, br`)

### 2. Indexierbarkeit

- `robots.txt` laden: existiert sie, blockiert sie versehentlich wichtige Pfade (`Disallow: /`), verweist sie auf die Sitemap?
- `sitemap.xml` (bzw. den in robots.txt genannten Pfad) laden: erreichbar, gültiges XML, wie viele URLs, stimmen die URLs mit der kanonischen Domain-Variante überein?
- Auf der Startseite: `<meta name="robots">` und `X-Robots-Tag`-Header — kein unbeabsichtigtes `noindex`/`nofollow`

### 3. On-Page (Startseite + bis zu 5 wichtige Unterseiten aus der Sitemap)

HTML mit `curl -sL` laden und prüfen:

- `<title>`: vorhanden, einzigartig, ca. 30–60 Zeichen, enthält das Hauptkeyword
- `<meta name="description">`: vorhanden, ca. 70–160 Zeichen
- Genau ein `<h1>`, sinnvolle H2/H3-Hierarchie ohne Sprünge
- `<link rel="canonical">`: vorhanden und konsistent mit der aufgerufenen URL
- `<html lang="...">` gesetzt und korrekt (z. B. `de`)
- `<meta name="viewport">` vorhanden (Mobile-Tauglichkeit)
- Open Graph (`og:title`, `og:description`, `og:image`) und optional Twitter Cards
- Strukturierte Daten (`application/ld+json`): vorhanden? Passender Typ (z. B. `LocalBusiness`, `Organization`, `Product`)? Bei lokalen Unternehmen: NAP-Daten (Name, Adresse, Telefon) enthalten?
- Bilder: Anteil ohne `alt`-Attribut, auffällig große Bilddateien
- Interne Verlinkung: Anzahl interner Links, offensichtlich kaputte Links (Stichprobe von max. 10 per `curl -sI` prüfen)
- Hreflang-Tags, falls mehrsprachig

### 4. Performance-Hinweise (statisch, ohne Browser)

- Größe des HTML-Dokuments und Anzahl eingebundener JS/CSS-Dateien
- Render-blockierende Ressourcen im `<head>` (synchrones JS/CSS ohne `defer`/`async`/`media`)
- Bildformate (WebP/AVIF vs. JPEG/PNG), `loading="lazy"` bei Bildern
- Web-Fonts: `font-display`, Preload

### 5. Bericht

Erstelle den Bericht auf Deutsch in dieser Struktur:

1. **Zusammenfassung** — 2–3 Sätze Gesamteindruck plus Gesamtnote (1–10)
2. **Kritische Probleme** 🔴 — verhindern Indexierung/Ranking, sofort beheben
3. **Wichtige Verbesserungen** 🟠 — deutlicher Hebel, zeitnah umsetzen
4. **Kleinere Optimierungen** 🟡 — nice-to-have
5. **Was gut ist** ✅
6. **Maßnahmenliste** — priorisierte, konkrete To-dos mit erwartetem Effekt

Jeder Befund nennt: was geprüft wurde, was gefunden wurde (mit konkretem Beleg, z. B. dem tatsächlichen Title-Text), und die konkrete Empfehlung.

## Hinweise

- Nur lesende Zugriffe (GET/HEAD) auf die Ziel-Domain — niemals Formulare absenden oder Login-Bereiche testen.
- Höchstens ~20 Requests pro Audit, keine parallelen Request-Stürme.
- Wenn die Seite nicht erreichbar ist (Netzwerk-Policy, Bot-Schutz), das klar im Bericht sagen und die Prüfschritte nennen, die dadurch entfallen sind — keine Befunde erfinden.
- Für JavaScript-lastige Seiten (leeres HTML ohne Inhalt): darauf hinweisen, dass das gerenderte DOM nicht geprüft wurde, und optional Playwright mit dem vorinstallierten Chromium nutzen, um das gerenderte HTML zu holen.

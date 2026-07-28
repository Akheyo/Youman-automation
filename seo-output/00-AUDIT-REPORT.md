# SEO-Audit — A&B Solarenergy GmbH (ab-solarenergy.de)

**Erstellt:** 2026-07-28
**Methodik:** claude-seo v2.2.4 (manueller Modus) — 10-Prinzipien-Synthese (PERCEIVE → ANALYZE → VALIDATE → ACT)
**Auditor:** Claude Code

---

## ⚠️ Wichtiger Hinweis zur Datengrundlage (Integrität)

Diese Web-Session konnte **die Live-Seite netzwerkseitig nicht erreichen** (Egress-Policy
blockt `ab-solarenergy.de:443`, ebenso jeden anderen ausgehenden HTTPS-Verkehr; WebFetch/curl
= 403, nur WebSearch verfügbar). Deshalb konnte ich das **echte HTML, Schema, die Meta-Tags
und Core-Web-Vitals nicht direkt messen**.

Damit dieser Report ehrlich bleibt, ist **jeder Befund gekennzeichnet**:

| Symbol | Bedeutung |
|--------|-----------|
| ✅ | **Verifiziert** — durch WebSearch/öffentliche Register belegt |
| 🔶 | **Annahme** — branchentypisch für junge, lokale WordPress-Solar-Betriebe; bitte am Live-System bestätigen |
| 🔍 | **Zu prüfen** — konkrete Prüfanweisung, Ergebnis am Live-System eintragen |

> Sobald die Netzwerk-Policy die Domain freigibt (siehe `NETWORK-POLICY.md`), kann ich in einer
> Folge-Session einen echten Live-Crawl + CWV-Messung fahren und diesen Report mit gemessenen
> Werten überschreiben. Die Deliverables (Schema, Metas, robots.txt, Skript) sind **jetzt schon
> real nutzbar**.

---

## 1. Unternehmenskontext (✅ verifiziert via öffentliche Register)

| Feld | Wert | Quelle |
|------|------|--------|
| Firma | **A&B Solarenergy GmbH** (vormals UG haftungsbeschränkt) | companyhouse.de, openregister.de |
| Anschrift | **Lange Stiege 66, 46325 Borken** (Kreis Borken, NRW) | photovoltaik-vergleichsrechner.de |
| Geschäftsführer | **Rami Alkhidou**, **Elias Boulos** | northdata.de |
| Gegründet | 2023 (UG → GmbH, Kapital 1.000 € → 25.000 €) | northdata.de |
| Handelsregister | HRB (openregister: DE-HRB-R2707-21128) | openregister.de |
| Branche | Photovoltaik / Solar — lokaler Fachbetrieb (SAB/hybrid) | — |
| Vom Nutzer genannte Domain | `https://ab-solarenergy.de/` | Auftrag |
| Indexierte Domain (Google) | `https://ab-solarenergie.de/` (dt. Schreibweise) | WebSearch |

> **⚠️ NICHT verwechseln** mit der eigenständigen **A&B-Solarenergie GmbH, Visbek** (Kantstr. 7,
> 49429 Visbek, HRB 219293 Oldenburg) — anderes Unternehmen, ähnlicher Name.

**🔶 Angenommenes Leistungsspektrum** (branchentypisch, **bitte bestätigen**):
Photovoltaik-Anlagen · Stromspeicher/Batteriespeicher · Wallbox/Ladeinfrastruktur ·
Wärmepumpe · Wartung/Service · ggf. Notstrom/Inselanlagen.

---

## 2. SEO Health Score (geschätzte Baseline)

> **Achtung:** Dies ist eine **projizierte Baseline** für einen jungen (2023), lokalen
> WordPress-Solarbetrieb — **keine gemessene Zahl**. Die Rubrik unten macht sie nach dem
> Live-Check exakt. Erfahrungswert für diese Betriebsklasse: **48–58 / 100**.

**Geschätzter Health-Score: ~52 / 100** 🔶

| Dimension | Gewicht | Est. | Begründung / typischer Zustand |
|-----------|:-------:|:----:|--------------------------------|
| Technik (Crawl/Index/HTTPS) | 15 % | 🔶 65 | WP-Standard meist ok; Domain-Dublette (energy/energie) drückt |
| Content & E-E-A-T | 20 % | 🔶 45 | Junge Firma → dünne Trust-Signale, wenig Tiefe |
| Schema / Structured Data | 15 % | 🔶 30 | LocalBusiness/Service/FAQ meist fehlend oder nur generisch |
| Sitemap & Indexierung | 10 % | 🔶 60 | Yoast/Rank Math liefert Sitemap; Feinschliff nötig |
| Performance / CWV | 15 % | 🔶 45 | Page-Builder (Elementor/Divi) + ungetunte Bilder → LCP/INP-Risiko |
| Bilder | 10 % | 🔶 40 | Alt-Texte & WebP/AVIF meist unvollständig |
| Local SEO (GBP/NAP) | 10 % | 🔶 55 | GBP oft vorhanden, aber NAP/Citations inkonsistent |
| GEO / AI-Search | 5 % | 🔶 35 | Kaum zitierfähige Passagen, keine llms.txt |

**Sobald live gemessen** → Score wird neu berechnet (Rubrik siehe `01-ACTION-PLAN.md`).

---

## 3. Befunde je Dimension

### 3.1 Technik / Crawlability / Indexierung

- **✅ KRITISCH — Domain-Dublette `ab-solarenergy.de` vs. `ab-solarenergie.de`.**
  Google indexiert die `…energie…`-Variante. Existieren beide Domains parallel ohne saubere
  301-Weiterleitung auf **eine** kanonische Domain, entsteht Duplicate Content, Verwässerung
  von Linkkraft und Verwirrung im Index.
  🔍 *Prüfen:* Welche Domain ist die „echte"? Löst die jeweils andere per **301** auf sie auf?
  → **Eine kanonische Domain festlegen, alle Varianten (mit/ohne www, http/https, energy/energie)
  per 301 dorthin leiten.**
- **🔍 robots.txt** — auf `Disallow: /` (versehentliche Komplettsperre), fehlende
  `Sitemap:`-Zeile prüfen. Empfehlung liegt bei: `04-robots.txt`.
- **🔍 Canonical-Tags** — auf jeder Seite genau **ein** selbstreferenzierender Canonical?
- **🔶 HTTPS/HSTS** — HTTPS bei modernem Hoster i. d. R. aktiv; HSTS-Header prüfen.
- **🔍 Indexierungsstatus** — `site:ab-solarenergy.de` vs. `site:ab-solarenergie.de` in Google
  vergleichen; Google Search Console für die kanonische Domain einrichten/verifizieren.

### 3.2 Content & E-E-A-T (Experience, Expertise, Authoritativeness, Trust)

- **🔶 Dünne Trust-Signale (typisch bei Gründung 2023).** Für lokale Handwerks-/Energiebetriebe
  sind E-E-A-T-Signale rankingentscheidend:
  - 🔍 **Über-uns / Team** mit echten Personen (Rami Alkhidou, Elias Boulos), Fotos, Qualifikationen,
    Zertifikaten (z. B. Elektrofachbetrieb, Meister, Herstellerzertifizierungen SolarEdge/Huawei/etc.).
  - 🔍 **Impressum & Datenschutz** vollständig (Pflicht in DE; auch Trust-Signal). HRB, GF, USt-IdNr.
  - 🔍 **Referenzen/Projekte** mit Bildern, kWp-Angaben, Ort — echte „Experience".
  - 🔍 **Bewertungen** (Google/ProvenExpert) sichtbar einbinden.
- **🔶 Service-Seiten dünn / generisch.** Je Leistung (PV, Speicher, Wallbox, Wärmepumpe) eine
  eigene, tiefe Landingpage mit lokalem Bezug (Borken, Kreis Borken, Münsterland) statt einer
  Sammelseite. → Content-Plan: `06-CONTENT-PLAN.md`.
- **🔍 Keine/kaum Ratgeber-Inhalte.** Blog/FAQ zu „Photovoltaik Kosten Borken", „Speicher
  nachrüsten", „Förderung NRW 2026" fehlt meist → verschenkte Informational-Intent-Rankings.

### 3.3 Schema / Structured Data

- **🔶 KRITISCH — LocalBusiness/Service/FAQ-Schema fehlt oder nur generisch.**
  Ohne strukturierte Daten keine Rich Results, schwächere Local-Pack- und AI-Overview-Chancen.
  → **Fertige JSON-LD liegen bei** (`03-schema/`): Organization+LocalBusiness, Service (PV),
  FAQPage, BreadcrumbList, WebSite (SearchAction). Autom. Einbau via mu-Plugin (siehe Skript).
- **🔍 Prüfen** mit [Rich Results Test](https://search.google.com/test/rich-results) &
  [Schema Validator](https://validator.schema.org/) nach Einbau.

### 3.4 Sitemap & Indexierung

- **🔶 XML-Sitemap vorhanden** (Yoast/Rank Math generiert automatisch `/sitemap_index.xml` bzw.
  `/sitemap.xml`). 🔍 In GSC einreichen; sicherstellen, dass nur indexierbare, kanonische URLs
  (der **einen** Domain) enthalten sind — keine energy/energie-Mischung.
- **🔍 HTML-Sitemap / Footer-Navigation** für interne Verlinkung der Service-Seiten prüfen.

### 3.5 Performance / Core Web Vitals (LCP, INP, CLS)

> 🔶 Nicht gemessen (kein Live-Zugriff). Typische Risiken bei WordPress + Page-Builder:
- **🔍 LCP** — großes Hero-Bild ungetunt (kein WebP, keine `width/height`, kein `fetchpriority=high`)
  → LCP > 2,5 s wahrscheinlich. Fix: Hero als WebP/AVIF, korrekt dimensioniert, `preload`.
- **🔍 INP** — Page-Builder + viele Plugins/Slider → Interaktions-Latenz. Fix: Render-blocking
  JS reduzieren, ungenutzte Plugins entfernen, Caching (WP Rocket/LiteSpeed).
- **🔍 CLS** — fehlende Bildmaße, spät ladende Fonts/Consent-Banner. Fix: explizite `width/height`,
  `font-display: swap`, Platz für Consent-Layer reservieren.
- **Messen:** [PageSpeed Insights](https://pagespeed.web.dev/) (Feld- + Labordaten) nach Freigabe.

### 3.6 Bilder

- **🔶 Alt-Texte fehlen/generisch.** Rankingrelevant + Barrierefreiheit. → Das Skript kann
  **Alt-Texte per REST-API automatisch setzen** (`/wp/v2/media` `alt_text` ist beschreibbar!).
- **🔍 Format & Größe** — WebP/AVIF statt JPEG/PNG; Originale > 200 KB komprimieren; responsive
  `srcset`. Plugin-Empfehlung: ShortPixel / Imagify / Converter for Media.
- **🔍 Dateinamen** sprechend (`pv-anlage-borken-8kwp.webp` statt `IMG_1234.jpg`).

### 3.7 Local SEO (Google Business Profile, NAP, Citations)

- **🔶 Google Business Profile** — für lokale PV-Betriebe der wichtigste Local-Hebel.
  🔍 GBP beanspruchen/optimieren: Kategorie „Solaranlagenanbieter"/„Elektriker", Leistungen,
  Fotos, Beiträge, Q&A, **Bewertungen aktiv einsammeln**.
- **🔴 NAP-Konsistenz** — Name/Adresse/Telefon **identisch** auf Website, GBP und allen
  Verzeichnissen. Aktuell besteht Verwechslungsgefahr mit der Visbek-Firma + Domain-Dublette.
  → Details & Citation-Liste: `05-LOCAL-SEO-GEO.md`.
- **🔍 LocalBusiness-Schema mit `areaServed`** (Borken, Kreis Borken, Münsterland) — liegt bei.

### 3.8 GEO / AI-Search (AI Overviews, ChatGPT, Perplexity)

- **🔶 Geringe Zitierfähigkeit.** Für AI-Antworten braucht es klar beantwortete Fragen
  (Frage-Antwort-Blöcke), Fakten mit Zahlen, FAQ-Schema. → FAQ-Schema + Content-Plan liefern das.
- **🔍 llms.txt** (optional, von Google ignoriert) — kann für andere AI-Crawler ergänzt werden;
  niedrige Priorität.
- **🔍 AI-Crawler-Zugriff** — sicherstellen, dass robots.txt GPTBot/PerplexityBot **nicht** sperrt
  (außer bewusst gewünscht).

---

## 4. Was live geändert werden soll (Vorschau — vor Umsetzung)

Siehe **`01-ACTION-PLAN.md`** (priorisiert) und **`implementation/README.md`** (technische Umsetzung).
Kurz die geplanten **automatisierbaren** Eingriffe per REST-API/mu-Plugin:

1. **Schema-Injektion** (LocalBusiness/Organization + FAQ) via mu-Plugin → sofort in `<head>`.
2. **Bild-Alt-Texte** setzen/korrigieren via `/wp/v2/media` (REST, voll beschreibbar).
3. **Seiten-Inhalte** ergänzen (Trust-Blöcke, lokale Absätze) via `/wp/v2/pages` (REST).
4. **SEO-Metas** (Title/Description/Focus-KW): entweder automatisch (wenn mu-Plugin die
   Yoast/Rank-Math-Meta-Keys für REST freischaltet) **oder** als Copy-Paste-Liste (`02-META-COPY-PASTE.md`).

**Nicht per API** (Server-/DNS-Ebene, manuell): 301-Weiterleitung der Domain-Dublette,
robots.txt-Ersatz (falls physische Datei), HSTS-Header, GBP-Optimierung.

---

## 5. Quellen (WebSearch)

- companyhouse.de — A&B Solarenergy GmbH, Borken
- northdata.de — GF Rami Alkhidou, Elias Boulos; Historie UG→GmbH
- openregister.de — HRB DE-HRB-R2707-21128
- photovoltaik-vergleichsrechner.de — Anschrift Lange Stiege 66, 46325 Borken
- creditreform.de — Firmeneintrag Borken

# Youman — AI & Software (Website)

Eigenständige Marketing-Website für Youman Automation: KI-Automationen, LLM-Chatbots,
Websites und E-Commerce-Integrationen.

Next.js 14 (App Router), TypeScript, reines CSS mit Design-Tokens. Keine UI-Bibliothek,
keine externen Laufzeit-Abhängigkeiten.

---

## Schnellstart

```bash
npm install
npm run dev      # http://localhost:3001
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver (Port 3001) |
| `npm run build` | Produktions-Build |
| `npm start` | Produktionsserver (Port 3000) |
| `npm run typecheck` | TypeScript strict, ohne Emit |
| `npm run lint` | ESLint (`next/core-web-vitals`) |

## Struktur

```
app/
  layout.tsx            Schriften, globale Metadaten, Organisation-JSON-LD
  page.tsx              Startseite
  leistungen/           Leistungen im Detail (+ Service-JSON-LD)
  referenzen/           Projekte
  ueber-mich/           Profil und Arbeitsweise
  kontakt/              Kontaktdaten und Anfrageformular
  impressum/            § 5 DDG — PLATZHALTER, siehe unten
  datenschutz/          Art. 13 DSGVO — PLATZHALTER, siehe unten
  not-found.tsx         404
  sitemap.ts            sitemap.xml
  robots.ts             robots.txt
  opengraph-image.tsx   Social-Preview 1200×630, beim Build erzeugt
  icon.tsx              Favicon
  globals.css           Design-Tokens, Reset, Layout-Primitive
  ui.css                Komponenten und Sektionen
components/
  Header, Footer, Logo, Icon, Reveal, Accordion, ContactForm,
  PageHead, Sections
lib/
  site.ts               sämtliche Inhalte und Kontaktdaten an einer Stelle
  seo.tsx               Metadaten-Helfer und strukturierte Daten
design-system/
  youman-automation/MASTER.md   verbindliche Design-Entscheidungen
```

Inhalte werden nicht in Komponenten geschrieben, sondern in `lib/site.ts` gepflegt.
Texte, Leistungen, Referenzen, FAQ und Kontaktdaten liegen dort zentral.

## SEO

Ab Werk enthalten:

- `metadataBase`, Titel-Template und Canonical pro Seite über `lib/seo.tsx`
- OpenGraph und Twitter Cards, Vorschaubild aus `opengraph-image.tsx`
- Strukturierte Daten: `ProfessionalService`, `WebSite`, `BreadcrumbList`,
  `FAQPage` (nur auf der Startseite, wo die Fragen sichtbar sind), `Service`
  je Leistung
- `sitemap.xml` und `robots.txt` generiert, nicht handgepflegt
- Genau eine `h1` pro Seite, lückenlose Überschriften-Hierarchie
- Server Components als Standard; `'use client'` nur in Header, Accordion,
  Reveal und Formular
- Schriften selbst gehostet — keine Verbindung zu Google Fonts, kein Layout-Shift

**Vor dem Livegang:** `site.url` in `lib/site.ts` auf die endgültige Domain setzen.
Canonical-Tags, Sitemap und JSON-LD leiten sich daraus ab.

## Offene Punkte vor dem Livegang

1. **Impressum und Datenschutz** enthalten `TODO:`-Platzhalter für Name, Anschrift,
   USt-Angabe und Hosting-Anbieter. Ein unvollständiges Impressum ist abmahnfähig.
2. **Kontaktformular** öffnet derzeit eine vorbereitete E-Mail im Mailprogramm des
   Besuchers; es sendet nichts an einen Server. Für einen echten Versand eine Route
   `app/api/kontakt/route.ts` ergänzen und `buildMailto` in `ContactForm.tsx`
   ersetzen — dann auch Abschnitt 5 der Datenschutzerklärung anpassen.
3. **Referenzen und Kundenstimmen** stammen aus der bisherigen Seite. Namen und
   Zitate vor Veröffentlichung mit den Genannten abstimmen.

## Barrierefreiheit

Geprüft mit Chromium über alle sieben Seiten:

- Kontrast durchgehend über WCAG AA (Fließtext ≥ 7:1)
- Tastaturbedienung inklusive Escape im Mobilmenü und Fokusrückgabe
- Formularfehler am Feld, `aria-invalid`, Fokus springt auf das erste fehlerhafte Feld
- Kein horizontaler Overflow ab 375px
- `prefers-reduced-motion` schaltet Reveal, Marquee und Puls ab

## Deployment

Vercel: Repository verbinden, Root auf dieses Verzeichnis setzen, deployen.
Es werden keine Umgebungsvariablen benötigt.

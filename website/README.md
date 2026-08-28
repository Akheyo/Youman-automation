# Youman — AI & Software (Website)

Eigenständige Marketing-Website für Youman Automation: KI-Automationen, LLM-Chatbots,
Websites und E-Commerce-Integrationen.

Next.js 14 (App Router), TypeScript, reines CSS mit Design-Tokens. Keine UI-Bibliothek,
keine externen Laufzeit-Abhängigkeiten. 18 statisch vorgerenderte Seiten.

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
  layout.tsx                    Schriften, globale Metadaten, Organisation-JSON-LD
  page.tsx                      Startseite (bewusst kurz)
  branchen/page.tsx             Hub des SEO-Clusters
  branchen/[slug]/page.tsx      sechs Branchenseiten, statisch vorgerendert
  referenzprojekte/page.tsx     Projektübersicht
  referenzprojekte/[slug]/      vier Fallstudien
  leistungen/                   Leistungen im Detail (+ Service- und FAQ-JSON-LD)
  ueber-uns/                    Profil, Arbeitsweise, Einordnung
  kontakt/                      Kontaktdaten und Anfrageformular
  impressum/                    § 5 DDG — PLATZHALTER, siehe unten
  datenschutz/                  Art. 13 DSGVO — PLATZHALTER, siehe unten
  not-found.tsx                 404
  sitemap.ts                    aus den Datenquellen erzeugt
  robots.ts                     robots.txt
  opengraph-image.tsx           Social-Preview 1200×630, beim Build erzeugt
  icon.tsx                      Favicon
  globals.css                   Design-Tokens, Reset, Layout-Primitive
  ui.css                        Komponenten und Sektionen
components/
  Header, Footer, Logo, Icon, Reveal, Accordion, ContactForm,
  PageHead, Sections
lib/
  site.ts               Marke, Navigation, Leistungen, FAQ, Kontaktdaten
  branchen.ts           sechs Branchen mit Painpoints, Lösungen, FAQ, SEO-Feldern
  referenzen.ts         vier Referenzprojekte als Fallstudien
  bilder.ts             Bildregister: Motiv, Seitenverhältnis, Maße, Alternativtext
  videos.ts             Videoregister für das Hero-Video
  seo.tsx               Metadaten-Helfer und strukturierte Daten
public/bilder/          Bilddateien (siehe README dort)
public/videos/          Videodateien (siehe README dort)
design-system/
  youman-automation/MASTER.md   verbindliche Design-Entscheidungen
```

Inhalte werden nicht in Komponenten geschrieben, sondern in `lib/` gepflegt.
Eine neue Branche entsteht durch einen Eintrag in `lib/branchen.ts` — Seite,
Navigation im Footer, Sitemap und strukturierte Daten folgen automatisch.

## Bilder und Video einsetzen

Die Seite ist durchgehend bebildert. Solange keine Dateien vorliegen, steht an
jeder Bildstelle ein markierter Platzhalter, der Motiv, Seitenverhältnis und
empfohlene Breite nennt — auf der Seite selbst lesbar, nicht nur im Code.

Ein Bild einsetzen:

1. Datei nach `public/bilder/` legen, am besten als WebP
2. In `lib/bilder.ts` beim passenden Eintrag `datei: '/bilder/name.webp'` ergänzen

Das Hero-Video einsetzen:

1. MP4 (H.264, ohne Ton) nach `public/videos/` legen, optional zusätzlich WebM
2. Ein Standbild daraus nach `public/bilder/` legen
3. In `lib/videos.ts` `datei`, optional `dateiWebm` und `standbild` eintragen

Das Video läuft stumm in Schleife und hat einen Knopf zum Anhalten — der ist
vorgeschrieben, weil Bewegung über fünf Sekunden anhaltbar sein muss
(WCAG 2.2.2). Bei eingestellter reduzierter Bewegung wird nur das Standbild
gezeigt. Details in `public/videos/README.md`.

Der Platzhalter verschwindet automatisch. Das Layout springt nicht, weil das
Seitenverhältnis vorab reserviert ist.

Am schnellsten verschafft man sich einen Überblick mit `npm run dev` und einem
Durchlauf durch die Seiten: Jeder Platzhalter sagt, was an seine Stelle gehört.

## SEO

Ab Werk enthalten:

- `metadataBase`, Titel-Template und Canonical pro Seite über `lib/seo.tsx`
- OpenGraph und Twitter Cards, Vorschaubild aus `opengraph-image.tsx`
- Strukturierte Daten: `ProfessionalService`, `WebSite`, `BreadcrumbList`,
  `Service` je Branche und je Leistung, `Article` je Referenzprojekt,
  `FAQPage` nur dort, wo die Fragen auch sichtbar sind
- SEO-Cluster: `/branchen` als Hub, sechs Branchenseiten als Spokes, jede mit
  eigenem Suchintent, eigener FAQ und Querverweis auf ein Referenzprojekt
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
3. **Referenzprojekte und Kundenstimmen** stammen aus der bisherigen Seite. Namen
   und Zitate vor Veröffentlichung mit den Genannten abstimmen. Die Fallstudien
   enthalten bewusst keine Prozentzahlen — belegte Kennzahlen können ergänzt
   werden, sobald die Auftraggeber sie freigeben.
4. **Branchentexte** beschreiben typische Problemlagen der jeweiligen Branche.
   Wo Sie eigene Projekterfahrung haben, ersetzen Sie die allgemeine Formulierung
   durch den konkreten Fall — das ist der stärkste Hebel für Glaubwürdigkeit
   und für die Suche.

## Barrierefreiheit

Geprüft mit Chromium über alle 18 Seiten:

- Kontrast durchgehend über WCAG AA (Fließtext ≥ 7:1)
- Tastaturbedienung inklusive Escape im Mobilmenü und Fokusrückgabe
- Formularfehler am Feld, `aria-invalid`, Fokus springt auf das erste fehlerhafte Feld
- Kein horizontaler Overflow ab 375px
- `prefers-reduced-motion` schaltet Reveal, Marquee und Puls ab

## Deployment

Vercel: Repository verbinden, Root auf dieses Verzeichnis setzen, deployen.
Es werden keine Umgebungsvariablen benötigt.

# youman – Unternehmens-Website

Statische Website für **youman** (AI & Software), gebaut mit Astro und
Tailwind CSS 4.

## Entwickeln

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Erzeugt dist/
npm run preview  # Zeigt dist/ an, wie es ausgeliefert wird
```

## Aufbau

Fast alles Sichtbare entsteht aus Daten unter `src/data/`. Titel,
Beschreibungen, Navigation und strukturierte Daten werden daraus erzeugt. Ein
Tippfehler in einer Datendatei schlägt deshalb auf mehreren Seiten gleichzeitig
durch, und eine Prüfung gegen den Quelltext übersieht ihn.

**Geprüft wird immer gegen das gebaute HTML in `dist`, nie gegen die Quelle.**

| Datei | Inhalt |
| --- | --- |
| `site.ts` | Marke, Claim, Startseitentitel, Vorgehen |
| `leistungen.ts` | Die fünf Leistungen samt Bausteinen und Problemstellungen |
| `branchen.ts` | Die sechs Branchen |
| `caseStudies.ts` | Referenzprojekte |
| `kontakt.ts` | E-Mail, Telefon, Formularanbindung |
| `anbieter.ts` | Impressumsangaben |
| `navigation.ts` | Kopf- und Fußnavigation |
| `sichtbarkeit.ts` | Schalter für die Indexierung |

## Farben

Monochrom auf hellgrauem Grund, kein Buntton. Drei Flächenstufen tragen die
Gliederung.

| Token | Wert | Rolle |
| --- | --- | --- |
| `--color-canvas` | `#bdbdbd` | Grundfläche, mittleres Grau |
| `--color-surface` | `#cfcfcf` | Karten, Kopfleiste, Fußzeile |
| `--color-muted` | `#adadad` | Bildplätze, gedämpfte Kacheln |
| `--color-ink-deep` | `#000000` | schwarze Gegenfläche: Hero, Seitenköpfe, Aufforderungen |
| `--color-ink` | `#000000` | Fließtext und Überschriften |
| `--color-line` | `#000000` | Linien und Kachelraster |

Zwei Fallstricke, die beim Weiterbauen zählen:

- Text auf einer Akzentfläche trägt `text-accent-fg`, nie `text-white`.
  Sonst kippt jeder Knopf, sobald der Akzent einmal hell wird: Weiß auf
  Weiß, ein leerer Kasten. Genau das ist beim Umstellen auf einen dunklen
  Satz passiert, unter anderem am Absendeknopf des Formulars.
- Der harte Versatzschatten (`hebt-sich`) und der Schatten der Kopfleiste
  nehmen `--color-line` statt eines festen Schwarz, damit sie einem
  Palettenwechsel folgen.
- Die `ghost`-Schaltfläche steht ausschließlich in den schwarzen Sektionen
  und ist deshalb fest weiß. Sie folgt der Palette bewusst nicht.

## Bilder

Zurzeit liegt kein eigenes Bildmaterial vor. Statt Fotos steht an den dafür
vorgesehenen Stellen `Bildplatz.astro`: eine Fläche im späteren
Seitenverhältnis mit der Angabe, was dort hingehört.

Ein Bild wird eingesetzt, indem es unter `src/assets/img/` abgelegt und an
denselben Bildplatz übergeben wird:

```astro
import motiv from '../assets/img/motiv.webp';
<Bildplatz bild={motiv} alt="Was zu sehen ist" bezeichnung="…" />
```

Weil die Fläche vorher schon die richtige Höhe hat, verschiebt das
Nachrüsten nichts, der Layout-Sprung bleibt bei 0.

Zwei Dinge bleiben davon unberührt:

- Das **`og:image`** entsteht aus dem Motiv der Seite: `Base` schneidet es
  auf 1200 mal 630 zu und liefert JPEG aus, weil einige Vorschauen WebP bis
  heute nicht darstellen. Seiten ohne Motiv bekommen keins; ein Verweis auf
  eine nicht vorhandene Datei wäre schlechter als keine Angabe.
- Die Wortmarke ist Text, keine Datei. Sie bleibt dadurch bei jeder Größe
  scharf und ist vorlesbar.

## Prüfen

```bash
npm run build
node ../.claude/skills/seo-youman/scripts/statisch.mjs dist

npx astro preview --port 4321 &
node ../.claude/skills/seo-youman/scripts/browser-pruefungen.mjs
```

Die erste Prüfung braucht keinen Server. Die zweite prüft Barrierefreiheit
(axe-core, WCAG 2.1 A und AA), waagerechten Überlauf bei fünf Breiten,
Layout-Sprung und Ladezeit sowie Anfragen an fremde Hosts.

**Beim Lesen der Ausgabe zuerst auf die Zahl der geprüften Seiten schauen,
dann auf die Befunde.** „Keine Befunde" bei null geprüften Seiten sieht aus
wie ein bestandener Test und ist keiner.

## Indexierung

`src/data/sichtbarkeit.ts` entscheidet, ob die Seite in Suchmaschinen darf.
Steht der Schalter auf gesperrt, trägt jede Seite `noindex` und es entsteht
keine Sitemap.

Dort steht bewusst **kein `Disallow: /`** in der robots.txt. Ein Disallow
verbietet nur das Abrufen, nicht die Aufnahme in den Index: Google listet eine
gesperrte Adresse trotzdem, wenn ein Verweis darauf zeigt, und bekommt das
`noindex` nie zu sehen, weil es die Seite nicht laden darf.

## Deployment

GitHub Pages über Actions, siehe `.github/workflows/youman-website-pages.yml`.

Adresse und Basispfad kommen aus `configure-pages` und werden nicht im Code
festgelegt. Dadurch läuft derselbe Build sowohl unter
`akheyo.github.io/<repo>/` als auch unter einer eigenen Domain.

Eine eigene Domain wird **in den Repository-Einstellungen** unter Settings →
Pages → Custom domain gesetzt, nicht über eine CNAME-Datei. Bei einem Deploy
über Actions setzt die CNAME-Datei die Domain nicht; das ist das alte
Verhalten beim Deploy aus einem Branch.

| Variable | Zweck |
| --- | --- |
| `SITE_URL`, `SITE_BASE` | kommen aus `configure-pages` |
| `KONTAKT_EMAIL`, `KONTAKT_TELEFON`, `KONTAKT_TERMINLINK` | Kontaktdaten |
| `FORMULAR_ENDPUNKT`, `FORMULAR_SCHLUESSEL` | Formularanbindung |
| `INDEXIERUNG` | `an` gibt die Indexierung frei, sticht den Schalter im Code |

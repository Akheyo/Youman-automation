# Youman — AI & Software · Design System (Master)

Quelle: Skill `ui-ux-pro-max`, Abfrage
`"professional minimal black white editorial software consultancy" --design-system`
mit `--variance 3 --motion 4 --density 4`.
Ergänzende Abfragen: `--domain style`, `--domain color`, `--domain typography`,
`--domain google-fonts`, `--stack nextjs`.

Dieses Dokument ist die verbindliche Referenz. Seiten-spezifische Abweichungen
gehören nach `pages/<seite>.md` und überschreiben dort den Master.

---

## Grundentscheidung

Das Logo — dünne, weit gesperrte Versalien mit vertikaler Linie, Schwarz auf Weiß —
gibt die Richtung vor. Alles Weitere ordnet sich unter: **Minimalism & Swiss Style**,
monochrom, viel Weißraum, strenges Raster, Typografie trägt die Hierarchie statt
Farbe oder Schatten.

Die Seite ist **bewusst nur hell**. Ein zweites Theme würde die monochrome Aussage
verwässern; die eine invertierte Fläche (CTA-Band) ist die einzige Ausnahme und
setzt genau deshalb einen Akzent.

## Farben

Basis: Palette „Portfolio/Personal — Monochrome" (`--domain color`).
Der dort vorgesehene blaue Akzent ist auf den Fokusring reduziert; die Marke
bleibt schwarz-weiß.

| Token | Wert | Verwendung | Kontrast auf Weiß |
|---|---|---|---|
| `--ink` | `#09090b` | Fließtext, Überschriften | 20,1:1 |
| `--ink-strong` | `#18181b` | Primärbutton, CTA-Band | 18,7:1 |
| `--ink-2` | `#3f3f46` | Sekundärtext, Lead | 10,8:1 |
| `--ink-3` | `#52525b` | gedämpfter Text, Navigation | 7,6:1 |
| `--ink-4` | `#71717a` | Meta, Eyebrow, Captions | 4,9:1 |
| `--paper` | `#ffffff` | Grundfläche | — |
| `--paper-2` | `#fafafa` | abgesetzte Sektionen | — |
| `--paper-3` | `#f4f4f5` | Hover-Fläche | — |
| `--line` | `#e4e4e7` | Trennlinien, Rahmen | — |
| `--line-strong` | `#d4d4d8` | Formularrahmen | — |
| `--focus` | `#2563eb` | **nur** Fokusring | 4,6:1 |
| `--danger` | `#b91c1c` | Formularfehler | 6,4:1 |

Regel: Farbe transportiert nie allein eine Bedeutung. In der Vergleichstabelle
steht neben jedem Wert ein eigenes Icon (Haken / Uhr / Minus).

## Typografie

| Rolle | Schrift | Schnitte | Begründung |
|---|---|---|---|
| Display | **Jost** | 200, 300, 400, 500 | geometrische Grotesk, trifft die Logo-Anmutung |
| Fließtext | **Inter** | variabel | verifizierte Paarung für „minimal, swiss, funktional, professionell" |
| Mono | System-Stack | — | Tags, Indizes, Kicker |

Beide über `next/font/google` selbst gehostet: keine externe Anfrage, kein
Layout-Shift, DSGVO-unkritisch.

Sperrungen sind das wiederkehrende Motiv aus dem Logo:
`--track-logo: 0.34em` (Wortmarke), `--track-wide: 0.18em` (Unterzeile, Spalten),
`--track-eyebrow: 0.22em` (Eyebrows). Überschriften laufen negativ
(`-0.02em` bis `-0.035em`).

Fluide Skala von `--t-xs` (12px) bis `--t-4xl` (44–80px), Basis 16px,
Zeilenhöhe 1.65 im Fließtext.

## Raster und Abstände

- Container 1200px, schmal 760px, Gutter `clamp(20px, 5vw, 48px)`
- Abstandsskala 4 → 128px (`--s-1` … `--s-10`), Dichte 4/10
- Sektionen: `clamp(64px, 9vw, 128px)` vertikal
- Radien bleiben klein (2–6px) — Swiss Style ist eckig, nicht rund

## Bewegung

Stufe 4/10, dezent. Reveal beim Scrollen: 14px Versatz plus Opazität,
420ms, `cubic-bezier(0.22, 1, 0.36, 1)`, Stagger 60ms (max. 8 Stufen).

Der Reveal prüft **Positionen statt Schwellenwert-Übergänge**. Ein
IntersectionObserver feuert nur beim Überqueren einer Schwelle — ein Sprung
ans Seitenende überspringt Elemente und würde sie dauerhaft unsichtbar lassen.
Ein gemeinsamer, per `requestAnimationFrame` gedrosselter Scroll-Sweep kann
nichts überspringen und hängt sich ab, sobald alles sichtbar ist.

`prefers-reduced-motion: reduce` liefert sofort den Endzustand; Marquee und
Puls-Animation stehen still.

## Verbindliche Regeln

1. Keine Emojis als Icons — ausschließlich das SVG-Set in `components/Icon.tsx`.
2. Fokus wird nie entfernt, nur gestaltet (`:focus-visible`, 2px, 3px Offset).
3. Interaktive Ziele mindestens 48px hoch.
4. Fließtext nie unter 12px. Einzige Ausnahme: die Logo-Unterzeile mit 9px —
   Logotypen sind von WCAG 1.4.3 ausgenommen, Kontrast dort 7,6:1.
5. Kein horizontaler Overflow — geprüft bei 375, 768, 1024 und 1440px.
6. Breite Inhalte (Vergleichstabelle) scrollen in eigenem Container,
   nie die Seite.
7. Übergänge 150–420ms. Keine Animation von `width`/`height`.

## Abgelehnte Alternativen

- **Dark/Tech (Indigo auf Anthrazit)** — erste Richtung, passte zur alten Seite,
  aber nicht zum Logo und nicht zum Anspruch „seriös".
- **Bento-Box-Grid** — für einen Portfolio-Kontext naheliegend, wirkt neben der
  strengen Logo-Typografie jedoch verspielt. Stattdessen editoriale Zeilen
  mit Trennlinien.
- **Theme-Umschalter hell/dunkel** — siehe Grundentscheidung.

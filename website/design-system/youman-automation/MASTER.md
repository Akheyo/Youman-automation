# Youman — AI & Software · Design System (Master)

Quelle: Skill `ui-ux-pro-max`. Farbe und Schriftgattung aus der Abfrage
`"consulting corporate deep navy institutional professional services"
--domain color` — Treffer „Research Lab / University Department", Anmerkung
dort: *Institutional navy + research accent + serif headings*.
Ergänzend `--domain typography`, `--domain google-fonts`, `--stack nextjs`.

Gestalterische Richtung auf Wunsch am Register von mckinsey.de orientiert:
tiefes Navy als Grundfläche, Serifen-Überschriften, großformatige Bilder an
jeder Sektion. Die Seite selbst ließ sich nicht abrufen (503, Bot-Schutz);
gearbeitet wurde mit den etablierten Merkmalen dieses Registers, nicht mit
einer Kopie.

Dieses Dokument ist die verbindliche Referenz. Seitenspezifische Abweichungen
gehören nach `pages/<seite>.md` und überschreiben dort den Master.

---

## Grundentscheidung

Zielgruppe sind Geschäftsführungen und Betriebsleitungen im Mittelstand —
E-Commerce, Logistik, Produktion, Großhandel. Die Seite muss vor allem
**glaubwürdig** wirken, nicht originell. Deshalb:

- **Tiefes Navy als Grundfläche.** `#0f172a` trägt Hero und CTA-Band als
  durchgehend dunkle Zonen, nicht nur als Textfarbe. Ein einziger Blauakzent
  führt Links, Fokus und Eyebrows — mehr Farbe gibt es nicht.
- **Serifen-Überschriften.** Source Serif 4 gibt den Überschriften das Gewicht
  einer Publikation statt einer Software-Landingpage. Inter trägt Fließtext und
  Bedienelemente. Monospace kommt nicht mehr vor: neben einer Serif wirkt sie
  technisch statt editorial.
- **Bilder an jeder Sektion.** Hero, Branchenkacheln, Branchen-Detailseiten,
  Leistungen, Referenzprojekte, Über uns. Solange keine Dateien vorliegen,
  stehen dort markierte Platzhalter mit Motivbeschreibung und Maßangabe.
- **Dichte 5/10, Bewegung 3/10.** Ruhig gesetzt, ein zurückhaltender
  Einblendeffekt beim Scrollen, sonst nichts.

## Farben

Basis: Palette „Professional navy + blue CTA" aus dem Skill.

| Token | Wert | Verwendung | Kontrast auf `--paper` |
|---|---|---|---|
| `--ink` | `#020617` | Fließtext, Überschriften | 19,3:1 |
| `--ink-deep` | `#0f172a` | Hero, CTA-Band, dunkle Zonen | 17,4:1 |
| `--navy` | `#1e3a5f` | institutionelles Navy | 9,7:1 |
| `--ink-2` | `#1e293b` | Titel | 14,4:1 |
| `--ink-3` | `#334155` | Sekundärtext, Lead | 10,4:1 |
| `--ink-4` | `#475569` | gedämpfter Text | 7,5:1 |
| `--ink-5` | `#64748b` | Meta, Captions | 4,9:1 |
| `--paper` | `#ffffff` | Grundfläche | — |
| `--paper-2` | `#f8fafc` | abgesetzte Sektionen, Fußzeile | — |
| `--line` | `#e2e8f0` | Trennlinien, Rahmen | — |
| `--accent` | `#0369a1` | Links, Fokus, Eyebrows | 5,9:1 |
| `--ok` | `#15803d` | Zustimmung im Vergleich | 4,8:1 |
| `--danger` | `#b91c1c` | Formularfehler | 6,4:1 |

Auf dunklem Grund gilt ein eigener Satz: `--on-dark` (Weiß), `--on-dark-2`
(`#cbd5e1`, 11,4:1) für Fließtext, `--on-dark-3` (`#94a3b8`, 6,3:1) für Meta.
Der Blauakzent trägt dort zu wenig Kontrast und wird durch `--on-dark-3`
ersetzt.

Farbe trägt nie allein eine Bedeutung: In der Vergleichstabelle steht neben
jedem Wert ein eigenes Zeichen (Haken / Uhr / Minus).

## Typografie

| Rolle | Schrift | Schnitte |
|---|---|---|
| Überschriften, Kennzahlen | **Source Serif 4** | 400, 600 |
| Fließtext, Bedienelemente, Label | **Inter** | variabel |

Beide über `next/font/google` selbst gehostet: keine externe Anfrage, kein
Layout-Shift, datenschutzseitig unkritisch.

Skala von `--t-2xs` (12px) bis `--t-4xl` (36–60px), Grundtext 16px,
Zeilenhöhe 1.65. Überschriften laufen leicht negativ (−0.015em bis −0.025em),
Label in Inter 600 mit `--track-label: 0.14em`.

## Raster und Abstände

- Container 1240px, schmal 720px, Gutter `clamp(20px, 4vw, 40px)`
- Abstandsskala 4 → 120px (`--s-1` … `--s-10`), Dichte 5/10
- Sektionen `clamp(64px, 6.5vw, 120px)` vertikal
- Radien 2–5px — technisch, nicht weich

## Informationsarchitektur

Die Startseite ist bewusst kurz: Hero, Branchen, Leistungen, zwei
Referenzprojekte, Ablauf, CTA. Alles Weitere liegt auf Unterseiten, weil eine
lange Startseite bei dieser Zielgruppe nicht zu Ende gelesen wird.

Das SEO-Cluster hängt an den Branchen:

```
/branchen  (Hub)
  ├── /branchen/e-commerce
  ├── /branchen/spedition-und-logistik
  ├── /branchen/produktion-und-fertigung
  ├── /branchen/grosshandel-und-distribution
  ├── /branchen/handwerk-und-bau
  └── /branchen/dienstleistung-und-agenturen
        └── verweist auf ein passendes Referenzprojekt

/referenzprojekte  (Hub)
  └── vier Detailseiten, jede zurück auf ihre Branche
```

Jede Branchenseite bedient einen eigenen Suchintent und folgt derselben
Dramaturgie: Einordnung, Painpoints in der Sprache der Betroffenen, Lösungen,
Referenz, branchenspezifische FAQ, CTA.

## Bilder

Jede Bildstelle steht in `lib/bilder.ts` mit Motivbeschreibung,
Seitenverhältnis, empfohlener Breite und Alternativtext. Die Komponente
`Figure` liefert das Bild aus, sobald `datei` gesetzt ist, und zeigt sonst
einen markierten Platzhalter, der genau diese Angaben nennt.

Das Seitenverhältnis wird in beiden Fällen vorab reserviert. Ein nachgereichtes
Bild verschiebt deshalb kein Layout — Cumulative Layout Shift bleibt bei null.

## Verbindliche Regeln

1. Keine Emojis als Icons — ausschließlich das SVG-Set in `components/Icon.tsx`.
2. Fokus wird nie entfernt, nur gestaltet (`:focus-visible`, 2px, 2px Offset).
3. Interaktive Ziele mindestens 46px hoch.
4. Keine Textgröße unter 12px. Einzige Ausnahme: die Logo-Unterzeile mit 9px —
   Logotypen sind von WCAG 1.4.3 ausgenommen, Kontrast dort 7,5:1.
5. Kein horizontaler Overflow — geprüft bei 375, 768, 1024 und 1440px.
6. Breite Inhalte scrollen im eigenen Container, nie die Seite.
7. Keine erfundenen Kennzahlen. Referenzprojekte beschreiben das System,
   nicht behauptete Prozentwerte.

## Bewegung

Einblenden beim Scrollen: 10px Versatz plus Opazität, 360ms, Stagger 60ms.

Der Reveal prüft **Positionen statt Schwellenwert-Übergänge**. Ein
IntersectionObserver feuert nur beim Überqueren einer Schwelle — ein Sprung ans
Seitenende überspringt Elemente und ließe sie dauerhaft unsichtbar. Ein
gemeinsamer, per `requestAnimationFrame` gedrosselter Scroll-Sweep kann nichts
überspringen und hängt sich ab, sobald alles sichtbar ist.

`prefers-reduced-motion: reduce` liefert sofort den Endzustand.

## Abgelehnte Alternativen

- **Monochrom mit Jost Light** (erste Fassung) — nah am Logo, wirkte in der
  Anwendung aber boutiquehaft statt geschäftlich.
- **IBM Plex Sans plus Mono** (zweite Fassung) — seriös, aber im Register einer
  Entwicklerfirma statt einer Beratung. Die Mono-Label wirkten technisch.
- **Dark Mode / Theme-Umschalter** — verwässert die Aussage, verdoppelt die
  Pflege. Dunkel sind gezielt Hero und CTA-Band.
- **Kein Bildmaterial** — trug die vorige Fassung, wirkt aber im
  Beratungsregister leer. Bilder sind hier tragendes Element, nicht Dekoration.

# Youman — AI & Software · Design System (Master)

Quelle: Skill `ui-ux-pro-max`, Abfrage
`"B2B enterprise consultancy trustworthy corporate industrial" --design-system`
mit `--variance 4 --motion 3 --density 6`.
Ergänzend: `--domain typography`, `--domain color`, `--domain google-fonts`,
`--stack nextjs`.

Dieses Dokument ist die verbindliche Referenz. Seitenspezifische Abweichungen
gehören nach `pages/<seite>.md` und überschreiben dort den Master.

---

## Grundentscheidung

Zielgruppe sind Geschäftsführungen und Betriebsleitungen im Mittelstand —
E-Commerce, Logistik, Produktion, Großhandel. Die Seite muss vor allem
**glaubwürdig** wirken, nicht originell. Deshalb:

- **Navy statt Reinschwarz.** `#0f172a` als Grundton wirkt gesetzt, wo reines
  Schwarz-Weiß schnell nach Galerie aussieht. Ein einziger Blauakzent trägt
  Links, Fokus und Marker — mehr Farbe gibt es nicht.
- **IBM Plex statt geometrischer Grotesk.** Plex Sans hat Gewicht und
  Ingenieurs-Anmutung; Plex Mono setzt Label, Kennzahlen und Fachbegriffe.
  Eine dünne, weit gesperrte Schrift las sich in der Vorgängerfassung
  boutiquehaft — hier ist das Gegenteil gefragt.
- **Dichte 6/10.** Kompakter Satz, engere Abstände. Substanz statt Weißraum.
- **Bewegung 3/10.** Ein zurückhaltender Einblendeffekt beim Scrollen, sonst
  nichts. Wer Vertrauen verkauft, animiert nicht.

## Farben

Basis: Palette „Professional navy + blue CTA" aus dem Skill.

| Token | Wert | Verwendung | Kontrast auf `--paper` |
|---|---|---|---|
| `--ink` | `#020617` | Fließtext, Überschriften | 19,3:1 |
| `--ink-deep` | `#0f172a` | Primärfläche, CTA-Band | 17,4:1 |
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

Farbe trägt nie allein eine Bedeutung: In der Vergleichstabelle steht neben
jedem Wert ein eigenes Zeichen (Haken / Uhr / Minus).

## Typografie

| Rolle | Schrift | Schnitte |
|---|---|---|
| Text und Titel | **IBM Plex Sans** | 400, 500, 600 |
| Label, Kennzahlen, Fachbegriffe | **IBM Plex Mono** | 400, 500 |

Verifizierte Paarung für „financial, trustworthy, professional, corporate,
serious". Beide über `next/font/google` selbst gehostet: keine externe Anfrage,
kein Layout-Shift, datenschutzseitig unkritisch.

Skala von `--t-2xs` (12px) bis `--t-4xl` (36–60px), Grundtext 16px,
Zeilenhöhe 1.65. Überschriften laufen leicht negativ (−0.015em bis −0.025em),
Label in Mono mit `--track-label: 0.14em`.

## Raster und Abstände

- Container 1240px, schmal 720px, Gutter `clamp(20px, 4vw, 40px)`
- Abstandsskala 4 → 104px (`--s-1` … `--s-10`), Dichte 6/10
- Sektionen `clamp(56px, 6.5vw, 104px)` vertikal
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

- **Monochrom mit Jost Light** (Vorgängerfassung) — nah am Logo, wirkte in der
  Anwendung aber boutiquehaft statt geschäftlich. Verworfen.
- **Dark Mode / Theme-Umschalter** — verwässert die Aussage, verdoppelt die
  Pflege. Die eine invertierte Fläche ist das CTA-Band.
- **Serifen-Display** — hätte Autorität gebracht, aber gegen die geometrische
  Wortmarke gearbeitet.

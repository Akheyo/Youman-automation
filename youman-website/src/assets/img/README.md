# Bilder ablegen

Dateien hier hineinlegen (WebP oder JPEG, mindestens 1600 px breit) und im
gewünschten `Bildplatz` übergeben:

```astro
import motiv from '../assets/img/motiv.webp';
<Bildplatz bild={motiv} alt="Was zu sehen ist" bezeichnung="…" />
```

Astro erzeugt daraus selbst die kleineren Varianten. Es rechnet dabei nur
herunter, nie hoch: Ein 600 px breites Original bleibt auf großen Bildschirmen
unscharf.

## Was schon da ist

13 von 15 Motiven liegen vor. Sie sind in `leistungen.ts`, `branchen.ts` und
`caseStudies.ts` eingetragen und erscheinen dadurch überall, wo dieselbe
Leistung, Branche oder Referenz vorkommt.

| Datei | Inhalt |
| --- | --- |
| `leistung-ki-automationen` | Automationswerkzeug mit einem Bestellprozess |
| `leistung-chatbots` | Chatfenster im laufenden Gespräch |
| `leistung-webseiten` | Seite auf Laptop und Tablet |
| `leistung-e-commerce` | Produktseite eines Onlineshops |
| `leistung-individuelle-software` | Projektübersicht auf einem Bildschirm |
| `branche-e-commerce-und-onlinehandel` | Packtisch im Versandlager |
| `branche-spedition-und-logistik` | Lkw an der Verladerampe |
| `branche-produktion-und-fertigung` | Fertigungshalle mit Montageanlage |
| `branche-grosshandel-und-distribution` | Gang im Hochregallager |
| `branche-handwerk-und-bau` | Bauplan und Tablet im Rohbau |
| `branche-dienstleistung-und-agenturen` | Besprechungsraum mit Ablaufdiagramm |
| `referenz-drahtmueller` | Schema der Palettenlogik |
| `referenz-absolar` | Schema von Angebot bis Baustelle |
| `hero-1` bis `hero-5` | Bildfolge hinter der Wortmarke im Hero |

Die beiden Referenzbilder sind Schemata, keine Fotos. In den kleinen Kacheln
sind ihre Beschriftungen zu klein zum Lesen; auf den Detailseiten stehen sie
über die volle Breite und sind dort lesbar.

## Was noch fehlt

| Dateiname | Was zu sehen sein soll | Format |
| --- | --- | --- |
| `ueber-uns` | die Menschen hinter youman | 16:9 |

Das ist die letzte Stelle mit einem Platzhalter. Der Bildplatz auf der
Startseite unter der Einleitung ist entfallen; die Bildfolge im Hero
darüber deckt das ab.

## Die Bildfolge im Hero

`hero-1` bis `hero-5`, in dieser Reihenfolge, Wechsel alle 6,5 Sekunden.
Reihenfolge und Anzahl stehen in `components/HeroSlider.astro`.

Drei Dinge sind dort Bedingung, nicht Feinschliff:

- Ohne JavaScript steht das erste Bild da und bleibt stehen. Die Bedienung
  wird erst vom Skript eingeblendet, damit keine wirkungslosen Knöpfe
  dastehen.
- Der Wechsel lässt sich anhalten. Etwas, das von allein läuft und länger als
  fünf Sekunden dauert, braucht das (WCAG 2.2.2).
- Bei eingestellter reduzierter Bewegung läuft nichts von selbst; die Punkte
  bleiben bedienbar.

Der Schleier über den Bildern ist links am dichtesten, weil dort die
Wortmarke steht. Gemessen über alle fünf Bilder liegt der schlechteste
Kontrast bei 7,3:1 gegen die geforderten 4,5:1. Ein helleres Motiv als
`hero-5` würde diesen Abstand aufbrauchen.

## Was noch dazugehört

Zu jedem Bild braucht es eine Bildbeschreibung (`alt`). Sie ist keine
Formsache: Sie ist das, was blinde Besucher statt des Bildes hören, und
das, was Google über den Bildinhalt erfährt. Sie wird beim Einsetzen
geschrieben, nicht vom Dateinamen abgeleitet.

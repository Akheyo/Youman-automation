# PlentyONE — wofür die fünf GTIN_13-Konfigurationen benutzt werden

Erhoben am 22.09.2026 im Live-Mandanten **plentyId 14443**
(`https://p14443.my.plentysystems.com`), **ausschließlich lesend** — ein
`POST /rest/login`, alles weitere `GET`.

**Anlass.** Unser Projektcode hängt neu erzeugte, hausintern vergebene EAN-13 an
die Barcode-Konfiguration `id = 2` (`PLENTY_EAN_BARCODE_ID`, siehe
[`lib/plenty/client.ts`](lib/plenty/client.ts) Zeile 69 und 702). Zu klären war,
ob unter der 2 tatsächlich hausinterne Codes stehen — oder in Wirklichkeit
Hersteller-GTINs, an die wir uns dann anhängen würden.

**Antwort vorweg: ja, die 2 ist die hausinterne Konfiguration.** Die Begründung
steht in Abschnitt 3; sie stützt sich nicht auf die Präfixregel, denn die trägt
bei diesem Mandanten nicht (Abschnitt 4).

---

## 1. Die Stichprobe

| | |
| --- | --- |
| Varianten im Mandanten | **60.436** (`/rest/items/variations`, `totalsCount`) |
| Seiten insgesamt | **605** — `itemsPerPage=250` wird serverseitig auf **100** gedeckelt |
| gezogene Seiten | **162**, über den gesamten Bereich verteilt (1–8, 9–25, dann jede 7. bzw. 25. Seite, sowie 590–605) |
| gezogene Varianten | **16.136** = **26,7 %** des Bestands |
| davon mit mindestens einem Barcode | **13.026** |
| Barcode-Einträge insgesamt | **14.266** |

Aufruf je Seite:
`/rest/items/variations?itemsPerPage=250&with=variationBarcodes&page=<n>`.
Die Seiten wurden bewusst nicht alle vom Anfang genommen, damit nicht nur die
ältesten Artikel im Bild sind.

## 2. Was je Konfiguration tatsächlich gespeichert ist

„gültig" = 13 Ziffern mit korrekter EAN-13-Prüfziffer, gerechnet wie in
[`lib/plenty/ean.ts`](lib/plenty/ean.ts).

| `barcodeId` | Name | Typ | Codes | gültige EAN-13 | Präfix 20–29 | Präfix 40–44 | Top-Präfixe (erste zwei Stellen) |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| **2** | EAN_13 2 | GTIN_13 | **12.606** | 12.605 | **11 (0,1 %)** | **1 (0,008 %)** | `10`: 12.590 (99,9 %) · `20`: 11 · je 1×: `64`, `40`, `12`, `87`, `90` |
| **1** | EAN_13 1 | GTIN_13 | **1.608** | 1.545 | 9 (0,6 %) | **1.071 (66,6 %)** | `40`: 981 (61,0 %) · `10`: 90 (5,6 %) · `42`: 80 (5,0 %) · `73`: 62 · `57`: 53 · `87`: 41 · `80`: 34 · `50`: 26 · `76`: 23 · `74`: 19 |
| **3** | EAN_13 3 | GTIN_13 | **2** | 2 | 0 | 2 (100 %) | `40`: 2 |
| **4** | EAN_13 4 | GTIN_13 | **0** | — | — | — | — |
| **23** | Fotostudio | GTIN_13 | **0** | — | — | — | — |

Nicht-GTIN_13-Konfigurationen tauchen nur am Rand auf: `13` (UPC 1) mit 45
Codes, `5` (CODE_128 1) mit 4, `17` (ISBN) mit 1.

### Zeile für Zeile

**`barcodeId 2` — „EAN_13 2" · 12.606 Codes · hausinterne Vergabe.**
99,9 % der Codes tragen Präfix `10` und bilden einen **dichten, fortlaufenden
Zähler**: Wertebereich `1000000000252` … `1000000498929`, in der Stichprobe
liegen benachbarte Codes im Median nur **7** auseinander. Das ist keine
Herstellervergabe, sondern eine Hausnummerierung der Form „1" + laufende Nummer.
Beispiele: `1000000012095`, `1000000012071`, `1000000012026`, `1000000012019`,
`1000000011982`. Von 12.606 Codes liegt **genau einer** im GS1-Deutschland-Bereich
40–44. **Offensichtlich benutzt für: die eigene, hausinterne Nummer je Variante.**

> **Nebenbefund: der Zähler vergibt doppelt.** 12.590 Präfix-10-Codes in der
> Stichprobe verteilen sich auf nur **12.425 verschiedene** Nummern — **155
> Codes hängen an mehr als einer Variante**, etwa `1000000074109` an 23816 und
> 23818 oder `1000000143416` an 31884 und 65063. Ein Ziehungsartefakt ist das
> nicht: keine Variante kam in der Stichprobe zweimal vor. Für die hier
> gestellte Frage ändert das nichts, für einen Scan-Vorgang schon — eine
> Hausnummer ist nicht zwingend eindeutig. Unser Generator ist davon nicht
> betroffen, er vergibt im 20er-Bereich.

**`barcodeId 1` — „EAN_13 1" · 1.608 Codes · echte Hersteller-GTINs.**
Zwei Drittel liegen in 40–44 (GS1 Deutschland), der Rest streut über die
üblichen Länderpräfixe — `73` Schweden, `57` Dänemark, `87` Niederlande, `80`
Italien, `50` Großbritannien, `76` Schweiz, `74`. Genau das Bild, das
zugekaufte Ware erzeugt. 63 Einträge sind keine gültigen EAN-13 (kürzere
UPC-artige Codes wie `44728001000`). Beispiele: `9004552637593`,
`4012789497984`, `4260063295300`, `4025416018018`. **Offensichtlich benutzt
für: die GTIN, die der Hersteller auf die Ware gedruckt hat.**

**`barcodeId 3` — „EAN_13 3" · 2 Codes · praktisch ungenutzt.**
`4011209293489` und `4028177091818`, beide Präfix `40`, also Hersteller-GTINs.
Bei 2 Treffern auf 14.266 Barcodes ist das ein Restposten, keine gepflegte
Konfiguration.

**`barcodeId 4` — „EAN_13 4" · 0 Codes · ungenutzt.**
In 14.266 Barcode-Einträgen über 16.136 Varianten **kein einziger** Treffer.

**`barcodeId 23` — „Fotostudio" · 0 Codes · ungenutzt.**
Ebenfalls **kein einziger** Treffer. Die Konfiguration existiert und ist für 258
Referrer freigeschaltet (Abschnitt 5), trägt aber in der Stichprobe keine Daten.

> Zu 4 und 23: „0 in der Stichprobe" heißt nicht „0 im System". Bei 26,7 %
> Abdeckung wäre eine Konfiguration mit einigen hundert Codes mit hoher
> Wahrscheinlichkeit aufgefallen; einzelne Dutzend könnten durchgerutscht sein.
> Belegt ist: beide spielen mengenmäßig keine Rolle.

### Wie 1 und 2 zusammenspielen

| Varianten (mit Barcode, n = 13.026) | Anzahl |
| --- | ---: |
| nur `barcodeId 2` (nur Hausnummer) | **11.415** |
| beide, `1` **und** `2` | **1.191** |
| nur `barcodeId 1` (nur Hersteller-GTIN) | **417** |

Das ist die Arbeitsteilung im Klartext: **jede** Variante bekommt eine
Hausnummer unter der 2; die Hersteller-GTIN unter der 1 kommt nur dort dazu, wo
es sie gibt. Die beiden Konfigurationen konkurrieren nicht, sie ergänzen sich.

## 3. Der direkte Beleg — die Artikel, die unsere Anwendung angelegt hat

Abgefragt über `/rest/items/variations?categoryId=<id>&itemsPerPage=250&with=variationBarcodes`.

**In der Kategorie 2632 („Projekte") und den acht genannten Unterkategorien**
(2636, 2671, 2673, 2676, 2678, 2684, 2700, 2702) liegen **96 Varianten** mit
**98 Barcode-Einträgen**:

| `barcodeId` | Codes | Präfixe |
| --- | ---: | --- |
| **2** | **96** | `10`: 95 · `20`: **1** |
| 1 | 2 | `40`: 1 · `44`: 1 |

**Alle 96 Codes der Projekt-Artikel hängen an `barcodeId 2`** — die Zuordnung
im Projektcode trifft also die Konfiguration, die der Mandant auch selbst für
seine Hausnummern benutzt. Verteilung auf die Kategorien: 2636 → 4 Varianten,
2671 → 1, 2673 → 91; die übrigen fünf sind leer.

**Die genannte Kategorieliste ist allerdings unvollständig.** Die Projekt-Artikel
liegen auch in den Nachbar-IDs — und **dort** stehen die Codes, die unsere
Anwendung selbst erzeugt hat:

| Kategorie | Varianten | Präfixe der Barcodes (alle `barcodeId 2`, wo nicht anders vermerkt) |
| --- | ---: | --- |
| 2636 | 4 | `10`: 3 · `20`: 1 · (`40`: 1 unter `barcodeId 1`) |
| 2671 | 1 | `10`: 1 |
| 2672 | 6 | `10`: 5 · `20`: 1 |
| 2673 | 91 | `10`: 91 · (`44`: 1 unter `barcodeId 1`) |
| 2674 | **215** | `10`: 99 · `20`: 1 *(erste 100 Varianten)* |
| 2677 | 8 | `10`: 7 · `20`: 1 · (`73`: 1 unter `barcodeId 1`) |
| 2679 | 1 | `20`: 1 |
| 2685 | 1 | `20`: 1 |
| 2688 | 1 | `20`: 1 |
| 2701 | 1 | `20`: 1 |
| 2703 | 1 | `20`: 1 |
| 2632, 2676, 2678, 2684, 2700, 2702 | 0 | — |

**Die elf Codes mit Präfix 20 in der gesamten Stichprobe sind unsere.** Alle elf
hängen an `barcodeId 2`, alle tragen exakt Präfix `20` — den Standardwert aus
`generateEan13` — und alle wurden zwischen dem **26.08.2026 und dem 21.09.2026**
angelegt, also im Zeitraum unserer Anwendung:

| Code | Variante | Artikel | `createdAt` | Kategorie |
| --- | ---: | ---: | --- | --- |
| `2069070743772` | 74786 | 71416 | 2026-08-26 11:35 | 2636 |
| `2092697883569` | 74913 | 71543 | 2026-08-28 08:41 | 2672 |
| `2038827107648` | 74978 | 71608 | 2026-09-01 08:25 | 2674 |
| `2046441708066` | 75267 | 71897 | 2026-09-07 09:04 | 2677 |
| `2010875443237` | 75299 | 71929 | 2026-09-07 13:38 | 2679 |
| `2016122837361` | 75303 | 71933 | 2026-09-07 13:47 | — |
| `2022014485589` | 75306 | 71936 | 2026-09-07 13:57 | — |
| `2003375001571` | 75354 | 71984 | 2026-09-08 11:39 | 2685 |
| `2021855531240` | 75659 | 72289 | 2026-09-14 15:23 | 2688 |
| `2011378845504` | 75903 | 72533 | 2026-09-17 15:19 | 2701 |
| `2072477811098` | 76065 | 72695 | 2026-09-21 09:54 | 2703 |

Bei keiner dieser elf Varianten steht neben unserem Code noch eine
Präfix-10-Hausnummer — unser Code **ist** dort die Hausnummer. Umgekehrt zeigt
Variante 74785, eine Minute vor 74786 angelegt, das andere Muster:

```
Var 74785  barcodeId 1  4028177323322  createdAt 2026-08-27T07:53:14  (Hersteller)
Var 74785  barcodeId 2  1000000486292  createdAt 2026-08-26T11:34:33  (Hausnummer des Mandanten)
Var 74786  barcodeId 2  2069070743772  createdAt 2026-08-26T11:35:19  (unsere)
```

Beide Wege schreiben in **denselben** Platz `barcodeId 2`, und dieser Platz ist
in beiden Fällen der hausinterne — nur die Nummernkreise unterscheiden sich.

## 4. Warum die Präfixregel hier nicht entscheidet

Die Vorgabe lautete: 20–29 = hausintern, 40–44 = GS1 Deutschland, alles andere =
weitere Länderpräfixe und damit ebenfalls Hersteller-GTIN. **Nach dieser Regel
wäre `barcodeId 2` zu 99,9 % voller Hersteller-GTINs** — denn Präfix `10` fällt
in den GS1-Bereich der USA und Kanadas (000–019, 030–039, 060–139).

Diese Lesart ist falsch, und zwar aus Daten, nicht aus Vermutung:

1. Die Codes sind ein **lückenarmer fortlaufender Zähler** über 498.677 Nummern
   (`1000000000252` … `1000000498929`), Median-Abstand 7. Echte
   GS1-US-Herstellercodes aus zugekaufter Ware würden über Betriebsnummern
   streuen, nicht durchzählen.
2. Der Zähler **läuft weiter**: neu angelegte Varianten vom August 2026 bekamen
   `1000000486292`, `1000000489385`, `1000000495706` — das obere Ende des
   Bereichs. Ein Bestand zugekaufter Fremdcodes wächst nicht so.
3. `barcodeId 2` enthält **genau einen** Code aus 40–44 unter 12.606. Ein
   Sortiment, das zu zwei Dritteln deutsch beliefert wird (siehe `barcodeId 1`),
   kann seine Hersteller-GTINs nicht hier liegen haben.
4. Die Hersteller-GTINs liegen nachweislich woanders, nämlich unter
   `barcodeId 1` — mit genau der Streuung über Länderpräfixe, die man erwartet.

Der Mandant hat also einen eigenen Nummernkreis im 10er-Bereich gewählt statt im
dafür reservierten 20–29. Das ist GS1-seitig unsauber (der 10er-Bereich ist
vergeben, 20–29 wäre der korrekte „restricted distribution"-Bereich), ändert
aber nichts daran, **wofür** die Konfiguration benutzt wird.

## 5. Die Konfigurationen selbst

`/rest/items/barcodes?itemsPerPage=50` → `totalsCount = 18`.
Felder je Eintrag: `id`, `name`, `createdAt`, `updatedAt`, `type`, `referrers`.

**Ein Feld `isRestricted` gibt es nicht** — weder bei den GTIN_13-Einträgen noch
sonst. Die frühere Erhebung, die es erwähnt, ist an dieser Stelle zu korrigieren.

Unterschieden werden die Konfigurationen nur durch **`name`**, **`type`** und
die **`referrers`**:

| `id` | `name` | `type` | `referrers` |
| --- | --- | --- | --- |
| 1–4 | EAN_13 1 … 4 | `GTIN_13` | je **1** Eintrag, `referrerId = -1` (alle) |
| 5–8 | CODE_128 1 … 4 | `CODE_128` | je 1, `referrerId = -1` |
| 9–12 | EAN_128 1 … 4 | `GTIN_128` | je 1, `referrerId = -1` |
| 13–16 | UPC 1 … 4 | `UPC` | je 1, `referrerId = -1` |
| 17 | ISBN | `ISBN` | 1, `referrerId = -1` |
| **23** | **Fotostudio** | `GTIN_13` | **258** einzeln aufgezählte Referrer, **kein `-1`** |

Die Annahme aus der früheren Erhebung stimmt im Kern und ist in einer Zahl zu
korrigieren: 1–17 sind für `referrerId = -1` freigegeben — **bestätigt**. Die 23
ist für einzeln aufgezählte Referrer freigegeben — **bestätigt**, es sind aber
**258**, nicht „rund 300". Die Liste beginnt `0, 1, 2, 2.01, 2.02, 2.03, 2.04,
2.05, …`, enthält also auch die Unter-Referrer der Marktplätze.

Die IDs 18–22 existieren nicht (18 Einträge, Lücke zwischen 17 und 23).

Praktisch heißt das: **1, 2, 3 und 4 sind technisch gleichwertig** — gleicher
Typ, gleiche Freigabe. Was sie unterscheidet, ist allein, was der Mandant
hineingeschrieben hat. Genau deshalb musste es aus den Daten kommen.

---

## 6. Antwort auf die Frage

> Ist die 2 die Konfiguration für hausintern vergebene EANs — ja, nein, oder
> nicht eindeutig?

### Ja.

`barcodeId 2` ist der Platz für hausintern vergebene Codes. Unser Projektcode
hängt neu erzeugte EAN-13 an die richtige Stelle.

Die Zahlen, auf die sich das stützt:

- **12.590 von 12.606** Codes unter der 2 (99,9 %) sind ein fortlaufender
  hausinterner Zähler `1000000000252` … `1000000498929`, Median-Abstand 7.
- **1 von 12.606** Codes unter der 2 liegt im GS1-Deutschland-Bereich 40–44
  (0,008 %). Hersteller-GTINs stehen dort praktisch nicht.
- Die Hersteller-GTINs liegen unter **`barcodeId 1`**: 1.071 von 1.608 (66,6 %)
  in 40–44, der Rest über `73`, `57`, `87`, `80`, `50`, `76`, `74` gestreut.
- **11.415 von 13.026** Varianten mit Barcode haben *nur* die 2 — die Hausnummer
  bekommt jede Variante, die Hersteller-GTIN nur, wer eine hat.
- **96 von 96** Barcodes der Projekt-Artikel hängen an der 2.
- Alle **11** von unserer Anwendung erzeugten Präfix-20-Codes hängen an der 2,
  angelegt 26.08.–21.09.2026, und sind dort jeweils die einzige Nummer der
  Variante.
- **155** der hausinternen Präfix-10-Nummern sind doppelt vergeben — ein
  Hinweis mehr darauf, dass hier ein Hauszähler arbeitet und keine
  GS1-kontrollierte Vergabe.

### Was dabei zu wissen ist

Die Konfiguration stimmt, der **Nummernkreis** weicht ab: der Mandant vergibt
hausintern mit Präfix `10`, unsere Anwendung mit Präfix `20`
(`PLENTY_EAN_PREFIX`, Standard `20` in `lib/plenty/ean.ts`). Beide landen im
selben Feld.

Das ist **kein Fehler und kein Handlungsbedarf**:

- Kollidieren kann nichts — `20…` und `10…` sind disjunkt, und unser Generator
  vergibt ohnehin zufällig gestreut, nicht fortlaufend.
- Fachlich ist unser Präfix der **korrektere** von beiden: 20–29 ist der von GS1
  ausdrücklich für die hausinterne Vergabe reservierte Bereich, der 10er-Bereich
  ist an GS1 US vergeben.
- Nebeneffekt, der eher nützt: an den ersten zwei Stellen ist sofort zu sehen,
  welche Codes aus unserer Anwendung stammen.

Wer die Hausnummerierung dagegen **einheitlich** haben will, müsste
`PLENTY_EAN_PREFIX` auf `10` stellen und zusätzlich den Zählerstand des
Mandanten fortschreiben — was unser Generator nicht tut und ohne Sperre gegen
Doppelvergabe auch nicht gefahrlos tun kann. Davon ist abzuraten.

### Was nicht belegt ist

- Ob `barcodeId 4` und `23` irgendwo im System doch Codes tragen. In 26,7 % des
  Bestands: keiner. Für „mengenmäßig irrelevant" reicht das, für „garantiert
  leer" nicht.
- Woher die Präfix-10-Nummern technisch kommen (Plenty-Automatik, Import oder
  Altbestand). Für die gestellte Frage spielt das keine Rolle — belegt ist, dass
  sie hausintern vergeben sind und dass unsere Codes denselben Platz teilen.

---

## 7. Nachvollziehen

```bash
cd projektplanung

# Konfigurationen
node scripts/plenty.mjs get /rest/items/barcodes 'itemsPerPage=50'

# Varianten samt Barcodes, seitenweise (itemsPerPage wird auf 100 gedeckelt)
node scripts/plenty.mjs get /rest/items/variations \
  'itemsPerPage=250&with=variationBarcodes&page=300'

# Projekt-Artikel einer Kategorie
node scripts/plenty.mjs get /rest/items/variations \
  'categoryId=2673&itemsPerPage=250&with=variationBarcodes'

# Ein einzelner Code, rückwärts aufgelöst
node scripts/plenty.mjs get /rest/items/variations \
  'barcode=2069070743772&with=variationCategories,variationBarcodes'
```

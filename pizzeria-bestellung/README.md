# Pizzeria Borken — Bestellshop mit Stripe

Eigenes Bestell- und Zahlsystem auf der eigenen Domain. Löst foodbooking ab und
holt damit gleichzeitig die Speisekarte zurück, die im SEO-Audit als größter
Ranking-Hebel steht (siehe [`../seo-audits/pizzeria-borken.md`](../seo-audits/pizzeria-borken.md)).

> **Stand:** Der Zahlungskern ist fertig und getestet — Speisekarte, Warenkorb,
> Preisberechnung, Stripe-Checkout, Webhook, Annahme, Ablehnung, Erstattung.
> Was fehlt, ist die Oberfläche: Shop-Seiten, Warenkorb-UI und die Verwaltung
> fürs Küchen-Tablet. Siehe [Was noch fehlt](#was-noch-fehlt).

---

## Der entscheidende Punkt: Geld wird erst reserviert, nicht sofort eingezogen

Ein Lieferdienst kann nicht jede Bestellung annehmen. Freitag 20:30 Uhr ist die
Küche voll, der Thunfisch ist aus, der Fahrer fällt aus. Wer beim Bezahlen
sofort abbucht, muss dann erstatten — mit Gebühren, Wartezeit auf dem Konto des
Gastes und einem Anruf, den keiner führen will.

Deshalb läuft die Zahlung hier zweistufig:

```
Gast bezahlt          Küche entscheidet             Ergebnis
─────────────         ─────────────────             ────────
                  ┌── nimmt an  → capture     →  Geld gebucht, Bon läuft
Betrag wird ──────┤
nur reserviert    └── lehnt ab   → cancel      →  Reservierung frei,
(authorize)                                        kein Cent geflossen
```

Technisch: `capture_method: 'manual'` in der Checkout-Session
([`app/api/bestellung/route.ts`](app/api/bestellung/route.ts)), danach
`paymentIntents.capture` beim Annehmen oder `paymentIntents.cancel` beim
Ablehnen. Eine abgelehnte Bestellung erzeugt keine Gutschrift, keine Gebühr und
keine Rückfrage bei der Bank — sie hat nie stattgefunden.

Ist bereits gebucht und geht später etwas schief, greift dieselbe Route mit
Teilerstattung: `{ "betrag": 750, "grund": "Thunfisch aus" }`.

**Ein Haken:** Bei manueller Buchung zeigt Stripe nur Zahlarten an, die eine
getrennte Autorisierung können — Karten, Apple Pay, Google Pay. Ob PayPal und
Klarna für euer Konto dazugehören, vor dem Livegang im Dashboard prüfen; sonst
fallen sie im Checkout stillschweigend weg. Wer PayPal unbedingt braucht, muss
zwischen sofortiger Buchung mit Erstattungsrisiko und der sauberen Reservierung
wählen. Die Empfehlung ist die Reservierung.

---

## Wie es aufgebaut ist

```
Gast (Browser)                Vercel (Next.js)              Supabase
┌──────────────┐   Korb       ┌────────────────────┐        ┌──────────┐
│  Speisekarte │ ───────────► │ /api/bestellung    │ ─────► │ bestell- │
│  Warenkorb   │              │  · nachrechnen     │        │ ungen    │
└──────────────┘              │  · Öffnungszeiten  │        └──────────┘
       │                      │  · Session anlegen │
       │  Weiterleitung       └────────────────────┘
       ▼                                 │
┌──────────────┐              ┌──────────▼─────────┐
│Stripe Checkout│ ──Webhook──►│ /api/stripe/webhook│──► n8n ──► Bondrucker
└──────────────┘              └────────────────────┘           + Tablet
                                         │
                              ┌──────────▼─────────┐
                              │ annehmen / ablehnen│ ◄── Küchen-Tablet
                              └────────────────────┘
```

| Datei | Aufgabe |
|---|---|
| [`lib/speisekarte.ts`](lib/speisekarte.ts) | Preisquelle. Artikel, Extras, Allergene, MwSt-Gruppe |
| [`lib/warenkorb.ts`](lib/warenkorb.ts) | Rechnet den Korb serverseitig nach und weist Unsinn ab |
| [`lib/liefergebiet.ts`](lib/liefergebiet.ts) | Orte, Mindestbestellwerte, Liefergebühren |
| [`lib/oeffnungszeiten.ts`](lib/oeffnungszeiten.ts) | Eine Quelle für Website, Schema.org und Bestellannahme |
| [`lib/stripe.ts`](lib/stripe.ts) | Stripe-Client |
| [`lib/kueche.ts`](lib/kueche.ts) | Meldung an Bondrucker und Tablet |
| [`app/api/bestellung/route.ts`](app/api/bestellung/route.ts) | Bestellung anlegen, Checkout-Session erzeugen |
| [`app/api/stripe/webhook/route.ts`](app/api/stripe/webhook/route.ts) | Einzige Stelle, an der eine Bestellung als bezahlt gilt |
| [`app/api/bestellung/[id]/annehmen/route.ts`](app/api/bestellung/%5Bid%5D/annehmen/route.ts) | Küche nimmt an → Betrag buchen |
| [`app/api/bestellung/[id]/ablehnen/route.ts`](app/api/bestellung/%5Bid%5D/ablehnen/route.ts) | Ablehnen oder erstatten |
| [`db/schema.sql`](db/schema.sql) | Tabellen `bestellungen` und `bestell_posten` |

### Zwei Regeln, die den Rest tragen

**Preise kommen nie aus dem Browser.** Der Warenkorb schickt nur Artikel-IDs und
Mengen. Alles andere entsteht in `lib/warenkorb.ts` aus der Speisekarte. Ein
Test hält das fest: ein untergeschmuggelter Preis von 1 Cent wird ignoriert und
es werden trotzdem 7,50 € berechnet.

**Bezahlt ist eine Bestellung erst durch den Webhook.** Nicht durch die
Erfolgsseite — die kann der Gast wegklicken, und aufrufen kann sie jeder.

---

## Einrichten

### 1. Speisekarte einpflegen

`lib/speisekarte.ts` enthält ein Platzhalter-Sortiment. Vor allem anderen: die
echte Karte aus dem foodbooking-Konto exportieren und hier eintragen, inklusive
**Allergenen** — ohne die darf die Karte in Deutschland nicht online (LMIV).

### 2. Stripe-Konto

1. Konto auf [stripe.com](https://stripe.com) anlegen, Firmendaten und
   Bankverbindung hinterlegen. Bis das Konto verifiziert ist, gehen nur
   Testzahlungen.
2. **Entwickler → API-Schlüssel**: `sk_test_…` und `pk_test_…` in `.env.local`.
3. **Einstellungen → Zahlarten**: Karten aktivieren, dazu Apple Pay und Google
   Pay. Für Apple Pay muss die Shop-Domain unter *Payment method domains*
   registriert werden, sonst erscheint der Knopf nie.
4. **Entwickler → Webhooks → Endpunkt hinzufügen**:
   `https://<shop-domain>/api/stripe/webhook` mit den Ereignissen
   `checkout.session.completed`, `checkout.session.expired` und
   `charge.refunded`. Das *Signing secret* (`whsec_…`) nach
   `STRIPE_WEBHOOK_SECRET`.

### 3. Datenbank

`db/schema.sql` einmal im Supabase-SQL-Editor ausführen. Die Tabellen haben RLS
an und **keine** Policy — damit kommt ausschließlich der Server mit dem
Service-Role-Key heran, und niemand kann fremde Bestellungen auslesen.

### 4. Umgebung

`.env.example` nach `.env.local` kopieren und füllen. `KUECHEN_TOKEN` mit
`openssl rand -hex 32` erzeugen.

### 5. Lokal testen

```bash
npm install
npm test                 # Warenkorb-Regeln
npm run typecheck
npm run dev              # Port 3001

# Webhook lokal zustellen (zweites Terminal):
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Testkarte `4242 4242 4242 4242`, beliebiges künftiges Datum, beliebige Prüfziffer.
Nach dem Bezahlen steht die Bestellung auf `autorisiert` — im Stripe-Dashboard
als *Uncaptured*. Dann:

```bash
curl -X POST localhost:3001/api/bestellung/<id>/annehmen -H "x-kueche-token: $KUECHEN_TOKEN"
```

Der Betrag wird gebucht. Mit `/ablehnen` stattdessen wird die Reservierung frei.

---

## Was rechtlich dranhängt

Der Punkt, an dem eigene Bestellsysteme teuer werden — nicht die Technik.

| Thema | Was zu tun ist |
|---|---|
| **Allergene (LMIV)** | Pflichtangabe für jedes Gericht, auch online. In `lib/speisekarte.ts` vorgesehen, muss gefüllt werden. |
| **Zusatzstoffe** | „mit Farbstoff", „koffeinhaltig" usw. kennzeichnen. |
| **Preisangaben (PAngV)** | Endpreise inkl. MwSt, Liefergebühr klar ausgewiesen. Die Preise in der Speisekarte sind Bruttopreise. |
| **Mehrwertsteuer** | Speisen und Getränke laufen getrennt (`mwst`-Gruppe je Artikel), und Außer-Haus unterscheidet sich vom Verzehr vor Ort. Den konkreten Satz vor dem Livegang vom Steuerberater bestätigen lassen — er hat sich zuletzt geändert. |
| **Kassenführung / TSE** | Online-Bestellungen müssen in die Kassenführung. Ob und wie der Shop dabei unter die Kassensicherungsverordnung fällt, ist eine Frage für den Steuerberater — **vor** dem Livegang, nicht danach. |
| **Widerrufsrecht** | Für schnell verderbliche Speisen greift die Ausnahme nach § 312g Abs. 2 BGB. Gehört in die AGB, sonst entsteht ein Widerrufsrecht, das ihr nicht wollt. |
| **AGB und Bestellablauf** | Bestellbutton mit „zahlungspflichtig bestellen" beschriftet, Bestellbestätigung per E-Mail, AGB und Widerrufsbelehrung verlinkt. |
| **Datenschutz** | Stripe als Auftragsverarbeiter in die Datenschutzerklärung; Zahlungs- und Adressdaten in der Verarbeitungsübersicht. |

Nichts davon ist exotisch — aber alles davon ist Pflicht, und foodbooking hat
es bisher mitgeliefert.

## Was es kostet

| | foodbooking heute | eigener Shop |
|---|---|---|
| Zahlungsgebühr | im Paketpreis enthalten | rund 1,5 % + 0,25 € je Kartenzahlung im EWR (aktuellen Satz prüfen) |
| Grundgebühr | Paketpreis des Anbieters | Vercel + Supabase, in der Größenordnung kleiner zweistelliger Beträge pro Monat |
| Einmalig | — | Aufbau, Bondrucker-Anbindung, Steuerberater, ggf. Anwalt für AGB |
| Speisekarte im Google-Index | nein | **ja** — der eigentliche Grund für das Projekt |

Rein auf die Gebühren gerechnet lohnt sich der Wechsel erst ab einem gewissen
Bestellvolumen. Der Ranking-Gewinn kommt dagegen sofort und ist der Hebel, der
das Projekt trägt.

## Was noch fehlt

- **Shop-Oberfläche**: Speisekarten-Seite, Warenkorb, Kasse. Die Speisekarten-Seite
  ist zugleich die SEO-Landingpage aus dem Audit — sie sollte serverseitig
  gerendert werden, damit die Gerichte als Text im Index landen.
- **Verwaltung fürs Küchen-Tablet**: offene Bestellungen, ein Knopf für Annehmen,
  einer für Ablehnen, ein Notausschalter „heute geschlossen".
- **Bondrucker**: n8n-Workflow hinter `KUECHE_WEBHOOK_URL`, dazu ein Drucker mit
  Cloud-Anbindung.
- **SMS-Rückfallebene**: Wenn die Küchenmeldung fehlschlägt, muss jemand aktiv
  gewarnt werden. Aktuell wird der Fehlschlag nur an der Bestellung vermerkt.
- **Bestellbestätigung per E-Mail** an den Gast, mit Bon und Allergenen.
- **Aufräumlauf**: Reservierungen freigeben, die nach Ladenschluss niemand
  angefasst hat.
- **Umzug der Bestell-Links** auf der Hauptseite, erst wenn alles steht.

## Empfohlene Reihenfolge

1. Echte Speisekarte samt Allergenen einpflegen
2. Stripe-Konto verifizieren, Testzahlung durchspielen
3. Steuerberater zu Kassenführung und MwSt, AGB aufsetzen
4. Speisekarten-Seite und Warenkorb bauen (bringt bereits SEO, auch ohne Shop)
5. Küchen-Verwaltung und Bondrucker
6. Vier Wochen Parallelbetrieb mit foodbooking
7. Bestell-Links umstellen, foodbooking kündigen

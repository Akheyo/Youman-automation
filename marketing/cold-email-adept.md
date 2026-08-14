# Cold-Email-Vorlage — Adept

Absender: **Youman Automation** · Empfänger: **Adept** (und, über die
Platzhalter, jede vergleichbare Firma) · Ziel: **15-Minuten-Call**.

Alles hier ist Plain Text. Kein HTML, keine Bilder, kein Tracking-Pixel — das
ist der Grund, warum diese Mails im Posteingang statt im Werbe-Tab landen.

---

## Platzhalter

| Platzhalter | Beispiel | Woher |
|---|---|---|
| `{{vorname}}` | Michael | LinkedIn / Impressum |
| `{{firma}}` | Adept | — |
| `{{branche}}` | Agentur | siehe `lib/landing/industries.ts` (coaching, handwerk, agenturen, immobilien, fitness, kanzleien) |
| `{{aufhaenger}}` | „euer neues Team-Foto auf der Startseite" | 2 Min. Website/LinkedIn — **nie generisch** |
| `{{engpass}}` | Anfragen, die abends und am Wochenende reinkommen | aus dem Aufhänger abgeleitet |
| `{{absender}}` | Dein Name | — |
| `{{telefon}}` | +49 … | — |
| `{{kalender_link}}` | https://… | — |

Regel: Eine Mail ohne echten `{{aufhaenger}}` wird nicht verschickt. Der
Aufhänger ist der einzige Grund, warum jemand weiterliest.

---

## Mail 1 — Erstkontakt (Tag 0)

**Betreffzeilen (A/B/C — eine wählen, klein schreiben, kein Ausrufezeichen):**

- A: `Frage zu {{firma}}`
- B: `{{aufhaenger}}`
- C: `verpasste Anrufe bei {{firma}}?`

**Body (Variante Lina — KI-Telefon-Agent, Standard):**

```
Hallo {{vorname}},

mir ist {{aufhaenger}} aufgefallen — deshalb schreibe ich.

Bei den meisten {{branche}}-Betrieben, mit denen wir arbeiten, war der
teuerste Punkt nicht die Werbung, sondern die Zeit zwischen Anfrage und
Rückruf. Wer nach 20 Minuten zurückruft, redet oft schon mit dem Zweitplatzierten.

Wir haben dafür Lina gebaut: eine KI, die neue Anfragen in unter 60 Sekunden
anruft, auf Deutsch qualifiziert und den Termin direkt in euren Kalender legt.
Danach liegen Transkript und Zusammenfassung im Dashboard. Läuft ab 99 €/Monat,
Einrichtung an einem Nachmittag.

Lohnt sich ein 15-Minuten-Call nächste Woche, um zu schauen, ob das bei
{{firma}} überhaupt passt? Wenn nicht, sag einfach kurz Bescheid — dann
melde ich mich nicht wieder.

Viele Grüße
{{absender}}
Youman Automation · {{telefon}}
```

Länge: ~120 Wörter. Nicht länger. Wer mehr schreibt, bekommt weniger Antworten.

### Varianten — nur der mittlere Absatz wird getauscht

**Variante Felix (Chatbot & Lead-Recherche):**

```
Wir haben dafür Felix gebaut: einen Chat auf eurer Website, der Besucher
qualifiziert statt nur FAQ zu beantworten — und der euch parallel passende
Firmen in eurer Region raussucht, inklusive Ansprechpartner.
```

**Variante Anfragen-Radar:**

```
Wir haben dafür den Anfragen-Radar gebaut: er liest eingehende
Kategorie-Anfragen automatisch mit, gleicht sie mit eurem Bestand ab und legt
euch morgens nur die Treffer auf den Tisch — statt 60 Mails, die jemand
manuell durchsehen muss.
```

**Variante Gesamtpaket (wenn der Engpass unklar ist):**

```
Wir automatisieren bei {{branche}}-Betrieben genau die Strecke zwischen
„Anfrage kommt rein" und „Termin steht im Kalender" — Rückruf, Qualifizierung,
Terminbuchung, Nachfassen. Was davon bei euch hakt, weiß ich noch nicht,
deshalb frage ich.
```

---

## Mail 2 — Follow-up (Tag +3), im selben Thread antworten

```
Hallo {{vorname}},

kurz nachgehakt: Was uns bei {{branche}}-Kunden am häufigsten begegnet, ist
{{engpass}}. Falls das bei euch anders läuft, ignorier die Mail einfach.

Falls nicht — ich schicke dir gern eine 2-Minuten-Aufnahme, wie so ein Anruf
klingt. Kein Termin nötig.

Viele Grüße
{{absender}}
```

## Mail 3 — Beweis statt Pitch (Tag +7)

```
Hallo {{vorname}},

letzter inhaltlicher Punkt von mir: Ein {{branche}}-Kunde hatte vorher
im Schnitt mehrere Stunden bis zum Rückruf. Seit Lina läuft, liegt der
erste Kontakt unter einer Minute — dieselben Anfragen, mehr gehaltene Termine.

Wenn du 15 Minuten hast: {{kalender_link}}

Viele Grüße
{{absender}}
```

> Zahlen nur einsetzen, wenn sie belegbar sind. Erfundene Prozentwerte fallen
> spätestens im Call auf und kosten den Deal.

## Mail 4 — Break-up (Tag +14)

```
Hallo {{vorname}},

ich schließe das Thema bei mir ab — kein Problem, Timing ist meistens der
Grund.

Falls das Thema Rückruf-Geschwindigkeit später doch aufkommt: Meine Nummer
ist {{telefon}}, ich bin dann direkt erreichbar.

Viele Grüße
{{absender}}
```

Nach Mail 4 ist Schluss. Wer danach weiterschreibt, brennt die Domain ab.

---

## Signatur (unter jede Mail, Mail 1 zwingend)

```
{{absender}} · Youman Automation
{{telefon}} · https://youman-automation.com
[Firmierung, Anschrift, Vertretungsberechtigte, Registergericht + HRB, USt-IdNr.]

Keine weiteren Mails: einfach „stop" antworten.
```

Der Impressumsblock ist Pflicht (§5 DDG), auch in der Cold Mail. Die
Abmeldezeile ist kein Nice-to-have — sie ist die günstigste
Beschwerde-Prävention, die es gibt.

---

## Regeln für den Versand

- **Absender:** eigene Sub-Domain (z. B. `@mail.youman-automation.com`), nicht
  die Hauptdomain. SPF, DKIM und DMARC vorher setzen.
- **Aufwärmen:** neue Domain 2–3 Wochen warmlaufen lassen, dann max. 30–50
  Mails/Tag pro Postfach.
- **Keine Links in Mail 1.** Kein Anhang, kein Tracking-Pixel. Der Kalenderlink
  kommt frühestens in Mail 3.
- **Antworten im selben Thread**, damit der Verlauf sichtbar bleibt.
- **Sofort austragen** bei „stop", „kein Interesse" oder Abwesenheitsnotiz mit
  Nachfolger — und den Nachfolger neu recherchieren, nicht blind anschreiben.

## Rechtlicher Rahmen (Deutschland, B2B)

- Werbe-Mails ohne vorherige Einwilligung sind nach **§7 Abs. 2 Nr. 2 UWG**
  auch gegenüber Firmen unzulässig. Es gibt keine „B2B-Ausnahme" wie beim
  Telefonat (§7 Abs. 2 Nr. 1: mutmaßliche Einwilligung) — Cold Email trägt
  ein reales Abmahnrisiko.
- Praktische Konsequenz: nur an **Firmenpostfächer mit klarem sachlichen
  Bezug** zum Angebot, jede Absage sofort respektieren, Sperrliste führen.
  Wer das Risiko nicht tragen will, nutzt diese Texte als Skript für
  LinkedIn-Nachrichten oder als Gesprächsleitfaden für den Anruf — dort ist
  die Rechtslage im B2B entspannter.
- Verarbeitung der Kontaktdaten: berechtigtes Interesse nach **Art. 6 Abs. 1
  lit. f DSGVO**, mit Informationspflicht nach **Art. 14** beim ersten Kontakt
  (Link auf die Datenschutzerklärung in der Signatur genügt).
- Bewertung ohne Anwalt. Vor einer größeren Kampagne einmal juristisch
  gegenprüfen lassen.

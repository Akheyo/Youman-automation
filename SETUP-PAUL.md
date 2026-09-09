# Paul — Cold-Outreach per E-Mail einrichten

Paul verschickt Kaltakquise-Sequenzen: eine Erstmail, danach automatische
Follow-ups, bis der Kontakt antwortet, sich abmeldet oder die Sequenz durch
ist. Das Cockpit liegt unter **/outreach**.

Lina ruft an, Paul schreibt — beide arbeiten auf derselben Lead-Basis aus
Felix.

---

## 1. Datenbank

Das Schema in `supabase/schema.sql` einmal komplett im Supabase-SQL-Editor
ausführen (SQL Editor → New query → einfügen → Run). Die Datei ist
wiederholbar: bestehende Installationen bekommen die Outreach-Tabellen
ergänzt, ohne dass etwas verloren geht.

Angelegt werden:

| Tabelle | Inhalt |
| --- | --- |
| `outreach_campaigns` | Sequenz mit Absender, Versandfenster, Tageslimit |
| `outreach_steps` | die einzelnen Mails der Sequenz (Erstmail + Follow-ups) |
| `outreach_contacts` | Empfänger inkl. Fortschritt und nächstem Sendetermin |
| `outreach_events` | Protokoll: versendet, geantwortet, abgemeldet, Fehler |
| `outreach_suppression` | kontoweite Sperrliste |

## 2. Versandweg

Zwei Wege, Paul nimmt den ersten, der eingerichtet ist.

### Weg A — SMTP über dein eigenes Postfach (empfohlen)

Paul verschickt direkt über ein echtes Postfach. Kein Zwischensystem, keine
zusätzliche Software. Das ist auch der Weg, den lemlist und vergleichbare
Werkzeuge gehen.

**Warum kein Versanddienst?** Postmark, Resend und SendGrid verbieten
Kaltakquise ausdrücklich in ihren Nutzungsbedingungen. Ein dort gesperrtes
Konto trifft mitten in der laufenden Kampagne. Ein Postfach bei Google
Workspace oder Microsoft 365 hat diese Einschränkung nicht.

```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_USER = info@deine-domain.de
SMTP_PASS = <App-Passwort>
SMTP_FROM = info@deine-domain.de
```

| Anbieter | Host | Port |
| --- | --- | --- |
| Google Workspace | `smtp.gmail.com` | 465 (TLS) |
| Microsoft 365 | `smtp.office365.com` | 587 (STARTTLS) |
| IONOS | `smtp.ionos.de` | 465 (TLS) |
| Strato | `smtp.strato.de` | 465 (TLS) |

> **App-Passwort, nicht Kontopasswort.** Google und Microsoft lehnen das
> normale Passwort ab. Bei Google: Konto → Sicherheit → Zwei-Faktor
> einschalten → App-Passwörter → eines erzeugen. Das ist ein 16-stelliger
> Code, den du als `SMTP_PASS` einträgst.

`SMTP_FROM` muss zum angemeldeten Postfach passen oder von ihm versendet
werden dürfen — sonst schreibt der Mailserver die Adresse still um oder weist
die Mail ab.

**Prüfen:** Auf `/systemcheck` gibt es beim Punkt „Versandweg" den Knopf
**SMTP-Verbindung testen**. Er meldet sich am Postfach an, ohne eine Mail zu
verschicken, und übersetzt die typischen Fehler in Klartext.

Tageslimits beachten: Google Workspace erlaubt rund 500 Empfänger pro Tag,
Microsoft 365 etwa 10.000 — in der Anwärmphase ist beides mehr als genug.

### Weg B — Webhook (n8n, Make, eigener Dienst)

Alternative für alle, die ihren Versand ohnehin an einer Stelle bündeln. In
`OUTREACH_WEBHOOK_URL` einen Webhook eintragen, der diesen Body entgegennimmt
und die Mail zustellt:

```json
{
  "to": "anna@firma.de",
  "subject": "Kurze Frage zu Firma GmbH",
  "html": "…",
  "text": "…",
  "from": "Max Muster <max@firma.de>",
  "fromName": "Max Muster",
  "fromEmail": "max@firma.de",
  "replyTo": null,
  "company": "Firma GmbH",
  "headers": {
    "List-Unsubscribe": "<https://app.de/api/outreach/unsubscribe?token=…>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "In-Reply-To": "<nachricht-id>",
    "References": "<nachricht-id>"
  }
}
```

Zwei Dinge muss der Webhook tun:

1. **Die Kopfzeilen aus `headers` unverändert an die Mail hängen.** Ohne
   `List-Unsubscribe` landen Kaltakquise-Mails schnell im Spam, und die
   Ein-Klick-Abmeldung aus dem Postfach funktioniert nicht.
2. **Möglichst `{ "messageId": "<…>" }` zurückgeben.** Damit hängt Paul
   spätere Follow-ups an denselben Verlauf, statt einen neuen Thread
   aufzumachen.

Ist die Variable leer, fällt der Versand auf `FELIX_PITCH_WEBHOOK_URL`
zurück (denselben Weg nutzt Paul schon für Einzel-Pitches aus dem Chat).
Ohne beides lassen sich Sequenzen schreiben, Kontakte importieren und die
Vorschau ansehen — verschickt wird nichts.

`APP_URL` muss gesetzt sein, sonst kann kein Abmeldelink erzeugt werden.

## 3. Scheduler

Der Versand läuft über `/api/cron/outreach`. Auf Vercel ist der Cron in
`vercel.json` schon eingetragen (alle 15 Minuten). Bei einem anderen Hoster
den Endpunkt in gleichem Takt aufrufen:

```bash
curl -X POST https://<app>/api/cron/outreach \
  -H "Authorization: Bearer $CRON_SECRET"
```

Jeder Lauf beachtet Versandfenster, Wochenendsperre, das Tageslimit der
Kampagne (verteilt über die offenen Fensterstunden) und das Monatskontingent
des Tarifs.

## 4. Antworten und Bounces zurückmelden

Damit niemand ein Follow-up bekommt, nachdem er schon geantwortet hat, meldet
ein Postfach-Wächter (n8n/Make mit IMAP-Trigger) Antworten zurück:

```
POST /api/outreach/reply-webhook?token=<lead_webhook_token>
{ "email": "anna@firma.de", "kind": "antwort", "subject": "Re: …" }
```

`kind: "bounce"` setzt die Adresse zusätzlich dauerhaft auf die Sperrliste.
Den Token gibt es unter **Einstellungen → Webhooks** — es ist derselbe wie
beim Lead-Eingang.

Ohne diesen Ablauf funktioniert alles Übrige weiter; Antworten müssen dann im
Cockpit von Hand als „hat geantwortet" markiert werden.

## 5. Öffnungen messen (optional, standardmäßig aus)

Je Kampagne lässt sich unter **Kampagnen → Öffnungen messen** ein Zählpixel
einschalten. Danach zeigt die Kontaktliste, wer geöffnet hat, und der Bericht
eine Öffnungsrate. Es braucht dafür nichts einzurichten außer `APP_URL` — das
Pixel liegt unter `/api/outreach/p/<token>.gif` und läuft über dieselbe App.

Zwei Einschränkungen, die Sie kennen sollten, bevor Sie den Schalter umlegen:

**Die Zahl ist eine Tendenz, kein Nachweis.** Apple Mail lädt seit 2021 alle
Bilder schon beim Empfang vor; ohne Filter zählt damit jede Mail an einen
Apple-Nutzer als geöffnet. Firmen-Sicherheitsscanner tun dasselbe. Paul
sortiert aus, was sich erkennen lässt — Abrufe ohne Client-Kennung, bekannte
Scanner und alles, was in den ersten zehn Sekunden nach dem Versand eintrifft.
Apples Vorablader gibt sich allerdings als normaler Browser aus und lässt sich
nicht sicher abtrennen. Umgekehrt blockieren viele Clients Bilder, echte
Öffnungen fallen also durch. Verlässlich ist allein die Antwortquote.

**Rechtlich braucht Öffnungsmessung eine Einwilligung.** Nach Auffassung der
Datenschutzkonferenz und § 25 TDDDG trägt berechtigtes Interesse hier nicht.
Bei Kaltakquise haben Sie diese Einwilligung typischerweise nicht. Deshalb ist
der Schalter je Kampagne und standardmäßig aus — die Entscheidung soll bewusst
fallen. Klären Sie sie mit Ihrer Rechtsberatung.

Gespeichert wird bewusst wenig: Zeitpunkt und Zähler je versendeter Mail. Die
Client-Kennung dient nur dazu, Maschinen auszusortieren, und wird nicht
abgelegt; IP-Adressen werden nicht gespeichert.

Ein Nebeneffekt fürs Marketing: ein Zählpixel ist für Spamfilter ein Signal.
Reine Textmails ohne Pixel und ohne Link-Umschreibung kommen in der
Kaltakquise erfahrungsgemäß besser an.

---

## Rechtliches (kurz)

Kaltakquise per E-Mail an Unternehmen ist in Deutschland nicht frei — § 7 UWG
verlangt im Regelfall eine Einwilligung; ohne sie ist Werbung per Mail
grundsätzlich unzulässig. Ob im Einzelfall eine mutmaßliche Einwilligung
in Betracht kommt, ist eine Frage für Ihre Rechtsberatung, nicht für diese
Software. Bauen Sie Ihre Liste entsprechend auf.

Was die Software beisteuert:

- **Abmeldelink in jeder Mail** plus `List-Unsubscribe`-Header für die
  Ein-Klick-Abmeldung direkt aus dem Postfach (RFC 8058).
- **Kontoweite Sperrliste**: eine Abmeldung gilt sofort für alle Kampagnen,
  auch wenn die Adresse später erneut importiert wird.
- **Harte Bounces** landen automatisch auf der Sperrliste.
- **Protokoll je Kontakt** in `outreach_events` — wann was rausging und wann
  jemand widersprochen hat.
- **Feld `anlass`** je Kontakt für den sachlichen Grund der Ansprache.
- **Öffnungsmessung standardmäßig aus** und nur je Kampagne einschaltbar.

Impressumspflicht und Datenschutzhinweise gelten auch für Outreach-Mails:
Beides gehört in die Signatur der Kampagne.

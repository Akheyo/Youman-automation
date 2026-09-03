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

Der SMTP-Versand liegt außerhalb der App. In `OUTREACH_WEBHOOK_URL` einen
Webhook eintragen (n8n, Make oder ein eigener Dienst), der diesen Body
entgegennimmt und die Mail zustellt:

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

Impressumspflicht und Datenschutzhinweise gelten auch für Outreach-Mails:
Beides gehört in die Signatur der Kampagne.

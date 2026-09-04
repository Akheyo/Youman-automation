# Livegang — Youman Automation ins Netz bringen

Ziel: `app.deine-domain.de` läuft, du kannst dich anmelden, und Paul verschickt
echte Outreach-Mails.

Rechne mit **60 bis 90 Minuten**, davon der größte Teil Warten auf DNS.
Arbeite die Schritte der Reihe nach ab — jeder baut auf dem vorherigen auf.

**Dein Prüfstein:** die Seite `/systemcheck` in der App. Sie zeigt live, was
eingerichtet ist und was fehlt, inklusive der Frage, ob das Datenbankschema
wirklich eingespielt wurde. Nach jedem Schritt dort nachsehen. Wenn oben grün
steht „Alles Nötige steht", bist du durch.

---

## 0. Was du brauchst

| Konto | Wofür | Kosten |
| --- | --- | --- |
| **Supabase** | Datenbank + Login | kostenlos zum Start |
| **Vercel** | Hosting | kostenlos zum Start, siehe Schritt 6 |
| **Eine Domain** | Absenderadresse + App-Adresse | ~10 €/Jahr |
| **Ein Mailversand** | die Mails zustellen | ab ~15 €/Monat |

Alles Geheime gehört **ausschließlich in die Umgebungsvariablen bei Vercel** —
nie ins Repository, nie in einen Chat.

---

## 1. Supabase anlegen

1. Auf <https://supabase.com> registrieren → **New project**.
2. Name z. B. `youman-automation`, Region **Frankfurt (eu-central-1)** — die
   Daten bleiben damit in der EU. Datenbank-Passwort notieren.
3. Zwei Minuten warten, bis das Projekt bereit ist.

## 2. Schema einspielen

**SQL Editor → New query** → den kompletten Inhalt von
[`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.

Die Datei ist gefahrlos wiederholbar (`create table if not exists …`). Sie legt
alles an: Profile, Leads, Lina-Tabellen und die fünf Outreach-Tabellen für Paul.

> Häufigster Fehler beim Livegang: diesen Schritt vergessen oder nur einen Teil
> der Datei ausführen. Der Systemcheck prüft später gezielt nach, ob wirklich
> alle Tabellen da sind.

## 3. Schlüssel holen

**Project Settings → API**:

| Feld in Supabase | Variable |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` | `SUPABASE_SERVICE_ROLE_KEY` |

Der `service_role`-Schlüssel umgeht **alle** Zugriffsregeln der Datenbank. Er
gehört nur auf den Server. Wenn er je öffentlich wird: in Supabase sofort neu
erzeugen.

Unter **Authentication → URL Configuration** die **Site URL** auf deine spätere
App-Adresse setzen und unter **Redirect URLs** zusätzlich
`https://<deine-app>/auth/callback` eintragen. Ohne das laufen die Links aus den
Bestätigungsmails ins Leere.

## 4. Bei Vercel deployen

1. Auf <https://vercel.com> mit GitHub anmelden → **Add New → Project** →
   Repository `Akheyo/Youman-automation` importieren.
2. Framework wird als Next.js erkannt, Build-Einstellungen unverändert lassen.
3. **Vor** dem ersten Deploy unter **Environment Variables** die Werte aus
   Schritt 3 eintragen, dazu:

   ```
   APP_URL              = https://<deine-app>.vercel.app
   NEXT_PUBLIC_SITE_URL = https://<deine-app>.vercel.app
   OWNER_EMAILS         = deine@adresse.de
   CRON_SECRET          = <lange Zufallszeichenfolge>
   ```

   Eine brauchbare Zufallsfolge liefert `openssl rand -hex 32`.

4. **Deploy**. Nach ein bis zwei Minuten ist die App erreichbar.

> `APP_URL` ohne Schrägstrich am Ende. Sie steckt in jedem Abmeldelink — ist sie
> falsch, gehen Abmeldungen ins Leere, und dann darf keine Kaltakquise-Mail raus.

## 5. Erster Login

`https://<deine-app>.vercel.app/signup` aufrufen, mit der Adresse registrieren,
die du bei `OWNER_EMAILS` eingetragen hast. Diese Adresse hat automatisch
unbegrenzte Kontingente.

Dann **`/systemcheck`** öffnen. Die drei Punkte unter „Ohne das läuft nichts"
müssen grün sein. Sind sie es nicht, steht dort, welche Variable fehlt.

## 6. Den Scheduler klären — Achtung

In `vercel.json` sind zwei Cron-Aufträge eingetragen: Anrufe alle 10 Minuten,
Mailversand alle 15 Minuten.

**Der kostenlose Vercel-Hobby-Tarif erlaubt nur einen Cron-Aufruf pro Tag.**
Damit würde Paul höchstens einmal täglich senden — Follow-ups kämen Tage zu
spät. Zwei Wege:

- **Vercel Pro** (ca. 20 $/Monat): die Einträge funktionieren wie sie sind,
  nichts zu tun.
- **Externer Scheduler**, z. B. <https://cron-job.org> (kostenlos). Dort zwei
  Aufträge anlegen, die alle 15 Minuten aufrufen:

  ```
  POST https://<deine-app>/api/cron/outreach
  POST https://<deine-app>/api/cron/queue
  Header:  Authorization: Bearer <dein CRON_SECRET>
  ```

  In dem Fall den `crons`-Block in `vercel.json` löschen, damit nichts doppelt
  läuft.

## 7. Versand einrichten

Das ist der Schritt, der über Erfolg oder Spam-Ordner entscheidet. Ausführlich
in [SETUP-PAUL.md](SETUP-PAUL.md); hier die Kurzfassung.

**a) Eigene Absenderdomain nehmen, nicht die Hauptdomain.**
Wer Kaltakquise über `deine-firma.de` verschickt und sich die Reputation
verdirbt, verliert auch die normale Firmenpost. Nimm eine ähnliche Zweitdomain,
z. B. `deine-firma-mail.de`.

**b) Bei einem Versanddienst anmelden** — Postmark, Brevo, Mailgun oder ein
SMTP-Postfach. Dort die Absenderdomain verifizieren.

**c) DNS-Einträge setzen** (der Dienst zeigt dir die genauen Werte):

| Eintrag | Wozu |
| --- | --- |
| **SPF** | erlaubt dem Dienst, in deinem Namen zu senden |
| **DKIM** | signiert jede Mail nachprüfbar |
| **DMARC** | sagt Empfängern, was bei Fälschung passieren soll |

Ohne alle drei landen Kaltakquise-Mails zuverlässig im Spam. Die Verbreitung im
DNS dauert bis zu 24 Stunden.

**d) Webhook bauen**, der `{ to, subject, html, text, from, headers }`
entgegennimmt und per SMTP zustellt (n8n, Make oder ein kleiner eigener Dienst).
Zwei Pflichten: die Kopfzeilen aus `headers` **unverändert** an die Mail hängen,
und möglichst `{ "messageId": "<…>" }` zurückgeben. Die genaue Nutzlast steht in
SETUP-PAUL.md.

Die Adresse des Webhooks als `OUTREACH_WEBHOOK_URL` bei Vercel eintragen.

**e) Die neue Domain langsam anwärmen.** Erste Woche höchstens 20 Mails am Tag,
dann schrittweise steigern. Eine frische Domain, die sofort 200 Mails
verschickt, wird als Spam eingestuft — daran scheitern die meisten ersten
Kampagnen, nicht am Text.

## 8. Testlauf

1. `/outreach` → Kampagne „Test" anlegen.
2. Reiter **Kontakte** → dich selbst eintragen, mit einer zweiten Mailadresse.
3. Reiter **Sequenz** → **Vorschau** drücken. Kein Platzhalter darf rot sein.
4. Zurück zu **Kontakte** → **Jetzt senden**.

Prüfe in der eingegangenen Mail:

- [ ] Absendername und -adresse stimmen
- [ ] Keine Lücken im Text („Hallo ,")
- [ ] Der Abmeldelink unten funktioniert und meldet dich wirklich ab
- [ ] Die Mail landet im Posteingang, nicht im Spam
- [ ] Antwortest du darauf, springt der Kontakt auf „hat geantwortet"
      (nur mit eingerichtetem Antwort-Webhook, siehe SETUP-PAUL.md Schritt 4)

Danach in der Sperrliste nachsehen: Deine Testadresse sollte dort stehen. Nimm
sie wieder heraus, sonst erreichst du dich beim nächsten Test nicht mehr.

## 9. Scharf schalten

Erst wenn Schritt 8 sauber durchlief:

1. Echte Kontakte importieren (CSV oder aus den Felix-Leads).
2. Sequenztexte überschreiben — die Startsequenz ist ein Gerüst, kein fertiger
   Verkaufstext. Vor allem `[Ihr Nutzen in einem Satz]` und
   `[konkretes Ergebnis]` ersetzen.
3. Signatur mit Impressumsangaben füllen. Pflicht, auch bei Outreach-Mails.
4. `max_per_day` niedrig anfangen lassen (siehe Anwärmen, Schritt 7e).
5. **Versand starten**.

Im Reiter **Bericht** siehst du danach, was passiert.

---

## Eigene Domain statt vercel.app

Sobald es läuft: in Vercel unter **Settings → Domains** die eigene Domain
hinzufügen und den angezeigten DNS-Eintrag setzen. Danach **unbedingt**
nachziehen:

- `APP_URL` und `NEXT_PUBLIC_SITE_URL` bei Vercel auf die neue Adresse
- **Site URL** und **Redirect URLs** in Supabase
- den `GOOGLE_REDIRECT_URI`, falls der Kalender angebunden ist

Alte Abmeldelinks aus bereits verschickten Mails zeigen weiter auf die alte
Adresse — lass die vercel.app-Domain deshalb aktiv.

## Wenn etwas nicht läuft

| Symptom | Wahrscheinliche Ursache |
| --- | --- |
| Login geht nicht | Site URL / Redirect URLs in Supabase falsch |
| „Kampagne nicht gefunden" | Schema nicht (vollständig) eingespielt — Schritt 2 |
| Nichts wird versendet | `OUTREACH_WEBHOOK_URL` fehlt, oder Cron läuft nicht (Schritt 6) |
| Versand nur einmal am Tag | Vercel-Hobby-Tarif — Schritt 6 |
| Alles im Spam | SPF/DKIM/DMARC unvollständig oder Domain nicht angewärmt |
| Kontakt bleibt „gestoppt" | Platzhalter ohne Wert — die Meldung am Kontakt sagt welcher |

Erste Anlaufstelle bleibt `/systemcheck`. Für alles, was danach kommt, hilft das
Log unter **Vercel → Deployments → Functions**.

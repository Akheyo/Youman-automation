# Sapore Grill — Bestellungen in den Laden bringen

Wie eine Online-Bestellung von der Website auf das Gerät im Laden kommt, und was
dafür einmal eingerichtet werden muss.

## Der Weg einer Bestellung

```
Gast bestellt auf /sapore-grill
        │
        ▼
  /api/sapore-grill/order   ← rechnet Preise serverseitig nach
        │
        ├─ 1. speichern  → Supabase, Tabelle sapore_orders
        │
        └─ 2. melden     ├─ Telegram aufs Handy
                         └─ Webhook (n8n / Make / später die Kasse)
        │
        ▼
  /sapore-grill/kueche      ← Tablet im Laden, holt alle 10 Sekunden nach
```

Entscheidend ist die Reihenfolge: **erst speichern, dann melden.** Geht eine
Meldung verloren — Tablet im Standby, WLAN weg, Telegram gestört — liegt die
Bestellung trotzdem in der Datenbank und taucht in der Küchenansicht auf, sobald
jemand hinschaut. Keine Bestellung kann durch eine ausgefallene Benachrichtigung
verschwinden.

## Einrichtung

### 1. Datenbank anlegen

Im Supabase-Dashboard: **SQL Editor → New query** → Inhalt von
`supabase/sapore-grill.sql` einfügen → **Run**.

Legt die Tabelle `sapore_orders` an. Row Level Security ist eingeschaltet und es
gibt bewusst keine Freigabe: an die Bestellungen kommt ausschließlich der Server
heran. In den Zeilen stehen Namen, Telefonnummern und Adressen der Gäste.

### 2. Zugangscode für die Küche setzen

```bash
openssl rand -hex 24
```

Ergebnis als `SAPORE_KITCHEN_TOKEN` in die Umgebungsvariablen eintragen (lokal in
`.env.local`, in Produktion bei Vercel unter Settings → Environment Variables).

Ohne diesen Wert ist `/sapore-grill/kueche` gesperrt.

### 3. Telegram einrichten (optional, aber empfohlen)

Kostenlos, sofort, keine Freischaltung nötig:

1. In Telegram **@BotFather** anschreiben, `/newbot` senden, Namen vergeben.
2. Den Token, den BotFather zurückschickt → `SAPORE_TELEGRAM_BOT_TOKEN`.
3. Dem eigenen neuen Bot **einmal** eine Nachricht schreiben (sonst darf er nicht
   antworten).
4. **@userinfobot** anschreiben, die angezeigte Chat-ID → `SAPORE_TELEGRAM_CHAT_ID`.

Sollen mehrere Leute die Meldung bekommen: eine Telegram-Gruppe anlegen, den Bot
hineinholen und die Gruppen-ID verwenden (beginnt mit `-`).

### 4. Tablet im Laden einrichten

1. Im Browser `https://<domain>/sapore-grill/kueche` aufrufen.
2. Zugangscode aus Schritt 2 eingeben — das Gerät merkt ihn sich danach.
3. Seite zum Startbildschirm hinzufügen, damit sie wie eine App startet.
4. In den Geräteeinstellungen den **Bildschirm-Timeout ausschalten** und das
   Tablet ans Ladekabel hängen.
5. Einmal auf **Ton an** tippen. Browser erlauben Töne erst nach einer Berührung —
   ohne diesen einen Tipp bleibt der Signalton stumm.

## Bedienung im Laden

Drei Spalten, von links nach rechts:

| Spalte    | Bedeutung                          | Knopf         |
| --------- | ---------------------------------- | ------------- |
| Neu       | Gerade eingegangen, Ton hat geklingelt | **Annehmen**  |
| In Arbeit | Wird zubereitet                    | **Fertig**    |
| Fertig    | Wartet auf Abholung oder Fahrer    | **Übergeben** |

Nach *Übergeben* verschwindet die Bestellung von der Tafel und bleibt in der
Datenbank. Bestellungen älter als 20 Minuten bekommen eine auffällige Zeitangabe.

## Kassensystem anbinden

Noch offen — dafür muss feststehen, welche Kasse im Laden steht. Die Anbindung
kommt später als zusätzlicher Empfänger dazu (dieselbe Stelle wie Telegram, in
`lib/sapore/notify.ts`). Am Rest ändert sich dabei nichts: die Küchenansicht
bleibt als Rückfallebene bestehen, falls die Kasse einmal nicht erreichbar ist.

Grobe Einschätzung nach Hersteller:

- **ready2order, Lightspeed/Gastrofix, Tillhub** — offene Schnittstelle, machbar.
- **Vectron, Hypersoft, orderbird** — nur über einen Partnervertrag mit dem
  Hersteller, mit Vorlauf und Kosten.
- **Lieferando-/Uber-Eats-Gerät** — geschlossenes System der Plattform, von außen
  nicht anbindbar.

## Wenn etwas nicht ankommt

| Beobachtung                            | Ursache und Abhilfe                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Küchenansicht sagt „Datenbank nicht eingerichtet" | Schritt 1 fehlt, oder `SUPABASE_SERVICE_ROLE_KEY` ist nicht gesetzt.        |
| „Falscher Zugangscode"                 | `SAPORE_KITCHEN_TOKEN` stimmt nicht oder wurde nach dem Setzen nicht neu deployt.    |
| Kein Signalton                          | Einmal auf **Ton an** tippen. Browser spielen ohne vorherige Berührung nichts ab.    |
| Bestellung da, aber kein Telegram       | An der Bestellzeile steht der Grund in `forward_error`. Meist: Bot nie angeschrieben. |
| Gast bekam Nummer, Bestellung fehlt     | `stored: false` in der Antwort — Datenbank war nicht erreichbar. Serverprotokoll prüfen. |

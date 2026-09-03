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

## Kassensystem anbinden — SumUp

Steht im Laden eine **SumUp Kasse** (die POS-App auf einem Tablet, nicht nur ein
Kartenlesegeraet), ist die Anbindung machbar: SumUp POS hat dafuer die
**External Sale API**. Eine so erzeugte Bestellung erscheint laut Hersteller
innerhalb von rund 10 Sekunden auf den Kassen des Betriebs, druckt den Bon und
laeuft in die Kitchen-Display-App — genau so, als waere sie an der Kasse
eingetippt worden.

Wichtig ist die Unterscheidung:

| Geraet | Anbindung |
| ------ | --------- |
| **SumUp Kasse / POS** (Tablet mit Kassen-App) | Machbar ueber die External Sale API. |
| **SumUp Solo, Air, 3G** (reines Kartenlesegeraet) | Nicht moeglich — die Geraete nehmen nur Zahlungen entgegen und haben keine Bestellliste. |

### Was dafuer gebraucht wird

1. **API-Schluessel** aus dem SumUp-Dashboard (dort unter den Entwickler- bzw.
   API-Einstellungen anzulegen).
2. **Artikelnummern**: die Kasse kennt unsere Artikel-IDs nicht. Jede Position
   der Speisekarte muss auf einen in der Kasse angelegten Artikel zeigen. Dafuer
   gibt es in `lib/sapore/menu.ts` je Gericht das Feld `posId`. Die Nummern
   liefert der Endpunkt `ExternalSale-GetProducts`.
3. **Filial-ID** vom Endpunkt `Outlet-GetOutlets`.

Die eigentliche Bestellung geht dann an `ExternalSale-CreateSale`. Die genauen
Feldnamen stehen in der Hersteller-Doku unter <https://apidoc.thegoodtill.com>
(SumUp POS stammt aus der Uebernahme von Goodtill, daher die Adresse).

### Reihenfolge

Die Kasse kommt als **zusaetzlicher Empfaenger** dazu, an derselben Stelle wie
Telegram (`lib/sapore/notify.ts`). Am Rest aendert sich nichts: die Bestellung
wird weiterhin zuerst gespeichert, und die Kuechenansicht bleibt als
Rueckfallebene bestehen, falls die Kasse einmal nicht erreichbar ist. Faellt die
Uebergabe an die Kasse aus, steht der Grund an der Bestellzeile in
`forward_error`.

## Wenn etwas nicht ankommt

| Beobachtung                            | Ursache und Abhilfe                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Küchenansicht sagt „Datenbank nicht eingerichtet" | Schritt 1 fehlt, oder `SUPABASE_SERVICE_ROLE_KEY` ist nicht gesetzt.        |
| „Falscher Zugangscode"                 | `SAPORE_KITCHEN_TOKEN` stimmt nicht oder wurde nach dem Setzen nicht neu deployt.    |
| Kein Signalton                          | Einmal auf **Ton an** tippen. Browser spielen ohne vorherige Berührung nichts ab.    |
| Bestellung da, aber kein Telegram       | An der Bestellzeile steht der Grund in `forward_error`. Meist: Bot nie angeschrieben. |
| Gast bekam Nummer, Bestellung fehlt     | `stored: false` in der Antwort — Datenbank war nicht erreichbar. Serverprotokoll prüfen. |

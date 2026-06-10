# Lina — KI-Telefon-Agent: Einrichtung

Lina ruft deine Leads an, führt das Gespräch auf Deutsch, prüft deinen
Google-Kalender und **bucht den Termin selbst**. Danach hast du Transkript,
Zusammenfassung und (falls aktiviert) die Aufnahme im Sales-Dashboard.

Die Software ist fertig. Damit echte Anrufe laufen, sind drei Bausteine nötig.
Alle geheimen Keys gehören **nur in die Vercel-Environment-Variablen**, niemals
in den Chat oder ins Git-Repo.

---

## 1) Datenbank-Tabellen anlegen (Supabase)

Im Supabase-Dashboard → **SQL Editor → New query** → den kompletten Inhalt von
`supabase/schema.sql` einfügen → **Run**. Das ist gefahrlos wiederholbar
(`create table if not exists …`) und legt die neuen Tabellen an:
`agent_config`, `call_leads`, `calls`, `meetings`, `google_tokens` sowie die
Anruf-Quote.

---

## 2) Vapi (die Telefonie)

1. Konto auf **https://vapi.ai** anlegen.
2. **Phone Numbers** → eine Nummer kaufen (z. B. eine deutsche/österreichische
   Nummer, oder eine zum Testen). Die **Phone Number ID** kopieren.
3. **API Keys** → einen **Private Key** kopieren.
4. In Vercel als Environment-Variablen setzen:
   - `VAPI_API_KEY` = der Private Key
   - `VAPI_PHONE_NUMBER_ID` = die Phone Number ID
   - `APP_URL` = deine öffentliche App-URL, z. B. `https://app.youman-automation.com`

> Kosten: Vapi rechnet pro Minute ab (Telefonie + Stimme + KI). Für Tests
> reichen wenige Euro. Die Monats-Limits pro Tarif (5 / 100 / 500 Anrufe)
> schützen dich zusätzlich.

---

## 3) Google Calendar (damit Lina selbst bucht)

1. **https://console.cloud.google.com** → Projekt anlegen (oder vorhandenes nutzen).
2. **APIs & Services → Library** → **Google Calendar API** aktivieren.
3. **APIs & Services → OAuth consent screen** → „External", App-Name eintragen,
   deine Gmail als Test-Nutzer hinzufügen.
4. **Credentials → Create Credentials → OAuth client ID** → Typ **Web application**.
   - Authorized redirect URI: `https://DEINE-APP-URL/api/google/callback`
5. Client-ID und Client-Secret kopieren und in Vercel setzen:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://DEINE-APP-URL/api/google/callback`
6. Nach dem Deploy: im Sales-Dashboard (`/sales`) auf **„Kalender verbinden"**
   klicken und einmal mit deinem Google-Konto bestätigen. Fertig — Lina liest
   ab jetzt deine freien Zeiten und trägt Termine direkt ein.

---

## So benutzt du es danach

1. **Leads rein**: in `/sales` manuell anlegen, CSV hochladen, oder im
   Felix-Chat bei einer Firma auf **„📞 An Lina übergeben"** klicken.
2. **Freigeben**: kalte Leads (CSV/Felix) stehen auf „Warten auf Freigabe".
   Klick **Freigeben**, dann darf Lina anrufen. (Rechtlich sauber — du
   entscheidest pro Nummer.)
3. **Anrufen**: Button **📞 Anrufen** am Lead. Lina telefoniert, bucht bei
   Interesse den Termin und legt auf.
4. **Auswerten**: Tab **Anrufe** zeigt Status, Zusammenfassung, Transkript und
   Aufnahme. Tab **Übersicht** zeigt Erfolgsquote und nächste Termine.
5. **Linas Charakter**: Tab **Lina-Konfig** — Tonfall, Ziel, Gesprächsleitfaden,
   Do's & Don'ts frei anpassen.

⚖️ **Hinweis (Deutschland):** Kalt-Anrufe bei Firmen brauchen „mutmaßliche
Einwilligung" (§7 UWG), bei Privatpersonen sind sie ohne Einwilligung unzulässig.
Deshalb der Freigabe-Schritt — nutze ihn bewusst.

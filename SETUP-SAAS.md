# SaaS-Setup — Youman Automation (Felix)

So machst du aus Felix eine echte SaaS mit Login, Datenbank und (später) Abos.
**Wichtig:** Solange die Supabase-Variablen leer sind, läuft alles offen wie
bisher. Erst wenn du sie setzt, greifen Login + Nutzungslimits.

---

## Phase 1 — Login & Datenbank (Supabase)  ✅ im Code fertig

### 1. Supabase-Projekt anlegen
1. Auf <https://supabase.com> kostenlos registrieren → **New project**.
2. Name z. B. `youman-automation`, Region **Frankfurt (eu-central-1)**, ein
   Datenbank-Passwort vergeben (notieren).
3. Warten, bis das Projekt bereit ist (~2 Min).

### 2. Datenbank-Tabellen anlegen
1. Im Projekt links auf **SQL Editor** → **New query**.
2. Den kompletten Inhalt von [`supabase/schema.sql`](supabase/schema.sql)
   einfügen → **Run**. (Legt Profile, Leads, gesendete Mails, Limits an.)

### 3. Schlüssel kopieren
**Project Settings → API**:
- `Project URL`            → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key        → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key       → `SUPABASE_SERVICE_ROLE_KEY` (geheim! nur Server)

### 4. E-Mail-Bestätigung & URLs
**Authentication → URL Configuration**:
- **Site URL**: deine App-URL (z. B. `https://app.youman-automation.com` oder
  die Vercel-URL).
- **Redirect URLs**: zusätzlich `https://DEINE-URL/auth/callback` eintragen.

> Tipp zum Testen: Unter **Authentication → Providers → Email** kannst du
> „Confirm email" vorübergehend ausschalten, dann bist du nach der
> Registrierung sofort eingeloggt (ohne Bestätigungsmail).

### 5. In Vercel eintragen
Vercel → Projekt → **Settings → Environment Variables**, alle aus Schritt 3
hinzufügen (+ später Stripe). **Redeploy.**

➡️ Danach: `/felix` verlangt Login. Registrieren unter `/signup`, anmelden unter
`/login`. Jeder neue Nutzer startet im **Free**-Tarif (10 Suchen / 5 Mails pro
Monat). Limits & Tarife stehen in [`lib/plans.ts`](lib/plans.ts).

---

## Phase 2 — Bezahlung (Stripe)  ⏳ als Nächstes

Kommt im nächsten Schritt: Pricing-Seite, Stripe-Checkout, Webhook der den
Tarif im Profil setzt, Kundenportal. Vorbereitet sind bereits die Profil-Felder
(`plan`, `stripe_customer_id`, …) und die Env-Variablen (`STRIPE_*`).

## Phase 3 — Hülle  ⏳ danach
Landingpage, Pricing-Seite öffentlich, Dashboard mit Verbrauchsanzeige &
Lead-/Mail-Historie.

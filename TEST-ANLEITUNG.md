# Test-Anleitung — Felix SaaS

Klick nach dem Setup einmal den kompletten Ablauf durch. Reihenfolge einhalten.

## 0. Voraussetzungen (einmalig)
- [ ] Supabase eingerichtet, `supabase/schema.sql` ausgeführt (siehe `SETUP-SAAS.md`)
- [ ] Supabase-Keys in Vercel gesetzt → **Redeploy** gelaufen
- [ ] Stripe-Keys + Price-IDs + Webhook in Vercel gesetzt (für den Abo-Test)
- [ ] `OPENROUTER_API_KEY`, `GOOGLE_MAPS_API_KEY`, `FELIX_PITCH_WEBHOOK_URL` gesetzt

> Tipp: Zum Testen unter Supabase → Authentication → Providers → Email kann
> „Confirm email" aus sein, dann bist du nach der Registrierung sofort drin.

---

## 1. Landingpage
- [ ] `/start` öffnen → Hero, Team (Felix/Anna/Paul mit Bildern), Schritte, FAQ sind sichtbar
- [ ] Buttons „Kostenlos starten" → führen zu `/signup`

## 2. Registrierung & Login
- [ ] `/signup`: Name, E-Mail, Passwort → **Konto erstellen**
- [ ] Entweder direkt eingeloggt **oder** Hinweis „bestätige deine E-Mail" → Link in der Mail klicken
- [ ] Danach landest du auf `/felix`
- [ ] Test: `/felix` im Inkognito-Fenster (ausgeloggt) öffnen → wird auf `/login` umgeleitet ✅

## 3. Inhaber-Account (optional)
- [ ] Lokal: `node scripts/create-user.mjs infoall4youstore@gmail.com DEIN_PASSWORT pro`
- [ ] Unter `/login` mit diesen Daten anmelden → im `/dashboard` steht Tarif **Pro**

## 4. Felix — Firmensuche
- [ ] In `/felix` z. B. tippen: `Restaurants in Borken ohne Website`
- [ ] Felix antwortet mit Liste + Firmenkarten; Avatar/Name **Felix** ist sichtbar

## 5. Anna — Analyse
- [ ] `Analysiere [Firmenname] im Hinblick auf eine neue Website mit Online-Reservierung`
- [ ] Antwort kommt von **Anna**; nennt gefundene E-Mail (falls auf der Website)

## 6. Paul — Pitch & Versand
- [ ] `Schreib dafür einen Pitch`
- [ ] **Paul** zeigt Entwurf (Empfänger, Betreff, Text) — **noch nicht gesendet**
- [ ] `Ja, senden` → Paul bestätigt den Versand
- [ ] Prüfen: Mail kommt an (ggf. an eine eigene Testadresse pitchen)

## 7. Nutzungslimits
- [ ] `/dashboard`: Verbrauchsbalken „Firmensuchen" / „Pitch-Mails" sind gestiegen
- [ ] Mit einem Free-Account mehr als 10 Suchen → Felix meldet „Monatslimit erreicht, bitte upgraden"

## 8. Abo (Stripe)
- [ ] `/pricing` → **Starter** oder **Pro** → **Abonnieren**
- [ ] Stripe-Checkout im **Testmodus**: Karte `4242 4242 4242 4242`, beliebiges Datum/CVC
- [ ] Nach Zahlung Weiterleitung zu `/dashboard?checkout=success`
- [ ] Tarif im Dashboard ist aktualisiert (Webhook hat gegriffen)
- [ ] „Abo verwalten / kündigen" → öffnet das Stripe-Kundenportal

## 9. Abmelden
- [ ] Button „Abmelden" (Header in `/felix` oder `/dashboard`) → zurück auf `/login`

---

### Wenn etwas hakt
- **Felix antwortet nicht / 401** → eingeloggt? `OPENROUTER_API_KEY` gesetzt?
- **Keine Firmen** → `GOOGLE_MAPS_API_KEY` gesetzt? Andere Region/Branche probieren.
- **Mail wird nicht gesendet** → `FELIX_PITCH_WEBHOOK_URL` gesetzt? n8n-Workflow aktiv?
- **Abo-Tarif aktualisiert sich nicht** → Stripe-Webhook-Endpoint + `STRIPE_WEBHOOK_SECRET` korrekt?

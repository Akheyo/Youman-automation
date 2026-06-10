/**
 * Legt einen bestätigten Benutzer direkt in Supabase an (ohne Bestätigungsmail)
 * und setzt seinen Tarif. Gedacht für den Inhaber-/Test-Account.
 *
 * Voraussetzung: Supabase ist eingerichtet und supabase/schema.sql wurde
 * ausgeführt. Die Schlüssel stehen in .env.local ODER werden als Env-Variablen
 * übergeben:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (geheim!)
 *
 * Aufruf:
 *   node scripts/create-user.mjs <email> <passwort> [plan]
 * Beispiel:
 *   node scripts/create-user.mjs infoall4youstore@gmail.com MeinPasswort123 pro
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// .env.local laden, falls vorhanden (einfacher Parser, keine Abhängigkeit).
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* keine .env.local – dann müssen die Variablen exportiert sein */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email = 'infoall4youstore@gmail.com', password, plan = 'pro'] = process.argv.slice(2);

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein (.env.local oder Env).');
  process.exit(1);
}
if (!password) {
  console.error('❌ Passwort fehlt.  Aufruf: node scripts/create-user.mjs <email> <passwort> [plan]');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Inhaber' },
});

if (error) {
  console.error('❌ Benutzer konnte nicht angelegt werden:', error.message);
  process.exit(1);
}

const userId = data.user.id;

// Der DB-Trigger legt das Profil automatisch an – wir setzen nur den Tarif.
const { error: upErr } = await admin.from('profiles').update({ plan }).eq('id', userId);
if (upErr) {
  // Falls der Trigger noch nicht durch ist: Profil sicherheitshalber anlegen.
  await admin.from('profiles').upsert({ id: userId, email, plan });
}

console.log(`✅ Benutzer angelegt: ${email}  (Tarif: ${plan})`);
console.log('   Du kannst dich jetzt unter /login anmelden.');

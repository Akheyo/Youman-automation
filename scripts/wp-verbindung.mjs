/**
 * Prueft die Verbindung zu einer WordPress-Installation und zeigt, worauf der
 * hinterlegte Zugang tatsaechlich zugreifen darf. Erster Schritt, bevor
 * irgendetwas an der Seite geaendert wird.
 *
 * Zugangsdaten kommen aus .env.local ODER aus Env-Variablen:
 *   WP_URL            z.B. https://ab-solarenergy.de
 *   WP_USER           WordPress-Benutzername (nicht die E-Mail-Adresse)
 *   WP_APP_PASSWORD   Anwendungspasswort aus WP-Admin -> Profil
 *
 * Aufruf:
 *   node scripts/wp-verbindung.mjs
 */

import { readFileSync } from 'node:fs';

// .env.local laden, falls vorhanden (einfacher Parser, keine Abhaengigkeit).
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* keine .env.local - dann muessen die Variablen exportiert sein */
}

const base = (process.env.WP_URL || '').replace(/\/+$/, '');
const user = process.env.WP_USER;
const pass = (process.env.WP_APP_PASSWORD || '').replace(/\s+/g, '');

if (!base) {
  console.error('❌ WP_URL fehlt (z.B. https://ab-solarenergy.de).');
  process.exit(1);
}

const auth = user && pass
  ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
  : null;

async function api(pfad, opts = {}) {
  const res = await fetch(`${base}/wp-json${pfad}`, {
    ...opts,
    headers: {
      'User-Agent': 'youman-wp-verbindung',
      ...(auth ? { Authorization: auth } : {}),
      ...(opts.headers || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* kein JSON - Status reicht */
  }
  return { status: res.status, headers: res.headers, body };
}

console.log(`\nWordPress-Verbindung: ${base}\n${'='.repeat(60)}`);

// 1. Ist die REST-API ueberhaupt offen?
const wurzel = await api('/');
if (wurzel.status !== 200) {
  console.error(`❌ /wp-json antwortet mit ${wurzel.status}. REST-API blockiert (Sicherheits-Plugin? Firewall?).`);
  process.exit(1);
}
const entschluesselt = (t) =>
  String(t ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
console.log(`✅ REST-API offen — Seite: ${entschluesselt(wurzel.body?.name) || 'unbekannt'}`);

const namespaces = wurzel.body?.namespaces ?? [];
const appPasswoerter = wurzel.body?.authentication?.['application-passwords'];
console.log(`   Anwendungspasswoerter: ${appPasswoerter ? 'aktiv' : 'NICHT aktiv (Plugin/Filter blockiert sie)'}`);
if (namespaces.includes('mcp')) {
  console.log(`   MCP-Adapter installiert: ${base}/wp-json/mcp/mcp-adapter-default-server`);
}
for (const [label, ns] of [['Rank Math (SEO)', 'rankmath/v1'], ['WooCommerce', 'wc/v3'], ['Elementor', 'elementor/v1']]) {
  if (namespaces.includes(ns)) console.log(`   ${label}: installiert`);
}

// 2. Ohne Zugangsdaten ist hier Schluss - lesen geht, schreiben nicht.
if (!auth) {
  console.log('\n⚠️  Kein WP_USER / WP_APP_PASSWORD gesetzt — nur Lesezugriff auf oeffentliche Inhalte.');
  console.log('   Anleitung: wordpress/VERBINDUNG.md');
  process.exit(0);
}

// 3. Wer bin ich, und was darf ich?
const ich = await api('/wp/v2/users/me?context=edit');
if (ich.status === 401 || ich.status === 403) {
  console.error(`\n❌ Anmeldung abgelehnt (${ich.status}): ${ich.body?.message ?? ''}`);
  console.error('   Haeufigste Ursachen: Benutzername statt E-Mail verwenden, Anwendungspasswort neu erzeugen,');
  console.error('   oder ein Sicherheits-Plugin (Wordfence/iThemes) blockiert die Basic-Auth-Header.');
  process.exit(1);
}
if (ich.status !== 200) {
  console.error(`\n❌ Unerwartete Antwort ${ich.status} auf /wp/v2/users/me.`);
  process.exit(1);
}

const rollen = ich.body?.roles ?? [];
console.log(`\n✅ Angemeldet als "${ich.body?.name}" (${ich.body?.slug}) — Rolle: ${rollen.join(', ') || 'unbekannt'}`);
if (!rollen.includes('administrator') && !rollen.includes('editor')) {
  console.log('   ⚠️  Rolle reicht nicht zum Bearbeiten von Seiten. Mindestens "Redakteur" noetig.');
}

// 4. Bestandsaufnahme: wie viel liegt da eigentlich?
for (const [label, pfad] of [
  ['Seiten', '/wp/v2/pages?per_page=1&status=any'],
  ['Beitraege', '/wp/v2/posts?per_page=1&status=any'],
  ['Medien', '/wp/v2/media?per_page=1'],
]) {
  const r = await api(pfad + '&context=edit');
  const gesamt = r.headers.get('x-wp-total');
  console.log(`   ${label}: ${gesamt ?? '?'}`);
}

// 5. Schreibrecht wirklich testen - Entwurf anlegen und sofort loeschen.
const probe = await api('/wp/v2/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Verbindungstest (Entwurf)', status: 'draft', content: 'Automatisch erzeugt, wird sofort geloescht.' }),
});
if (probe.status === 201) {
  await api(`/wp/v2/posts/${probe.body.id}?force=true`, { method: 'DELETE' });
  console.log('\n✅ Schreibzugriff bestaetigt (Test-Entwurf angelegt und wieder geloescht).');
  console.log('   Damit koennen Titel, Meta-Beschreibungen, Texte und Seitenstatus gepflegt werden.');
} else {
  console.log(`\n⚠️  Schreibzugriff fehlt (${probe.status}): ${probe.body?.message ?? ''}`);
  console.log('   Lesen und Auditieren geht, Aenderungen musst du selbst im Backend machen.');
}

console.log('');

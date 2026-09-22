#!/usr/bin/env node
/**
 * Kommandozeilen-Zugang zur PlentyONE-REST-API.
 *
 * Wozu das gut ist: Die App spricht mit Plenty (lib/plenty/client.ts), aber nur
 * aus dem laufenden Next.js heraus und nur fuer eingeloggte Nutzer. Fuer
 * einmalige Arbeiten — nachsehen, korrigieren, nachtragen — fehlte bisher ein
 * Weg, der ohne Browser und ohne Deploy auskommt. Genau den gibt dieses Skript:
 * einloggen, ein REST-Aufruf, JSON zurueck.
 *
 * Zugang kommt aus den Umgebungsvariablen (oder aus .env.local, falls
 * vorhanden) — nie aus Argumenten, damit kein Passwort in der Shell-History
 * landet:
 *
 *   PLENTY_BASE_URL   z. B. https://pXXXXX.my.plentysystems.com  (ohne /rest)
 *   PLENTY_USER
 *   PLENTY_PASSWORD
 *
 * Beispiele:
 *
 *   node scripts/plenty.mjs test
 *   node scripts/plenty.mjs get /rest/items 'itemsPerPage=5&with=variations'
 *   node scripts/plenty.mjs get /rest/stockmanagement/warehouses
 *   node scripts/plenty.mjs post /rest/items '{"variations":[]}'
 *   node scripts/plenty.mjs post /rest/items @neuer-artikel.json
 *
 * Schreibende Aufrufe (post/put/delete) fragen vorher nach, weil sie im
 * Live-System landen. Mit --ja laesst sich die Rueckfrage ueberspringen, etwa
 * in einer Schleife.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';

// Nodes eingebautes fetch liest HTTPS_PROXY erst mit dieser Variable — und sie
// wird beim Start ausgewertet, nicht zur Laufzeit. Also einmal neu starten.
// Ohne das laeuft der Aufruf in einer Umgebung mit Proxy in einen Timeout,
// statt eine brauchbare Fehlermeldung zu liefern.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, [import.meta.filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

// ---------------------------------------------------------------------------
// Zugang
// ---------------------------------------------------------------------------

/** Laedt .env.local nach, damit lokal dieselben Werte gelten wie in der App. */
function ladeEnvDatei() {
  for (const name of ['.env.local', '.env']) {
    const pfad = resolve(process.cwd(), name);
    if (!existsSync(pfad)) continue;
    for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
      const treffer = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(zeile);
      if (!treffer) continue;
      const [, schluessel, roh] = treffer;
      if (process.env[schluessel] !== undefined) continue; // echte Umgebung schlaegt Datei
      process.env[schluessel] = roh.trim().replace(/^["']|["']$/g, '');
    }
  }
}

function zugang() {
  ladeEnvDatei();
  // Ein angehaengtes "/rest" abschneiden: Plenty zeigt die REST-URL inklusive
  // an, die Pfade unten bringen es selbst mit.
  const baseUrl = (process.env.PLENTY_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest$/i, '')
    .replace(/\/+$/, '');
  const user = (process.env.PLENTY_USER ?? '').trim();
  const password = process.env.PLENTY_PASSWORD ?? '';
  if (!baseUrl || !user) {
    abbruch(
      'Es fehlen Zugangsdaten. Bitte PLENTY_BASE_URL und PLENTY_USER setzen\n' +
        '(in der Umgebung oder in projektplanung/.env.local).',
    );
  }
  // Ohne Passwort wird der Login trotzdem versucht: Manche Umgebungen speisen
  // es unterwegs in den Anfrageinhalt ein, damit die Session es nie sieht.
  // Klappt das nicht, sagt es die Login-Antwort deutlich genug (HTTP 401).
  return { baseUrl, user, password, eingespeist: !password };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

async function login(cfg) {
  const res = await hole(`${cfg.baseUrl}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    // Ohne eigenes Passwort geht nur der Benutzername raus — den Rest muss
    // dann die Umgebung beisteuern.
    body: JSON.stringify(cfg.eingespeist ? { username: cfg.user } : { username: cfg.user, password: cfg.password }),
  });
  const roh = await res.text();
  if (res.status === 401) {
    abbruch(
      cfg.eingespeist
        ? 'Login abgelehnt (HTTP 401), und PLENTY_PASSWORD war nicht gesetzt.\n' +
            'Die Umgebung hat das Passwort also nicht in die Anfrage eingespeist.\n' +
            'Dann hilft nur, PLENTY_PASSWORD doch als Umgebungsvariable zu setzen.'
        : 'Benutzername oder Passwort stimmen nicht (HTTP 401).',
    );
  }
  if (!res.ok) abbruch(`Login fehlgeschlagen (HTTP ${res.status}): ${roh.slice(0, 300)}`);

  let daten;
  try {
    daten = JSON.parse(roh);
  } catch {
    abbruch(
      `Login: keine JSON-Antwort (HTTP ${res.status}). Zeigt PLENTY_BASE_URL wirklich auf die\n` +
        `REST-Basis, z. B. https://pXXXXX.my.plentysystems.com? Antwort: ${roh.slice(0, 200)}`,
    );
  }
  const token = daten.access_token ?? daten.accessToken;
  if (!token) abbruch(`Login: Antwort ohne access_token. Felder: ${Object.keys(daten).join(', ') || '(leer)'}`);
  return { token, gueltigBis: Number(daten.expires_in ?? 3600), userId: daten.user_id ?? null };
}

// ---------------------------------------------------------------------------
// Aufrufe
// ---------------------------------------------------------------------------

async function ruf(cfg, token, methode, pfad, nutzlast, query) {
  const pfadMitRest = pfad.startsWith('/') ? pfad : `/${pfad}`;
  const url = new URL(cfg.baseUrl + (pfadMitRest.startsWith('/rest') ? pfadMitRest : `/rest${pfadMitRest}`));
  if (query) for (const [k, v] of new URLSearchParams(query)) url.searchParams.append(k, v);

  const res = await hole(url.toString(), {
    method: methode.toUpperCase(),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(nutzlast ? { 'Content-Type': 'application/json' } : {}),
    },
    body: nutzlast ?? undefined,
  });
  const roh = await res.text();
  return { status: res.status, roh };
}

/**
 * fetch mit brauchbarer Meldung.
 *
 * Laeuft der Aufruf ueber einen Proxy, der den Host nicht durchlaesst, meldet
 * undici je nach Lage "fetch failed", "Request was cancelled" oder einen
 * Tunnel-Fehler — keine davon sagt, woran es wirklich liegt. Darum hier der
 * Hinweis auf die Freigabe, sobald ein Proxy im Spiel ist.
 */
async function hole(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (e) {
    const kette = [];
    for (let f = e; f; f = f.cause) kette.push(String(f.message ?? f));
    const grund = kette.join(' <- ');
    if (process.env.HTTPS_PROXY) {
      abbruch(
        `Verbindung zu ${new URL(url).host} kam nicht zustande: ${grund}\n` +
          'Der Aufruf laeuft ueber einen Proxy. Steht der Host nicht auf dessen Freigabeliste,\n' +
          'wird die Verbindung genau so abgewiesen — was der Proxy zuletzt abgelehnt hat, zeigt:\n' +
          '  curl -sS "$HTTPS_PROXY/__agentproxy/status"\n' +
          'In einer Claude-Code-Web-Session laesst sich die Domain unter\n' +
          'Umgebung -> Netzwerkzugang freigeben.',
      );
    }
    abbruch(`Verbindung zu ${new URL(url).host} fehlgeschlagen: ${grund}`);
  }
}

// ---------------------------------------------------------------------------
// Rahmen
// ---------------------------------------------------------------------------

function abbruch(text) {
  console.error(`\n✖ ${text}\n`);
  process.exit(1);
}

function hilfe() {
  console.log(
    [
      'Aufrufe:',
      '  node scripts/plenty.mjs test',
      "  node scripts/plenty.mjs get <pfad> [query]        z. B. get /rest/items 'itemsPerPage=5'",
      '  node scripts/plenty.mjs post|put|delete <pfad> [json|@datei.json] [--ja]',
      '',
      'Zugang aus PLENTY_BASE_URL / PLENTY_USER / PLENTY_PASSWORD (oder .env.local).',
    ].join('\n'),
  );
}

async function frage(text) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const antwort = (await rl.question(`${text} [j/N] `)).trim().toLowerCase();
  rl.close();
  return antwort === 'j' || antwort === 'ja' || antwort === 'y';
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--ja');
  const ohneRueckfrage = process.argv.includes('--ja') || !process.stdin.isTTY;
  const befehl = (argv[0] ?? '').toLowerCase();
  if (!befehl || befehl === 'help' || befehl === '--help') return hilfe();

  const cfg = zugang();
  const { token, gueltigBis, userId } = await login(cfg);

  if (befehl === 'test') {
    console.log(`✔ Login auf ${cfg.baseUrl} als "${cfg.user}" erfolgreich.`);
    console.log(`  Token gueltig fuer ${gueltigBis}s, Benutzer-ID ${userId ?? '(unbekannt)'}.`);
    return;
  }

  if (!['get', 'post', 'put', 'delete', 'patch'].includes(befehl)) {
    hilfe();
    abbruch(`Unbekannter Befehl "${befehl}".`);
  }

  const pfad = argv[1];
  if (!pfad) abbruch('Es fehlt der Pfad, z. B. /rest/items.');

  let nutzlast = null;
  let query = null;
  if (befehl === 'get') {
    query = argv[2] ?? null;
  } else if (argv[2]) {
    nutzlast = argv[2].startsWith('@') ? readFileSync(argv[2].slice(1), 'utf8') : argv[2];
    try {
      JSON.parse(nutzlast);
    } catch {
      abbruch('Die Nutzlast ist kein gueltiges JSON.');
    }
    // Schreibende Aufrufe landen im Live-System — einmal nachfragen.
    if (!ohneRueckfrage && !(await frage(`${befehl.toUpperCase()} ${pfad} im LIVE-System ausfuehren?`))) {
      console.log('Abgebrochen.');
      return;
    }
  }

  const { status, roh } = await ruf(cfg, token, befehl, pfad, nutzlast, query);
  console.error(`HTTP ${status}`);
  try {
    console.log(JSON.stringify(JSON.parse(roh), null, 2));
  } catch {
    console.log(roh);
  }
  if (status >= 400) process.exit(1);
}

main().catch((e) => abbruch(String(e?.stack ?? e)));

#!/usr/bin/env node
/**
 * Inventur: schaut in PlentyONE nach, was der Mandant tatsaechlich hergibt.
 *
 * Wozu das gut ist: PLENTY-LANDKARTE.md sagt, was WIR benutzen — das steht im
 * Code und ist sicher. Was der Mandant darueber hinaus kann, stand dort nur als
 * Vermutung, weil weder Doku noch System erreichbar waren. Dieses Skript klaert
 * das, indem es fragt: ein GET je Bereich, Antwort protokollieren, fertig.
 *
 * NUR LESEND. Es gibt keinen einzigen schreibenden Aufruf hier drin; ein
 * fehlendes Recht oder ein unbekannter Pfad ist ein Ergebnis, kein Fehler.
 *
 *   node scripts/plenty-inventur.mjs                 # Bericht auf die Konsole
 *   node scripts/plenty-inventur.mjs --md > b.md     # als Markdown in eine Datei
 *   node scripts/plenty-inventur.mjs --nur order     # nur passende Bereiche
 *
 * Zugang wie bei scripts/plenty.mjs: PLENTY_BASE_URL / PLENTY_USER /
 * PLENTY_PASSWORD aus der Umgebung oder .env.local.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, [import.meta.filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

// ---------------------------------------------------------------------------
// Was gefragt wird
// ---------------------------------------------------------------------------

/**
 * Die Liste ist bewusst breit: Bereiche, die wir nutzen (zur Bestaetigung),
 * und Bereiche, die wir nur vermuten (zur Klaerung). Ein Pfad, den es nicht
 * gibt, antwortet mit 404 — auch das steht dann im Bericht.
 */
const PROBEN = [
  // --- Was wir laut Code benutzen -----------------------------------------
  ['genutzt', 'Lager', '/rest/stockmanagement/warehouses?itemsPerPage=50'],
  ['genutzt', 'Bestand', '/rest/stockmanagement/stock?itemsPerPage=1'],
  ['genutzt', 'Varianten', '/rest/items/variations?itemsPerPage=1'],
  ['genutzt', 'Artikel', '/rest/items?itemsPerPage=1'],
  ['genutzt', 'Kategorien', '/rest/categories?type=item&itemsPerPage=1'],
  ['genutzt', 'Eigenschaften', '/rest/properties?itemsPerPage=5'],
  ['genutzt', 'Barcodes', '/rest/items/barcodes?itemsPerPage=10'],

  // --- Auftragswesen: der grosse weisse Fleck ------------------------------
  ['auftrag', 'Auftraege', '/rest/orders?itemsPerPage=1'],
  ['auftrag', 'Auftragsstatus', '/rest/orders/status?itemsPerPage=50'],
  ['auftrag', 'Auftragsherkunft', '/rest/orders/referrers'],
  ['auftrag', 'Auftragstypen', '/rest/orders/types'],
  ['auftrag', 'Belege', '/rest/orders/documents?itemsPerPage=1'],
  ['auftrag', 'Zahlungen', '/rest/payments?itemsPerPage=1'],
  ['auftrag', 'Zahlungsarten', '/rest/payments/methods'],
  ['auftrag', 'Versandprofile', '/rest/orders/shipping/presets'],
  ['auftrag', 'Versanddienstleister', '/rest/orders/shipping/serviceProviders'],
  ['auftrag', 'Kontakte', '/rest/accounts/contacts?itemsPerPage=1'],

  // --- Artikelstamm, den wir nicht anfassen --------------------------------
  ['stamm', 'Verkaufspreise', '/rest/items/sales_prices?itemsPerPage=10'],
  ['stamm', 'Hersteller', '/rest/items/manufacturers?itemsPerPage=10'],
  ['stamm', 'Einheiten', '/rest/items/units?itemsPerPage=20'],
  ['stamm', 'Attribute', '/rest/items/attributes?itemsPerPage=10'],
  ['stamm', 'Artikel-Sets (Bundles)', '/rest/items/item_sets?itemsPerPage=5'],
  ['stamm', 'Verfuegbarkeiten', '/rest/availabilities'],
  ['stamm', 'Merkmalsgruppen', '/rest/properties/groups?itemsPerPage=10'],

  // --- Lager jenseits der Lagerorte ---------------------------------------
  ['lager', 'Umlagerungen', '/rest/redistributions?itemsPerPage=1'],
  ['lager', 'Nachbestellungen', '/rest/reorders?itemsPerPage=1'],
  ['lager', 'Bestandspuffer', '/rest/stockmanagement/buffer?itemsPerPage=5'],
  ['lager', 'Warenbewegungen', '/rest/stockmanagement/stock/movements?itemsPerPage=1'],

  // --- Vertriebskanaele ----------------------------------------------------
  ['kanal', 'Mandanten/Webshops', '/rest/webstores'],
  ['kanal', 'Marktplaetze', '/rest/markets/orders/referrers'],
  ['kanal', 'Listings', '/rest/listings?itemsPerPage=1'],

  // --- System --------------------------------------------------------------
  ['system', 'Plugins', '/rest/plugins?itemsPerPage=5'],
  ['system', 'Benutzer', '/rest/users?itemsPerPage=5'],
  ['system', 'Rollen', '/rest/roles?itemsPerPage=5'],
  ['system', 'Umsatzsteuer', '/rest/vat'],
  ['system', 'Logs', '/rest/logs?itemsPerPage=1'],
];

const BEREICHE = {
  genutzt: 'Bestaetigung: das nutzen wir bereits',
  auftrag: 'Auftragswesen (heute ungenutzt)',
  stamm: 'Artikelstamm (heute ungenutzt)',
  lager: 'Lager jenseits der Lagerorte',
  kanal: 'Vertriebskanaele',
  system: 'System und Verwaltung',
};

// ---------------------------------------------------------------------------
// Zugang (wie in scripts/plenty.mjs)
// ---------------------------------------------------------------------------

function ladeEnvDatei() {
  for (const name of ['.env.local', '.env']) {
    const pfad = resolve(process.cwd(), name);
    if (!existsSync(pfad)) continue;
    for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
      const t = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(zeile);
      if (!t || process.env[t[1]] !== undefined) continue;
      process.env[t[1]] = t[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

function zugang() {
  ladeEnvDatei();
  const baseUrl = (process.env.PLENTY_BASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest$/i, '').replace(/\/+$/, '');
  const user = (process.env.PLENTY_USER ?? '').trim();
  const password = process.env.PLENTY_PASSWORD ?? '';
  if (!baseUrl || !user || !password) {
    console.error('\n✖ Es fehlen PLENTY_BASE_URL, PLENTY_USER oder PLENTY_PASSWORD.\n');
    process.exit(1);
  }
  return { baseUrl, user, password };
}

async function login(cfg) {
  let res;
  try {
    res = await fetch(`${cfg.baseUrl}/rest/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: cfg.user, password: cfg.password }),
    });
  } catch (e) {
    const kette = [];
    for (let f = e; f; f = f.cause) kette.push(String(f.message ?? f));
    console.error(
      `\n✖ Verbindung zu ${new URL(cfg.baseUrl).host} kam nicht zustande: ${kette.join(' <- ')}\n` +
        (process.env.HTTPS_PROXY
          ? '  Der Aufruf laeuft ueber einen Proxy. Ist der Host dort nicht freigegeben,\n' +
            '  wird er genau so abgewiesen — siehe curl -sS "$HTTPS_PROXY/__agentproxy/status".\n'
          : ''),
    );
    process.exit(1);
  }
  const roh = await res.text();
  if (!res.ok) {
    console.error(`\n✖ Login fehlgeschlagen (HTTP ${res.status}): ${roh.slice(0, 200)}\n`);
    process.exit(1);
  }
  const daten = JSON.parse(roh);
  return daten.access_token ?? daten.accessToken;
}

// ---------------------------------------------------------------------------
// Eine Probe
// ---------------------------------------------------------------------------

/** Zaehlt, was in der Antwort steckt, ohne Inhalte auszugeben. */
function befund(daten) {
  if (Array.isArray(daten)) return { menge: daten.length, felder: felderVon(daten[0]) };
  if (daten && typeof daten === 'object') {
    if (Array.isArray(daten.entries)) {
      const gesamt = daten.totalsCount ?? daten.totalCount ?? null;
      return {
        menge: gesamt ?? daten.entries.length,
        gesamtBekannt: gesamt !== null,
        felder: felderVon(daten.entries[0]),
      };
    }
    return { menge: null, felder: felderVon(daten) };
  }
  return { menge: null, felder: [] };
}

function felderVon(zeile) {
  return zeile && typeof zeile === 'object' ? Object.keys(zeile).slice(0, 14) : [];
}

async function probiere(cfg, token, pfad) {
  const start = Date.now();
  let res;
  try {
    res = await fetch(cfg.baseUrl + pfad, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (e) {
    return { status: 0, urteil: 'Netzfehler', detail: String(e.message ?? e).slice(0, 80) };
  }
  const roh = await res.text();
  const ms = Date.now() - start;

  if (res.status === 401) return { status: 401, urteil: 'Token abgelehnt', ms };
  if (res.status === 403) return { status: 403, urteil: 'kein Recht', ms, detail: 'Benutzer darf das nicht' };
  if (res.status === 404) return { status: 404, urteil: 'gibt es nicht', ms, detail: 'Pfad unbekannt' };
  if (!res.ok) return { status: res.status, urteil: 'Fehler', ms, detail: roh.slice(0, 120) };

  try {
    const b = befund(JSON.parse(roh));
    return {
      status: 200,
      urteil: 'da',
      ms,
      menge: b.menge,
      gesamtBekannt: b.gesamtBekannt,
      felder: b.felder,
    };
  } catch {
    return { status: 200, urteil: 'da', ms, detail: 'Antwort kein JSON' };
  }
}

// ---------------------------------------------------------------------------
// Bericht
// ---------------------------------------------------------------------------

function zeileText(name, pfad, e) {
  const zeichen = e.status === 200 ? '✔' : e.status === 403 ? '⊘' : e.status === 404 ? '–' : '!';
  const menge =
    e.menge === null || e.menge === undefined
      ? ''
      : ` ${e.gesamtBekannt ? '' : 'mind. '}${e.menge} Eintr.`;
  const zusatz = e.detail ? ` (${e.detail})` : '';
  return `  ${zeichen} ${name.padEnd(24)} ${String(e.status).padStart(3)}${menge}${zusatz}\n      ${pfad}`;
}

async function main() {
  const md = process.argv.includes('--md');
  const nurIdx = process.argv.indexOf('--nur');
  const filter = nurIdx >= 0 ? (process.argv[nurIdx + 1] ?? '').toLowerCase() : null;

  const cfg = zugang();
  const token = await login(cfg);
  const proben = PROBEN.filter(
    ([bereich, name, pfad]) =>
      !filter || bereich.includes(filter) || name.toLowerCase().includes(filter) || pfad.includes(filter),
  );

  if (!md) console.log(`\nInventur auf ${cfg.baseUrl} als "${cfg.user}" — ${proben.length} Proben, nur lesend.\n`);
  else console.log(`# Plenty-Inventur\n\nMandant: \`${cfg.baseUrl}\` · Benutzer: \`${cfg.user}\` · ${new Date().toISOString().slice(0, 10)}\n`);

  const ergebnisse = [];
  for (const bereich of Object.keys(BEREICHE)) {
    const teil = proben.filter((p) => p[0] === bereich);
    if (!teil.length) continue;
    console.log(md ? `\n## ${BEREICHE[bereich]}\n\n| Was | Status | Umfang | Pfad |\n| --- | --- | --- | --- |` : `${BEREICHE[bereich]}`);
    for (const [, name, pfad] of teil) {
      const e = await probiere(cfg, token, pfad);
      ergebnisse.push({ bereich, name, pfad, ...e });
      if (md) {
        const umfang = e.menge === null || e.menge === undefined ? '—' : `${e.gesamtBekannt ? '' : 'mind. '}${e.menge}`;
        console.log(`| ${name} | ${e.status} ${e.urteil} | ${umfang} | \`${pfad}\` |`);
      } else {
        console.log(zeileText(name, pfad, e));
      }
    }
    if (!md) console.log('');
  }

  const da = ergebnisse.filter((e) => e.status === 200);
  const gesperrt = ergebnisse.filter((e) => e.status === 403);
  const fehlt = ergebnisse.filter((e) => e.status === 404);
  const zusammen =
    `${da.length} erreichbar, ${gesperrt.length} ohne Recht, ${fehlt.length} nicht vorhanden ` +
    `(von ${ergebnisse.length}).`;
  console.log(md ? `\n---\n\n${zusammen}\n` : `${zusammen}\n`);

  if (gesperrt.length && !md) {
    console.log('Ohne Recht — der API-Benutzer muesste dafuer freigeschaltet werden:');
    for (const e of gesperrt) console.log(`  ⊘ ${e.name} (${e.pfad})`);
    console.log('');
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e?.stack ?? e}\n`);
  process.exit(1);
});

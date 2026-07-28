#!/usr/bin/env node
/**
 * wp-seo-apply.mjs — SEO-Umsetzung für ab-solarenergy.de via WordPress REST API.
 *
 * Führt die automatisierbaren Maßnahmen aus dem SEO-Audit aus:
 *   1. Verbindung + Auth prüfen (Application Password, Basic Auth)
 *   2. Aktives SEO-Plugin erkennen (Yoast / Rank Math)
 *   3. Seiten/Beiträge listen (mit aktuellen Metas, falls per REST lesbar)
 *   4. Bild-Alt-Texte setzen  (/wp/v2/media  -> alt_text ist REST-schreibbar)
 *   5. SEO-Metas (Title/Description/Focus-KW) setzen
 *      -> funktioniert automatisch, WENN das mu-Plugin die Meta-Keys für REST freischaltet
 *      -> sonst Report "manuell" (Copy-Paste-Liste 02-META-COPY-PASTE.md)
 *
 * Standard = DRY-RUN (nichts wird geschrieben). Erst mit --apply werden Änderungen gesendet.
 *
 * Voraussetzung: Node >= 18 (globales fetch). Keine npm-Abhängigkeiten.
 *
 * Konfiguration über Umgebungsvariablen (siehe .env.example):
 *   WP_BASE_URL=https://ab-solarenergy.de
 *   WP_USER=<wp-benutzername>
 *   WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx   (Leerzeichen erlaubt)
 *
 * Nutzung:
 *   node wp-seo-apply.mjs                      # Audit/Dry-Run (nichts schreiben)
 *   node wp-seo-apply.mjs --apply --meta       # SEO-Metas schreiben (Datei meta-map.json)
 *   node wp-seo-apply.mjs --apply --alt        # Alt-Texte schreiben (Datei alt-texts.json)
 *   node wp-seo-apply.mjs --apply --meta --alt # beides
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- Konfiguration ----------
const BASE = (process.env.WP_BASE_URL || '').replace(/\/+$/, '');
const USER = process.env.WP_USER || '';
const APP_PW = process.env.WP_APP_PASSWORD || '';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DO_META = args.has('--meta');
const DO_ALT = args.has('--alt');

if (!BASE || !USER || !APP_PW) {
  console.error('❌ WP_BASE_URL, WP_USER und WP_APP_PASSWORD müssen gesetzt sein (siehe .env.example).');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${USER}:${APP_PW}`).toString('base64');
const HDR = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' };

function log(...a) { console.log(...a); }
function mask(s) { return s ? s.slice(0, 2) + '***' : '(leer)'; }

async function api(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE}/wp-json${path}`;
  const res = await fetch(url, { ...opts, headers: { ...HDR, ...(opts.headers || {}) } });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} @ ${url}`);
    err.status = res.status; err.body = body;
    throw err;
  }
  return { body, headers: res.headers };
}

async function loadJson(name) {
  try { return JSON.parse(await readFile(join(__dirname, name), 'utf8')); }
  catch { return null; }
}

// ---------- 1. Verbindung + Auth ----------
async function checkConnection() {
  log(`\n🔌 Verbinde mit ${BASE} als "${USER}" (App-PW: ${mask(APP_PW)})`);
  try {
    const me = await api('/wp/v2/users/me?context=edit');
    log(`✅ Auth ok — angemeldet als: ${me.body.name} (id ${me.body.id}, Rollen: ${(me.body.roles||[]).join(', ')})`);
    if (!(me.body.capabilities && (me.body.capabilities.edit_pages || me.body.capabilities.manage_options))) {
      log('⚠️  Nutzer hat evtl. keine Rechte zum Bearbeiten von Seiten — bitte prüfen.');
    }
    return true;
  } catch (e) {
    log(`❌ Verbindung/Auth fehlgeschlagen: ${e.message}`);
    if (e.status === 401) log('   → Application Password oder Benutzername falsch.');
    if (e.status === 403) log('   → Zugriff verweigert (Rechte/Security-Plugin?).');
    if (e.body) log('   Server:', JSON.stringify(e.body).slice(0, 300));
    return false;
  }
}

// ---------- 2. SEO-Plugin erkennen ----------
async function detectSeoPlugin() {
  try {
    const root = await api('/');
    const routes = Object.keys(root.body.routes || {});
    const hasYoast = routes.some(r => r.startsWith('/yoast'));
    const hasRankMath = routes.some(r => r.toLowerCase().includes('rankmath'));
    // Fallback: an einem Beitrag testen, welche Meta-Keys per REST sichtbar sind
    let plugin = hasYoast ? 'Yoast SEO' : hasRankMath ? 'Rank Math' : 'unbekannt';
    log(`\n🔎 SEO-Plugin (heuristisch): ${plugin}  ${hasYoast ? '(Yoast-REST-Routen gefunden)' : ''}`);
    return { hasYoast, hasRankMath, plugin };
  } catch (e) {
    log('⚠️  Konnte /wp-json Root nicht lesen:', e.message);
    return { hasYoast: false, hasRankMath: false, plugin: 'unbekannt' };
  }
}

// ---------- 3. Seiten listen ----------
async function listContent(type = 'pages') {
  const out = [];
  let page = 1;
  while (true) {
    const { body } = await api(`/wp/v2/${type}?per_page=100&page=${page}&context=edit&_fields=id,slug,title,link,meta`);
    out.push(...body);
    if (body.length < 100) break;
    page++;
    if (page > 10) break;
  }
  return out;
}

// ---------- 4. Alt-Texte setzen ----------
async function applyAltTexts() {
  const map = await loadJson('alt-texts.json');
  if (!map) { log('\n🖼️  alt-texts.json nicht gefunden — überspringe Alt-Text-Schritt.'); return; }

  // Medien ohne Alt-Text listen (Report)
  const media = [];
  let page = 1;
  while (true) {
    const { body } = await api(`/wp/v2/media?per_page=100&page=${page}&_fields=id,source_url,alt_text,media_type`);
    media.push(...body);
    if (body.length < 100) break;
    page++; if (page > 20) break;
  }
  const missing = media.filter(m => m.media_type === 'image' && !(m.alt_text || '').trim());
  log(`\n🖼️  Medien gesamt: ${media.length} | Bilder ohne Alt-Text: ${missing.length}`);
  if (missing.length && !map.byId && !map.byFilename) {
    log('   Bilder ohne Alt-Text (ID → URL):');
    missing.slice(0, 50).forEach(m => log(`   - ${m.id}  ${m.source_url}`));
  }

  // Zuordnung: byId { "12": "Alt-Text" } oder byFilename { "hero.jpg": "Alt-Text" }
  const byId = map.byId || {};
  const byFilename = map.byFilename || {};
  const targets = [];
  for (const m of media) {
    if (byId[String(m.id)]) targets.push([m.id, byId[String(m.id)]]);
    else {
      const fn = (m.source_url || '').split('/').pop();
      if (fn && byFilename[fn]) targets.push([m.id, byFilename[fn]]);
    }
  }
  log(`   Zu setzende Alt-Texte laut Mapping: ${targets.length}`);
  for (const [id, alt] of targets) {
    if (!APPLY) { log(`   [DRY] media ${id} -> "${alt}"`); continue; }
    try {
      await api(`/wp/v2/media/${id}`, { method: 'POST', body: JSON.stringify({ alt_text: alt }) });
      log(`   ✅ media ${id} alt gesetzt: "${alt}"`);
    } catch (e) { log(`   ❌ media ${id}: ${e.message}`); }
  }
}

// ---------- 5. SEO-Metas setzen ----------
const YOAST_KEYS = { title: '_yoast_wpseo_title', desc: '_yoast_wpseo_metadesc', focus: '_yoast_wpseo_focuskw' };
const RANK_KEYS = { title: 'rank_math_title', desc: 'rank_math_description', focus: 'rank_math_focus_keyword' };

async function applyMetas(seo) {
  const map = await loadJson('meta-map.json');
  if (!map) { log('\n🏷️  meta-map.json nicht gefunden — überspringe Meta-Schritt (nutze 02-META-COPY-PASTE.md manuell).'); return; }
  const keys = seo.hasRankMath ? RANK_KEYS : YOAST_KEYS;
  log(`\n🏷️  Setze SEO-Metas via Meta-Keys (${seo.hasRankMath ? 'Rank Math' : 'Yoast'})`);

  const pages = await listContent('pages');
  const bySlug = Object.fromEntries(pages.map(p => [p.slug, p]));

  for (const [slug, m] of Object.entries(map)) {
    const p = bySlug[slug];
    if (!p) { log(`   ⚠️  Seite mit slug "${slug}" nicht gefunden — übersprungen.`); continue; }
    const meta = {};
    if (m.title) meta[keys.title] = m.title;
    if (m.description) meta[keys.desc] = m.description;
    if (m.focus) meta[keys.focus] = m.focus;

    if (!APPLY) { log(`   [DRY] page "${slug}" (id ${p.id}) -> ${JSON.stringify(meta)}`); continue; }
    try {
      const res = await api(`/wp/v2/pages/${p.id}`, { method: 'POST', body: JSON.stringify({ meta }) });
      // Prüfen, ob die Meta wirklich zurückkommt (sonst nicht REST-registriert)
      const echoed = res.body.meta || {};
      const ok = m.title ? echoed[keys.title] === m.title : true;
      log(`   ${ok ? '✅' : '⚠️ '} page "${slug}" (id ${p.id})${ok ? ' Metas gesetzt' : ' — Meta-Key nicht REST-registriert → mu-Plugin installieren oder manuell (02-META-…)'}`);
    } catch (e) {
      log(`   ❌ page "${slug}": ${e.message} → wahrscheinlich Meta nicht REST-freigeschaltet (mu-Plugin nötig).`);
    }
  }
}

// ---------- main ----------
(async () => {
  log('=== WP SEO Apply — ab-solarenergy.de ===');
  log(APPLY ? '⚙️  MODUS: APPLY (schreibt Änderungen)' : '👀 MODUS: DRY-RUN (nichts wird geschrieben; --apply zum Schreiben)');

  if (!(await checkConnection())) process.exit(1);
  const seo = await detectSeoPlugin();

  const pages = await listContent('pages');
  log(`\n📄 Seiten gefunden: ${pages.length}`);
  pages.forEach(p => log(`   - ${p.id}  /${p.slug}  "${(p.title?.rendered||'').replace(/<[^>]+>/g,'')}"`));

  if (DO_ALT) await applyAltTexts();
  if (DO_META) await applyMetas(seo);

  if (!DO_ALT && !DO_META) {
    log('\nℹ️  Nur Audit gelaufen. Für Änderungen: --apply zusammen mit --meta und/oder --alt.');
    log('   Vorher meta-map.json / alt-texts.json befüllen (Beispiele liegen bei).');
  }
  log('\n✅ Fertig.');
})().catch(e => { console.error('Unerwarteter Fehler:', e); process.exit(1); });

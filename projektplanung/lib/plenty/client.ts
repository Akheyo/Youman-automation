/**
 * PlentyONE REST-Client für die Projektplanung.
 *
 * Ablauf beim Abschicken eines Projekts:
 *   1. Login (User/Passwort → Bearer-Token, modulweit gecached)
 *   2. Unterkategorie "Firma Ort" unter der Kategorie "Projekte" anlegen
 *      (oder wiederverwenden, falls sie schon existiert)
 *   3. Artikel in dieser Unterkategorie anlegen (Name, Beschreibung, Kategorie)
 *   4. EAN-13 erzeugen und als Barcode an die Hauptvariante hängen
 *
 * Ist Plenty nicht konfiguriert (Env-Variablen fehlen), wird der Sync
 * übersprungen — die App speichert das Projekt trotzdem und erzeugt lokal eine
 * gültige EAN, damit sie ohne Live-System nutz- und testbar bleibt.
 *
 * Konfiguration über Umgebungsvariablen:
 *   PLENTY_BASE_URL              z. B. https://ihr-shop.plentymarkets-cloud01.com
 *   PLENTY_USER / PLENTY_PASSWORD  REST-API-Zugangsdaten
 *   PLENTY_ID                    plentyId (Mandanten-/Shop-ID, Standard 0)
 *   PLENTY_PROJEKTE_CATEGORY_ID  ID der Elternkategorie "Projekte"
 *   PLENTY_EAN_BARCODE_ID        ID der Barcode-Konfiguration (z. B. EAN13_2)
 *   PLENTY_EAN_PREFIX            2-stelliger EAN-Präfix (Standard 20 = intern)
 */

import { generateEan13 } from './ean';
import {
  buildCategoryName,
  buildItemDescription,
  buildItemName,
  slugify,
  type ProjektInput,
} from '@/lib/projekte/logic';

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

export interface PlentyConfig {
  baseUrl: string;
  user: string;
  password: string;
  plentyId: number;
  projekteCategoryId: number | null;
  eanBarcodeId: number | null;
  eanPrefix: string;
  invoicePropertyId: number | null;
  invoicePropertyName: string;
}

export function getPlentyConfig(): PlentyConfig {
  return {
    // Basis-URL robust normalisieren: Leerzeichen/Slashes weg und ein evtl.
    // angehängtes "/rest" entfernen (Plenty zeigt die REST-URL inkl. "/rest/"
    // an – die App hängt "/rest/..." aber selbst an).
    baseUrl: (process.env.PLENTY_BASE_URL ?? '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/rest$/i, '')
      .replace(/\/+$/, ''),
    user: process.env.PLENTY_USER ?? '',
    password: process.env.PLENTY_PASSWORD ?? '',
    plentyId: Number(process.env.PLENTY_ID ?? '0') || 0,
    projekteCategoryId: process.env.PLENTY_PROJEKTE_CATEGORY_ID
      ? Number(process.env.PLENTY_PROJEKTE_CATEGORY_ID)
      : null,
    eanBarcodeId: process.env.PLENTY_EAN_BARCODE_ID ? Number(process.env.PLENTY_EAN_BARCODE_ID) : null,
    eanPrefix: process.env.PLENTY_EAN_PREFIX ?? '20',
    invoicePropertyId: process.env.PLENTY_INVOICE_PROPERTY_ID ? Number(process.env.PLENTY_INVOICE_PROPERTY_ID) : null,
    invoicePropertyName: process.env.PLENTY_INVOICE_PROPERTY_NAME ?? 'Dokument 1',
  };
}

export function plentyConfigured(cfg = getPlentyConfig()): boolean {
  return Boolean(cfg.baseUrl && cfg.user && cfg.password);
}

// ---------------------------------------------------------------------------
// Token-Handling (modulweit gecached)
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let cachedTokenExpiry = 0; // ms Epoch

async function login(cfg: PlentyConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;

  const res = await fetch(`${cfg.baseUrl}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: cfg.user, password: cfg.password }),
  });
  const raw = await res.text();
  const contentType = res.headers.get('content-type') ?? 'unbekannt';
  const redirectInfo = res.redirected ? ` – WEITERGELEITET nach ${res.url} (dadurch geht ein POST verloren!)` : '';

  if (!res.ok) {
    throw new Error(`Plenty-Login fehlgeschlagen (HTTP ${res.status}) bei ${res.url}${redirectInfo}. Antwort: "${raw.slice(0, 200)}"`);
  }

  let data: { access_token?: string; accessToken?: string; expires_in?: number };
  try {
    data = JSON.parse(raw);
  } catch {
    const detail =
      raw.trim() === ''
        ? `leere Antwort (Content-Type: ${contentType})`
        : `Body-Anfang: "${raw.slice(0, 160)}" (Content-Type: ${contentType})`;
    throw new Error(
      `Plenty-Login: keine gültige JSON-Antwort (HTTP ${res.status}). Angefragt: ${cfg.baseUrl}/rest/login → ${res.url}${redirectInfo}. ${detail}. ` +
        `PLENTY_BASE_URL muss die exakte PlentyONE-REST-Basis sein (https, ohne "/rest" am Ende), z. B. https://xxxxx.plentymarkets-cloud01.com`,
    );
  }
  const token = data.access_token ?? data.accessToken;
  if (!token) {
    throw new Error(`Plenty-Login: Antwort enthielt kein access_token. Felder: ${Object.keys(data).join(', ') || '(leer)'}`);
  }
  cachedToken = token;
  cachedTokenExpiry = now + (Number(data.expires_in ?? 3600) - 60) * 1000;
  return token;
}

/** Verwirft den gecachten Token (erzwingt beim nächsten Aufruf einen neuen Login). */
function invalidateToken(): void {
  cachedToken = null;
  cachedTokenExpiry = 0;
}

/** Interner Fetch-Helfer mit Bearer-Token, JSON und Fehlerbehandlung. */
async function api<T>(cfg: PlentyConfig, token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Plenty ${init?.method ?? 'GET'} ${path} → HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
  }
  // 204 / leerer Body robust behandeln.
  if (!text) return null as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Plenty ${init?.method ?? 'GET'} ${path}: Antwort kein gültiges JSON (HTTP ${res.status}). Body-Anfang: "${text.slice(0, 160)}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

interface PlentyCategory {
  id: number;
  parentCategoryId?: number | null;
  level?: number;
  details?: Array<{ lang: string; name: string; nameUrl?: string }>;
}

/** Sucht eine direkte Unterkategorie eines Elternknotens anhand des Namens. */
async function findChildCategory(
  cfg: PlentyConfig,
  token: string,
  parentId: number,
  name: string,
): Promise<number | null> {
  const wanted = name.trim().toLowerCase();
  // Plenty liefert Kategorien seitenweise; wir gehen sie durch und matchen NUR
  // direkte Kinder des Elternknotens (parentCategoryId), damit garantiert keine
  // zweite Unterkategorie gleichen Namens angelegt wird. Der parentCategoryId-
  // Guard greift auch, falls der Query-Filter serverseitig ignoriert würde.
  let page = 1;
  const perPage = 50;
  for (;;) {
    const res = await api<{ entries?: PlentyCategory[]; isLastPage?: boolean }>(
      cfg,
      token,
      `/rest/categories?type=item&parentCategoryId=${parentId}&itemsPerPage=${perPage}&page=${page}`,
    );
    const entries = res?.entries ?? [];
    for (const cat of entries) {
      if (Number(cat.parentCategoryId) !== Number(parentId)) continue;
      const match = (cat.details ?? []).some((d) => (d.name ?? '').trim().toLowerCase() === wanted);
      if (match) return cat.id;
    }
    if (!entries.length || res?.isLastPage || page > 40) break;
    page += 1;
  }
  return null;
}

/** Legt eine Unterkategorie an oder gibt die vorhandene zurück. */
async function ensureSubcategory(
  cfg: PlentyConfig,
  token: string,
  parentId: number,
  name: string,
): Promise<{ id: number; created: boolean }> {
  const existing = await findChildCategory(cfg, token, parentId, name);
  if (existing) return { id: existing, created: false };

  // PlentyONE erwartet ein ARRAY von Kategorie-Objekten (jeweils mit details
  // und clients). Ein einzelnes Objekt führt zu HTTP 500 ("$data must be array").
  const payload = [
    {
      parentCategoryId: parentId,
      type: 'item',
      right: 'all',
      details: [
        {
          plentyId: cfg.plentyId,
          lang: 'de',
          name,
          nameUrl: slugify(name),
        },
      ],
      clients: [{ plentyId: cfg.plentyId }],
    },
  ];
  const created = await api<PlentyCategory | PlentyCategory[]>(cfg, token, '/rest/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const cat = Array.isArray(created) ? created[0] : created;
  if (!cat?.id) throw new Error('Kategorie-Anlage lieferte keine ID (Antwort unerwartet).');
  return { id: cat.id, created: true };
}

// ---------------------------------------------------------------------------
// Artikel (Item + Hauptvariante)
// ---------------------------------------------------------------------------

interface PlentyVariation {
  id: number;
  itemId?: number;
  isMain?: boolean;
}
interface PlentyItem {
  id: number;
  variations?: PlentyVariation[];
}

/**
 * Legt einen Artikel mit Hauptvariante an. Minimal-Payload laut PlentyONE-Doku:
 * Variante braucht eine Kategoriezuordnung UND eine Einheit (unit).
 */
async function createItem(
  cfg: PlentyConfig,
  token: string,
  categoryId: number,
  barcode: { barcodeId: number; code: string } | null,
): Promise<{ itemId: number; variationId: number; eanAttached: boolean }> {
  const buildBody = (withBarcode: boolean) =>
    JSON.stringify({
      variations: [
        {
          variationCategories: [{ categoryId }],
          unit: { unitId: 1, content: 1 },
          ...(withBarcode && barcode
            ? { variationBarcodes: [{ barcodeId: barcode.barcodeId, code: barcode.code }] }
            : {}),
        },
      ],
    });

  let item: PlentyItem | null = null;
  let eanAttached = false;

  // 1) Versuch: Artikel MIT eingebettetem Barcode (läuft über das Artikel-Recht).
  if (barcode) {
    try {
      item = await api<PlentyItem>(cfg, token, '/rest/items', { method: 'POST', body: buildBody(true) });
      eanAttached = true;
    } catch (err) {
      if (!String((err as Error).message).includes('HTTP 403')) throw err;
      item = null; // Barcode inline nicht erlaubt → ohne Barcode neu anlegen
    }
  }
  // 2) Ohne Barcode (Erstanlage oder Fallback nach 403).
  if (!item) {
    item = await api<PlentyItem>(cfg, token, '/rest/items', { method: 'POST', body: buildBody(false) });
    eanAttached = false;
  }

  if (!item?.id) throw new Error('Artikel-Anlage lieferte keine ID.');
  const mainVar = (item.variations ?? []).find((v) => v.isMain) ?? item.variations?.[0];
  if (!mainVar?.id) throw new Error('Artikel angelegt, aber keine Varianten-ID erhalten.');
  return { itemId: item.id, variationId: mainVar.id, eanAttached };
}

/** Setzt Name + Beschreibung der Variante (eigener Endpunkt laut Doku). */
async function setVariationDescription(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
  opts: { name: string; description: string },
): Promise<void> {
  await api(cfg, token, `/rest/items/${itemId}/variations/${variationId}/descriptions`, {
    method: 'POST',
    body: JSON.stringify({ lang: 'de', name: opts.name, description: opts.description }),
  });
}

/** Eine hochzuladende Rechnung (Datei). */
export interface InvoiceFile {
  bytes: Buffer;
  filename: string;
  contentType: string;
}

/** Liest die Varianteneigenschaften (Verknüpfungs-Zeilen) einer Variante. */
async function getVariationProperties(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
): Promise<any[]> {
  const res = await api<any>(cfg, token, `/rest/items/${itemId}/variations/${variationId}/variation_properties`);
  if (Array.isArray(res)) return res;
  return res?.entries ?? [];
}

/** Sucht die ID der Verknüpfungs-Zeile für ein bestimmtes Merkmal. */
function findRelationId(rows: any[], propertyId: number): number | null {
  const row = rows.find((r) => Number(r?.propertyId ?? r?.property?.id) === Number(propertyId));
  const id = Number(row?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Verknüpft das Merkmal mit der Variante und liefert die ID der erzeugten
 * Verknüpfungs-Zeile zurück. Genau diese ID (nicht die Merkmals-ID!) braucht der
 * Upload-Endpunkt – der abgelegte Wert lautet später "<relationId>/<datei>".
 * Existiert die Verknüpfung schon, wird ihre vorhandene ID ermittelt.
 */
async function linkVariationProperty(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
  propertyId: number,
): Promise<{ relationId: number; note: string }> {
  const path = `/rest/items/${itemId}/variations/${variationId}/variation_properties`;
  const candidates: Array<{ label: string; body: string }> = [
    { label: 'obj', body: JSON.stringify({ propertyId, variationId }) },
    { label: 'arr', body: JSON.stringify([{ propertyId, variationId }]) },
  ];
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const created = await api<any>(cfg, token, path, { method: 'POST', body: c.body });
      const row = Array.isArray(created) ? created[0] : created;
      const id = Number(row?.id);
      if (Number.isFinite(id) && id > 0) return { relationId: id, note: `neu verknüpft (${c.label}, Zeile ${id})` };
      // Angelegt, aber ohne ID in der Antwort → über die Liste nachschlagen.
      const existing = findRelationId(await getVariationProperties(cfg, token, itemId, variationId), propertyId);
      if (existing) return { relationId: existing, note: `verknüpft (${c.label}, Zeile ${existing})` };
      errors.push(`${c.label}: Antwort ohne Zeilen-ID`);
    } catch (e) {
      const msg = (e as Error).message;
      if (/exist|dupli|already|bereits|verknüpft/i.test(msg)) {
        const existing = findRelationId(await getVariationProperties(cfg, token, itemId, variationId), propertyId);
        if (existing) return { relationId: existing, note: `bereits verknüpft (Zeile ${existing})` };
      }
      errors.push(`${c.label}: ${msg.replace(/\s+/g, ' ').replace(/^.*?(HTTP \d+)/, '$1').slice(0, 200)}`);
    }
  }
  // Letzter Versuch: vielleicht existiert die Zeile trotz Fehlern bereits.
  const fallback = findRelationId(await getVariationProperties(cfg, token, itemId, variationId), propertyId);
  if (fallback) return { relationId: fallback, note: `vorhanden (Zeile ${fallback})` };
  throw new Error(`keine Verknüpfungs-Zeile – ${errors.join(' || ')}`);
}

/**
 * Lädt die Datei in die Verknüpfungs-Zeile hoch. Adressiert wird die Zeilen-ID,
 * NICHT die Merkmals-ID – mit der Merkmals-ID nimmt Plenty die Datei zwar mit
 * HTTP 200 an, legt aber nur den Dateinamen ab (Datei geht verloren).
 */
async function uploadVariationPropertyFile(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
  ids: { relationId: number; propertyId: number },
  file: InvoiceFile,
): Promise<string> {
  // Ein echt gespeicherter Wert hat die Form "<id>/<datei>" – ein blanker
  // Dateiname bedeutet, dass Plenty die Binärdatei NICHT abgelegt hat.
  const storedOk = (v: unknown) => typeof v === 'string' && v.includes('/');
  const base = `/rest/items/${itemId}/variations/${variationId}/variation_properties`;
  // Beide Adressierungen probieren: Merkmals-ID (liefert HTTP 200) und
  // Verknüpfungs-Zeilen-ID – welche Plenty akzeptiert, zeigt die Antwort.
  const targets = [
    { label: `property=${ids.propertyId}`, path: `${base}/${ids.propertyId}/upload` },
    { label: `relation=${ids.relationId}`, path: `${base}/${ids.relationId}/upload` },
  ];
  const notes: string[] = [];
  for (const t of targets) {
    for (const field of ['file', 'files']) {
      const form = new FormData();
      form.append(field, new Blob([new Uint8Array(file.bytes)], { type: file.contentType }), file.filename);
      const res = await fetch(`${cfg.baseUrl}${t.path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: form,
      });
      const body = await res.text().catch(() => '');
      let valueFile: unknown;
      try {
        valueFile = JSON.parse(body)?.valueFile;
      } catch {
        /* kein JSON */
      }
      if (res.ok && storedOk(valueFile)) return `gespeichert als "${valueFile}" (${t.label}, feld="${field}")`;
      notes.push(`${t.label} feld="${field}" HTTP ${res.status}${valueFile ? ` valueFile="${valueFile}"` : ''}`);
    }
  }
  throw new Error(`Upload ohne Pfad – ${notes.join(' | ')}`);
}


/** Hängt einen Barcode (z. B. EAN13) an die Variante. */
async function addVariationBarcode(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
  barcodeId: number,
  code: string,
): Promise<void> {
  await api(cfg, token, `/rest/items/${itemId}/variations/${variationId}/variation_barcodes`, {
    method: 'POST',
    body: JSON.stringify({ barcodeId, code }),
  });
}

// ---------------------------------------------------------------------------
// Öffentliche Orchestrierung
// ---------------------------------------------------------------------------

export interface PlentySyncResult {
  ok: boolean;
  skipped: boolean; // true, wenn Plenty nicht konfiguriert war
  ean: string;
  categoryName: string;
  categoryId: number | null;
  categoryCreated: boolean;
  itemId: number | null;
  variationId: number | null;
  eanAttached: boolean;
  invoiceAttached: boolean;
  warnings: string[];
  error: string | null;
}

/**
 * Führt den kompletten Plenty-Ablauf für ein Projekt aus.
 * Wirft nie — Fehler landen im Ergebnis (`ok:false`, `error`), damit der
 * Aufrufer das Projekt trotzdem in der Historie speichern kann.
 */
export async function syncProjektToPlenty(
  input: ProjektInput,
  date: Date,
  eanSeed: number,
  existingEan?: string | null,
  invoice?: InvoiceFile | null,
): Promise<PlentySyncResult> {
  const cfg = getPlentyConfig();
  const categoryName = buildCategoryName(input.company, input.location);
  // Beim Wiederholen die bereits vergebene EAN behalten, sonst neu erzeugen.
  const ean = existingEan && /^\d{13}$/.test(existingEan) ? existingEan : generateEan13(eanSeed, cfg.eanPrefix);
  const warnings: string[] = [];

  const base: PlentySyncResult = {
    ok: false,
    skipped: false,
    ean,
    categoryName,
    categoryId: null,
    categoryCreated: false,
    itemId: null,
    variationId: null,
    eanAttached: false,
    invoiceAttached: false,
    warnings,
    error: null,
  };

  if (!plentyConfigured(cfg)) {
    return { ...base, ok: true, skipped: true, warnings: ['Plenty nicht konfiguriert – nur EAN erzeugt, kein Sync.'] };
  }
  if (!cfg.projekteCategoryId) {
    return { ...base, error: 'PLENTY_PROJEKTE_CATEGORY_ID ist nicht gesetzt.' };
  }

  try {
    const token = await login(cfg);

    const { id: categoryId, created } = await ensureSubcategory(
      cfg,
      token,
      cfg.projekteCategoryId,
      categoryName,
    );

    const itemName = buildItemName(input, date);
    // Artikel anlegen – Barcode wird nach Möglichkeit direkt eingebettet
    // (läuft über das Artikel-Anlegen-Recht statt des separaten Barcode-Rechts).
    const { itemId, variationId, eanAttached: inlineAttached } = await createItem(
      cfg,
      token,
      categoryId,
      cfg.eanBarcodeId ? { barcodeId: cfg.eanBarcodeId, code: ean } : null,
    );

    // Name + Beschreibung der Variante setzen (nicht blockierend).
    try {
      await setVariationDescription(cfg, token, itemId, variationId, {
        name: itemName,
        description: buildItemDescription(input, date),
      });
    } catch (err) {
      warnings.push(`Artikeltext konnte nicht gesetzt werden: ${(err as Error).message}`);
    }

    // Falls der Barcode nicht schon eingebettet gesetzt wurde: separater Endpunkt.
    let eanAttached = inlineAttached;
    if (!eanAttached && cfg.eanBarcodeId) {
      try {
        await addVariationBarcode(cfg, token, itemId, variationId, cfg.eanBarcodeId, ean);
        eanAttached = true;
      } catch (err) {
        if (String((err as Error).message).includes('HTTP 403')) {
          // Frischer Login (falls Rechte gerade erst gesetzt wurden), einmal wiederholen.
          try {
            invalidateToken();
            const freshToken = await login(cfg);
            await addVariationBarcode(cfg, freshToken, itemId, variationId, cfg.eanBarcodeId, ean);
            eanAttached = true;
          } catch (err2) {
            warnings.push(
              `EAN-Barcode konnte nicht gesetzt werden – dem Plenty-Benutzer fehlt das Recht „item.item.variation.barcode.create". (${(err2 as Error).message})`,
            );
          }
        } else {
          warnings.push(`EAN-Barcode konnte nicht gesetzt werden: ${(err as Error).message}`);
        }
      }
    } else if (!cfg.eanBarcodeId) {
      warnings.push('PLENTY_EAN_BARCODE_ID nicht gesetzt – EAN erzeugt, aber kein Barcode am Artikel hinterlegt.');
    }

    // Rechnung als echte Datei in das Merkmal „Dokument 1" der Variante legen.
    // Entscheidend: Der Upload adressiert die VERKNÜPFUNGS-ZEILE (deren ID), nicht
    // die Merkmals-ID – der gespeicherte Wert lautet danach "<zeilenId>/<datei>".
    let invoiceAttached = false;
    if (invoice) {
      const propertyId = cfg.invoicePropertyId;
      if (!propertyId) {
        warnings.push(
          `Rechnung nicht angehängt – PLENTY_INVOICE_PROPERTY_ID ist nicht gesetzt (ID von „${cfg.invoicePropertyName}").`,
        );
      } else {
        try {
          const { relationId, note } = await linkVariationProperty(cfg, token, itemId, variationId, propertyId);
          const uploadNote = await uploadVariationPropertyFile(
            cfg,
            token,
            itemId,
            variationId,
            { relationId, propertyId },
            invoice,
          );
          // Gegenprüfen, dass die Datei wirklich an der Variante hängt.
          const rows = await getVariationProperties(cfg, token, itemId, variationId);
          const row = rows.find((r) => Number(r?.id) === relationId);
          invoiceAttached = typeof row?.valueFile === 'string' && row.valueFile.includes('/');
          if (!invoiceAttached) {
            warnings.push(`Rechnung nicht abgelegt – ${note} | ${uploadNote} | valueFile="${row?.valueFile ?? ''}"`);
          }
        } catch (e) {
          warnings.push(`Rechnung nicht angehängt: ${(e as Error).message.replace(/\s+/g, ' ').slice(0, 250)}`);
        }
      }
    }

    return {
      ...base,
      ok: true,
      categoryId,
      categoryCreated: created,
      itemId,
      variationId,
      eanAttached,
      invoiceAttached,
    };
  } catch (err) {
    return { ...base, error: (err as Error).message };
  }
}

/** Leichter Verbindungstest für die Einstellungsseite / Health-Check. */
export async function testPlentyConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = getPlentyConfig();
  if (!plentyConfigured(cfg)) return { ok: false, message: 'Plenty nicht konfiguriert (Env-Variablen fehlen).' };
  try {
    await login(cfg);
    return { ok: true, message: 'Login erfolgreich.' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/**
 * Diagnose: klopft alle in Frage kommenden Plenty-Endpunkte ab und zeigt, wo die
 * Eigenschaften/Dokumente eines Artikels wirklich liegen. Reines Werkzeug, um
 * einen MANUELL hochgeladenen Beleg zu finden und exakt nachzubauen.
 */
export async function inspectItemProperties(itemId: number): Promise<any> {
  const cfg = getPlentyConfig();
  if (!plentyConfigured(cfg)) return { error: 'Plenty nicht konfiguriert.' };
  const token = await login(cfg);

  const probe = async (path: string) => {
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const text = await res.text();
      return { path, status: res.status, body: text.slice(0, 1200) };
    } catch (e) {
      return { path, status: 0, body: `Fehler: ${(e as Error).message.slice(0, 200)}` };
    }
  };

  // Hauptvariante ermitteln.
  const varRes = await api<any>(cfg, token, `/rest/items/${itemId}/variations`);
  const variations: any[] = Array.isArray(varRes) ? varRes : (varRes?.entries ?? []);
  const main = variations.find((v) => v.isMain) ?? variations[0];
  const vid = main?.id;

  const paths = [
    `/rest/items/${itemId}/variations/${vid}/variation_properties`,
    `/rest/items/${itemId}/variations/${vid}/properties`,
    `/rest/items/${itemId}/variations/${vid}?with=properties,variationProperties`,
    `/rest/items/${itemId}/properties`,
    `/rest/items/${itemId}?with=itemProperties,properties`,
    `/rest/items/${itemId}/documents`,
    `/rest/properties?itemsPerPage=100`,
    `/rest/properties/groups?itemsPerPage=50`,
  ];
  const results = [];
  for (const p of paths) results.push(await probe(p));
  return { itemId, variationId: vid, variationCount: variations.length, results };
}

/**
 * Diagnose: listet ALLE Merkmale (Properties) kompakt auf – ID, Typ (cast) und
 * deutscher Name. Damit lässt sich die echte ID von „Dokument 1" ablesen; die
 * IDs aus der Plenty-Oberfläche stimmen nicht zwangsläufig mit der API überein.
 */
export async function listPlentyProperties(): Promise<any> {
  const cfg = getPlentyConfig();
  if (!plentyConfigured(cfg)) return { error: 'Plenty nicht konfiguriert.' };
  const token = await login(cfg);

  const all: any[] = [];
  let page = 1;
  for (;;) {
    const res = await api<any>(cfg, token, `/rest/properties?itemsPerPage=100&page=${page}`);
    const entries: any[] = res?.entries ?? [];
    all.push(...entries);
    if (!entries.length || res?.isLastPage || page > 10) break;
    page += 1;
  }

  const properties = all.map((p) => ({
    id: p.id,
    propertyId: p.propertyId,
    cast: p.cast, // "file" = Datei-Merkmal
    typeIdentifier: p.typeIdentifier, // "item" | "variation" | …
    groupId: p.propertyGroupId,
    name: (p.names ?? []).find((n: any) => n.lang === 'de')?.name ?? (p.names ?? [])[0]?.name ?? '',
  }));

  return {
    total: properties.length,
    dateiMerkmale: properties.filter((p) => String(p.cast).toLowerCase().includes('file')),
    properties,
  };
}

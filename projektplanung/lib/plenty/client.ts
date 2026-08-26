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
): Promise<{ itemId: number; variationId: number }> {
  const item = await api<PlentyItem>(cfg, token, '/rest/items', {
    method: 'POST',
    body: JSON.stringify({
      variations: [
        {
          variationCategories: [{ categoryId }],
          unit: { unitId: 1, content: 1 },
        },
      ],
    }),
  });
  if (!item?.id) throw new Error('Artikel-Anlage lieferte keine ID.');
  const mainVar = (item.variations ?? []).find((v) => v.isMain) ?? item.variations?.[0];
  if (!mainVar?.id) throw new Error('Artikel angelegt, aber keine Varianten-ID erhalten.');
  return { itemId: item.id, variationId: mainVar.id };
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
    const { itemId, variationId } = await createItem(cfg, token, categoryId);

    // Name + Beschreibung der Variante setzen (nicht blockierend).
    try {
      await setVariationDescription(cfg, token, itemId, variationId, {
        name: itemName,
        description: buildItemDescription(input, date),
      });
    } catch (err) {
      warnings.push(`Artikeltext konnte nicht gesetzt werden: ${(err as Error).message}`);
    }

    // EAN als Barcode an die Variante hängen (nicht blockierend – Artikel steht).
    let eanAttached = false;
    if (cfg.eanBarcodeId) {
      try {
        await addVariationBarcode(cfg, token, itemId, variationId, cfg.eanBarcodeId, ean);
        eanAttached = true;
      } catch (err) {
        // 403 direkt nach dem Freischalten von Rechten liegt oft an einem noch
        // gecachten Token mit alten Scopes → neu einloggen und einmal wiederholen.
        if (String((err as Error).message).includes('HTTP 403')) {
          try {
            invalidateToken();
            const freshToken = await login(cfg);
            await addVariationBarcode(cfg, freshToken, itemId, variationId, cfg.eanBarcodeId, ean);
            eanAttached = true;
          } catch (err2) {
            warnings.push(`EAN-Barcode konnte nicht gesetzt werden: ${(err2 as Error).message}`);
          }
        } else {
          warnings.push(`EAN-Barcode konnte nicht gesetzt werden: ${(err as Error).message}`);
        }
      }
    } else {
      warnings.push('PLENTY_EAN_BARCODE_ID nicht gesetzt – EAN erzeugt, aber kein Barcode am Artikel hinterlegt.');
    }

    return {
      ...base,
      ok: true,
      categoryId,
      categoryCreated: created,
      itemId,
      variationId,
      eanAttached,
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

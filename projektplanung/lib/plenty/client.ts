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
  /** Versuch, die Datei über Plentys interne ui.php hochzuladen (abschaltbar). */
  uiUpload: boolean;
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
    // Standard: an. Zum Abschalten in Vercel PLENTY_UI_UPLOAD=0 setzen –
    // wirkt sofort, ohne neuen Build.
    uiUpload: (process.env.PLENTY_UI_UPLOAD ?? '1') !== '0',
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
// --- Datei-Eigenschaft („Dokument 1") über Property-Relations -----------------
// Plenty speichert Datei-Eigenschaften NICHT unter variation_properties (das ist
// das alte Merkmal-System), sondern als Property-Relation an der Variante:
//   { propertyId: 9, relationTypeIdentifier: "item", relationTargetId: <variationId>,
//     id: <relationId>, relationValues: [{ lang: "de", value: "<relationId>/<datei>" }] }
// Der Dateiwert entsteht beim Upload und lautet "<relationId>/<dateiname>".

/** Liest die Property-Relations einer Variante (über die properties-Beziehung). */
async function getVariationPropertyRelations(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
): Promise<any[]> {
  const res = await api<any>(cfg, token, `/rest/items/${itemId}/variations/${variationId}?with=properties`);
  const props = res?.properties;
  return Array.isArray(props) ? props : [];
}

/** Liefert den abgelegten Dateiwert einer Eigenschaft, sofern vorhanden. */
function relationFileValue(rows: any[], propertyId: number): string | null {
  const row = rows.find((r) => Number(r?.propertyId) === Number(propertyId));
  const value = (row?.relationValues ?? [])
    .map((v: any) => v?.value)
    .find((v: any) => typeof v === 'string' && v.includes('/'));
  return value ?? null;
}

/**
 * Stellt sicher, dass die Eigenschaft mit der Variante verknüpft ist, und gibt
 * die Relation-ID zurück. Genau diese ID trägt später den Dateipfad.
 */
async function ensurePropertyRelation(
  cfg: PlentyConfig,
  token: string,
  itemId: number,
  variationId: number,
  propertyId: number,
): Promise<{ relationId: number; note: string }> {
  const existing = await getVariationPropertyRelations(cfg, token, itemId, variationId);
  const hit = existing.find((r) => Number(r?.propertyId) === Number(propertyId));
  if (hit?.id) return { relationId: Number(hit.id), note: `vorhanden (Relation ${hit.id})` };

  const body = JSON.stringify({
    propertyId,
    relationTypeIdentifier: 'item',
    relationTargetId: variationId,
  });
  const created = await api<any>(cfg, token, '/rest/properties/relations', { method: 'POST', body });
  const row = Array.isArray(created) ? created[0] : created;
  const id = Number(row?.id);
  if (Number.isFinite(id) && id > 0) return { relationId: id, note: `neu angelegt (Relation ${id})` };

  // Angelegt, aber ohne ID in der Antwort → erneut auslesen.
  const again = await getVariationPropertyRelations(cfg, token, itemId, variationId);
  const found = again.find((r) => Number(r?.propertyId) === Number(propertyId));
  if (found?.id) return { relationId: Number(found.id), note: `gefunden (Relation ${found.id})` };
  throw new Error('Property-Relation konnte nicht angelegt werden.');
}

/**
 * Legt die Datei an einer Property-Relation ab – exakt in der Reihenfolge und
 * mit den Nutzdaten, die auch die Plenty-Oberfläche verwendet (per
 * Netzwerk-Mitschnitt verifiziert):
 *
 *   1. Datei hochladen  → sie landet unter propertyItems/<relationId>/<datei>
 *   2. POST /rest/properties/relations/values mit einem ARRAY:
 *      [{ id: null, propertyRelationId, lang: "0", value: "<relationId>/<datei>",
 *         description: null }]
 *
 * Wichtig: `lang` ist "0" (nicht "de"), und `id` sowie `description` müssen als
 * null mitgeschickt werden – fehlen sie, legt Plenty den Datensatz mit leerem
 * `value` an und meldet trotzdem HTTP 200.
 */
async function uploadPropertyRelationFile(
  cfg: PlentyConfig,
  token: string,
  relationId: number,
  file: InvoiceFile,
  verify: () => Promise<boolean>,
): Promise<{ ok: boolean; log: string }> {
  const name = file.filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'rechnung.pdf';
  const mimeType = /^[\x20-\x7E]+$/.test(file.contentType) ? file.contentType : 'application/pdf';
  const notes: string[] = [];

  // --- 1) Datei hochladen ---------------------------------------------------
  for (const field of ['file', 'files', 'files[]']) {
    const form = new FormData();
    form.append(field, new Blob([new Uint8Array(file.bytes)], { type: mimeType }), name);
    try {
      const res = await fetch(`${cfg.baseUrl}/rest/properties/relations/${relationId}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: form,
      });
      notes.push(`upload(${field}) ${res.status}`);
      if (res.ok) break;
    } catch {
      notes.push(`upload(${field}) Netzfehler`);
    }
  }

  // --- 2) Wert schreiben – Nutzdaten exakt wie die Oberfläche ---------------
  const payload = [
    {
      id: null,
      propertyRelationId: relationId,
      lang: '0',
      value: `${relationId}/${name}`,
      description: null,
    },
  ];
  try {
    const res = await fetch(`${cfg.baseUrl}/rest/properties/relations/values`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    notes.push(`wert ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`);
  } catch {
    notes.push('wert: Netzfehler');
  }

  return { ok: await verify(), log: notes.join(' | ') };
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
          // Prüft am Artikel, ob der Dateiwert tatsächlich gespeichert ist.
          const verify = async (tok: string) => {
            try {
              const rows = await getVariationPropertyRelations(cfg, tok, itemId, variationId);
              return Boolean(relationFileValue(rows, propertyId));
            } catch {
              return false;
            }
          };

          const attach = async (tok: string) => {
            const { relationId, note } = await ensurePropertyRelation(
              cfg,
              tok,
              itemId,
              variationId,
              propertyId,
            );
            const res = await uploadPropertyRelationFile(cfg, tok, relationId, invoice, () =>
              verify(tok),
            );
            return { ...res, note };
          };

          let outcome = await attach(token);

          // Fehlende Rechte? Der Token ist bis zu einer Stunde gecached und
          // trägt dann noch die alten Rechte – einmal frisch anmelden und
          // wiederholen, damit frisch vergebene Rechte sofort greifen.
          if (!outcome.ok && /missing_permissions|unauthorized|HTTP 403/i.test(outcome.log)) {
            invalidateToken();
            const freshToken = await login(cfg);
            const retry = await attach(freshToken);
            outcome = retry.ok
              ? retry
              : { ...retry, log: `${retry.log} (auch nach frischer Anmeldung)` };
          }

          invoiceAttached = outcome.ok;
          if (!outcome.ok) {
            warnings.push(`Rechnung nicht abgelegt – ${outcome.note} | ${outcome.log.slice(0, 600)}`);
          }
        } catch (e) {
          warnings.push(`Rechnung nicht angehängt: ${(e as Error).message.replace(/\s+/g, ' ').slice(0, 300)}`);
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
 * Diagnose: zeigt die Eigenschaften einer Variante VOLLSTÄNDIG (über die
 * ?with=properties-Beziehung) und probiert weitere Schreib-Endpunkte durch.
 * Damit lässt sich ein manuell hinterlegtes Dokument exakt nachbauen.
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
      return { path, status: res.status, body: text.slice(0, 600) };
    } catch (e) {
      return { path, status: 0, body: `Fehler: ${(e as Error).message.slice(0, 150)}` };
    }
  };

  const varRes = await api<any>(cfg, token, `/rest/items/${itemId}/variations`);
  const variations: any[] = Array.isArray(varRes) ? varRes : (varRes?.entries ?? []);
  const main = variations.find((v) => v.isMain) ?? variations[0];
  const vid = main?.id;

  // Die properties-Beziehung der Variante KOMPLETT auslesen (nicht abschneiden).
  let properties: any = null;
  let propertiesError: string | null = null;
  try {
    const full = await api<any>(cfg, token, `/rest/items/${itemId}/variations/${vid}?with=properties`);
    properties = full?.properties ?? null;
  } catch (e) {
    propertiesError = (e as Error).message.slice(0, 250);
  }

  const paths = [
    `/rest/items/${itemId}/variations/${vid}/variation_properties`,
    `/rest/items/${itemId}/variations/${vid}/property_values`,
    `/rest/items/${itemId}/variations/${vid}/properties/9`,
    `/rest/variation_properties?variationId=${vid}`,
    `/rest/properties/9/values`,
    `/rest/items/${itemId}/images`,
  ];
  const endpoints = [];
  for (const p of paths) endpoints.push(await probe(p));

  return { itemId, variationId: vid, properties, propertiesError, endpoints };
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

/**
 * Diagnose: sucht Artikel, an denen wirklich ein Datei-Merkmal hängt, und zeigt
 * die Roh-Datensätze. So lässt sich ein MANUELL hochgeladener Beleg finden und
 * exakt nachbauen, ohne die Artikel-ID zu kennen.
 */
export async function findItemsWithDocuments(): Promise<any> {
  const cfg = getPlentyConfig();
  if (!plentyConfigured(cfg)) return { error: 'Plenty nicht konfiguriert.' };
  const token = await login(cfg);

  const probe = async (path: string) => {
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const text = await res.text();
      return { path, status: res.status, body: text.slice(0, 900) };
    } catch (e) {
      return { path, status: 0, body: `Fehler: ${(e as Error).message.slice(0, 150)}` };
    }
  };

  // 1) Weitere Kandidaten-Endpunkte für Artikel-Eigenschaften abklopfen.
  const candidates = [
    '/rest/items/properties?itemsPerPage=20',
    '/rest/items/property_values?itemsPerPage=20',
    '/rest/items/item_properties?itemsPerPage=20',
    '/rest/items/variations?with=variationProperties&itemsPerPage=20',
    '/rest/properties/9',
    '/rest/properties/9/options',
  ];
  const endpoints = [];
  for (const c of candidates) endpoints.push(await probe(c));

  // 2) Die letzten Artikel durchgehen und alles melden, wo Eigenschaften hängen.
  const treffer: any[] = [];
  try {
    const items = await api<any>(cfg, token, '/rest/items?itemsPerPage=60&sortBy=id&sortOrder=desc');
    for (const it of (items?.entries ?? []).slice(0, 60)) {
      if (treffer.length >= 5) break;
      try {
        const vars = await api<any>(cfg, token, `/rest/items/${it.id}/variations`);
        const list: any[] = Array.isArray(vars) ? vars : (vars?.entries ?? []);
        const main = list.find((v) => v.isMain) ?? list[0];
        if (!main?.id) continue;
        const props = await api<any>(cfg, token, `/rest/items/${it.id}/variations/${main.id}/variation_properties`);
        const rows: any[] = Array.isArray(props) ? props : (props?.entries ?? []);
        if (rows.length) treffer.push({ itemId: it.id, variationId: main.id, rows });
      } catch {
        /* einzelne Artikel überspringen */
      }
    }
  } catch (e) {
    treffer.push({ fehler: (e as Error).message.slice(0, 200) });
  }

  return { endpoints, artikelMitEigenschaften: treffer };
}

// ---------------------------------------------------------------------------
// ui.php – Plentys interne Oberflächen-Schnittstelle
// ---------------------------------------------------------------------------

/**
 * Diagnose: Ermittelt die Benutzer-ID für ui.php.
 *
 * Stand der Sondierung: ui.php akzeptiert den REST-Bearer-Token und stellt eine
 * Sitzung aus (Set-Cookie SID_PLENTY_ADMIN_…). Es fehlt nur noch `meta.id` –
 * die ID des angemeldeten Benutzers. Passt sie nicht, antwortet ui.php mit
 * UIInvalidUserIdException ("User does not match").
 */
export async function probeUiEndpoint(): Promise<any> {
  const cfg = getPlentyConfig();
  if (!plentyConfigured(cfg)) return { error: 'Plenty nicht konfiguriert.' };
  const url = `${cfg.baseUrl}/plenty/api/ui.php`;

  // Geheimnisse niemals ausgeben – nur Struktur und unverfängliche Werte.
  const redact = (v: unknown): unknown => {
    if (typeof v === 'string') return v.length > 24 ? `«${v.length} Zeichen»` : v;
    if (Array.isArray(v)) return v.slice(0, 3).map(redact);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [
          k,
          /token|password|secret|refresh/i.test(k) ? '«ausgeblendet»' : redact(val),
        ]),
      );
    }
    return v;
  };

  // 1) Login-Antwort im Ganzen ansehen – enthält sie eine Benutzer-ID?
  const loginRes = await fetch(`${cfg.baseUrl}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: cfg.user, password: cfg.password }),
  });
  const loginRaw = await loginRes.text();
  let loginData: any = {};
  try {
    loginData = JSON.parse(loginRaw);
  } catch {
    /* egal */
  }
  const token = loginData.access_token ?? loginData.accessToken ?? '';

  // 2) Kandidaten-Endpunkte für das eigene Benutzerkonto abfragen.
  const meCandidates = ['/rest/accounts/contacts/me', '/rest/users/me', '/rest/accounts/me', '/rest/user'];
  const me: any[] = [];
  for (const path of meCandidates) {
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      me.push({ path, status: res.status, body: (await res.text()).slice(0, 250) });
    } catch (e) {
      me.push({ path, status: 0, body: (e as Error).message.slice(0, 100) });
    }
  }

  // 3) ui.php mit verschiedenen Benutzer-IDs durchprobieren.
  const readRequest = (id: number) =>
    JSON.stringify({
      requests: [
        {
          _dataName: 'RetailPriceList',
          _moduleName: 'item2/retail_price/list',
          _searchParams: {},
          _writeParams: {},
          _validateParams: {},
          _commandStack: [{ type: 'read', command: 'read' }],
          _dataArray: {},
          _dataList: {},
        },
      ],
      meta: { id },
    });

  // Plenty liefert die Benutzer-ID als `user_id` (mit Unterstrich).
  const idsFromLogin = [loginData.user_id, loginData.userId, loginData.user?.id, loginData.id]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const ids = Array.from(new Set([...idsFromLogin, 5]));

  const uiVersuche: any[] = [];
  for (const id of ids) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token}`,
        },
        body: `request=${encodeURIComponent(readRequest(id))}`,
      });
      const body = await res.text();
      uiVersuche.push({
        metaId: id,
        status: res.status,
        userMismatch: body.includes('UIInvalidUserIdException'),
        body: body.slice(0, 220),
      });
    } catch (e) {
      uiVersuche.push({ metaId: id, status: 0, body: (e as Error).message.slice(0, 100) });
    }
  }

  // 4) Feldnamen der Datei suchen.
  //    Bestätigt sind Modul, dataName und Kommando ("save"): Der Writer läuft
  //    und meldet aus Plentys Quellcode
  //      UploadedFile::__construct(): Argument #1 ($path) ... null given
  //    Er greift also nach der Datei, findet sie unter "file" aber nicht.
  //    Gesucht ist der Schlüssel, unter dem Plenty sie erwartet.
  const userId = ids[0] ?? 5;
  const dummy = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], {
    type: 'application/pdf',
  });
  const MODUL = 'item2/item_variation/property';
  const DATEN = 'ItemVariationPropertyRelationFile';

  const felder = [
    'files', 'files[]', 'file[]', 'file0', 'file_0', 'upload', 'uploadFile',
    'fileToUpload', 'Filedata', 'qqfile', 'data', 'document', 'attachment',
    'propertyFile', 'relationFile', 'ItemVariationPropertyRelationFile',
    'itemVariationPropertyRelationFile', 'fileData',
  ];

  const umschlag = JSON.stringify({
    requests: [
      {
        _dataName: DATEN,
        _moduleName: MODUL,
        _searchParams: {},
        _writeParams: {},
        _validateParams: {},
        _commandStack: [{ type: 'write', command: 'save' }],
        _dataArray: {},
        _dataList: {},
      },
    ],
    meta: { id: userId },
  });

  const uploadVersuche: any[] = [];
  for (const feld of felder) {
    const form = new FormData();
    form.append('request', umschlag);
    form.append(feld, dummy, 'test.pdf');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.text();
      // Solange dieser Fehler kommt, wurde die Datei nicht gefunden.
      const nichtGefunden = body.includes('null given');
      uploadVersuche.push({
        feld,
        erkannt: !nichtGefunden,
        ...(nichtGefunden ? {} : { antwort: body.slice(0, 500) }),
      });
    } catch (e) {
      uploadVersuche.push({ feld, erkannt: false, fehler: (e as Error).message.slice(0, 80) });
    }
  }

  return { url, modul: MODUL, daten: DATEN, kommando: 'save', uploadVersuche };
}

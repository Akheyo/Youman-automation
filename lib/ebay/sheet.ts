/**
 * Read products from a Google Sheet (or any CSV URL) — dependency-free.
 *
 * The owner publishes their sheet via "Datei → Im Web veroeffentlichen → CSV"
 * and pastes that link into the config. We fetch it as plain text and parse it,
 * so no Google OAuth / re-consent is needed for the product source.
 *
 * The header row is matched loosely (German + English column names) so common
 * spreadsheets map onto eBay listing fields without renaming columns.
 */

export interface SheetProduct {
  sku: string;
  title: string;
  description?: string;
  price: number;
  quantity: number;
  currency?: string;
  categoryId?: string;
  condition?: string;
  brand?: string;
  mpn?: string;
  ean?: string;
  images: string[];
  aspects: Record<string, string[]>;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

type Field = 'sku' | 'title' | 'description' | 'price' | 'quantity' | 'currency' | 'categoryId' | 'condition' | 'brand' | 'mpn' | 'ean' | 'image' | 'aspects';

const COLS: Record<string, Field> = {
  sku: 'sku', artikelnummer: 'sku', 'artikel-nr': 'sku', artikelnr: 'sku', id: 'sku', variantnumber: 'sku', variante: 'sku',
  title: 'title', titel: 'title', name: 'title', bezeichnung: 'title', produkt: 'title',
  description: 'description', beschreibung: 'description', text: 'description', html: 'description',
  price: 'price', preis: 'price', vk: 'price', betrag: 'price', verkaufspreis: 'price',
  quantity: 'quantity', menge: 'quantity', bestand: 'quantity', anzahl: 'quantity', qty: 'quantity', lagerbestand: 'quantity',
  currency: 'currency', waehrung: 'currency', 'währung': 'currency',
  category: 'categoryId', categoryid: 'categoryId', kategorie: 'categoryId', 'kategorie-id': 'categoryId', kategorieid: 'categoryId',
  condition: 'condition', zustand: 'condition',
  brand: 'brand', marke: 'brand', hersteller: 'brand',
  mpn: 'mpn', herstellernummer: 'mpn',
  ean: 'ean', gtin: 'ean', barcode: 'ean',
  image: 'image', images: 'image', bild: 'image', bilder: 'image', foto: 'image', fotos: 'image', picture: 'image', bildurl: 'image',
  aspects: 'aspects', merkmale: 'aspects', attribute: 'aspects', eigenschaften: 'aspects',
};

/** Map free-text condition labels onto eBay condition enums. */
const CONDITION_MAP: Record<string, string> = {
  neu: 'NEW', new: 'NEW',
  gebraucht: 'USED_EXCELLENT', used: 'USED_EXCELLENT',
  generalueberholt: 'CERTIFIED_REFURBISHED', refurbished: 'SELLER_REFURBISHED', 'b-ware': 'USED_GOOD',
};

export function normalizeCondition(raw: string | undefined, fallback = 'NEW'): string {
  if (!raw) return fallback;
  const key = raw.toLowerCase().replace(/[\s_-]/g, '');
  return CONDITION_MAP[key] ?? raw.toUpperCase();
}

function splitImages(value: string): string[] {
  return value
    .split(/[\s,;|]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

/** Parse an "Color:Red;Size:M" style cell into eBay's aspect map shape. */
function parseAspects(value: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const pair of value.split(/[;\n]+/)) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k && v) out[k] = v.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

/**
 * Parse CSV text into products. Rows without a SKU, title or valid price are
 * skipped (they cannot become a listing). Returns whatever is usable.
 */
export function parseProductsCsv(text: string): SheetProduct[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitLine(firstLine, delim).map((h) => h.toLowerCase().replace(/^["']|["']$/g, ''));
  const map: (Field | null)[] = header.map((h) => COLS[h] ?? null);

  const out: SheetProduct[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim);
    const images: string[] = [];
    const aspects: Record<string, string[]> = {};
    const p: Partial<SheetProduct> = {};

    cells.forEach((val, i) => {
      const field = map[i];
      if (!field || !val) return;
      if (field === 'image') images.push(...splitImages(val));
      else if (field === 'aspects') Object.assign(aspects, parseAspects(val));
      else if (field === 'price') p.price = Number(val.replace(/[^\d,.-]/g, '').replace(',', '.'));
      else if (field === 'quantity') p.quantity = Math.max(0, Math.floor(Number(val.replace(/[^\d.-]/g, '')) || 0));
      else (p as Record<string, unknown>)[field] = val;
    });

    if (!p.sku || !p.title || !p.price || !Number.isFinite(p.price)) continue;
    out.push({
      sku: p.sku,
      title: p.title.slice(0, 80), // eBay title hard limit
      description: p.description,
      price: p.price,
      quantity: p.quantity && p.quantity > 0 ? p.quantity : 1,
      currency: p.currency,
      categoryId: p.categoryId,
      condition: p.condition,
      brand: p.brand,
      mpn: p.mpn,
      ean: p.ean,
      images,
      aspects,
    });
  }
  return out;
}

/** Fetch the published CSV. Accepts the Google "publish to web" link or any CSV URL. */
export async function fetchSheetCsv(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'text/csv,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet-Abruf fehlgeschlagen: ${res.status} ${res.statusText}`);
  const body = await res.text();
  if (body.trimStart().toLowerCase().startsWith('<!doctype html') || body.trimStart().startsWith('<html')) {
    throw new Error('Die URL liefert HTML statt CSV. Bitte den "Im Web veroeffentlichen → CSV"-Link verwenden.');
  }
  return body;
}

/**
 * Scrape a product from the Syntrox shop by SKU.
 *
 *   searchProductUrl()  → resolve the product detail URL for a SKU via the
 *                         shop search (https://syntrox.de/search?qs=<SKU>).
 *   scrapeProduct()     → parse that page into a structured product.
 *
 * Parsing is structured-data-first (schema.org/Product JSON-LD → OpenGraph →
 * microdata), which is robust across shop platforms, with generic HTML
 * fallbacks for the spec table and the A-Ware availability signal.
 *
 * NOTE: the search-result link extraction and the A-Ware detection are the only
 * shop-specific bits. Defaults below match a typical German shop; if Syntrox
 * differs, adjust SEARCH_LINK_HINTS / the availability regexes.
 */

export interface SyntroxProduct {
  sku: string;
  url: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  images: string[];
  ean?: string;
  brand?: string;
  specs: Record<string, string>;
  inStock: boolean;
  aWare: boolean;
  availabilityText: string;
  /** Stripped page text (for the LLM enrichment step). */
  text: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null;
    return { html: await res.text(), finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&euro;/gi, '€')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&euro;/g, '€')
    .replace(/&nbsp;/g, ' ');
}

/** Pull and JSON-parse every <script type="application/ld+json"> block. */
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw.trim()));
    } catch {
      /* ignore malformed block */
    }
  }
  return out;
}

/** Walk a JSON-LD tree (handles @graph / arrays) and return the first Product node. */
function findProductNode(blocks: unknown[]): Record<string, unknown> | null {
  const stack: unknown[] = [...blocks];
  while (stack.length) {
    const node = stack.shift();
    if (Array.isArray(node)) {
      stack.push(...node);
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const type = obj['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (isProduct) return obj;
      if (obj['@graph']) stack.push(obj['@graph']);
    }
  }
  return null;
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  if (m?.[1] != null) return decodeEntities(m[1]);
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
  const m2 = html.match(re2);
  return m2?.[1] != null ? decodeEntities(m2[1]) : null;
}

/** Generic spec extractor: <th>/<td> rows and <dt>/<dd> pairs. */
function extractSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const rowRe = /<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const k = stripHtml(m[1] ?? '');
    const v = stripHtml(m[2] ?? '');
    if (k && v && k.length < 60 && Object.keys(specs).length < 60) specs[k.replace(/:$/, '')] = v;
  }
  const dlRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dlRe.exec(html))) {
    const k = stripHtml(m[1] ?? '');
    const v = stripHtml(m[2] ?? '');
    if (k && v && k.length < 60 && Object.keys(specs).length < 60) specs[k.replace(/:$/, '')] = v;
  }
  return specs;
}

/** A-Ware = new/A-grade, explicitly NOT B-Ware / returned / refurbished / defective. */
function detectAWare(text: string): { aWare: boolean; label: string } {
  const t = text.toLowerCase();
  const negative = /(b-?ware|c-?ware|retoure|gebraucht|defekt|bastler|2\.?\s*wahl|zweite wahl)/i;
  const positive = /(a-?ware|neuware|fabrikneu|originalverpackt|1\.?\s*wahl)/i;
  if (negative.test(t)) {
    const label = (t.match(negative)?.[0] ?? 'keine A-Ware').toString();
    return { aWare: false, label };
  }
  if (positive.test(t)) return { aWare: true, label: t.match(positive)?.[0] ?? 'A-Ware' };
  // No explicit grade mentioned: treat a normal in-stock shop article as A-Ware.
  return { aWare: true, label: 'A-Ware (kein abweichender Hinweis)' };
}

function detectStock(productNode: Record<string, unknown> | null, text: string): { inStock: boolean; label: string } {
  // schema.org availability first.
  const offers = productNode?.['offers'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const avail = (offer?.['availability'] as string | undefined)?.toString().toLowerCase();
  if (avail) {
    if (avail.includes('instock') || avail.includes('limitedavailability') || avail.includes('preorder')) return { inStock: true, label: avail };
    if (avail.includes('outofstock') || avail.includes('soldout') || avail.includes('discontinued')) return { inStock: false, label: avail };
  }
  const t = text.toLowerCase();
  if (/(nicht (mehr )?(verfügbar|lieferbar|auf lager)|ausverkauft|vergriffen|sold out)/i.test(t)) return { inStock: false, label: 'nicht verfügbar' };
  if (/(auf lager|sofort lieferbar|verfügbar|lieferbar|in den warenkorb)/i.test(t)) return { inStock: true, label: 'verfügbar' };
  return { inStock: true, label: 'unbekannt (angenommen verfügbar)' };
}

function asImages(value: unknown, origin: string): string[] {
  const raw: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') raw.push(v);
    else if (v && typeof v === 'object' && 'url' in v) raw.push(String((v as { url: unknown }).url));
  };
  if (Array.isArray(value)) value.forEach(push);
  else push(value);
  return raw
    .map((u) => {
      try {
        return new URL(u, origin).toString();
      } catch {
        return '';
      }
    })
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 12);
}

/**
 * Resolve the product detail URL for a SKU. If the search already redirected to
 * a single product page, use that; otherwise pick the first product link from
 * the results, preferring one whose href/text mentions the SKU.
 */
export async function searchProductUrl(searchBase: string, sku: string): Promise<string | null> {
  const url = searchBase.includes('=') ? `${searchBase}${encodeURIComponent(sku)}` : `${searchBase}${searchBase.endsWith('/') ? '' : '/'}${encodeURIComponent(sku)}`;
  const res = await fetchHtml(url);
  if (!res) return null;

  // Case 1: search resolved straight to a product page.
  if (!/[?&]qs=|\/search/i.test(res.finalUrl)) return res.finalUrl;

  const origin = new URL(res.finalUrl).origin;
  // Case 2: a Product JSON-LD on the results page (shops do this for single hits).
  const product = findProductNode(jsonLdBlocks(res.html));
  const ldUrl = product?.['url'];
  if (typeof ldUrl === 'string') {
    try {
      return new URL(ldUrl, origin).toString();
    } catch {
      /* fall through */
    }
  }

  // Case 3: scan anchors; prefer a product-looking link mentioning the SKU.
  const anchors: { href: string; text: string }[] = [];
  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(res.html)) && anchors.length < 400) {
    const href = m[1];
    if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
    if (/\/(search|cart|warenkorb|login|account|kontakt|agb|datenschutz|impressum|wishlist|merkzettel)\b/i.test(href)) continue;
    anchors.push({ href, text: stripHtml(m[2] ?? '') });
  }
  const skuLc = sku.toLowerCase();
  const score = (a: { href: string; text: string }) =>
    (a.href.toLowerCase().includes(skuLc) ? 4 : 0) +
    (a.text.toLowerCase().includes(skuLc) ? 3 : 0) +
    (/\/(produkt|product|artikel|p\/|detail)/i.test(a.href) ? 1 : 0);
  anchors.sort((x, y) => score(y) - score(x));
  const best = anchors.find((a) => score(a) > 0) ?? anchors[0];
  if (!best) return null;
  try {
    return new URL(best.href, origin).toString();
  } catch {
    return null;
  }
}

/** Fetch and parse a product detail page into a structured product. */
export async function scrapeProduct(productUrl: string, sku: string): Promise<SyntroxProduct | null> {
  const res = await fetchHtml(productUrl);
  if (!res) return null;
  const { html, finalUrl } = res;
  const origin = new URL(finalUrl).origin;
  const text = stripHtml(html);

  const product = findProductNode(jsonLdBlocks(html));
  const offers = product?.['offers'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;

  const title =
    (product?.['name'] as string | undefined) ||
    metaContent(html, 'og:title') ||
    stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')) ||
    sku;

  const description =
    (product?.['description'] as string | undefined) ||
    metaContent(html, 'og:description') ||
    metaContent(html, 'description') ||
    '';

  const priceRaw =
    (offer?.['price'] as string | number | undefined) ??
    metaContent(html, 'product:price:amount') ??
    metaContent(html, 'og:price:amount');
  const price = priceRaw != null ? Number(String(priceRaw).replace(/[^\d,.-]/g, '').replace(',', '.')) : null;

  const currency =
    (offer?.['priceCurrency'] as string | undefined) ||
    metaContent(html, 'product:price:currency') ||
    'EUR';

  const ldImages = asImages(product?.['image'], origin);
  const ogImage = metaContent(html, 'og:image');
  const images = ldImages.length > 0 ? ldImages : asImages(ogImage, origin);

  const ean = (product?.['gtin13'] || product?.['gtin'] || product?.['gtin8'] || product?.['ean']) as string | undefined;
  const brandNode = product?.['brand'];
  const brand =
    typeof brandNode === 'string'
      ? brandNode
      : brandNode && typeof brandNode === 'object' && 'name' in brandNode
        ? String((brandNode as { name: unknown }).name)
        : metaContent(html, 'product:brand') || undefined;

  const stock = detectStock(product, text);
  const aware = detectAWare(text);

  return {
    sku: (product?.['sku'] as string | undefined) || (product?.['mpn'] as string | undefined) || sku,
    url: finalUrl,
    title: decodeEntities(title).trim().slice(0, 80),
    description: decodeEntities(description).trim(),
    price: price != null && Number.isFinite(price) ? price : null,
    currency,
    images,
    ean: ean ? String(ean) : undefined,
    brand: brand ? decodeEntities(brand) : undefined,
    specs: extractSpecs(html),
    inStock: stock.inStock,
    aWare: aware.aWare,
    availabilityText: `${stock.label}; ${aware.label}`,
    text: text.slice(0, 6000),
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSkuList } from '@/lib/ebay/sheet';
import { scrapeProduct, searchProductUrl } from '@/lib/ebay/syntrox';

/** Minimal fetch stub returning an HTML document. */
function stubHtml(html: string, finalUrl: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      url: finalUrl,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => html,
    })),
  );
}

const PRODUCT_HTML = `<!doctype html><html><head>
<meta property="og:title" content="OG Titel">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Eismaschine Zentoria",
 "sku":"GG-50W-A","gtin13":"4250958712345","brand":{"@type":"Brand","name":"Syntrox"},
 "image":["https://syntrox.de/img/1.jpg","/img/2.jpg"],
 "description":"Tolle Eismaschine mit Kompressor.",
 "offers":{"@type":"Offer","price":"199.99","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}
</script></head><body>
<h1>Eismaschine Zentoria</h1>
<table><tr><th>Leistung</th><td>180 W</td></tr><tr><th>Fassungsvermögen</th><td>1,0 l</td></tr></table>
<div>Auf Lager - sofort lieferbar. Neuware A-Ware.</div>
</body></html>`;

afterEach(() => vi.unstubAllGlobals());

describe('parseSkuList', () => {
  it('reads a single column with a header', () => {
    expect(parseSkuList('sku\nGG-50W-A\nKC-25W\n')).toEqual(['GG-50W-A', 'KC-25W']);
  });

  it('reads a headerless single column', () => {
    expect(parseSkuList('GG-50W-A\nKC-25W')).toEqual(['GG-50W-A', 'KC-25W']);
  });

  it('picks the sku column out of a multi-column sheet (semicolon)', () => {
    expect(parseSkuList('Name;Artikelnummer\nFoo;GG-50W-A\nBar;KC-25W')).toEqual(['GG-50W-A', 'KC-25W']);
  });

  it('deduplicates and trims', () => {
    expect(parseSkuList('sku\n GG-50W-A \nGG-50W-A\nKC-25W')).toEqual(['GG-50W-A', 'KC-25W']);
  });

  it('returns [] on empty input', () => {
    expect(parseSkuList('')).toEqual([]);
  });
});

describe('scrapeProduct (structured-data first)', () => {
  it('extracts product fields from JSON-LD', async () => {
    stubHtml(PRODUCT_HTML, 'https://syntrox.de/eismaschine-zentoria');
    const p = await scrapeProduct('https://syntrox.de/eismaschine-zentoria', 'GG-50W-A');
    expect(p).not.toBeNull();
    expect(p!.title).toBe('Eismaschine Zentoria');
    expect(p!.price).toBe(199.99);
    expect(p!.currency).toBe('EUR');
    expect(p!.ean).toBe('4250958712345');
    expect(p!.brand).toBe('Syntrox');
    expect(p!.images).toEqual(['https://syntrox.de/img/1.jpg', 'https://syntrox.de/img/2.jpg']); // relative resolved
    expect(p!.specs['Leistung']).toBe('180 W');
    expect(p!.inStock).toBe(true);
    expect(p!.aWare).toBe(true);
  });

  it('flags B-Ware as not A-Ware', async () => {
    stubHtml(PRODUCT_HTML.replace('Neuware A-Ware.', 'Achtung: B-Ware, Retoure.'), 'https://syntrox.de/x');
    const p = await scrapeProduct('https://syntrox.de/x', 'GG-50W-A');
    expect(p!.aWare).toBe(false);
  });

  it('detects out-of-stock', async () => {
    stubHtml(PRODUCT_HTML.replace('schema.org/InStock', 'schema.org/OutOfStock'), 'https://syntrox.de/x');
    const p = await scrapeProduct('https://syntrox.de/x', 'GG-50W-A');
    expect(p!.inStock).toBe(false);
  });
});

describe('searchProductUrl', () => {
  it('uses the final URL when the search redirects straight to a product', async () => {
    stubHtml('<html><body>egal</body></html>', 'https://syntrox.de/eismaschine-zentoria');
    const url = await searchProductUrl('https://syntrox.de/search?qs=', 'GG-50W-A');
    expect(url).toBe('https://syntrox.de/eismaschine-zentoria');
  });

  it('returns null when the search page has no product link', async () => {
    stubHtml('<html><body><a href="/kontakt">Kontakt</a></body></html>', 'https://syntrox.de/search?qs=GG-50W-A');
    const url = await searchProductUrl('https://syntrox.de/search?qs=', 'GG-50W-A');
    expect(url).toBeNull();
  });
});

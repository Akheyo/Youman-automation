/**
 * Felix company source: Apify Actors.
 *
 * Apify runs hosted scrapers ("Actors") and hands back a dataset. The default
 * Actor here is the Google Maps scraper, which returns the same shape of data
 * as the Places API but without needing a Google Cloud project — useful when a
 * customer already pays for Apify, and for markets where Places is thin.
 *
 * Requires APIFY_TOKEN. Optional APIFY_ACTOR_ID to swap in a different Actor.
 * Docs: https://docs.apify.com/api/v2#/reference/actors/run-actor-synchronously
 */

import type { CompanyResult } from './overpass-companies';
import type { FindParams, FindResult } from './places-companies';

/** Google Maps scraper — returns title/address/phone/website per place. */
const DEFAULT_ACTOR = 'compass~crawler-google-places';
const API_BASE = 'https://api.apify.com/v2';

/** Apify bills per result, so never let a stray limit run away. */
const MAX_RESULTS = 60;
/** Actor runs are slow (real browsers); allow more headroom than a plain API. */
const RUN_TIMEOUT_MS = 180_000;

/** Subset of the Google Maps Actor's output that we map onto CompanyResult. */
interface ApifyPlace {
  placeId?: string;
  title?: string;
  address?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  categoryName?: string;
  categories?: string[];
  location?: { lat?: number; lng?: number };
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
}

/** "Musterstr. 1, 12345 Musterstadt" from whichever fields the Actor filled. */
function buildAddress(p: ApifyPlace): string {
  if (p.address) return p.address;
  const line = [p.street, [p.postalCode, p.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return line.trim();
}

function toCompany(p: ApifyPlace, idx: number): CompanyResult {
  const website = (p.website || '').trim();
  const categories = (p.categories || []).filter(Boolean);
  const descriptors = [p.categoryName, ...categories].filter(
    (c): c is string => Boolean(c),
  );
  return {
    id: p.placeId ? `apify/${p.placeId}` : `apify/idx-${idx}`,
    name: (p.title || '').trim(),
    address: buildAddress(p),
    phone: (p.phone || p.phoneUnformatted || '').trim() || null,
    website: website || null,
    hasWebsite: Boolean(website),
    descriptors: Array.from(new Set(descriptors)).slice(0, 8),
    lat: typeof p.location?.lat === 'number' ? p.location.lat : null,
    lng: typeof p.location?.lng === 'number' ? p.location.lng : null,
  };
}

/**
 * Search businesses through an Apify Actor.
 *
 * `country` widens Felix beyond Germany — Apify's Maps Actor takes a country
 * code, so the same call serves AT and CH lead lists.
 */
export async function findCompaniesApify(
  p: FindParams & { country?: 'de' | 'at' | 'ch' },
  token: string,
): Promise<FindResult> {
  const area = (p.area || '').trim();
  const industry = (p.industry || '').trim();
  const country = p.country || 'de';
  if (!area || !industry) {
    return {
      companies: [],
      query: '',
      error: `Bitte Ort und Branche angeben (Ort="${area}", Branche="${industry}").`,
    };
  }

  const limit = Math.min(Math.max(p.limit ?? 30, 1), MAX_RESULTS);
  const actor = (process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR).replace('/', '~');
  const query = `${industry} ${area}`;

  const input = {
    searchStringsArray: [query],
    locationQuery: area,
    maxCrawledPlacesPerSearch: limit,
    language: 'de',
    countryCode: country,
    skipClosedPlaces: true,
    scrapePlaceDetailPage: false,
  };

  // run-sync-get-dataset-items starts the Actor and returns its dataset in one
  // call, so we don't have to poll the run status ourselves.
  const url =
    `${API_BASE}/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}&format=json&clean=true&limit=${limit}`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), RUN_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: ctl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      companies: [],
      query,
      error: aborted
        ? `Apify-Lauf hat länger als ${RUN_TIMEOUT_MS / 1000}s gebraucht und wurde abgebrochen. Versuch es mit einem kleineren \`limit\`.`
        : `Apify nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Apify's own error envelope is more useful than the bare status code.
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* keep the raw body */
    }
    const hint =
      res.status === 401
        ? ' Prüfe APIFY_TOKEN (console.apify.com → Settings → Integrations).'
        : res.status === 402
          ? ' Das Apify-Guthaben ist aufgebraucht.'
          : '';
    return {
      companies: [],
      query,
      error: `Apify-Fehler ${res.status}: ${detail}${hint}`,
    };
  }

  let items: ApifyPlace[];
  try {
    const parsed: unknown = await res.json();
    items = Array.isArray(parsed) ? (parsed as ApifyPlace[]) : [];
  } catch {
    return { companies: [], query, error: 'Apify lieferte keine lesbare Antwort.' };
  }

  const companies = items
    .filter((p) => !p.permanentlyClosed && !p.temporarilyClosed)
    .map(toCompany)
    .filter((c) => c.name)
    .filter((c) => (p.without_website ? !c.hasWebsite : true))
    .slice(0, limit);

  return { companies, query };
}

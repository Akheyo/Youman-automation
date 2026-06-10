/**
 * Felix's primary company source: Google Places API (New) — Text Search.
 *
 * Far more complete than OpenStreetMap (almost every operating business has a
 * Google listing). One request returns name, address, phone, website and the
 * business types Felix needs to reason about what a company does.
 *
 * Requires GOOGLE_MAPS_API_KEY with "Places API (New)" enabled + billing.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

import type { CompanyResult } from './overpass-companies';

export interface FindParams {
  /** City / Landkreis / region, e.g. "Dortmund", "Kreis Borken". */
  area: string;
  /** Industry in plain words, e.g. "Dachdecker", "Friseure", "Werbeagenturen". */
  industry: string;
  without_website?: boolean;
  limit?: number;
}

export interface FindResult {
  companies: CompanyResult[];
  query: string;
  error?: string;
}

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.location',
  'places.businessStatus',
  'nextPageToken',
].join(',');

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
}

interface GoogleResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
}

export async function findCompaniesGoogle(p: FindParams, apiKey: string): Promise<FindResult> {
  const area = (p.area || '').trim();
  const industry = (p.industry || '').trim();
  if (!area || !industry) {
    return { companies: [], query: '', error: `Bitte Ort und Branche angeben (Ort="${area}", Branche="${industry}").` };
  }
  const limit = Math.min(Math.max(p.limit ?? 30, 1), 60);
  const textQuery = `${industry} in ${area}, Deutschland`;

  const collected: CompanyResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3 && collected.length < limit; page++) {
    const body: Record<string, unknown> = { textQuery, languageCode: 'de', regionCode: 'DE', pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = (await res.json().catch(() => ({}))) as GoogleResponse;
    if (!res.ok) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      const err = new Error(msg) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    for (const pl of data.places || []) {
      const c = toCompany(pl);
      if (c) collected.push(c);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  // Dedupe by id.
  const seen = new Set<string>();
  let companies = collected.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  if (p.without_website) companies = companies.filter((c) => !c.hasWebsite);
  companies = companies.slice(0, limit);
  return { companies, query: textQuery };
}

function toCompany(pl: GooglePlace): CompanyResult | null {
  const name = pl.displayName?.text;
  if (!name) return null;
  const phone = pl.nationalPhoneNumber || pl.internationalPhoneNumber || null;
  const website = pl.websiteUri || null;

  const descriptors: string[] = [];
  if (pl.primaryTypeDisplayName?.text) descriptors.push(pl.primaryTypeDisplayName.text);
  if (Array.isArray(pl.types)) descriptors.push(...pl.types.slice(0, 4));
  if (pl.businessStatus && pl.businessStatus !== 'OPERATIONAL') descriptors.push(pl.businessStatus);

  return {
    id: pl.id || `${name}|${pl.formattedAddress || ''}`,
    name,
    address: pl.formattedAddress || '',
    phone,
    website,
    hasWebsite: Boolean(website),
    descriptors,
    lat: pl.location?.latitude ?? null,
    lng: pl.location?.longitude ?? null,
  };
}

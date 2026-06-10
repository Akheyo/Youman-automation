/**
 * Felix's company-finder data source: OpenStreetMap via the Overpass API.
 *
 * Given an administrative area (city / Landkreis / Regierungsbezirk) and an OSM
 * tag selector (e.g. `shop=hairdresser`, `office=insurance`), returns matching
 * businesses with contact details and the descriptive tags Felix needs to reason
 * about *what the company actually does* (sales agency, craft, retail, …).
 */

export interface CompanyResult {
  /** Stable OSM id, e.g. "node/123". */
  id: string;
  name: string;
  /** Postal address assembled from addr:* tags (may be partial). */
  address: string;
  phone: string | null;
  website: string | null;
  hasWebsite: boolean;
  /** Descriptive OSM tags so the model can infer the line of business. */
  descriptors: string[];
  lat: number | null;
  lng: number | null;
}

export interface FindCompaniesParams {
  /** Administrative area name as in OSM, e.g. "Dortmund", "Kreis Borken". */
  area: string;
  /** OSM tag filter, e.g. "shop=hairdresser", "office=company". */
  osm_selector: string;
  /** If true, only return businesses with no website tag (cold-lead filter). */
  without_website?: boolean;
  /** Max results (1–60, default 30). */
  limit?: number;
}

export interface FindCompaniesResult {
  companies: CompanyResult[];
  query: string;
  error?: string;
}

const OVERPASS_ENDPOINTS: string[] = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
].filter((u): u is string => Boolean(u));

const SELECTOR_RE = /^[a-z_]+=[A-Za-z0-9_:.\- ]+$/;
const AREA_RE = /^[A-Za-zÀ-ÿ0-9 .\-/()]{2,80}$/;

// Tags that describe what a business does — fed to the model for interpretation.
const DESCRIPTOR_KEYS = [
  'office',
  'shop',
  'craft',
  'amenity',
  'industrial',
  'industry',
  'company',
  'healthcare',
  'tourism',
  'leisure',
  'description',
];

export async function findCompanies(p: FindCompaniesParams): Promise<FindCompaniesResult> {
  const area = (p.area || '').trim();
  const selector = (p.osm_selector || '').trim();
  if (!AREA_RE.test(area)) {
    return { companies: [], query: '', error: `Ungültiger Ort: "${area}".` };
  }
  if (!SELECTOR_RE.test(selector)) {
    return {
      companies: [],
      query: '',
      error: `Ungültiger OSM-Filter: "${selector}". Erwartet z. B. shop=hairdresser oder office=insurance.`,
    };
  }
  const eq = selector.indexOf('=');
  const k = selector.slice(0, eq);
  const v = selector.slice(eq + 1);
  const limit = Math.min(Math.max(p.limit ?? 30, 1), 60);

  const ql =
    `[out:json][timeout:25];\n` +
    `area["name"="${area}"]["boundary"="administrative"]->.a;\n` +
    `nwr["${k}"="${v}"](area.a);\n` +
    `out center ${limit * 5};`;

  let lastErr = '';
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30_000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = (await res.json()) as { elements?: unknown[] };
      const elements = Array.isArray(data.elements) ? data.elements : [];

      let companies = elements
        .map((e) => toCompany(e as OverpassElement, k))
        .filter((c): c is CompanyResult => c !== null);

      // Dedupe by name + address.
      const seen = new Set<string>();
      companies = companies.filter((c) => {
        const key = (c.name + '|' + c.address).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (p.without_website) companies = companies.filter((c) => !c.hasWebsite);
      companies = companies.slice(0, limit);
      return { companies, query: ql };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { companies: [], query: ql, error: `Overpass nicht erreichbar (${lastErr}).` };
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function toCompany(e: OverpassElement, selectorKey: string): CompanyResult | null {
  const tags = e.tags || {};
  const name = tags.name || tags.brand || tags.operator;
  if (!name) return null;

  const lat = e.lat ?? e.center?.lat ?? null;
  const lng = e.lon ?? e.center?.lon ?? null;

  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const cityLine = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const address = [street, cityLine].filter(Boolean).join(', ');

  const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
  const website = tags.website || tags['contact:website'] || tags.url || null;

  const descriptors: string[] = [];
  // Always include the selector match first so the model sees the primary type.
  if (tags[selectorKey]) descriptors.push(`${selectorKey}=${tags[selectorKey]}`);
  for (const key of DESCRIPTOR_KEYS) {
    if (key === selectorKey) continue;
    const val = tags[key];
    if (val) descriptors.push(key === 'description' ? `description: ${val}` : `${key}=${val}`);
  }

  return {
    id: `${e.type}/${e.id}`,
    name,
    address,
    phone,
    website: website || null,
    hasWebsite: Boolean(website),
    descriptors,
    lat,
    lng,
  };
}

// --- Industry → OSM selector mapping (free Overpass fallback) ---------------

const INDUSTRY_SELECTORS: { match: string[]; selector: string }[] = [
  { match: ['friseur', 'frisör', 'frisoer'], selector: 'shop=hairdresser' },
  { match: ['restaurant', 'gastronomie', 'gaststätte', 'gaststaette'], selector: 'amenity=restaurant' },
  { match: ['bäckerei', 'baeckerei', 'bäcker', 'baecker'], selector: 'shop=bakery' },
  { match: ['metzger', 'fleischer', 'metzgerei'], selector: 'shop=butcher' },
  { match: ['cafe', 'café'], selector: 'amenity=cafe' },
  { match: ['hotel', 'pension'], selector: 'tourism=hotel' },
  { match: ['versicherung'], selector: 'office=insurance' },
  { match: ['immobilien', 'makler'], selector: 'office=estate_agent' },
  { match: ['steuerberater'], selector: 'office=tax_advisor' },
  { match: ['anwalt', 'rechtsanwalt', 'kanzlei'], selector: 'office=lawyer' },
  { match: ['zahnarzt', 'zahnärzte', 'zahnaerzte'], selector: 'amenity=dentist' },
  { match: ['arzt', 'ärzte', 'aerzte', 'praxis'], selector: 'amenity=doctors' },
  { match: ['apotheke'], selector: 'amenity=pharmacy' },
  { match: ['autohaus', 'autohändler', 'autohaendler'], selector: 'shop=car' },
  { match: ['werkstatt', 'kfz'], selector: 'shop=car_repair' },
  { match: ['fitness', 'fitnessstudio'], selector: 'leisure=fitness_centre' },
  { match: ['dachdecker'], selector: 'craft=roofer' },
  { match: ['tischler', 'schreiner'], selector: 'craft=carpenter' },
  { match: ['elektriker', 'elektro'], selector: 'craft=electrician' },
  { match: ['maler', 'lackierer'], selector: 'craft=painter' },
  { match: ['klempner', 'sanitär', 'sanitaer', 'installateur', 'heizung'], selector: 'craft=plumber' },
  { match: ['werbeagentur', 'werbung', 'marketing', 'marketingagentur', 'agentur'], selector: 'office=advertising_agency' },
];

export function industryToSelector(industry: string): string | null {
  const q = industry.toLowerCase();
  for (const entry of INDUSTRY_SELECTORS) {
    if (entry.match.some((m) => q.includes(m))) return entry.selector;
  }
  return null;
}

/** Free fallback: map a plain-language industry to an OSM selector, then query. */
export async function findCompaniesByIndustry(
  area: string,
  industry: string,
  withoutWebsite?: boolean,
  limit?: number,
): Promise<FindCompaniesResult> {
  const selector = industryToSelector(industry);
  if (!selector) {
    return {
      companies: [],
      query: '',
      error: `Branche "${industry}" ist in der kostenlosen OSM-Quelle nicht zuordenbar. Für volle Abdeckung GOOGLE_MAPS_API_KEY einrichten.`,
    };
  }
  return findCompanies({ area, osm_selector: selector, without_website: withoutWebsite, limit });
}

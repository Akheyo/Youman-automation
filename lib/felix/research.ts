/**
 * Anna's research helper: fetch a company's website to (a) give the model text
 * to analyse and (b) extract a contact e-mail (Impressum/Kontakt), since Google
 * Places does not return e-mail addresses.
 *
 * Best-effort: many sites block bots or hide the e-mail — then `emails` is empty
 * and the model asks the user for the address.
 */

export interface ResearchResult {
  ok: boolean;
  /** Plain-text excerpt of the fetched pages for analysis. */
  text: string;
  /** Candidate contact e-mails, best match first. */
  emails: string[];
  /** Pages actually fetched. */
  pages: string[];
  error?: string;
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL = /(example\.|sentry|wixpress|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|your-?email|name@|@sentry|@example)/i;

function normalizeUrl(raw: string): string | null {
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(url: string): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FelixLeadScout/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function researchCompany(website: string, name: string): Promise<ResearchResult> {
  const base = normalizeUrl(website);
  if (!base) {
    return { ok: false, text: '', emails: [], pages: [], error: `Keine nutzbare Website für "${name}".` };
  }

  const origin = new URL(base).origin;
  const candidates = [base, `${origin}/impressum`, `${origin}/kontakt`, `${origin}/imprint`, `${origin}/contact`];

  const texts: string[] = [];
  const rawHtml: string[] = [];
  const fetched: string[] = [];

  for (const url of candidates) {
    if (fetched.length >= 3) break;
    const html = await fetchPage(url);
    if (!html) continue;
    fetched.push(url);
    rawHtml.push(html);
    texts.push(stripHtml(html));
  }

  if (fetched.length === 0) {
    return { ok: false, text: '', emails: [], pages: [], error: `Website "${base}" nicht erreichbar oder blockiert.` };
  }

  // Extract + rank e-mails (prefer same domain as the site).
  const siteDomain = new URL(base).hostname.replace(/^www\./, '');
  const found = new Set<string>();
  for (const html of rawHtml) {
    const matches = html.match(EMAIL_RE) || [];
    for (const m of matches) {
      const e = m.toLowerCase();
      if (!BAD_EMAIL.test(e)) found.add(e);
    }
  }
  const emails = [...found].sort((a, b) => {
    const aDom = a.endsWith(siteDomain) ? 0 : 1;
    const bDom = b.endsWith(siteDomain) ? 0 : 1;
    return aDom - bDom;
  });

  const text = texts.join('\n\n').slice(0, 5000);
  return { ok: true, text, emails, pages: fetched };
}

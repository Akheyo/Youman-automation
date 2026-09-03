/**
 * Vorlagen-Rendering für Pauls Cold-Outreach-Mails.
 *
 * Eine Vorlage ist normaler Text mit Platzhaltern in doppelten geschweiften
 * Klammern: `Hallo {{vorname}}, ...`. Jeder Platzhalter darf einen Ersatzwert
 * mitbringen (`{{vorname|zusammen}}`), der greift, wenn das Feld beim Kontakt
 * leer ist. Ohne Ersatzwert bleibt ein leeres Feld ein *harter* Fehler —
 * "Hallo ," ist die klassische Art, eine Kaltakquise-Mail zu verbrennen, also
 * wird so eine Mail lieber gar nicht verschickt.
 */

export interface ContactVars {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  anlass?: string | null;
  custom?: Record<string, unknown> | null;
}

export interface SenderVars {
  from_name?: string | null;
  signature?: string | null;
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_äöüÄÖÜß]+)\s*(?:\|([^}]*))?\}\}/g;

/** Deutsche und englische Feldnamen zeigen auf dasselbe Kontaktfeld. */
const ALIASES: Record<string, string> = {
  vorname: 'first_name',
  first_name: 'first_name',
  firstname: 'first_name',
  nachname: 'last_name',
  last_name: 'last_name',
  lastname: 'last_name',
  name: 'full_name',
  vollername: 'full_name',
  full_name: 'full_name',
  firma: 'company',
  company: 'company',
  unternehmen: 'company',
  website: 'website',
  webseite: 'website',
  domain: 'domain',
  anlass: 'anlass',
  grund: 'anlass',
  email: 'email',
  mail: 'email',
  absender: 'from_name',
  from_name: 'from_name',
};

/** Hostname ohne Protokoll und www — als eigener Platzhalter `{{domain}}`. */
export function domainOf(website: string | null | undefined): string {
  const raw = (website ?? '').trim();
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProto).hostname.replace(/^www\./i, '');
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] ?? '';
  }
}

/** Alle auflösbaren Werte für einen Kontakt — Basis für Rendering und Vorschau. */
export function varsFor(contact: ContactVars, sender: SenderVars = {}): Record<string, string> {
  const first = (contact.first_name ?? '').trim();
  const last = (contact.last_name ?? '').trim();
  const vars: Record<string, string> = {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' '),
    company: (contact.company ?? '').trim(),
    website: (contact.website ?? '').trim(),
    domain: domainOf(contact.website),
    anlass: (contact.anlass ?? '').trim(),
    email: (contact.email ?? '').trim(),
    from_name: (sender.from_name ?? '').trim(),
  };
  // Freie Spalten aus dem CSV sind zusätzlich unter ihrem eigenen Namen nutzbar.
  for (const [k, v] of Object.entries(contact.custom ?? {})) {
    const key = k.trim().toLowerCase();
    if (key && !(key in vars)) vars[key] = v == null ? '' : String(v).trim();
  }
  return vars;
}

function resolve(name: string, vars: Record<string, string>): string | undefined {
  const key = name.trim().toLowerCase();
  const mapped = ALIASES[key] ?? key;
  return vars[mapped] ?? vars[key];
}

export interface RenderResult {
  text: string;
  /** Platzhalter ohne Wert und ohne Ersatzwert — blockiert den Versand. */
  missing: string[];
}

/** Setzt alle Platzhalter einer Vorlage. Sammelt unauflösbare Felder. */
export function renderTemplate(template: string, vars: Record<string, string>): RenderResult {
  const missing: string[] = [];
  const text = (template ?? '').replace(PLACEHOLDER, (_m, rawName: string, fallback?: string) => {
    const value = resolve(rawName, vars);
    if (value) return value;
    if (fallback !== undefined) return fallback.trim();
    if (!missing.includes(rawName)) missing.push(rawName);
    return '';
  });
  return { text, missing };
}

/** Alle in einer Vorlage benutzten Platzhalter (für die Editor-Hilfe). */
export function usedPlaceholders(template: string): string[] {
  const out: string[] = [];
  for (const m of (template ?? '').matchAll(PLACEHOLDER)) {
    const name = (m[1] ?? '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export interface RenderedMail {
  subject: string;
  body: string;
  missing: string[];
}

/**
 * Rendert einen Sequenz-Schritt für einen Kontakt. Ab Schritt 2 darf der
 * Betreff leer bleiben — dann hängt Paul die Mail als "Re: <Erstbetreff>" an
 * den bestehenden Verlauf, so wie ein Mensch nachfasst.
 */
export function renderStep(
  step: { subject: string; body: string; step_no?: number },
  contact: ContactVars,
  sender: SenderVars = {},
  firstSubject?: string,
): RenderedMail {
  const vars = varsFor(contact, sender);
  const rawSubject = (step.subject ?? '').trim();
  const subj = rawSubject
    ? renderTemplate(rawSubject, vars)
    : firstSubject
      ? { text: `Re: ${firstSubject.replace(/^re:\s*/i, '')}`, missing: [] }
      : { text: '', missing: [] };
  const body = renderTemplate(step.body ?? '', vars);
  const signature = (sender.signature ?? '').trim();
  const withSig = signature ? `${body.text.trimEnd()}\n\n${renderTemplate(signature, vars).text}` : body.text;

  return {
    subject: subj.text.trim(),
    body: withSig,
    missing: [...new Set([...subj.missing, ...body.missing])],
  };
}

/** Grobe Syntaxprüfung: gültige Mailadresse (ohne DNS-Auflösung). */
export function isEmail(value: string | null | undefined): boolean {
  const v = (value ?? '').trim();
  return /^[^@\s,;]+@[^@\s,;]+\.[a-zA-Z]{2,}$/.test(v);
}

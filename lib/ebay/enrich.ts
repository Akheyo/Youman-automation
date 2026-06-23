/**
 * LLM enrichment for a scraped product — finds the right eBay category and
 * fills the item specifics (Artikelmerkmale).
 *
 * Grounded by the eBay Taxonomy API so the model can't invent invalid data:
 *   1. eBay suggests candidate categories for the product title.
 *   2. The LLM picks the best one (or we fall back to eBay's top suggestion).
 *   3. eBay returns that category's aspects (required + allowed values).
 *   4. The LLM fills aspect values from the product, constrained to allowed
 *      values for SELECTION_ONLY aspects.
 *
 * Uses OpenRouter (OpenAI-compatible), same provider as Felix. Set
 * OPENROUTER_API_KEY; override the model via EBAY_LLM_MODEL (else FELIX_MODEL).
 */

import type { SyntroxProduct } from './syntrox';
import { getCategorySuggestions, getDefaultCategoryTreeId, getItemAspectsForCategory, type AspectDef, type CategorySuggestion } from './taxonomy';
import type { EbayEnv } from './oauth';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function enrichConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function model(): string {
  return process.env.EBAY_LLM_MODEL || process.env.FELIX_MODEL || 'openai/gpt-4o-mini';
}

export interface EnrichResult {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  aspects: Record<string, string[]>;
  /** Whether the LLM (vs. a pure fallback) produced the result. */
  llmUsed: boolean;
}

interface TaxCtx {
  accessToken: string;
  env: EbayEnv;
  marketplaceId: string;
}

/** One OpenRouter chat call that must return a JSON object. */
async function chatJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45_000);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
      },
      body: JSON.stringify({
        model: model(),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function productSummary(p: SyntroxProduct): string {
  const specs = Object.entries(p.specs)
    .slice(0, 40)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return [
    `Titel: ${p.title}`,
    p.brand ? `Marke: ${p.brand}` : '',
    p.ean ? `EAN: ${p.ean}` : '',
    p.description ? `Beschreibung: ${p.description.slice(0, 1200)}` : '',
    specs ? `Technische Daten:\n${specs}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Let the LLM pick the best category id among eBay's suggestions. */
async function pickCategory(p: SyntroxProduct, suggestions: CategorySuggestion[]): Promise<CategorySuggestion> {
  const fallback = suggestions[0];
  if (!fallback) throw new Error('Keine Kategorie-Kandidaten.');
  if (suggestions.length === 1 || !enrichConfigured()) return fallback;
  const list = suggestions.map((s, i) => `${i + 1}. id=${s.categoryId} — ${s.path}`).join('\n');
  const out = await chatJson(
    'Du ordnest Produkte der passendsten eBay-Kategorie zu. Antworte NUR als JSON: {"categoryId":"<id>"}. Wähle ausschließlich eine der vorgegebenen IDs.',
    `Produkt:\n${productSummary(p)}\n\nKandidaten-Kategorien:\n${list}\n\nWelche Kategorie passt am besten? Gib die categoryId zurück.`,
  );
  const chosen = out?.['categoryId'];
  return suggestions.find((s) => s.categoryId === String(chosen)) ?? fallback;
}

/** Let the LLM fill aspect values from the product, respecting allowed values. */
async function fillAspects(p: SyntroxProduct, aspects: AspectDef[]): Promise<Record<string, string[]>> {
  // Prioritise required aspects; cap the prompt size.
  const relevant = [...aspects].sort((a, b) => Number(b.required) - Number(a.required)).slice(0, 25);
  if (relevant.length === 0 || !enrichConfigured()) return {};

  const spec = relevant
    .map((a) => {
      const constraint = a.selectionOnly && a.allowedValues.length ? ` (nur erlaubt: ${a.allowedValues.slice(0, 30).join(' | ')})` : '';
      return `- ${a.name}${a.required ? ' [Pflicht]' : ''}${constraint}`;
    })
    .join('\n');

  const out = await chatJson(
    'Du füllst eBay-Artikelmerkmale aus Produktdaten. Antworte NUR als JSON-Objekt {"<Merkmalname>": ["Wert", ...]}. ' +
      'Verwende exakt die vorgegebenen Merkmalnamen. Bei "nur erlaubt"-Merkmalen ausschließlich einen der erlaubten Werte verwenden. ' +
      'Erfinde nichts: Lässt sich ein Merkmal nicht aus den Daten ableiten, lass es weg (außer es ist Pflicht — dann den plausibelsten erlaubten Wert wählen).',
    `Produkt:\n${productSummary(p)}\n\nAuszufüllende Merkmale:\n${spec}`,
  );
  if (!out) return {};

  const result: Record<string, string[]> = {};
  const byName = new Map(relevant.map((a) => [a.name.toLowerCase(), a]));
  for (const [key, value] of Object.entries(out)) {
    const def = byName.get(key.toLowerCase());
    if (!def) continue;
    const values = (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean).slice(0, 8);
    const cleaned = def.selectionOnly && def.allowedValues.length
      ? values.filter((v) => def.allowedValues.some((a) => a.toLowerCase() === v.toLowerCase()))
      : values;
    if (cleaned.length) result[def.name] = cleaned;
  }
  return result;
}

/**
 * Full enrichment: category + aspects for a scraped product. Throws only if the
 * taxonomy lookup fails entirely; LLM hiccups degrade gracefully to eBay's own
 * top suggestion / empty aspects.
 */
export async function enrichProduct(ctx: TaxCtx, p: SyntroxProduct): Promise<EnrichResult> {
  const treeId = await getDefaultCategoryTreeId(ctx);
  const query = [p.title, p.brand].filter(Boolean).join(' ');
  const suggestions = await getCategorySuggestions(ctx, treeId, query || p.title);
  if (suggestions.length === 0) throw new Error('Keine eBay-Kategorie für dieses Produkt gefunden.');

  const category = await pickCategory(p, suggestions);
  const aspectDefs = await getItemAspectsForCategory(ctx, treeId, category.categoryId).catch(() => [] as AspectDef[]);
  const aspects = await fillAspects(p, aspectDefs);

  return {
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    categoryPath: category.path,
    aspects,
    llmUsed: enrichConfigured(),
  };
}

/**
 * eBay listing sync engine — shared by the cron endpoint and the manual
 * "Jetzt synchronisieren" button.
 *
 * New flow (Syntrox source): the sheet holds only SKUs. For each SKU we
 *   1. resolve + scrape the product on syntrox.de,
 *   2. gate on availability + A-Ware (A-grade) condition,
 *   3. enrich it with an LLM (eBay category + item specifics, grounded by the
 *      eBay Taxonomy API),
 *   4. create/update + optionally publish the offer on eBay.
 *
 * Diff-mode: a hash of the scraped product is stored per SKU, so unchanged,
 * already-listed items are skipped without re-calling the LLM or eBay. Every
 * SKU's outcome is written to ebay_listings so the dashboard can show precise
 * per-SKU status.
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accessTokenFromRefresh, type EbayEnv } from './oauth';
import { fetchSheetCsv, parseSkuList, type SheetProduct } from './sheet';
import { searchProductUrl, scrapeProduct, type SyntroxProduct } from './syntrox';
import { enrichProduct } from './enrich';
import { createOrReplaceInventoryItem, createOffer, findOfferId, publishOffer, updateOffer, type EbayContext, type OfferPolicies } from './api';

export interface SyncResult {
  ok: boolean;
  reason?: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
  errors: { sku: string; message: string }[];
  ranAt: string;
}

/** eBay wants a Content-Language matching the marketplace for inventory writes. */
function contentLanguageFor(marketplaceId: string): string {
  const map: Record<string, string> = {
    EBAY_DE: 'de-DE', EBAY_AT: 'de-AT', EBAY_CH: 'de-CH',
    EBAY_US: 'en-US', EBAY_GB: 'en-GB', EBAY_AU: 'en-AU', EBAY_CA: 'en-CA',
    EBAY_FR: 'fr-FR', EBAY_IT: 'it-IT', EBAY_ES: 'es-ES',
  };
  return map[marketplaceId] ?? 'en-US';
}

/** Stable hash of the scraped, listing-relevant fields (detects changed source data). */
function hashSource(p: SyntroxProduct, markup: number, qty: number): string {
  const canonical = JSON.stringify({
    t: p.title, d: p.description, pr: p.price, mk: markup, q: qty,
    img: p.images, e: p.ean ?? '', b: p.brand ?? '', s: p.specs,
  });
  return createHash('sha1').update(canonical).digest('hex');
}

function withMarkup(price: number, percent: number): number {
  const v = price * (1 + (percent || 0) / 100);
  return Math.round(v * 100) / 100;
}

function empty(reason?: string): SyncResult {
  return { ok: !reason, reason, created: 0, updated: 0, skipped: 0, failed: 0, total: 0, errors: [], ranAt: new Date().toISOString() };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a full sync for one user. `admin` must be the service-role client (the
 * cron runs without a session). Persists a summary to ebay_config.last_result.
 */
export async function syncEbayForUser(admin: SupabaseClient, userId: string): Promise<SyncResult> {
  const { data: config } = await admin.from('ebay_config').select('*').eq('user_id', userId).single();
  if (!config) return empty('Keine eBay-Konfiguration.');
  if (!config.enabled) return empty('Auto-Sync ist deaktiviert.');
  if (!config.sheet_csv_url) return empty('Keine SKU-Liste (Sheet-/CSV-URL) hinterlegt.');

  const { data: token } = await admin.from('ebay_tokens').select('refresh_token, environment').eq('user_id', userId).single();
  if (!token?.refresh_token) return empty('eBay-Konto nicht verbunden.');

  let accessToken: string;
  try {
    accessToken = await accessTokenFromRefresh(token.refresh_token);
  } catch (e) {
    return empty(`eBay-Login abgelaufen — bitte neu verbinden. (${(e as Error).message})`);
  }

  let skus: string[];
  try {
    skus = parseSkuList(await fetchSheetCsv(config.sheet_csv_url));
  } catch (e) {
    return empty((e as Error).message);
  }
  if (skus.length === 0) return empty('Keine SKUs in der Liste gefunden.');

  const env = (token.environment as EbayEnv) || 'production';
  const marketplaceId = config.marketplace_id || 'EBAY_DE';
  const ctx: EbayContext = {
    accessToken,
    env,
    marketplaceId,
    currency: config.currency || 'EUR',
    contentLanguage: contentLanguageFor(marketplaceId),
  };
  const taxCtx = { accessToken, env, marketplaceId };
  const policies: OfferPolicies = {
    categoryId: config.default_category_id || undefined,
    fulfillmentPolicyId: config.fulfillment_policy_id || undefined,
    paymentPolicyId: config.payment_policy_id || undefined,
    returnPolicyId: config.return_policy_id || undefined,
    merchantLocationKey: config.merchant_location_key || undefined,
  };
  const searchBase = config.syntrox_search_url || 'https://syntrox.de/search?qs=';
  const markup = Number(config.price_markup_percent) || 0;
  const qty = Math.max(1, Number(config.default_quantity) || 1);
  const requireAware = config.require_a_ware !== false;
  const useLlm = config.enrich_with_llm !== false;

  const { data: existingRows } = await admin.from('ebay_listings').select('sku, row_hash, offer_id, status').eq('user_id', userId);
  const existing = new Map((existingRows ?? []).map((r) => [r.sku as string, r]));

  const result = empty();
  result.total = skus.length;

  const setState = (sku: string, fields: Record<string, unknown>) =>
    admin.from('ebay_listings').upsert({ user_id: userId, sku, updated_at: new Date().toISOString(), ...fields }, { onConflict: 'user_id,sku' });

  for (const sku of skus) {
    try {
      // 1. Resolve + scrape on Syntrox.
      const url = await searchProductUrl(searchBase, sku);
      if (!url) {
        await setState(sku, { status: 'skipped', error: 'Auf syntrox.de nicht gefunden.', available: false });
        result.skipped++;
        continue;
      }
      const product = await scrapeProduct(url, sku);
      if (!product) {
        await setState(sku, { status: 'skipped', error: 'Produktseite nicht lesbar.', source_url: url, available: false });
        result.skipped++;
        continue;
      }

      // 2. Availability + A-Ware gate.
      if (!product.inStock) {
        await setState(sku, { status: 'skipped', error: `Nicht verfügbar (${product.availabilityText}).`, source_url: url, title: product.title, available: false });
        result.skipped++;
        continue;
      }
      if (requireAware && !product.aWare) {
        await setState(sku, { status: 'skipped', error: `Keine A-Ware (${product.availabilityText}).`, source_url: url, title: product.title, available: true });
        result.skipped++;
        continue;
      }
      if (product.price == null) {
        await setState(sku, { status: 'error', error: 'Kein Preis auf der Produktseite gefunden.', source_url: url, title: product.title, available: true });
        result.failed++;
        result.errors.push({ sku, message: 'Kein Preis gefunden.' });
        continue;
      }

      // 3. Diff: unchanged + already listed → skip (no LLM, no eBay call).
      const hash = hashSource(product, markup, qty);
      const prev = existing.get(sku);
      if (prev && prev.row_hash === hash && prev.status === 'listed') {
        result.skipped++;
        continue;
      }

      // 4. Enrich: eBay category + item specifics (LLM, grounded by Taxonomy API).
      let categoryId = config.default_category_id || undefined;
      let aspects: Record<string, string[]> = {};
      if (useLlm) {
        try {
          const enriched = await enrichProduct(taxCtx, product);
          categoryId = enriched.categoryId;
          aspects = enriched.aspects;
        } catch {
          // Enrichment failed — fall back to the configured default category.
          if (!categoryId) {
            await setState(sku, { status: 'error', error: 'Keine eBay-Kategorie gefunden (LLM/Taxonomy) und kein Default gesetzt.', source_url: url, title: product.title, available: true });
            result.failed++;
            result.errors.push({ sku, message: 'Keine Kategorie ermittelbar.' });
            continue;
          }
        }
      }

      // 5. Build the eBay listing product from scraped + enriched data.
      const listing: SheetProduct = {
        sku,
        title: product.title,
        description: product.description || product.title,
        price: withMarkup(product.price, markup),
        quantity: qty,
        currency: product.currency || ctx.currency,
        categoryId,
        condition: config.default_condition || 'NEW',
        brand: product.brand,
        ean: product.ean,
        images: product.images,
        aspects,
      };

      // 6. Push to eBay: inventory item → offer → (publish).
      await createOrReplaceInventoryItem(ctx, listing, config.default_condition || 'NEW');
      let offerId = (prev?.offer_id as string | undefined) ?? (await findOfferId(ctx, sku)) ?? undefined;
      if (offerId) await updateOffer(ctx, offerId, listing, policies);
      else offerId = await createOffer(ctx, listing, policies);

      let listingId: string | null = null;
      if (config.auto_publish) listingId = await publishOffer(ctx, offerId);

      await setState(sku, {
        title: listing.title,
        price: listing.price,
        row_hash: hash,
        offer_id: offerId,
        listing_id: listingId,
        category_id: categoryId ?? null,
        source_url: url,
        available: true,
        status: config.auto_publish ? 'listed' : 'pending',
        error: null,
        listed_at: listingId ? new Date().toISOString() : null,
      });
      if (prev) result.updated++;
      else result.created++;
    } catch (e) {
      const message = (e as Error).message.slice(0, 500);
      await setState(sku, { status: 'error', error: message });
      result.failed++;
      result.errors.push({ sku, message });
    }

    await sleep(350); // be polite to syntrox.de + stay under rate limits
  }

  await admin.from('ebay_config').update({ last_run_at: result.ranAt, last_result: result }).eq('user_id', userId);
  return result;
}

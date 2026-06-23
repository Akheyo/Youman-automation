/**
 * eBay listing sync engine — shared by the cron endpoint and the manual
 * "Jetzt synchronisieren" button.
 *
 * For one user: read the config + stored eBay token, pull the product CSV,
 * diff each row against the ebay_listings state store (so unchanged rows are
 * skipped), then create/update + optionally publish the offer on eBay. Every
 * SKU's outcome is written back to ebay_listings, so a failure on one product
 * never blocks the rest and the dashboard can show precise per-SKU status.
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accessTokenFromRefresh, type EbayEnv } from './oauth';
import { fetchSheetCsv, parseProductsCsv, type SheetProduct } from './sheet';
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

/** Stable hash of the listing-relevant fields, to detect changed sheet rows. */
function hashProduct(p: SheetProduct): string {
  const canonical = JSON.stringify({
    t: p.title, d: p.description ?? '', p: p.price, q: p.quantity, c: p.condition ?? '',
    cat: p.categoryId ?? '', cur: p.currency ?? '', b: p.brand ?? '', m: p.mpn ?? '',
    e: p.ean ?? '', img: p.images, a: p.aspects,
  });
  return createHash('sha1').update(canonical).digest('hex');
}

function empty(reason?: string): SyncResult {
  return { ok: !reason, reason, created: 0, updated: 0, skipped: 0, failed: 0, total: 0, errors: [], ranAt: new Date().toISOString() };
}

/**
 * Run a full sync for one user. `admin` must be the service-role client (the
 * cron runs without a session). Returns a summary and also persists it to
 * ebay_config.last_result.
 */
export async function syncEbayForUser(admin: SupabaseClient, userId: string): Promise<SyncResult> {
  const { data: config } = await admin.from('ebay_config').select('*').eq('user_id', userId).single();
  if (!config) return empty('Keine eBay-Konfiguration.');
  if (!config.enabled) return empty('Auto-Sync ist deaktiviert.');
  if (!config.sheet_csv_url) return empty('Keine Sheet-/CSV-URL hinterlegt.');

  const { data: token } = await admin.from('ebay_tokens').select('refresh_token, environment').eq('user_id', userId).single();
  if (!token?.refresh_token) return empty('eBay-Konto nicht verbunden.');

  let accessToken: string;
  try {
    accessToken = await accessTokenFromRefresh(token.refresh_token);
  } catch (e) {
    return empty(`eBay-Login abgelaufen — bitte neu verbinden. (${(e as Error).message})`);
  }

  let products: SheetProduct[];
  try {
    products = parseProductsCsv(await fetchSheetCsv(config.sheet_csv_url));
  } catch (e) {
    return empty((e as Error).message);
  }

  const ctx: EbayContext = {
    accessToken,
    env: (token.environment as EbayEnv) || 'production',
    marketplaceId: config.marketplace_id || 'EBAY_DE',
    currency: config.currency || 'EUR',
    contentLanguage: contentLanguageFor(config.marketplace_id || 'EBAY_DE'),
  };
  const policies: OfferPolicies = {
    categoryId: config.default_category_id || undefined,
    fulfillmentPolicyId: config.fulfillment_policy_id || undefined,
    paymentPolicyId: config.payment_policy_id || undefined,
    returnPolicyId: config.return_policy_id || undefined,
    merchantLocationKey: config.merchant_location_key || undefined,
  };

  const { data: existingRows } = await admin.from('ebay_listings').select('sku, row_hash, offer_id, status').eq('user_id', userId);
  const existing = new Map((existingRows ?? []).map((r) => [r.sku as string, r]));

  const result = empty();
  result.total = products.length;

  for (const product of products) {
    const hash = hashProduct(product);
    const prev = existing.get(product.sku);
    if (prev && prev.row_hash === hash && prev.status === 'listed') {
      result.skipped++;
      continue;
    }

    try {
      await createOrReplaceInventoryItem(ctx, product, config.default_condition || 'NEW');

      let offerId = (prev?.offer_id as string | undefined) ?? (await findOfferId(ctx, product.sku)) ?? undefined;
      if (offerId) await updateOffer(ctx, offerId, product, policies);
      else offerId = await createOffer(ctx, product, policies);

      let listingId: string | null = null;
      if (config.auto_publish) listingId = await publishOffer(ctx, offerId);

      await admin.from('ebay_listings').upsert(
        {
          user_id: userId,
          sku: product.sku,
          title: product.title,
          price: product.price,
          row_hash: hash,
          offer_id: offerId,
          listing_id: listingId,
          status: config.auto_publish ? 'listed' : 'pending',
          error: null,
          listed_at: listingId ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sku' },
      );
      if (prev) result.updated++;
      else result.created++;
    } catch (e) {
      const message = (e as Error).message.slice(0, 500);
      await admin.from('ebay_listings').upsert(
        {
          user_id: userId,
          sku: product.sku,
          title: product.title,
          price: product.price,
          row_hash: hash,
          offer_id: (prev?.offer_id as string | undefined) ?? null,
          status: 'error',
          error: message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sku' },
      );
      result.failed++;
      result.errors.push({ sku: product.sku, message });
    }
  }

  await admin
    .from('ebay_config')
    .update({ last_run_at: result.ranAt, last_result: result })
    .eq('user_id', userId);

  return result;
}

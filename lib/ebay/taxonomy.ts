/**
 * eBay Taxonomy API — grounds the LLM so it never invents a category id or an
 * aspect that eBay rejects.
 *
 *   getDefaultCategoryTreeId  → the category tree for a marketplace (EBAY_DE → 77)
 *   getCategorySuggestions    → eBay's own category suggestions for a query
 *   getItemAspectsForCategory → required/recommended item specifics + allowed values
 *
 * The LLM then (a) picks the best category among the suggestions and (b) fills
 * the aspect values from the scraped product, constrained to allowed values.
 */

import { ebayHosts, type EbayEnv } from './oauth';

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  /** Breadcrumb path like "Haushaltsgeräte > Küche > Eismaschinen". */
  path: string;
}

export interface AspectDef {
  name: string;
  required: boolean;
  /** SELECTION_ONLY aspects must use one of allowedValues; FREE_TEXT is open. */
  selectionOnly: boolean;
  allowedValues: string[];
}

interface TaxCtx {
  accessToken: string;
  env: EbayEnv;
  marketplaceId: string;
}

function base(ctx: TaxCtx): string {
  return `${ebayHosts(ctx.env).api}/commerce/taxonomy/v1`;
}

function headers(ctx: TaxCtx): Record<string, string> {
  return { Authorization: `Bearer ${ctx.accessToken}`, Accept: 'application/json' };
}

export async function getDefaultCategoryTreeId(ctx: TaxCtx): Promise<string> {
  const res = await fetch(`${base(ctx)}/get_default_category_tree_id?marketplace_id=${encodeURIComponent(ctx.marketplaceId)}`, {
    headers: headers(ctx),
  });
  if (!res.ok) throw new Error(`taxonomy tree-id: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { categoryTreeId: string };
  return data.categoryTreeId;
}

export async function getCategorySuggestions(ctx: TaxCtx, treeId: string, query: string): Promise<CategorySuggestion[]> {
  const res = await fetch(`${base(ctx)}/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(query.slice(0, 350))}`, {
    headers: headers(ctx),
  });
  if (!res.ok) throw new Error(`taxonomy suggestions: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    categorySuggestions?: { category: { categoryId: string; categoryName: string }; categoryTreeNodeAncestors?: { categoryName: string }[] }[];
  };
  return (data.categorySuggestions ?? []).slice(0, 8).map((s) => ({
    categoryId: s.category.categoryId,
    categoryName: s.category.categoryName,
    path: [...(s.categoryTreeNodeAncestors ?? []).map((a) => a.categoryName).reverse(), s.category.categoryName].join(' > '),
  }));
}

export async function getItemAspectsForCategory(ctx: TaxCtx, treeId: string, categoryId: string): Promise<AspectDef[]> {
  const res = await fetch(`${base(ctx)}/category_tree/${treeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`, {
    headers: headers(ctx),
  });
  if (!res.ok) throw new Error(`taxonomy aspects: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    aspects?: {
      localizedAspectName: string;
      aspectConstraint?: { aspectRequired?: boolean; aspectMode?: string };
      aspectValues?: { localizedValue: string }[];
    }[];
  };
  return (data.aspects ?? []).map((a) => ({
    name: a.localizedAspectName,
    required: Boolean(a.aspectConstraint?.aspectRequired),
    selectionOnly: a.aspectConstraint?.aspectMode === 'SELECTION_ONLY',
    allowedValues: (a.aspectValues ?? []).map((v) => v.localizedValue).slice(0, 60),
  }));
}

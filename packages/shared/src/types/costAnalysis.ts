/**
 * Cost analysis (Kostenanalyse) — a lightweight scenario calculator.
 *
 * Users capture cost items ("5 trucks × 45,000 EUR each") and savings items
 * ("bulk pallet purchase saves 12,000 EUR"), and the app shows the net effect
 * live as they edit. Scenarios are persisted per tenant so they can be reopened
 * and compared later.
 */

export type CostItemType = "cost" | "saving";

export interface CostItem {
  id: string;
  label: string;
  category?: string;
  /** Cost per unit (positive number, in the analysis' currency). */
  unitCost: number;
  quantity: number;
  type: CostItemType;
  note?: string;
}

export interface CostAnalysis {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  currency: string;
  items: CostItem[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Derived totals for a set of cost items. */
export interface CostAnalysisTotals {
  totalCosts: number;
  totalSavings: number;
  /** Positive = net additional cost, negative = net savings. */
  netEffect: number;
}

export function calculateCostTotals(items: CostItem[]): CostAnalysisTotals {
  let totalCosts = 0;
  let totalSavings = 0;
  for (const item of items) {
    const lineTotal = item.unitCost * item.quantity;
    if (item.type === "saving") totalSavings += lineTotal;
    else totalCosts += lineTotal;
  }
  return {
    totalCosts,
    totalSavings,
    netEffect: totalCosts - totalSavings,
  };
}

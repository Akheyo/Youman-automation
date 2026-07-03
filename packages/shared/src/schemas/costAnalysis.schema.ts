import { z } from "zod";

export const CostItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Bezeichnung erforderlich").max(200),
  category: z.string().max(80).optional(),
  unitCost: z.number().finite().min(0, "Betrag darf nicht negativ sein"),
  quantity: z.number().finite().min(0, "Menge darf nicht negativ sein"),
  type: z.enum(["cost", "saving"]),
  note: z.string().max(500).optional(),
});

export const CostAnalysisWriteSchema = z.object({
  title: z.string().min(1, "Titel erforderlich").max(200),
  description: z.string().max(2000).default(""),
  currency: z.string().length(3).default("EUR"),
  items: z.array(CostItemSchema).max(500),
});

export type CostItemInput = z.infer<typeof CostItemSchema>;
export type CostAnalysisWriteInput = z.infer<typeof CostAnalysisWriteSchema>;

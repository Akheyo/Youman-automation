import { z } from "zod";

export const ActionExecutionSchema = z.object({
  actionId: z.string().min(1),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  payload: z.record(z.unknown()),
  clientTimestamp: z.string().datetime(),
  offlineQueueId: z.string().optional(),
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(200),
  fields: z.array(z.string()).optional(),
  filters: z.record(z.unknown()).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const CreateCustomerSchema = z.object({
  customerNumber: z.string().optional(),
  name: z.string().min(1, "Name erforderlich").max(200),
  name2: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  taxNumber: z.string().max(50).optional(),
  vatId: z.string().max(50).optional(),
  currency: z.string().length(3).default("EUR"),
  paymentTerms: z.string().optional(),
  address: z.object({
    street: z.string().min(1, "Straße erforderlich"),
    streetNumber: z.string().optional(),
    zip: z.string().min(1, "PLZ erforderlich"),
    city: z.string().min(1, "Ort erforderlich"),
    countryCode: z.string().length(2).default("DE"),
    state: z.string().optional(),
  }),
});

export const CreateProductSchema = z.object({
  articleNumber: z.string().optional(),
  ean: z.string().max(20).optional(),
  designation: z.string().min(1, "Bezeichnung erforderlich").max(300),
  description: z.string().max(2000).optional(),
  manufacturer: z.string().max(200).optional(),
  manufacturerArticleNumber: z.string().max(100).optional(),
  category: z.string().optional(),
  unit: z.string().min(1).default("ST"),
  basePrice: z.number().min(0),
  currency: z.string().length(3).default("EUR"),
  taxClass: z.string().default("STANDARD"),
});

// The desktop form sends explicit `null` (and "") for empty optional fields
// (FormBuilder marks them .optional().nullable()). Treat null/"" as "not
// provided" so an optional string field isn't rejected for being null.
const optionalString = (schema: z.ZodString = z.string()) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

// <input type="date"> sends "YYYY-MM-DD"; some callers send full ISO datetimes.
// Accept both (and null/"" → undefined) instead of requiring a strict datetime.
const optionalDate = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  z
    .union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
);

/**
 * A quote must be creatable with the absolute minimum: a customer + at least
 * one position (article, quantity, price) + currency. Everything else
 * (delivery address, valid-until, per-line delivery date, notes, and the
 * customer's number/name which the backend resolves from customerId) is
 * optional and must never block submission.
 */
export const CreateQuoteSchema = z.object({
  customerId: z.string().min(1, "Kunde erforderlich"),
  customerNumber: optionalString(),
  customerName: optionalString(),
  deliveryAddressId: optionalString(),
  currency: z.string().length(3).default("EUR"),
  validUntil: optionalDate,
  lineItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        articleNumber: optionalString(),
        designation: optionalString(),
        quantity: z.number().positive("Menge muss größer als 0 sein"),
        unit: z.string().default("ST"),
        pricePerUnit: z.number().min(0),
        discount: z.number().min(0).max(100).optional(),
        deliveryDate: optionalDate,
        notes: optionalString(z.string().max(2000)),
      })
    )
    .min(1, "Mindestens eine Position erforderlich"),
  notes: optionalString(z.string().max(2000)),
});

export const CreateFollowUpSchema = z.object({
  title: z.string().min(1, "Titel erforderlich").max(300),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedToId: z.string().optional(),
  relatedCustomerId: z.string().optional(),
  relatedQuoteId: z.string().optional(),
});

export const CreateAppointmentSchema = z.object({
  title: z.string().min(1, "Titel erforderlich").max(300),
  description: z.string().max(2000).optional(),
  startAt: z.string().datetime({ message: "Ungültiger Startzeitpunkt" }),
  endAt: z.string().datetime({ message: "Ungültiger Endzeitpunkt" }),
  location: z.string().max(300).optional(),
  customerId: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export const CreateNoteSchema = z.object({
  content: z.string().min(1, "Inhalt erforderlich").max(5000),
  customerId: z.string().optional(),
  productId: z.string().optional(),
  quoteId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type ActionExecutionDto = z.infer<typeof ActionExecutionSchema>;
export type SearchRequestDto = z.infer<typeof SearchRequestSchema>;
export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type CreateQuoteDto = z.infer<typeof CreateQuoteSchema>;
export type CreateFollowUpDto = z.infer<typeof CreateFollowUpSchema>;
export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
export type CreateNoteDto = z.infer<typeof CreateNoteSchema>;

import { z } from "zod";

/**
 * Slug ist der eindeutige Firmen-Kurzname im Login (z.B. "amikon").
 * Nur Kleinbuchstaben, Ziffern und Bindestriche, damit er als URL-/DB-Schlüssel taugt.
 */
export const TenantSlugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche erlaubt");

export const CreateTenantRequestSchema = z.object({
  companyName: z.string().min(1).max(200),
  slug: TenantSlugSchema,
  plan: z.enum(["starter", "professional", "enterprise"]).default("starter"),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
  // Mindestlänge analog zur bestehenden Demo-Nutzerpolitik; erzwingt kein
  // Sonderzeichen-Schema, weil der erste Admin das Passwort selbst wählt/ändert.
  adminPassword: z.string().min(8).max(200),
});

export type CreateTenantRequestDto = z.infer<typeof CreateTenantRequestSchema>;

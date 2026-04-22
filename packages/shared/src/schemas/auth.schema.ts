import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
  tenantSlug: z
    .string()
    .min(2, "Tenant-Slug erforderlich")
    .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh Token erforderlich"),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Passwort muss Groß-, Kleinbuchstaben und Zahlen enthalten"
      ),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

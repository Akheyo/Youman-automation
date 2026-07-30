import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
  apiPrefix: "api/v1",
  /** Schlüssel für plattformweite Mandanten-Provisionierung (nicht gesetzt = Endpunkt deaktiviert). */
  platformAdminKey: process.env.PLATFORM_ADMIN_KEY,
}));

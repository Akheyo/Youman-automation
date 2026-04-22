import { registerAs } from "@nestjs/config";

export default registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET ?? "CHANGE_ME_IN_PRODUCTION_USE_STRONG_SECRET_32CHARS_MIN",
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY ?? "1h",
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY ?? "30d",
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? "CHANGE_ME_REFRESH_SECRET_32CHARS_MIN",
}));

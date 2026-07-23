import { describe, expect, it } from "vitest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { AuthError, NotFoundError, RateLimitError, ValidationError, NotSupportedError } from "@youman/connector-plenty";
import { mapExceptionToApiError } from "../errors/error-mapper";

const CID = "test-correlation-id";

describe("mapExceptionToApiError", () => {
  it("maps Plenty AuthError to 502/ERP_AUTH_FAILED without leaking internals", () => {
    const mapped = mapExceptionToApiError(
      new AuthError("Plenty-API lehnt Authentifizierung dauerhaft ab (POST /accounts/contacts)"),
      CID
    );
    expect(mapped.status).toBe(502);
    expect(mapped.code).toBe("ERP_AUTH_FAILED");
    expect(mapped.message).toContain("Administration");
    expect(mapped.message).not.toContain("/accounts/contacts");
    expect(mapped.logAsError).toBe(false);
  });

  it("maps RateLimitError to 429 with retryAfterSeconds", () => {
    const mapped = mapExceptionToApiError(new RateLimitError("limit", 42), CID);
    expect(mapped.status).toBe(429);
    expect(mapped.code).toBe("RATE_LIMIT");
    expect(mapped.retryAfterSeconds).toBe(42);
  });

  it("maps NotFoundError to 404/NOT_FOUND", () => {
    const mapped = mapExceptionToApiError(new NotFoundError("Plenty-Ressource nicht gefunden: GET /x"), CID);
    expect(mapped.status).toBe(404);
    expect(mapped.code).toBe("NOT_FOUND");
  });

  it("passes ValidationError message and fieldErrors through (user-facing)", () => {
    const mapped = mapExceptionToApiError(
      new ValidationError("E-Mail bereits vergeben", { email: ["bereits vergeben"] }),
      CID
    );
    expect(mapped.status).toBe(422);
    expect(mapped.code).toBe("VALIDATION_FAILED");
    expect(mapped.message).toBe("E-Mail bereits vergeben");
    expect(mapped.fields).toEqual({ email: ["bereits vergeben"] });
  });

  it("maps NotSupportedError to 501/NOT_SUPPORTED", () => {
    const mapped = mapExceptionToApiError(new NotSupportedError("createNote", "kein Notiz-Konzept"), CID);
    expect(mapped.status).toBe(501);
    expect(mapped.code).toBe("NOT_SUPPORTED");
  });

  it("classifies network errors (ECONNREFUSED/ETIMEDOUT) as ERP_UNREACHABLE", () => {
    for (const code of ["ECONNREFUSED", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND"]) {
      const err = Object.assign(new Error(`connect ${code} 10.0.0.1:443`), { code });
      const mapped = mapExceptionToApiError(err, CID);
      expect(mapped.status).toBe(502);
      expect(mapped.code).toBe("ERP_UNREACHABLE");
      expect(mapped.message).not.toContain("10.0.0.1");
    }
  });

  it("turns unknown errors into INTERNAL_ERROR with correlationId, never leaking stack/SQL/paths", () => {
    const nasty = new Error(
      'SELECT * FROM users WHERE password="geheim" – at /app/apps/backend/dist/src/main.js:42'
    );
    const mapped = mapExceptionToApiError(nasty, CID);
    expect(mapped.status).toBe(500);
    expect(mapped.code).toBe("INTERNAL_ERROR");
    expect(mapped.message).toContain(CID);
    for (const forbidden of ["SELECT", "password", "geheim", "/app/", "main.js"]) {
      expect(mapped.message).not.toContain(forbidden);
      expect(JSON.stringify(mapped.details ?? {})).not.toContain(forbidden);
      expect(JSON.stringify(mapped.fields ?? {})).not.toContain(forbidden);
    }
    // Original bleibt fürs Log erhalten:
    expect(mapped.internal).toContain("SELECT");
    expect(mapped.logAsError).toBe(true);
  });

  it("keeps HttpException semantics (BadRequest -> VALIDATION_FAILED)", () => {
    const mapped = mapExceptionToApiError(new BadRequestException("Eingaben ungültig – name: erforderlich"), CID);
    expect(mapped.status).toBe(400);
    expect(mapped.code).toBe("VALIDATION_FAILED");
    expect(mapped.message).toContain("name");
  });

  it("maps 401 HttpException to AUTH_FAILED", () => {
    const mapped = mapExceptionToApiError(new UnauthorizedException("Ungültige Zugangsdaten"), CID);
    expect(mapped.status).toBe(401);
    expect(mapped.code).toBe("AUTH_FAILED");
  });
});

import { HttpException, HttpStatus } from "@nestjs/common";
import { ZodError } from "zod";
import { ERROR_CODES } from "@youman/shared";

/** Ergebnis der zentralen Fehlerklassifikation für den ExceptionFilter. */
export interface MappedError {
  status: number;
  code: string;
  /** Deutsche, endnutzertaugliche Meldung – enthält NIE technische Interna. */
  message: string;
  /** Feldbezogene Fehlermeldungen (Anzeige am Formularfeld). */
  fields?: Record<string, string[]>;
  /** Nutzer-relevante strukturierte Zusatzdaten (whitelisted, nie Roh-Fehler). */
  details?: Record<string, unknown>;
  /** Sekunden bis zum nächsten sinnvollen Versuch (Retry-After-Header). */
  retryAfterSeconds?: number;
  /** Original-Fehlertext – wird ausschließlich GELOGGT, nie gesendet. */
  internal: string;
  /** true = mit Stacktrace als error loggen, false = als warn. */
  logAsError: boolean;
}

/** Duck-Typing: Fehlerobjekte der Connectoren tragen einen String-`code`. */
function errorCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

function fieldErrorsOf(err: unknown): Record<string, string[]> | undefined {
  const fe = (err as { fieldErrors?: unknown } | null)?.fieldErrors;
  if (fe && typeof fe === "object" && !Array.isArray(fe)) {
    return fe as Record<string, string[]>;
  }
  return undefined;
}

/** Node-/Axios-Fehlercodes, die "Gegenstelle nicht erreichbar" bedeuten. */
const NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EPIPE",
  "ERR_NETWORK",
  "ERR_CANCELED",
]);

/**
 * Übersetzt jeden Fehler in genau einen maschinenlesbaren Code + deutsche
 * Meldung. Wird vom GlobalExceptionFilter für ALLE Routen benutzt, damit
 * Lese- (Suche) und Schreibpfad (Aktionen) identisch klassifizieren.
 *
 * Wichtig: `message` und `details` dürfen niemals Stacktraces, SQL-Fehler,
 * Dateipfade oder Credentials enthalten – der Original-Fehler landet nur in
 * `internal` (Log).
 */
export function mapExceptionToApiError(exception: unknown, correlationId: string): MappedError {
  // 1) Bewusst geworfene HTTP-Fehler (Validierung, Auth, Business) durchreichen.
  if (exception instanceof HttpException) {
    return mapHttpException(exception);
  }

  // 1b) Rohe Zod-Validierungsfehler (Controller rufen z.B. XSchema.parse(body)
  // direkt auf) sind ein normaler 400-Eingabefehler, kein Serverfehler.
  if (exception instanceof ZodError) {
    const fields = exception.flatten().fieldErrors as Record<string, string[]>;
    return {
      status: HttpStatus.BAD_REQUEST,
      code: ERROR_CODES.VALIDATION_FAILED,
      message: "Eingaben ungültig. Bitte die markierten Felder prüfen.",
      fields,
      internal: exception.message,
      logAsError: false,
    };
  }

  const code = errorCode(exception);
  const internal = exception instanceof Error ? exception.message : String(exception);

  // 2) Typisierte Connector-Fehler (Plenty heute, SAP analog über Codes).
  if (code) {
    if (code.endsWith("_AUTH_ERROR")) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        code: ERROR_CODES.ERP_AUTH_FAILED,
        message: "Die Zugangsdaten zum ERP-System sind ungültig oder abgelaufen. Bitte in der Administration prüfen.",
        internal,
        logAsError: false,
      };
    }
    if (code.endsWith("_RATE_LIMIT")) {
      const retryAfterSeconds = (exception as { retryAfterSeconds?: number }).retryAfterSeconds;
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: ERROR_CODES.RATE_LIMIT,
        message: "Das ERP-Limit ist erreicht. Es wird automatisch erneut versucht.",
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        internal,
        logAsError: false,
      };
    }
    if (code.endsWith("_NOT_FOUND")) {
      return {
        status: HttpStatus.NOT_FOUND,
        code: ERROR_CODES.NOT_FOUND,
        message: "Der angeforderte Datensatz wurde im ERP-System nicht gefunden.",
        internal,
        logAsError: false,
      };
    }
    if (code.endsWith("_VALIDATION")) {
      // Validierungsmeldungen der Connectoren sind bewusst nutzerlesbar
      // formuliert (z. B. E-Mail bereits vergeben) und werden durchgereicht.
      const fields = fieldErrorsOf(exception);
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: internal,
        ...(fields ? { fields } : {}),
        internal,
        logAsError: false,
      };
    }
    if (code.endsWith("_NOT_SUPPORTED")) {
      return {
        status: HttpStatus.NOT_IMPLEMENTED,
        code: ERROR_CODES.NOT_SUPPORTED,
        message: internal,
        internal,
        logAsError: false,
      };
    }
    if (code.endsWith("_UNREACHABLE") || NETWORK_CODES.has(code)) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        code: ERROR_CODES.ERP_UNREACHABLE,
        message: "Das ERP-System ist gerade nicht erreichbar. Bitte später erneut versuchen.",
        internal,
        logAsError: false,
      };
    }
    if (code.endsWith("_SERVER_ERROR") || code.endsWith("_HTTP_ERROR")) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        code: ERROR_CODES.ERP_ERROR,
        message: "Das ERP-System hat mit einem Fehler geantwortet. Bitte später erneut versuchen.",
        internal,
        logAsError: true,
      };
    }
  }

  // 3) Unbekannt: generisch, mit Kennung – Original nur ins Log.
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: `Es ist ein Fehler aufgetreten. Kennung: ${correlationId}`,
    internal,
    logAsError: true,
  };
}

function mapHttpException(exception: HttpException): MappedError {
  const status = exception.getStatus();
  const exRes = exception.getResponse();
  let message = exception.message;
  let code: string | undefined;
  let details: Record<string, unknown> | undefined;
  let fields: Record<string, string[]> | undefined;

  if (typeof exRes === "object" && exRes !== null) {
    const r = exRes as Record<string, unknown>;
    if (typeof r["message"] === "string") message = r["message"];
    if (typeof r["code"] === "string") code = r["code"];
    // class-validator liefert message als String-Array.
    if (Array.isArray(r["message"])) {
      message = "Eingaben ungültig. Bitte die markierten Felder prüfen.";
      details = { errors: r["message"] };
    }
    // Typisierte Fehler (z. B. MissingFieldsError) tragen eine Feldliste.
    if (Array.isArray(r["fields"])) {
      details = { ...details, fields: r["fields"] };
    }
    if (r["fieldErrors"] && typeof r["fieldErrors"] === "object" && !Array.isArray(r["fieldErrors"])) {
      fields = r["fieldErrors"] as Record<string, string[]>;
    }
  } else if (typeof exRes === "string") {
    message = exRes;
  }

  if (!code) {
    if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY) {
      code = ERROR_CODES.VALIDATION_FAILED;
    } else if (status === HttpStatus.UNAUTHORIZED) {
      code = ERROR_CODES.AUTH_FAILED;
    } else if (status === HttpStatus.NOT_FOUND) {
      code = ERROR_CODES.NOT_FOUND;
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      code = ERROR_CODES.RATE_LIMIT;
    } else {
      code = `HTTP_${status}`;
    }
  }

  return {
    status,
    code,
    message,
    ...(fields ? { fields } : {}),
    ...(details ? { details } : {}),
    internal: message,
    logAsError: status >= 500,
  };
}

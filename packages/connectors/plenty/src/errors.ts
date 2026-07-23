/**
 * Typed errors for the Plentymarkets connector.
 * All errors carry a machine-readable `code` so backend layers can map them
 * to HTTP responses without string-matching messages.
 */

export class PlentyConnectorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Login/refresh failed or the API rejected our token permanently. */
export class AuthError extends PlentyConnectorError {
  constructor(message: string) {
    super("PLENTY_AUTH_ERROR", message);
  }
}

/** Rate limit exhausted and retries did not recover. */
export class RateLimitError extends PlentyConnectorError {
  /** Seconds until the limit period decays, if the API told us. */
  readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super("PLENTY_RATE_LIMIT", message);
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Requested resource (contact, variation, order, …) does not exist. */
export class NotFoundError extends PlentyConnectorError {
  constructor(message: string) {
    super("PLENTY_NOT_FOUND", message);
  }
}

/** Plenty rejected the payload; `fieldErrors` holds per-field messages. */
export class ValidationError extends PlentyConnectorError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super("PLENTY_VALIDATION", message);
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Transport-Ebene: Plenty ist nicht erreichbar (Netzwerkfehler, Timeout, DNS).
 * Wird vom Backend auf ERP_UNREACHABLE gemappt (Offline-Queue/Retry statt 500).
 */
export class ConnectionError extends PlentyConnectorError {
  constructor(message: string) {
    super("PLENTY_UNREACHABLE", message);
  }
}

/** Plenty antwortet dauerhaft mit 5xx (nach erschöpften Wiederholungen). */
export class ServerError extends PlentyConnectorError {
  constructor(message: string) {
    super("PLENTY_SERVER_ERROR", message);
  }
}

/** IErpConnector operation that has no sensible Plentymarkets equivalent. */
export class NotSupportedError extends PlentyConnectorError {
  constructor(operation: string, reason: string) {
    super("PLENTY_NOT_SUPPORTED", `Operation '${operation}' wird vom Plentymarkets-Connector nicht unterstützt: ${reason}`);
  }
}

/**
 * Plenty validation errors arrive as an object keyed by field name, e.g.
 *   { "error": { "code": 422, "message": "..." },
 *     "validation_errors": { "typeId": ["The type id field is required."] } }
 * or directly as { "typeId": ["..."], "plentyId": ["..."] }.
 * Normalize any of those shapes into a ValidationError with a readable message.
 */
export function toValidationError(body: unknown, fallbackMessage: string): ValidationError {
  const fieldErrors: Record<string, string[]> = {};

  const collect = (obj: Record<string, unknown>): void => {
    for (const [field, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        fieldErrors[field] = value as string[];
      } else if (typeof value === "string") {
        fieldErrors[field] = [value];
      }
    }
  };

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const nested = b["validation_errors"] ?? b["validationErrors"] ?? b["errors"];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      collect(nested as Record<string, unknown>);
    }
    if (Object.keys(fieldErrors).length === 0) {
      collect(b);
    }
  }

  const parts = Object.entries(fieldErrors).map(([field, msgs]) => `${field}: ${msgs.join("; ")}`);
  const message = parts.length > 0 ? `Plenty-Validierungsfehler – ${parts.join(" | ")}` : fallbackMessage;
  return new ValidationError(message, fieldErrors);
}

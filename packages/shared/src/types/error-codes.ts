/**
 * Zentrale, maschinenlesbare Fehlercodes für die gesamte Plattform.
 * Das Backend setzt sie im GlobalExceptionFilter, der Desktop-Client
 * übersetzt sie über eine Mapping-Tabelle in deutsche Meldungen mit
 * Handlungsempfehlung. Neue Codes hier ergänzen – niemals freie Strings
 * zwischen Backend und Client austauschen.
 */
export const ERROR_CODES = {
  /** ERP nicht erreichbar (Netzwerkfehler, Timeout, DNS). */
  ERP_UNREACHABLE: "ERP_UNREACHABLE",
  /** ERP-Zugangsdaten ungültig oder dauerhaft abgelehnt. */
  ERP_AUTH_FAILED: "ERP_AUTH_FAILED",
  /** ERP antwortet mit 5xx bzw. unerwartetem Fehler. */
  ERP_ERROR: "ERP_ERROR",
  /** Rate-Limit des ERP erschöpft (nach Backoff-Versuchen). */
  RATE_LIMIT: "RATE_LIMIT",
  /** Ressource (Kunde, Artikel, …) existiert nicht. */
  NOT_FOUND: "NOT_FOUND",
  /** Eingaben abgelehnt – `error.fields` enthält Feldfehler. */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /** Operation wird vom konfigurierten Connector nicht unterstützt. */
  NOT_SUPPORTED: "NOT_SUPPORTED",
  /** Keine Dokumentvorlage für den Dokumenttyp hinterlegt. */
  TEMPLATE_MISSING: "TEMPLATE_MISSING",
  /** PDF-/Dokumenterzeugung fehlgeschlagen (DOCX-Fallback nutzen). */
  DOCUMENT_RENDER_FAILED: "DOCUMENT_RENDER_FAILED",
  /** Eigenes Backend nicht erreichbar (nur clientseitig gesetzt). */
  BACKEND_UNREACHABLE: "BACKEND_UNREACHABLE",
  /** Login/Session am eigenen Backend abgelaufen oder ungültig. */
  AUTH_FAILED: "AUTH_FAILED",
  /** Unklassifizierter Fehler – Meldung enthält die correlationId. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

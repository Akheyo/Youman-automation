import axios from "axios";
import type { ApiError } from "@youman/shared";

/** Aufbereiteter Fehler für UI-Anzeige und Feld-Zuordnung. */
export interface DescribedError {
  /** Maschinenlesbarer Code (ERROR_CODES aus @youman/shared bzw. HTTP_<n>). */
  code: string;
  /** Deutsche Meldung mit Handlungsempfehlung. */
  message: string;
  /** Kennung zur Korrelation mit den Server-Logs. */
  correlationId?: string | undefined;
  /** Feldbezogene Fehlermeldungen (Anzeige am Formularfeld). */
  fields?: Record<string, string[]> | undefined;
  /** true, wenn das eigene Backend nicht erreichbar war (Netzwerk, Kaltstart). */
  backendUnreachable: boolean;
}

/**
 * Zentrale Übersetzung error.code -> deutsche Meldung mit Handlungsempfehlung.
 * Der generische Fallback wird NUR verwendet, wenn kein Code gemappt werden
 * kann, und nennt dann immer die Kennung (correlationId).
 */
const MESSAGES: Record<string, string> = {
  ERP_UNREACHABLE:
    "Das ERP-System ist gerade nicht erreichbar. Die Aktion wurde gespeichert und wird automatisch erneut versucht.",
  ERP_AUTH_FAILED: "Die Zugangsdaten zum ERP sind ungültig. Bitte in der Administration prüfen.",
  ERP_ERROR: "Das ERP-System hat mit einem Fehler geantwortet. Bitte später erneut versuchen.",
  RATE_LIMIT: "Das ERP-Limit ist erreicht. Es wird automatisch erneut versucht.",
  TEMPLATE_MISSING: "Für diesen Dokumenttyp ist keine Vorlage hinterlegt.",
  DOCUMENT_RENDER_FAILED: "Das PDF konnte nicht erstellt werden. Bitte das DOCX verwenden.",
  BACKEND_UNREACHABLE: "Der Server ist nicht erreichbar oder startet gerade. Bitte kurz warten.",
  NOT_FOUND: "Der angeforderte Datensatz wurde nicht gefunden.",
  NOT_SUPPORTED: "Diese Funktion wird vom konfigurierten ERP-System nicht unterstützt.",
  AUTH_FAILED: "Ihre Sitzung ist abgelaufen oder die Zugangsdaten sind ungültig. Bitte erneut anmelden.",
};

export function describeApiError(err: unknown): DescribedError {
  if (axios.isAxiosError(err)) {
    // Netzwerkfehler (keine HTTP-Antwort): Backend down oder Render-Kaltstart.
    // Das ist KEIN fachlicher Fehler und wird als solcher benannt.
    if (!err.response) {
      return {
        code: "BACKEND_UNREACHABLE",
        message: MESSAGES["BACKEND_UNREACHABLE"]!,
        backendUnreachable: true,
      };
    }

    const data = err.response.data as ApiError | undefined;
    const apiError = data?.error;
    const code = apiError?.code ?? `HTTP_${err.response.status}`;
    const correlationId = apiError?.correlationId ?? data?.requestId;

    // VALIDATION_FAILED trägt die konkrete (nutzerlesbare) Serverme­ldung und
    // ggf. Feldfehler – die Meldung des Servers ist hier präziser als jede Map.
    if (code === "VALIDATION_FAILED" && apiError?.message) {
      return {
        code,
        message: apiError.message,
        correlationId,
        fields: apiError.fields,
        backendUnreachable: false,
      };
    }

    const mapped = MESSAGES[code];
    if (mapped) {
      return { code, message: mapped, correlationId, fields: apiError?.fields, backendUnreachable: false };
    }

    // Kein gemappter Code: Servermeldung verwenden, wenn vorhanden – sonst
    // generisch MIT Kennung (niemals eine nackte „unbekannter Fehler"-Meldung).
    if (apiError?.message) {
      return { code, message: apiError.message, correlationId, fields: apiError.fields, backendUnreachable: false };
    }
    return {
      code,
      message: correlationId
        ? `Es ist ein Fehler aufgetreten. Kennung: ${correlationId}`
        : "Es ist ein Fehler aufgetreten. Bitte erneut versuchen.",
      correlationId,
      backendUnreachable: false,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    code: "CLIENT_ERROR",
    message: message || "Es ist ein Fehler aufgetreten. Bitte erneut versuchen.",
    backendUnreachable: false,
  };
}

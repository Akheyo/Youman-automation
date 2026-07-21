import axios from "axios";
import { apiClient } from "./api";
import type { ExecutionDocumentInfo } from "@youman/shared";

export class DocumentRenderError extends Error {
  readonly missingFields: string[];

  constructor(message: string, missingFields: string[] = []) {
    super(message);
    this.name = "DocumentRenderError";
    this.missingFields = missingFields;
  }
}

const DOC_TYPE_FILENAME: Record<string, string> = {
  OFFER: "Angebot",
  INVOICE: "Rechnung",
  ORDER_CONFIRMATION: "Auftragsbestaetigung",
  DELIVERY_NOTE: "Lieferschein",
  OTHER: "Dokument",
};

/**
 * Renders the document on the backend and hands it to the user – via the
 * Electron save dialog when available, otherwise as a browser download.
 * Throws DocumentRenderError with the uncovered placeholder list on 422.
 */
export async function downloadDocument(
  info: ExecutionDocumentInfo,
  format: "docx" | "pdf",
  referenceNumber?: string
): Promise<void> {
  if (!info.templateId) {
    throw new DocumentRenderError(info.hint ?? "Keine Vorlage hinterlegt.");
  }
  let content: ArrayBuffer;
  try {
    const res = await apiClient.post<ArrayBuffer>(
      `/templates/${info.templateId}/render`,
      { data: info.data },
      { params: { format }, responseType: "arraybuffer" }
    );
    content = res.data;
  } catch (err) {
    throw toRenderError(err);
  }

  const base = DOC_TYPE_FILENAME[info.documentType] ?? "Dokument";
  const fileName = `${base}${referenceNumber ? `-${referenceNumber}` : ""}.${format}`;

  if (window.adept?.documents?.save) {
    const base64 = arrayBufferToBase64(content);
    await window.adept.documents.save(fileName, base64);
    return;
  }
  // Browser fallback (dev mode)
  const blob = new Blob([content], {
    type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toRenderError(err: unknown): DocumentRenderError {
  if (axios.isAxiosError(err) && err.response) {
    // responseType arraybuffer → error body arrives as bytes and needs decoding
    let body: unknown = err.response.data;
    if (body instanceof ArrayBuffer) {
      try {
        body = JSON.parse(new TextDecoder().decode(body));
      } catch {
        body = undefined;
      }
    }
    const parsed = body as { error?: { message?: string; details?: { fields?: string[] } } } | undefined;
    const message = parsed?.error?.message ?? "Dokument konnte nicht erstellt werden.";
    const fields = parsed?.error?.details?.fields ?? [];
    return new DocumentRenderError(message, fields);
  }
  return new DocumentRenderError(err instanceof Error ? err.message : "Dokument konnte nicht erstellt werden.");
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** German labels for the placeholder names, used in error lists. */
export function describePlaceholder(field: string): string {
  const map: Record<string, string> = {
    angebotsnummer: "Angebotsnummer",
    datum: "Datum",
    anrede: "Anrede",
    ansprechpartner: "Ansprechpartner",
    kunde_name: "Kundenname",
    kunde_adresse: "Kundenadresse",
    zwischensumme: "Zwischensumme",
    rabatt: "Rabatt",
    endbetrag: "Endbetrag",
    lieferdatum: "Lieferdatum",
    zahlungsart: "Zahlungsart",
    zahlungsziel: "Zahlungsziel",
    versandart: "Versandart",
    positionen: "Positionen",
  };
  if (field.startsWith("positionen.")) {
    return `Positionen → ${field.split(".")[1]}`;
  }
  return map[field] ?? field;
}

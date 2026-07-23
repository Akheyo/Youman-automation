import { toast } from "@/hooks/useToast";

/**
 * Globale Auffangnetze im Renderer: unbehandelte Fehler und Promise-
 * Rejections werden protokolliert und als Toast angezeigt statt still
 * verschluckt zu werden. Gegen Toast-Stürme (z. B. ein Fehler in einem
 * Render-Loop) wird pro Meldungstext höchstens alle 10 s ein Toast gezeigt.
 */
const recentMessages = new Map<string, number>();
const TOAST_DEDUPE_MS = 10_000;

function shouldToast(message: string): boolean {
  const now = Date.now();
  const last = recentMessages.get(message);
  if (last !== undefined && now - last < TOAST_DEDUPE_MS) return false;
  recentMessages.set(message, now);
  // Map klein halten
  if (recentMessages.size > 50) {
    for (const [key, ts] of recentMessages) {
      if (now - ts > TOAST_DEDUPE_MS) recentMessages.delete(key);
    }
  }
  return true;
}

function describe(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return typeof reason === "string" ? reason : "Unbekannter Fehler";
}

export function registerGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    console.error("[global error]", event.error ?? event.message);
    const msg = describe(event.error ?? event.message);
    if (shouldToast(msg)) {
      toast({
        title: "Unerwarteter Fehler",
        description: "Ein Fehler wurde abgefangen – die Anwendung läuft weiter.",
        variant: "error",
      });
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[global unhandledrejection]", event.reason);
    const msg = describe(event.reason);
    if (shouldToast(msg)) {
      toast({
        title: "Unerwarteter Fehler",
        description: "Ein Hintergrundvorgang ist fehlgeschlagen – die Anwendung läuft weiter.",
        variant: "error",
      });
    }
    // Verhindert Electrons Default-Ausgabe als 'Uncaught (in promise)'.
    event.preventDefault();
  });
}

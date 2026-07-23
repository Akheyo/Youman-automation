import { QueryClient, QueryCache } from "@tanstack/react-query";
import { toast } from "./hooks/useToast";
import { describeApiError } from "./services/errorMessages";

/**
 * QueryClient-Fabrik – von App (main.tsx) UND Smoke-Tests genutzt, damit die
 * Tests exakt die Produktions-Konfiguration prüfen (globaler Error-Handler,
 * Retry-Regeln) und nicht eine Test-Sonderlocke.
 */
const recentQueryErrors = new Map<string, number>();
const QUERY_ERROR_DEDUPE_MS = 30_000;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    // Unsichtbar-Regel: Query-Fehler laufen NICHT durch unhandledrejection
    // (React Query fängt sie intern) – ohne diesen Cache-Handler wäre jeder
    // useQuery-Fehler ohne lokale isError-Auswertung komplett stumm.
    queryCache: new QueryCache({
      onError: (error, query) => {
        const described = describeApiError(error);
        console.error(`[query:${String(query.queryKey[0])}]`, described.code, error);
        // Session-Ablauf meldet api.ts selbst (Toast + Redirect) – nicht doppeln.
        if (described.code === "AUTH_FAILED") return;
        const now = Date.now();
        const last = recentQueryErrors.get(described.message);
        if (last !== undefined && now - last < QUERY_ERROR_DEDUPE_MS) return;
        recentQueryErrors.set(described.message, now);
        toast({ title: "Daten konnten nicht geladen werden", description: described.message, variant: "error" });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if ((error as { status?: number })?.status === 401) return false;
          if ((error as { status?: number })?.status === 403) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

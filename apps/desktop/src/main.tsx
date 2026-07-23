import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { toast } from "./hooks/useToast";
import { describeApiError } from "./services/errorMessages";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerGlobalErrorHandlers } from "./globalErrorHandlers";
import { router } from "./router";
import "./styles/globals.css";

// Unbehandelte Fehler/Rejections: protokollieren + Toast statt stillem Schlucken.
registerGlobalErrorHandlers();

// Unsichtbar-Regel: Query-Fehler laufen NICHT durch unhandledrejection (React
// Query fängt sie intern) – ohne diesen Cache-Handler wäre jeder useQuery-
// Fehler ohne lokale isError-Auswertung komplett stumm. Dedupe pro Meldung,
// damit ein 5-Sekunden-Polling keinen Toast-Sturm erzeugt.
const recentQueryErrors = new Map<string, number>();
const QUERY_ERROR_DEDUPE_MS = 30_000;

const queryClient = new QueryClient({
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Äußerste Fehlergrenze: selbst ein Fehler im Router/Layout zeigt eine
        bedienbare Fallback-UI statt eines weißen Fensters. */}
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "./queryClient";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerGlobalErrorHandlers } from "./globalErrorHandlers";
import { router } from "./router";
import "./styles/globals.css";

// Unbehandelte Fehler/Rejections: protokollieren + Toast statt stillem Schlucken.
registerGlobalErrorHandlers();

const queryClient = createAppQueryClient();

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

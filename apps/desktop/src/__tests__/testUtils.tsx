import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { vi } from "vitest";
import { createAppRouter } from "../router";
import { createAppQueryClient } from "../queryClient";
import { Toaster } from "../components/ui/toaster";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useAuthStore } from "../stores/authStore";
import { LOGIN_RESPONSE, TENANT, USER } from "./mocks/fixtures";

/**
 * Rendert die App EXAKT wie main.tsx (gleiche Fabriken, gleiche Provider),
 * damit die Smoke-Tests die Produktions-Konfiguration prüfen.
 */
interface RenderAppResult extends ReturnType<typeof render> {
  router: ReturnType<typeof createAppRouter>;
  queryClient: ReturnType<typeof createAppQueryClient>;
}

export function renderApp(): RenderAppResult {
  const router = createAppRouter();
  const queryClient = createAppQueryClient();
  const utils = render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
  return { ...utils, router, queryClient };
}

/** Setzt eine gültige Session in den Store (wie nach erfolgreichem Login). */
export function seedSession(): void {
  useAuthStore.getState().setAuth(
    USER as never,
    TENANT as never,
    LOGIN_RESPONSE.accessToken,
    LOGIN_RESPONSE.refreshToken
  );
}

export function clearSession(): void {
  useAuthStore.getState().logout();
}

/** Vollständiger window.adept-Stub (Electron-Preload-API) für Tests. */
export function stubElectronBridge() {
  const documentsSave = vi.fn(async (fileName: string) => `C:/Users/Demo/Downloads/${fileName}`);
  const bridge = {
    queue: {
      enqueue: vi.fn(async (item: unknown) => ({ ...(item as Record<string, unknown>), id: "q-1", clientId: "c-1", status: "pending", createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 3 })),
      getAll: vi.fn(async () => []),
      getPending: vi.fn(async () => []),
      markSynced: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    },
    credentials: { set: vi.fn(), get: vi.fn(async () => null), delete: vi.fn() },
    app: {
      getVersion: vi.fn(async () => "9.9.9-test"),
      openExternal: vi.fn(async () => undefined),
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      checkOnline: vi.fn(async () => true),
      checkForUpdates: vi.fn(async () => undefined),
      installUpdate: vi.fn(async () => undefined),
    },
    pdf: { open: vi.fn(async () => undefined), download: vi.fn(async () => undefined) },
    documents: { save: documentsSave },
    on: vi.fn(),
    off: vi.fn(),
  };
  (window as unknown as { adept: unknown }).adept = bridge;
  return { bridge, documentsSave };
}

export function removeElectronBridge(): void {
  delete (window as unknown as { adept?: unknown }).adept;
}

/** Wartet, bis ein Text sichtbar ist (mit brauchbarer Standard-Wartezeit). */
export async function seeText(matcher: string | RegExp, timeout = 8000) {
  return waitFor(() => screen.getByText(matcher), { timeout });
}

export const user = () => userEvent.setup();

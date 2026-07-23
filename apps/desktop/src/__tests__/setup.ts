import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server";
import { dismissAllToasts } from "../hooks/useToast";

// MSW: alle HTTP-Aufrufe laufen gegen den Mock-Server; unbekannte Requests
// sind ein Testfehler (damit kein Weg unbemerkt am Mock vorbeigeht).
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
  // Globale Zustand-Stores dürfen nicht in den nächsten Test lecken.
  dismissAllToasts();
});
afterAll(() => server.close());

// jsdom hat kein matchMedia – von Toast/Styles ungenutzt, aber sicher ist sicher.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom implementiert scrollIntoView nicht (von Dropdowns benutzt).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, API } from "./mocks/server";
import { ACTION_DEFINITIONS } from "./mocks/fixtures";
import { renderApp, seedSession, clearSession, stubElectronBridge, removeElectronBridge, user } from "./testUtils";

/**
 * ZUSTANDSMATRIX (Teil 1 des Auftrags): Jeder Zustand wird tatsächlich
 * herbeigeführt (manipulierte Responses) und das definierte Verhalten belegt.
 * Kernregel: Die App zeigt verständlich, was los ist – nichts hängt, nichts
 * wirkt tot, kein Fehler sieht wie Erfolg aus.
 */

beforeEach(() => {
  stubElectronBridge();
  window.location.hash = "#/dashboard";
});

afterEach(() => {
  clearSession();
  removeElectronBridge();
  window.location.hash = "#/";
  vi.restoreAllMocks();
});

describe("Session-Zustände", () => {
  it("Access gültig: Dashboard lädt die Aktionen", async () => {
    seedSession();
    renderApp();
    await screen.findByText("Wählen Sie eine Aktion aus, um zu beginnen.", undefined, { timeout: 8000 });
    const select = await screen.findByRole("combobox");
    expect(select).toHaveTextContent("Angebot erstellen");
    expect(select).toHaveTextContent("Kunden anlegen");
  });

  it("Access abgelaufen, Refresh gültig: Request wird nach EINEM Refresh transparent wiederholt", async () => {
    seedSession();
    let refreshCalls = 0;
    server.use(
      http.get(`${API}/actions/definitions`, ({ request }) => {
        if (request.headers.get("Authorization") === "Bearer access-token-2") {
          return HttpResponse.json(ACTION_DEFINITIONS);
        }
        return HttpResponse.json({ error: { code: "AUTH_FAILED", message: "abgelaufen" } }, { status: 401 });
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: "access-token-2", refreshToken: "refresh-token-2" });
      })
    );
    renderApp();
    const select = await screen.findByRole("combobox", undefined, { timeout: 8000 });
    expect(select).toHaveTextContent("Angebot erstellen");
    expect(refreshCalls).toBe(1);
  });

  it("Refresh-Race: mehrere gleichzeitige 401er teilen sich EINEN Refresh (Single-Flight)", async () => {
    seedSession();
    let refreshCalls = 0;
    const guard = (ok: () => Response | Promise<Response>) => ({ request }: { request: Request }) => {
      if (request.headers.get("Authorization") === "Bearer access-token-2") return ok();
      return HttpResponse.json({ error: { code: "AUTH_FAILED", message: "abgelaufen" } }, { status: 401 });
    };
    server.use(
      // Zwei parallele Requests beim Mount: definitions (Dashboard) + status (Sync)
      http.get(`${API}/actions/definitions`, guard(() => HttpResponse.json(ACTION_DEFINITIONS))),
      http.get(`${API}/queue/status`, guard(() =>
        HttpResponse.json({ isOnline: true, lastSyncAt: null, pendingCount: 0, failedCount: 0, processingCount: 0, successCount: 0, isSyncing: false })
      )),
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 150)); // Race-Fenster offen halten
        return HttpResponse.json({ accessToken: "access-token-2", refreshToken: "refresh-token-2" });
      })
    );
    renderApp();
    await screen.findByRole("combobox", undefined, { timeout: 8000 });
    // Ohne Single-Flight wären es 2 Refreshes – der zweite hätte (bei
    // Token-Rotation) die frische Session wieder gekillt.
    expect(refreshCalls).toBe(1);
  });

  it("[der gemeldete Bug] Access abgelaufen + Refresh abgelehnt: sichtbare Meldung + Login-Screen, nichts bleibt stehen", async () => {
    seedSession();
    server.use(
      http.get(`${API}/actions/definitions`, () =>
        HttpResponse.json({ error: { code: "AUTH_FAILED", message: "abgelaufen" } }, { status: 401 })
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ error: { code: "AUTH_FAILED", message: "Ungültiger Refresh Token" } }, { status: 401 })
      )
    );
    renderApp();
    // Meldung ist Pflicht – der Sessionverlust darf nie stumm sein:
    await screen.findByText("Sitzung abgelaufen", undefined, { timeout: 8000 });
    // Und die App steht auf dem Login, nicht auf einer toten Oberfläche:
    await waitFor(() => expect(window.location.hash).toContain("/login"), { timeout: 8000 });
    await screen.findByText(/Anmelden/, undefined, { timeout: 8000 });
  });

  it("[TOT-Pfad] Session läuft ab, während ein SCHMUTZIGES Formular offen ist: Blocker hält den Login-Redirect NICHT auf", async () => {
    seedSession();
    window.location.hash = "#/action/action-create-customer";
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false); // Nutzer würde "bleiben" wählen
    renderApp();

    // Formular laden und VOLLSTÄNDIG ausfüllen (sonst stoppt die Client-
    // Validierung das Absenden und der 401-Pfad liefe nie):
    const u = user();
    await screen.findByText("Firmenname", undefined, { timeout: 8000 });
    await u.type(fieldInput("Firmenname"), "Testfirma GmbH");
    await u.type(fieldInput("Straße"), "Hauptstraße");
    await u.type(fieldInput("PLZ"), "10115");
    await u.type(fieldInput("Ort"), "Berlin");

    // Jetzt läuft die Session ab (alle Requests 401, Refresh tot):
    server.use(
      http.post(`${API}/actions/execute`, () =>
        HttpResponse.json({ error: { code: "AUTH_FAILED", message: "abgelaufen" } }, { status: 401 })
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ error: { code: "AUTH_FAILED", message: "tot" } }, { status: 401 })
      )
    );
    // Absenden löst den 401-Pfad aus:
    await u.click(screen.getByRole("button", { name: /Kunden anlegen/ }));

    // Früher: confirm() fing den Redirect ab -> Nutzer saß auf totem Formular.
    // Jetzt: Blocker greift bei Session-Ablauf nicht, App landet sichtbar am Login.
    await screen.findByText("Sitzung abgelaufen", undefined, { timeout: 8000 });
    await waitFor(() => expect(window.location.hash).toContain("/login"), { timeout: 8000 });
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe("Backend-Zustände", () => {
  it("Backend 500 auf definitions: Dashboard zeigt Fehlerzustand mit 'Erneut laden' – kein leeres Dropdown", async () => {
    seedSession();
    let calls = 0;
    server.use(
      http.get(`${API}/actions/definitions`, () => {
        calls += 1;
        if (calls <= 3) return HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "kaputt" } }, { status: 500 });
        return HttpResponse.json(ACTION_DEFINITIONS);
      })
    );
    renderApp();
    await screen.findByRole("button", { name: /Erneut laden/ }, { timeout: 10_000 });
    // Erneut laden führt aus dem Fehlerzustand heraus:
    await user().click(screen.getByRole("button", { name: /Erneut laden/ }));
    const select = await screen.findByRole("combobox", undefined, { timeout: 8000 });
    expect(select).toHaveTextContent("Angebot erstellen");
  });

  it("Backend gar nicht erreichbar (Netzwerkfehler): Fehlerzustand statt normal aussehender leerer Seite", async () => {
    seedSession();
    server.use(http.get(`${API}/actions/definitions`, () => HttpResponse.error()));
    renderApp();
    // Kaltstart-Retry (2,5 s) + Query-Retries laufen durch – danach MUSS ein
    // sichtbarer Fehlerzustand stehen:
    await screen.findByRole("button", { name: /Erneut laden/ }, { timeout: 15_000 });
  }, 20_000);

  it("Kaltstart: erster Request scheitert, automatischer zweiter Versuch nach kurzer Wartezeit gelingt", async () => {
    seedSession();
    let calls = 0;
    server.use(
      http.get(`${API}/actions/definitions`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error(); // Server schläft noch
        return HttpResponse.json(ACTION_DEFINITIONS);
      })
    );
    renderApp();
    const select = await screen.findByRole("combobox", undefined, { timeout: 10_000 });
    expect(select).toHaveTextContent("Angebot erstellen");
    expect(calls).toBeGreaterThanOrEqual(2);
  }, 15_000);
});

describe("App-Zustände", () => {
  it("Warteschlangen-Ladefehler sieht NIE wie 'alles erledigt' aus", async () => {
    seedSession();
    window.location.hash = "#/queue";
    server.use(
      http.get(`${API}/queue/items`, () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "kaputt" } }, { status: 500 })
      )
    );
    renderApp();
    await screen.findByRole("button", { name: /Erneut laden/ }, { timeout: 10_000 });
    expect(screen.queryByText("Alle Aktionen wurden erfolgreich verarbeitet.")).not.toBeInTheDocument();
  });

  it("Protokoll-Ladefehler sieht NIE wie ein leeres Protokoll aus", async () => {
    seedSession();
    window.location.hash = "#/audit";
    server.use(
      http.get(`${API}/audit`, () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "kaputt" } }, { status: 500 })
      )
    );
    renderApp();
    await screen.findByRole("button", { name: /Erneut laden/ }, { timeout: 10_000 });
  });

  it("Kunden-Suchfehler heißt 'Suche fehlgeschlagen', nicht 'Keine Ergebnisse'", async () => {
    seedSession();
    window.location.hash = "#/action/action-create-quote";
    server.use(
      http.get(`${API}/search/customers`, () =>
        HttpResponse.json({ error: { code: "ERP_UNREACHABLE", message: "Plenty down" } }, { status: 502 })
      )
    );
    renderApp();
    const u = user();
    const input = await screen.findByPlaceholderText(/Kunde suchen/, undefined, { timeout: 8000 });
    await u.type(input, "Berg");
    await screen.findByText(/Suche fehlgeschlagen/, undefined, { timeout: 10_000 });
    expect(screen.queryByText(/Keine Ergebnisse/)).not.toBeInTheDocument();
  });
});

/** Liest das Eingabefeld zu einem (nicht per htmlFor verknüpften) Label. */
function fieldInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  const container = label.closest("div");
  const input = container?.querySelector("input");
  if (!input) throw new Error(`Kein Input für Label '${labelText}' gefunden`);
  return input as HTMLInputElement;
}

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, API } from "./mocks/server";
import { CUSTOMER_EXECUTION, LOGIN_RESPONSE, QUOTE_EXECUTION } from "./mocks/fixtures";
import { renderApp, seedSession, clearSession, stubElectronBridge, removeElectronBridge, user } from "./testUtils";

/**
 * SMOKE-TESTREIHE (Teil 4 des Auftrags): die kompletten Nutzerwege gegen
 * Mocks – bricht einer dieser Wege, darf kein Release entstehen.
 * Fachliche Grenze: Es wird nur BEOBACHTET, was die Flows senden/zeigen –
 * die Logik selbst (Mapping, Nummern, Dokumente) bleibt unangetastet.
 */

let bridge: ReturnType<typeof stubElectronBridge>;

beforeEach(() => {
  bridge = stubElectronBridge();
});

afterEach(() => {
  clearSession();
  removeElectronBridge();
  window.location.hash = "#/";
});

/** Eingabefeld zu einem (nicht per htmlFor verknüpften) Label. */
function fieldInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  const input = label.closest("div")?.querySelector("input");
  if (!input) throw new Error(`Kein Input für Label '${labelText}' gefunden`);
  return input as HTMLInputElement;
}

function fieldSelect(labelText: string): HTMLSelectElement {
  const label = screen.getByText(labelText);
  const select = label.closest("div")?.querySelector("select");
  if (!select) throw new Error(`Kein Select für Label '${labelText}' gefunden`);
  return select as HTMLSelectElement;
}

/** Fängt den nächsten /actions/execute-Body ab und antwortet mit `response`. */
function captureExecute(response: object) {
  const captured: {
    body?: { actionId: string; payload: Record<string, unknown>; idempotencyKey?: string } | undefined;
  } = {};
  server.use(
    http.post(`${API}/actions/execute`, async ({ request }) => {
      captured.body = (await request.json()) as typeof captured.body;
      return HttpResponse.json(response);
    })
  );
  return captured;
}

describe("Nutzerweg 1: Login → Dashboard → Aktion öffnen", () => {
  it("meldet sich an, sieht die Aktionsliste und öffnet das Angebotsformular", async () => {
    window.location.hash = "#/login";
    renderApp();
    const u = user();

    await u.type(await screen.findByPlaceholderText("z.B. mein-unternehmen"), "demo");
    await u.type(screen.getByPlaceholderText("name@firma.de"), "admin@demo.adept.de");
    await u.type(screen.getByPlaceholderText("••••••••"), "Admin123!");
    await u.click(screen.getByRole("button", { name: /^Anmelden$/ }));

    // Dashboard mit beiden Aktionen:
    const select = await screen.findByRole("combobox", undefined, { timeout: 8000 });
    expect(select).toHaveTextContent("Angebot erstellen");
    expect(select).toHaveTextContent("Kunden anlegen");

    // Aktion öffnen:
    window.location.hash = "#/action/action-create-quote";
    await screen.findByPlaceholderText(/Kunde suchen/, undefined, { timeout: 8000 });
  });

  /**
   * Beweis für den gemeldeten Bug: Render-Free-Tier schläft ein, der
   * allererste Login eines neuen Kunden trifft einen kalten Server. Vor dem
   * Fix wurde Login (POST) NIE automatisch wiederholt (nur GET) – die App
   * zeigte fälschlich "falsches Passwort", obwohl die Zugangsdaten korrekt
   * waren. Login hat keine Nebenwirkung, ein Retry ist also gefahrlos.
   */
  it("Kaltstart beim Login: erster Versuch scheitert am schlafenden Server, automatischer zweiter Versuch meldet an", async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/auth/login`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error(); // Server schläft noch
        return HttpResponse.json(LOGIN_RESPONSE);
      })
    );
    window.location.hash = "#/login";
    renderApp();
    const u = user();

    await u.type(await screen.findByPlaceholderText("z.B. mein-unternehmen"), "demo");
    await u.type(screen.getByPlaceholderText("name@firma.de"), "admin@demo.adept.de");
    await u.type(screen.getByPlaceholderText("••••••••"), "Admin123!");
    await u.click(screen.getByRole("button", { name: /^Anmelden$/ }));

    // Trotz gescheitertem ersten Versuch: Login gelingt automatisch beim zweiten.
    await screen.findByRole("combobox", undefined, { timeout: 10_000 });
    expect(calls).toBeGreaterThanOrEqual(2);
  }, 15_000);
});

describe("Nutzerweg 2: Angebot erstellen", () => {
  it("Kunde suchen, Artikel suchen, Position ausfüllen, absenden, Panel + DOCX-Download", async () => {
    seedSession();
    window.location.hash = "#/action/action-create-quote";
    const captured = captureExecute(QUOTE_EXECUTION);
    renderApp();
    const u = user();

    // Kunde suchen und wählen:
    const kunde = await screen.findByPlaceholderText(/Kunde suchen/, undefined, { timeout: 8000 });
    await u.type(kunde, "Berg");
    await u.click(await screen.findByText("Bergmann Handels GmbH", undefined, { timeout: 8000 }));

    // Position hinzufügen und Artikel per Suche wählen:
    await u.click(screen.getByRole("button", { name: /Position hinzufügen/ }));
    const artikel = await screen.findByPlaceholderText("Artikel suchen...");
    await u.type(artikel, "TRK-500");
    await u.click(await screen.findByText("Trekkingrucksack Fjell 50 L schwarz", undefined, { timeout: 8000 }));

    // Menge/Preis der Position setzen (leere Zahlenfelder der Zeile füllen):
    const row = artikel.closest("tr") ?? artikel.closest("div[class*='grid']") ?? document.body;
    const numberInputs = within(row as HTMLElement).queryAllByRole("spinbutton");
    for (const input of numberInputs) {
      const el = input as HTMLInputElement;
      if (!el.value) await u.type(el, el === numberInputs[0] ? "1" : "74.9");
    }

    // Absenden:
    await u.click(screen.getByRole("button", { name: /Angebot erstellen/ }));

    // Erfolgs-Panel mit Angebotsnummer:
    await screen.findByText(/Angebot erstellen erfolgreich/, undefined, { timeout: 8000 });
    await screen.findByText(/2026-0001/);
    expect(captured.body?.actionId).toBe("action-create-quote");
    expect(captured.body?.payload["customerId"]).toBe("118");
    expect(captured.body?.idempotencyKey).toBeTruthy();

    // DOCX-Download funktioniert (Render-Endpoint + lokales Speichern):
    await u.click(screen.getByRole("button", { name: /DOCX herunterladen/ }));
    await waitFor(() => expect(bridge.documentsSave).toHaveBeenCalled(), { timeout: 8000 });
    expect(String(bridge.documentsSave.mock.calls[0]?.[0])).toContain("2026-0001");
    await screen.findByText(/Dokument gespeichert/, undefined, { timeout: 8000 });
  }, 30_000);
});

describe("Nutzerweg 3+4: Kunde anlegen", () => {
  it("als Firma: Firmenname + Ansprechpartner, absenden, Erfolg", async () => {
    seedSession();
    window.location.hash = "#/action/action-create-customer";
    const captured = captureExecute(CUSTOMER_EXECUTION("Testfirma GmbH"));
    renderApp();
    const u = user();

    await screen.findByText("Firmenname", undefined, { timeout: 8000 });
    await u.type(fieldInput("Firmenname"), "Testfirma GmbH");
    await u.type(fieldInput("Ansprechpartner (Vorname)"), "Erika");
    await u.type(fieldInput("Ansprechpartner (Nachname)"), "Musterfrau");
    await u.type(fieldInput("Straße"), "Hauptstraße");
    await u.type(fieldInput("PLZ"), "10115");
    await u.type(fieldInput("Ort"), "Berlin");
    await u.click(screen.getByRole("button", { name: /Kunden anlegen/ }));

    await screen.findByText("Erfolgreich", undefined, { timeout: 8000 });
    expect(captured.body?.payload["customerType"]).toBe("company");
    expect(captured.body?.payload["name"]).toBe("Testfirma GmbH");
    expect(captured.body?.payload["contactFirstName"]).toBe("Erika");
    expect(captured.body?.payload["contactLastName"]).toBe("Musterfrau");
  }, 30_000);

  it("als Privatperson: Vor-/Nachname statt Firmenfelder, absenden, Erfolg", async () => {
    seedSession();
    window.location.hash = "#/action/action-create-customer";
    const captured = captureExecute(CUSTOMER_EXECUTION("Max Mustermann"));
    renderApp();
    const u = user();

    await screen.findByText("Kundentyp", undefined, { timeout: 8000 });
    await u.selectOptions(fieldSelect("Kundentyp"), "person");

    // Personen-Felder erscheinen, Firmenfelder verschwinden:
    await screen.findByText("Vorname", undefined, { timeout: 8000 });
    expect(screen.queryByText("Firmenname")).not.toBeInTheDocument();

    await u.type(fieldInput("Vorname"), "Max");
    await u.type(fieldInput("Nachname"), "Mustermann");
    await u.type(fieldInput("Straße"), "Nebenweg");
    await u.type(fieldInput("PLZ"), "50667");
    await u.type(fieldInput("Ort"), "Köln");
    await u.click(screen.getByRole("button", { name: /Kunden anlegen/ }));

    await screen.findByText("Erfolgreich", undefined, { timeout: 8000 });
    expect(captured.body?.payload["customerType"]).toBe("person");
    expect(captured.body?.payload["firstName"]).toBe("Max");
    expect(captured.body?.payload["lastName"]).toBe("Mustermann");
  }, 30_000);
});

describe("Nutzerweg 5: Protokoll", () => {
  it("zeigt den Eintrag inklusive Dokument-Download", async () => {
    seedSession();
    window.location.hash = "#/audit";
    renderApp();
    await screen.findByText(/action-create-quote/, undefined, { timeout: 8000 });
    // Der Eintrag trägt ein Dokument – der Download-Button muss da sein:
    await screen.findByRole("button", { name: /DOCX/ });
  });
});

describe("Nutzerweg 6: Administration", () => {
  it("lädt Vorlagen und Connector-Konfiguration", async () => {
    seedSession();
    window.location.hash = "#/admin";
    renderApp();
    const u = user();

    await screen.findByText("Allgemeine Einstellungen", undefined, { timeout: 8000 });

    await u.click(screen.getByRole("button", { name: /Dokumentvorlagen/ }));
    await screen.findByText("Angebot Standard", undefined, { timeout: 8000 });

    await u.click(screen.getByRole("button", { name: /Connector/ }));
    await waitFor(
      () => expect(screen.getByDisplayValue("https://demo.my.plentysystems.com")).toBeInTheDocument(),
      { timeout: 8000 }
    );
  }, 30_000);
});

import { describe, expect, it, vi } from "vitest";
import type { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from "axios";
import { SapODataConnector } from "../adapters/SapODataConnector";
import type { SapConfig } from "../types/SapConfig";

/**
 * Tests für die SAP-Grundhärtung: typisierte Fehlercodes (Suffix-Konvention
 * des zentralen Backend-Mappers), CSRF-Erneuerung bei 403 und GET-Retry für
 * transiente Fehler. Fachliche Abfragen/Mappings sind unangetastet.
 */

const CONFIG: SapConfig = {
  baseUrl: "https://sap.example.com/odata",
  client: "100",
  auth: { type: "basic", username: "u", password: "p" },
} as SapConfig;

type Responder = (cfg: InternalAxiosRequestConfig, call: number) => {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
};

/** Axios-Adapter-Fake: beantwortet Requests per Skript, zählt Aufrufe. */
function makeAdapter(respond: Responder) {
  let calls = 0;
  const adapter: AxiosAdapter = async (cfg) => {
    calls += 1;
    const r = respond(cfg as InternalAxiosRequestConfig, calls);
    const response = {
      status: r.status,
      statusText: String(r.status),
      data: r.data ?? {},
      headers: r.headers ?? {},
      config: cfg,
    };
    if (r.status >= 400) {
      const err = new Error(`Request failed with status code ${r.status}`) as AxiosError;
      err.isAxiosError = true;
      err.config = cfg as InternalAxiosRequestConfig;
      err.response = response as never;
      throw err;
    }
    return response as never;
  };
  return { adapter, calls: () => calls };
}

const instantSleep = vi.fn(async () => undefined);

function connector(respond: Responder, config: SapConfig = CONFIG) {
  const { adapter, calls } = makeAdapter(respond);
  return { sap: new SapODataConnector("tenant-1", config, { adapter, sleep: instantSleep }), calls };
}

const emptyResult = { d: { results: [], __count: "0" } };

describe("SapODataConnector – typisierte Fehler", () => {
  it.each([
    [401, "SAP_AUTH_ERROR"],
    [404, "SAP_NOT_FOUND"],
    [429, "SAP_RATE_LIMIT"],
    [422, "SAP_VALIDATION"],
    [400, "SAP_VALIDATION"],
  ])("HTTP %i wird als %s klassifiziert", async (status, code) => {
    const { sap } = connector(() => ({ status }));
    const err = await sap.searchCustomers({ query: "x" }).catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe(code);
  });

  it("5xx wird nach erschöpften GET-Retries als SAP_SERVER_ERROR klassifiziert", async () => {
    const { sap, calls } = connector(() => ({ status: 500 }));
    const err = await sap.searchCustomers({ query: "x" }).catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe("SAP_SERVER_ERROR");
    expect(calls()).toBe(3); // Erstversuch + 2 Retries
  });

  it("SAP-Fehlertext aus dem OData-Body bleibt erhalten", async () => {
    const { sap } = connector(() => ({
      status: 422,
      data: { error: { code: "ZX/042", message: { value: "Kunde bereits vorhanden" } } },
    }));
    const err = await sap.searchCustomers({ query: "x" }).catch((e: unknown) => e);
    expect((err as Error).message).toBe("Kunde bereits vorhanden");
  });
});

describe("SapODataConnector – GET-Retry für transiente Fehler", () => {
  it("wiederholt GET bei 5xx und liefert dann das Ergebnis", async () => {
    const { sap, calls } = connector((_cfg, call) =>
      call < 3 ? { status: 503 } : { status: 200, data: emptyResult }
    );
    const result = await sap.searchCustomers({ query: "x" });
    expect(result.total).toBe(0);
    expect(calls()).toBe(3);
  });
});

describe("SapODataConnector – CSRF-Erneuerung", () => {
  it("holt bei 403 mit CSRF-Hinweis einen frischen Token und wiederholt genau einmal", async () => {
    const seen: string[] = [];
    const { sap, calls } = connector((cfg, call) => {
      const url = String(cfg.url ?? "");
      seen.push(`${call}:${String(cfg.method).toUpperCase()} ${url}`);
      // 1. Aufruf: initialer Token-Fetch (GET / mit X-CSRF-Token: Fetch)
      if (String(cfg.headers?.["X-CSRF-Token"]) === "Fetch") {
        return { status: 200, headers: { "x-csrf-token": call === 1 ? "alt" : "frisch" } };
      }
      // Mutation mit altem Token: CSRF-Ablauf simulieren
      if (String(cfg.headers?.["X-CSRF-Token"]) === "alt") {
        return { status: 403, data: "CSRF token validation failed", headers: { "x-csrf-token": "required" } };
      }
      // Mutation mit frischem Token: Erfolg
      return { status: 200, data: { d: { TaskId: "T-1" } } };
    });

    const result = await sap.createFollowUpTask({
      tenantId: "tenant-1",
      userId: "u-1",
      title: "Anruf",
      dueDate: "2027-02-01",
      priority: "medium",
      status: "open",
      source: "youman",
    } as Parameters<typeof sap.createFollowUpTask>[0]);

    expect(result).toBeTruthy();
    // Ablauf: Token-Fetch, POST(alt)->403, Token-Refetch, POST(frisch)->200
    expect(calls()).toBe(4);
  });

  it("bricht bei dauerhaftem CSRF-403 mit SAP_AUTH_ERROR ab (kein Endlos-Loop)", async () => {
    const { sap, calls } = connector((cfg) => {
      if (String(cfg.headers?.["X-CSRF-Token"]) === "Fetch") {
        return { status: 200, headers: { "x-csrf-token": "egal" } };
      }
      return { status: 403, data: "CSRF token validation failed" };
    });
    const err = await sap
      .createFollowUpTask({
        tenantId: "tenant-1", userId: "u-1", title: "x", dueDate: "2027-02-01",
        priority: "medium", status: "open", source: "youman",
      } as Parameters<typeof sap.createFollowUpTask>[0])
      .catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe("SAP_AUTH_ERROR");
    expect(calls()).toBeLessThanOrEqual(4);
  });
});

describe("SapODataConnector – unimplementierte Auth-Typen", () => {
  it("scheitert laut mit SAP_AUTH_ERROR statt still unauthentifiziert zu senden", async () => {
    const { sap, calls } = connector(() => ({ status: 200, data: emptyResult }), {
      ...CONFIG,
      auth: { type: "oauth2" },
    } as SapConfig);
    const err = await sap.searchCustomers({ query: "x" }).catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe("SAP_AUTH_ERROR");
    expect((err as Error).message).toContain("oauth2");
    expect(calls()).toBe(0); // kein Request verlässt die App
  });
});

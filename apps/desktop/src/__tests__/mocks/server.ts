import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  ACTION_DEFINITIONS,
  AUDIT_PAGE,
  CONNECTOR_CONFIG,
  CUSTOMER_EXECUTION,
  CUSTOMER_SEARCH,
  LOGIN_RESPONSE,
  PRODUCT_SEARCH,
  QUOTE_EXECUTION,
  SYNC_STATUS,
  TEMPLATES,
  TENANT,
} from "./fixtures";

export const API = "http://localhost:3001/api/v1";

/**
 * Standard-Handler: das Backend im Normalzustand ("erreichbar und wach").
 * Einzelne Tests überschreiben gezielt Routen (server.use(...)), um die
 * Zustandsmatrix herbeizuführen (401, 500, Netzwerkfehler, Kaltstart, …).
 */
export const handlers = [
  http.get(`${API}/health`, () =>
    HttpResponse.json({ status: "ok", version: "1.0.0", apiContract: 2, db: { healthy: true } })
  ),
  http.post(`${API}/auth/login`, () => HttpResponse.json(LOGIN_RESPONSE)),
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ accessToken: "access-token-2", refreshToken: "refresh-token-2" })
  ),
  http.post(`${API}/auth/logout`, () => HttpResponse.json({ ok: true })),

  http.get(`${API}/actions/definitions`, () => HttpResponse.json(ACTION_DEFINITIONS)),
  http.post(`${API}/actions/execute`, async ({ request }) => {
    const body = (await request.json()) as { actionId: string; payload: Record<string, unknown> };
    if (body.actionId === "action-create-quote") return HttpResponse.json(QUOTE_EXECUTION);
    if (body.actionId === "action-create-customer") {
      const p = body.payload;
      const name =
        p["customerType"] === "person"
          ? `${String(p["firstName"] ?? "")} ${String(p["lastName"] ?? "")}`.trim()
          : String(p["name"] ?? "");
      return HttpResponse.json(CUSTOMER_EXECUTION(name));
    }
    return HttpResponse.json({ ...QUOTE_EXECUTION, actionId: body.actionId });
  }),

  http.get(`${API}/search/customers`, () => HttpResponse.json(CUSTOMER_SEARCH)),
  http.get(`${API}/search/products`, () => HttpResponse.json(PRODUCT_SEARCH)),
  http.get(`${API}/search/customers/:id/addresses`, () => HttpResponse.json([])),

  http.get(`${API}/queue/status`, () => HttpResponse.json(SYNC_STATUS)),
  http.get(`${API}/queue/items`, () => HttpResponse.json([])),
  http.post(`${API}/queue/sync`, () => HttpResponse.json({ queued: 0, skipped: 0 })),

  http.get(`${API}/audit`, () => HttpResponse.json(AUDIT_PAGE)),
  http.get(`${API}/templates`, () => HttpResponse.json(TEMPLATES)),
  http.post(`${API}/templates/:id/render`, () => new HttpResponse(new ArrayBuffer(64), { status: 200 })),

  http.get(`${API}/tenants/settings`, () => HttpResponse.json(TENANT.settings)),
  http.get(`${API}/tenants/connector`, () => HttpResponse.json(CONNECTOR_CONFIG)),
  http.get(`${API}/branding`, () => HttpResponse.json(TENANT.branding)),
  http.get(`${API}/users`, () => HttpResponse.json([])),
];

export const server = setupServer(...handlers);

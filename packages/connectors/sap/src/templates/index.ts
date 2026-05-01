import type { RestGenericConfig } from "../adapters/RestGenericConnector";

/**
 * A connector template = a pre-filled REST_GENERIC config for a popular ERP/CRM
 * system. The user selects a template, fills in the credentials, and the
 * connector works without further configuration.
 *
 * Conventions:
 * - `helpUrl` points to the system's API doc / "where do I find my token" page
 * - `credentialFields` describes which auth values the user must supply
 * - `defaultConfig` contains the endpoint paths and query-param naming the
 *   system uses
 *
 * The mapping in RestGenericConnector.mapCustomer / mapProduct is fuzzy
 * (it tries many candidate field names), so most systems work without further
 * tweaking. Where a system uses very system-specific names, future work could
 * add a `fieldMapping` override per template.
 */
export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  helpUrl: string;
  /** Which auth credentials the user must enter for this template to work. */
  credentialFields: Array<{
    key: "token" | "apiKeyValue" | "username" | "password";
    label: string;
    placeholder?: string;
    helpText?: string;
  }>;
  /** Pre-filled REST_GENERIC config — baseUrl + endpoints + auth shape. */
  defaultConfig: RestGenericConfig;
  /** Optional notes shown to the admin after applying. */
  notes?: string;
}

export const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  {
    id: "hubspot",
    name: "HubSpot CRM",
    description: "HubSpot CRM via Private App Token. Synct Kontakte, Deals und Notizen.",
    helpUrl: "https://developers.hubspot.com/docs/api/private-apps",
    credentialFields: [
      {
        key: "token",
        label: "Private App Token",
        placeholder: "pat-eu1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        helpText: "HubSpot → Settings → Integrations → Private Apps → Create app → Scopes: contacts.read/write, deals.read/write",
      },
    ],
    defaultConfig: {
      baseUrl: "https://api.hubapi.com",
      auth: { type: "bearer" },
      searchParam: "query",
      endpoints: {
        customers:    "/crm/v3/objects/contacts",
        products:     "/crm/v3/objects/products",
        quotes:       "/crm/v3/objects/quotes",
        tasks:        "/crm/v3/objects/tasks",
        appointments: "/crm/v3/objects/meetings",
        notes:        "/crm/v3/objects/notes",
      },
    },
    notes:
      "HubSpot wraps records in `{ properties: {...} }`. The first sync may map limited fields — full property mapping per object will improve coverage.",
  },

  {
    id: "salesforce",
    name: "Salesforce REST API",
    description: "Salesforce Sales Cloud via OAuth2-Bearer-Token (sessionId).",
    helpUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro.htm",
    credentialFields: [
      {
        key: "token",
        label: "OAuth Access Token (sessionId)",
        placeholder: "00D...!ARQA...",
        helpText:
          "Generate via the SOAP login API or 'sf org login web' (CLI). Production base URL = your `instance_url` + `/services/data/v59.0`.",
      },
    ],
    defaultConfig: {
      baseUrl: "https://your-instance.my.salesforce.com/services/data/v59.0",
      auth: { type: "bearer" },
      searchParam: "q",
      endpoints: {
        customers:    "/sobjects/Account",
        products:     "/sobjects/Product2",
        quotes:       "/sobjects/Quote",
        tasks:        "/sobjects/Task",
        appointments: "/sobjects/Event",
        notes:        "/sobjects/Note",
      },
    },
    notes:
      "Replace `your-instance.my.salesforce.com` with your org's actual instance URL after login. Token expires — refresh logic not yet automated.",
  },

  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Pipedrive Sales CRM via API Token.",
    helpUrl: "https://pipedrive.readme.io/docs/how-to-find-the-api-token",
    credentialFields: [
      {
        key: "apiKeyValue",
        label: "API Token",
        placeholder: "abcd1234567890abcd1234567890abcd12345678",
        helpText: "Pipedrive → Personal Preferences → API → Copy your API token",
      },
    ],
    defaultConfig: {
      baseUrl: "https://api.pipedrive.com/v1",
      auth: { type: "apikey", apiKeyHeader: "x-api-token" },
      searchParam: "term",
      endpoints: {
        customers:    "/persons",
        products:     "/products",
        quotes:       "/deals",
        tasks:        "/activities",
        appointments: "/activities",
        notes:        "/notes",
      },
    },
    notes:
      "Pipedrive prefers the API token as a query param `?api_token=...`. The connector currently sends it as a header which works for most operations.",
  },

  {
    id: "sevdesk",
    name: "sevDesk",
    description: "sevDesk Buchhaltung & CRM (Deutschland) via API Token.",
    helpUrl: "https://api.sevdesk.de/",
    credentialFields: [
      {
        key: "apiKeyValue",
        label: "API Token",
        placeholder: "abcd1234567890...",
        helpText: "sevDesk → Einstellungen → Benutzerverwaltung → API-Token",
      },
    ],
    defaultConfig: {
      baseUrl: "https://my.sevdesk.de/api/v1",
      auth: { type: "apikey", apiKeyHeader: "Authorization" },
      searchParam: "name",
      endpoints: {
        customers:    "/Contact",
        products:     "/Part",
        quotes:       "/Order",
        tasks:        "/CommunicationWay",
        appointments: "/Event",
        notes:        "/Note",
      },
    },
    notes:
      "sevDesk Auth-Header: `Authorization: <token>` (kein 'Bearer' davor). Falls Verbindungstest fehlschlägt: Token ohne Prefix einfügen.",
  },

  {
    id: "lexoffice",
    name: "lexoffice (lexware office)",
    description: "lexoffice Buchhaltung & CRM (Deutschland) via API Key.",
    helpUrl: "https://developers.lexoffice.io/docs/",
    credentialFields: [
      {
        key: "token",
        label: "API Key",
        placeholder: "ax9...",
        helpText: "lexoffice → Einstellungen → Öffentliche API → Persönlichen API-Schlüssel erstellen",
      },
    ],
    defaultConfig: {
      baseUrl: "https://api.lexoffice.io/v1",
      auth: { type: "bearer" },
      searchParam: "name",
      endpoints: {
        customers:    "/contacts",
        products:     "/articles",
        quotes:       "/quotations",
        tasks:        "/event-subscriptions",
        appointments: "/event-subscriptions",
        notes:        "/contacts",
      },
    },
    notes:
      "lexoffice trennt Aufträge in /quotations (Angebote) und /invoices (Rechnungen). Notes existieren nicht als eigene Entität — werden ggf. an Kontakt geheftet.",
  },

  {
    id: "bitrix24",
    name: "Bitrix24",
    description: "Bitrix24 CRM (Cloud / Self-Hosted) via inbound webhook URL.",
    helpUrl: "https://training.bitrix24.com/rest_help/",
    credentialFields: [
      {
        key: "token",
        label: "Webhook-URL bzw. Token",
        placeholder: "abc123def456ghi789jkl0",
        helpText:
          "Bitrix24 → Mehr → Workflow → Inbound Webhook → User-ID + Token. Nur den Token-Teil hier eintragen.",
      },
    ],
    defaultConfig: {
      // The full URL has the form https://your.bitrix24.de/rest/USER_ID/TOKEN/
      // Store the prefix here, the token is appended via header (suboptimal —
      // for now the user needs to bake it into the baseUrl too).
      baseUrl: "https://your-portal.bitrix24.de/rest",
      auth: { type: "bearer" },
      searchParam: "FILTER[%]",
      endpoints: {
        customers:    "/crm.contact.list",
        products:     "/crm.product.list",
        quotes:       "/crm.quote.list",
        tasks:        "/tasks.task.list",
        appointments: "/calendar.event.list",
        notes:        "/crm.timeline.comment.list",
      },
    },
    notes:
      "Bitrix24 inbound webhooks include user-id + token in the URL path itself (https://portal.bitrix24.de/rest/<user-id>/<token>/...). For now, paste the full URL in baseUrl. A dedicated Bitrix adapter is on the roadmap.",
  },

  {
    id: "weclapp",
    name: "weclapp",
    description: "weclapp Cloud-ERP (Deutschland) via API Token.",
    helpUrl: "https://www.weclapp.com/api/",
    credentialFields: [
      {
        key: "apiKeyValue",
        label: "API Token",
        placeholder: "abcd1234...",
        helpText: "weclapp → Einstellungen → Benutzerverwaltung → API-Token erzeugen",
      },
    ],
    defaultConfig: {
      baseUrl: "https://your-domain.weclapp.com/webapp/api/v1",
      auth: { type: "apikey", apiKeyHeader: "AuthenticationToken" },
      searchParam: "filter",
      endpoints: {
        customers:    "/customer",
        products:     "/article",
        quotes:       "/salesOrder",
        tasks:        "/task",
        appointments: "/appointment",
        notes:        "/comment",
      },
    },
    notes: "weclapp-Subdomain bitte in der Basis-URL ersetzen.",
  },

  {
    id: "generic",
    name: "Generic REST API",
    description: "Beliebige REST-API — alle Endpunkte und Auth manuell setzen.",
    helpUrl: "",
    credentialFields: [],
    defaultConfig: {
      baseUrl: "https://api.example.com",
      auth: { type: "none" },
      searchParam: "q",
      endpoints: {
        customers:    "/customers",
        products:     "/products",
        quotes:       "/quotes",
        tasks:        "/tasks",
        appointments: "/appointments",
        notes:        "/notes",
      },
    },
  },
];

export function getTemplate(id: string): ConnectorTemplate | undefined {
  return CONNECTOR_TEMPLATES.find((t) => t.id === id);
}

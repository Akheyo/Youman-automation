# A&B Vertriebssystem — Setup & Übergabe

Vertriebssystem auf Basis des PV-Konfigurators: eingehende Leads landen in einem
Google Sheet, werden reihum an **Anna / Felix / Paul** verteilt, der Stand wird
über ein Dashboard (`/vertrieb`) gesteuert.

```
PV-Konfigurator ──Lead──▶ n8n Webhook (/lead-intake)
                              │
                   ┌──────────┼───────────────┐
                   ▼          ▼                ▼
            Google Sheet   Zuweisung      E-Mail an Vertrieb
            (anhängen)    (Reihum A/F/P)
                   ▲
                   │  n8n API-Workflow (/vertrieb-leads, /vertrieb-update)
                   ▼
            Next.js Dashboard /vertrieb
            ← liest Leads, KPIs, Status pro Mitarbeiter
            → Status/Zuweisung/Notiz ändern schreibt zurück
```

Das Dashboard spricht **nur** mit den eigenen Next.js-API-Routen; diese sprechen
serverseitig mit n8n. So braucht der Browser nie Google-Credentials.

---

## Status

| Teil | Status |
|------|--------|
| Google Sheet „A&B Vertrieb — Leads" | ✅ angelegt (in Drive von `infoall4youstore@gmail.com`) |
| Dashboard `app/vertrieb/` | ✅ fertig (Typecheck + Lint grün) |
| Proxy-Routen `app/api/vertrieb/leads`, `…/update` | ✅ fertig |
| Env-Variable `N8N_WEBHOOK_BASE_URL` | ✅ in `.env.example` dokumentiert |
| n8n-Workflows | ✅ **angelegt, aktiv & getestet** in Instanz `youmanautomation.app.n8n.cloud` |
| Verdrahtung (Env setzen + LEAD_WEBHOOK_URL) | ⏳ offen (Werte siehe Schritt 6) |

> Hinweis: Es wurden testweise zwei Workflows in einer Fremd-Instanz
> (`dankha.app.n8n.cloud`) gebaut — die scheiterten am Google-Zugriff (403), weil
> deren Google-Konto nicht Eigentümer des Sheets ist. Deshalb der Wechsel auf die
> eigene n8n-Instanz, die mit `infoall4youstore@gmail.com` verbunden ist und damit
> Zugriff auf das Sheet hat.

### Live-Stand (Instanz `youmanautomation.app.n8n.cloud`)

| Element | Wert |
|---------|------|
| Workflow A — Lead-Eingang | ID `VEnnNKkN0yxtR4l0` |
| Workflow B — API | ID `qsPNEsO5PIlOGLOQ` |
| Google-Sheets-Credential | `rlgHesIYyplAOJpD` („Google Sheets account") |
| SMTP-Credential | `m4Dr1SCZKnMTgyLH` („SMTP account") |
| Sheet-Tab | **`Leads`** (neu angelegt, siehe Hinweis unten) |

> **4 Korrekturen gegenüber dem ursprünglichen Code** (bereits oben eingearbeitet):
> 1. **Tab-Name:** `gid 0` existierte im Sheet nicht (der erste Tab/Index 0 trägt
>    einen unbekannten Eigennamen). Daher wurde ein sauberer Tab **`Leads`**
>    angelegt; beide Workflows referenzieren ihn per `mode: 'name'`.
> 2. **Absender:** `fromEmail` = `info@youman-automation.com` (das SMTP-Konto
>    lehnt andere Absender mit „550 Sender not found" ab).
> 3. **`cellFormat: 'RAW'`** auf den Schreib-Nodes — sonst interpretiert Google die
>    Telefonnummer `+49…` als Formel (`#ERROR!`).
> 4. **`appendOrUpdate`** braucht ein leeres `schema: []` im `columns`-Objekt,
>    sonst Laufzeitfehler „Could not get parameter columns.schema".

---

## Das Google Sheet

- **Titel:** `A&B Vertrieb — Leads`
- **ID:** `1097W_Nn0v-bZZhcCthNui7HVUKwOSAArdgDaXjakKeI`
- **URL:** https://docs.google.com/spreadsheets/d/1097W_Nn0v-bZZhcCthNui7HVUKwOSAArdgDaXjakKeI
- **Ordner:** „Youman Automation leads" (Drive von infoall4youstore@gmail.com)
- **Kopfzeile (Spalten A–V):**

```
ID | Eingang | Status | Zugewiesen an | Name | Telefon | Email | Adresse |
Zeitrahmen | Nachricht | kWp | Module | Ertrag kWh/Jahr | Ersparnis EUR/Jahr |
Investition EUR | Amortisation Jahre | CO2 t/Jahr | Lat | Lng | Quelle |
Notizen | Letzte Aenderung
```

Die Workflows mappen per **autoMapInputData** auf genau diese Spaltennamen — die
Code-Nodes geben Objekte mit exakt diesen Schlüsseln aus.

---

## Schritte in der neuen Session (eigene n8n-Instanz)

1. **Prüfen, dass die eigene n8n als MCP-Connector aktiv ist** (Tools
   `mcp__n8n__*` müssen verfügbar sein, nicht nur `authenticate`).
2. `mcp__n8n__list_credentials` → die **Google-Sheets-OAuth2-Credential-ID** der
   eigenen Instanz notieren (mit `infoall4youstore@gmail.com` verbunden!).
   Optional eine **SMTP**-Credential-ID für die E-Mail-Benachrichtigung.
3. `mcp__n8n__search_projects` → Projekt-ID notieren.
4. Beide Workflows unten anlegen (`validate_workflow` → `create_workflow_from_code`
   → `publish_workflow`). **Wichtig:** in der `credentials`-Angabe die
   `id`/`name` durch die echten Werte aus Schritt 2 ersetzen
   (Format: `credentials: { googleSheetsOAuth2Api: { id: '<ID>', name: '<NAME>' } }`).
5. Mit `execute_workflow` (Mode `production`) einen Test-Lead durch Workflow A
   schicken und per `get_execution` prüfen, dass die Zeile im Sheet landet.
   (Tab-Referenz: `sheetName` ist auf `mode: 'name'`, Wert `Leads` gesetzt. Der
   Tab `Leads` wurde eigens angelegt — falls er fehlt, einmalig über die
   Google-Sheets-Node-Operation `sheet → create` mit Titel `Leads` erzeugen; die
   Kopfzeile entsteht beim ersten `append` automatisch.)
6. Webhook-Basis-URL der eigenen Instanz und in den Env-Variablen setzen:
   - `N8N_WEBHOOK_BASE_URL=https://youmanautomation.app.n8n.cloud/webhook`
   - `LEAD_WEBHOOK_URL=https://youmanautomation.app.n8n.cloud/webhook/lead-intake`
7. Next.js neu starten / deployen → `/vertrieb` zeigt die Leads.

---

## Workflow A — „A&B Vertrieb — Lead-Eingang"

Webhook `POST /lead-intake` → bestehende Zeilen lesen (für Reihum-Zuweisung) →
Lead aufbereiten (ID, Status „Neu", Zuweisung A/F/P) → ins Sheet anhängen →
E-Mail an den Vertrieb. (Validiert mit der n8n Workflow-SDK.)

```javascript
import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const leadWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Lead Webhook',
    parameters: { httpMethod: 'POST', path: 'lead-intake', responseMode: 'onReceived', options: {} },
    position: [240, 300]
  },
  output: [{ body: { name: 'Max Mustermann', calculation: { recommendedKwp: 7.2 } } }]
});

const readExisting = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Bestehende Leads lesen',
    alwaysOutputData: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'id', value: '1097W_Nn0v-bZZhcCthNui7HVUKwOSAArdgDaXjakKeI' },
      sheetName: { __rl: true, mode: 'name', value: 'Leads' },
      options: {}
    },
    credentials: { googleSheetsOAuth2Api: { id: 'rlgHesIYyplAOJpD', name: 'Google Sheets account' } },
    position: [460, 300]
  },
  output: [{ ID: 'L-0001', Name: 'Erika Beispiel' }]
});

const buildRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Lead aufbereiten',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const wh = $('Lead Webhook').first().json;\n" +
        "const p = (wh && wh.body) ? wh.body : (wh || {});\n" +
        "const c = p.calculation || {};\n" +
        "const existing = $input.all().filter(i => i.json && (i.json.ID || i.json.Name));\n" +
        "const count = existing.length;\n" +
        "const reps = ['Anna', 'Felix', 'Paul'];\n" +
        "const assignee = reps[count % reps.length];\n" +
        "const id = 'L-' + String(count + 1).padStart(4, '0');\n" +
        "const now = new Date().toISOString();\n" +
        "const row = {\n" +
        "  'ID': id,\n" +
        "  'Eingang': p.timestamp || now,\n" +
        "  'Status': 'Neu',\n" +
        "  'Zugewiesen an': assignee,\n" +
        "  'Name': p.name || '',\n" +
        "  'Telefon': p.phone || '',\n" +
        "  'Email': p.email || '',\n" +
        "  'Adresse': p.address || '',\n" +
        "  'Zeitrahmen': p.timeframe || '',\n" +
        "  'Nachricht': p.message || '',\n" +
        "  'kWp': (c.recommendedKwp != null) ? c.recommendedKwp : '',\n" +
        "  'Module': (c.moduleCount != null) ? c.moduleCount : '',\n" +
        "  'Ertrag kWh/Jahr': (c.yearlyYieldKwh != null) ? c.yearlyYieldKwh : '',\n" +
        "  'Ersparnis EUR/Jahr': (c.yearlySavingsEur != null) ? c.yearlySavingsEur : '',\n" +
        "  'Investition EUR': (c.investmentEur != null) ? c.investmentEur : '',\n" +
        "  'Amortisation Jahre': (c.paybackYears != null) ? c.paybackYears : '',\n" +
        "  'CO2 t/Jahr': (c.co2SavingsT != null) ? c.co2SavingsT : '',\n" +
        "  'Lat': (p.lat != null) ? p.lat : '',\n" +
        "  'Lng': (p.lng != null) ? p.lng : '',\n" +
        "  'Quelle': p.source || 'pv-konfigurator',\n" +
        "  'Notizen': '',\n" +
        "  'Letzte Aenderung': now,\n" +
        "};\n" +
        "return [{ json: row }];"
    },
    position: [680, 300]
  },
  output: [{ ID: 'L-0001', Status: 'Neu', 'Zugewiesen an': 'Anna' }]
});

const appendRow = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'In Sheet speichern',
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: '1097W_Nn0v-bZZhcCthNui7HVUKwOSAArdgDaXjakKeI' },
      sheetName: { __rl: true, mode: 'name', value: 'Leads' },
      columns: { mappingMode: 'autoMapInputData', value: null },
      options: { cellFormat: 'RAW' }
    },
    credentials: { googleSheetsOAuth2Api: { id: 'rlgHesIYyplAOJpD', name: 'Google Sheets account' } },
    position: [900, 300]
  },
  output: [{ ID: 'L-0001', Status: 'Neu' }]
});

const notify = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'Vertrieb benachrichtigen',
    onError: 'continueRegularOutput',
    parameters: {
      fromEmail: 'info@youman-automation.com',
      toEmail: 'infoall4youstore@gmail.com',
      subject: expr('Neuer PV-Lead {{ $(\"Lead aufbereiten\").first().json.ID }}: {{ $(\"Lead aufbereiten\").first().json.Name }} → {{ $(\"Lead aufbereiten\").first().json[\"Zugewiesen an\"] }}'),
      emailFormat: 'html',
      html: expr('<h2>Neuer PV-Lead</h2>' +
        '<p><b>Zugewiesen an:</b> {{ $(\"Lead aufbereiten\").first().json[\"Zugewiesen an\"] }}</p>' +
        '<table cellpadding=\"6\"><tr><td><b>Name</b></td><td>{{ $(\"Lead aufbereiten\").first().json.Name }}</td></tr>' +
        '<tr><td><b>Telefon</b></td><td>{{ $(\"Lead aufbereiten\").first().json.Telefon }}</td></tr>' +
        '<tr><td><b>E-Mail</b></td><td>{{ $(\"Lead aufbereiten\").first().json.Email }}</td></tr>' +
        '<tr><td><b>Adresse</b></td><td>{{ $(\"Lead aufbereiten\").first().json.Adresse }}</td></tr></table>' +
        '<p><b>Nachricht:</b> {{ $(\"Lead aufbereiten\").first().json.Nachricht }}</p>'),
      options: { appendAttribution: false }
    },
    credentials: { smtp: { id: 'm4Dr1SCZKnMTgyLH', name: 'SMTP account' } },
    position: [1120, 300]
  },
  output: [{ success: true }]
});

export default workflow('ab-vertrieb-lead-eingang', 'A&B Vertrieb — Lead-Eingang')
  .add(leadWebhook).to(readExisting).to(buildRow).to(appendRow).to(notify);
```

---

## Workflow B — „A&B Vertrieb — API"

Zwei Endpunkte fürs Dashboard. `GET /vertrieb-leads` → alle Leads + Statistiken als
JSON. `POST /vertrieb-update` → Status/Zuweisung/Notiz einer Zeile (per ID) ändern.

```javascript
import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const getLeadsWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'API Get Leads',
    parameters: { httpMethod: 'GET', path: 'vertrieb-leads', responseMode: 'responseNode', options: { allowedOrigins: '*' } },
    position: [240, 200]
  },
  output: [{ query: {} }]
});

const readAll = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Alle Leads lesen',
    alwaysOutputData: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'id', value: '1097W_Nn0v-bZZhcCthNui7HVUKwOSAArdgDaXjakKeI' },
      sheetName: { __rl: true, mode: 'name', value: 'Leads' },
      options: {}
    },
    credentials: { googleSheetsOAuth2Api: { id: 'rlgHesIYyplAOJpD', name: 'Google Sheets account' } },
    position: [460, 200]
  },
  output: [{ ID: 'L-0001', Status: 'Neu', Name: 'Max Mustermann' }]
});

const buildLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Leads sammeln',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const rows = $input.all().map(i => i.json).filter(r => r && (r.ID || r.Name));\n" +
        "const reps = ['Anna', 'Felix', 'Paul'];\n" +
        "const byStatus = {};\n" +
        "const byRep = {};\n" +
        "for (const r of rows) {\n" +
        "  const s = (r.Status || 'Neu');\n" +
        "  byStatus[s] = (byStatus[s] || 0) + 1;\n" +
        "  const a = (r['Zugewiesen an'] || 'Unbekannt');\n" +
        "  byRep[a] = (byRep[a] || 0) + 1;\n" +
        "}\n" +
        "return [{ json: { leads: rows, count: rows.length, byStatus, byRep, reps, generatedAt: new Date().toISOString() } }];"
    },
    position: [680, 200]
  },
  output: [{ leads: [{ ID: 'L-0001' }], count: 1 }]
});

const respondLeads = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Leads zurückgeben',
    parameters: {
      respondWith: 'firstIncomingItem',
      options: { responseHeaders: { entries: [{ name: 'Access-Control-Allow-Origin', value: '*' }] } }
    },
    position: [900, 200]
  },
  output: [{}]
});

const updateWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'API Update Lead',
    parameters: { httpMethod: 'POST', path: 'vertrieb-update', responseMode: 'responseNode', options: { allowedOrigins: '*' } },
    position: [240, 500]
  },
  output: [{ body: { id: 'L-0001', status: 'Kontaktiert', assignedTo: 'Anna', notes: 'Rückruf morgen' } }]
});

const buildUpdate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Update aufbereiten',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const wh = $('API Update Lead').first().json;\n" +
        "const p = (wh && wh.body) ? wh.body : (wh || {});\n" +
        "const id = p.id || p.ID;\n" +
        "if (!id) { throw new Error('Feld \"id\" fehlt'); }\n" +
        "const row = { 'ID': id, 'Letzte Aenderung': new Date().toISOString() };\n" +
        "if (p.status !== undefined) row['Status'] = p.status;\n" +
        "if (p.assignedTo !== undefined) row['Zugewiesen an'] = p.assignedTo;\n" +
        "if (p.notes !== undefined) row['Notizen'] = p.notes;\n" +
        "return [{ json: row }];"
    },
    position: [460, 500]
  },
  output: [{ ID: 'L-0001', Status: 'Kontaktiert' }]
});

const updateSheet = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Status aktualisieren',
    parameters: {
      resource: 'sheet',
      operation: 'appendOrUpdate',
      documentId: { __rl: true, mode: 'id', value: '1097W_Nn0v-bZZhcCthNui7HVUKwOSAArdgDaXjakKeI' },
      sheetName: { __rl: true, mode: 'name', value: 'Leads' },
      columns: { mappingMode: 'autoMapInputData', matchingColumns: ['ID'], value: null, schema: [] },
      options: { cellFormat: 'RAW' }
    },
    credentials: { googleSheetsOAuth2Api: { id: 'rlgHesIYyplAOJpD', name: 'Google Sheets account' } },
    position: [680, 500]
  },
  output: [{ ID: 'L-0001', Status: 'Kontaktiert' }]
});

const respondUpdate = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Update bestätigen',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { "ok": true, "id": $json.ID } }}'),
      options: { responseHeaders: { entries: [{ name: 'Access-Control-Allow-Origin', value: '*' }] } }
    },
    position: [900, 500]
  },
  output: [{ ok: true }]
});

export default workflow('ab-vertrieb-api', 'A&B Vertrieb — API')
  .add(getLeadsWebhook).to(readAll).to(buildLeads).to(respondLeads)
  .add(updateWebhook).to(buildUpdate).to(updateSheet).to(respondUpdate);
```

---

## Pipeline-Status (Dashboard)

`Neu → Kontaktiert → Termin → Angebot → Gewonnen / Verloren`

Diese Werte sind im Dashboard (`app/vertrieb/Dashboard.tsx`, Konstante `STATUSES`)
und in der Auswertung hinterlegt. Reihum-Zuweisung an `['Anna','Felix','Paul']`
(Konstante in Workflow A bzw. `DEFAULT_REPS` im Dashboard) — bei
Personaländerung an beiden Stellen anpassen.

## Sicherheit / TODO

- `/vertrieb` hat (noch) **keine Authentifizierung**. Vor Live-Gang schützen:
  z. B. Vercel Password Protection, Basic-Auth-Middleware oder Login. Das Sheet
  enthält personenbezogene Daten (DSGVO).
- Optional: Telegram-Benachrichtigung statt/zusätzlich zur E-Mail (Credential in
  n8n vorhanden in der Test-Instanz; in eigener Instanz ggf. neu anlegen).

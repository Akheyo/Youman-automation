# Youman – Architekturübersicht

## Produktvision

Youman ist eine mandantenfähige Windows Desktop-Applikation, die als universelle Schnellaktions-Oberfläche für ERP-nahe Geschäftsprozesse dient. Die App verbindet SAP-Systeme mit einer modernen, schnellen Desktop-UX und richtet sich als wiederverwendbares SaaS-Produkt an B2B-Kunden verschiedener Branchen.

---

## Architekturentscheidungen

### Desktop: Electron + React + TypeScript

**Warum Electron statt nativem Windows-Framework:**
- Maximale Code-Wiederverwendung (React-Komponenten, TypeScript, npm-Ökosystem)
- Umfangreiche Enterprise-Bibliotheken verfügbar (React Query, React Hook Form, Tailwind)
- Stabile Chromium-Rendering-Engine
- `contextBridge` + `sandbox: true` sichert die Renderer-Isolation
- Electron Builder erzeugt `.exe`/NSIS-Installer

**Warum nicht Tauri:**
- Tauri erfordert Rust-Kenntnisse, was die Team-Erweiterung erschwert
- Weniger ausgereifte Bibliotheken für komplexe Formular-/Grid-Renderer

### Backend: NestJS + PostgreSQL + Prisma

**Warum zentrales Backend statt direkter SAP-Verbindung vom Client:**
1. **Sicherheit**: SAP-Zugangsdaten bleiben im Backend, nie im Client-Code
2. **Tenant-Isolation**: Jeder Mandant hat seinen eigenen Connector-Context
3. **Offline-Queue**: Server verwaltet ausstehende Operationen, die von mehreren Clients gesendet werden können
4. **Audit**: Alle Aktionen werden serverseitig protokolliert (manipulationssicher)
5. **Rate Limiting**: SAP-seitige Request-Limits können zentral gesteuert werden
6. **Skalierbarkeit**: Mehrere Desktop-Clients teilen sich die SAP-Verbindung

### SAP-Connector: Adapter-Pattern

Das `IErpConnector`-Interface entkoppelt vollständig das UI und Backend von der ERP-Implementierung:

```
UI → Backend API → ActionsService → IErpConnector → SapODataConnector / MockConnector
```

Jeder Connector wird per `ConnectorFactory` aus der `ConnectorConfig` des Tenants instanziiert. Für neue ERP-Systeme (z.B. Dynamics, Salesforce) wird nur ein neuer Adapter implementiert – ohne Änderungen an UI oder Backend-Logik.

### Multi-Tenancy: Row-Level Isolation

Jede Datenbankabfrage wird mit `tenantId` gefiltert. Kein shared-row-Zugriff über Mandanten hinweg. JWTs tragen `tenantId` im Payload, die bei jeder Operation validiert wird.

---

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────┐
│                    Windows Desktop                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │   Electron Renderer (React + Vite)                  │   │
│  │   • Login Screen                                    │   │
│  │   • Dashboard / Action Launcher                     │   │
│  │   • Config-driven Action Forms                      │   │
│  │   • Searchable Customer/Product Dialogs             │   │
│  │   • Queue Status / Sync Panel                       │   │
│  │   • Audit Log Viewer                                │   │
│  │   • Admin / Branding / Connector Settings           │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │ IPC (contextBridge)                    │
│  ┌──────────────────▼──────────────────────────────────┐   │
│  │   Electron Main Process                              │   │
│  │   • OfflineQueueStore (SQLite / better-sqlite3)     │   │
│  │   • SecureStorage (Electron safeStorage API)        │   │
│  │   • IPC Handlers                                    │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │ HTTP + JWT                             │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  NestJS Backend                              │
│                                                             │
│  Auth → Tenants → Users → Actions → Search → Queue          │
│  Audit → Connectors → Branding                              │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  PostgreSQL  │  │  ConnectorSvc │  │  AuditService   │  │
│  │  (Prisma)    │  │  (per Tenant) │  │  (alle Aktionen)│  │
│  └──────────────┘  └──────┬───────┘  └─────────────────┘  │
│                            │                                 │
└────────────────────────────┼────────────────────────────────┘
                             │ OData / RFC / BAPI
┌────────────────────────────▼────────────────────────────────┐
│                    SAP System                                │
│  BusinessPartner · Material · Quotation · SalesOrder        │
│  Activity · Appointment · Note · Stock · Pricing            │
└─────────────────────────────────────────────────────────────┘
```

---

## Verzeichnisstruktur

```
youman-automation/
├── apps/
│   ├── desktop/                    # Electron Desktop App
│   │   ├── electron/               # Main Process
│   │   │   ├── main.ts             # Electron Entry
│   │   │   ├── preload.ts          # contextBridge API
│   │   │   ├── ipc/handlers.ts     # IPC Handler Registration
│   │   │   └── store/              # SQLite Queue + SecureStorage
│   │   └── src/                    # React Renderer
│   │       ├── components/
│   │       │   ├── layout/         # AppLayout, AuthGuard
│   │       │   ├── screens/        # Login, Dashboard, Action, Queue, ...
│   │       │   ├── forms/          # ActionFormRenderer + Field-Renderer
│   │       │   └── ui/             # Button, Input, Badge, Toaster, ...
│   │       ├── stores/             # Zustand (auth, offline)
│   │       ├── services/           # API Client, SyncService
│   │       ├── hooks/              # useToast, ...
│   │       └── types/              # electron.d.ts (Window API types)
│   │
│   └── backend/                    # NestJS API
│       ├── prisma/
│       │   ├── schema.prisma       # Datenmodell
│       │   └── seed.ts             # Demo-Daten
│       └── src/
│           ├── modules/
│           │   ├── auth/           # Login, Refresh, JWT, Logout
│           │   ├── tenants/        # Settings, Mandantenverwaltung
│           │   ├── users/          # Benutzerverwaltung
│           │   ├── actions/        # Action-Execution, Routing
│           │   ├── search/         # Kunden/Artikel-Suche (via Connector)
│           │   ├── queue/          # Offline-Sync, Retry, Dead-Letter
│           │   ├── audit/          # Protokollierung
│           │   ├── connectors/     # Connector-Instanziierung + Cache
│           │   └── branding/       # Theme-Einstellungen
│           ├── common/
│           │   ├── guards/         # JwtAuthGuard, RolesGuard
│           │   ├── decorators/     # @CurrentUser, @CurrentTenant
│           │   ├── filters/        # GlobalExceptionFilter
│           │   └── interceptors/   # AuditInterceptor
│           ├── config/             # app.config, jwt.config
│           └── database/           # PrismaService
│
├── packages/
│   ├── shared/                     # Gemeinsame Types, Zod-Schemas, Konstanten
│   ├── config-engine/              # ActionRegistry, FormBuilder, ActionLoader
│   └── connectors/
│       └── sap/                    # IErpConnector, SapODataConnector, MockConnector
│
└── configs/
    └── actions/                    # JSON Action-Konfigurationen
        ├── create-quote.json
        ├── create-customer.json
        ├── create-product.json
        ├── create-appointment.json
        └── create-note.json
```

---

## Sicherheitskonzept

### Authentifizierung
- **JWT (HS256)**: Access Token (1h), Refresh Token (30 Tage)
- Refresh Token wird gehashed in PostgreSQL gespeichert (Argon2)
- Refresh Token Rotation: Bei jedem Refresh wird der alte Token revoziert
- Electron `safeStorage` API sichert Tokens im OS-Credential-Store (Windows DPAPI)

### Tenant-Isolation
- Jeder DB-Query filtert nach `tenantId`
- JWT enthält `tenantId` und wird bei jeder Anfrage validiert
- SAP-Zugangsdaten liegen ausschließlich im Backend (`ConnectorConfig`)

### Electron-Sicherheit
- `contextIsolation: true` + `sandbox: true`
- `nodeIntegration: false` im Renderer
- `contextBridge` definiert eine typsichere, minimale API-Fläche
- CSP-Header verhindert externe Script-Ausführung
- `webContents.setWindowOpenHandler` blockiert neue Fenster

### API-Sicherheit
- `helmet` setzt alle wichtigen HTTP-Security-Header
- Rate Limiting (ThrottlerModule): 100 req/min pro IP
- Globaler ValidationPipe: whitelist + forbidNonWhitelisted
- Globaler ExceptionFilter: kein Stack-Trace-Leak
- CORS ist auf bekannte Origins beschränkt

---

## Offline-/Queue-Konzept

### Client-Seite (Electron Main Process)
- SQLite-Datenbank (`youman_offline_queue.db`) im App-UserData-Verzeichnis
- `OfflineQueueStore` verwaltet alle lokal erstellten Queue-Items
- Beim Start und alle 10s prüft `syncService` die Netzwerkverbindung
- Pending Items werden per `/queue/sync` an den Server gesendet
- Bereits gesendete Items werden lokal als `success` markiert

### Server-Seite (NestJS + PostgreSQL)
- `QueueService.syncFromClient()` nimmt Offline-Items entgegen
- Deduplizierung per `clientId` verhindert Doppelverarbeitung
- `processPending()` führt Actions in Reihenfolge aus (Priority + FIFO)
- **Retry Policy**: Exponentielles Backoff (2s, 4s, 8s, 16s)
- **Dead Letter**: Nach `maxRetries` Versuchen → Status `dead_letter`
- Manuelle Wiederholung via UI/API möglich

---

## Action Engine / Config Engine

Jede Action ist eine JSON-Konfigurationsdatei:

```json
{
  "id": "action-create-quote",
  "displayName": "Angebot erstellen",
  "fields": [...],
  "fieldGroups": [...],
  "apiMapping": {...},
  "successActions": [...],
  "failureHandling": {...},
  "offlineBehavior": "queue",
  "allowedRoles": ["SALES", "MANAGER"]
}
```

Der `FormBuilder` aus `@youman/config-engine` baut daraus automatisch:
- Ein typisiertes Zod-Validierungsschema
- Die initiale Formular-Wertemap
- Die gefilterte, sichtbare Feldliste (unter Berücksichtigung von Dependencies)

Der `ActionFormRenderer` mappt jeden Feldtyp auf seinen React-Renderer ohne hartverdrahtete Feldlogik.

---

## SAP-Connector-Konzept

```
ConnectorConfig (DB, pro Tenant)
    → ConnectorFactory
        → SapODataConnector (SAP S/4HANA, ECC via OData)
        → MockErpConnector (Demo, Tests)
        → [zukünftig: SapRfcConnector, DynamicsConnector, ...]
```

Alle Connectors implementieren `IErpConnector`:
- Kunden suchen/anlegen
- Artikel suchen/anlegen
- Preise/Lagerbestand abrufen
- Angebote/Aufträge anlegen
- Wiedervorlagen/Termine/Notizen schreiben
- Reservierungen auslösen

SAP-spezifische Feldmappings (z.B. `Kunnr`, `Matnr`, `Name1`) liegen im Connector, nicht im Business-Code.

Die `entitySets`-Konfiguration in `SapConfig` ermöglicht die Anpassung an verschiedene SAP-Namenskonventionen ohne Code-Änderungen.

---

## Tenant-Onboarding

1. `Tenant` in DB anlegen (slug, name, plan)
2. `TenantSettings` konfigurieren (Währung, Zeitzone, etc.)
3. `TenantBranding` setzen (Logo, Farben, App-Name)
4. `ConnectorConfig` hinterlegen (SAP-URL, Auth-Typ, Credentials)
5. Ersten `User` mit Rolle `TENANT_ADMIN` anlegen
6. Demo-Login: Tenant-Slug + E-Mail + Passwort

Für Produktivbetrieb: Admin-API oder CLI-Seed-Script verwenden.

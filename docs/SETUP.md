# Setup & Lokale Entwicklung

## Voraussetzungen

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (`npm install -g pnpm`)
- **PostgreSQL** >= 15
- **Git**
- Windows 10/11 (für Electron-Build), oder macOS/Linux für Backend-only

---

## 1. Repository klonen und Abhängigkeiten installieren

```bash
git clone <repo-url>
cd youman-automation
pnpm install
```

---

## 2. PostgreSQL einrichten

```sql
CREATE DATABASE youman_db;
CREATE USER youman WITH PASSWORD 'youman_pw';
GRANT ALL PRIVILEGES ON DATABASE youman_db TO youman;
```

---

## 3. Backend konfigurieren

```bash
cd apps/backend
cp .env.example .env
# .env anpassen (DATABASE_URL, JWT_SECRET, ...)
```

Datenbank-Migration und Seed ausführen:

```bash
pnpm db:generate    # Prisma Client generieren
pnpm db:migrate     # Migrationen anwenden
pnpm db:seed        # Demo-Tenant und -User anlegen
```

---

## 4. Packages bauen

```bash
cd ../../
pnpm build:shared
pnpm build:config-engine
pnpm build:sap
```

---

## 5. Entwicklung starten

**Backend** (Terminal 1):
```bash
pnpm dev:backend
# → http://localhost:3001
# → API Docs: http://localhost:3001/api/docs
```

**Desktop App** (Terminal 2):
```bash
pnpm dev:desktop
# → Startet Vite-Dev-Server + Electron
```

---

## 6. Demo-Login

```
Mandant:   demo
E-Mail:    admin@demo.youman.de
Passwort:  Admin123!
```

oder:

```
Mandant:   demo
E-Mail:    sales@demo.youman.de
Passwort:  Sales123!
```

---

## 7. Build für Windows (.exe)

```bash
pnpm build:desktop
cd apps/desktop
pnpm dist
# → apps/desktop/dist-electron/Youman Setup 1.0.0.exe
```

---

## Umgebungsvariablen Backend

| Variable | Beschreibung | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL Connection String | – (Pflicht) |
| `JWT_SECRET` | JWT-Signing-Secret (min. 32 Zeichen) | – (Pflicht) |
| `JWT_REFRESH_SECRET` | Refresh-Token-Secret | – (Pflicht) |
| `JWT_ACCESS_EXPIRY` | Access Token Laufzeit | `1h` |
| `JWT_REFRESH_EXPIRY` | Refresh Token Laufzeit | `30d` |
| `PORT` | HTTP-Port | `3001` |
| `ALLOWED_ORIGINS` | CORS-Origins, kommagetrennt | `http://localhost:5173` |
| `NODE_ENV` | `development` / `production` | `development` |

---

## Umgebungsvariablen Desktop

Erstelle `apps/desktop/.env.local`:

```
VITE_API_URL=http://localhost:3001/api/v1
```

Für Produktion:
```
VITE_API_URL=https://api.youman.de/api/v1
```

---

## Neue Action anlegen

1. JSON-Konfiguration in `configs/actions/<name>.json` erstellen
2. Schema folgt `ActionDefinition`-Typ aus `@youman/shared`
3. In `apps/backend/src/modules/actions/actions.service.ts` → `routeAction()`-Switch erweitern
4. Restart des Backends – die Action ist sofort verfügbar

Keine Frontend-Änderungen notwendig, da der `ActionFormRenderer` vollständig config-driven ist.

---

## Neuen SAP-Connector entwickeln

1. `packages/connectors/sap/src/adapters/<Name>Connector.ts` erstellen
2. `IErpConnector`-Interface implementieren
3. In `ConnectorFactory.create()` als neuen `connectorType` registrieren
4. `ConnectorType`-Enum in `@youman/shared` und Prisma-Schema erweitern

---

## Tests ausführen

```bash
pnpm test                    # Alle Packages
pnpm --filter @youman/backend test
```

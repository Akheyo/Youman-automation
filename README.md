# adept&

Universal Business Process Automation Platform — Windows Desktop client + multi-tenant backend.

## Architecture

```
┌─────────────────────┐    HTTPS    ┌──────────────────────────┐
│  Desktop .exe       │ ──────────► │  Backend (Docker)        │
│  Electron + React   │             │  NestJS + Postgres       │
│  electron-updater   │             │  Multi-tenant via slug    │
└─────────────────────┘             └──────────────────────────┘
```

End-users install the `.exe`, type a server URL once, then log in. Updates are
delivered via `electron-updater` — users see a banner inside the app, click,
done. The backend is updated independently by deploying a new Docker image.

## Quick Start (run everything locally)

Prerequisites: Docker + Docker Compose.

```bash
cp .env.example .env          # adjust JWT_SECRET / passwords if you want
docker compose up -d --build  # starts Postgres + Backend on :3001
```

After ~30 seconds the backend is ready. Demo credentials:

| Mandant | Email                    | Passwort   |
| ------- | ------------------------ | ---------- |
| `demo`  | `admin@demo.adept.de`    | `Admin123!` |
| `demo`  | `sales@demo.adept.de`    | `Sales123!` |

In the Desktop app, click **Server-Einstellungen** on the login screen and
enter `http://localhost:3001/api/v1`, then log in.

## Production Deployment

Build the image and push to any container registry:

```bash
docker build -t your-registry/adept-backend:latest -f apps/backend/Dockerfile .
docker push your-registry/adept-backend:latest
```

Deploy to any Docker host (Railway, Fly.io, Render, your own VPS).
Set these env vars in your hosting provider:

```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
JWT_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
ALLOWED_ORIGINS=app://./,https://your-frontend-host
PORT=3001
```

The container's `docker-entrypoint.sh` automatically runs `prisma db push`
(or `prisma migrate deploy` if migrations exist) and the seed on first start.

## Desktop builds

Production `.exe` builds run in CI (`.github/workflows/release.yml`) on tag push:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

The CI build uses `VITE_API_URL` from repo secret to hard-code the production
backend URL into the binary. End-users can still override it via the
**Server-Einstellungen** screen for self-hosted deployments.

### Setting the production backend URL

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

```
VITE_API_URL=https://api.adept-suite.com/api/v1
```

Then update `.github/workflows/release.yml` to pass it through to the Vite
build. Until that secret is set, the `.exe` defaults to `localhost:3001` and
relies on users entering the correct URL via the settings screen.

## Local Development (no Docker)

Requires Node 20+, pnpm 9+, Postgres 16.

```bash
pnpm install

# 1. Postgres on localhost:5432, db `adept`, user `adept`
# 2. Backend
cd apps/backend
cp ../../.env.example .env  # set DATABASE_URL=postgresql://adept:adept_dev_change_me@localhost:5432/adept
pnpm prisma db push
pnpm db:seed
pnpm dev          # http://localhost:3001/api/v1

# 3. Desktop (in a second terminal, from repo root)
pnpm dev:desktop  # opens Electron, points at localhost:3001
```

## Tenant onboarding

Currently the only seeded tenant is `demo`. To add a real customer:

```bash
# Inside the running backend container:
docker compose exec backend npx ts-node -e "
  import { PrismaClient } from '@prisma/client';
  import argon2 from 'argon2';
  const p = new PrismaClient();
  (async () => {
    const tenant = await p.tenant.create({ data: { slug: 'kundenfirma', name: 'Kundenfirma GmbH' } });
    await p.tenantSettings.create({ data: { tenantId: tenant.id } });
    await p.tenantBranding.create({ data: { tenantId: tenant.id, appName: 'Kundenfirma' } });
    await p.user.create({ data: {
      tenantId: tenant.id,
      email: 'admin@kundenfirma.de',
      passwordHash: await argon2.hash('GenerateAStrongPassword123!'),
      firstName: 'Max', lastName: 'Mustermann', role: 'TENANT_ADMIN',
    }});
    console.log('Tenant created:', tenant.slug);
  })();
"
```

A proper public signup flow is on the roadmap.

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

### Generate strong secrets first

```bash
bash scripts/generate-secrets.sh > .env.production
```

This produces a file with cryptographically random `JWT_SECRET`,
`JWT_REFRESH_SECRET`, and `POSTGRES_PASSWORD`. **Never use the defaults**
from `.env.example` in production — they are public.

### Option 1: Railway (recommended for first launch)

1. Sign up at https://railway.app — GitHub login works.
2. **New project → Deploy from GitHub repo** → pick `youman-automation`.
3. Railway auto-detects the Dockerfile. Set **Build → Dockerfile path** to `apps/backend/Dockerfile` and **Build context** to `/`.
4. Add a **Postgres** plugin to the same project. Copy the auto-injected
   `DATABASE_URL` into the backend service's environment.
5. Set the rest of the env vars (paste from `.env.production`):
   - `NODE_ENV=production`
   - `JWT_SECRET=...`
   - `JWT_REFRESH_SECRET=...`
   - `ALLOWED_ORIGINS=app://./`
   - `PORT=3001`
6. Generate a public domain in Railway → "Settings → Networking → Generate Domain".
   You get something like `adept-backend-production-a8f2.up.railway.app`.
7. The full backend URL becomes `https://adept-backend-production-a8f2.up.railway.app/api/v1` —
   put that into the GitHub repo secret `VITE_API_URL` (see Desktop builds below).

Railway provides HTTPS automatically — no certificate setup needed.

### Option 2: Fly.io

```bash
flyctl launch --dockerfile apps/backend/Dockerfile
flyctl postgres create
flyctl postgres attach <db-name>
flyctl secrets set JWT_SECRET=$(openssl rand -hex 64) \
                   JWT_REFRESH_SECRET=$(openssl rand -hex 64) \
                   ALLOWED_ORIGINS=app://./
flyctl deploy
```

### Option 3: Own VPS via pre-built image

The repo's GitHub Action (`backend-image.yml`) auto-publishes the image to
GHCR on every push to main / version tag. On your server:

```bash
docker pull ghcr.io/akheyo/youman-automation/backend:latest
docker compose up -d
```

Use a reverse proxy (Caddy, Traefik, nginx) for HTTPS termination.

### Database backups

For Railway/Fly: enable automatic backups in the provider's dashboard
(both have one-click daily snapshots in their UI).

For self-hosted Postgres, schedule via cron:

```bash
# Daily 03:00 UTC, retain 14 days
0 3 * * * docker exec adept-postgres pg_dump -U adept adept | gzip > /backups/adept-$(date +\%F).sql.gz && find /backups -name 'adept-*.sql.gz' -mtime +14 -delete
```

Restore: `gunzip < adept-2026-04-30.sql.gz | docker exec -i adept-postgres psql -U adept adept`.

The container's `docker-entrypoint.sh` automatically runs `prisma db push`
and the seed on first start. **The seed is idempotent** — safe to re-run.

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

Each customer firm = one Tenant. Seeded by default: `demo`. Create new
tenants via the bundled CLI:

```bash
# Inside the running backend container — auto-generates a strong password:
docker compose exec backend pnpm tenant:create kundenfirma "Kundenfirma GmbH" admin@kundenfirma.de

# With explicit password:
docker compose exec backend pnpm tenant:create acme "Acme Corp" admin@acme.com --password=MyStr0ngPwd!
```

Output:
```
✓ Tenant created successfully
  Tenant ID  : 187ef2f4-...
  Slug       : kundenfirma
  Name       : Kundenfirma GmbH

  Initial admin login:
    Mandant   : kundenfirma
    E-Mail    : admin@kundenfirma.de
    Passwort  : Kj8Hm2VnQpRsTwXz  (auto-generated, store securely)
```

Send the credentials to the customer. They install the desktop `.exe`,
log in with `kundenfirma` as Mandant. A public self-service signup flow
is on the roadmap.

## Health & monitoring

The backend exposes two health endpoints (no auth, no rate-limit):

- `GET /api/v1/health` — liveness (process is up)
- `GET /api/v1/health/ready` — readiness (process up + DB reachable)

Use `/health/ready` in your hosting platform's health check configuration.
Returns 503 with diagnostic body if Postgres becomes unreachable.

## Security

- **Rate limiting**: 5 login attempts per minute per IP (brute-force protection),
  100 requests/min global on other endpoints. Configured in `app.module.ts`.
- **Password hashing**: argon2id with default parameters (memory-hard).
- **JWT**: stored in-memory in the renderer; refresh tokens hashed in DB.
- **HTTPS**: not enforced by the backend itself — terminate TLS at the
  reverse proxy / hosting platform (Railway/Fly do this automatically).

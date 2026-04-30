# syntax=docker/dockerfile:1.6
# Multi-stage build for the adept& backend (NestJS + Prisma).
# Build context: repo root (so the pnpm workspace is visible).
#   docker build -f apps/backend/Dockerfile .

# ── Stage 1: install ─────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/config-engine/package.json packages/config-engine/
COPY packages/connectors/sap/package.json packages/connectors/sap/

RUN pnpm install --frozen-lockfile=false --filter "@youman/backend..."

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/backend apps/backend
COPY configs configs

RUN pnpm --filter @youman/shared build \
 && pnpm --filter @youman/config-engine build \
 && pnpm --filter @youman/connector-sap build \
 && pnpm --filter @youman/backend exec prisma generate \
 && pnpm --filter @youman/backend build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9 --activate \
 && apk add --no-cache openssl curl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/packages packages
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/package.json apps/backend/package.json
COPY --from=build /app/apps/backend/node_modules apps/backend/node_modules
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
COPY --from=build /app/configs configs

EXPOSE 3001

# Healthcheck (Nest app must respond on /api/v1)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/api/v1 || exit 1

# Run migrations + seed (idempotent), then start the server.
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip CR if the file was checked out with CRLF line endings on Windows —
# without this, the Linux kernel cannot find the shebang interpreter.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
 && chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/backend/dist/main.js"]

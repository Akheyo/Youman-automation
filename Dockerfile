# adept& Backend – Container für Cloud-Hosting (Render/Railway/Fly).
# Baut nur das Backend samt Workspace-Bibliotheken, ohne Desktop-App.

FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend
COPY configs ./configs

RUN pnpm install --filter "@youman/backend..." --no-frozen-lockfile
# CACHEBUST erzwingt einen frischen Build der Workspace-Pakete bei jedem Bump.
# Nötig, weil Render sonst gecachte (veraltete) Build-Layer wiederverwenden
# kann – dann liefe neuer Formular-Config, aber alter kompilierter Connector.
ARG CACHEBUST=2026-07-23-stabilitaet-final
RUN echo "cachebust ${CACHEBUST}" && pnpm build:shared && pnpm build:config-engine && pnpm build:sap && pnpm build:plenty
RUN cd apps/backend && pnpm exec prisma generate && pnpm build

FROM node:20-bookworm-slim
# LibreOffice (headless) wird für die DOCX→PDF-Konvertierung der
# Dokumentvorlagen benötigt – siehe docs/DOKUMENTVORLAGEN.md.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
      libreoffice-writer \
      fonts-liberation \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/backend
EXPOSE 3001
# Beim Start: Schema-Änderungen anwenden (Projekt nutzt db push statt
# Migrationshistorie), dann Backend. Demo-Mandant/-Nutzer und Action-Configs
# seedet das Backend selbst beim Bootstrap (DemoSeedService/ConfigSyncService)
# – der frühere stille ts-node-Seed ("Seed übersprungen") ist damit Geschichte.
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node dist/src/main.js"]

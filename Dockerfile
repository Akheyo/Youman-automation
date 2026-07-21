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
RUN pnpm build:shared && pnpm build:config-engine && pnpm build:sap && pnpm build:plenty
RUN cd apps/backend && pnpm exec prisma generate && pnpm build

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

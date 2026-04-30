#!/bin/sh
# Initialise DB schema on container start, then run the (idempotent) seed.
# Safe to re-run on every restart.
set -e

cd /app/apps/backend

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "[entrypoint] applying prisma migrations..."
  npx prisma migrate deploy
else
  echo "[entrypoint] no migrations dir — pushing schema directly..."
  npx prisma db push --accept-data-loss --skip-generate
fi

# Seed uses upsert → idempotent. Run the compiled JS, not the .ts source —
# Node 20 won't load .ts directly and ts-node has ESM/CJS quirks in containers.
echo "[entrypoint] running seed (idempotent)..."
node dist/prisma/seed.js || echo "[entrypoint] seed step skipped/failed — continuing"

cd /app
exec "$@"

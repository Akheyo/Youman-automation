#!/usr/bin/env bash
# Generates a production-ready .env file with strong random secrets.
# Run once before deploying to production:
#   bash scripts/generate-secrets.sh > .env.production
set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 1
fi

cat <<EOF
# Generated $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# DO NOT commit this file. Add .env.production to .gitignore.

# Strong random secrets — never use defaults in production.
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)

# Database password (generated)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
POSTGRES_PORT=5432
BACKEND_PORT=3001

# Adjust to your domains:
#   ALLOWED_ORIGINS=https://app.your-domain.com,app://./
ALLOWED_ORIGINS=app://./
EOF

#!/usr/bin/env bash
# Nächtliche Sicherung der Supabase-Datenbank.
#
# Der Free-Tarif von Supabase legt keine Sicherungen an - diese hier ist die
# einzige. Sie landet auf dem Hetzner-Server unter ./backups und wird nach
# 14 Tagen aufgeräumt.
#
# Einrichten (auf dem Server, als root):
#   crontab -e
#   0 3 * * * cd /opt/komplett-konzept && ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Zurückspielen einer Sicherung:
#   gunzip -c backups/<datei>.sql.gz | docker run --rm -i postgres:17-alpine \
#     psql "$DATABASE_URL"
set -euo pipefail

cd "$(dirname "$0")/.."

# DATABASE_URL aus der .env holen
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FEHLER: DATABASE_URL ist nicht gesetzt (siehe .env)" >&2
  exit 1
fi

mkdir -p backups
STAMP="$(date +%Y-%m-%d_%H%M)"
ZIEL="backups/komplett-konzept_${STAMP}.sql.gz"

# pg_dump aus dem Container - so muss auf dem Server kein Postgres-Client
# installiert sein. Version 17, damit es auch zu neueren Servern passt.
docker run --rm postgres:17-alpine \
  pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$ZIEL"

GROESSE="$(du -h "$ZIEL" | cut -f1)"
echo "$(date '+%F %T') Sicherung geschrieben: $ZIEL ($GROESSE)"

# Eine leere oder winzige Datei ist keine Sicherung - lieber laut scheitern.
if [ "$(stat -c%s "$ZIEL")" -lt 1000 ]; then
  echo "WARNUNG: Die Sicherung ist verdächtig klein. Bitte prüfen." >&2
  exit 1
fi

find backups -name '*.sql.gz' -mtime +14 -delete

#!/usr/bin/env bash
# Naechtliches Datenbank-Backup. Legt eine komprimierte Datei unter ./backups ab
# und loescht Sicherungen, die aelter als 14 Tage sind.
#
# Einrichten (auf dem Server, als root):
#   crontab -e
#   0 3 * * * cd /opt/komplett-konzept && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups

STAMP="$(date +%Y-%m-%d_%H%M)"
DB="${POSTGRES_DB:-komplett_konzept}"
DBUSER="${POSTGRES_USER:-kk}"

docker compose exec -T db pg_dump -U "$DBUSER" "$DB" | gzip > "backups/${DB}_${STAMP}.sql.gz"
echo "$(date '+%F %T') Backup geschrieben: backups/${DB}_${STAMP}.sql.gz"

find backups -name '*.sql.gz' -mtime +14 -delete

#!/usr/bin/env sh
# Backup do PostgreSQL com retenção. Uso:
#   DATABASE_URL=postgres://... BACKUP_DIR=/backups KEEP_DAYS=14 sh scripts/backup.sh
# No Docker Compose, o serviço "backup" roda isto todo dia (ver docker-compose.yml e docs/instalacao.md).
set -eu
: "${DATABASE_URL:?Defina DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/kombexa-$(date +%Y-%m-%d_%H%M).dump"
# formato custom (-Fc): compactado e restaurável tabela a tabela com pg_restore
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE.tmp"
mv "$FILE.tmp" "$FILE"
# backups antigos com o nome anterior (fight-manager-*) também entram na limpeza
find "$BACKUP_DIR" \( -name 'kombexa-*.dump' -o -name 'fight-manager-*.dump' \) -mtime +"$KEEP_DAYS" -delete
echo "Backup salvo em $FILE"

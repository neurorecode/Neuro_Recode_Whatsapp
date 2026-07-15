#!/bin/sh
# Backs up Postgres (pg_dump) and MinIO media to a local directory, with
# retention. Run daily via cron or the systemd timer in infra/systemd/.
#
#   ./backup.sh
#
# Env overrides:
#   NRW_BACKUP_DIR        (default /opt/nrw-backups)
#   NRW_BACKUP_RETENTION  days to keep (default 14)
#   PG_CONTAINER          (default infra-postgres-1)
#   MINIO_VOLUME          (default infra_miniodata)
set -e

BACKUP_DIR="${NRW_BACKUP_DIR:-/opt/nrw-backups}"
RETENTION_DAYS="${NRW_BACKUP_RETENTION:-14}"
PG_CONTAINER="${PG_CONTAINER:-infra-postgres-1}"
MINIO_VOLUME="${MINIO_VOLUME:-infra_miniodata}"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "### Postgres backup…"
PG_USER=$(docker exec "$PG_CONTAINER" printenv POSTGRES_USER)
PG_DB=$(docker exec "$PG_CONTAINER" printenv POSTGRES_DB)
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
echo "  -> $BACKUP_DIR/db-$STAMP.sql.gz"

echo "### MinIO media backup…"
docker run --rm \
  -v "$MINIO_VOLUME":/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/minio-$STAMP.tgz" -C /data .
echo "  -> $BACKUP_DIR/minio-$STAMP.tgz"

echo "### Pruning backups older than ${RETENTION_DAYS} days…"
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete || true
find "$BACKUP_DIR" -name 'minio-*.tgz' -mtime +"$RETENTION_DAYS" -delete || true

echo "### Done. Current backups:"
ls -lh "$BACKUP_DIR" | tail -n +2

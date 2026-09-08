#!/bin/bash
# ============================================================
#  Backup - Gestione Matrimonio
#  Salva database (consistente, via VACUUM INTO) + allegati.
#
#  Uso:
#    sudo bash backup.sh                      # -> /var/backups/matrimonio
#    BACKUP_DIR=/mnt/nas sudo bash backup.sh  # destinazione custom
#    RETENTION_DAYS=30 sudo bash backup.sh    # quanti giorni conservare
#    bash backup.sh --local                   # senza Docker (sviluppo)
#
#  Cron giornaliero alle 3:00 (crontab -e come root):
#    0 3 * * * cd /opt/matrimonio && bash backup.sh >> /var/log/matrimonio-backup.log 2>&1
#
#  RIPRISTINO (vedi README):
#    docker compose down
#    gunzip -c matrimonio-<data>.db.gz > /tmp/restore.db
#    docker compose run --rm -v /tmp:/restore app cp /restore/restore.db /app/data/matrimonio.db
#    docker compose up -d
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/matrimonio}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
SERVICE="app"
STAMP="$(date +%Y%m%d-%H%M%S)"
MODE="docker"

[[ "${1:-}" == "--local" ]] && MODE="local"

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

DB_OUT="$BACKUP_DIR/matrimonio-$STAMP.db"
UPLOADS_OUT="$BACKUP_DIR/uploads-$STAMP.tar.gz"

# ── 1. Database ──────────────────────────────────────────────
if [[ "$MODE" == "local" ]]; then
    info "Backup database (modalita' locale)..."
    node server/backup-db.js "$DB_OUT"
    info "Backup allegati..."
    tar -czf "$UPLOADS_OUT" -C server uploads 2>/dev/null || warn "Nessuna cartella uploads da salvare"
else
    docker compose ps --status running --quiet "$SERVICE" | grep -q . \
        || error "Il container '$SERVICE' non e' in esecuzione. Avvialo con: docker compose up -d"

    info "Backup database (VACUUM INTO dentro al container)..."
    # Lo snapshot viene creato dentro al container e poi estratto: cosi' SQLite
    # consolida il WAL prima che il file venga toccato dall'esterno.
    docker compose exec -T "$SERVICE" node server/backup-db.js "/tmp/matrimonio-$STAMP.db"
    docker compose cp "$SERVICE:/tmp/matrimonio-$STAMP.db" "$DB_OUT"
    docker compose exec -T "$SERVICE" rm -f "/tmp/matrimonio-$STAMP.db"

    info "Backup allegati (documenti, preventivi, foto landing)..."
    docker compose exec -T "$SERVICE" tar -czf - -C /app/server uploads > "$UPLOADS_OUT"
fi

gzip -f "$DB_OUT"
DB_OUT="$DB_OUT.gz"
success "Database  -> $DB_OUT ($(du -h "$DB_OUT" | cut -f1))"
success "Allegati  -> $UPLOADS_OUT ($(du -h "$UPLOADS_OUT" | cut -f1))"

# ── 2. Rotazione ─────────────────────────────────────────────
info "Rimozione backup piu' vecchi di $RETENTION_DAYS giorni..."
find "$BACKUP_DIR" -maxdepth 1 -name 'matrimonio-*.db.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz'   -mtime "+$RETENTION_DAYS" -delete
RIMASTI=$(find "$BACKUP_DIR" -maxdepth 1 -name 'matrimonio-*.db.gz' | wc -l)
success "Backup conservati: $RIMASTI"

echo ""
warn "Questi file sono ancora sullo stesso server: se il disco muore, muoiono con lui."
warn "Copiali altrove (rsync/rclone su NAS o cloud) per avere un backup davvero sicuro."

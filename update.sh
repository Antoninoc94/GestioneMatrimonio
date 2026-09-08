#!/bin/bash
# Script di aggiornamento - Gestione Matrimonio (Docker)
# Eseguire da: cd /opt/matrimonio && sudo bash update.sh

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="main"

[[ $EUID -ne 0 ]] && { echo "Eseguire come root: sudo bash update.sh"; exit 1; }

cd "$APP_DIR"

# Snapshot PRIMA di toccare qualsiasi cosa: se il build o la migrazione dello
# schema vanno storti, i dati sono gia' al sicuro e l'aggiornamento e' reversibile.
info "Backup di sicurezza pre-aggiornamento..."
if bash "$APP_DIR/backup.sh"; then
    success "Backup completato"
else
    echo ""
    read -p "Backup FALLITO. Continuare comunque con l'aggiornamento? [s/N] " -n 1 -r
    echo ""
    [[ ! $REPLY =~ ^[SsYy]$ ]] && { echo "Aggiornamento annullato."; exit 1; }
fi

info "Aggiornamento codice sorgente..."
git fetch origin
git pull origin $BRANCH
success "Codice aggiornato"

info "Rebuild immagine Docker..."
docker compose build --no-cache

info "Riavvio container (zero-downtime)..."
docker compose up -d --remove-orphans
success "Container aggiornato e riavviato"

# Installazioni create prima dell'introduzione di backup.sh non hanno il cron:
# lo aggiungiamo qui, cosi' arriva anche ai deploy gia' esistenti.
if ! crontab -l 2>/dev/null | grep -qF "matrimonio-backup.log"; then
    info "Configurazione backup automatico giornaliero..."
    (crontab -l 2>/dev/null; echo "0 3 * * * cd $APP_DIR && bash backup.sh >> /var/log/matrimonio-backup.log 2>&1") | crontab -
    success "Backup giornaliero alle 03:00 in /var/backups/matrimonio"
fi

echo ""
docker compose ps
echo ""
success "Aggiornamento completato!"

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

info "Aggiornamento codice sorgente..."
git fetch origin
git pull origin $BRANCH
success "Codice aggiornato"

info "Rebuild immagine Docker..."
docker compose build --no-cache

info "Riavvio container (zero-downtime)..."
docker compose up -d --remove-orphans
success "Container aggiornato e riavviato"

echo ""
docker compose ps
echo ""
success "Aggiornamento completato!"

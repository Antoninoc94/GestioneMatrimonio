#!/bin/bash
# Script di aggiornamento - Gestione Matrimonio
# Eseguire come root: sudo bash /opt/matrimonio/update.sh

set -e

APP_DIR="/opt/matrimonio"
APP_USER="matrimonio"
BRANCH="claude/wedding-management-app-szun2g"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }

[[ $EUID -ne 0 ]] && { echo "Eseguire come root: sudo bash update.sh"; exit 1; }

info "Aggiornamento codice sorgente..."
cd $APP_DIR
sudo -u $APP_USER git pull origin $BRANCH
success "Codice aggiornato"

info "Aggiornamento dipendenze server..."
cd $APP_DIR/server
sudo -u $APP_USER npm install --omit=dev --quiet

info "Aggiornamento dipendenze client e rebuild..."
cd $APP_DIR/client
sudo -u $APP_USER npm install --quiet
sudo -u $APP_USER npm run build
success "Frontend ricompilato"

info "Riavvio applicazione..."
sudo -u $APP_USER pm2 restart matrimonio
success "Applicazione riavviata"

echo ""
echo "Aggiornamento completato!"
sudo -u $APP_USER pm2 status

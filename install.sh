#!/bin/bash
# ============================================================
#  Script di installazione - Gestione Matrimonio (Docker)
#  Testato su Ubuntu 22.04 / 24.04 LTS con Docker
#  Eseguire come root: sudo bash install.sh
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# CONFIGURAZIONE
# ============================================================
REPO_URL="https://github.com/Antoninoc94/GestioneMatrimonio.git"
BRANCH="claude/wedding-management-app-szun2g"
APP_DIR="/opt/matrimonio"
PORT=80

# ============================================================

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Installazione - Gestione Matrimonio Docker  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

[[ $EUID -ne 0 ]] && error "Eseguire come root: sudo bash install.sh"

# ============================================================
# 1. AGGIORNAMENTO SISTEMA
# ============================================================
info "Aggiornamento pacchetti di sistema..."
apt-get update -qq && apt-get upgrade -y -qq
success "Sistema aggiornato"

# ============================================================
# 2. DOCKER
# ============================================================
if ! command -v docker &>/dev/null; then
    info "Installazione Docker..."
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker --quiet
    systemctl start docker
    success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') installato"
else
    success "Docker già installato: $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# ============================================================
# 3. FIREWALL
# ============================================================
if command -v ufw &>/dev/null; then
    info "Configurazione firewall..."
    ufw --force reset > /dev/null
    ufw default deny incoming > /dev/null
    ufw default allow outgoing > /dev/null
    ufw allow ssh > /dev/null
    ufw allow 80/tcp > /dev/null
    ufw allow 443/tcp > /dev/null
    ufw --force enable > /dev/null
    success "Firewall attivo (SSH, HTTP, HTTPS)"
fi

# ============================================================
# 4. CLONE REPOSITORY
# ============================================================
info "Download del codice sorgente..."
if [ -d "$APP_DIR/.git" ]; then
    warn "Directory $APP_DIR già esistente, aggiornamento..."
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" checkout $BRANCH
    git -C "$APP_DIR" pull origin $BRANCH
else
    git clone --branch $BRANCH $REPO_URL $APP_DIR
fi
success "Codice scaricato in $APP_DIR"

# ============================================================
# 5. FILE .ENV
# ============================================================
if [ ! -f "$APP_DIR/.env" ]; then
    info "Generazione .env con JWT_SECRET casuale..."
    JWT_SECRET=$(openssl rand -hex 32)
    echo "JWT_SECRET=${JWT_SECRET}" > $APP_DIR/.env
    chmod 600 $APP_DIR/.env
    success ".env creato"
else
    success ".env già presente, non sovrascritto"
fi

# ============================================================
# 6. BUILD E AVVIO CONTAINER
# ============================================================
info "Build immagine Docker (richiede qualche minuto)..."
cd $APP_DIR
docker compose build --no-cache

info "Avvio container..."
docker compose up -d

success "Container avviato"

# ============================================================
# 7. VERIFICA
# ============================================================
info "Attesa avvio applicazione..."
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker compose ps --format json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/api/dashboard 2>/dev/null | grep -qE "401|200"; then
        success "Applicazione avviata e raggiungibile"
        break
    fi
    [[ $i -eq 12 ]] && warn "Timeout verifica — controlla con: docker compose logs -f"
    echo -n "."
done
echo ""

# ============================================================
# RIEPILOGO
# ============================================================
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             Installazione completata con successo!           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}URL app:${NC}         http://${IP}/"
echo ""
echo -e "  ${GREEN}Credenziali predefinite:${NC}"
echo "    Sposo:  sposo@matrimonio.it  /  sposo1"
echo "    Sposa:  sposa@matrimonio.it  /  sposa1"
echo ""
echo -e "  ${YELLOW}IMPORTANTE: cambia le password subito dopo il primo accesso!${NC}"
echo ""
echo -e "  ${BLUE}Comandi utili:${NC}"
echo "    Stato:         cd $APP_DIR && docker compose ps"
echo "    Log live:      cd $APP_DIR && docker compose logs -f"
echo "    Riavvia:       cd $APP_DIR && docker compose restart"
echo "    Aggiorna:      cd $APP_DIR && bash update.sh"
echo "    Stop:          cd $APP_DIR && docker compose down"
echo ""
echo -e "  ${BLUE}Backup dati:${NC}"
echo "    docker run --rm -v matrimonio_db:/data -v \$(pwd):/backup alpine"
echo "      tar czf /backup/db-backup-\$(date +%Y%m%d).tar.gz /data"
echo ""

#!/bin/bash
# ============================================================
#  Script di installazione - Gestione Matrimonio
#  Testato su Ubuntu 22.04 / 24.04 LTS
#  Eseguire come root oppure con sudo:
#    sudo bash install.sh
# ============================================================

set -e  # Esce al primo errore

# ---------- Colori per output ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# CONFIGURAZIONE - modifica questi valori prima di eseguire
# ============================================================

REPO_URL="https://github.com/Antoninoc94/GestioneMatrimonio.git"
BRANCH="claude/wedding-management-app-szun2g"
APP_DIR="/opt/matrimonio"
APP_USER="matrimonio"                  # utente di sistema dedicato
NODE_VERSION="22"                      # versione Node.js LTS
PORT=3001                              # porta del server Node
DOMAIN=""                              # es. matrimonio.example.com (lascia vuoto per usare solo IP)

# Password da cambiare SUBITO dopo l'installazione tramite l'app
JWT_SECRET=$(openssl rand -hex 32)

# ============================================================

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     Installazione - Gestione Matrimonio      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ----- Verifica root -----
[[ $EUID -ne 0 ]] && error "Eseguire come root: sudo bash install.sh"

# ============================================================
# 1. AGGIORNAMENTO SISTEMA
# ============================================================
info "Aggiornamento pacchetti di sistema..."
apt-get update -qq
apt-get upgrade -y -qq
success "Sistema aggiornato"

# ============================================================
# 2. DIPENDENZE DI BASE
# ============================================================
info "Installazione dipendenze di base..."
apt-get install -y -qq \
    curl wget git build-essential \
    nginx ufw openssl ca-certificates \
    gnupg2 lsb-release
success "Dipendenze installate"

# ============================================================
# 3. NODE.JS (via NodeSource)
# ============================================================
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
    info "Installazione Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - -qq
    apt-get install -y -qq nodejs
    success "Node.js $(node -v) installato"
else
    success "Node.js già installato: $(node -v)"
fi

# ============================================================
# 4. PM2 (process manager)
# ============================================================
if ! command -v pm2 &>/dev/null; then
    info "Installazione PM2..."
    npm install -g pm2 --quiet
    success "PM2 installato"
else
    success "PM2 già installato"
fi

# ============================================================
# 5. UTENTE DI SISTEMA
# ============================================================
if ! id "$APP_USER" &>/dev/null; then
    info "Creazione utente di sistema '$APP_USER'..."
    useradd -r -m -d /home/$APP_USER -s /bin/bash $APP_USER
    success "Utente '$APP_USER' creato"
else
    success "Utente '$APP_USER' già esistente"
fi

# ============================================================
# 6. CLONE REPOSITORY
# ============================================================
info "Download del codice sorgente..."
if [ -d "$APP_DIR" ]; then
    warn "Directory $APP_DIR già esistente, aggiornamento in corso..."
    cd "$APP_DIR"
    sudo -u $APP_USER git fetch origin
    sudo -u $APP_USER git checkout $BRANCH
    sudo -u $APP_USER git pull origin $BRANCH
else
    sudo -u $APP_USER git clone --branch $BRANCH $REPO_URL $APP_DIR
fi
success "Codice scaricato in $APP_DIR"

# ============================================================
# 7. INSTALLAZIONE DIPENDENZE NODE
# ============================================================
info "Installazione dipendenze server..."
cd $APP_DIR/server
sudo -u $APP_USER npm install --omit=dev --quiet
success "Dipendenze server installate"

info "Installazione dipendenze client..."
cd $APP_DIR/client
sudo -u $APP_USER npm install --quiet
success "Dipendenze client installate"

# ============================================================
# 8. BUILD REACT
# ============================================================
info "Compilazione frontend React..."
cd $APP_DIR/client
sudo -u $APP_USER npm run build
success "Frontend compilato in client/dist/"

# ============================================================
# 9. FILE .ENV DEL SERVER
# ============================================================
info "Configurazione variabili d'ambiente..."
cat > $APP_DIR/server/.env << EOF
JWT_SECRET=${JWT_SECRET}
PORT=${PORT}
NODE_ENV=production
EOF
chown $APP_USER:$APP_USER $APP_DIR/server/.env
chmod 600 $APP_DIR/server/.env
success "File .env creato (JWT_SECRET generato)"

# ============================================================
# 10. DIRECTORY UPLOADS
# ============================================================
mkdir -p $APP_DIR/server/uploads
chown -R $APP_USER:$APP_USER $APP_DIR
chmod 755 $APP_DIR/server/uploads
success "Directory uploads configurata"

# ============================================================
# 11. PM2 - AVVIO E PERSISTENZA
# ============================================================
info "Configurazione PM2..."

# File di configurazione PM2
cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'matrimonio',
    script: 'server/index.js',
    cwd: '${APP_DIR}',
    user: '${APP_USER}',
    env: {
      NODE_ENV: 'production',
      PORT: ${PORT}
    },
    restart_delay: 3000,
    max_restarts: 10,
    log_file: '/var/log/matrimonio/app.log',
    error_file: '/var/log/matrimonio/error.log',
    time: true
  }]
};
EOF

mkdir -p /var/log/matrimonio
chown $APP_USER:$APP_USER /var/log/matrimonio

# Avvia l'app con PM2 (come utente dedicato)
sudo -u $APP_USER pm2 start $APP_DIR/ecosystem.config.js
sudo -u $APP_USER pm2 save

# Configura PM2 per partire all'avvio del sistema
PM2_STARTUP=$(sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER | grep "sudo")
if [ -n "$PM2_STARTUP" ]; then
    eval "$PM2_STARTUP"
fi

success "PM2 configurato (l'app riparte automaticamente al riavvio)"

# ============================================================
# 12. NGINX - REVERSE PROXY
# ============================================================
info "Configurazione Nginx..."

NGINX_CONF="/etc/nginx/sites-available/matrimonio"

if [ -n "$DOMAIN" ]; then
    SERVER_NAME="$DOMAIN"
else
    SERVER_NAME="_"  # risponde a qualsiasi IP
    warn "DOMAIN non impostato: Nginx risponderà sull'IP della VM"
fi

cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    # Limite dimensione upload (10 MB)
    client_max_body_size 10M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy verso Node.js
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    # Cache assets statici
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        proxy_pass http://127.0.0.1:${PORT};
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# Abilita il sito
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/matrimonio
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
success "Nginx configurato"

# ============================================================
# 13. FIREWALL (UFW)
# ============================================================
info "Configurazione firewall..."
ufw --force reset > /dev/null
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow ssh > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw --force enable > /dev/null
success "Firewall attivo (SSH, HTTP, HTTPS)"

# ============================================================
# 14. VERIFICA FINALE
# ============================================================
info "Verifica avvio applicazione..."
sleep 3

if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/api/dashboard 2>/dev/null | grep -q "401"; then
    success "Server risponde correttamente (401 = login richiesto, tutto ok)"
else
    warn "Il server potrebbe impiegare qualche secondo in più ad avviarsi"
    warn "Controlla con: sudo -u $APP_USER pm2 logs matrimonio"
fi

# ============================================================
# RIEPILOGO FINALE
# ============================================================
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             Installazione completata con successo!           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}URL app:${NC}         http://${IP}/"
[ -n "$DOMAIN" ] && echo -e "  ${GREEN}Dominio:${NC}         http://${DOMAIN}/"
echo ""
echo -e "  ${GREEN}Credenziali:${NC}"
echo "    Sposo:  sposo@matrimonio.it  /  sposo1"
echo "    Sposa:  sposa@matrimonio.it  /  sposa1"
echo ""
echo -e "  ${YELLOW}IMPORTANTE: cambia le password subito dopo il primo accesso!${NC}"
echo ""
echo -e "  ${BLUE}Comandi utili:${NC}"
echo "    Stato app:     sudo -u $APP_USER pm2 status"
echo "    Log app:       sudo -u $APP_USER pm2 logs matrimonio"
echo "    Riavvia app:   sudo -u $APP_USER pm2 restart matrimonio"
echo "    Aggiorna app:  sudo bash $APP_DIR/update.sh"
echo ""
echo -e "  ${BLUE}File importanti:${NC}"
echo "    Codice:        $APP_DIR/"
echo "    Database:      $APP_DIR/server/matrimonio.db"
echo "    Documenti:     $APP_DIR/server/uploads/"
echo "    Log:           /var/log/matrimonio/"
echo ""

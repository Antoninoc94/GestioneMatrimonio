# ── Stage 1: build React ──────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci --quiet
COPY client/ ./
RUN npm run build

# ── Stage 2: runtime Node.js ──────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Dipendenze server (solo produzione)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --quiet

# Codice server + frontend compilato
COPY server/ ./server/
COPY --from=builder /build/client/dist ./client/dist

# Directory dati persistenti
RUN mkdir -p /app/data /app/server/uploads

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/api/dashboard || exit 1

CMD ["node", "server/index.js"]

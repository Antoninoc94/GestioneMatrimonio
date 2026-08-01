# ── Stage 1: build React ──────────────────────────────────────
FROM node:22-alpine AS react-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci --quiet
COPY client/ ./
RUN npm run build

# ── Stage 2: compilazione dipendenze native (better-sqlite3) ──
FROM node:22-alpine AS server-builder
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --quiet

# ── Stage 3: runtime minimale ─────────────────────────────────
FROM node:22-alpine AS runner
# libstdc++ serve a better-sqlite3 a runtime
RUN apk add --no-cache libstdc++
WORKDIR /app

# node_modules già compilati dallo stage precedente
COPY --from=server-builder /app/server/node_modules ./server/node_modules

# Codice server + frontend compilato
COPY server/ ./server/
COPY --from=react-builder /build/client/dist ./client/dist

# Directory dati persistenti
RUN mkdir -p /app/data /app/server/uploads

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["node", "server/index.js"]

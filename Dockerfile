# syntax=docker/dockerfile:1

# Single-process production image: the Express API also serves the built client
# (client/dist) and the read-only guides, exactly as documented in the README.
# Node 24 is used so node:sqlite works without an experimental flag.

############################################
# Stage 1 — build server (tsc) + client (vite)
############################################
FROM node:26-bookworm-slim AS build
WORKDIR /app

# Copy manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

# Build both workspaces: server -> server/dist, client -> client/dist.
COPY . .
RUN npm run build

############################################
# Stage 2 — production dependencies only
############################################
FROM node:26-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
# Runs sharp's postinstall so its native linux binary is fetched for this base image.
RUN npm ci --omit=dev

############################################
# Stage 3 — lean runtime
############################################
FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production \
    API_PORT=8787
# The server resolves ../client/dist and ../Associated Guide from its own dir,
# so the monorepo layout must be preserved under /app.
WORKDIR /app/server

# Production node_modules (root-hoisted by npm workspaces) + compiled/built assets.
COPY --from=deps  /app/node_modules            /app/node_modules
COPY --from=deps  /app/package.json            /app/package.json
COPY --from=build /app/server/package.json     /app/server/package.json
COPY --from=build /app/server/dist             /app/server/dist
COPY --from=build /app/client/dist             /app/client/dist
COPY --from=build ["/app/Associated Guide", "/app/Associated Guide"]

# App data (SQLite db + uploaded media + thumbnails) — persist via a volume.
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
VOLUME ["/app/server/data"]

EXPOSE 8787
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||8787)+'/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

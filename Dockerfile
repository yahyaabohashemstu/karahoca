# syntax=docker/dockerfile:1.7

# ═══════════════════════════════════════════════════════════════════════════
# KARAHOCA production Dockerfile
# ─────────────────────────────────────────────────────────────────────────
# Multi-stage:
#   1. `deps`     — install EVERY dependency (incl. devDeps) with reproducible lockfile
#   2. `builder`  — run `tsc -b && vite build` (prerender step is INTENTIONALLY
#                   skipped here: headless Chromium is too heavy for a
#                   production image; set PRERENDER_IN_BUILD=1 to enable).
#   3. `prod-deps`— install ONLY production deps (better-sqlite3, ioredis,
#                   bcryptjs, cookie, jsonwebtoken, resend, react runtime is
#                   bundled by Vite so only runtime deps for the Node API).
#   4. `runtime`  — slim final image: bundled dist/ + server/ + prod
#                   node_modules. Runs as the built-in `node` user, never root.
#
# Build:   docker build -t karahoca:latest .
# Run:     docker run -p 5000:5000 --env-file .env karahoca:latest
# Health:  docker run ... --health-cmd='wget -qO- http://localhost:5000/api/health | grep -q ok'
# ═══════════════════════════════════════════════════════════════════════════

ARG NODE_VERSION=22-alpine

# ─── Stage 1: full deps (build-time) ───────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# Build toolchain for native modules (better-sqlite3, bcrypt, sharp).
# Purged in the final image — only needed here.
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts=false

# ─── Stage 2: client + server build ───────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Skip prerender in the Docker build (Chromium is ~170 MB and the current
# build can override meta server-side via injectMeta). To enable prerender
# inside the image, install puppeteer + chromium in stage `deps` and run
# `npm run build` (with prerender) instead.
RUN npm run build:nopp

# ─── Stage 3: production-only deps (drops devDeps + build tools) ──────────
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts=false \
  && npm cache clean --force

# ─── Stage 4: minimal runtime ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    # Let libuv use all available CPUs for bcrypt / crypto work.
    UV_THREADPOOL_SIZE=8

# Runtime shared libraries required by better-sqlite3 and sharp.
RUN apk add --no-cache libstdc++ libgcc \
  && rm -rf /var/cache/apk/*

# Copy production-only deps
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json

# Copy server source + built SPA
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/server-bootstrap.mjs ./server-bootstrap.mjs
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/src/locales ./src/locales

# SQLite data directory (mount as a named volume in production!).
RUN mkdir -p /app/server/data \
  && chown -R node:node /app/server/data

# Drop privileges — NEVER run as root.
USER node

EXPOSE 5000

# Health probe — Coolify / K8s / Docker can use this directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server-bootstrap.mjs"]

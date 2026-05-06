# syntax=docker/dockerfile:1.7

# ═══════════════════════════════════════════════════════════════════════════
# KARAHOCA production Dockerfile
# ─────────────────────────────────────────────────────────────────────────
# Multi-stage:
#   1. `deps`      — install EVERY dependency (incl. devDeps) on Debian so
#                    puppeteer's postinstall Chromium downloads cleanly.
#   2. `builder`   — run `tsc -b && vite build && optimize-images && prerender`.
#                    The Debian base gives us glibc + system libs Chromium
#                    needs to execute, so we can run the full build on the
#                    exact same image the dependency postinstall targeted.
#   3. `prod-deps` — install ONLY production deps on Alpine for a slim
#                    runtime layer. better-sqlite3 and sharp are native
#                    modules built against the final Alpine image.
#   4. `runtime`   — Alpine-based minimal final image: bundled dist/ +
#                    server/ + prod node_modules. Chromium is NOT carried
#                    over; it only existed for the build step.
#
# Build:   docker build -t karahoca:latest .
# Run:     docker run -p 5000:5000 --env-file .env karahoca:latest
# Health:  docker run ... --health-cmd='wget -qO- http://localhost:5000/api/health | grep -q ok'
# ═══════════════════════════════════════════════════════════════════════════

ARG NODE_VERSION=22

# ─── Stage 1: full deps (build-time, Debian so Chromium works) ──────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
# Pin the Puppeteer cache path BEFORE `npm ci` so the postinstall script
# downloads Chromium into a location the `builder` stage can predictably
# COPY from. Without this env, Puppeteer writes to its default location
# (`~/.cache/puppeteer`, i.e. `/root/.cache/puppeteer`), and the builder
# stage's `COPY --from=deps /app/.cache/puppeteer` fails with
# "/app/.cache/puppeteer not found".
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
# Chromium system libs for Puppeteer + build toolchain for native modules.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libxkbcommon0 xdg-utils \
    wget \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts=false

# ─── Stage 2: client + server build + prerender ────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
# Puppeteer sometimes needs the executable path to be explicit.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
# Re-install the runtime libs Chromium links against (system libs are per-
# stage). Build tooling is NOT needed here because deps already compiled
# everything; we only need the shared .so files Chromium loads at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libxkbcommon0 xdg-utils \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.cache/puppeteer ./.cache/puppeteer
COPY . .
# Full build pipeline — TypeScript → Vite → image optimiser → Puppeteer
# prerender. The prerender script is explicitly best-effort (exits 0 on
# Chromium boot failure) so build-time Chromium issues don't wedge the
# image; CI in .github/workflows/ci.yml is the authoritative gate.
RUN npm run build

# ─── Stage 3: production-only deps (Alpine, slim runtime) ──────────────────
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts=false \
  && npm cache clean --force

# ─── Stage 4: minimal runtime ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
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

# Copy server source + built SPA (already includes prerendered per-language
# subdirectories under dist/{ar,en,tr,ru}/ when Puppeteer succeeded).
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

# Health probe — Coolify / K8s / Docker can use this directly. Note the
# probe returns 503 when the DB is down (see server/routes/api-health.mjs),
# so this HEALTHCHECK correctly fails the container under real degradation.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server-bootstrap.mjs"]

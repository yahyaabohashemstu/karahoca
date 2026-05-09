# syntax=docker/dockerfile:1.7

# ═══════════════════════════════════════════════════════════════════════════
# KARAHOCA frontend Dockerfile (static SPA served by nginx)
# ─────────────────────────────────────────────────────────────────────────
# Multi-stage:
#   1. `builder`  — Node 22 + sharp build deps. Runs `tsc -b && vite build
#                   && optimize-images && prune-dist`. Prerender is skipped
#                   because that step needs the backend running and we want
#                   the frontend image to be deployable independently.
#   2. `runtime`  — nginx:alpine serving /usr/share/nginx/html (= dist/).
#                   See ./nginx.conf for SPA fallback + cache headers.
#
# Build-time env:
#   VITE_BACKEND_URL  — REQUIRED. The frontend is statically compiled
#                       against this URL, so changing it requires rebuilding.
#                       Example: https://api.karahoca.com
#
# Build:  docker build -f web/Dockerfile \
#                      --build-arg VITE_BACKEND_URL=https://api.karahoca.com \
#                      -t karahoca-web:latest .
# Run:    docker run -p 8080:80 karahoca-web:latest
# ═══════════════════════════════════════════════════════════════════════════

ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27-alpine

# ─── Stage 1: build dist/ ───────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

# Build toolchain for sharp's native bindings (image-optimization step).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's Chromium download — we don't run prerender in this image.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

COPY package.json package-lock.json ./
# `--include=dev` forces devDependencies despite NODE_ENV=production above —
# vite, @vitejs/plugin-react, typescript, sharp all live there and the build
# step below cannot run without them.
# `--ignore-scripts=false` lets sharp install its prebuilt binary postinstall;
# Puppeteer's postinstall is gated by PUPPETEER_SKIP_DOWNLOAD above.
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

# VITE_* must be ARGs so they reach `vite build` as compile-time constants.
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

# Vite build pipeline minus prerender (prerender needs a running backend).
RUN npx tsc -b \
  && npx vite build \
  && node scripts/optimize-images.mjs \
  && node scripts/prune-dist.mjs

# ─── Stage 2: nginx serves dist/ ────────────────────────────────────────────
FROM nginx:${NGINX_VERSION} AS runtime

# Replace nginx's default site config with our SPA-aware one.
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

# Drop the built SPA into nginx's web root.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Health probe — Coolify / K8s / Docker can use this directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# nginx:alpine's default CMD already runs nginx in the foreground.

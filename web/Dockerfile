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
# Build-time env (every VITE_* must be declared as ARG + ENV below so
# Vite can inline its value into the bundle at compile time):
#
#   VITE_BACKEND_URL                — REQUIRED. Public API origin. The SPA
#                                     prefixes every fetch with this. Example:
#                                     https://api.karahoca.com
#   VITE_GA_MEASUREMENT_ID          — Optional. GA4 measurement ID
#                                     (format: G-XXXXXXXXXX). Empty disables
#                                     all client-side analytics initialisation.
#   VITE_GA_PROPERTY_ID             — Optional. Numeric GA4 property ID used
#                                     by the admin /admin/analytics dashboard
#                                     (format: 123456789 — digits only).
#   VITE_SENTRY_DSN                 — Optional. Sentry browser SDK DSN. Empty
#                                     disables Sentry client init.
#   VITE_SENTRY_TRACES_SAMPLE_RATE  — Optional. Float 0.0–1.0; default 0.1.
#   VITE_APP_VERSION                — Optional. Stamped onto Sentry events.
#   VITE_CATALOG_BASE_URL           — Optional. CDN origin for /Catalog/*.
#
# Build:  docker build -f web/Dockerfile \
#                      --build-arg VITE_BACKEND_URL=https://api.karahoca.com \
#                      --build-arg VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX \
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

# Every VITE_* must be declared as `ARG` AND re-exported as `ENV` so it
# reaches `vite build` further down. The ARG line ALONE lets `docker build
# --build-arg` accept the value, but Vite reads `process.env`; without the
# matching `ENV` line the variable is silently dropped between the build-arg
# stage and the `RUN npx vite build` stage.
#
# Adding a new VITE_* in source code? You MUST add the matching ARG + ENV
# pair below before re-deploying — otherwise `import.meta.env.VITE_*` will
# resolve to `undefined` in the production bundle. (Coolify won't warn you;
# the build-arg gets passed in, the Dockerfile silently rejects it.)
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

ARG VITE_GA_MEASUREMENT_ID
ENV VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}

ARG VITE_GA_PROPERTY_ID
ENV VITE_GA_PROPERTY_ID=${VITE_GA_PROPERTY_ID}

ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

ARG VITE_SENTRY_TRACES_SAMPLE_RATE
ENV VITE_SENTRY_TRACES_SAMPLE_RATE=${VITE_SENTRY_TRACES_SAMPLE_RATE}

ARG VITE_APP_VERSION
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

ARG VITE_CATALOG_BASE_URL
ENV VITE_CATALOG_BASE_URL=${VITE_CATALOG_BASE_URL}

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

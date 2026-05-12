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
# `compress-static.mjs` creates `.gz` and `.br` siblings of every text
# asset so nginx can serve pre-compressed responses without per-request
# CPU cost. See scripts/compress-static.mjs for rationale.
RUN npx tsc -b \
  && npx vite build \
  && node scripts/optimize-images.mjs \
  && node scripts/prune-dist.mjs \
  && node scripts/compress-static.mjs

# ─── Stage 2: nginx serves dist/ ────────────────────────────────────────────
FROM nginx:${NGINX_VERSION} AS runtime

# Replace nginx's default site config with our SPA-aware one. We do this
# BEFORE the brotli attempt so the validation step below can test the
# real, final configuration.
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

# Drop the built SPA into nginx's web root.
COPY --from=builder /app/dist /usr/share/nginx/html

# ─── Brotli module: best-effort install with auto-fallback ─────────────────
# Alpine ships `nginx-mod-http-brotli` precompiled against the nginx version
# that ALPINE'S nginx package was built with — which is often DIFFERENT
# from the version baked into the upstream nginx Docker image (the upstream
# tags lead Alpine's repo by a point release or two). When that happens
# the module fails to load with:
#
#     [emerg] module ".../ngx_http_brotli_filter_module.so" version 1026003
#     instead of 1027005 in /etc/nginx/nginx.conf:1
#
# and nginx never starts. The fallback below detects that scenario at
# build time and degrades to gzip-only by:
#   1. Installing the brotli module (best effort).
#   2. Adding `load_module` lines to /etc/nginx/nginx.conf.
#   3. Running `nginx -t` to validate the full config.
#   4. If validation fails, ripping out the `load_module` lines AND
#      commenting out every `brotli*` directive in our site config so
#      nginx starts cleanly with gzip alone.
#   5. Running `nginx -t` again — this time we EXPECT success. If it
#      still fails, the build fails loudly (we'd rather see the error
#      during `docker build` than at production startup).
#
# Net behaviour:
#   • Module compatible    → Brotli + gzip both active (best case).
#   • Module incompatible  → gzip_static + on-the-fly gzip only.
#   • Module unavailable   → gzip_static + on-the-fly gzip only.
RUN set -eu; \
    apk add --no-cache nginx-mod-http-brotli 2>/dev/null || \
      echo "[brotli] package not available in apk; skipping install"; \
    if [ -f /usr/lib/nginx/modules/ngx_http_brotli_filter_module.so ]; then \
      echo "[brotli] module file found, attempting to load"; \
      sed -i '1i load_module modules/ngx_http_brotli_filter_module.so;' /etc/nginx/nginx.conf; \
      sed -i '2i load_module modules/ngx_http_brotli_static_module.so;' /etc/nginx/nginx.conf; \
      if nginx -t 2>/dev/null; then \
        echo "[brotli] ✓ module loaded successfully"; \
      else \
        echo "[brotli] ✗ module incompatible with nginx version — falling back to gzip-only"; \
        sed -i '/load_module.*ngx_http_brotli/d' /etc/nginx/nginx.conf; \
        sed -i 's/^\(\s*\)brotli/\1#brotli/g' /etc/nginx/conf.d/default.conf; \
      fi; \
    else \
      echo "[brotli] module file absent — running gzip-only"; \
      sed -i 's/^\(\s*\)brotli/\1#brotli/g' /etc/nginx/conf.d/default.conf; \
    fi; \
    nginx -t

EXPOSE 80

# Health probe — Coolify / K8s / Docker can use this directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# nginx:alpine's default CMD already runs nginx in the foreground.

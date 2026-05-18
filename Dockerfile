# syntax=docker/dockerfile:1.7

# ═══════════════════════════════════════════════════════════════════════════
# KARAHOCA backend Dockerfile (API only — no SPA)
# ─────────────────────────────────────────────────────────────────────────
# This image used to build + serve the SPA too. The frontend has been split
# off to a separate nginx image (see web/Dockerfile), so this image is now
# a pure Node.js API server: no Vite, no Puppeteer, no Chromium, no `dist/`.
#
# Multi-stage:
#   1. `prod-deps` — install ONLY production deps on Alpine. better-sqlite3
#                    has prebuilt binaries; we install python3/make/g++ as a
#                    safety net for arch/version combos without prebuilds.
#   2. `runtime`   — minimal Alpine image: prod node_modules + server/ +
#                    src/locales/ (the i18n JSON the API reads at startup).
#
# Build:   docker build -t karahoca-api:latest .
# Run:     docker run -p 5000:5000 --env-file .env karahoca-api:latest
# Health:  GET /api/health → { ok: true }
# ═══════════════════════════════════════════════════════════════════════════

ARG NODE_VERSION=22

# ─── Stage 1: production-only deps ──────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app

# Build tools for any native modules whose prebuild doesn't cover this
# arch/libc combo. Removed from the final image — runtime only needs the
# compiled .node files that survive the COPY.
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
# `--omit=dev` skips Vite, puppeteer, typescript, eslint — none of which
# the API uses at runtime. `sharp` lives in `dependencies` (not devDeps)
# because the runtime OG-image generator needs it to rasterise product
# share cards (see server/services/ogImage.mjs). The prebuilt musl
# binary ships in the npm tarball, no compilation required.
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts=false \
  && npm cache clean --force

# ─── Stage 2: minimal runtime ───────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    # Let libuv use all available CPUs for bcrypt / crypto work.
    UV_THREADPOOL_SIZE=8

# Runtime shared libraries:
#   - libstdc++ / libgcc  → required by better-sqlite3 native binary.
#   - fontconfig          → required by sharp's librsvg pipeline when
#                            rasterising SVGs that contain <text>.
#   - font-noto-arabic    → covers Arabic glyphs in the OG-image
#                            generator's fallback card. Without it,
#                            librsvg falls back to the default font
#                            that doesn't include Arabic and every
#                            Arabic character renders as a tofu box (□).
#   - font-noto           → base Noto for Latin + Cyrillic so EN / TR /
#                            RU text in the same template renders too.
#                            (font-noto is small, ~3 MB; the Arabic
#                            variant adds another ~2 MB.)
RUN apk add --no-cache \
      libstdc++ libgcc \
      fontconfig \
      font-noto font-noto-arabic \
  && fc-cache -f \
  && rm -rf /var/cache/apk/*

# Copy production-only deps (no compilers, no devDeps).
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json

# Server source + bootstrap. src/locales/ is read by services/db.mjs at
# startup to seed translatable catalog data.
COPY --chown=node:node server ./server
COPY --chown=node:node server-bootstrap.mjs ./server-bootstrap.mjs
COPY --chown=node:node src/locales ./src/locales

# SQLite data directory (mount as a named volume in production!).
RUN mkdir -p /app/server/data \
  && chown -R node:node /app/server/data

# Drop privileges — NEVER run as root.
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server-bootstrap.mjs"]

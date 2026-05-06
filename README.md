<div align="center">

<img src="public/karahoca-logo.png" alt="Karahoca Logo" width="120" />

# Karahoca Kimya — Official Website

**Production-grade multi-language corporate site** for Karahoca Kimya
React 18 · TypeScript · Vite · Node.js · SQLite · Redis · OpenRouter · Resend

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Redis](https://img.shields.io/badge/Redis-ioredis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![i18n](https://img.shields.io/badge/i18n-AR%20·%20EN%20·%20TR%20·%20RU-F97316?style=flat-square)](https://www.i18next.com)
[![Tests](https://img.shields.io/badge/tests-81%20passing-22c55e?style=flat-square)](#-testing)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](#)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Admin Dashboard](#-admin-dashboard)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Performance](#-performance)
- [Internationalization](#-internationalization)
- [Testing](#-testing)
- [CI/CD](#-cicd)
- [Deployment](#-deployment)
- [Contact](#-contact)

---

## Overview

Official web presence for **Karahoca Kimya**, a Turkish manufacturer of household and industrial cleaning products. Publicly facing surface:

- **Marketing pages** — Home, About, Production, Goal, Dryer, Partners
- **Brand pages** — DIOX and AYLUX product lines with interactive flipbook catalogs
- **News & Blog** — Multi-language articles with an admin CMS
- **AI Chat Assistant** — OpenRouter-powered (Gemma 3 27B by default), server-side prompt building, DB-backed knowledge base
- **Newsletter** — Double-opt-in subscribe, tokenised one-click unsubscribe, campaign dispatch via Resend
- **Admin Dashboard** — CRUD for products, news, subscribers, campaigns, analytics, AI knowledge base

Four languages with **URL-prefixed routing** (`/ar/...`, `/en/...`, `/tr/...`, `/ru/...`) for proper `hreflang` SEO, full RTL support for Arabic, SSG prerendering per language.

---

## Architecture

### Two-service deployment

```
                          ┌──────────────────────┐
                          │   karahoca.com       │
                          │   (nginx / Coolify)  │
                          └──────┬───────────────┘
                                 │ serves dist/ (prerendered SPA)
                                 │ proxies /api/ to backend
                                 ▼
       ┌────────────────────────────────────────────────┐
       │            Node.js API (pure http)              │
       │                                                  │
       │  middlewares/  cors · csrf · bodyParser · security │
       │                publicCsrf · adminAuth · errorHandler│
       │                                                  │
       │  routes/      api-chat · api-ai-context · api-health│
       │                api-newsletter · api-misc · sitemap │
       │                static-spa · public-data           │
       │                admin-*                            │
       │                                                  │
       │  services/    db (SQLite) · safeUpdate · publicCache│
       │                                                  │
       │  redisClient (with in-memory fallback)            │
       │  schedulers   news · campaigns · backup           │
       └──────────────────────────┬────────────────────────┘
                                  │
              ┌───────────────────┼─────────────────────┐
              ▼                   ▼                     ▼
      ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐
      │ SQLite       │    │ Redis        │    │ External APIs       │
      │ (persistent  │    │ (cache +     │    │ · OpenRouter (AI)   │
      │  volume)     │    │  rate-limit) │    │ · Resend (email)    │
      │  backups →   │    │              │    │ · Sentry (errors)   │
      │  S3/R2       │    │              │    │ · Google Analytics  │
      └──────────────┘    └──────────────┘    └────────────────────┘
```

### Key design decisions

| Concern | Decision |
|---|---|
| **HTTP layer** | Pure Node.js `http` module, no Express. Explicit routing in `server/server.mjs`. |
| **Database** | `better-sqlite3` synchronous API on a persistent volume. Online backups via `db.backup()` with S3/R2 rotation. |
| **Cache / rate-limiting** | Redis primary, in-memory Map fallback. App never crashes if Redis is down. |
| **SQL safety** | All admin UPDATEs go through `services/safeUpdate.mjs` — identifier allowlist validated at setup, prepared statements cached per column subset. |
| **CSRF** | Double-submit cookie. Separate tokens for admin (`SameSite=Strict`) and public endpoints (`SameSite=Lax`, issued on every HTML response). |
| **Frontend routing** | URL-prefixed locales (`/ar/`, `/en/`, etc.) → real hreflang SEO, language-correct canonicals. |
| **Prerender** | Per-language SSG via Puppeteer: `dist/{ar,en,tr,ru}/<route>/index.html`. |
| **Component shape** | God-components split into folders (`AIChat/`, `BrandPage/`) with memoised leaf components and extracted hooks (`useChatState`, `useFlipBookLoader`). |
| **Resilience** | `/api/health` fails closed on DB loss. Frontend `BackendStatusBanner` surfaces an unreachable API without gating the whole site. |

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | ~5.8 | Type safety |
| Vite | 7.x | Build tool & dev server |
| React Router | 7.x | URL-prefixed client-side routing |
| i18next + react-i18next | 25.x / 16.x | Internationalization (ar/en/tr/ru) |
| react-helmet-async | 2.x | SEO, hreflang, canonical, JSON-LD |
| react-markdown + remark-gfm | 10.x / 4.x | Markdown rendering in chat |
| pdfjs-dist | 5.x | Client-side PDF rendering (FlipBook fallback) |
| @fontsource/inter | 5.x | Self-hosted Inter font (no Google CDN) |
| @sentry/react | 10.x | Error telemetry (optional, DSN-gated) |
| react-ga4 | 2.x | Google Analytics 4 |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22+ | Runtime (pure `http` module, no Express) |
| better-sqlite3 | 12.x | Embedded SQLite |
| ioredis | 5.x | Redis client (optional, auto-fallback) |
| jsonwebtoken | 9.x | Admin JWT (configurable expiry) |
| bcryptjs | 3.x | Password hashing (cost factor 10) |
| cookie | 1.x | Typed cookie serialisation |
| pino + pino-http | 10.x / 11.x | Structured logging |
| @sentry/node | 10.x | Server-side error telemetry (optional) |
| @aws-sdk/client-s3 | 3.x | S3-compatible backup upload (R2 / AWS / DO Spaces / MinIO) |
| Resend | 6.x | Transactional email + newsletters |
| sharp | 0.34 | Build-time image optimisation |
| puppeteer | 24.x | Per-language SSG prerender |

### Dev & Ops

| Tool | Purpose |
|---|---|
| Vitest | Server unit + integration tests |
| ESLint + typescript-eslint | Linting |
| GitHub Actions | CI (typecheck, lint, tests, build with Chromium) |
| Docker (multi-stage) | Debian builder for Puppeteer, Alpine runtime for size |

---

## Project Structure

```
karahoca-react-vite/
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # Typecheck + lint + tests + full build gate
│
├── src/
│   ├── components/
│   │   ├── AIChat/                   # AI chat orchestrator + sub-components
│   │   │   ├── index.tsx                 # Memoised root (replaces old AIChatWidget.tsx)
│   │   │   ├── ChatShell.tsx             # Expanded window layout
│   │   │   ├── MessageList.tsx           # Transcript + loading dots
│   │   │   ├── MessageInput.tsx          # Textarea + send button
│   │   │   └── SuggestionChips.tsx       # Quick-reply chips
│   │   │
│   │   ├── BrandPage/                # Brand landing template
│   │   │   ├── index.tsx                 # Memoised orchestrator
│   │   │   ├── BrandHero.tsx             # Hero + about sections
│   │   │   ├── ProductGrid.tsx           # Category × product cards
│   │   │   ├── ProductModal.tsx          # Native <dialog> gallery + WhatsApp share
│   │   │   └── types.ts
│   │   │
│   │   ├── BackendStatusBanner.tsx   # Non-blocking banner when /api/health is unreachable
│   │   ├── ErrorBoundary.tsx         # Catches render errors, forwards to Sentry
│   │   ├── FlipBook.tsx              # Interactive PDF/image catalog viewer
│   │   ├── Header.tsx · Footer.tsx · LanguageSwitcher.tsx · SEO.tsx · SchemaOrg.tsx
│   │   └── (other leaf components)
│   │
│   ├── hooks/
│   │   ├── useChatState.ts           # Chat state machine + side effects + prompt build
│   │   ├── useFlipBookLoader.ts      # Image + PDF loading for FlipBook
│   │   ├── useLocalizedPath.ts       # lp('/about') → '/ar/about'
│   │   ├── useLocaleSync.ts          # Syncs i18n to :lang URL param
│   │   ├── useWishlist.ts
│   │   ├── useIsMobile.ts
│   │   └── useAnimations.ts
│   │
│   ├── lib/
│   │   └── aiChat/                   # AI knowledge / suggestions / prompt helpers
│   │       ├── knowledge.ts              # buildKnowledgeBase + ranking
│   │       ├── suggestions.ts            # generateSmartSuggestions
│   │       ├── welcome.ts                # Bilingual welcome messages
│   │       ├── context.ts                # /api/ai/context fetcher + fallback
│   │       └── types.ts
│   │
│   ├── pages/                        # Route-level components
│   │   ├── Home.tsx · AboutPage.tsx · NewsPage.tsx · NewsArticlePage.tsx
│   │   ├── DioxPage.tsx · AyluxPage.tsx
│   │   ├── ProductionPage.tsx · GoalPage.tsx · DryerPage.tsx
│   │   ├── WishlistPage.tsx · UnsubscribePage.tsx · PrivacyPage.tsx · TermsPage.tsx
│   │   └── NotFoundPage.tsx
│   │
│   ├── admin/                        # Admin SPA (lazy-loaded at /admin/*)
│   │   ├── AdminApp.tsx
│   │   ├── AdminLogin.tsx · AdminLayout.tsx
│   │   ├── pages/                        # Products, news, campaigns, chats, AI-KB, analytics
│   │   └── utils/adminApi.ts             # Typed client with auto CSRF + 401 redirect
│   │
│   ├── contexts/WishlistContext.tsx
│   ├── data/                         # Static catalog + news + derived helpers
│   ├── locales/{ar,en,tr,ru}/translation.json
│   ├── styles/
│   │   ├── tokens.css                    # Design tokens (loaded first)
│   │   ├── main.css                      # Public site (includes former mobile.css)
│   │   ├── admin.css                     # Admin panel
│   │   ├── flipbook.css · ai-chat.css · employee.css · professional-system.css
│   │
│   ├── utils/
│   │   ├── api.ts                        # buildApiUrl (VITE_BACKEND_URL-aware)
│   │   ├── apiFetch.ts                   # fetch wrapper with auto-CSRF
│   │   ├── backendProbe.ts               # /api/health boot probe with listeners
│   │   ├── catalogUrls.ts                # VITE_CATALOG_BASE_URL resolver
│   │   ├── localizedPath.ts              # URL locale splitting + prefixing
│   │   └── language.ts · analytics.ts · clientSession.ts · image.ts
│   │
│   ├── App.tsx                       # Routes: /:lang/*, /admin/*, redirects
│   └── main.tsx                      # Entry, Sentry init, global error handlers
│
├── server/
│   ├── server.mjs                    # HTTP entry — request dispatch, graceful shutdown
│   ├── server-bootstrap.mjs (root)   # Pre-flight wrapper
│   ├── auth.mjs                      # JWT + admin CSRF cookie + login rate limit
│   ├── backup.mjs                    # Scheduled DB backup (local + S3/R2)
│   ├── newsletterTokens.mjs          # Opaque unsubscribe token HMAC
│   ├── redisClient.mjs               # GET/SET/DELETE/rate-limit/queue with fallback
│   │
│   ├── middlewares/
│   │   ├── cors.mjs                      # Origin allowlist, security headers, sendJson
│   │   ├── security.mjs                  # CSP, HSTS, rate limiters
│   │   ├── publicCsrf.mjs                # Anonymous CSRF for public POST
│   │   ├── adminAuth.mjs                 # requireAdminAuth + requireCsrfToken
│   │   ├── bodyParser.mjs                # JSON body reader with size cap
│   │   ├── errorHandler.mjs              # Sanitised 5xx + Sentry forward
│   │   └── requestContext.mjs            # AsyncLocalStorage reqId + child logger
│   │
│   ├── routes/
│   │   ├── api-chat.mjs                  # POST /api/ai/chat (public, CSRF'd)
│   │   ├── api-ai-context.mjs            # GET /api/ai/context (DB-backed knowledge)
│   │   ├── api-health.mjs                # GET /api/health (fail-closed on DB loss)
│   │   ├── api-newsletter.mjs            # subscribe / unsubscribe
│   │   ├── api-misc.mjs                  # log-error, uploads, email open/click
│   │   ├── sitemap.mjs                   # Dynamic per-language sitemap.xml
│   │   ├── static-spa.mjs                # Static file + SPA fallback + CSRF cookie issuer
│   │   ├── public-data.mjs               # GET /api/products/:brand, /api/news (Redis-cached)
│   │   ├── api-admin.mjs                 # Admin auth + CSRF gate
│   │   └── admin-*.mjs                   # Products, news, campaigns, chats, AI-KB, analytics
│   │
│   ├── services/
│   │   ├── db.mjs                        # SQLite init, schema, migrations, seeds
│   │   ├── safeUpdate.mjs                # Validated UPDATE builder (zero dynamic SQL)
│   │   ├── publicCache.mjs               # Namespaced Redis cache + bust helpers
│   │   ├── aiChat.mjs                    # OpenRouter call + reply cache
│   │   ├── newsletter.mjs                # Subscribe / unsubscribe state machine
│   │   └── (others)
│   │
│   ├── schedulers/                   # News publish sweep, campaign dispatch, DB backup
│   ├── utils/logger.mjs              # Pino root logger
│   ├── __tests__/                    # Vitest: auth, safeUpdate, publicCsrf, publicCache, rateLimit, redisQueue, newsletterTokens
│   └── data/                         # SQLite file (gitignored) + backups + uploads
│
├── public/                           # Static assets (logos, product images, flipbook pages)
│   ├── Catalog/                          # Catalog PDFs + per-page WebP images
│   ├── diox-images/ · aylux-images/ · logos/
│   └── robots.txt · manifest.json
│
├── scripts/
│   ├── prerender.mjs                 # Per-language Puppeteer prerender
│   ├── prerender-server.mjs          # Static server used during prerender
│   ├── optimize-images.mjs           # Sharp-based PNG/JPG → WebP (idempotent)
│   ├── check-important-budget.mjs    # CSS !important budget enforcer (CI gate)
│   ├── crop-to-content.mjs           # Asset trimming utility
│   └── run-stack.mjs                 # Parallel frontend+API dev runner
│
├── Dockerfile                        # Multi-stage: Debian builder + Alpine runtime
├── package.json · tsconfig.*.json · vite.config.ts · vitest.config.mjs
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 22 or later
- **npm** 10 or later
- An **OpenRouter API key** — [openrouter.ai/keys](https://openrouter.ai/keys) (powers both the public AI chat and the admin auto-translation)
- A **Resend API key** + verified sending domain (for newsletters)
- **Redis** (optional — app falls back to in-memory cache/rate-limits if absent)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yahyaabohashemstu/karahoca.git
cd karahoca

# 2. Install dependencies (pulls Inter font subsets + Puppeteer's Chromium)
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your actual keys (see Environment Variables section)

# 4. Generate an admin password hash
node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword', 10))"
# Paste the output into ADMIN_PASSWORD_HASH in .env

# 5. Start dev (frontend + backend together)
npm run dev
```

Frontend dev server: http://localhost:5173 · API: http://localhost:5000

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run Vite dev server + API server together |
| `npm run dev:web` | Vite frontend only (port 5173) |
| `npm run dev:api` | API server only (port 5000) |
| `npm run build` | Production build: `tsc -b` → `vite build` → `optimize-images` → `prerender` |
| `npm run prerender` | Run prerender step standalone |
| `npm run optimize-images` | Generate WebP variants for every PNG/JPG in `public/` (idempotent) |
| `npm run preview` | Run built frontend + API together locally |
| `npm run preview:web` | Preview built frontend only |
| `npm run start` | Start API server (production mode) |
| `npm run lint` | ESLint + CSS `!important` budget check |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Vitest in watch mode |

---

## Environment Variables

Full template in [`.env.example`](./.env.example). Minimum required for production:

```env
# ── Authentication ────────────────────────────────────────────────────
JWT_SECRET=change_me_to_a_long_random_secret_at_least_32_chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$...                 # bcryptjs hashSync output

# ── AI (OpenRouter — server-side only, powers both the chat widget and
#       the admin auto-translation feature) ────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Email / newsletter ────────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=KARAHOCA <noreply@yourdomain.com>

# ── Public URLs ────────────────────────────────────────────────────────
SITE_URL=https://karahoca.com
FRONTEND_URL=https://karahoca.com
ALLOWED_ORIGINS=https://karahoca.com,https://www.karahoca.com
API_PUBLIC_URL=https://api.karahoca.com        # if API is on a different host

# ── Frontend build-time ────────────────────────────────────────────────
VITE_BACKEND_URL=                               # leave empty if same-origin; else https://api.karahoca.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX             # optional
VITE_SENTRY_DSN=                                # optional
VITE_CATALOG_BASE_URL=                          # optional — CDN override for /Catalog/*
```

Optional:

```env
# Redis (falls back to in-memory if unset / unreachable)
REDIS_URL=redis://localhost:6379

# Server-side Sentry
SENTRY_DSN=

# Rate-limit + body-size tuning
MAX_REQUEST_BODY_BYTES=1048576
RATE_LIMIT_WINDOW_MS=60000

# Cloud backup (S3 / R2 / DO Spaces / MinIO — all compatible)
S3_BUCKET_NAME=karahoca-backups
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_KEY_PREFIX=backups/karahoca/
S3_FORCE_PATH_STYLE=                            # only for MinIO
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
MAX_CLOUD_BACKUPS=30
```

> **Security note:** `OPENROUTER_API_KEY`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, and `AWS_SECRET_ACCESS_KEY` are server-side only. They are never shipped in the browser bundle. `VITE_*` prefixed variables are public by design.

---

## Admin Dashboard

Path: `/admin/login` → `/admin/dashboard`

| Route | Purpose |
|---|---|
| `/admin/login` | Admin authentication (rate-limited: 5 attempts / 15 min per IP) |
| `/admin/dashboard` | Overview: traffic, subscribers, recent chats |
| `/admin/products` | Product catalog CRUD (per-brand, per-category) |
| `/admin/news` | News articles with draft / published / scheduled states |
| `/admin/newsletter` | Subscribers list, CSV export, soft unsubscribe |
| `/admin/campaigns` | Email campaign creation, scheduling, dispatch, click/open stats |
| `/admin/chats` | AI chat conversation viewer (per-user, per-session) |
| `/admin/analytics` | GA4 summary + internal counters |
| `/admin/ai-knowledge` | Custom Q&A editor + captured user questions review |

**All mutations require a valid CSRF token** — the admin SPA reads the `karahoca_admin_csrf` cookie set at login and echoes it as `X-CSRF-Token`. Server rejects any mismatch with 403.

Admin features:
- **AI translation** — one-click translate product/news fields to AR · EN · TR · RU via OpenRouter
- **Campaign A/B subjects** — per-language alternate subject lines, tracked separately
- **Subject exclusion list** — skip subscribers on a per-campaign basis
- **Atomic dispatch claim** — `status='sending'` prevents duplicate sends when scheduler + manual button race
- **Soft deletes** — products and news are archived (`active=0`), recoverable
- **Audit log** — every admin action logged to `admin_audit_log`

---

## API Reference

All endpoints under `/api/*`. The public HTML response sets a `karahoca_csrf` cookie that the SPA echoes as `X-CSRF-Token` on mutating requests.

### Public

| Method | Endpoint | CSRF | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness + readiness probe. **503** when DB is unreachable. |
| `GET` | `/api/ai/context` | — | AI knowledge base + tone guidelines (DB-backed, 1h cached). |
| `POST` | `/api/ai/chat` | ✓ | Send message to AI assistant (rate-limited 30/min per IP). |
| `POST` | `/api/newsletter/subscribe` | ✓ | Subscribe email (3/hr per IP). |
| `POST` | `/api/newsletter/unsubscribe` | — | One-click unsubscribe via signed token (exempt by design). |
| `POST` | `/api/log-error` | ✓ | Client-side error report. |
| `POST` | `/api/chat/log` | ✓ | Chat transcript persist. |
| `GET` | `/api/products/:brand?lang=xx` | — | Public catalog (5-min Redis cache). |
| `GET` | `/api/news?lang=xx` | — | Published + scheduled-active news (5-min Redis cache). |
| `GET` | `/sitemap.xml` | — | Dynamic per-language sitemap with full `xhtml:link hreflang` alternates. |

### Admin (JWT + CSRF required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Authenticate — sets session + CSRF cookies |
| `POST` | `/api/admin/logout` | Clear session |
| `GET` | `/api/admin/session` | Who-am-I |
| `GET / POST / PUT / DELETE` | `/api/admin/products[/:id]` | Product CRUD + cache bust |
| `PUT` | `/api/admin/products/reorder` | Bulk display-order update |
| `GET / POST / PUT / DELETE` | `/api/admin/categories[/:id]` | Category CRUD |
| `GET / POST / PUT / DELETE` | `/api/admin/news[/:id]` | News CRUD + cache bust |
| `GET` | `/api/admin/newsletter` | List subscribers |
| `DELETE` | `/api/admin/newsletter/:email` | Soft-unsubscribe |
| `GET` | `/api/admin/newsletter/export` | Subscribers CSV |
| `GET / POST / PUT / DELETE` | `/api/admin/campaigns[/:id]` | Campaign CRUD |
| `POST` | `/api/admin/campaigns/:id/send` | Dispatch (atomic status claim) |
| `POST` | `/api/admin/campaigns/:id/schedule` | Schedule future send |
| `GET` | `/api/admin/campaigns/:id/stats` | Open + click stats |
| `GET / DELETE` | `/api/admin/chats[/:userId]` | Chat user viewer |
| `GET / POST / PUT / DELETE` | `/api/admin/ai-knowledge[/:id]` | Custom Q&A |
| `GET / PUT` | `/api/admin/ai-knowledge/questions` | User questions triage |
| `POST` | `/api/admin/translate` | OpenRouter auto-translation |
| `POST` | `/api/admin/upload-image` | Magic-byte validated image upload |
| `GET` | `/api/admin/audit-log` | Action audit trail |
| `GET` | `/api/admin/stats` | Dashboard counters |
| `GET` | `/api/admin/analytics?days=N` | Time-series internal stats |
| `GET` | `/api/admin/ga` | Google Analytics Data API summary |

---

## Security

| Layer | Measure |
|---|---|
| **JWT** | 32-byte minimum secret enforced at boot; production exits(1) if weak. 24h expiry by default, configurable via `JWT_EXPIRES_IN`. |
| **Password** | bcryptjs cost 10. Never stored in plaintext. |
| **Admin CSRF** | Double-submit cookie, `SameSite=Strict`, timing-safe comparison. Required on all admin mutations. |
| **Public CSRF** | Separate `karahoca_csrf` cookie (`SameSite=Lax`) issued on every HTML response. Required on public POST endpoints except unsubscribe (token IS the auth). |
| **SQL safety** | `services/safeUpdate.mjs` — column allowlist validated at setup with strict identifier regex. Zero runtime string interpolation into SQL. Prepared statements cached per column subset. |
| **CSP** | Strict: `script-src 'self'` + analytics domains only (no `unsafe-inline`). `object-src 'none'`. `frame-ancestors 'none'`. Tightened since Inter is self-hosted. |
| **Other headers** | HSTS (preload + includeSubDomains), X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (cameras/mics/etc. all denied), COOP same-origin. |
| **Rate limiting** | Per-IP Redis counters: login 5/15min, chat 30/min, newsletter 3/hr, unsubscribe 10/5min, log-error 10/min, chat-log 20/min, health 120/min. |
| **Body size cap** | 512 KB default; 14 MB for authenticated image-upload route. |
| **File uploads** | Magic-byte validation (JPEG / PNG / GIF / WebP) — no extension-only checks. |
| **CSV export** | Prefixes `=`, `+`, `-`, `@`, `\t`, `\r` with `'` to neutralise CSV-injection in Excel. |
| **Newsletter tokens** | Opaque HMAC-signed; one-click unsubscribe URLs cannot be guessed or enumerated. |
| **Campaign dispatch** | Atomic `status='sending'` claim prevents scheduler-vs-manual-button double sends. |
| **Error responses** | 5xx sanitised — never leak stack traces. `reqId` attached for log correlation. |
| **Frontend errors** | `ErrorBoundary` + `window.onunhandledrejection` forward to Sentry when DSN is set. |
| **Source maps** | Disabled in production builds. |
| **Build gate** | CI runs `tsc`, `eslint`, `vitest`, `docker build` — merges to main require all green. |

---

## Performance

| Area | Measure |
|---|---|
| **Per-language prerender** | Puppeteer renders `/ar/`, `/en/`, `/tr/`, `/ru/` × every static route + up to 50 latest news articles. Output: `dist/<lang>/<route>/index.html`. Social / non-JS crawlers get ready-to-index HTML. |
| **URL-prefixed i18n** | Real `hreflang` alternates per language. Dynamic sitemap emits 4× URLs × all pages × dynamic news. |
| **Public read cache** | Redis (or in-memory fallback) caches `/api/products/:brand` and `/api/news` per language × brand, 5-min TTL. Admin mutations explicitly invalidate matching entries via `publicCache.invalidateProductsCache(brand)` / `invalidateNewsCache()`. `X-Cache: HIT/MISS` response header for ops. |
| **Self-hosted fonts** | Inter woff2 subsets bundled via `@fontsource/inter`. No DNS to `fonts.gstatic.com`. |
| **Image pipeline** | `scripts/optimize-images.mjs` runs on every `npm run build` (idempotent: skips files that already have a WebP sibling). Sharp-based, quality 82, max width 1200. |
| **Manual chunks** | `vite.config.ts` splits heavy vendors: `react-vendor`, `i18n-vendor`, `seo-vendor`, `pdfjs`, `markdown`. |
| **Lazy routes** | Every page is a separate chunk via `React.lazy`. Admin SPA is a single additional chunk. |
| **Memoisation** | `BrandPage` uses a custom structural-equality comparator; `AIChat`, `MessageList`, `MessageInput`, `SuggestionChips` are `memo`-wrapped with default shallow compare. |
| **DB backups** | Online `.backup()` snapshots daily; S3/R2 rotation with local fallback copies. |
| **DB indexes** | Composite `(active, status)` on news, brand × active on products, hot-path indexes on chat messages, email sends, audit log. |
| **CDN-ready catalog** | `VITE_CATALOG_BASE_URL` flips all catalog PDFs and flipbook page images to a CDN origin without a code change. |

---

## Internationalization

Four languages with **URL-prefixed routing** for proper SEO:

| Language | Prefix | Direction | OG Locale |
|---|---|---|---|
| Arabic (default) | `/ar/` | RTL ← | `ar_TR` |
| English | `/en/` | LTR → | `en_US` |
| Turkish | `/tr/` | LTR → | `tr_TR` |
| Russian | `/ru/` | LTR → | `ru_RU` |

- Naked `/` redirects to the preferred language (localStorage → navigator → `ar`).
- Legacy unprefixed paths (e.g. `/about`) redirect to `/<preferred>/about`.
- `<html lang dir>` is applied to the actual `<html>` element via Helmet — native browser RTL behaviour works correctly for form controls and scrollbars.
- Every page emits `<link rel="alternate" hreflang>` for all four languages + `x-default`.
- Translation files: `src/locales/{ar,en,tr,ru}/translation.json`.
- The AI chat base knowledge and tone guidelines are stored in SQLite (`ai_knowledge_sections`, `ai_assistant_config`) and exposed via `GET /api/ai/context` — admins can edit without a redeploy.

---

## Testing

Vitest-based server test suite. Frontend is covered by TypeScript + ESLint + manual verification (no component tests yet).

```bash
npm test              # one-shot
npm run test:watch    # watch mode
```

**81 tests across 7 files:**

| File | Coverage |
|---|---|
| `auth.test.mjs` | JWT sign/verify, login rate limit, cookie attrs, bcrypt round-trip |
| `newsletterTokens.test.mjs` | Token signing, tampering detection, expiry |
| `rateLimit.test.mjs` | Redis + in-memory fallback behaviour |
| `redisQueue.test.mjs` | FIFO queue with bounded memory |
| `safeUpdate.test.mjs` | SQL identifier rejection, allowlist enforcement, column-injection attempts |
| `publicCsrf.test.mjs` | Mint/reuse cookie, matching header, mismatch rejection, constant-time compare |
| `publicCache.test.mjs` | Get/set, namespace isolation, brand-scoped invalidation, news invalidation |

---

## CI/CD

`.github/workflows/ci.yml` runs three parallel jobs on every push to `main` and every PR:

| Job | Steps |
|---|---|
| **lint-and-typecheck** | `npm ci` → `npx tsc -b` → `npm run lint` (ESLint + `!important` budget check) |
| **tests** | `npm ci` → `npm test` (full Vitest suite) |
| **build** | `npm ci` → install Chromium system libs → `npm run build` (tsc + vite + optimize-images + prerender) → verify `dist/index.html` non-empty |

Configure branch protection on `main` to require all three. The `build:nopp` escape hatch has been removed — Dockerfile and CI both run the full pipeline.

### Dockerfile

Multi-stage build:

1. **`deps`** (Debian bookworm-slim) — `npm ci` with Puppeteer's Chromium + build toolchain
2. **`builder`** (Debian) — `npm run build` including Puppeteer prerender
3. **`prod-deps`** (Alpine) — production-only deps (native modules built against Alpine)
4. **`runtime`** (Alpine) — slim final image, copies `dist/` + `server/` + prod node_modules, runs as non-root `node` user

```bash
docker build -t karahoca:latest .
docker run -p 5000:5000 --env-file .env karahoca:latest
```

Healthcheck uses `wget` against `/api/health` — fails closed on DB loss (503).

---

## Deployment

Current deployment: **two services on [Coolify](https://coolify.io)**.

### Service 1 — Frontend (nginx)

- Serves `dist/` as static files
- SPA fallback to `index.html` for unknown paths
- Proxies `/api/*` to the backend service

### Service 2 — Backend (Node.js)

- Runs `node server-bootstrap.mjs`
- Persistent volume mount for `server/data/` (SQLite + backups)
- `REDIS_URL` optional — falls back to in-memory cache / rate-limits
- S3/R2 credentials optional — local rotation as fallback

### Environment Checklist

- [ ] `JWT_SECRET` is a cryptographically random string (≥ 32 chars)
- [ ] `ADMIN_PASSWORD_HASH` is a bcrypt hash (never plaintext)
- [ ] `VITE_BACKEND_URL` points to the public API domain if separate from the SPA domain
- [ ] `ALLOWED_ORIGINS` / `FRONTEND_URL` / `SITE_URL` match production domains
- [ ] `OPENROUTER_API_KEY` is set for AI chat + auto-translation
- [ ] `RESEND_API_KEY` + `FROM_EMAIL` use a verified domain
- [ ] `REDIS_URL` is set if Redis is available
- [ ] `S3_BUCKET_NAME` + AWS keys are set if cloud backups are desired
- [ ] Persistent volume is mounted at `/app/server/data`

---

## Contact

| Channel | Details |
|---|---|
| Website | [karahoca.com](https://karahoca.com) |
| Email | info@karahoca.com |
| WhatsApp | [+90 530 591 4990](https://wa.me/905305914990) |

---

<div align="center">

**Karahoca Kimya** · Istanbul, Turkey
© 2025 Karahoca. All rights reserved.

</div>

<div align="center">

<img src="public/karahoca-logo.png" alt="Karahoca Logo" width="120" />

# Karahoca Kimya — Official Website

**Full-stack corporate website for Karahoca Kimya**
Built with React 18 · TypeScript · Vite · Node.js · SQLite

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![i18n](https://img.shields.io/badge/i18n-AR%20·%20EN%20·%20TR%20·%20RU-F97316?style=flat-square)](https://www.i18next.com)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](#)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Admin Dashboard](#-admin-dashboard)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Internationalization](#-internationalization)
- [Security](#-security)
- [Contact](#-contact)

---

## Overview

The official web presence of **Karahoca Kimya**, a Turkish chemical manufacturing company. The platform covers:

- **Corporate pages** — About, Goals, Production, Partners
- **Brand showcases** — DIOX, AYLUX, Dryer product lines
- **News & Blog** — Multi-language articles with an admin CMS
- **AI Chat Assistant** — Powered by Google Gemini (server-side, secure)
- **Newsletter System** — Subscription, campaigns, and unsubscribe flow via Resend
- **Admin Dashboard** — Full CMS for products, news, subscribers, campaigns, analytics

The site fully supports **RTL (Right-to-Left)** layout for Arabic and is available in four languages: Arabic, English, Turkish, and Russian.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 7.x | Build tool & dev server |
| React Router | 7.x | Client-side routing |
| i18next | 25.x | Internationalization (AR/EN/TR/RU) |
| react-helmet-async | 2.x | SEO & meta tags |
| react-markdown | 10.x | Markdown rendering in chat |
| react-ga4 | 2.x | Google Analytics 4 |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime (pure `http` module, no Express) |
| better-sqlite3 | 12.x | Embedded SQLite database |
| jsonwebtoken | 9.x | JWT authentication (24h expiry) |
| bcryptjs | 3.x | Password hashing |
| Resend | 6.x | Transactional email & newsletter |
| Google Gemini | API | AI chat assistant |

---

## Project Structure

```
karahoca-react-vite/
│
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── AIChatWidget.tsx     # Gemini-powered chat
│   │   ├── BrandsSection.tsx    # Partner logos showcase
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── NewsCard.tsx
│   │   ├── NewsSection.tsx      # Auto-scrolling carousel
│   │   └── SEO.tsx
│   │
│   ├── pages/               # Route-level page components
│   │   ├── Home.tsx
│   │   ├── AboutPage.tsx
│   │   ├── NewsPage.tsx
│   │   ├── AyluxPage.tsx
│   │   ├── DioxPage.tsx
│   │   └── UnsubscribePage.tsx
│   │
│   ├── styles/              # Global CSS
│   │   ├── main.css             # Core design system
│   │   ├── mobile.css           # Mobile overrides
│   │   └── admin.css            # Admin dashboard styles
│   │
│   ├── data/                # Static data & AI knowledge base
│   ├── locales/             # i18n translation files (ar/en/tr/ru)
│   └── utils/               # Helpers & utilities
│
├── server/
│   ├── server.mjs           # HTTP server entry point
│   ├── auth.mjs             # JWT middleware
│   ├── db.mjs               # SQLite connection & schema
│   └── routes/
│       ├── admin-auth.mjs
│       ├── admin-products.mjs
│       ├── admin-news.mjs
│       ├── admin-newsletter.mjs
│       ├── admin-campaigns.mjs
│       ├── admin-catalog.mjs
│       ├── admin-chats.mjs
│       ├── admin-translate.mjs  # Gemini AI translation
│       ├── admin-stats.mjs
│       ├── admin-analytics.mjs
│       └── public-data.mjs
│
├── public/                  # Static assets (logos, images)
├── scripts/                 # Dev tooling scripts
├── server-bootstrap.mjs     # Server startup wrapper
├── vite.config.ts
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- A **Google Gemini API key** (from [Google AI Studio](https://aistudio.google.com))
- A **Resend API key** + verified sending domain (for newsletters)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/karahoca-react-vite.git
cd karahoca-react-vite

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your actual keys (see section below)

# 4. Start development (frontend + backend together)
npm run dev
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server + API server together |
| `npm run dev:web` | Start Vite frontend only (port 5173) |
| `npm run dev:api` | Start API server only (port 5000) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build + API together |
| `npm run preview:web` | Preview production build only |
| `npm run start` | Start API server (production mode) |
| `npm run lint` | Run ESLint |

---

## Environment Variables

Create a `.env` file in the project root. A complete template is provided in `.env.example`.

### Required

```env
# Google Gemini AI (server-side only)
GEMINI_API_KEY=your_gemini_api_key

# JWT Authentication
JWT_SECRET=change_this_to_a_long_random_secret_64chars

# Admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=bcrypt_hash_of_your_password

# Newsletter (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=newsletter@yourdomain.com
```

### Optional

```env
# URLs — leave blank if frontend and API share the same domain
VITE_BACKEND_URL=              # e.g. https://api.karahoca.com (only if separate domain)
FRONTEND_URL=https://karahoca.com
SITE_URL=https://karahoca.com
ALLOWED_ORIGINS=https://karahoca.com,https://www.karahoca.com

# Google Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

> **Security note:** `GEMINI_API_KEY` is consumed exclusively by the backend. It is never exposed to the browser.

---

## Admin Dashboard

Access the admin panel at `/admin/login`.

### Pages

| Path | Description |
|---|---|
| `/admin/login` | Admin authentication |
| `/admin/products` | Product catalog management |
| `/admin/news` | News & articles CMS |
| `/admin/newsletter` | Subscriber list & management |
| `/admin/campaigns` | Email campaign creation & dispatch |
| `/admin/chats` | AI chat conversation viewer |
| `/admin/stats` | Traffic & engagement statistics |
| `/admin/ai-knowledge` | AI assistant knowledge base editor |

### Features

- **AI-powered translation** — Auto-translate product/news content into AR · EN · TR · RU using Gemini
- **Campaign scheduler** — Send newsletters to all or selected subscriber segments
- **Subscriber exclusion** — Choose which subscribers to skip before sending
- **CSV export** — Download subscriber lists with CSV-injection protection
- **Image uploads** — Magic-byte validation (JPEG, PNG, GIF, WebP) before saving
- **Soft deletes** — Products and news items are archived, not permanently removed

---

## API Reference

All endpoints are prefixed with `/api`.

### Public

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send message to AI assistant |
| `POST` | `/api/newsletter/subscribe` | Subscribe to newsletter |
| `GET` | `/api/newsletter/unsubscribe` | Unsubscribe via email token |
| `GET` | `/api/products` | List published products |
| `GET` | `/api/news` | List published news articles |
| `GET` | `/api/sitemap.xml` | Dynamic XML sitemap |

### Admin (JWT required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/auth/login` | Authenticate admin |
| `GET/POST/PATCH/DELETE` | `/api/admin/products` | Product CRUD |
| `GET/POST/PATCH/DELETE` | `/api/admin/news` | News CRUD |
| `GET` | `/api/admin/newsletter/subscribers` | List subscribers |
| `GET` | `/api/admin/newsletter/export` | Export CSV |
| `POST` | `/api/admin/campaigns` | Create & send campaign |
| `GET` | `/api/admin/chats/users` | List chat users |
| `GET` | `/api/admin/stats` | Site statistics |
| `GET/POST` | `/api/admin/ai-knowledge` | AI knowledge base |
| `POST` | `/api/admin/translate` | Trigger AI translation |

---

## Deployment

This project is deployed as **two separate services** on [Coolify](https://coolify.io):

### Service 1 — Frontend (Static)

```bash
npm run build
# Serve the generated dist/ folder via Nginx
```

Nginx is configured to handle React Router (SPA fallback to `index.html`).

### Service 2 — Backend (Node.js)

```bash
npm run start
# Runs server-bootstrap.mjs → server/server.mjs
```

The SQLite database file is stored on a persistent volume mount.

### Environment Checklist

- [ ] `JWT_SECRET` is a cryptographically random string (≥ 64 chars)
- [ ] `ADMIN_PASSWORD_HASH` is a bcrypt hash (never store plaintext)
- [ ] `VITE_BACKEND_URL` points to the public API domain (if separate)
- [ ] `RESEND_FROM_EMAIL` uses a verified domain in Resend dashboard
- [ ] `FRONTEND_URL` / `ALLOWED_ORIGINS` match your production domain(s)
- [ ] Source maps are **disabled** in production (`vite.config.ts`)

---

## Internationalization

The site is fully localized in four languages with automatic detection:

| Language | Code | Direction |
|---|---|---|
| Arabic | `ar` | RTL ← |
| English | `en` | LTR → |
| Turkish | `tr` | LTR → |
| Russian | `ru` | LTR → |

Translation files are located in `src/locales/{lang}/translation.json`.
AI-assisted translation (via Gemini) is available for products and news through the admin panel.

---

## Security

Key security measures implemented in this project:

| Area | Measure |
|---|---|
| Authentication | JWT with 24-hour expiry |
| Passwords | bcrypt hashing |
| File uploads | Magic-byte validation (no extension-only checks) |
| HTML output | All DB fields escaped before insertion into HTML |
| CSV export | CSV-injection prevention (prefix dangerous chars) |
| Newsletter | Rate-limited unsubscribe (10 req / 5 min per IP) |
| Campaigns | Atomic `status='sending'` claim prevents duplicate sends |
| AI keys | Gemini API key server-side only, never in browser bundle |
| Source maps | Disabled in production builds |

---

## Contact

| Channel | Details |
|---|---|
| Website | [karahoca.com](https://karahoca.com) |
| Email | info@karahoca.com |
| WhatsApp | +90 530 591 4990 |

---

<div align="center">

**Karahoca Kimya** · Istanbul, Turkey
© 2025 Karahoca. All rights reserved.

</div>

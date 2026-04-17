import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import 'modern-normalize/modern-normalize.css'
// Design tokens MUST load before every other stylesheet so every var(--*)
// reference resolves on first paint. See src/styles/tokens.css.
import './styles/tokens.css'
// Self-hosted Inter — Vite inlines the woff2 subsets into the bundle so
// there is no Google Fonts / `fonts.gstatic.com` round-trip on first visit.
// We load weights 300 / 400 / 600 / 800 to match the former Google Fonts
// request so text rendering stays identical.
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/800.css'
import './index.css'
import './i18n'
import App from './App.tsx'
import { getClientSessionId } from './utils/clientSession'

// ─── Global unhandled-rejection handler ────────────────────────────────────
// React's ErrorBoundary only catches render-time errors. Promise rejections
// escaping an async event handler (`fetch().then(...)` without a `.catch`)
// bypass it entirely. Browsers surface them to the console but NOT to any
// telemetry unless we wire it ourselves. Two hooks:
//   - `unhandledrejection` → a Promise was rejected and nothing awaited / caught it
//   - `error`              → a runtime error fired outside any handler (very rare)
// Both forward to Sentry if present, otherwise log with enough context for
// a developer to reproduce. Deliberately ignores AbortError — those are
// intentional user-navigation cancellations.
if (typeof window !== 'undefined') {
  const forwardToSentry = (
    level: 'error' | 'warning',
    error: unknown,
    extra?: Record<string, unknown>,
  ) => {
    type SentryLike = {
      captureException?: (e: unknown, ctx?: { extra?: Record<string, unknown>; level?: string }) => void;
    };
    const sentry = (globalThis as { __karahocaSentry?: SentryLike }).__karahocaSentry;
    if (sentry?.captureException) {
      try { sentry.captureException(error, { extra, level }); } catch { /* noop */ }
    }
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    if (reason instanceof Error && reason.name === 'AbortError') return;
    console.warn('[unhandledrejection]', reason);
    forwardToSentry('error', reason, { source: 'unhandledrejection' });
  });

  window.addEventListener('error', (event) => {
    // Ignore resource-load errors (they already surface via network panel);
    // we only want actual runtime exceptions.
    if (!event.error) return;
    forwardToSentry('error', event.error, {
      source: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

// ─── Sentry (optional) ──────────────────────────────────────────────────────
// Gated behind VITE_SENTRY_DSN so absence is a silent no-op. We dynamically
// import the SDK so an unconfigured deploy doesn't pay the ~50 KB bundle
// cost for telemetry that isn't wired up.
//
// The SDK is attached to `globalThis.__karahocaSentry` once loaded so
// ErrorBoundary + any other module can call captureException without
// taking a hard import dependency on @sentry/react.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn && typeof window !== 'undefined') {
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION as string | undefined,
        tracesSampleRate: Number.parseFloat(
          (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) || '0.1',
        ),
        // Tag every event with the session id so a user's reported errors
        // can be grouped in the Sentry UI without any extra work.
        initialScope: {
          tags: { sessionId: getClientSessionId() },
        },
      });
      (globalThis as { __karahocaSentry?: typeof Sentry }).__karahocaSentry = Sentry;
    })
    .catch((err) => {
      // Never crash the app over a telemetry boot failure.
      console.warn('[sentry] failed to initialize', err);
    });
}

const rootNode = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Auto-detect prerendered content: if the server (or our build-time prerender
// script) baked content into #root, we HYDRATE on top of it. Otherwise —
// plain CSR boot. This lets the same bundle work for prerendered and
// non-prerendered routes in the same deploy.
if (rootNode.hasChildNodes()) {
  hydrateRoot(rootNode, tree);
} else {
  createRoot(rootNode).render(tree);
}

import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import 'modern-normalize/modern-normalize.css'
// Design tokens MUST load before every other stylesheet so every var(--*)
// reference resolves on first paint. See src/styles/tokens.css.
import './styles/tokens.css'
import './index.css'
import './styles/mobile.css'
import './i18n'
import App from './App.tsx'
import { getClientSessionId } from './utils/clientSession'

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

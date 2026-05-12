import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Service Worker update notifier.
 *
 * What it does
 * ────────────
 * vite-plugin-pwa registers the SW automatically (`injectRegister: 'auto'`)
 * via `virtual:pwa-register` — that gives us a `registerSW` function we
 * can call with `onNeedRefresh` / `onOfflineReady` callbacks.
 *
 * When a NEW build deploys:
 *   1. The user's old SW notices a new SW spec on the server.
 *   2. The new SW installs in the background.
 *   3. `onNeedRefresh` fires here.
 *   4. We pop a small toast at the bottom: "تحديث متاح — اضغط للتحميل".
 *   5. On click, we tell the SW to skip waiting and reload the page; the
 *      user gets the freshest assets within seconds.
 *
 * The toast is dismissable — if a user prefers to keep using the cached
 * version (e.g. they're in the middle of a flow), they can ignore it and
 * the update applies on the next full reload anyway.
 *
 * Why not auto-reload silently
 * ────────────────────────────
 * Forcing a reload mid-interaction is a great way to lose form input and
 * scroll position. Every battle-tested PWA shows a prompt instead. The
 * tradeoff is a tiny window where some users see a v1-vs-v2 mismatch (UI
 * from new build, data from old API). For a marketing site this is fine.
 *
 * Reversibility
 * ─────────────
 * Render this component anywhere in the tree (we put it in App.tsx). To
 * disable the prompt entirely, remove the `<ServiceWorkerUpdate />` line
 * — the SW will still register and update, just silently on next reload.
 */
const ServiceWorkerUpdate: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Only run in production where the SW actually exists. In dev,
    // `virtual:pwa-register` resolves to a no-op stub so the import
    // succeeds but nothing happens.
    let mounted = true;

    void import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (!mounted) return;
        const update = registerSW({
          onNeedRefresh() {
            if (!mounted) return;
            setNeedRefresh(true);
          },
          onOfflineReady() {
            // First-load path: SW is now active and the app would work
            // offline. We don't notify the user — it's a non-event from
            // their perspective and a toast would be confusing.
          },
          onRegisterError(err) {
            // Registration failed (CSP, private mode, old browser).
            // Treat as a non-fatal feature absence — surface to console
            // so a developer inspecting the page sees what happened.
            console.warn('[sw] register failed', err);
          },
        });
        setUpdateSW(() => update);
      })
      .catch(() => {
        // Plugin not built or import failed — degrade silently.
      });

    return () => { mounted = false; };
  }, []);

  if (!needRefresh) return null;

  const isRtl = (i18n.resolvedLanguage || i18n.language || 'ar').startsWith('ar');

  const handleUpdate = () => {
    if (updateSW) void updateSW(true); // reloadPage = true
  };

  const handleDismiss = () => setNeedRefresh(false);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        [isRtl ? 'right' : 'left']: '20px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '12px',
        background: 'rgba(15, 20, 30, 0.95)',
        color: '#fff',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
        fontSize: '14px',
        maxWidth: 'calc(100vw - 40px)',
        // Slide-in animation for polish — short enough to not annoy.
        animation: 'sw-update-slide-in 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <style>{`
        @keyframes sw-update-slide-in {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <span>{t('sw.updateAvailable', { defaultValue: 'تحديث متاح للموقع' })}</span>
      <button
        type="button"
        onClick={handleUpdate}
        style={{
          padding: '8px 14px',
          borderRadius: '8px',
          border: 'none',
          background: '#ff5b2e',
          color: '#fff',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        {t('sw.refresh', { defaultValue: 'تحديث' })}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('sw.dismiss', { defaultValue: 'تجاهل' })}
        style={{
          padding: '4px 8px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '16px',
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
};

export default ServiceWorkerUpdate;

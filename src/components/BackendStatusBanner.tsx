import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getBackendStatus,
  startBackendProbe,
  subscribeBackendStatus,
  type BackendStatus,
} from '../utils/backendProbe';

/**
 * Non-blocking banner shown at the top of the viewport when the Node API
 * is unreachable at boot. Rationale: blocking the whole site behind a
 * maintenance page on a single failed probe is overkill (transient DNS
 * blips, momentary cold-start timeouts), but silently letting users
 * struggle with a non-functional chat / contact form is also unacceptable.
 *
 * The banner appears only when the probe explicitly returns "unreachable"
 * (not on "unknown" and not on "reachable"). It stays dismissible from the
 * client's perspective via the `hidden` toggle, but re-appears on the next
 * page load so a sustained outage stays visible.
 */

const BackendStatusBanner: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BackendStatus>(getBackendStatus());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeBackendStatus(setStatus);
    void startBackendProbe();
    return unsubscribe;
  }, []);

  if (status !== 'unreachable' || dismissed) return null;

  const message = t(
    'common.backendUnreachable',
    { defaultValue: 'Some features are temporarily unavailable. We\u2019re working on it.' },
  );
  const dismissLabel = t('common.dismiss', { defaultValue: 'Dismiss' });

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        padding: '0.5rem 1rem',
        background: 'linear-gradient(90deg, #ff5b2e, #f54b1a)',
        color: '#fff',
        fontSize: '0.9rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <span style={{ flex: 1, textAlign: 'center' }}>{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={dismissLabel}
        style={{
          background: 'rgba(255, 255, 255, 0.22)',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          color: '#fff',
          borderRadius: '999px',
          padding: '0.15rem 0.7rem',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 700,
        }}
      >
        ×
      </button>
    </div>
  );
};

export default BackendStatusBanner;

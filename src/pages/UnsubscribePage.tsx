import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';
import SEO from '../components/SEO';
import { useLocalizedPath } from '../hooks/useLocalizedPath';

type UnsubscribeStatus = 'loading' | 'success' | 'already' | 'invalid' | 'error';

const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { t } = useTranslation();
  const { lp } = useLocalizedPath();
  const [status, setStatus] = useState<UnsubscribeStatus>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    const controller = new AbortController();

    // Unsubscribe is CSRF-exempt on the server because the unsubscribe
    // token itself is unguessable and delivered via email — possession of
    // the token IS the authorization. `apiFetch` is still fine here: it
    // just adds a CSRF header when the cookie is present, and the server
    // does not require it on this endpoint.
    apiFetch('/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.alreadyUnsubscribed) {
          setStatus('already');
        } else if (data.success) {
          setStatus('success');
        } else if (
          data.error === 'Invalid or expired unsubscribe token.' ||
          data.error === 'Unsubscribe target not found.'
        ) {
          setStatus('invalid');
        } else {
          setStatus('error');
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('error');
      });

    return () => controller.abort();
  }, [token]);

  const icon: Record<UnsubscribeStatus, string> = {
    loading: '⏳',
    success: '✅',
    already: '✅',
    invalid: '🔒',
    error: '❌',
  };

  const title: Record<UnsubscribeStatus, string> = {
    loading: t('unsubscribe.loading'),
    success: t('unsubscribe.success'),
    already: t('unsubscribe.already'),
    invalid: t('unsubscribe.invalid'),
    error: t('unsubscribe.error'),
  };

  const desc: Record<UnsubscribeStatus, string> = {
    loading: t('unsubscribe.loadingDesc'),
    success: t('unsubscribe.successDesc'),
    already: t('unsubscribe.alreadyDesc'),
    invalid: t('unsubscribe.invalidDesc'),
    error: t('unsubscribe.errorDesc'),
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <SEO
        title={`KARAHOCA — ${title[status]}`}
        description={desc[status]}
        noindex
      />
      <div
        className="glass-panel"
        style={{
          maxWidth: 480,
          width: '100%',
          borderRadius: 24,
          padding: '48px 36px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon[status]}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{title[status]}</h1>
        <p style={{ opacity: 0.7, fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>{desc[status]}</p>
        <Link
          to={lp('/')}
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            borderRadius: 12,
            background: 'var(--accent, #f54b1a)',
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          {t('unsubscribe.backHome')}
        </Link>
      </div>
    </div>
  );
};

export default UnsubscribePage;

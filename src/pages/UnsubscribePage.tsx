import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildApiUrl } from '../utils/api';

type Status = 'loading' | 'success' | 'already' | 'not-found' | 'error';

const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!email) {
      setStatus('error');
      return;
    }

    const controller = new AbortController();

    fetch(buildApiUrl(`/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`), {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.alreadyUnsubscribed) {
          setStatus('already');
        } else if (data.success) {
          setStatus('success');
        } else if (data.error === 'Email not found.') {
          setStatus('not-found');
        } else {
          setStatus('error');
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('error');
      });

    return () => controller.abort();
  }, [email]);

  const icon: Record<Status, string> = {
    loading: '⏳',
    success: '✅',
    already: '✅',
    'not-found': '❓',
    error: '❌',
  };

  const title: Record<Status, string> = {
    loading: t('unsubscribe.loading'),
    success: t('unsubscribe.success'),
    already: t('unsubscribe.already'),
    'not-found': t('unsubscribe.notFound'),
    error: t('unsubscribe.error'),
  };

  const desc: Record<Status, string> = {
    loading: t('unsubscribe.loadingDesc'),
    success: t('unsubscribe.successDesc'),
    already: t('unsubscribe.alreadyDesc'),
    'not-found': t('unsubscribe.notFoundDesc'),
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
        {email && status !== 'loading' && (
          <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 8, direction: 'ltr' }}>{email}</p>
        )}
        <p style={{ opacity: 0.7, fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>{desc[status]}</p>
        <Link
          to="/"
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

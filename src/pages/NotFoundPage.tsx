import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFoundPage: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || 'ar';

  const messages: Record<string, { title: string; sub: string; btn: string }> = {
    ar: { title: 'الصفحة غير موجودة', sub: 'عذراً، لم نتمكن من إيجاد الصفحة التي تبحث عنها.', btn: 'العودة للرئيسية' },
    en: { title: 'Page Not Found',    sub: 'Sorry, we could not find the page you are looking for.', btn: 'Go to Home' },
    tr: { title: 'Sayfa Bulunamadı', sub: 'Üzgünüz, aradığınız sayfa bulunamadı.',              btn: 'Ana Sayfaya Git' },
    ru: { title: 'Страница не найдена', sub: 'Извините, запрашиваемая страница не существует.', btn: 'На главную' },
  };

  const m = messages[lang.slice(0, 2)] ?? messages.en;

  return (
    <div className="not-found-page" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
      background: 'var(--bg-primary, #0f1117)',
      color: 'var(--text-primary, #fff)',
    }}>
      <div style={{ fontSize: '8rem', fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg,#4f6ef7,#6b84ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        404
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>{m.title}</h1>
      <p style={{ fontSize: '1rem', color: 'var(--text-secondary, #999)', maxWidth: 420, margin: '0 auto 2rem' }}>{m.sub}</p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: 'linear-gradient(135deg,#4f6ef7,#6b84ff)',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1rem',
          transition: 'opacity 0.2s',
        }}
        onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseOut={e => (e.currentTarget.style.opacity = '1')}
      >
        {m.btn}
      </Link>
    </div>
  );
};

export default NotFoundPage;

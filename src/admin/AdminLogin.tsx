import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from './utils/adminApi';
import { useAdminAuth } from './utils/useAdminAuth';
import { defineMessages, useAdminLang, useT } from './i18n/core';

const messages = defineMessages({
  en: {
    subtitle: 'Admin Dashboard',
    sessionExpired: 'Your session expired. Sign in again to continue where you left off.',
    username: 'Username',
    usernamePlaceholder: 'Enter your username',
    password: 'Password',
    checking: 'Checking session…',
    signingIn: 'Signing in…',
    signIn: 'Sign In',
    invalidCredentials: 'Invalid username or password.',
    cookieBlocked: 'Signed in, but the browser did not keep the session cookie. Allow cookies for this site and try again.',
    footer: 'KARAHOCA © {year} — Secure Area',
    switchLang: 'العربية',
  },
  ar: {
    subtitle: 'لوحة الإدارة',
    sessionExpired: 'انتهت الجلسة. سجّل الدخول من جديد لتكمل من حيث توقفت.',
    username: 'اسم المستخدم',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    password: 'كلمة المرور',
    checking: 'جارٍ التحقق من الجلسة…',
    signingIn: 'جارٍ تسجيل الدخول…',
    signIn: 'تسجيل الدخول',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    cookieBlocked: 'تم التحقق من البيانات، لكن المتصفح لم يحتفظ بملف تعريف الجلسة (cookie). اسمح بملفات تعريف الارتباط لهذا الموقع ثم حاول مجددًا.',
    footer: 'KARAHOCA © {year} — منطقة آمنة',
    switchLang: 'English',
  },
});

export const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAdminAuth();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();
  const t = useT(messages);
  const { lang, setLang } = useAdminLang();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';
  // Only admin pages: an absolute or foreign URL here would be an open redirect.
  const nextParam = searchParams.get('next') || '';
  const destination = /^\/admin\/[^/]/.test(nextParam) && !nextParam.startsWith('//')
    ? nextParam
    : '/admin/dashboard';

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        await adminApi.getSession();
        if (!cancelled) {
          navigate(destination, { replace: true });
        }
      } catch {
        // No valid cookie session yet; stay on the login screen.
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [navigate, destination]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (ok) navigate(destination, { replace: true });
  };

  const errorText = !error
    ? ''
    : typeof error === 'string' ? t(error) : error.message;

  return (
    <div className="adm-login-bg">
      <button
        type="button"
        className="adm-btn adm-btn-ghost adm-btn-sm adm-login-lang"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        lang={lang === 'ar' ? 'en' : 'ar'}
      >
        {t('switchLang')}
      </button>
      <div className="adm-login-card">

        {/* Logo */}
        <div className="adm-login-logo">
          <h1>KARAHOCA</h1>
          <p>{t('subtitle')}</p>
        </div>

        {sessionExpired && !error && (
          <div className="adm-alert adm-alert-info" role="status">
            {t('sessionExpired')}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="adm-form-group">
            <label className="adm-label" htmlFor="adm-login-username">{t('username')}</label>
            <input
              id="adm-login-username"
              className="adm-input"
              type="text"
              placeholder={t('usernamePlaceholder')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              dir="ltr"
              autoFocus
              required
            />
          </div>

          <div className="adm-form-group">
            <label className="adm-label" htmlFor="adm-login-password">{t('password')}</label>
            <input
              id="adm-login-password"
              className="adm-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              required
            />
          </div>

          {errorText && (
            <div className="adm-alert adm-alert-error" role="alert">
              ⚠ {errorText}
            </div>
          )}

          <button
            className="adm-btn adm-btn-primary"
            type="submit"
            disabled={isLoading || isCheckingSession}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px 20px', fontSize: '14px' }}
          >
            {isCheckingSession
              ? <><span className="adm-spinner" style={{ width: 15, height: 15 }} /> {t('checking')}</>
              : isLoading
              ? <><span className="adm-spinner" style={{ width: 15, height: 15 }} /> {t('signingIn')}</>
              : t('signIn')
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--adm-text-dim)' }}>
          {t('footer', { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </div>
  );
};

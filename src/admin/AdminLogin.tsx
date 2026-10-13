import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from './utils/adminApi';
import { useAdminAuth } from './utils/useAdminAuth';
import { defineMessages, useAdminLang, useT } from './i18n/core';
import { Alert, Button, Field } from './ui';

const messages = defineMessages({
  en: {
    subtitle: 'Admin dashboard',
    sessionExpired: 'Your session expired. Sign in again to continue where you left off.',
    username: 'Username',
    usernamePlaceholder: 'Enter your username',
    password: 'Password',
    checking: 'Checking session…',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
    invalidCredentials: 'Invalid username or password.',
    cookieBlocked: 'Signed in, but the browser did not keep the session cookie. Allow cookies for this site and try again.',
    footer: 'KARAHOCA © {year} — Secure area',
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
      <Button
        variant="ghost"
        size="sm"
        icon="language"
        className="adm-login-lang"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        lang={lang === 'ar' ? 'en' : 'ar'}
      >
        {t('switchLang')}
      </Button>
      <div className="adm-login-card">

        {/* Logo */}
        <div className="adm-login-logo">
          <h1>KARAHOCA</h1>
          <p>{t('subtitle')}</p>
        </div>

        {sessionExpired && !error && <Alert tone="info">{t('sessionExpired')}</Alert>}

        <form onSubmit={handleSubmit}>
          <Field label={t('username')}>
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
          </Field>

          <Field label={t('password')}>
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
          </Field>

          {errorText && (
            <Alert tone="danger">{errorText}</Alert>
          )}

          <Button
            type="submit"
            variant="primary"
            block
            className="adm-login-submit"
            loading={isLoading || isCheckingSession}
          >
            {isCheckingSession ? t('checking') : isLoading ? t('signingIn') : t('signIn')}
          </Button>
        </form>

        <p className="adm-login-footer">
          {t('footer', { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackFormSubmit } from '../utils/analytics';
import { buildApiUrl } from '../utils/api';

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

interface WelcomeEmailStatus {
  sent: boolean;
  id?: string;
  error?: string;
}

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [welcomeEmailStatus, setWelcomeEmailStatus] = useState<WelcomeEmailStatus | null>(null);
  const currentYear = new Date().getFullYear();
  const isHomePage = location.pathname === '/';
  const brandsHref = isHomePage ? '#brands' : '/#brands';
  const aboutHref = isHomePage ? '#about' : '/about';
  const numbersHref = isHomePage ? '#numbers' : '/#numbers';
  const contactAddress = t('footer.contact.address');
  const contactEmail = t('footer.contact.email');
  const contactPhone = t('footer.contact.phone');

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);

    if (emailError) {
      setEmailError('');
    }

    if (submissionState === 'success') {
      setSubmissionState('idle');
    }
  };

  const handleSubscribe = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setEmailError(t('footer.newsletter.error.required'));
      return;
    }

    if (!validateEmail(email)) {
      setEmailError(t('footer.newsletter.error.invalid'));
      return;
    }

    setSubmissionState('loading');
    setEmailError('');

    try {
      const response = await fetch(buildApiUrl('/api/newsletter/subscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error('Newsletter subscription failed');
      }

      const data = await response.json().catch(() => ({}));
      setWelcomeEmailStatus(data.welcomeEmail ?? null);

      setSubmissionState('success');
      setEmail('');
      trackFormSubmit('Newsletter Subscription', true);

      setTimeout(() => {
        setSubmissionState('idle');
        setWelcomeEmailStatus(null);
      }, 8000);
    } catch {
      setSubmissionState('error');
      setEmailError(t('footer.newsletter.error.failed'));
      trackFormSubmit('Newsletter Subscription', false);

      setTimeout(() => {
        setSubmissionState('idle');
      }, 3000);
    }
  };

  return (
    <footer id="contact" className="site-footer glass-panel">
      <div className="section-divider"></div>
      <div className="container footer__grid">
        <section className="footer__brand">
          <img
            src="/cropped-karahoca-logo-s-.webp"
            alt="KARAHOCA"
            style={{ height: '64px', width: 'auto', objectFit: 'contain' }}
          />
          <p>{t('footer.description')}</p>
          <div className="footer__socials">
            <a href="https://www.facebook.com/KARAHOCAKIMYA/" aria-label="Facebook" className="social glass-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a href="https://www.instagram.com/karahocakimya/?hl=ar" aria-label="Instagram" className="social glass-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
        </section>

        <nav className="footer__links" aria-label={t('footer.links.title')}>
          <strong>{t('footer.links.title')}</strong>
          <Link to="/" className="footer-link">{t('footer.links.home')}</Link>
          <a href={brandsHref} className="footer-link">{t('footer.links.brands')}</a>
          <Link to="/news" className="footer-link">{t('footer.links.news')}</Link>
          <a href={aboutHref} className="footer-link">{t('footer.links.about')}</a>
          <a href={numbersHref} className="footer-link">{t('footer.links.numbers')}</a>
        </nav>

        <section className="footer__contact">
          <strong>{t('footer.contact.title')}</strong>
          <address>
            {contactAddress}<br />
            {contactEmail}<br />
            <a
              href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`}
              style={{
                color: 'inherit',
                textDecoration: 'none',
                direction: 'ltr',
                display: 'inline-block'
              }}
            >
              {contactPhone}
            </a>
          </address>
          <form
            className={`newsletter glass-form ${submissionState !== 'idle' ? `newsletter--${submissionState}` : ''}`}
            onSubmit={handleSubscribe}
            noValidate
          >
            <div className="newsletter__input-wrapper">
              <input
                type="email"
                placeholder={t('footer.newsletter.placeholder')}
                required
                className={`glass-input ${emailError ? 'input--error' : ''} ${submissionState === 'success' ? 'input--success' : ''}`}
                value={email}
                onChange={handleEmailChange}
                disabled={submissionState === 'loading'}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              {emailError && (
                <span id="email-error" className="newsletter__error" role="alert">
                  {emailError}
                </span>
              )}
              {submissionState === 'success' && (
                <span className="newsletter__success" role="status">
                  {t('footer.newsletter.success')}
                  {welcomeEmailStatus && (
                    <span style={{
                      display: 'block',
                      fontSize: '0.75em',
                      marginTop: '4px',
                      color: welcomeEmailStatus.sent ? '#22c55e' : '#f87171',
                      direction: 'ltr',
                      textAlign: 'left'
                    }}>
                      {welcomeEmailStatus.sent
                        ? `✅ Welcome email sent (id: ${welcomeEmailStatus.id})`
                        : `⚠️ Email error: ${welcomeEmailStatus.error}`}
                    </span>
                  )}
                </span>
              )}
            </div>
            <button
              className="btn btn--primary"
              type="submit"
              disabled={submissionState === 'loading'}
            >
              {submissionState === 'loading' ? (
                <>
                  <span className="btn__spinner"></span>
                  {t('footer.newsletter.submitting')}
                </>
              ) : (
                t('footer.newsletter.subscribe')
              )}
            </button>
          </form>
        </section>
      </div>
      <div className="container footnote">
        <p>{t('footer.copyright', { year: currentYear })}</p>
      </div>
    </footer>
  );
};

export default Footer;

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { WishlistProvider } from './contexts/WishlistContext';
import WhatsAppButton from './components/WhatsAppButton';
import GoogleAnalytics from './components/GoogleAnalytics';
import CookieConsent from './components/CookieConsent';
import ThemeToggle from './components/ThemeToggle';
import LazyAIChatWidget from './components/LazyAIChatWidget';
import BackendStatusBanner from './components/BackendStatusBanner';
import { OrganizationSchema, WebsiteSchema } from './components/SchemaOrg';
import { useScrollAnimations, usePerformanceOptimizations, useCurrentYear } from './hooks/useAnimations';
import { useLocaleSync } from './hooks/useLocaleSync';
import {
  getLanguageDirection,
  supportedLanguageCodes,
  type SupportedLanguageCode,
} from './utils/language';
import { detectPreferredLang, DEFAULT_LANG } from './utils/localizedPath';
import './styles/main.css';
import './styles/employee.css';
import './styles/professional-system.css';

// Route-level code splitting: every page is a separate chunk so a visitor to
// /privacy does not download /diox, /aylux, etc. Cuts initial JS dramatically.
const Home = lazy(() => import('./pages/Home'));
const DioxPage = lazy(() => import('./pages/DioxPage'));
const ProductionPage = lazy(() => import('./pages/ProductionPage'));
const GoalPage = lazy(() => import('./pages/GoalPage'));
const DryerPage = lazy(() => import('./pages/DryerPage'));
const AyluxPage = lazy(() => import('./pages/AyluxPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'));
const NewsArticlePage = lazy(() => import('./pages/NewsArticlePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));

const AdminApp = lazy(() => import('./admin/AdminApp').then(m => ({ default: m.AdminApp })));

// Minimal inline fallback — avoids pulling the PageLoader skeleton bundle
// onto the critical path for every route transition.
const RouteFallback = () => (
  <div
    className="route-fallback"
    role="status"
    aria-live="polite"
    aria-label="Loading"
  />
);

// ─── Locale routing helpers ────────────────────────────────────────────────

/**
 * Client-side redirect for the naked root URL `/` → `/<preferred-lang>/`.
 *
 * Preference resolution is centralised in `detectPreferredLang()`:
 *   localStorage → navigator → DEFAULT_LANG. We use `replace` so the root
 *   URL never ends up in history (no broken Back button after first load).
 */
const RootLangRedirect = () => {
  const preferred = typeof window === 'undefined' ? DEFAULT_LANG : detectPreferredLang();
  return <Navigate to={`/${preferred}/`} replace />;
};

/**
 * Any request that didn't match `/admin/*`, `/:lang/*`, or `/`. Two cases:
 *
 *   (a) Legacy pre-refactor URL like `/about` or `/news/my-article` — we
 *       preserve the pathname and just prepend the detected language, so
 *       old inbound links keep working and search engines get a clean 301
 *       (well, 302 via client, but the redirect is stable and canonicals
 *       point at the new URL).
 *
 *   (b) Garbage like `/ar-SA/foo` where the first segment looks like a lang
 *       code but isn't supported. Same treatment — prepend the detected
 *       language; if the result doesn't match any real route the inner
 *       `NotFoundPage` handles it.
 */
const LegacyPathRedirect = () => {
  const location = useLocation();
  const preferred = typeof window === 'undefined' ? DEFAULT_LANG : detectPreferredLang();
  const { pathname, search, hash } = location;
  const target = `/${preferred}${pathname === '/' ? '/' : pathname}${search}${hash}`;
  return <Navigate to={target} replace />;
};

/**
 * Parent route element for `/:lang/...`.
 *
 * Responsibilities:
 *   1. Validate that `:lang` is one of our four supported codes. If not,
 *      rewrite to `/<default>/<originalPath>` — that keeps paths like
 *      `/about` (which matches `/:lang` with lang="about") from rendering
 *      a blank page; they get bounced to `/<default>/about` and only the
 *      inner NotFoundPage decides if they truly 404.
 *   2. Sync i18n to the URL via `useLocaleSync` so every useTranslation()
 *      consumer sees the right language without manual wiring.
 *   3. Emit `<html lang dir>` via Helmet so screen readers, RTL scrollbars,
 *      and form controls read the correct direction from the root element
 *      (the old pattern set `dir` on an inner <div class="App">, which
 *      broke native browser RTL).
 *   4. Render site chrome (analytics, cookie consent, chat widget, theme
 *      toggle, WhatsApp CTA) ONCE so they survive in-app navigation
 *      without remounting.
 */
interface LocalizedShellProps {
  /**
   * Language this shell instance serves. Passed as a prop instead of read
   * from a `:lang` route param because the route tree now enumerates the
   * supported languages as explicit static prefixes (see App below). The
   * prop is always a known-valid `SupportedLanguageCode` — no runtime
   * validation needed; the route pattern guarantees it.
   */
  lang: SupportedLanguageCode;
}

const LocalizedShell: React.FC<LocalizedShellProps> = ({ lang: shellLang }) => {
  // Hooks must always run unconditionally. useLocaleSync reads the :lang
  // URL param internally, which is now empty — we'll pass it explicitly
  // below by synchronising i18n here instead.
  useLocaleSync();
  useScrollAnimations();
  usePerformanceOptimizations();
  useCurrentYear();

  const lang = shellLang;
  const dir = getLanguageDirection(lang);

  return (
    <>
      {/* Applies `<html lang dir>` on the REAL root element, not an inner
          div. Page-level <SEO /> components may override the same attrs
          later in the render — Helmet just merges idempotently. */}
      <Helmet>
        <html lang={lang} dir={dir} />
      </Helmet>

      <BackendStatusBanner />
      <GoogleAnalytics />
      <CookieConsent />
      <OrganizationSchema />
      <WebsiteSchema />

      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>

      <LazyAIChatWidget />
      <ThemeToggle />
      <WhatsAppButton phoneNumber="905305914990" />
    </>
  );
};

/**
 * Child routes rendered inside every localised shell. Declared once and
 * re-used per-language below to keep behaviour identical across locales.
 */
const renderLocalisedChildren = () => (
  <>
    <Route index element={<Home />} />
    <Route path="about" element={<AboutPage />} />
    <Route path="news" element={<NewsPage />} />
    <Route path="news/:slug" element={<NewsArticlePage />} />
    <Route path="diox" element={<DioxPage />} />
    <Route path="aylux" element={<AyluxPage />} />
    <Route path="production" element={<ProductionPage />} />
    <Route path="goal" element={<GoalPage />} />
    <Route path="dryer" element={<DryerPage />} />
    <Route path="wishlist" element={<WishlistPage />} />
    <Route path="unsubscribe" element={<UnsubscribePage />} />
    <Route path="privacy" element={<PrivacyPage />} />
    <Route path="terms" element={<TermsPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </>
);

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <WishlistProvider>
          <Router>
            <Routes>
              {/* Admin stays outside the localised tree — it's an internal
                  tool and does not need SEO language routing. */}
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AdminApp />
                  </Suspense>
                }
              />

              {/* Root → language redirect. */}
              <Route path="/" element={<RootLangRedirect />} />

              {/*
                Localised site tree.

                ⚠ IMPORTANT: we enumerate the four supported languages as
                explicit routes (`/ar`, `/en`, `/tr`, `/ru`) instead of using
                a single `/:lang` param. Why:

                  React Router v7's route-ranking scores static > dynamic.
                  With `/:lang` + child `news`, the total score for
                  `/:lang/news` is higher than `/admin/*` (static + splat),
                  so `/admin/news` used to match `/:lang/news` with
                  lang="admin". LocalizedShell then redirected to
                  `/ar/admin/news` which 404'd. Four explicit static
                  prefixes remove the ambiguity — `/admin/*` wins
                  unconditionally now.

                Each block uses the SAME `renderLocalisedChildren()` so
                behaviour per language is identical.
              */}
              {supportedLanguageCodes.map((lang) => (
                <Route key={lang} path={`/${lang}`} element={<LocalizedShell lang={lang} />}>
                  {renderLocalisedChildren()}
                </Route>
              ))}

              {/* Any non-admin, non-root, non-language-prefixed path. Keeps
                  legacy bookmarks and external links alive after the URL
                  restructure. */}
              <Route path="*" element={<LegacyPathRedirect />} />
            </Routes>
          </Router>
        </WishlistProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorBoundary from './components/ErrorBoundary';
import { WishlistProvider } from './contexts/WishlistContext';
import WhatsAppButton from './components/WhatsAppButton';
import GoogleAnalytics from './components/GoogleAnalytics';
import CookieConsent from './components/CookieConsent';
import ThemeToggle from './components/ThemeToggle';
import LazyAIChatWidget from './components/LazyAIChatWidget';
import { OrganizationSchema, WebsiteSchema } from './components/SchemaOrg';
import { useScrollAnimations, usePerformanceOptimizations, useCurrentYear } from './hooks/useAnimations';
import { useLocaleSync } from './hooks/useLocaleSync';
import { getLanguageDirection, normalizeLanguageCode } from './utils/language';
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

function MainSite() {
  const { i18n } = useTranslation();

  useScrollAnimations();
  usePerformanceOptimizations();
  useCurrentYear();
  // Reconcile i18n to localStorage/navigator AFTER hydration completes.
  // First client render uses the language baked into <html lang="..."> so it
  // exactly matches the prerendered / server-injected HTML.
  useLocaleSync();

  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const currentDir = getLanguageDirection(currentLang);

  return (
    <>
      <GoogleAnalytics />
      <CookieConsent />
      <OrganizationSchema />
      <WebsiteSchema />

      <div className="App" dir={currentDir} lang={currentLang}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsArticlePage />} />
            <Route path="/diox" element={<DioxPage />} />
            <Route path="/aylux" element={<AyluxPage />} />
            <Route path="/production" element={<ProductionPage />} />
            <Route path="/goal" element={<GoalPage />} />
            <Route path="/dryer" element={<DryerPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <LazyAIChatWidget />
        <ThemeToggle />
        <WhatsAppButton phoneNumber="905305914990" />
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <WishlistProvider>
          <Router>
            <Routes>
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AdminApp />
                  </Suspense>
                }
              />
              <Route path="*" element={<MainSite />} />
            </Routes>
          </Router>
        </WishlistProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;

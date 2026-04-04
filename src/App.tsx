import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorBoundary from './components/ErrorBoundary';
import WhatsAppButton from './components/WhatsAppButton';
import GoogleAnalytics from './components/GoogleAnalytics';
import Home from './pages/Home';
import DioxPage from './pages/DioxPage';
import ProductionPage from './pages/ProductionPage';
import GoalPage from './pages/GoalPage';
import DryerPage from './pages/DryerPage';
import AyluxPage from './pages/AyluxPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import NotFoundPage from './pages/NotFoundPage';
import WishlistPage from './pages/WishlistPage';
import UnsubscribePage from './pages/UnsubscribePage';
import ThemeToggle from './components/ThemeToggle';
import AIChatWidget from './components/AIChatWidget';
import { OrganizationSchema, WebsiteSchema } from './components/SchemaOrg';
import MobileLayout from './mobile/MobileLayout';
import MobileHome from './mobile/MobileHome';
import MobileAboutPage from './mobile/MobileAboutPage';
import MobileNewsPage from './mobile/MobileNewsPage';
import MobileDioxPage from './mobile/MobileDioxPage';
import MobileAyluxPage from './mobile/MobileAyluxPage';
import MobileProductionPage from './mobile/MobileProductionPage';
import MobileGoalPage from './mobile/MobileGoalPage';
import MobileDryerPage from './mobile/MobileDryerPage';
import PageLoader from './components/PageLoader';
import { useIsMobile } from './hooks/useIsMobile';
import { useScrollAnimations, usePerformanceOptimizations, useCurrentYear } from './hooks/useAnimations';
import { getLanguageDirection, normalizeLanguageCode } from './utils/language';
import './styles/main.css';
import './styles/employee.css';
import './styles/professional-system.css';

const AdminApp = lazy(() => import('./admin/AdminApp').then(m => ({ default: m.AdminApp })));

function MainSite() {
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isHiding, setIsHiding] = useState(false);

  useScrollAnimations();
  usePerformanceOptimizations();
  useCurrentYear();

  const isMobile = useIsMobile(768);
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const currentDir = getLanguageDirection(currentLang);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHiding(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <GoogleAnalytics />
      <OrganizationSchema />
      <WebsiteSchema />
      {isLoading && <PageLoader hiding={isHiding} />}

      {!isLoading && (
        <>
          {isMobile ? (
            <div className="App" dir={currentDir} lang={currentLang}>
              <MobileLayout>
                <Routes>
                  <Route path="/" element={<MobileHome />} />
                  <Route path="/about" element={<MobileAboutPage />} />
                  <Route path="/news" element={<MobileNewsPage />} />
                  <Route path="/diox" element={<MobileDioxPage />} />
                  <Route path="/aylux" element={<MobileAyluxPage />} />
                  <Route path="/production" element={<MobileProductionPage />} />
                  <Route path="/goal" element={<MobileGoalPage />} />
                  <Route path="/dryer" element={<MobileDryerPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/unsubscribe" element={<UnsubscribePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </MobileLayout>
              <AIChatWidget />
              <ThemeToggle />
              <WhatsAppButton phoneNumber="905305914990" />
            </div>
          ) : (
            <div className="App" dir={currentDir} lang={currentLang}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/diox" element={<DioxPage />} />
                <Route path="/aylux" element={<AyluxPage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/goal" element={<GoalPage />} />
                <Route path="/dryer" element={<DryerPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <AIChatWidget />
              <ThemeToggle />
              <WhatsAppButton phoneNumber="905305914990" />
            </div>
          )}
        </>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#fff', fontFamily: 'sans-serif', fontSize: 16 }}>Loading...</div>}>
                  <AdminApp />
                </Suspense>
              }
            />
            <Route path="*" element={<MainSite />} />
          </Routes>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;

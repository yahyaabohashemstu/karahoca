import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useState, useEffect } from 'react';
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
import ThemeToggle from './components/ThemeToggle';
import AIChatWidget from './components/AIChatWidget';
import MobileLayout from './mobile/MobileLayout';
import MobileHome from './mobile/MobileHome';
import MobileAboutPage from './mobile/MobileAboutPage';
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

function App() {
  const { i18n } = useTranslation();

  // حالة التحميل
  const [isLoading, setIsLoading] = useState(true);
  const [isHiding, setIsHiding] = useState(false);

  // تطبيق الـ hooks للرسوم المتحركة والتحسينات
  useScrollAnimations();
  usePerformanceOptimizations();
  useCurrentYear();

  // الكشف عن نسخة الهاتف
  const isMobile = useIsMobile(768);
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const currentDir = getLanguageDirection(currentLang);

  // محاكاة التحميل (في التطبيق الحقيقي يمكن ربطه بتحميل البيانات)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHiding(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 300); // انتظار انتهاء الأنيميشن
    }, 1200); // وقت التحميل

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <GoogleAnalytics />
          {/* Skeleton Loading */}
          {isLoading && <PageLoader hiding={isHiding} />}

          {/* المحتوى الرئيسي */}
          {!isLoading && (
            <>
              {isMobile ? (
                // واجهة الهاتف المخصصة
                <div className="App" dir={currentDir} lang={currentLang}>
                  <MobileLayout>
                    <Routes>
                      <Route path="/" element={<MobileHome />} />
                      <Route path="/about" element={<MobileAboutPage />} />
                      <Route path="/diox" element={<MobileDioxPage />} />
                      <Route path="/aylux" element={<MobileAyluxPage />} />
                      <Route path="/production" element={<MobileProductionPage />} />
                      <Route path="/goal" element={<MobileGoalPage />} />
                      <Route path="/dryer" element={<MobileDryerPage />} />
                    </Routes>
                  </MobileLayout>
                  <AIChatWidget />
                  <ThemeToggle />
                  <WhatsAppButton phoneNumber="905305914990" />
                </div>
              ) : (
                // واجهة الكمبيوتر الأصلية
                <div className="App" dir={currentDir} lang={currentLang}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/diox" element={<DioxPage />} />
                    <Route path="/aylux" element={<AyluxPage />} />
                    <Route path="/production" element={<ProductionPage />} />
                    <Route path="/goal" element={<GoalPage />} />
                    <Route path="/dryer" element={<DryerPage />} />
                  </Routes>
                  <AIChatWidget />
                  <ThemeToggle />
                  <WhatsAppButton phoneNumber="905305914990" />
                </div>
              )}
            </>
          )}
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;

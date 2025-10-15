import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
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
import { useScrollAnimations, usePerformanceOptimizations, useCurrentYear } from './hooks/useAnimations';
import './styles/main.css';
import './styles/employee.css';
import './styles/professional-system.css';

function App() {
  // تطبيق الـ hooks للرسوم المتحركة والتحسينات
  useScrollAnimations();
  usePerformanceOptimizations();
  useCurrentYear();

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <GoogleAnalytics />
          <div className="App light-mode" dir="rtl" lang="ar">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/diox" element={<DioxPage />} />
              <Route path="/aylux" element={<AyluxPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/goal" element={<GoalPage />} />
              <Route path="/dryer" element={<DryerPage />} />
            </Routes>
            <ThemeToggle />
            <WhatsAppButton 
              phoneNumber="905305914990"
              message="مرحباً! أرغب في الاستفسار عن منتجات KARAHOCA"
            />
          </div>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
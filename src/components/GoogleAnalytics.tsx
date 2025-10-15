import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

interface GoogleAnalyticsProps {
  measurementId?: string;
}

const GoogleAnalytics: React.FC<GoogleAnalyticsProps> = ({ measurementId }) => {
  const location = useLocation();

  useEffect(() => {
    // الحصول على معرف GA من props أو من متغير البيئة
    const gaId = measurementId || import.meta.env.VITE_GA_MEASUREMENT_ID;

    // تهيئة Google Analytics فقط إذا كان المعرف موجوداً
    if (gaId && gaId !== 'G-XXXXXXXXXX') {
      try {
        // تهيئة GA4
        ReactGA.initialize(gaId, {
          gaOptions: {
            debug_mode: import.meta.env.DEV, // تفعيل وضع التصحيح في التطوير فقط
          },
          gtagOptions: {
            anonymize_ip: true, // إخفاء عنوان IP للخصوصية
            cookie_flags: 'SameSite=None;Secure', // إعدادات الكوكيز
          }
        });

        console.log('✅ Google Analytics initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Google Analytics:', error);
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('⚠️ Google Analytics not initialized: Missing or invalid VITE_GA_MEASUREMENT_ID');
      }
    }
  }, [measurementId]);

  // تتبع تغيير الصفحات
  useEffect(() => {
    const gaId = measurementId || import.meta.env.VITE_GA_MEASUREMENT_ID;
    
    if (gaId && gaId !== 'G-XXXXXXXXXX') {
      try {
        // إرسال pageview عند تغيير المسار
        ReactGA.send({
          hitType: 'pageview',
          page: location.pathname + location.search,
          title: document.title
        });

        if (import.meta.env.DEV) {
          console.log('📊 GA Pageview:', location.pathname);
        }
      } catch (error) {
        console.error('❌ Failed to send pageview:', error);
      }
    }
  }, [location, measurementId]);

  // هذا المكون لا يعرض أي شيء
  return null;
};

// دالة مساعدة لتتبع الأحداث المخصصة
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (gaId && gaId !== 'G-XXXXXXXXXX') {
    try {
      ReactGA.event({
        category,
        action,
        label,
        value
      });

      if (import.meta.env.DEV) {
        console.log('📊 GA Event:', { category, action, label, value });
      }
    } catch (error) {
      console.error('❌ Failed to track event:', error);
    }
  }
};

// دالة مساعدة لتتبع النقرات على الروابط الخارجية
export const trackOutboundLink = (url: string, label?: string) => {
  trackEvent('Outbound Link', 'Click', label || url);
};

// دالة مساعدة لتتبع تنزيل الملفات
export const trackDownload = (filename: string) => {
  trackEvent('Download', 'File', filename);
};

// دالة مساعدة لتتبع النقرات على WhatsApp
export const trackWhatsAppClick = () => {
  trackEvent('Contact', 'WhatsApp Click', 'Floating Button');
};

// دالة مساعدة لتتبع إرسال النماذج
export const trackFormSubmit = (formName: string, success: boolean) => {
  trackEvent('Form', success ? 'Submit Success' : 'Submit Error', formName);
};

// دالة مساعدة لتتبع عرض المنتجات
export const trackProductView = (productName: string, brand: string) => {
  trackEvent('Product', 'View', `${brand} - ${productName}`);
};

// دالة مساعدة لتتبع فتح صورة المنتج
export const trackProductImageOpen = (productName: string) => {
  trackEvent('Product', 'Image Open', productName);
};

export default GoogleAnalytics;

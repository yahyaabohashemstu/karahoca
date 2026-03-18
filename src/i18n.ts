import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  getLanguageDirection,
  normalizeLanguageCode,
  supportedLanguageCodes,
} from './utils/language';

// استيراد ملفات الترجمة
import translationAR from './locales/ar/translation.json';
import translationEN from './locales/en/translation.json';
import translationTR from './locales/tr/translation.json';
import translationRU from './locales/ru/translation.json';

// الموارد المتاحة
const resources = {
  ar: {
    translation: translationAR.translation
  },
  en: {
    translation: translationEN.translation
  },
  tr: {
    translation: translationTR.translation
  },
  ru: {
    translation: translationRU.translation
  }
};

const applyDocumentLanguage = (lng?: string | null) => {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedLanguage = normalizeLanguageCode(lng);
  const direction = getLanguageDirection(normalizedLanguage);

  document.documentElement.dir = direction;
  document.documentElement.lang = normalizedLanguage;

  if (import.meta.env.DEV) {
    console.log(`🌐 Language changed to: ${normalizedLanguage} (${direction})`);
  }
};

// تهيئة i18next
void i18n
  .use(LanguageDetector) // كشف اللغة تلقائياً من المتصفح
  .use(initReactI18next) // ربط مع React
  .init({
    resources,
    fallbackLng: 'ar', // اللغة الافتراضية إذا لم يتم العثور على لغة محفوظة
    supportedLngs: [...supportedLanguageCodes],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    cleanCode: true,
    // lng: 'ar', // تم إزالته ليقرأ من localStorage أولاً
    debug: import.meta.env.DEV, // تفعيل وضع التصحيح في التطوير
    
    interpolation: {
      escapeValue: false // React يتعامل مع XSS تلقائياً
    },

    // إعدادات كشف اللغة
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'], // حفظ اللغة المختارة
      lookupLocalStorage: 'i18nextLng'
    },

    // إعدادات RTL
    react: {
      useSuspense: false, // تعطيل Suspense لتجنب مشاكل التحميل
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p']
    }
  })
  .then(() => {
    applyDocumentLanguage(i18n.resolvedLanguage || i18n.language);
  });

// تحديث اتجاه الصفحة عند تغيير اللغة
i18n.on('languageChanged', (lng) => {
  applyDocumentLanguage(lng);
});

export default i18n;

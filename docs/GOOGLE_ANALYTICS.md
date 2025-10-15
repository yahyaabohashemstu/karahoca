# دليل تكامل Google Analytics 4

## 📊 نظرة عامة
تم تكامل Google Analytics 4 (GA4) في المشروع لتتبع سلوك المستخدمين وتحليل الأداء.

## ⚙️ التكوين

### 1. الحصول على معرف GA4
1. قم بزيارة [Google Analytics](https://analytics.google.com/)
2. أنشئ حساباً جديداً أو استخدم حساباً موجوداً
3. أنشئ خاصية GA4 جديدة
4. انسخ معرف القياس (Measurement ID) بصيغة: `G-XXXXXXXXXX`

### 2. إعداد متغيرات البيئة
1. أنشئ ملف `.env` في المجلد الجذر:
```bash
cp .env.example .env
```

2. أضف معرف GA4 في ملف `.env`:
```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

⚠️ **تحذير**: لا ترفع ملف `.env` إلى Git! تأكد من إضافته في `.gitignore`

## 🔍 الأحداث المتتبعة

### أحداث تلقائية:
- ✅ **Pageviews**: تتبع كل تغيير في الصفحة
- ✅ **Scroll**: تتبع عمق التمرير
- ✅ **Click**: النقرات على العناصر التفاعلية

### أحداث مخصصة:
1. **Contact/WhatsApp Click**: عند النقر على زر WhatsApp
2. **Form/Submit Success**: عند نجاح إرسال نموذج الاشتراك
3. **Form/Submit Error**: عند فشل إرسال نموذج الاشتراك
4. **Product/View**: عند عرض تفاصيل منتج
5. **Product/Image Open**: عند فتح صورة منتج
6. **Outbound Link/Click**: عند النقر على روابط خارجية
7. **Download/File**: عند تنزيل ملفات

## 📝 استخدام الدوال المساعدة

### تتبع حدث مخصص:
```typescript
import { trackEvent } from './components/GoogleAnalytics';

trackEvent('Category', 'Action', 'Label', value);
```

### تتبع النقر على WhatsApp:
```typescript
import { trackWhatsAppClick } from './components/GoogleAnalytics';

trackWhatsAppClick();
```

### تتبع عرض منتج:
```typescript
import { trackProductView } from './components/GoogleAnalytics';

trackProductView('اسم المنتج', 'DIOX');
```

### تتبع فتح صورة:
```typescript
import { trackProductImageOpen } from './components/GoogleAnalytics';

trackProductImageOpen('اسم المنتج');
```

### تتبع إرسال نموذج:
```typescript
import { trackFormSubmit } from './components/GoogleAnalytics';

trackFormSubmit('Form Name', true); // true = success, false = error
```

### تتبع رابط خارجي:
```typescript
import { trackOutboundLink } from './components/GoogleAnalytics';

trackOutboundLink('https://example.com', 'Label');
```

### تتبع تنزيل ملف:
```typescript
import { trackDownload } from './components/GoogleAnalytics';

trackDownload('filename.pdf');
```

## 🛡️ الخصوصية والأمان

### الميزات المُفعّلة:
- ✅ **IP Anonymization**: إخفاء عناوين IP للمستخدمين
- ✅ **Secure Cookies**: استخدام إعدادات آمنة للكوكيز
- ✅ **Debug Mode**: تفعيل وضع التصحيح في البيئة التطويرية فقط

### ملاحظات الخصوصية:
- يتم إخفاء عناوين IP تلقائياً
- لا يتم جمع معلومات شخصية حساسة
- يتوافق مع GDPR وقوانين الخصوصية

## 🧪 اختبار التكامل

### في بيئة التطوير:
1. تأكد من وجود معرف GA4 في `.env`
2. شغّل الخادم: `npm run dev`
3. افتح Console في المتصفح
4. ستشاهد رسائل تأكيد:
   - `✅ Google Analytics initialized successfully`
   - `📊 GA Pageview: /path`
   - `📊 GA Event: {...}`

### التحقق من البيانات:
1. افتح [Google Analytics](https://analytics.google.com/)
2. اذهب إلى Reports > Realtime
3. تنقل في الموقع وتأكد من ظهور البيانات

## 🚀 الإنتاج

### قبل النشر:
1. تأكد من صحة معرف GA4
2. أضف المعرف في إعدادات البيئة على السيرفر
3. اختبر التتبع في بيئة staging أولاً

### متغيرات البيئة للإنتاج:
```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 📈 التقارير والتحليلات

### التقارير المهمة:
1. **Realtime**: مراقبة المستخدمين الحاليين
2. **Acquisition**: مصادر الزيارات
3. **Engagement**: تفاعل المستخدمين
4. **Events**: الأحداث المخصصة
5. **Pages and Screens**: الصفحات الأكثر زيارة

### مقاييس KPI:
- عدد المستخدمين النشطين
- معدل الارتداد (Bounce Rate)
- مدة الجلسة
- الصفحات الأكثر زيارة
- معدل التحويل

## 🔧 استكشاف الأخطاء

### GA لا يعمل:
1. تحقق من صحة معرف GA4
2. تأكد من وجود `.env` وصحة المتغيرات
3. افتح Console وابحث عن رسائل الخطأ
4. تأكد من تفعيل JavaScript في المتصفح

### لا تظهر البيانات:
1. انتظر 24-48 ساعة لمعالجة البيانات
2. استخدم Realtime Report للتحقق الفوري
3. تأكد من عدم حظر GA بواسطة Ad Blockers

## 📚 مصادر إضافية
- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [react-ga4 Documentation](https://github.com/codler/react-ga4)
- [GA4 Events Best Practices](https://support.google.com/analytics/answer/9322688)

## 🤝 الدعم
للمساعدة أو الأسئلة، راجع:
- التوثيق الرسمي لـ GA4
- مجتمع Google Analytics
- قناة الدعم الفني للمشروع

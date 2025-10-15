# 📱 دليل تصميم الموبايل - KARAHOCA
## Mobile Design Brief - موجز التصميم

---

## 🎨 **1. نظام الألوان الأساسي** (Color System)

### الألوان الرئيسية
```css
--blue: #0a2a5e      /* الأزرق الداكن - العلامة الرئيسية */
--orange: #ff5b2e    /* البرتقالي - اللون المميز */
--white: #ffffff     /* الأبيض */
```

### ألوان النصوص
```css
--text: rgba(255, 255, 255, 0.95)       /* النص الأساسي */
--text-muted: rgba(255, 255, 255, 0.7)  /* النص الثانوي */
--text-subtle: rgba(255, 255, 255, 0.5) /* النص الباهت */
```

### نظام Glass Morphism
```css
--glass-bg: rgba(255, 255, 255, 0.08)
--glass-border: rgba(255, 255, 255, 0.15)
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3)
--glass-backdrop: blur(16px) saturate(180%)
```

**التدرجات اللونية:**
- Hero الرئيسي: `linear-gradient(135deg, #0a2a5e, #ff5b2e)`
- صفحة DIOX: `linear-gradient(135deg, #0a2a5e, #1e4a8c)`
- صفحة AYLUX: `linear-gradient(135deg, #ff5b2e, #ff7a50)`

---

## 📏 **2. نظام المسافات** (Spacing System)

```css
--space-xs: 4px      /* مسافات دقيقة جداً */
--space-sm: 8px      /* مسافات صغيرة */
--space-md: 16px     /* مسافات متوسطة */
--space-lg: 24px     /* مسافات كبيرة */
--space-xl: 32px     /* مسافات كبيرة جداً */
--space-2xl: 48px    /* مسافات ضخمة */
--space-3xl: 64px    /* مسافات ضخمة جداً */
```

### تطبيق على الموبايل (Mobile Application)
- **Padding الأقسام**: `48px 0` (بدلاً من 96px على الكمبيوتر)
- **Padding الحاويات**: `0 16px` (بدلاً من 24px على الكمبيوتر)
- **مسافات البطاقات**: `24px` (بدلاً من 32px على الكمبيوتر)

---

## ✍️ **3. نظام الخطوط** (Typography System)

### أحجام الخطوط للموبايل
```css
/* العناوين الكبيرة - Hero Titles */
Desktop: 60px (3.75rem)  →  Mobile: 36px (2.25rem)

/* العناوين الرئيسية - Main Headings */
Desktop: 48px (3rem)     →  Mobile: 30px (1.875rem)

/* العناوين الفرعية - Subheadings */
Desktop: 36px (2.25rem)  →  Mobile: 24px (1.5rem)

/* النصوص الكبيرة - Large Text */
Desktop: 20px (1.25rem)  →  Mobile: 18px (1.125rem)

/* النصوص العادية - Body Text */
Desktop: 16px (1rem)     →  Mobile: 16px (1rem)

/* النصوص الصغيرة - Small Text */
Desktop: 14px (0.875rem) →  Mobile: 14px (0.875rem)
```

### سماكة الخطوط
```css
--font-light: 300        /* خفيف */
--font-normal: 400       /* عادي */
--font-medium: 500       /* متوسط */
--font-semibold: 600     /* شبه عريض */
--font-bold: 700         /* عريض */
```

### ارتفاع الأسطر
```css
--leading-tight: 1.25    /* للعناوين */
--leading-normal: 1.5    /* للنصوص العادية */
--leading-relaxed: 1.75  /* للنصوص الطويلة */
```

---

## 📐 **4. أبعاد المكونات** (Component Dimensions)

### بطاقات المنتجات (Product Cards)
```
Desktop:
- العرض: 320px - 400px
- الارتفاع: 450px - 500px
- Padding: 32px
- Border Radius: 20px

Mobile:
- العرض: 100% (عمود واحد)
- الارتفاع: تلقائي (auto)
- Padding: 20px
- Border Radius: 16px
```

### بطاقات الميزات (Feature Cards)
```
Desktop:
- العرض: 350px
- Padding: 48px
- Border Radius: 24px

Mobile:
- العرض: 100%
- Padding: 24px
- Border Radius: 16px
```

### Header (الهيدر)
```
Desktop:
- الارتفاع: 80px
- Padding: 0 24px

Mobile:
- الارتفاع: 70px
- Padding: 0 16px
```

### أزرار اللمس (Touch Targets)
```
الحد الأدنى: 44px × 44px
الموصى به: 48px × 48px
```

---

## 📱 **5. نقاط التوقف** (Breakpoints)

```css
/* شاشات الهواتف الصغيرة */
@media (max-width: 480px) {
  /* iPhone SE, Galaxy S */
}

/* شاشات الهواتف المتوسطة */
@media (min-width: 481px) and (max-width: 600px) {
  /* iPhone 12/13/14, Pixel */
}

/* شاشات الهواتف الكبيرة */
@media (min-width: 601px) and (max-width: 768px) {
  /* iPhone Pro Max, Galaxy Note */
}

/* الأجهزة اللوحية */
@media (min-width: 769px) and (max-width: 1024px) {
  /* iPad, Galaxy Tab */
}
```

---

## 🔄 **6. أنماط الحركة** (Animation Patterns)

### سرعات الانتقالات
```css
--transition-fast: 0.15s ease      /* سريع - للتفاعلات الفورية */
--transition-normal: 0.3s ease     /* عادي - للتأثيرات المعتدلة */
--transition-slow: 0.5s ease       /* بطيء - للتأثيرات الدرامية */
```

### التأثيرات المستخدمة
- **Hover (Desktop)**: `translateY(-8px)` + تغيير الظل
- **Active/Touch (Mobile)**: `scale(0.98)` + تغيير الشفافية
- **Scroll Animations**: Fade in + Slide up

---

## 🎴 **7. بنية الصفحات** (Page Structure)

### الصفحة الرئيسية (Home Page)
```
1. Hero Section
   - عنوان رئيسي كبير
   - نص توضيحي
   - صورة مميزة (500px على Desktop → 280px على Mobile)
   - أزرار CTA

2. About Section
   - صورة + نص (تتحول من صفين إلى صف واحد على Mobile)

3. Brands Section
   - شبكة 2×2 على Desktop → عمود واحد على Mobile
   - بطاقات العلامات التجارية

4. Numbers Section
   - 4 أعمدة على Desktop → 2×2 على Mobile

5. Work Section
   - شبكة 3 أعمدة → عمود واحد

6. Goal Section
   - محتوى مركزي

7. Footer
   - 3 أعمدة → عمود واحد
```

### صفحات العلامات التجارية (Brand Pages)
```
1. Hero Section
   - تدرج لوني مميز لكل علامة
   - لوجو العلامة
   - وصف قصير
   - شارات (Badges)

2. Product Categories
   - 3 فئات: تنظيف المنزل، الغسيل، النظافة الشخصية
   - شبكة منتجات: 3-4 أعمدة → عمود واحد

3. Product Cards
   - تأثير Flip على الكمبيوتر
   - عرض مباشر للمعلومات على الموبايل
   - Popup للصورة الكبيرة عند الضغط
```

---

## 🎯 **8. العناصر التفاعلية** (Interactive Elements)

### بطاقات المنتجات
```
Desktop:
- Hover: تدور البطاقة (flip effect)
- Click: تفتح Popup الصورة

Mobile:
- Tap: تفتح Popup الصورة مباشرة
- Long Press: عرض معلومات إضافية
```

### الأزرار
```
Desktop:
- Hover: تغيير اللون + Scale(1.05)

Mobile:
- Touch: تأثير Ripple + Scale(0.98)
- Active State: خلفية أغمق
```

### الروابط
```
Desktop:
- Underline on hover

Mobile:
- Touch feedback فوري
- Highlight على الضغط
```

---

## 📊 **9. الشبكات** (Grid Systems)

### Desktop Grid
```css
display: grid;
grid-template-columns: repeat(3, 1fr);  /* 3 أعمدة */
gap: 32px;                              /* مسافة 32px */
```

### Mobile Grid
```css
display: grid;
grid-template-columns: 1fr;  /* عمود واحد */
gap: 20px;                   /* مسافة 20px */
```

### Tablet Grid
```css
display: grid;
grid-template-columns: repeat(2, 1fr);  /* عمودين */
gap: 24px;                              /* مسافة 24px */
```

---

## 🖼️ **10. معالجة الصور** (Image Handling)

### أحجام الصور

**Hero Images:**
- Desktop: 500px × 500px
- Mobile: 280px × 280px

**Product Images:**
- Desktop: 150px × 150px
- Mobile: 120px × 120px

**Logo:**
- Desktop: 120px عرض
- Mobile: 80px عرض

### التحسينات
```
- استخدام WebP للصور الفوتوغرافية
- استخدام PNG للصور الشفافة
- Lazy Loading للصور أسفل الشاشة
- srcset للدقات المختلفة
```

---

## ⚡ **11. تحسينات الأداء** (Performance)

### Mobile-First Considerations
```
✓ تقليل حجم الصور (max 100KB لكل صورة)
✓ استخدام CSS Grid بدلاً من Flexbox للتخطيطات الكبيرة
✓ تجنب الظلال المعقدة (استخدام box-shadow بسيط)
✓ تقليل backdrop-filter blur (من 16px إلى 8px)
✓ استخدام will-change بحذر
```

---

## 🎨 **12. أمثلة بصرية** (Visual Examples)

### مثال: بطاقة منتج على الموبايل
```
┌─────────────────────────────────┐
│  [صورة المنتج - 120×120px]      │
│                                 │
│  منظف عام ديوكس                 │  (1.25rem)
│  منظف فعال لجميع الأسطح         │  (0.9rem, muted)
│                                 │
│  📦 900ml                       │  (0.875rem)
│  📦 علبة بلاستيك                │  (0.875rem)
│  📦 12 قطعة                     │  (0.875rem)
│                                 │
│  [عرض الصورة]                   │  (Button 44px)
└─────────────────────────────────┘
   Width: 100% | Padding: 20px
   Border Radius: 16px | Glass BG
```

### مثال: Header على الموبايل
```
┌─────────────────────────────────┐
│  ☰  [LOGO]            🌙  🌐   │
│     (80px)           (icons)    │
└─────────────────────────────────┘
   Height: 70px | Padding: 0 16px
```

---

## 📋 **13. قائمة التحقق للمصمم** (Designer Checklist)

### الأساسيات
- [ ] استخدام نظام الألوان المحدد
- [ ] الالتزام بنقاط التوقف (Breakpoints)
- [ ] تطبيق نظام المسافات المعياري
- [ ] استخدام أحجام الخطوط المحددة

### التفاعل
- [ ] أزرار بحجم 44×44px على الأقل
- [ ] مساحات كافية بين العناصر القابلة للنقر
- [ ] تأثيرات Touch واضحة
- [ ] حالات Active/Focus/Disabled

### الأداء
- [ ] صور محسّنة (WebP + PNG)
- [ ] تقليل استخدام backdrop-filter
- [ ] تجنب الحركات المعقدة
- [ ] CSS مضغوط

### الوصول
- [ ] تباين ألوان كافي (4.5:1 على الأقل)
- [ ] نصوص قابلة للقراءة (16px minimum)
- [ ] Focus states واضحة
- [ ] Labels للنماذج

---

## 📄 **14. الملفات المطلوبة من المصمم**

### التسليمات النهائية (Deliverables)
```
1. Figma/Adobe XD File
   - جميع الشاشات (375px, 414px, 768px)
   - المكونات المعاد استخدامها (Components)
   - نظام التصميم (Design System)

2. Assets
   - الأيقونات (SVG)
   - الصور المحسّنة
   - اللوجوهات بأحجام مختلفة

3. Specs
   - قياسات دقيقة
   - ألوان بصيغة Hex/RGB
   - أحجام الخطوط وسماكاتها

4. Prototypes
   - تفاعلات أساسية
   - Transitions
   - حركات Scroll
```

---

## 🔗 **15. روابط مفيدة** (Useful Resources)

- **Material Design - Touch Targets**: 48dp minimum
- **iOS Human Interface Guidelines**: 44pt minimum
- **WCAG Contrast Checker**: 4.5:1 ratio
- **Google Page Speed Insights**: Performance testing

---

## 📞 **16. معلومات الاتصال**

للأسئلة والاستفسارات:
- GitHub: yahyaabohashemstu/karahoca
- Email: [البريد الإلكتروني]

---

**آخر تحديث**: 15 أكتوبر 2025
**الإصدار**: 1.0

---

## 🎯 **ملاحظات نهائية**

1. **اتجاه RTL**: جميع النصوص بالعربية والموقع من اليمين لليسار
2. **Glass Morphism**: استخدام backdrop-filter وشفافية في كل مكان
3. **التدرجات**: من الأزرق إلى البرتقالي في معظم العناصر
4. **الحركة**: سلسة وسريعة (0.3s standard)
5. **اللمس**: أولوية قصوى لتجربة اللمس على الموبايل

**المبدأ الذهبي**: "كل ما يعمل على Desktop يجب أن يعمل بشكل أفضل على Mobile!"

# 📦 سكريبت تجهيز حزمة المصمم
# Designer Package Preparation Script

Write-Host "🎨 بدء تجهيز حزمة التصميم للمصمم..." -ForegroundColor Cyan
Write-Host ""

# إنشاء مجلد الحزمة
$packageDir = "DESIGNER_PACKAGE"
if (Test-Path $packageDir) {
    Remove-Item -Recurse -Force $packageDir
}
New-Item -ItemType Directory -Path $packageDir | Out-Null
Write-Host "✅ تم إنشاء مجلد: $packageDir" -ForegroundColor Green

# 1. نسخ ملفات الأنماط
Write-Host "`n📂 نسخ ملفات الأنماط..." -ForegroundColor Yellow
$stylesDir = "$packageDir/1-STYLES"
New-Item -ItemType Directory -Path $stylesDir | Out-Null
Copy-Item "src/styles/professional-system.css" "$stylesDir/" -Force
Copy-Item "src/styles/main.css" "$stylesDir/" -Force
Copy-Item "src/styles/mobile-fixes.css" "$stylesDir/" -Force
Write-Host "   ✓ professional-system.css" -ForegroundColor Gray
Write-Host "   ✓ main.css" -ForegroundColor Gray
Write-Host "   ✓ mobile-fixes.css" -ForegroundColor Gray

# 2. نسخ ملفات المكونات
Write-Host "`n📂 نسخ ملفات المكونات..." -ForegroundColor Yellow
$componentsDir = "$packageDir/2-COMPONENTS"
New-Item -ItemType Directory -Path $componentsDir | Out-Null
$components = @(
    "BrandPageTemplate.tsx",
    "SubPageTemplate.tsx",
    "Header.tsx",
    "Footer.tsx",
    "Hero.tsx",
    "BrandsSection.tsx",
    "AboutSection.tsx",
    "NumbersSection.tsx",
    "WorkSection.tsx",
    "GoalSection.tsx"
)
foreach ($comp in $components) {
    if (Test-Path "src/components/$comp") {
        Copy-Item "src/components/$comp" "$componentsDir/" -Force
        Write-Host "   ✓ $comp" -ForegroundColor Gray
    }
}

# 3. نسخ ملفات الصفحات
Write-Host "`n📂 نسخ ملفات الصفحات..." -ForegroundColor Yellow
$pagesDir = "$packageDir/3-PAGES"
New-Item -ItemType Directory -Path $pagesDir | Out-Null
$pages = @(
    "Home.tsx",
    "DioxPage.tsx",
    "AyluxPage.tsx",
    "ProductionPage.tsx",
    "GoalPage.tsx",
    "DryerPage.tsx",
    "AboutPage.tsx"
)
foreach ($page in $pages) {
    if (Test-Path "src/pages/$page") {
        Copy-Item "src/pages/$page" "$pagesDir/" -Force
        Write-Host "   ✓ $page" -ForegroundColor Gray
    }
}

# 4. نسخ الأصول البصرية
Write-Host "`n📂 نسخ الأصول البصرية..." -ForegroundColor Yellow
$assetsDir = "$packageDir/4-ASSETS"
New-Item -ItemType Directory -Path $assetsDir | Out-Null

# نسخ اللوجوهات
Copy-Item "public/Diox-logo.png.webp" "$assetsDir/" -Force -ErrorAction SilentlyContinue
Copy-Item "public/Aylux.png.webp" "$assetsDir/" -Force -ErrorAction SilentlyContinue
Copy-Item "public/employees.svg" "$assetsDir/" -Force -ErrorAction SilentlyContinue
Copy-Item "public/factory.svg" "$assetsDir/" -Force -ErrorAction SilentlyContinue
Write-Host "   ✓ اللوجوهات والأيقونات" -ForegroundColor Gray

# نسخ صور DIOX
if (Test-Path "public/diox") {
    $dioxDir = "$assetsDir/diox"
    New-Item -ItemType Directory -Path $dioxDir -Force | Out-Null
    Copy-Item "public/diox/*" "$dioxDir/" -Recurse -Force
    $dioxCount = (Get-ChildItem "$dioxDir" -File).Count
    Write-Host "   ✓ صور DIOX ($dioxCount ملف)" -ForegroundColor Gray
}

# نسخ صور AYLUX
if (Test-Path "public/aylux") {
    $ayluxDir = "$assetsDir/aylux"
    New-Item -ItemType Directory -Path $ayluxDir -Force | Out-Null
    Copy-Item "public/aylux/*" "$ayluxDir/" -Recurse -Force
    $ayluxCount = (Get-ChildItem "$ayluxDir" -File).Count
    Write-Host "   ✓ صور AYLUX ($ayluxCount ملف)" -ForegroundColor Gray
}

# 5. نسخ التوثيق
Write-Host "`n📂 نسخ ملفات التوثيق..." -ForegroundColor Yellow
$docsDir = "$packageDir/5-DOCUMENTATION"
New-Item -ItemType Directory -Path $docsDir | Out-Null
Copy-Item "docs/MOBILE_DESIGN_BRIEF.md" "$docsDir/" -Force
Copy-Item "docs/DESIGNER_PACKAGE_CHECKLIST.md" "$docsDir/" -Force
Write-Host "   ✓ MOBILE_DESIGN_BRIEF.md" -ForegroundColor Gray
Write-Host "   ✓ DESIGNER_PACKAGE_CHECKLIST.md" -ForegroundColor Gray

# 6. إنشاء ملف README للحزمة
Write-Host "`n📝 إنشاء ملف README..." -ForegroundColor Yellow
$readmeContent = @"
# 📦 حزمة تصميم الموبايل - KARAHOCA
## Mobile Design Package

---

## 📁 محتويات الحزمة

### 1-STYLES
ملفات CSS الأساسية التي تحتوي على:
- نظام الألوان والمسافات والخطوط
- التصميم الحالي للكمبيوتر
- التصميم الحالي للموبايل (مرجع)

### 2-COMPONENTS
ملفات React Components التي تحدد بنية العناصر:
- قوالب الصفحات (Brand, SubPage)
- مكونات Header, Footer, Hero
- أقسام About, Brands, Numbers, Work, Goal

### 3-PAGES
ملفات الصفحات الكاملة:
- الصفحة الرئيسية (Home)
- صفحات العلامات (DIOX, AYLUX)
- الصفحات الفرعية (Production, Goal, Dryer, About)

### 4-ASSETS
جميع الأصول البصرية:
- اللوجوهات والأيقونات
- صور منتجات DIOX (34 صورة)
- صور منتجات AYLUX (27 صورة)

### 5-DOCUMENTATION
الأدلة والوثائق:
- MOBILE_DESIGN_BRIEF.md: دليل التصميم الشامل
- DESIGNER_PACKAGE_CHECKLIST.md: قائمة مرجعية سريعة

---

## 🚀 كيف تبدأ؟

1. اقرأ أولاً: \`5-DOCUMENTATION/MOBILE_DESIGN_BRIEF.md\`
2. راجع النظام: \`1-STYLES/professional-system.css\`
3. افحص المكونات: \`2-COMPONENTS/\`
4. استكشف الصفحات: \`3-PAGES/\`
5. تفحص الأصول: \`4-ASSETS/\`

---

## 📱 نقاط التوقف (Breakpoints)

- **Small Phone**: max 480px (iPhone SE)
- **Medium Phone**: 481-600px (iPhone 12/13)
- **Large Phone**: 601-768px (iPhone Pro Max)
- **Tablet**: 769-1024px (iPad)

---

## 🎨 الألوان الرئيسية

- **Blue**: #0a2a5e (اللون الأساسي)
- **Orange**: #ff5b2e (اللون المميز)
- **White**: #ffffff (الخلفيات)

---

## 📏 المسافات الأساسية

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px

---

## ✍️ أحجام الخطوط للموبايل

- Hero Title: 36px (Desktop: 60px)
- Heading 1: 30px (Desktop: 48px)
- Heading 2: 24px (Desktop: 36px)
- Body: 16px (Desktop: 16px)

---

## 📤 التسليمات المطلوبة

1. **Figma/Adobe XD File** مع جميع الشاشات
2. **Assets Package** (Icons SVG + Images WebP)
3. **Specifications Document** (قياسات دقيقة)
4. **Style Guide** (Colors + Typography + States)

---

## ⚠️ نقاط مهمة

✅ RTL Layout (اليمين لليسار)
✅ Touch Targets: 44×44px minimum
✅ Glass Morphism في كل البطاقات
✅ Gradient backgrounds (Blue → Orange)

---

## 📞 للتواصل

GitHub: yahyaabohashemstu/karahoca

---

**تاريخ الإنشاء**: $(Get-Date -Format "yyyy-MM-dd HH:mm")
**الإصدار**: 1.0
**المشروع**: KARAHOCA React Website

---

**ملاحظة**: هذه الحزمة تحتوي على كل ما تحتاجه لفهم التصميم الحالي 
وبناء تصميم موبايل احترافي يتماشى مع الهوية البصرية للموقع! 🎨✨
"@
Set-Content -Path "$packageDir/README.md" -Value $readmeContent -Encoding UTF8
Write-Host "   ✓ README.md" -ForegroundColor Gray

# 7. إنشاء ملف بمعلومات التصدير
Write-Host "`n📝 إنشاء ملف معلومات التصدير..." -ForegroundColor Yellow
$exportInfo = @"
📦 معلومات حزمة التصميم
======================

تاريخ الإنشاء: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
اسم المشروع: KARAHOCA React Website
الإصدار: 1.0

محتويات الحزمة:
- عدد ملفات CSS: 3
- عدد ملفات المكونات: 10
- عدد ملفات الصفحات: 7
- عدد الأصول البصرية: 60+
- عدد ملفات التوثيق: 2

الملفات الأساسية:
✓ professional-system.css (نظام التصميم)
✓ main.css (التصميم الأساسي)
✓ BrandPageTemplate.tsx (قالب العلامات)
✓ MOBILE_DESIGN_BRIEF.md (الدليل الشامل)

التسليمات المطلوبة من المصمم:
1. Figma/Adobe XD File
2. Assets Package (SVG + WebP)
3. Specifications Document
4. Style Guide

Timeline المقترح:
- يوم 1: فهم النظام والمراجعة
- يوم 2-3: تصميم الصفحة الرئيسية
- يوم 4-5: تصميم صفحات العلامات
- يوم 6: تصميم الصفحات الفرعية
- يوم 7: المراجعة والتسليم

للمزيد من المعلومات: README.md
"@
Set-Content -Path "$packageDir/EXPORT_INFO.txt" -Value $exportInfo -Encoding UTF8
Write-Host "   ✓ EXPORT_INFO.txt" -ForegroundColor Gray

# حساب الإحصائيات
Write-Host "`n📊 إحصائيات الحزمة..." -ForegroundColor Cyan
$totalFiles = (Get-ChildItem -Path $packageDir -Recurse -File).Count
$totalSize = (Get-ChildItem -Path $packageDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)

Write-Host "   📁 إجمالي الملفات: $totalFiles" -ForegroundColor White
Write-Host "   💾 الحجم الإجمالي: $totalSizeMB MB" -ForegroundColor White

# إنشاء ملف ZIP (اختياري)
Write-Host "`n📦 هل تريد إنشاء ملف ZIP؟ (Y/N)" -ForegroundColor Yellow
$createZip = Read-Host

if ($createZip -eq "Y" -or $createZip -eq "y") {
    Write-Host "`n🔄 إنشاء ملف ZIP..." -ForegroundColor Cyan
    $zipName = "KARAHOCA_Designer_Package_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
    Compress-Archive -Path $packageDir -DestinationPath $zipName -Force
    Write-Host "   ✅ تم إنشاء: $zipName" -ForegroundColor Green
    Write-Host "   💾 الحجم: $([math]::Round((Get-Item $zipName).Length / 1MB, 2)) MB" -ForegroundColor White
}

# الخلاصة
Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ تم تجهيز حزمة المصمم بنجاح!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📂 الموقع: $packageDir\" -ForegroundColor White
Write-Host "📄 اقرأ: $packageDir\README.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎯 الخطوة التالية:" -ForegroundColor Cyan
Write-Host "   1. راجع محتويات المجلد" -ForegroundColor White
Write-Host "   2. أرسل الحزمة للمصمم" -ForegroundColor White
Write-Host "   3. انتظر التسليمات (7 أيام عمل)" -ForegroundColor White
Write-Host ""
Write-Host "🚀 بالتوفيق!" -ForegroundColor Magenta
Write-Host ""

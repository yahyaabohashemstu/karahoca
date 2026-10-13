# Admin terminology (Arabic ↔ English)

The admin is Arabic by default (English via the sidebar switch). Use these
terms everywhere so the same thing never has two names. Brand and product
names stay in Latin script: KARAHOCA, DIOX / DİOX, AYLUX, Karo (the chat
assistant is "كارو" in running Arabic text), Resend, Coolify, Google
Analytics, GA4, CSV, A/B, URL, slug.

| English | العربية |
|---|---|
| Dashboard | لوحة التحكم |
| Admin Dashboard | لوحة الإدارة |
| Analytics | التحليلات |
| Funnel (conversion) | قمع التحويل |
| Cohorts / retention | مجموعات الاحتفاظ |
| A/B tests / experiment / variant | اختبارات A/B / تجربة / نسخة |
| Products | المنتجات |
| Categories | الفئات |
| News / article | الأخبار / خبر |
| Blog / post | المدونة / مقال |
| Campaigns (e-mail) | الحملات البريدية / حملة |
| Newsletter | النشرة البريدية |
| Subscriber(s) | مشترك / المشتركون |
| Recipient(s) | المستلمون |
| AI Knowledge | معرفة المساعد |
| Karo Insights | إحصاءات كارو |
| Chat History / conversation | سجل المحادثات / محادثة |
| Visitor | زائر |
| Assistant | المساعد |
| Audit Log | سجل العمليات |
| Quick actions | إجراءات سريعة |
| Search-engine copy (pre-rendered pages) | نسخة محركات البحث |
| Save / Saved / Saving… | حفظ / تم الحفظ / جارٍ الحفظ… |
| Delete / Edit / View / Back | حذف / تعديل / عرض / رجوع |
| Draft / Published / Scheduled / Hidden / Deleted | مسودة / منشور / مجدول / مخفي / محذوف |
| Queued / Sending / Sent | في قائمة الانتظار / قيد الإرسال / مُرسَلة |
| Subject / Body | العنوان / نص الرسالة |
| Open rate / Opens / Clicks | معدل الفتح / مرات الفتح / النقرات |
| Brand | العلامة التجارية |
| Display order | ترتيب العرض |
| Upload / Crop | رفع / قص |
| Translate / Auto-translate | ترجمة / ترجمة تلقائية |
| Language: Arabic / English / Turkish / Russian | العربية / الإنجليزية / التركية / الروسية |
| Not recorded (unknown language) | غير مسجّلة |
| Export CSV / Import CSV | تصدير CSV / استيراد CSV |
| Logout / Sign in | تسجيل الخروج / تسجيل الدخول |
| Session expired | انتهت الجلسة |

Style:
- Formal Modern Standard Arabic, short and direct; address the admin
  neutrally (no gendered "أنت/أنتِ" — prefer imperative or impersonal forms:
  "احفظ الحملة أولًا", "لا توجد بيانات بعد").
- Numbers stay Western (0-9); dates come from `fmtDate`/`fmtDateTime`.
- No arrow characters (← → ↗) in text: buttons and links carry a
  direction icon (`back`, `forward`, `external`) that mirrors in Arabic
  by itself (see src/admin/ui/README.md).
- Plurals: use `t.plural` with zero/one/two/few/many/other forms.
- English copy is sentence case ("Save product", "Audit log"); only names
  and acronyms keep capitals (Google Analytics, AYLUX, CSV, A/B, AI).
- Content-language tabs show the code chip and the name in the admin
  language: `<LangLabel lang="en" />` ("EN English" / "EN الإنجليزية").
- Back links name the parent section as the sidebar does ("Products",
  "المنتجات"), not "Back to …"; save buttons say what they save.

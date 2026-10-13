/**
 * Arabic versions of the English error messages the admin API returns
 * (server/routes/api-admin.mjs, admin-*.mjs, the admin middlewares and the
 * services they call), plus the generic ones src/admin/utils/adminApi.ts
 * builds itself. The caller decides when to use it (Arabic admin only).
 *
 * Unknown messages come back unchanged, so a new server message shows in
 * English until it is added here. Matching is on the trimmed message and
 * ignores one trailing period; the result keeps the source's final period
 * (or lack of one), so callers that append their own punctuation still
 * read right. Terminology: GLOSSARY.md.
 */

type Pattern = readonly [RegExp, (m: RegExpMatchArray) => string];

const CONNECTION_FAILED = 'تعذّر الاتصال بالخادم. تحقّق من الاتصال بالإنترنت ثم حاول مرة أخرى.';

/** Fixed messages, written exactly as the server sends them. */
const EXACT_MESSAGES: Record<string, string> = {
  // ── Sign-in and session ────────────────────────────────────────────────
  'Unauthorized.': 'غير مصرّح بالوصول. سجّل الدخول مرة أخرى.',
  'CSRF token missing or invalid.': 'رمز الحماية (CSRF) مفقود أو غير صالح. أعد تحميل الصفحة ثم حاول مرة أخرى.',
  'Too many login attempts. Try again in 15 minutes.': 'محاولات تسجيل دخول كثيرة جدًا. حاول مرة أخرى بعد 15 دقيقة.',
  'Username and password required.': 'اسم المستخدم وكلمة المرور مطلوبان.',
  'Invalid credentials.': 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  'JWT_SECRET must be set to a strong unique value in production.':
    'يجب ضبط JWT_SECRET على قيمة قوية وفريدة في بيئة الإنتاج.',
  // adminApi.ts
  'Session expired. Please log in again.': 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
  'Your session has expired, so this was not saved. Your changes are still here: sign in again in a new tab, then save again.':
    'انتهت الجلسة، لذا لم يُحفَظ هذا التعديل. التغييرات ما زالت في الصفحة: سجّل الدخول من جديد في علامة تبويب أخرى، ثم احفظ مرة أخرى.',

  // ── Requests in general ────────────────────────────────────────────────
  'Request body too large.': 'حجم البيانات المرسَلة أكبر من الحد المسموح.',
  'Invalid JSON payload.': 'البيانات المرسَلة ليست JSON صالحًا.',
  'Server error. Please try again later.': 'حدث خطأ في الخادم. حاول مرة أخرى لاحقًا.',
  'Server error.': 'حدث خطأ في الخادم.',
  'An internal error occurred. Please try again later.': 'حدث خطأ داخلي. حاول مرة أخرى لاحقًا.',
  'Method not allowed.': 'هذه العملية غير مسموح بها.',
  'Admin route not found.': 'هذا المسار غير موجود في لوحة الإدارة.',
  'Route not found.': 'المسار غير موجود.',
  'Not found': 'العنصر المطلوب غير موجود',
  // fetch() itself failing (no connection): Chrome, Firefox, Safari, Node.
  'Failed to fetch': CONNECTION_FAILED,
  'NetworkError when attempting to fetch resource.': CONNECTION_FAILED,
  'Load failed': CONNECTION_FAILED,
  'fetch failed': 'تعذّر الاتصال (fetch failed)',

  // ── Date ranges (analytics, Karo insights, audit log) ──────────────────
  '"from" must be a date in YYYY-MM-DD form.': 'تاريخ البداية يجب أن يكون بصيغة YYYY-MM-DD.',
  '"to" must be a date in YYYY-MM-DD form.': 'تاريخ النهاية يجب أن يكون بصيغة YYYY-MM-DD.',
  '"from" must be on or before "to".': 'يجب ألّا يكون تاريخ البداية بعد تاريخ النهاية.',

  // ── Image upload ───────────────────────────────────────────────────────
  'imageBase64 required': 'لم تُرسَل أي صورة للرفع',
  'File too large (max 10 MB)': 'الملف كبير جدًا (الحد الأقصى 10 MB)',
  'Unsupported file type — upload a JPEG, PNG, WebP or GIF image.':
    'نوع الملف غير مدعوم. ارفع صورة بصيغة JPEG أو PNG أو WebP أو GIF.',

  // ── Shared by the editors ──────────────────────────────────────────────
  'No fields to update.': 'لا توجد حقول لتحديثها.',
  'Nothing to update.': 'لا يوجد ما يُحدَّث.',
  'Invalid status.': 'الحالة غير صالحة.',
  'The slug must contain at least one letter or digit.':
    'يجب أن يحتوي الرابط المختصر (slug) على حرف أو رقم واحد على الأقل.',

  // ── News ───────────────────────────────────────────────────────────────
  'News item not found.': 'الخبر غير موجود.',
  'Invalid status. Must be draft, published, or scheduled.': 'الحالة غير صالحة. القيم المسموح بها: مسودة، منشور، مجدول.',
  'publish_at is required for scheduled articles.': 'حدّد موعد النشر (publish_at) للأخبار المجدولة.',
  'title_ar and published_at are required.': 'العنوان بالعربية (title_ar) وتاريخ النشر (published_at) مطلوبان.',
  'An article with this slug already exists.': 'يوجد خبر آخر بالرابط المختصر (slug) نفسه.',
  'Failed to create article.': 'تعذّر إنشاء الخبر.',

  // ── Blog ───────────────────────────────────────────────────────────────
  'Post not found.': 'المقال غير موجود.',
  'At least one title (AR or EN) is required.': 'أدخل عنوانًا واحدًا على الأقل (بالعربية أو الإنجليزية).',
  'publish_at is required for scheduled posts.': 'حدّد موعد النشر (publish_at) للمقالات المجدولة.',
  'A post with this slug already exists.': 'يوجد مقال آخر بالرابط المختصر (slug) نفسه.',
  'Failed to create post.': 'تعذّر إنشاء المقال.',
  'Category not found.': 'الفئة غير موجودة.',
  'At least one name (AR or EN) is required.': 'أدخل اسمًا واحدًا على الأقل (بالعربية أو الإنجليزية).',
  'A category with this slug already exists.': 'توجد فئة أخرى بالرابط المختصر (slug) نفسه.',
  'Failed to create category.': 'تعذّر إنشاء الفئة.',

  // ── Products and categories ────────────────────────────────────────────
  'Product not found.': 'المنتج غير موجود.',
  'A scheduled product requires publish_at (ISO 8601).': 'المنتج المجدول يحتاج إلى موعد نشر (publish_at بصيغة ISO 8601).',
  'items[] array required.': 'قائمة العناصر (items[]) مطلوبة.',
  'Cannot delete: other records still reference this category.': 'لا يمكن الحذف: ما زالت سجلات أخرى مرتبطة بهذه الفئة.',
  // AI description writer
  'Product name is required.': 'اسم المنتج مطلوب.',
  'Brand must be DIOX or AYLUX.': 'العلامة التجارية يجب أن تكون DIOX أو AYLUX.',
  'AI returned an empty response.': 'أعاد الذكاء الاصطناعي ردًا فارغًا. حاول مرة أخرى.',
  'AI response was not valid JSON.': 'رد الذكاء الاصطناعي ليس JSON صالحًا. حاول مرة أخرى.',
  'AI response did not contain any recognised language keys.':
    'رد الذكاء الاصطناعي لا يحتوي على نص بأي لغة معروفة. حاول مرة أخرى.',
  'AI generation failed.': 'تعذّرت الكتابة بالذكاء الاصطناعي. حاول مرة أخرى.',

  // ── Product CSV import ─────────────────────────────────────────────────
  'csv body required (string).': 'محتوى ملف CSV مطلوب.',
  'The file is not UTF-8, so its Arabic/Turkish/Russian text arrived corrupted ("�"). In Excel use File → Save As → "CSV UTF-8 (Comma delimited)" and import that file.':
    'ترميز الملف ليس UTF-8، لذا وصلت نصوصه العربية والتركية والروسية تالفة ("�"). في Excel اختر File ثم Save As ثم "CSV UTF-8 (Comma delimited)"، ثم استورد الملف الناتج.',
  'CSV contained no data rows.': 'ملف CSV لا يحتوي على أي صفوف بيانات.',

  // ── Chats ──────────────────────────────────────────────────────────────
  'User not found.': 'الزائر غير موجود.',

  // ── Newsletter ─────────────────────────────────────────────────────────
  'Invalid email.': 'البريد الإلكتروني غير صالح.',
  'Language must be one of ar, en, tr, ru.': 'اختر لغة صالحة: العربية أو الإنجليزية أو التركية أو الروسية.',
  'Subscriber not found.': 'المشترك غير موجود.',

  // ── Campaigns ──────────────────────────────────────────────────────────
  'Campaign not found': 'الحملة غير موجودة',
  'Campaign already sent': 'أُرسلت هذه الحملة من قبل',
  'Campaign is already being dispatched': 'الحملة قيد الإرسال بالفعل',
  'title required': 'اسم الحملة مطلوب',
  'scheduledAt required': 'حدّد موعد الإرسال',
  'Invalid scheduledAt format': 'صيغة موعد الإرسال غير صالحة',
  'Invalid scheduledAt value': 'موعد الإرسال غير صالح',
  'The scheduled time is in the past. Pick a later time, or use Send now.':
    'الموعد المحدد قد مضى. اختر موعدًا لاحقًا، أو استخدم «إرسال الآن».',
  'The campaign is being sent right now; delete it once it has finished.':
    'الحملة قيد الإرسال الآن؛ احذفها بعد انتهاء الإرسال.',
  'The campaign needs a subject and a body in at least one language.':
    'تحتاج الحملة إلى عنوان ونص رسالة بلغة واحدة على الأقل.',
  'The campaign has no body text in any language.': 'لا يوجد نص رسالة للحملة بأي لغة.',

  // ── A/B tests ──────────────────────────────────────────────────────────
  'Experiment not found.': 'التجربة غير موجودة.',
  'Give at least one variant a weight above 0 before starting.': 'امنح نسخة واحدة على الأقل وزنًا أكبر من 0 قبل البدء.',
  'variant_key required.': 'مفتاح النسخة (variant_key) مطلوب.',
  'weight must be a whole number of 0 or more.': 'الوزن يجب أن يكون عددًا صحيحًا يساوي 0 أو أكثر.',
  'An experiment that has started cannot go back to draft.': 'لا يمكن إعادة تجربة بدأت إلى حالة المسودة.',
  'key required.': 'مفتاح التجربة (key) مطلوب.',
  'name required.': 'اسم التجربة مطلوب.',
  'goal_event required.': 'حدث الهدف (goal_event) مطلوب.',
  'key must be alphanumeric + underscore/dash.':
    'مفتاح التجربة (key) يقبل الحروف اللاتينية والأرقام والشرطة السفلية (_) والشرطة (-) فقط.',

  // ── Translation ────────────────────────────────────────────────────────
  'OPENROUTER_API_KEY is not configured.': 'الترجمة غير مُعدّة على الخادم: OPENROUTER_API_KEY غير مضبوط.',
  'No non-empty fields to translate.': 'لا توجد حقول مكتوبة لترجمتها.',
  'Text or fields required.': 'أدخل نصًا لترجمته.',
  'Empty response from translation service.': 'وصلت الترجمة فارغة. حاول مرة أخرى.',
  'The text is too long to translate in one go. Translate it in shorter parts.':
    'النص أطول من أن يُترجَم دفعة واحدة. ترجمه على أجزاء أقصر.',
  'Failed to parse translation response.': 'وصلت الترجمة بصيغة غير مقروءة. حاول مرة أخرى.',
  'The translation came back in an unexpected format. Please try again.': 'وصلت الترجمة بصيغة غير متوقعة. حاول مرة أخرى.',
  'Translation failed.': 'فشلت الترجمة.',

  // ── Dashboard ──────────────────────────────────────────────────────────
  'Insights query failed.': 'تعذّر تحميل إحصاءات كارو.',
  'Automatic rebuilds are not set up: SITE_REBUILD_WEBHOOK_URL is empty.':
    'التحديث التلقائي غير مُعدّ: SITE_REBUILD_WEBHOOK_URL فارغ.',
  'Deploy webhook timed out': 'انتهت مهلة الاتصال برابط التحديث (webhook)',
};

// ── Words inside dynamic messages ────────────────────────────────────────

const CAMPAIGN_STATUS: Record<string, string> = {
  draft: 'مسودة',
  scheduled: 'مجدولة',
  queued: 'في قائمة الانتظار',
  sending: 'قيد الإرسال',
  sent: 'مُرسَلة',
};

const EXPERIMENT_STATUS: Record<string, string> = {
  draft: 'مسودة',
  running: 'قيد التشغيل',
  stopped: 'متوقفة',
  done: 'منتهية',
};

// "status must be one of: …" lists — products (draft/scheduled/published)
// and A/B experiments (draft/running/stopped/done).
const STATUS_LIST_WORD: Record<string, string> = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  published: 'منشور',
  running: 'قيد التشغيل',
  stopped: 'متوقفة',
  done: 'منتهية',
};

const LANGUAGE: Record<string, string> = {
  ar: 'العربية',
  en: 'الإنجليزية',
  tr: 'التركية',
  ru: 'الروسية',
};

const PRODUCT_FIELD: Record<string, string> = {
  brand: 'العلامة التجارية',
  category_id: 'الفئة',
  name_ar: 'الاسم بالعربية',
};

/** Arabic for a known word, or the word itself (codes stay as they are). */
const word = (table: Record<string, string>, key: string) => table[key] ?? key;

const translateList = (list: string, table: Record<string, string>) =>
  list.split(/\s*,\s*/).map((item) => word(table, item)).join('، ');

// "2 active product(s) and 1 hidden product(s)" → "منتجات مفعّلة: 2، منتجات مخفية: 1"
const translateCategoryUsage = (usage: string) =>
  usage
    .split(' and ')
    .map((part) => {
      const p = part.match(/^(\d+) (active|hidden) product\(s\)$/);
      if (!p) return part;
      return `${p[2] === 'active' ? 'منتجات مفعّلة' : 'منتجات مخفية'}: ${p[1]}`;
    })
    .join('، ');

/**
 * Messages with dynamic parts, tried in order against the message without
 * its final period. Captured codes, numbers and technical text are kept.
 */
const PATTERNS: readonly Pattern[] = [
  // ── Campaigns ──
  [
    /^Campaign is (\w+); only drafts can be scheduled$/,
    (m) => `لا يمكن جدولة هذه الحملة لأن حالتها «${word(CAMPAIGN_STATUS, m[1])}». تُجدوَل المسودات فقط`,
  ],
  [
    /^Campaign is (\w+); it can no longer be edited$/,
    (m) => `لم يعد تعديل هذه الحملة ممكنًا لأن حالتها «${word(CAMPAIGN_STATUS, m[1])}»`,
  ],
  [
    // Older server builds (one send language per campaign).
    /^The campaign is sent in ([A-Za-z]{2}), but its \1 subject is empty$/,
    (m) => `تُرسَل الحملة باللغة ${word(LANGUAGE, m[1].toLowerCase())}، لكن عنوانها بهذه اللغة فارغ`,
  ],

  // ── Status lists (products, A/B tests) ──
  [/^status must be one of: (.+)$/, (m) => `الحالة يجب أن تكون إحدى القيم: ${translateList(m[1], STATUS_LIST_WORD)}`],

  // ── A/B tests ──
  [
    /^Variants are locked once an experiment has started \(this one is (\w+)\): changing them would move visitors between variants and corrupt the results\. Create a new experiment to test a different split$/,
    (m) =>
      `لا يمكن تعديل النسخ بعد بدء التجربة (حالة هذه التجربة: ${word(EXPERIMENT_STATUS, m[1])})، لأن ذلك ينقل الزوار بين النسخ ويُفسد النتائج. أنشئ تجربة جديدة لاختبار توزيع مختلف`,
  ],
  [/^Variant key "(.*)" already exists for this experiment$/, (m) => `مفتاح النسخة "${m[1]}" موجود مسبقًا في هذه التجربة`],
  [/^An experiment with key "(.*)" already exists$/, (m) => `توجد تجربة أخرى بالمفتاح "${m[1]}"`],

  // ── Products, categories, AI description writer ──
  [/^Field "(.+)" is required$/, (m) => `الحقل «${word(PRODUCT_FIELD, m[1])}» مطلوب`],
  [/^sourceLang must be one of: (.+)$/, (m) => `لغة المصدر (sourceLang) يجب أن تكون إحدى القيم: ${m[1]}`],
  [
    /^Cannot delete: (.+) still use this category\. Move them to another category first$/,
    (m) => `لا يمكن الحذف: ما زالت هذه الفئة مستخدمة (${translateCategoryUsage(m[1])}). انقل هذه المنتجات إلى فئة أخرى أولًا`,
  ],
  [/^(.+) link is not a valid URL$/, (m) => `رابط ${m[1]} ليس عنوان URL صالحًا`],
  [/^(.+) link must be an https:\/\/ address on (.+)$/, (m) => `رابط ${m[1]} يجب أن يكون عنوان https:// على النطاق ${m[2]}`],

  // ── Product CSV import (row texts come without their "Row N: " prefix) ──
  [
    /^CSV too large: (\d+) rows \(max (\d+) per import\)$/,
    (m) => `ملف CSV كبير جدًا: عدد الصفوف ${m[1]} (الحد الأقصى ${m[2]} لكل استيراد)`,
  ],
  [
    /^(\d+) row\(s\) failed validation(\. Fix them before applying)?$/,
    (m) => `عدد الصفوف التي لم تجتز التحقق: ${m[1]}${m[2] ? '. صحّحها قبل التطبيق' : ''}`,
  ],
  [/^missing required field "(.+)"$/, (m) => `الحقل المطلوب "${m[1]}" فارغ`],
  [
    /^brand must be DIOX or AYLUX \(got "(.*)"\)$/,
    (m) => `العلامة التجارية (brand) يجب أن تكون DIOX أو AYLUX (القيمة الحالية: "${m[1]}")`,
  ],
  [/^category_id "(.+)" does not exist$/, (m) => `الفئة (category_id) "${m[1]}" غير موجودة`],
  [
    /^category "(.+)" belongs to (\S+), not (\S+)$/,
    (m) => `الفئة "${m[1]}" تابعة للعلامة التجارية ${m[2]} وليس ${m[3]}`,
  ],

  // ── Date ranges ──
  [/^The date range can cover at most (\d+) days$/, (m) => `لا يمكن أن تتجاوز الفترة الزمنية ${m[1]} يومًا`],

  // ── Search-engine copy (site rebuild webhook) ──
  [
    /^Deploy webhook answered (\d+)(?:: ([\s\S]*))?$/,
    (m) => `ردّ رابط التحديث (webhook) بالرمز ${m[1]}${m[2] ? `: ${m[2]}` : ''}`,
  ],

  // ── Translation: keep the technical note in brackets ──
  [
    /^The translation service is busy right now\. Please try again in a moment\.?\s*(\([\s\S]*\))?$/,
    (m) => `خدمة الترجمة مشغولة الآن. حاول مرة أخرى بعد لحظات.${m[1] ? ` ${m[1]}` : ''}`,
  ],

  // ── Built by adminApi.ts ──
  [/^Request failed \((\d+)\)$/, (m) => `فشل الطلب (${m[1]})`],
  [/^Export failed \((\d+)\)$/, (m) => `فشل التصدير (${m[1]})`],
];

const stripFinalPeriod = (text: string) => (text.endsWith('.') ? text.slice(0, -1) : text);

/** The Arabic text, ending with a period only when the English one did. */
const withPeriodOf = (source: string, arabic: string) => {
  const body = stripFinalPeriod(arabic);
  return source.endsWith('.') ? `${body}.` : body;
};

const EXACT = new Map(Object.entries(EXACT_MESSAGES).map(([en, ar]) => [stripFinalPeriod(en), ar]));

/** Arabic for a message already stripped of its final period, or null. */
const translateKey = (key: string): string | null => {
  const exact = EXACT.get(key);
  if (exact !== undefined) return exact;
  for (const [pattern, build] of PATTERNS) {
    const m = key.match(pattern);
    if (m) return build(m);
  }
  // CSV import rows: "Row 12: <message>" (from the server or added by the
  // import dialog). Only when the message itself is known.
  const row = key.match(/^Row (\d+): ([\s\S]+)$/);
  if (row) {
    const inner = translateKey(stripFinalPeriod(row[2]));
    if (inner !== null) return `الصف ${row[1]}: ${stripFinalPeriod(inner)}`;
  }
  return null;
};

/**
 * Arabic version of a known English admin-API error message, or the
 * message unchanged when it isn't known.
 */
export const translateServerError = (message: string): string => {
  if (typeof message !== 'string') return message;
  const trimmed = message.trim();
  if (!trimmed) return message;
  const arabic = translateKey(stripFinalPeriod(trimmed));
  return arabic === null ? message : withPeriodOf(trimmed, arabic);
};

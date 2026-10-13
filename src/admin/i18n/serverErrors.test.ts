import { describe, expect, it } from 'vitest';
import { translateServerError } from './serverErrors';

const ARABIC_LETTER = /[؀-ۿ]/;

describe('translateServerError', () => {
  it('translates fixed messages', () => {
    expect(translateServerError('Product not found.')).toBe('المنتج غير موجود.');
    expect(translateServerError('CSRF token missing or invalid.')).toBe(
      'رمز الحماية (CSRF) مفقود أو غير صالح. أعد تحميل الصفحة ثم حاول مرة أخرى.',
    );
    expect(translateServerError('Session expired. Please log in again.')).toBe('انتهت الجلسة. سجّل الدخول مرة أخرى.');
  });

  it('trims, tolerates a trailing period and keeps the source punctuation', () => {
    expect(translateServerError('  Invalid email.  ')).toBe('البريد الإلكتروني غير صالح.');
    expect(translateServerError('Product not found')).toBe('المنتج غير موجود');
    expect(translateServerError('Not found')).toBe('العنصر المطلوب غير موجود');
    expect(translateServerError('Not found.')).toBe('العنصر المطلوب غير موجود.');
    // "Method not allowed" is sent both with and without the period.
    expect(translateServerError('Method not allowed')).toBe('هذه العملية غير مسموح بها');
  });

  it('translates known words inside dynamic messages', () => {
    expect(translateServerError('Campaign is sent; only drafts can be scheduled.')).toBe(
      'لا يمكن جدولة هذه الحملة لأن حالتها «مُرسَلة». تُجدوَل المسودات فقط.',
    );
    expect(translateServerError('Campaign is queued; it can no longer be edited.')).toContain('«في قائمة الانتظار»');
    expect(translateServerError('The campaign is sent in EN, but its EN subject is empty.')).toBe(
      'تُرسَل الحملة باللغة الإنجليزية، لكن عنوانها بهذه اللغة فارغ.',
    );
    expect(translateServerError('status must be one of: draft, scheduled, published.')).toBe(
      'الحالة يجب أن تكون إحدى القيم: مسودة، مجدول، منشور.',
    );
    expect(
      translateServerError(
        'Cannot delete: 2 active product(s) and 1 hidden product(s) still use this category. Move them to another category first.',
      ),
    ).toBe(
      'لا يمكن الحذف: ما زالت هذه الفئة مستخدمة (منتجات مفعّلة: 2، منتجات مخفية: 1). انقل هذه المنتجات إلى فئة أخرى أولًا.',
    );
  });

  it('keeps codes, numbers and technical text as they are', () => {
    expect(translateServerError('Request failed (500)')).toBe('فشل الطلب (500)');
    expect(translateServerError('Deploy webhook answered 401: {"message":"Unauthenticated."}')).toBe(
      'ردّ رابط التحديث (webhook) بالرمز 401: {"message":"Unauthenticated."}',
    );
    expect(translateServerError('Variant key "variant_b" already exists for this experiment.')).toBe(
      'مفتاح النسخة "variant_b" موجود مسبقًا في هذه التجربة.',
    );
    const busy = translateServerError(
      'The translation service is busy right now. Please try again in a moment. (OpenRouter translation service temporarily unavailable after retries on all models.)',
    );
    expect(busy.startsWith('خدمة الترجمة مشغولة الآن.')).toBe(true);
    expect(busy).toContain('(OpenRouter translation service temporarily unavailable after retries on all models.)');
  });

  it('translates CSV import rows, with or without the "Row N:" prefix', () => {
    expect(translateServerError('Row 4: brand must be DIOX or AYLUX (got "FOO").')).toBe(
      'الصف 4: العلامة التجارية (brand) يجب أن تكون DIOX أو AYLUX (القيمة الحالية: "FOO").',
    );
    expect(translateServerError('category_id "diox-x" does not exist.')).toBe('الفئة (category_id) "diox-x" غير موجودة.');
    expect(translateServerError('3 row(s) failed validation. Fix them before applying.')).toBe(
      'عدد الصفوف التي لم تجتز التحقق: 3. صحّحها قبل التطبيق.',
    );
  });

  it('returns unknown messages unchanged', () => {
    expect(translateServerError('Something entirely new happened.')).toBe('Something entirely new happened.');
    expect(translateServerError('Row 2: something unknown')).toBe('Row 2: something unknown');
    expect(translateServerError('GA4 API 403: forbidden')).toBe('GA4 API 403: forbidden');
    expect(translateServerError('')).toBe('');
    const arabic = 'خدمة الذكاء الاصطناعي غير متاحة حالياً.';
    expect(translateServerError(arabic)).toBe(arabic);
  });

  it('covers the messages the admin API actually sends', () => {
    const serverMessages = [
      'Unauthorized.',
      'Too many login attempts. Try again in 15 minutes.',
      'Invalid credentials.',
      'Invalid JSON payload.',
      'Request body too large.',
      'Server error. Please try again later.',
      'Your session has expired, so this was not saved. Your changes are still here: sign in again in a new tab, then save again.',
      'File too large (max 10 MB)',
      'Unsupported file type — upload a JPEG, PNG, WebP or GIF image.',
      'The slug must contain at least one letter or digit.',
      'An article with this slug already exists.',
      'A post with this slug already exists.',
      'publish_at is required for scheduled posts.',
      'The date range can cover at most 366 days.',
      '"from" must be on or before "to".',
      'Field "name_ar" is required.',
      'Trendyol link must be an https:// address on trendyol.com.',
      'The file is not UTF-8, so its Arabic/Turkish/Russian text arrived corrupted ("�"). In Excel use File → Save As → "CSV UTF-8 (Comma delimited)" and import that file.',
      'CSV too large: 6000 rows (max 5000 per import).',
      'Language must be one of ar, en, tr, ru.',
      'The scheduled time is in the past. Pick a later time, or use Send now.',
      'The campaign needs a subject and a body in at least one language.',
      'Campaign already sent',
      'Variants are locked once an experiment has started (this one is running): changing them would move visitors between variants and corrupt the results. Create a new experiment to test a different split.',
      'status must be one of: draft, running, stopped, done',
      'An experiment with key "hero_cta" already exists.',
      'The text is too long to translate in one go. Translate it in shorter parts.',
      'Automatic rebuilds are not set up: SITE_REBUILD_WEBHOOK_URL is empty.',
      'Export failed (403)',
    ];
    for (const message of serverMessages) {
      const translated = translateServerError(message);
      expect(translated, message).not.toBe(message);
      expect(translated, message).toMatch(ARABIC_LETTER);
    }
  });
});

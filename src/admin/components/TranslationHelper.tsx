import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';

interface TranslationHelperProps {
  /** Fields to translate: record of fieldName -> value (in source language) */
  fields: Record<string, string>;
  sourceLang?: string;
  /** Called with translated values for each lang */
  onTranslated: (translations: Record<string, Record<string, string>>) => void;
}

/** Returns a short, user-friendly message for common translation/network errors. */
function friendlyError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('503') || s.includes('unavailable') || s.includes('high demand') || s.includes('مشغولة'))
    return 'خدمة الترجمة مشغولة حالياً — جارٍ المحاولة تلقائياً، يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
  if (s.includes('429') || s.includes('rate'))
    return 'تم تجاوز حد الطلبات — يرجى الانتظار دقيقة ثم المحاولة مجدداً.';
  if (s.includes('timeout') || s.includes('abort'))
    return 'انتهت مهلة الترجمة — يرجى المحاولة مجدداً.';
  if (s.includes('api_key') || s.includes('configured'))
    return 'مفتاح الترجمة غير مهيأ — تواصل مع المسؤول.';
  if (s.includes('parse') || s.includes('json'))
    return 'خطأ في تحليل استجابة الترجمة — حاول مجدداً.';
  // Fallback: trim the raw error if it's too long
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
}

export const TranslationHelper: React.FC<TranslationHelperProps> = ({
  fields,
  sourceLang = 'ar',
  onTranslated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const hasContent = Object.values(fields).some(v => v && v.trim());

  const handleTranslate = async () => {
    if (!hasContent || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await adminApi.translate({ fields, sourceLang });

      if (!result.success || !result.translations) {
        // Server returned success=false OR translations missing — fall
        // through to the catch below by throwing.
        throw new Error('Translation service returned no usable data.');
      }

      // Backend returns lang-first: { ar: { field: val }, en: { field: val } }
      // Callbacks expect field-first: { field: { ar: val, en: val } }
      const raw = result.translations as Record<string, Record<string, string>>;
      const fieldFirst: Record<string, Record<string, string>> = {};
      let translatedLangs = 0;
      let translatedFields = 0;
      for (const [lang, fieldValues] of Object.entries(raw)) {
        if (!fieldValues || typeof fieldValues !== 'object') continue;
        const before = translatedFields;
        for (const [field, value] of Object.entries(fieldValues)) {
          if (typeof value !== 'string') continue;
          // Mirror the server's bracket-strip / trim defensiveness on
          // the client side too — belt-and-braces against future shape
          // drift if the server normaliser is ever bypassed (e.g. a
          // legacy deploy hits a new FE).
          const cleanField = field.replace(/^\[+|\]+$/g, '').trim();
          if (!cleanField) continue;
          if (!fieldFirst[cleanField]) fieldFirst[cleanField] = {};
          fieldFirst[cleanField][lang] = value;
          translatedFields++;
        }
        if (translatedFields > before) translatedLangs++;
      }

      // Empty-result guard: a false-positive "✓ تمت الترجمة" badge with
      // no actual translations is the regression the user reported.
      // If we got nothing usable, surface a real error instead.
      if (translatedFields === 0) {
        // eslint-disable-next-line no-console
        console.warn('[translate] empty translations payload', { raw });
        throw new Error('الترجمة عادت فارغة — حاول مجدداً.');
      }

      // Diagnostic log (kept lightweight so production console isn't
      // noisy). Helpful when an admin says "it didn't work" and we
      // need to see what came back without re-running the request.
      // eslint-disable-next-line no-console
      console.info(
        `[translate] ok — ${translatedLangs} langs, ${translatedFields} field values`,
      );

      onTranslated(fieldFirst);
      setSuccess(true);
      setAttempt(0);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Translation failed';
      setError(friendlyError(raw));
      setAttempt(a => a + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="adm-btn adm-translate-btn adm-btn-sm"
        onClick={handleTranslate}
        disabled={loading || !hasContent}
        title="Translate to all languages using AI"
      >
        {loading
          ? <span className="adm-spinner" style={{ width: 14, height: 14 }} />
          : '🤖'}
        {loading
          ? ' جارٍ الترجمة…'
          : attempt > 0
            ? ' حاول مجدداً'
            : ' Auto-Translate All Languages'}
      </button>

      {success && (
        <span className="adm-badge adm-badge-green">✓ تمت الترجمة!</span>
      )}

      {error && (
        <span
          className="adm-badge adm-badge-red"
          style={{ maxWidth: 420, whiteSpace: 'normal', lineHeight: 1.4 }}
        >
          ✗ {error}
        </span>
      )}
    </div>
  );
};

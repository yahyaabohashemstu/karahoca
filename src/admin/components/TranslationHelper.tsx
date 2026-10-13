import React, { useState } from 'react';
import { adminApi, type AdminRequestError } from '../utils/adminApi';
import { defineMessages, useT, type Translate } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    busy: 'The translation service is busy right now. Wait a moment and try again.',
    rateLimited: 'Too many translation requests. Wait a minute and try again.',
    timedOut: 'The translation timed out. Please try again.',
    notConfigured: 'Translation is not configured on the server (missing API key). Contact the site administrator.',
    unreadable: 'The translation came back in an unreadable format. Please try again.',
    noData: 'Translation service returned no usable data.',
    empty: 'The translation came back empty. Please try again.',
    failed: 'Translation failed',
    listSeparator: ', ',
    partlyFailed: { other: '{langs} could not be translated. Try again for the missing language(s).' },
    partlyTranslated: '✓ Partly translated',
    translated: '✓ Translated',
    buttonTitle: 'Translate the {lang} text into the other languages using AI',
    translating: 'Translating…',
    tryAgain: 'Try again',
    translateAll: 'Auto-Translate All Languages',
  },
  ar: {
    busy: 'خدمة الترجمة مشغولة الآن. انتظر قليلًا ثم أعد المحاولة.',
    rateLimited: 'طلبات ترجمة كثيرة جدًا. انتظر دقيقة ثم أعد المحاولة.',
    timedOut: 'انتهت مهلة الترجمة. أعد المحاولة.',
    notConfigured: 'الترجمة غير مُعدّة على الخادم (مفتاح API غير موجود). تواصل مع مسؤول الموقع.',
    unreadable: 'وصلت الترجمة بصيغة غير مقروءة. أعد المحاولة.',
    noData: 'لم تُرجع خدمة الترجمة بيانات صالحة للاستخدام.',
    empty: 'وصلت الترجمة فارغة. أعد المحاولة.',
    failed: 'فشلت الترجمة',
    listSeparator: '، ',
    partlyFailed: {
      one: 'تعذّرت الترجمة إلى {langs}. أعد المحاولة لهذه اللغة.',
      two: 'تعذّرت الترجمة إلى {langs}. أعد المحاولة لهاتين اللغتين.',
      other: 'تعذّرت الترجمة إلى {langs}. أعد المحاولة لهذه اللغات.',
    },
    partlyTranslated: '✓ تُرجم جزئيًا',
    translated: '✓ تمت الترجمة',
    buttonTitle: 'ترجمة النص المكتوب باللغة {lang} إلى اللغات الأخرى باستخدام الذكاء الاصطناعي',
    translating: 'جارٍ الترجمة…',
    tryAgain: 'إعادة المحاولة',
    translateAll: 'ترجمة تلقائية لكل اللغات',
  },
});

type T = Translate<keyof typeof messages.en>;

interface TranslationHelperProps {
  /** Fields to translate: record of fieldName -> value (in source language) */
  fields: Record<string, string>;
  sourceLang?: string;
  /**
   * Called with translated values for each lang. Never includes
   * `sourceLang`: the model's "copy" of the source used to overwrite what
   * the admin had typed (reflowed, trimmed or lightly reworded).
   */
  onTranslated: (translations: Record<string, Record<string, string>>) => void;
}

/**
 * Returns a short, user-friendly message for common translation/network
 * errors. `raw` is the server's English text (the kinds are recognised by
 * its words); `shown` is the same error in the admin language, used when
 * it isn't one of the known kinds.
 */
function friendlyError(raw: string, shown: string, t: T): string {
  const s = raw.toLowerCase();
  if (s.includes('503') || s.includes('unavailable') || s.includes('high demand') || s.includes('busy'))
    return t('busy');
  if (s.includes('429') || s.includes('rate'))
    return t('rateLimited');
  if (s.includes('timeout') || s.includes('abort'))
    return t('timedOut');
  if (s.includes('api_key') || s.includes('configured'))
    return t('notConfigured');
  if (s.includes('parse') || s.includes('json'))
    return t('unreadable');
  // Fallback: trim the error if it's too long
  return shown.length > 120 ? shown.slice(0, 120) + '…' : shown;
}

export const TranslationHelper: React.FC<TranslationHelperProps> = ({
  fields,
  sourceLang = 'ar',
  onTranslated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const t = useT(messages);
  const tc = useT(common);
  const langLabel = (lang: string) => {
    switch (lang) {
      case 'ar': return tc('lang_ar');
      case 'en': return tc('lang_en');
      case 'tr': return tc('lang_tr');
      case 'ru': return tc('lang_ru');
      default: return lang;
    }
  };

  const hasContent = Object.values(fields).some(v => v && v.trim());

  const handleTranslate = async () => {
    if (!hasContent || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await adminApi.translate({ fields, sourceLang });

      if (!result.success || !result.translations) {
        // Server returned success=false OR translations missing — fall
        // through to the catch below by throwing.
        throw new Error(t('noData'));
      }

      // Backend returns lang-first: { ar: { field: val }, en: { field: val } }
      // Callbacks expect field-first: { field: { ar: val, en: val } }
      const raw = result.translations as Record<string, Record<string, string>>;
      const fieldFirst: Record<string, Record<string, string>> = {};
      let translatedLangs = 0;
      let translatedFields = 0;
      for (const [lang, fieldValues] of Object.entries(raw)) {
        // Never write back into the language the admin typed in.
        if (lang === sourceLang) continue;
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

      // Empty-result guard: a false-positive "Translated" badge with no
      // actual translations is a regression admins have reported. If we
      // got nothing usable, surface a real error instead.
      if (translatedFields === 0) {
        console.warn('[translate] empty translations payload', { raw });
        throw new Error(t('empty'));
      }

      // Diagnostic log (kept lightweight so production console isn't
      // noisy). Helpful when an admin says "it didn't work" and we
      // need to see what came back without re-running the request.
      console.info(
        `[translate] ok — ${translatedLangs} langs, ${translatedFields} field values`,
      );

      onTranslated(fieldFirst);
      // The server translates each language separately; name the ones
      // that failed so the admin knows which tabs to check or retry.
      const failed = ((result as { failedLangs?: string[] }).failedLangs ?? [])
        .filter((l) => l !== sourceLang);
      if (failed.length > 0) {
        setError(t.plural('partlyFailed', failed.length, { langs: failed.map(langLabel).join(t('listSeparator')) }));
        setAttempt(a => a + 1);
      } else {
        setAttempt(0);
      }
      setSuccess(failed.length > 0 ? t('partlyTranslated') : t('translated'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const shown = err instanceof Error ? err.message : t('failed');
      const raw = (err as AdminRequestError)?.serverMessage ?? shown;
      setError(friendlyError(raw, shown, t));
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
        title={t('buttonTitle', { lang: langLabel(sourceLang) })}
      >
        {loading
          ? <span className="adm-spinner" style={{ width: 14, height: 14 }} />
          : '🤖'}
        {' '}
        {loading
          ? t('translating')
          : attempt > 0
            ? t('tryAgain')
            : t('translateAll')}
      </button>

      {success && (
        <span className="adm-badge adm-badge-green" role="status">{success}</span>
      )}

      {error && (
        <span
          className="adm-badge adm-badge-red"
          role="alert"
          style={{ maxWidth: 420, whiteSpace: 'normal', lineHeight: 1.4 }}
        >
          ✗ {error}
        </span>
      )}
    </div>
  );
};

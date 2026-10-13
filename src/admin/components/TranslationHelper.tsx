import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';

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

/** Returns a short, user-friendly message for common translation/network errors. */
function friendlyError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('503') || s.includes('unavailable') || s.includes('high demand') || s.includes('busy'))
    return 'The translation service is busy right now. Wait a moment and try again.';
  if (s.includes('429') || s.includes('rate'))
    return 'Too many translation requests. Wait a minute and try again.';
  if (s.includes('timeout') || s.includes('abort'))
    return 'The translation timed out. Please try again.';
  if (s.includes('api_key') || s.includes('configured'))
    return 'Translation is not configured on the server (missing API key). Contact the site administrator.';
  if (s.includes('parse') || s.includes('json'))
    return 'The translation came back in an unreadable format. Please try again.';
  // Fallback: trim the raw error if it's too long
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
}

const LANG_LABEL: Record<string, string> = { ar: 'Arabic', en: 'English', tr: 'Turkish', ru: 'Russian' };

export const TranslationHelper: React.FC<TranslationHelperProps> = ({
  fields,
  sourceLang = 'ar',
  onTranslated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
        throw new Error('Translation service returned no usable data.');
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
        throw new Error('The translation came back empty. Please try again.');
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
        setError(`${failed.map((l) => LANG_LABEL[l] ?? l).join(', ')} could not be translated. Try again for the missing language(s).`);
        setAttempt(a => a + 1);
      } else {
        setAttempt(0);
      }
      setSuccess(failed.length > 0 ? '✓ Partly translated' : '✓ Translated');
      setTimeout(() => setSuccess(null), 3000);
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
        title={`Translate the ${LANG_LABEL[sourceLang] ?? sourceLang} text into the other languages using AI`}
      >
        {loading
          ? <span className="adm-spinner" style={{ width: 14, height: 14 }} />
          : '🤖'}
        {loading
          ? ' Translating…'
          : attempt > 0
            ? ' Try again'
            : ' Auto-Translate All Languages'}
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

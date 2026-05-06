import React, { useState } from 'react';
import { Translate, Check, X } from '@phosphor-icons/react';
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
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
}

export const TranslationHelper: React.FC<TranslationHelperProps> = ({
  fields,
  sourceLang = 'ar',
  onTranslated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const hasContent = Object.values(fields).some((v) => v && v.trim());

  const handleTranslate = async () => {
    if (!hasContent || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await adminApi.translate({ fields, sourceLang });

      if (result.success && result.translations) {
        const raw = result.translations as Record<string, Record<string, string>>;
        const fieldFirst: Record<string, Record<string, string>> = {};
        for (const [lang, fieldValues] of Object.entries(raw)) {
          if (!fieldValues || typeof fieldValues !== 'object') continue;
          for (const [field, value] of Object.entries(fieldValues)) {
            if (!fieldFirst[field]) fieldFirst[field] = {};
            fieldFirst[field][lang] = value;
          }
        }
        onTranslated(fieldFirst);
        setSuccess(true);
        setAttempt(0);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Translation failed';
      setError(friendlyError(raw));
      setAttempt((a) => a + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-translation-helper">
      <button
        type="button"
        className="adm-btn adm-translate-btn adm-btn-sm"
        onClick={handleTranslate}
        disabled={loading || !hasContent}
        title="Translate to all languages using AI"
      >
        {loading ? (
          <span className="adm-spinner adm-spinner--sm" />
        ) : (
          <Translate size={14} weight="duotone" aria-hidden="true" />
        )}
        <span>
          {loading
            ? ' جارٍ الترجمة…'
            : attempt > 0
              ? ' حاول مجدداً'
              : ' Auto-Translate All Languages'}
        </span>
      </button>

      {success && (
        <span className="adm-badge adm-badge-green">
          <Check size={12} weight="bold" aria-hidden="true" /> تمت الترجمة!
        </span>
      )}

      {error && (
        <span className="adm-badge adm-badge-red adm-badge--multiline">
          <X size={12} weight="bold" aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
};

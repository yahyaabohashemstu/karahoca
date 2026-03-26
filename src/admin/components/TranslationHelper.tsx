import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';

interface TranslationHelperProps {
  /** Fields to translate: record of fieldName -> value (in source language) */
  fields: Record<string, string>;
  sourceLang?: string;
  /** Called with translated values for each lang */
  onTranslated: (translations: Record<string, Record<string, string>>) => void;
}

export const TranslationHelper: React.FC<TranslationHelperProps> = ({
  fields,
  sourceLang = 'ar',
  onTranslated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasContent = Object.values(fields).some(v => v && v.trim());

  const handleTranslate = async () => {
    if (!hasContent || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await adminApi.translate({ fields, sourceLang });
      if (result.success && result.translations) {
        onTranslated(result.translations as Record<string, Record<string, string>>);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
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
        {loading ? <span className="adm-spinner" style={{ width: 14, height: 14 }} /> : '🤖'}
        {loading ? ' Translating...' : ' Auto-Translate All Languages'}
      </button>

      {success && (
        <span className="adm-badge adm-badge-green">✓ Translated!</span>
      )}
      {error && (
        <span className="adm-badge adm-badge-red">✗ {error}</span>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { adminApi } from '../utils/adminApi';

/**
 * Lightweight modal that asks the AI provider chain for a polished
 * product description in all four languages, given a sparse brief.
 *
 * The dialog deliberately limits user input to (name, hint, category):
 *
 *   - name + brand come pre-populated from the surrounding product
 *     form so the admin doesn't have to re-type what's already there.
 *
 *   - hint is the single freeform field — a one-sentence steer like
 *     "tile floors only, lavender scent, eco-friendly packaging."
 *     Leaving it blank is OK; the model will infer from the name.
 *
 *   - category narrows the tone (a laundry powder reads differently
 *     from a fabric softener even if both are AYLUX).
 *
 * The result lands as a preview INSIDE the dialog rather than getting
 * silently applied — the admin sees all four languages, can re-roll
 * with a different hint, and only commits once happy. This keeps the
 * AI assistive (not destructive of any in-progress copy).
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the AI brief from the product form. */
  defaults: {
    name: string;
    brand: 'DIOX' | 'AYLUX';
    category?: string;
    sourceLang?: 'ar' | 'en' | 'tr' | 'ru';
  };
  /** Called with the four-language object when the admin clicks Apply. */
  onApply: (descriptions: Partial<Record<'ar' | 'en' | 'tr' | 'ru', string>>) => void;
}

const LANG_LABELS: Record<string, string> = {
  ar: 'العربية',
  en: 'English',
  tr: 'Türkçe',
  ru: 'Русский',
};

export const AiDescriptionDialog: React.FC<Props> = ({ open, onClose, defaults, onApply }) => {
  const [hint, setHint] = useState('');
  const [sourceLang, setSourceLang] = useState<'ar' | 'en' | 'tr' | 'ru'>(defaults.sourceLang || 'ar');
  const [result, setResult] = useState<Partial<Record<'ar' | 'en' | 'tr' | 'ru', string>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset every time the dialog opens so the previous run's output
  // doesn't leak into a fresh attempt for a different product.
  useEffect(() => {
    if (open) {
      setHint('');
      setSourceLang(defaults.sourceLang || 'ar');
      setResult(null);
      setError(null);
    }
  }, [open, defaults.sourceLang]);

  if (!open) return null;

  const generate = async () => {
    if (!defaults.name || !defaults.brand) {
      setError('Fill in the product name first, then try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await adminApi.generateProductDescriptions({
        name: defaults.name,
        brand: defaults.brand,
        category: defaults.category,
        hint: hint.trim() || undefined,
        sourceLang,
      });
      setResult(out.descriptions || {});
    } catch (err) {
      // The server already returns a user-friendly message in Arabic
      // and English for known failure modes (provider 503, parse fail).
      // Surface it verbatim — no further wrapping needed.
      setError((err as Error).message || 'AI generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply(result);
    onClose();
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generate AI description"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="adm-card"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 20,
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>✨ AI Description Writer</h2>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={handleClose}
            disabled={busy}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-text-muted)' }}>
          Generates a commercial description in all four languages from
          the brief below. The output is shown for review — nothing is
          applied to your form until you click <strong>Apply</strong>.
        </p>

        <div
          className="adm-card"
          style={{ padding: 12, background: 'var(--adm-surface2)', fontSize: 13 }}
        >
          <div><strong>Product:</strong> {defaults.name || <em style={{ color: '#dc2626' }}>(fill in the product name first)</em>}</div>
          <div><strong>Brand:</strong> {defaults.brand}</div>
          {defaults.category && <div><strong>Category:</strong> {defaults.category}</div>}
        </div>

        <label className="adm-form-group">
          <span className="adm-label">Source language</span>
          <select
            className="adm-input adm-input-sm"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value as 'ar' | 'en' | 'tr' | 'ru')}
            disabled={busy}
            style={{ width: 200 }}
          >
            <option value="ar">العربية (Arabic)</option>
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
            <option value="ru">Русский</option>
          </select>
        </label>

        <label className="adm-form-group">
          <span className="adm-label">Optional hint</span>
          <textarea
            className="adm-textarea"
            rows={2}
            placeholder='e.g. "for tile floors and laminates, lavender scent, eco-friendly packaging"'
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            disabled={busy}
          />
        </label>

        {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['ar', 'en', 'tr', 'ru'] as const).map((lang) => (
              <div key={lang} className="adm-card" style={{ padding: 10 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color: 'var(--adm-text-dim)',
                  marginBottom: 4,
                }}>
                  {LANG_LABELS[lang]} ({lang.toUpperCase()})
                </div>
                <div
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}
                >
                  {result[lang] || <em style={{ color: '#dc2626' }}>(model omitted this language — re-run or fill manually)</em>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={handleClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-secondary adm-btn-sm"
            onClick={generate}
            disabled={busy || !defaults.name}
          >
            {busy ? 'Generating…' : result ? '🔄 Re-roll' : '✨ Generate'}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary adm-btn-sm"
            onClick={apply}
            disabled={busy || !result}
            title={result ? 'Replace the description fields with this draft' : 'Generate something first'}
          >
            ✓ Apply to all four descriptions
          </button>
        </div>
      </div>
    </div>
  );
};

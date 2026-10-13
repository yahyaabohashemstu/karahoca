import React, { useState, useEffect } from 'react';
import { adminApi } from '../utils/adminApi';
import { useModalDialog } from '../utils/useModalDialog';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

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

const messages = defineMessages({
  en: {
    title: '✨ AI Description Writer',
    intro: 'Generates a commercial description in all four languages from the brief below. The output is shown for review — nothing is applied to your form until you click {apply}.',
    applyWord: 'Apply',
    product: 'Product:',
    fillNameFirst: '(fill in the product name first)',
    brand: 'Brand:',
    category: 'Category:',
    sourceLanguage: 'Source language',
    optionAr: 'العربية (Arabic)',
    optionEn: 'English',
    optionTr: 'Türkçe',
    optionRu: 'Русский',
    label_ar: 'العربية',
    label_en: 'English',
    label_tr: 'Türkçe',
    label_ru: 'Русский',
    optionalHint: 'Optional hint',
    hintPlaceholder: 'e.g. "for tile floors and laminates, lavender scent, eco-friendly packaging"',
    modelOmitted: '(model omitted this language — re-run or fill manually)',
    generating: 'Generating…',
    reroll: '🔄 Re-roll',
    generate: '✨ Generate',
    applyTitle: 'Replace the description fields with this draft',
    generateFirst: 'Generate something first',
    applyAll: '✓ Apply to all four descriptions',
    errNameFirst: 'Fill in the product name first, then try again.',
    errFailed: 'AI generation failed.',
  },
  ar: {
    title: '✨ كتابة الوصف بالذكاء الاصطناعي',
    intro: 'يكتب وصفًا تسويقيًا باللغات الأربع انطلاقًا من الموجز أدناه. تُعرض النتيجة للمراجعة أولًا — ولا يُطبَّق شيء على النموذج قبل الضغط على {apply}.',
    applyWord: 'تطبيق',
    product: 'المنتج:',
    fillNameFirst: '(أدخل اسم المنتج أولًا)',
    brand: 'العلامة التجارية:',
    category: 'الفئة:',
    sourceLanguage: 'لغة المصدر',
    optionAr: 'العربية',
    optionEn: 'الإنجليزية',
    optionTr: 'التركية',
    optionRu: 'الروسية',
    label_ar: 'العربية',
    label_en: 'الإنجليزية',
    label_tr: 'التركية',
    label_ru: 'الروسية',
    optionalHint: 'توجيه اختياري',
    hintPlaceholder: 'مثال: «للأرضيات المبلّطة والباركيه، برائحة اللافندر، بعبوة صديقة للبيئة»',
    modelOmitted: '(لم يكتب النموذج هذه اللغة — أعد التوليد أو املأها يدويًا)',
    generating: 'جارٍ التوليد…',
    reroll: '🔄 إعادة التوليد',
    generate: '✨ توليد',
    applyTitle: 'استبدال حقول الوصف بهذه المسودة',
    generateFirst: 'ولّد وصفًا أولًا',
    applyAll: '✓ تطبيق على الأوصاف الأربعة',
    errNameFirst: 'أدخل اسم المنتج أولًا، ثم أعد المحاولة.',
    errFailed: 'فشل التوليد بالذكاء الاصطناعي.',
  },
});

/** Puts `parts` in place of the {name} tokens of a message. */
const withParts = (text: string, parts: Record<string, React.ReactNode>) =>
  text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return <React.Fragment key={i}>{name && name in parts ? parts[name] : piece}</React.Fragment>;
  });

export const AiDescriptionDialog: React.FC<Props> = ({ open, onClose, defaults, onApply }) => {
  const [hint, setHint] = useState('');
  const [sourceLang, setSourceLang] = useState<'ar' | 'en' | 'tr' | 'ru'>(defaults.sourceLang || 'ar');
  const [result, setResult] = useState<Partial<Record<'ar' | 'en' | 'tr' | 'ru', string>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT(messages);
  const tc = useT(common);

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

  // Not while a request is running — its result would land in a closed
  // dialog. Defined before the early return so the hook order is stable.
  const handleClose = () => {
    if (busy) return;
    onClose();
  };
  const panelRef = useModalDialog<HTMLDivElement>(open, handleClose);

  if (!open) return null;

  const generate = async () => {
    if (!defaults.name || !defaults.brand) {
      setError(t('errNameFirst'));
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
      setError((err as Error).message || t('errFailed'));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply(result);
    onClose();
  };

  return (
    <div
      role="presentation"
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-description-title"
        tabIndex={-1}
        className="adm-card"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 20,
          overflow: 'auto',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 id="ai-description-title" style={{ margin: 0, fontSize: 18 }}>{t('title')}</h2>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={handleClose}
            disabled={busy}
            aria-label={tc('close')}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-text-muted)' }}>
          {withParts(t('intro'), { apply: <strong>{t('applyWord')}</strong> })}
        </p>

        <div
          className="adm-card"
          style={{ padding: 12, background: 'var(--adm-surface2)', fontSize: 13 }}
        >
          <div><strong>{t('product')}</strong> {defaults.name || <em style={{ color: '#dc2626' }}>{t('fillNameFirst')}</em>}</div>
          <div><strong>{t('brand')}</strong> {defaults.brand}</div>
          {defaults.category && <div><strong>{t('category')}</strong> {defaults.category}</div>}
        </div>

        <label className="adm-form-group">
          <span className="adm-label">{t('sourceLanguage')}</span>
          <select
            className="adm-input adm-input-sm"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value as 'ar' | 'en' | 'tr' | 'ru')}
            disabled={busy}
            style={{ width: 200 }}
          >
            <option value="ar">{t('optionAr')}</option>
            <option value="en">{t('optionEn')}</option>
            <option value="tr">{t('optionTr')}</option>
            <option value="ru">{t('optionRu')}</option>
          </select>
        </label>

        <label className="adm-form-group">
          <span className="adm-label">{t('optionalHint')}</span>
          <textarea
            className="adm-textarea"
            rows={2}
            placeholder={t('hintPlaceholder')}
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
                  {t(`label_${lang}`)} ({lang.toUpperCase()})
                </div>
                <div
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}
                >
                  {result[lang] || <em style={{ color: '#dc2626' }}>{t('modelOmitted')}</em>}
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
            {tc('cancel')}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-secondary adm-btn-sm"
            onClick={generate}
            disabled={busy || !defaults.name}
          >
            {busy ? t('generating') : result ? t('reroll') : t('generate')}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary adm-btn-sm"
            onClick={apply}
            disabled={busy || !result}
            title={result ? t('applyTitle') : t('generateFirst')}
          >
            {t('applyAll')}
          </button>
        </div>
      </div>
    </div>
  );
};

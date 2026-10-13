import React, { useState } from 'react';
import { adminApi, localizeServerMessage, type AdminRequestError } from '../utils/adminApi';
import { useModalDialog } from '../utils/useModalDialog';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

// CSV column names (brand, category_id, name_ar, id) are the file format:
// they stay as they are in both languages.
const messages = defineMessages({
  en: {
    title: '📥 Import products from CSV',
    intro: 'Paste CSV content below or pick a file. Export the current catalogue first to get the exact column layout — required fields are {brand}, {categoryId}, and {nameAr}. Rows with an existing {id} get updated; rows with a blank {id} are inserted.',
    errTooLarge: 'File too large (max 5 MB).',
    errNotUtf8: 'This file is not UTF-8, so its Arabic/Turkish/Russian text would be corrupted. In Excel use File → Save As → "CSV UTF-8 (Comma delimited)" and pick that file.',
    errRead: 'Could not read file.',
    errPasteFirst: 'Paste CSV content or pick a file first.',
    rowsFailed: { other: '{n} row(s) failed validation. Fix them before applying.' },
    errPreview: 'Preview failed.',
    errImport: 'Import failed.',
    totalRows: 'Total rows',
    newRows: 'New',
    updates: 'Updates',
    errors: 'Errors',
    rowError: 'Row {line}: {error}',
    imported: '✓ Imported {inserted} new and {updated} updated product(s).',
    validating: 'Validating…',
    preview: '🔍 Preview',
    runPreviewFirst: 'Run preview first',
    fixErrorsFirst: 'Fix validation errors before applying',
    commit: 'Commit the import',
    importing: 'Importing…',
    applyImport: '✓ Apply import',
  },
  ar: {
    title: '📥 استيراد المنتجات من CSV',
    intro: 'الصق محتوى CSV أدناه أو اختر ملفًا. صدّر الكتالوج الحالي أولًا لتحصل على ترتيب الأعمدة الصحيح — الحقول المطلوبة هي {brand} و {categoryId} و {nameAr}. الصفوف التي تحمل قيمة {id} موجودة تُحدَّث، والصفوف التي يكون فيها {id} فارغًا تُضاف منتجات جديدة.',
    errTooLarge: 'الملف كبير جدًا (الحد الأقصى 5 ميغابايت).',
    errNotUtf8: 'هذا الملف ليس بترميز UTF-8، لذا ستتلف نصوصه العربية والتركية والروسية. في Excel اختر «ملف ← حفظ باسم» ثم النوع "CSV UTF-8 (Comma delimited)"، واختر ذلك الملف.',
    errRead: 'تعذّرت قراءة الملف.',
    errPasteFirst: 'الصق محتوى CSV أو اختر ملفًا أولًا.',
    rowsFailed: {
      one: 'صف واحد لم يجتز التحقق. أصلحه قبل التطبيق.',
      two: 'صفّان لم يجتازا التحقق. أصلحهما قبل التطبيق.',
      few: '{n} صفوف لم تجتز التحقق. أصلحها قبل التطبيق.',
      many: '{n} صفًا لم تجتز التحقق. أصلحها قبل التطبيق.',
      other: '{n} صف لم تجتز التحقق. أصلحها قبل التطبيق.',
    },
    errPreview: 'فشلت المعاينة.',
    errImport: 'فشل الاستيراد.',
    totalRows: 'إجمالي الصفوف',
    newRows: 'جديدة',
    updates: 'تحديثات',
    errors: 'أخطاء',
    rowError: 'الصف {line}: {error}',
    imported: '✓ اكتمل الاستيراد — منتجات جديدة: {inserted}، منتجات محدَّثة: {updated}.',
    validating: 'جارٍ التحقق…',
    preview: '🔍 معاينة',
    runPreviewFirst: 'شغّل المعاينة أولًا',
    fixErrorsFirst: 'أصلح أخطاء التحقق قبل التطبيق',
    commit: 'تنفيذ الاستيراد',
    importing: 'جارٍ الاستيراد…',
    applyImport: '✓ تطبيق الاستيراد',
  },
});

/** Puts `parts` in place of the {name} tokens of a message. */
const withParts = (text: string, parts: Record<string, React.ReactNode>) =>
  text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return <React.Fragment key={i}>{name && name in parts ? parts[name] : piece}</React.Fragment>;
  });

/**
 * Two-step CSV import modal:
 *
 *   Step 1 (preview)
 *       Admin pastes CSV / picks a file → we POST with dryRun:true →
 *       server validates every row and returns { inserted, updated,
 *       errors[] } WITHOUT writing. The dialog renders the summary so
 *       the admin sees exactly what's about to happen.
 *
 *   Step 2 (confirm)
 *       Admin clicks "Apply" → we POST the same CSV with dryRun:false.
 *       Server runs the import in a single transaction — partial
 *       failures roll back so the catalogue is never half-updated.
 *
 * On success the modal closes and `onComplete` fires so the parent can
 * refresh its product list.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface PreviewSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: Array<{ line: number; error: string }>;
}

export const ProductCsvImportModal: React.FC<Props> = ({ open, onClose, onComplete }) => {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const t = useT(messages);
  const tc = useT(common);

  const reset = () => {
    setCsvText('');
    setPreview(null);
    setError(null);
    setApplied(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  // Called before the early return below so the hook order never changes.
  const panelRef = useModalDialog<HTMLDivElement>(open, handleClose);

  if (!open) return null;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('errTooLarge'));
      return;
    }
    try {
      const text = await file.text();
      // file.text() decodes as UTF-8 and turns every invalid byte into
      // U+FFFD. A file Excel saved as plain "CSV" (Windows-1254/1256/1251)
      // would otherwise import with every Turkish/Arabic/Russian letter
      // replaced by "�".
      if (text.includes('\uFFFD')) {
        setError(t('errNotUtf8'));
        return;
      }
      setCsvText(text);
      setPreview(null);
      setError(null);
    } catch {
      setError(t('errRead'));
    }
  };

  const runPreview = async () => {
    if (!csvText.trim()) {
      setError(t('errPasteFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.importProductsCsv(csvText, true);
      setPreview(res.summary);
      if (res.summary.errors.length > 0) {
        setError(t.plural('rowsFailed', res.summary.errors.length));
      }
    } catch (err) {
      const msg = (err as Error).message || t('errPreview');
      setError(msg);
      // Server returns the partial summary on validation errors so the
      // admin still sees per-row messages.
      const data = (err as AdminRequestError).data as { summary?: PreviewSummary } | undefined;
      if (data?.summary) setPreview(data.summary);
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    if (!preview || preview.errors.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.importProductsCsv(csvText, false);
      setApplied(true);
      // Give the user a beat to read the success summary before closing.
      setTimeout(() => {
        reset();
        onComplete();
        onClose();
      }, 1400);
    } catch (err) {
      setError((err as Error).message || t('errImport'));
    } finally {
      setBusy(false);
    }
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
        aria-labelledby="csv-import-title"
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
          <h2 id="csv-import-title" style={{ margin: 0, fontSize: 18 }}>{t('title')}</h2>
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
          {withParts(t('intro'), {
            brand: <strong>brand</strong>,
            categoryId: <strong>category_id</strong>,
            nameAr: <strong>name_ar</strong>,
            id: <code>id</code>,
          })}
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          disabled={busy}
          style={{ fontSize: 12 }}
        />

        <textarea
          className="adm-input"
          rows={10}
          spellCheck={false}
          placeholder="id,brand,category_id,name_ar,…"
          dir="ltr"
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null); }}
          disabled={busy}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
        />

        {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

        {preview && (
          <div
            className="adm-card"
            style={{
              padding: 12,
              background: 'var(--adm-surface2)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              fontSize: 13,
            }}
          >
            <div><strong>{fmtNumber(preview.total)}</strong><br /><span style={{ color: 'var(--adm-text-dim)' }}>{t('totalRows')}</span></div>
            <div style={{ color: '#22c55e' }}><strong>{fmtNumber(preview.inserted)}</strong><br /><span style={{ color: 'var(--adm-text-dim)' }}>{t('newRows')}</span></div>
            <div style={{ color: '#4f6ef7' }}><strong>{fmtNumber(preview.updated)}</strong><br /><span style={{ color: 'var(--adm-text-dim)' }}>{t('updates')}</span></div>
            <div style={{ color: preview.errors.length > 0 ? '#ef4444' : 'var(--adm-text-dim)' }}>
              <strong>{fmtNumber(preview.errors.length)}</strong><br />
              <span style={{ color: 'var(--adm-text-dim)' }}>{t('errors')}</span>
            </div>
          </div>
        )}

        {preview && preview.errors.length > 0 && (
          <div
            className="adm-card"
            style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.05)',
              maxHeight: 160,
              overflow: 'auto',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
            }}
          >
            {/* The server's messages already start with "Row N:". */}
            {preview.errors.map((e, i) => (
              <div key={i} style={{ color: '#dc2626' }}>
                {e.error.startsWith('Row ')
                  ? localizeServerMessage(e.error)
                  : t('rowError', { line: e.line, error: localizeServerMessage(e.error) })}
              </div>
            ))}
          </div>
        )}

        {applied && (
          <div className="adm-alert adm-alert-success">
            {t('imported', { inserted: preview?.inserted ?? 0, updated: preview?.updated ?? 0 })}
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
            onClick={runPreview}
            disabled={busy || !csvText.trim()}
          >
            {busy && !preview ? t('validating') : t('preview')}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary adm-btn-sm"
            onClick={runApply}
            disabled={busy || !preview || preview.errors.length > 0 || applied}
            title={
              !preview
                ? t('runPreviewFirst')
                : preview.errors.length > 0
                  ? t('fixErrorsFirst')
                  : t('commit')
            }
          >
            {busy && preview ? t('importing') : t('applyImport')}
          </button>
        </div>
      </div>
    </div>
  );
};

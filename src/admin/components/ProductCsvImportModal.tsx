import React, { useRef, useState } from 'react';
import { adminApi, localizeServerMessage, type AdminRequestError } from '../utils/adminApi';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Field, Modal, StatCard, StatGrid } from '../ui';

// CSV column names (brand, category_id, name_ar, id) are the file format:
// they stay as they are in both languages.
const messages = defineMessages({
  en: {
    title: 'Import products from CSV',
    intro: 'Paste CSV content below or pick a file. Export the current catalogue first to get the exact column layout — required fields are {brand}, {categoryId}, and {nameAr}. Rows with an existing {id} get updated; rows with a blank {id} are inserted.',
    chooseFile: 'Choose CSV file',
    noFile: 'No file chosen',
    csvContent: 'CSV content',
    errTooLarge: 'File too large (max 5 MB).',
    errNotUtf8: 'This file is not UTF-8, so its Arabic/Turkish/Russian text would be corrupted. In Excel choose Save As from the File menu, pick "CSV UTF-8 (Comma delimited)" as the type, and select that file.',
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
    imported: 'Imported {inserted} new and {updated} updated product(s).',
    validating: 'Validating…',
    preview: 'Preview',
    runPreviewFirst: 'Run preview first',
    fixErrorsFirst: 'Fix validation errors before applying',
    commit: 'Commit the import',
    importing: 'Importing…',
    applyImport: 'Apply import',
  },
  ar: {
    title: 'استيراد المنتجات من CSV',
    intro: 'الصق محتوى CSV أدناه أو اختر ملفًا. صدّر الكتالوج الحالي أولًا لتحصل على ترتيب الأعمدة الصحيح — الحقول المطلوبة هي {brand} و {categoryId} و {nameAr}. الصفوف التي تحمل قيمة {id} موجودة تُحدَّث، والصفوف التي يكون فيها {id} فارغًا تُضاف منتجات جديدة.',
    chooseFile: 'اختيار ملف CSV',
    noFile: 'لم يُختر ملف',
    csvContent: 'محتوى CSV',
    errTooLarge: 'الملف كبير جدًا (الحد الأقصى 5 ميغابايت).',
    errNotUtf8: 'هذا الملف ليس بترميز UTF-8، لذا ستتلف نصوصه العربية والتركية والروسية. في Excel اختر «حفظ باسم» من قائمة «ملف» ثم النوع "CSV UTF-8 (Comma delimited)"، واختر ذلك الملف.',
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
    imported: 'اكتمل الاستيراد — منتجات جديدة: {inserted}، منتجات محدَّثة: {updated}.',
    validating: 'جارٍ التحقق…',
    preview: 'معاينة',
    runPreviewFirst: 'شغّل المعاينة أولًا',
    fixErrorsFirst: 'أصلح أخطاء التحقق قبل التطبيق',
    commit: 'تنفيذ الاستيراد',
    importing: 'جارٍ الاستيراد…',
    applyImport: 'تطبيق الاستيراد',
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
 *       Admin pastes CSV / picks a file -> we POST with dryRun:true ->
 *       server validates every row and returns { inserted, updated,
 *       errors[] } WITHOUT writing. The dialog renders the summary so
 *       the admin sees exactly what's about to happen.
 *
 *   Step 2 (confirm)
 *       Admin clicks "Apply" -> we POST the same CSV with dryRun:false.
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
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT(messages);
  const tc = useT(common);

  const reset = () => {
    setCsvText('');
    setFileName('');
    setPreview(null);
    setError(null);
    setApplied(false);
  };

  // Escape, the close button and the backdrop all land here: not while a
  // request is running.
  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

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
      if (text.includes('�')) {
        setError(t('errNotUtf8'));
        return;
      }
      setCsvText(text);
      setFileName(file.name);
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
    <Modal
      open={open}
      title={t('title')}
      onClose={handleClose}
      closeLabel={tc('close')}
      closeOnBackdrop
      footer={(
        <>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button
            icon="search"
            onClick={runPreview}
            disabled={busy || !csvText.trim()}
            loading={busy && !preview}
          >
            {busy && !preview ? t('validating') : t('preview')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            onClick={runApply}
            disabled={busy || !preview || preview.errors.length > 0 || applied}
            loading={busy && !!preview}
            title={
              !preview
                ? t('runPreviewFirst')
                : preview.errors.length > 0
                  ? t('fixErrorsFirst')
                  : t('commit')
            }
          >
            {busy && preview ? t('importing') : t('applyImport')}
          </Button>
        </>
      )}
    >
      <p className="adm-text-muted" style={{ marginBottom: 16 }}>
        {withParts(t('intro'), {
          brand: <strong>brand</strong>,
          categoryId: <strong>category_id</strong>,
          nameAr: <strong>name_ar</strong>,
          id: <code>id</code>,
        })}
      </p>

      <div className="adm-field adm-flex">
        <Button size="sm" icon="upload" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {t('chooseFile')}
        </Button>
        <span className="adm-text-sm adm-text-muted adm-truncate" dir="auto">{fileName || t('noFile')}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            // Lets the same file be picked again after fixing it.
            e.target.value = '';
            handleFile(file);
          }}
        />
      </div>

      <Field label={t('csvContent')}>
        <textarea
          className="adm-textarea adm-mono"
          rows={10}
          spellCheck={false}
          placeholder="id,brand,category_id,name_ar,…"
          dir="ltr"
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null); }}
          disabled={busy}
        />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      {preview && (
        <StatGrid min={120}>
          <StatCard icon="table" tone="neutral" label={t('totalRows')} value={fmtNumber(preview.total)} />
          <StatCard icon="plus" tone="success" label={t('newRows')} value={fmtNumber(preview.inserted)} />
          <StatCard icon="refresh" tone="info" label={t('updates')} value={fmtNumber(preview.updated)} />
          <StatCard
            icon="alert"
            tone={preview.errors.length > 0 ? 'danger' : 'neutral'}
            label={t('errors')}
            value={fmtNumber(preview.errors.length)}
          />
        </StatGrid>
      )}

      {preview && preview.errors.length > 0 && (
        <Alert tone="danger" title={t('errors')}>
          <div className="adm-mono" style={{ maxHeight: 160, overflow: 'auto' }}>
            {/* The server's messages already start with "Row N:". */}
            {preview.errors.map((e, i) => (
              <div key={i}>
                {e.error.startsWith('Row ')
                  ? localizeServerMessage(e.error)
                  : t('rowError', { line: e.line, error: localizeServerMessage(e.error) })}
              </div>
            ))}
          </div>
        </Alert>
      )}

      {applied && (
        <Alert tone="success">
          {t('imported', { inserted: preview?.inserted ?? 0, updated: preview?.updated ?? 0 })}
        </Alert>
      )}
    </Modal>
  );
};

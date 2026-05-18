import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';

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

  if (!open) return null;

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

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large (max 5 MB).');
      return;
    }
    try {
      const text = await file.text();
      setCsvText(text);
      setPreview(null);
      setError(null);
    } catch {
      setError('Could not read file.');
    }
  };

  const runPreview = async () => {
    if (!csvText.trim()) {
      setError('Paste CSV content or pick a file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.importProductsCsv(csvText, true);
      setPreview(res.summary);
      if (res.summary.errors.length > 0) {
        setError(`${res.summary.errors.length} row(s) failed validation. Fix them before applying.`);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Preview failed.';
      setError(msg);
      // Server returns the partial summary on validation errors so the
      // admin still sees per-row messages — try to parse it.
      type ApiError = Error & { status?: number; data?: { summary?: PreviewSummary } };
      const data = (err as ApiError).data;
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
      setError((err as Error).message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import products from CSV"
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
          <h2 style={{ margin: 0, fontSize: 18 }}>📥 Import products from CSV</h2>
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
          Paste CSV content below or pick a file. Export the current
          catalogue first to get the exact column layout — required
          fields are <strong>brand</strong>, <strong>category_id</strong>,
          and <strong>name_ar</strong>. Rows with an existing <code>id</code>
          get updated; rows with a blank <code>id</code> are inserted.
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
            <div><strong>{preview.total}</strong><br /><span style={{ color: 'var(--adm-text-dim)' }}>Total rows</span></div>
            <div style={{ color: '#22c55e' }}><strong>{preview.inserted}</strong><br /><span style={{ color: 'var(--adm-text-dim)' }}>New</span></div>
            <div style={{ color: '#4f6ef7' }}><strong>{preview.updated}</strong><br /><span style={{ color: 'var(--adm-text-dim)' }}>Updates</span></div>
            <div style={{ color: preview.errors.length > 0 ? '#ef4444' : 'var(--adm-text-dim)' }}>
              <strong>{preview.errors.length}</strong><br />
              <span style={{ color: 'var(--adm-text-dim)' }}>Errors</span>
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
            {preview.errors.map((e, i) => (
              <div key={i} style={{ color: '#dc2626' }}>line {e.line}: {e.error}</div>
            ))}
          </div>
        )}

        {applied && (
          <div className="adm-alert adm-alert-success">
            ✓ Imported {preview?.inserted ?? 0} new and {preview?.updated ?? 0} updated product(s).
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
            onClick={runPreview}
            disabled={busy || !csvText.trim()}
          >
            {busy && !preview ? 'Validating…' : '🔍 Preview'}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary adm-btn-sm"
            onClick={runApply}
            disabled={busy || !preview || preview.errors.length > 0 || applied}
            title={
              !preview
                ? 'Run preview first'
                : preview.errors.length > 0
                  ? 'Fix validation errors before applying'
                  : 'Commit the import'
            }
          >
            {busy && preview ? 'Importing…' : '✓ Apply import'}
          </button>
        </div>
      </div>
    </div>
  );
};

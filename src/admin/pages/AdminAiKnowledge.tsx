import React, { useState, useEffect } from 'react';
import { adminApi, type AiQA } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';

const LANGS: Array<{ key: 'ar' | 'en' | 'tr' | 'ru'; label: string; dir: 'rtl' | 'ltr' }> = [
  { key: 'ar', label: '🇸🇦 AR', dir: 'rtl' },
  { key: 'en', label: '🇬🇧 EN', dir: 'ltr' },
  { key: 'tr', label: '🇹🇷 TR', dir: 'ltr' },
  { key: 'ru', label: '🇷🇺 RU', dir: 'ltr' },
];

type LangKey = 'ar' | 'en' | 'tr' | 'ru';

const emptyQA = (): Partial<AiQA> => ({
  question_ar: '', question_en: '', question_tr: '', question_ru: '',
  answer_ar: '', answer_en: '', answer_tr: '', answer_ru: '', tags: '',
});

const QAForm: React.FC<{
  initial?: Partial<AiQA>;
  onSave: (data: Partial<AiQA>) => Promise<void>;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState<Partial<AiQA>>(initial ?? emptyQA());
  const [lang, setLang] = useState<LangKey>('ar');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleTranslate = async () => {
    const textEn = form.question_en || form.answer_en || '';
    if (!textEn) {
      setError('Enter English content first to auto-translate');
      return;
    }
    try {
      setSaving(true);
      const r = await adminApi.translate({
        fields: { question: form.question_en || '', answer: form.answer_en || '' },
        sourceLang: 'en',
      });
      const t = r.translations as Record<string, Record<string, string>>;
      setForm((f) => ({
        ...f,
        question_ar: t.question?.ar || f.question_ar,
        question_tr: t.question?.tr || f.question_tr,
        question_ru: t.question?.ru || f.question_ru,
        answer_ar: t.answer?.ar || f.answer_ar,
        answer_tr: t.answer?.tr || f.answer_tr,
        answer_ru: t.answer?.ru || f.answer_ru,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div style={{ background: 'var(--adm-surface2)', borderRadius: 12, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {LANGS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              background: lang === l.key ? 'var(--adm-accent)' : 'var(--adm-surface)',
              color: lang === l.key ? '#fff' : 'var(--adm-text-muted)',
              fontWeight: 600,
            }}
          >
            {l.label}
          </button>
        ))}
        <button
          onClick={handleTranslate}
          disabled={saving}
          style={{
            marginLeft: 'auto',
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--adm-border)',
            background: 'var(--adm-surface)',
            color: 'var(--adm-text-muted)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          🤖 AI Translate
        </button>
      </div>

      {LANGS.filter((l) => l.key === lang).map((l) => (
        <div key={l.key} style={{ direction: l.dir, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="adm-label" style={{ marginBottom: 4 }}>Question ({l.label})</label>
            <textarea
              className="adm-input"
              rows={3}
              dir={l.dir}
              value={(form as Record<string, string>)[`question_${l.key}`] || ''}
              onChange={(e) => set(`question_${l.key}`, e.target.value)}
              placeholder={l.key === 'ar' ? 'ما هي المنتجات المتوفرة؟' : 'What products do you offer?'}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="adm-label" style={{ marginBottom: 4 }}>Answer ({l.label})</label>
            <textarea
              className="adm-input"
              rows={3}
              dir={l.dir}
              value={(form as Record<string, string>)[`answer_${l.key}`] || ''}
              onChange={(e) => set(`answer_${l.key}`, e.target.value)}
              placeholder={l.key === 'ar' ? 'نقدم منتجات DIOX وAYLUX...' : 'We offer DIOX and AYLUX products...'}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      ))}

      <div className="adm-form-group" style={{ marginTop: 12 }}>
        <label className="adm-label">Tags (comma-separated keywords)</label>
        <input
          className="adm-input"
          value={form.tags || ''}
          onChange={(e) => set('tags', e.target.value)}
          placeholder="price, shipping, order, diox, aylux"
        />
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginTop: 8, marginBottom: 8 }}>⚠ {error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={submit} className="adm-btn adm-btn-primary" disabled={saving}>
          {saving ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> Saving…</> : '💾 Save Entry'}
        </button>
        <button onClick={onCancel} className="adm-btn">Cancel</button>
      </div>
    </div>
  );
};

export const AdminAiKnowledge: React.FC = () => {
  const [tab, setTab] = useState<'qa' | 'questions' | 'preview'>('qa');
  const [previewLang, setPreviewLang] = useState<LangKey>('en');
  const [preview, setPreview] = useState<{ productContext: string; customQA: string } | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draftEntry, setDraftEntry] = useState<Partial<AiQA> | null>(null);
  const [qStatus, setQStatus] = useState<'new' | 'reviewed' | 'ignored'>('new');
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const qaList = useAsync(() => adminApi.getAiKnowledge(), []);
  const qsData = useAsync(() => adminApi.getAiQuestions(qStatus), [qStatus]);

  const loadPreview = async (l: LangKey) => {
    setPreviewLang(l);
    const r = await adminApi.getAiPreview(l);
    setPreview(r);
  };

  useEffect(() => {
    if (tab === 'preview') {
      void loadPreview(previewLang);
    }
  }, [tab, previewLang]);

  const handleSaveQA = async (data: Partial<AiQA>) => {
    if (editing === 'new') {
      await adminApi.createAiQA(data);
    } else if (typeof editing === 'number') {
      await adminApi.updateAiQA(editing, data);
    }
    setEditing(null);
    setDraftEntry(null);
    qaList.reload();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await adminApi.deleteAiQA(id);
    qaList.reload();
  };

  const handleBulkReview = async (status: string) => {
    if (!selected.length) return;
    setSaving(true);
    await adminApi.reviewAiQuestions(selected, status);
    setSelected([]);
    qsData.reload();
    setSaving(false);
  };

  const startNewEntry = (seed?: Partial<AiQA>) => {
    setDraftEntry(seed ?? emptyQA());
    setEditing('new');
    setTab('qa');
  };

  const counts = qsData.data?.counts ?? [];
  const getCount = (s: string) => counts.find((c) => c.status === s)?.c ?? 0;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">🤖 AI Knowledge Base</h1>
          <p className="adm-page-subtitle">Teach the AI — manage custom Q&A and review what users ask</p>
        </div>
      </div>

      <div className="adm-tabs">
        {[
          { key: 'qa', label: '💡 Custom Q&A', badge: qaList.data?.entries?.length },
          { key: 'questions', label: '❓ User Questions', badge: getCount('new') || undefined },
          { key: 'preview', label: '👁 AI Knowledge Preview' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`adm-tab-btn${tab === t.key ? ' active' : ''}`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="adm-tab-badge">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'qa' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => startNewEntry()} className="adm-btn adm-btn-primary">+ Add Q&A Entry</button>
          </div>

          {editing === 'new' && (
            <QAForm initial={draftEntry ?? emptyQA()} onSave={handleSaveQA} onCancel={() => { setEditing(null); setDraftEntry(null); }} />
          )}

          {qaList.loading && <div className="adm-loading-center"><span className="adm-spinner" /></div>}

          {!qaList.loading && !qaList.data?.entries?.length && editing !== 'new' && (
            <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
              <p className="adm-text-muted" style={{ marginBottom: 16 }}>No custom Q&A entries yet.</p>
              <p className="adm-text-muted adm-text-sm">
                Add Q&A pairs to teach the AI specific answers about pricing, shipping, minimum orders, etc.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(qaList.data?.entries ?? []).map((entry) => (
              editing === entry.id ? (
                <QAForm key={entry.id} initial={entry} onSave={handleSaveQA} onCancel={() => setEditing(null)} />
              ) : (
                <div
                  key={entry.id}
                  style={{
                    background: 'var(--adm-surface)',
                    border: '1px solid var(--adm-border)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    borderLeft: `3px solid ${entry.active ? 'var(--adm-success)' : 'var(--adm-border)'}`,
                    opacity: entry.active ? 1 : 0.5,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--adm-text)', marginBottom: 4 }}>
                        Q: {entry.question_en || entry.question_ar || '—'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginBottom: 6 }}>
                        A: {(entry.answer_en || entry.answer_ar || '').slice(0, 120)}
                        {(entry.answer_en || entry.answer_ar || '').length > 120 ? '…' : ''}
                      </div>
                      {entry.tags && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {entry.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                            <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--adm-surface2)', color: 'var(--adm-text-dim)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setEditing(entry.id)} className="adm-btn adm-btn-sm">✏️</button>
                      <button onClick={() => handleDelete(entry.id)} className="adm-btn adm-btn-sm adm-btn-danger">🗑</button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {tab === 'questions' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['new', 'reviewed', 'ignored'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setQStatus(s)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--adm-border)',
                  background: qStatus === s ? 'var(--adm-accent)' : 'var(--adm-surface2)',
                  color: qStatus === s ? '#fff' : 'var(--adm-text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {s} ({getCount(s)})
              </button>
            ))}
            {selected.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--adm-text-muted)', alignSelf: 'center' }}>{selected.length} selected</span>
                <button
                  onClick={() => handleBulkReview('reviewed')}
                  disabled={saving}
                  className="adm-btn adm-btn-sm"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  ✅ Mark Reviewed
                </button>
                <button onClick={() => handleBulkReview('ignored')} disabled={saving} className="adm-btn adm-btn-sm">
                  🚫 Ignore
                </button>
              </div>
            )}
          </div>

          {qsData.loading && <div className="adm-loading-center"><span className="adm-spinner" /></div>}

          {!qsData.loading && !qsData.data?.questions?.length && (
            <div className="adm-card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <p className="adm-text-muted">No {qStatus} questions.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(qsData.data?.questions ?? []).map((q) => (
              <div
                key={q.id}
                style={{
                  background: 'var(--adm-surface)',
                  border: '1px solid var(--adm-border)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, q.id] : sel.filter((i) => i !== q.id))}
                  style={{ flexShrink: 0, width: 16, height: 16, cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--adm-text)', marginBottom: 2 }}>{q.question}</div>
                  <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>
                    <span className="adm-badge adm-badge-blue" style={{ fontSize: 10 }}>{q.language}</span>
                    &nbsp;·&nbsp;{fmtDate(q.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const entry = emptyQA();
                    const languageKey = (['ar', 'en', 'tr', 'ru'].includes(q.language) ? q.language : 'en') as LangKey;
                    (entry as Record<string, string>)[`question_${languageKey}`] = q.question;
                    startNewEntry(entry);
                  }}
                  className="adm-btn adm-btn-sm"
                  title="Convert to Q&A entry"
                  style={{ flexShrink: 0, background: 'rgba(79,110,247,0.12)', color: 'var(--adm-accent)', border: '1px solid rgba(79,110,247,0.25)' }}
                >
                  + Add Answer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {LANGS.map((l) => (
              <button
                key={l.key}
                onClick={() => void loadPreview(l.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--adm-border)',
                  background: previewLang === l.key ? 'var(--adm-accent)' : 'var(--adm-surface2)',
                  color: previewLang === l.key ? '#fff' : 'var(--adm-text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {!preview ? (
            <div className="adm-loading-center"><span className="adm-spinner" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="adm-card">
                <div className="adm-card-title" style={{ color: '#22c55e', marginBottom: 12 }}>
                  🧴 Product Catalog (Auto-Synced from DB)
                </div>
                <pre style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', background: 'var(--adm-bg)', padding: 12, borderRadius: 8 }}>
                  {preview.productContext || '(no products in database)'}
                </pre>
              </div>
              <div className="adm-card">
                <div className="adm-card-title" style={{ color: '#4f6ef7', marginBottom: 12 }}>
                  💡 Custom Q&A (Admin-Defined)
                </div>
                <pre style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', background: 'var(--adm-bg)', padding: 12, borderRadius: 8 }}>
                  {preview.customQA || '(no custom Q&A entries yet)'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

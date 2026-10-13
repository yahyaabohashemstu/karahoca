import React, { useState, useEffect, useRef } from 'react';
import { adminApi, type AiQA } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT, type AdminLang } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'AI Knowledge Base',
    subtitle: 'Teach the AI — manage custom Q&A and review what users ask',
    tabQa: 'Custom Q&A',
    tabQuestions: 'User Questions',
    tabPreview: 'AI Knowledge Preview',
    // Language tabs of the editor (flags stay in the code).
    code_ar: 'AR',
    code_en: 'EN',
    code_tr: 'TR',
    code_ru: 'RU',
    translateFirst: 'Write the question or the answer in any language first, then translate.',
    translationFailed: 'Translation failed',
    saveFailed: 'Save failed',
    translateTitle: 'Fill the other languages from the one that is filled in',
    translating: 'Translating…',
    aiTranslate: 'AI Translate',
    question: 'Question ({lang})',
    answer: 'Answer ({lang})',
    tags: 'Tags (comma-separated keywords)',
    tagsPlaceholder: 'price, shipping, order, diox, aylux',
    saveEntry: 'Save Entry',
    confirmDiscard: 'Discard the unsaved changes to the entry you are editing?',
    confirmDelete: 'Delete this entry?',
    deleteFailed: 'Delete failed',
    updateFailed: 'Update failed',
    previewFailed: 'Failed to load the preview',
    addEntry: '+ Add Q&A Entry',
    loadQaFailed: "Couldn't load the Q&A entries: {error}",
    noEntries: 'No custom Q&A entries yet.',
    noEntriesHint: 'Add Q&A pairs to teach the AI specific answers about pricing, shipping, minimum orders, etc.',
    qPrefix: 'Q:',
    aPrefix: 'A:',
    editEntryLabel: 'Edit entry: {name}',
    editEntry: 'Edit entry',
    deleteEntryLabel: 'Delete entry: {name}',
    deleteEntry: 'Delete entry',
    status_new: 'New',
    status_reviewed: 'Reviewed',
    status_ignored: 'Ignored',
    selected: { one: '{n} selected', other: '{n} selected' },
    markReviewed: 'Mark Reviewed',
    ignore: 'Ignore',
    loadQuestionsFailed: "Couldn't load the user questions: {error}",
    empty_new: 'No new questions.',
    empty_reviewed: 'No reviewed questions.',
    empty_ignored: 'No ignored questions.',
    selectQuestion: 'Select question: {question}',
    convertTitle: 'Convert to Q&A entry',
    addAnswer: '+ Add Answer',
    previewNote: 'Shows only the product catalogue and custom Q&A the AI gets for this language — not the full prompt (its standing instructions and website knowledge are added on top).',
    loadPreviewFailed: "Couldn't load the preview: {error}",
    catalogTitle: 'Product Catalog (Auto-Synced from DB)',
    noProducts: '(no products in database)',
    customQaTitle: 'Custom Q&A (Admin-Defined)',
    noCustomQa: '(no custom Q&A entries yet)',
  },
  ar: {
    title: 'قاعدة معرفة المساعد',
    subtitle: 'علّم المساعد — أدِر الأسئلة والأجوبة المخصصة وراجع ما يسأله الزوار',
    tabQa: 'الأسئلة والأجوبة المخصصة',
    tabQuestions: 'أسئلة الزوار',
    tabPreview: 'معاينة معرفة المساعد',
    code_ar: 'العربية',
    code_en: 'الإنجليزية',
    code_tr: 'التركية',
    code_ru: 'الروسية',
    translateFirst: 'اكتب السؤال أو الإجابة بأي لغة أولًا، ثم ترجم.',
    translationFailed: 'فشلت الترجمة',
    saveFailed: 'فشل الحفظ',
    translateTitle: 'ملء اللغات الأخرى انطلاقًا من اللغة المكتوبة',
    translating: 'جارٍ الترجمة…',
    aiTranslate: 'ترجمة تلقائية',
    question: 'السؤال ({lang})',
    answer: 'الإجابة ({lang})',
    tags: 'الوسوم (كلمات مفتاحية مفصولة بفواصل)',
    tagsPlaceholder: 'السعر, الشحن, الطلب, diox, aylux',
    saveEntry: 'حفظ الإدخال',
    confirmDiscard: 'تجاهل التغييرات غير المحفوظة على الإدخال قيد التعديل؟',
    confirmDelete: 'حذف هذا الإدخال؟',
    deleteFailed: 'فشل الحذف',
    updateFailed: 'فشل التحديث',
    previewFailed: 'تعذّر تحميل المعاينة',
    addEntry: '+ إضافة سؤال وجواب',
    loadQaFailed: 'تعذّر تحميل الأسئلة والأجوبة: {error}',
    noEntries: 'لا توجد أسئلة وأجوبة مخصصة بعد.',
    noEntriesHint: 'أضف أسئلة وأجوبة لتعليم المساعد إجابات محددة عن الأسعار والشحن والحد الأدنى للطلب وغيرها.',
    qPrefix: 'س:',
    aPrefix: 'ج:',
    editEntryLabel: 'تعديل الإدخال: {name}',
    editEntry: 'تعديل الإدخال',
    deleteEntryLabel: 'حذف الإدخال: {name}',
    deleteEntry: 'حذف الإدخال',
    status_new: 'جديدة',
    status_reviewed: 'تمت مراجعتها',
    status_ignored: 'متجاهَلة',
    selected: {
      zero: 'لم يُحدَّد أي سؤال',
      one: 'سؤال واحد محدد',
      two: 'سؤالان محددان',
      few: '{n} أسئلة محددة',
      many: '{n} سؤالًا محددًا',
      other: '{n} سؤال محدد',
    },
    markReviewed: 'تعليم كمُراجَعة',
    ignore: 'تجاهل',
    loadQuestionsFailed: 'تعذّر تحميل أسئلة الزوار: {error}',
    empty_new: 'لا توجد أسئلة جديدة.',
    empty_reviewed: 'لا توجد أسئلة تمت مراجعتها.',
    empty_ignored: 'لا توجد أسئلة متجاهَلة.',
    selectQuestion: 'تحديد السؤال: {question}',
    convertTitle: 'تحويل إلى سؤال وجواب',
    addAnswer: '+ إضافة إجابة',
    previewNote: 'تعرض فقط كتالوج المنتجات والأسئلة والأجوبة المخصصة التي يتلقاها المساعد بهذه اللغة — لا التعليمات الكاملة (تُضاف إليها تعليماته الثابتة ومعرفته بالموقع).',
    loadPreviewFailed: 'تعذّر تحميل المعاينة: {error}',
    catalogTitle: 'كتالوج المنتجات (مُزامَن تلقائيًا من قاعدة البيانات)',
    noProducts: '(لا توجد منتجات في قاعدة البيانات)',
    customQaTitle: 'الأسئلة والأجوبة المخصصة (يحددها المشرف)',
    noCustomQa: '(لا توجد أسئلة وأجوبة مخصصة بعد)',
  },
});

type LangKey = 'ar' | 'en' | 'tr' | 'ru';

const LANGS: Array<{ key: LangKey; flag: string; dir: 'rtl' | 'ltr' }> = [
  { key: 'ar', flag: '🇸🇦', dir: 'rtl' },
  { key: 'en', flag: '🇬🇧', dir: 'ltr' },
  { key: 'tr', flag: '🇹🇷', dir: 'ltr' },
  { key: 'ru', flag: '🇷🇺', dir: 'ltr' },
];

const LANG_KEYS: LangKey[] = ['ar', 'en', 'tr', 'ru'];

const QA_TEXT_FIELDS = [
  'question_ar', 'question_en', 'question_tr', 'question_ru',
  'answer_ar', 'answer_en', 'answer_tr', 'answer_ru', 'tags',
] as const;

const emptyQA = (): Partial<AiQA> => ({
  question_ar: '', question_en: '', question_tr: '', question_ru: '',
  answer_ar: '', answer_en: '', answer_tr: '', answer_ru: '', tags: '',
});

const textOf = (qa: Partial<AiQA> | undefined, key: string) =>
  ((qa as Record<string, string | undefined> | undefined)?.[key] || '').trim();

/** First non-empty value of `prefix_<lang>`, the admin's language first. */
const firstFilled = (qa: AiQA, prefix: 'question' | 'answer', adminLang: AdminLang) =>
  (adminLang === 'ar' ? (['ar', 'en', 'tr', 'ru'] as const) : (['en', 'ar', 'tr', 'ru'] as const))
    .map((l) => textOf(qa, `${prefix}_${l}`)).find(Boolean) || '';

const QAForm: React.FC<{
  initial?: Partial<AiQA>;
  onSave: (data: Partial<AiQA>) => Promise<void>;
  onCancel: () => void;
  /** Lets the page ask before throwing typed text away. */
  onDirtyChange?: (dirty: boolean) => void;
}> = ({ initial, onSave, onCancel, onDirtyChange }) => {
  const [form, setForm] = useState<Partial<AiQA>>(initial ?? emptyQA());
  const [lang, setLang] = useState<LangKey>('ar');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const t = useT(messages);
  const tc = useT(common);
  const langLabel = (l: (typeof LANGS)[number]) => `${l.flag} ${t(`code_${l.key}`)}`;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const dirty = QA_TEXT_FIELDS.some((k) => textOf(form, k) !== textOf(initial, k));
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleTranslate = async () => {
    // Translate from the language that is filled in, not only English: an
    // entry written in Arabic (or added from an Arabic user question) used
    // to be refused with "Enter English content first".
    const order = [lang, ...LANG_KEYS.filter((l) => l !== lang)];
    const has = (l: LangKey) => ({ q: textOf(form, `question_${l}`), a: textOf(form, `answer_${l}`) });
    const source = order.find((l) => has(l).q && has(l).a) ?? order.find((l) => has(l).q || has(l).a);
    if (!source) {
      setError(t('translateFirst'));
      return;
    }
    const { q, a } = has(source);
    const fields: Record<string, string> = {};
    if (q) fields.question = q;
    if (a) fields.answer = a;
    setError('');
    setTranslating(true);
    try {
      const r = await adminApi.translate({ fields, sourceLang: source });
      // Keyed by language first ({ en: { question, answer } }); reading it
      // field-first (t.question.en) meant this button never filled a field.
      const translations = r.translations as Record<string, Record<string, string> | undefined>;
      setForm((f) => {
        const next = { ...f } as Record<string, string>;
        for (const l of LANG_KEYS) {
          if (l === source) continue;
          if (translations[l]?.question) next[`question_${l}`] = translations[l]!.question;
          if (translations[l]?.answer) next[`answer_${l}`] = translations[l]!.answer;
        }
        return next as Partial<AiQA>;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('translationFailed'));
    } finally {
      setTranslating(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('saveFailed'));
      setSaving(false);
    }
  };

  const busy = saving || translating;

  return (
    <div style={{ background: 'var(--adm-surface2)', borderRadius: 12, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {LANGS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setLang(l.key)}
            aria-pressed={lang === l.key}
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
            {langLabel(l)}
          </button>
        ))}
        <button
          type="button"
          onClick={handleTranslate}
          disabled={busy}
          title={t('translateTitle')}
          style={{
            marginInlineStart: 'auto',
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--adm-border)',
            background: 'var(--adm-surface)',
            color: 'var(--adm-text-muted)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {translating ? <><span className="adm-spinner" style={{ width: 10, height: 10 }} /> {t('translating')}</> : `🤖 ${t('aiTranslate')}`}
        </button>
      </div>

      {LANGS.filter((l) => l.key === lang).map((l) => (
        <div key={l.key} style={{ direction: l.dir, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="adm-label" style={{ marginBottom: 4 }}>{t('question', { lang: langLabel(l) })}</label>
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
            <label className="adm-label" style={{ marginBottom: 4 }}>{t('answer', { lang: langLabel(l) })}</label>
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
        <label className="adm-label">{t('tags')}</label>
        <input
          className="adm-input"
          dir="auto"
          value={form.tags || ''}
          onChange={(e) => set('tags', e.target.value)}
          placeholder={t('tagsPlaceholder')}
        />
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginTop: 8, marginBottom: 8 }}>⚠ {error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={submit} className="adm-btn adm-btn-primary" disabled={busy}>
          {saving ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> {tc('saving')}</> : `💾 ${t('saveEntry')}`}
        </button>
        <button type="button" onClick={onCancel} className="adm-btn">{tc('cancel')}</button>
      </div>
    </div>
  );
};

export const AdminAiKnowledge: React.FC = () => {
  const [tab, setTab] = useState<'qa' | 'questions' | 'preview'>('qa');
  const [previewLang, setPreviewLang] = useState<LangKey>('en');
  const [preview, setPreview] = useState<{ productContext: string; customQA: string } | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string | null } | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draftEntry, setDraftEntry] = useState<Partial<AiQA> | null>(null);
  // Remounts the "new" form when it is re-seeded (e.g. a second "+ Add
  // Answer"), which useState's initial value would otherwise ignore.
  const [draftSeq, setDraftSeq] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  const [qStatus, setQStatus] = useState<'new' | 'reviewed' | 'ignored'>('new');
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const t = useT(messages);
  const tc = useT(common);

  const qaList = useAsync(() => adminApi.getAiKnowledge(), []);
  const qsData = useAsync(() => adminApi.getAiQuestions(qStatus), [qStatus]);

  // The language buttons only set previewLang; this is the one place that
  // loads. They used to load too, so each click fetched twice, and a slow
  // earlier response could land last and show under the wrong language.
  const previewRequest = useRef(0);
  useEffect(() => {
    if (tab !== 'preview') return;
    const requestId = ++previewRequest.current;
    setPreview(null);
    setPreviewError(null);
    adminApi.getAiPreview(previewLang)
      .then((r) => { if (requestId === previewRequest.current) setPreview(r); })
      .catch((e: unknown) => {
        // No message: the generic text is chosen at render time, in the
        // admin's current language.
        if (requestId === previewRequest.current) setPreviewError({ message: e instanceof Error ? e.message : null });
      });
  }, [tab, previewLang, previewAttempt]);

  /** Switch the form to another entry, asking first if typed text would be lost. */
  const openEditor = (target: number | 'new' | null, seed?: Partial<AiQA>) => {
    if (editing !== null && formDirty && !confirm(t('confirmDiscard'))) {
      return false;
    }
    setFormDirty(false);
    if (target === 'new') {
      setDraftEntry(seed ?? emptyQA());
      setDraftSeq((n) => n + 1);
    } else {
      setDraftEntry(null);
    }
    setEditing(target);
    return true;
  };

  const handleSaveQA = async (data: Partial<AiQA>) => {
    if (editing === 'new') {
      await adminApi.createAiQA(data);
    } else if (typeof editing === 'number') {
      await adminApi.updateAiQA(editing, data);
    }
    setFormDirty(false);
    setEditing(null);
    setDraftEntry(null);
    qaList.reload();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    setActionError('');
    setDeletingId(id);
    try {
      await adminApi.deleteAiQA(id);
      if (editing === id) {
        setFormDirty(false);
        setEditing(null);
      }
      qaList.reload();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : t('deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkReview = async (status: string) => {
    if (!selected.length) return;
    setActionError('');
    setSaving(true);
    try {
      await adminApi.reviewAiQuestions(selected, status);
      setSelected([]);
      qsData.reload();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : t('updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const startNewEntry = (seed?: Partial<AiQA>) => {
    if (openEditor('new', seed)) setTab('qa');
  };

  const counts = qsData.data?.counts ?? [];
  const getCount = (s: string) => counts.find((c) => c.status === s)?.c ?? 0;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">🤖 {t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
      </div>

      <div className="adm-tabs">
        {[
          { key: 'qa', label: `💡 ${t('tabQa')}`, badge: qaList.data?.entries?.length },
          { key: 'questions', label: `❓ ${t('tabQuestions')}`, badge: getCount('new') || undefined },
          { key: 'preview', label: `👁 ${t('tabPreview')}` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`adm-tab-btn${tab === item.key ? ' active' : ''}`}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="adm-tab-badge">{fmtNumber(item.badge)}</span>
            )}
          </button>
        ))}
      </div>

      {actionError && <div className="adm-alert adm-alert-error" role="alert" style={{ marginBottom: 16 }}>⚠ {actionError}</div>}

      {/* All three panels stay mounted (only hidden), so an entry being
          typed survives a look at the User Questions tab. */}
      <div hidden={tab !== 'qa'}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button type="button" onClick={() => startNewEntry()} className="adm-btn adm-btn-primary">{t('addEntry')}</button>
        </div>

        {editing === 'new' && (
          <QAForm
            key={`new-${draftSeq}`}
            initial={draftEntry ?? emptyQA()}
            onSave={handleSaveQA}
            onCancel={() => { setFormDirty(false); setEditing(null); setDraftEntry(null); }}
            onDirtyChange={setFormDirty}
          />
        )}

        {qaList.loading && <div className="adm-loading-center"><span className="adm-spinner" /></div>}

        {qaList.error && (
          <div className="adm-alert adm-alert-error" role="alert" style={{ marginBottom: 12 }}>
            ⚠ {t('loadQaFailed', { error: qaList.error })}{' '}
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => qaList.reload()}>{tc('retry')}</button>
          </div>
        )}

        {!qaList.loading && !qaList.error && !qaList.data?.entries?.length && editing !== 'new' && (
          <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <p className="adm-text-muted" style={{ marginBottom: 16 }}>{t('noEntries')}</p>
            <p className="adm-text-muted adm-text-sm">
              {t('noEntriesHint')}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(qaList.data?.entries ?? []).map((entry) => {
            const question = firstFilled(entry, 'question', t.lang);
            const answer = firstFilled(entry, 'answer', t.lang);
            const name = question || `#${entry.id}`;
            return editing === entry.id ? (
              <QAForm
                key={entry.id}
                initial={entry}
                onSave={handleSaveQA}
                onCancel={() => { setFormDirty(false); setEditing(null); }}
                onDirtyChange={setFormDirty}
              />
            ) : (
              <div
                key={entry.id}
                style={{
                  background: 'var(--adm-surface)',
                  border: '1px solid var(--adm-border)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  borderInlineStart: `3px solid ${entry.active ? 'var(--adm-success)' : 'var(--adm-border)'}`,
                  opacity: entry.active ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--adm-text)', marginBottom: 4 }}>
                      {t('qPrefix')} <span dir="auto">{question || '—'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginBottom: 6 }}>
                      {t('aPrefix')} <span dir="auto">{answer.slice(0, 120)}{answer.length > 120 ? '…' : ''}</span>
                    </div>
                    {entry.tags && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {entry.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                          <span key={tag} dir="auto" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--adm-surface2)', color: 'var(--adm-text-dim)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => openEditor(entry.id)}
                      className="adm-btn adm-btn-sm"
                      aria-label={t('editEntryLabel', { name })}
                      title={t('editEntry')}
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="adm-btn adm-btn-sm adm-btn-danger"
                      disabled={deletingId === entry.id}
                      aria-label={t('deleteEntryLabel', { name })}
                      title={t('deleteEntry')}
                    >
                      <span aria-hidden="true">{deletingId === entry.id ? '…' : '🗑'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div hidden={tab !== 'questions'}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['new', 'reviewed', 'ignored'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={qStatus === s}
              onClick={() => {
                // The ticked ids belong to the list being left; carrying them
                // over bulk-updated rows the admin could no longer see.
                if (s !== qStatus) setSelected([]);
                setQStatus(s);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid var(--adm-border)',
                background: qStatus === s ? 'var(--adm-accent)' : 'var(--adm-surface2)',
                color: qStatus === s ? '#fff' : 'var(--adm-text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {t(`status_${s}`)} ({fmtNumber(getCount(s))})
            </button>
          ))}
          {selected.length > 0 && (
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--adm-text-muted)', alignSelf: 'center' }}>{t.plural('selected', selected.length)}</span>
              <button
                type="button"
                onClick={() => handleBulkReview('reviewed')}
                disabled={saving}
                className="adm-btn adm-btn-sm"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                ✅ {t('markReviewed')}
              </button>
              <button type="button" onClick={() => handleBulkReview('ignored')} disabled={saving} className="adm-btn adm-btn-sm">
                🚫 {t('ignore')}
              </button>
            </div>
          )}
        </div>

        {qsData.loading && <div className="adm-loading-center"><span className="adm-spinner" /></div>}

        {qsData.error && (
          <div className="adm-alert adm-alert-error" role="alert" style={{ marginBottom: 12 }}>
            ⚠ {t('loadQuestionsFailed', { error: qsData.error })}{' '}
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => qsData.reload()}>{tc('retry')}</button>
          </div>
        )}

        {!qsData.loading && !qsData.error && !qsData.data?.questions?.length && (
          <div className="adm-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <p className="adm-text-muted">{t(`empty_${qStatus}`)}</p>
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
                aria-label={t('selectQuestion', { question: q.question })}
                checked={selected.includes(q.id)}
                onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, q.id] : sel.filter((i) => i !== q.id))}
                style={{ flexShrink: 0, width: 16, height: 16, cursor: 'pointer' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div dir="auto" style={{ fontSize: 14, color: 'var(--adm-text)', marginBottom: 2 }}>{q.question}</div>
                <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>
                  <span className="adm-badge adm-badge-blue" style={{ fontSize: 10 }}>{q.language}</span>
                  &nbsp;·&nbsp;{fmtDateTime(q.created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const entry = emptyQA();
                  const languageKey = (['ar', 'en', 'tr', 'ru'].includes(q.language) ? q.language : 'en') as LangKey;
                  (entry as Record<string, string>)[`question_${languageKey}`] = q.question;
                  startNewEntry(entry);
                }}
                className="adm-btn adm-btn-sm"
                title={t('convertTitle')}
                style={{ flexShrink: 0, background: 'rgba(79,110,247,0.12)', color: 'var(--adm-accent)', border: '1px solid rgba(79,110,247,0.25)' }}
              >
                {t('addAnswer')}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div hidden={tab !== 'preview'}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {LANGS.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={previewLang === l.key}
              onClick={() => setPreviewLang(l.key)}
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
              {l.flag} {t(`code_${l.key}`)}
            </button>
          ))}
        </div>
        <p className="adm-text-muted adm-text-sm" style={{ marginBottom: 16 }}>
          {t('previewNote')}
        </p>

        {previewError ? (
          <div className="adm-alert adm-alert-error" role="alert">
            ⚠ {t('loadPreviewFailed', { error: previewError.message ?? t('previewFailed') })}{' '}
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => setPreviewAttempt((n) => n + 1)}>{tc('retry')}</button>
          </div>
        ) : !preview ? (
          <div className="adm-loading-center"><span className="adm-spinner" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="adm-card">
              <div className="adm-card-title" style={{ color: '#22c55e', marginBottom: 12 }}>
                🧴 {t('catalogTitle')}
              </div>
              {/* The assistant's prompt text (English structure): left to right. */}
              <pre dir="ltr" style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', background: 'var(--adm-bg)', padding: 12, borderRadius: 8 }}>
                {preview.productContext || t('noProducts')}
              </pre>
            </div>
            <div className="adm-card">
              <div className="adm-card-title" style={{ color: '#4f6ef7', marginBottom: 12 }}>
                💡 {t('customQaTitle')}
              </div>
              <pre dir="ltr" style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', background: 'var(--adm-bg)', padding: 12, borderRadius: 8 }}>
                {preview.customQA || t('noCustomQa')}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

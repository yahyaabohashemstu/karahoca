import React, { useState, useEffect, useRef } from 'react';
import { adminApi, type AiQA, type AiQuestion } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT, type AdminLang } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Badge, Button, Card, EmptyState, Field, IconButton, LangLabel, LangTag, Loading, PageHeader, StatusBadge, Tabs, Toolbar, type IconName } from '../ui';

const messages = defineMessages({
  en: {
    title: 'AI knowledge base',
    subtitle: 'Teach the AI — manage custom Q&A and review what users ask',
    tabQa: 'Custom Q&A',
    tabQuestions: 'Visitor questions',
    tabPreview: 'AI knowledge preview',
    translateFirst: 'Write the question or the answer in any language first, then translate.',
    translationFailed: 'Translation failed',
    saveFailed: 'Save failed',
    translateTitle: 'Fill the other languages from the one that is filled in',
    translating: 'Translating…',
    aiTranslate: 'AI translate',
    question: 'Question ({lang})',
    answer: 'Answer ({lang})',
    tags: 'Tags (comma-separated keywords)',
    tagsPlaceholder: 'price, shipping, order, diox, aylux',
    saveEntry: 'Save entry',
    confirmDiscard: 'Discard the unsaved changes to the entry you are editing?',
    confirmDelete: 'Delete this entry?',
    deleteFailed: 'Delete failed',
    updateFailed: 'Update failed',
    previewFailed: 'Failed to load the preview',
    addEntry: 'Add Q&A entry',
    loadQaFailed: "Couldn't load the Q&A entries: {error}",
    noEntries: 'No custom Q&A entries yet.',
    noEntriesHint: 'Add Q&A pairs to teach the AI specific answers about pricing, shipping, minimum orders, etc.',
    qPrefix: 'Q:',
    aPrefix: 'A:',
    editEntryLabel: 'Edit entry: {name}',
    deleteEntryLabel: 'Delete entry: {name}',
    status_new: 'New',
    status_reviewed: 'Reviewed',
    status_ignored: 'Ignored',
    statusFilter: 'Question status',
    selected: { one: '{n} selected', other: '{n} selected' },
    markReviewed: 'Mark reviewed',
    ignore: 'Ignore',
    loadQuestionsFailed: "Couldn't load the visitor questions: {error}",
    empty_new: 'No new questions.',
    empty_reviewed: 'No reviewed questions.',
    empty_ignored: 'No ignored questions.',
    colSelect: 'Select',
    colQuestion: 'Question',
    colDate: 'Date',
    selectQuestion: 'Select question: {question}',
    convertTitle: 'Convert to Q&A entry',
    addAnswer: 'Add answer',
    previewNote: 'Shows only the product catalogue and custom Q&A the AI gets for this language — not the full prompt (its standing instructions and website knowledge are added on top).',
    loadPreviewFailed: "Couldn't load the preview: {error}",
    catalogTitle: 'Product catalog (auto-synced from DB)',
    noProducts: '(no products in database)',
    customQaTitle: 'Custom Q&A (admin-defined)',
    noCustomQa: '(no custom Q&A entries yet)',
  },
  ar: {
    title: 'قاعدة معرفة المساعد',
    subtitle: 'علّم المساعد — أدِر الأسئلة والأجوبة المخصصة وراجع ما يسأله الزوار',
    tabQa: 'الأسئلة والأجوبة المخصصة',
    tabQuestions: 'أسئلة الزوار',
    tabPreview: 'معاينة معرفة المساعد',
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
    addEntry: 'إضافة سؤال وجواب',
    loadQaFailed: 'تعذّر تحميل الأسئلة والأجوبة: {error}',
    noEntries: 'لا توجد أسئلة وأجوبة مخصصة بعد.',
    noEntriesHint: 'أضف أسئلة وأجوبة لتعليم المساعد إجابات محددة عن الأسعار والشحن والحد الأدنى للطلب وغيرها.',
    qPrefix: 'س:',
    aPrefix: 'ج:',
    editEntryLabel: 'تعديل الإدخال: {name}',
    deleteEntryLabel: 'حذف الإدخال: {name}',
    status_new: 'جديدة',
    status_reviewed: 'تمت مراجعتها',
    status_ignored: 'متجاهَلة',
    statusFilter: 'حالة السؤال',
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
    colSelect: 'تحديد',
    colQuestion: 'السؤال',
    colDate: 'التاريخ',
    selectQuestion: 'تحديد السؤال: {question}',
    convertTitle: 'تحويل إلى سؤال وجواب',
    addAnswer: 'إضافة إجابة',
    previewNote: 'تعرض فقط كتالوج المنتجات والأسئلة والأجوبة المخصصة التي يتلقاها المساعد بهذه اللغة — لا التعليمات الكاملة (تُضاف إليها تعليماته الثابتة ومعرفته بالموقع).',
    loadPreviewFailed: 'تعذّر تحميل المعاينة: {error}',
    catalogTitle: 'كتالوج المنتجات (مُزامَن تلقائيًا من قاعدة البيانات)',
    noProducts: '(لا توجد منتجات في قاعدة البيانات)',
    customQaTitle: 'الأسئلة والأجوبة المخصصة (يحددها المشرف)',
    noCustomQa: '(لا توجد أسئلة وأجوبة مخصصة بعد)',
  },
});

type LangKey = 'ar' | 'en' | 'tr' | 'ru';

const LANGS: Array<{ key: LangKey; dir: 'rtl' | 'ltr' }> = [
  { key: 'ar', dir: 'rtl' },
  { key: 'en', dir: 'ltr' },
  { key: 'tr', dir: 'ltr' },
  { key: 'ru', dir: 'ltr' },
];

const LANG_KEYS: LangKey[] = ['ar', 'en', 'tr', 'ru'];

type QuestionStatus = AiQuestion['status'];
const QUESTION_STATUSES: Array<{ value: QuestionStatus; icon: IconName }> = [
  { value: 'new', icon: 'flame' },
  { value: 'reviewed', icon: 'check' },
  { value: 'ignored', icon: 'ban' },
];

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

/** Language picker for the four content languages: code chip + name, never flags. */
const LangTabs: React.FC<{ value: LangKey; onChange: (lang: LangKey) => void }> = ({ value, onChange }) => {
  const tc = useT(common);
  return (
    <Tabs
      variant="segmented"
      ariaLabel={tc('language')}
      value={value}
      onChange={onChange}
      items={LANGS.map((l) => ({ value: l.key, label: <LangLabel lang={l.key} /> }))}
    />
  );
};

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
  const langName = (l: LangKey) => tc(`lang_${l}`);

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
    <Card>
      <div className="adm-flex-between" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <LangTabs value={lang} onChange={setLang} />
        <Button
          variant="ai"
          icon="ai"
          size="sm"
          onClick={handleTranslate}
          loading={translating}
          disabled={busy}
          title={t('translateTitle')}
        >
          {translating ? t('translating') : t('aiTranslate')}
        </Button>
      </div>

      {/* The boxes follow the language being written; labels stay in the
          dashboard's direction. */}
      {LANGS.filter((l) => l.key === lang).map((l) => (
        <div key={l.key} className="adm-grid-2">
          <Field label={t('question', { lang: langName(l.key) })}>
            <textarea
              className="adm-textarea"
              rows={3}
              dir={l.dir}
              value={(form as Record<string, string>)[`question_${l.key}`] || ''}
              onChange={(e) => set(`question_${l.key}`, e.target.value)}
              placeholder={l.key === 'ar' ? 'ما هي المنتجات المتوفرة؟' : 'What products do you offer?'}
            />
          </Field>
          <Field label={t('answer', { lang: langName(l.key) })}>
            <textarea
              className="adm-textarea"
              rows={3}
              dir={l.dir}
              value={(form as Record<string, string>)[`answer_${l.key}`] || ''}
              onChange={(e) => set(`answer_${l.key}`, e.target.value)}
              placeholder={l.key === 'ar' ? 'نقدم منتجات DIOX وAYLUX...' : 'We offer DIOX and AYLUX products...'}
            />
          </Field>
        </div>
      ))}

      <Field label={t('tags')}>
        <input
          className="adm-input"
          dir="auto"
          value={form.tags || ''}
          onChange={(e) => set('tags', e.target.value)}
          placeholder={t('tagsPlaceholder')}
        />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="adm-flex">
        <Button variant="primary" icon="save" onClick={submit} loading={saving} disabled={busy}>
          {saving ? tc('saving') : t('saveEntry')}
        </Button>
        <Button onClick={onCancel}>{tc('cancel')}</Button>
      </div>
    </Card>
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
  // Remounts the "new" form when it is re-seeded (e.g. a second "Add
  // Answer"), which useState's initial value would otherwise ignore.
  const [draftSeq, setDraftSeq] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  const [qStatus, setQStatus] = useState<QuestionStatus>('new');
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
  const entries = qaList.data?.entries ?? [];
  const questions = qsData.data?.questions ?? [];
  const newCount = getCount('new');

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<Button variant="primary" icon="plus" onClick={() => startNewEntry()}>{t('addEntry')}</Button>}
      />

      <Tabs
        variant="underline"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'qa', label: t('tabQa'), icon: 'help', badge: entries.length ? fmtNumber(entries.length) : undefined },
          { value: 'questions', label: t('tabQuestions'), icon: 'chats', badge: newCount ? fmtNumber(newCount) : undefined },
          { value: 'preview', label: t('tabPreview'), icon: 'eye' },
        ]}
      />

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {/* All three panels stay mounted (only hidden), so an entry being
          typed survives a look at the Visitor Questions tab. */}
      <div hidden={tab !== 'qa'}>
        {qaList.error && (
          <Alert
            tone="danger"
            action={<Button size="sm" icon="refresh" onClick={() => qaList.reload()}>{tc('retry')}</Button>}
          >
            {t('loadQaFailed', { error: qaList.error })}
          </Alert>
        )}

        <div className="adm-stack">
          {editing === 'new' && (
            <QAForm
              key={`new-${draftSeq}`}
              initial={draftEntry ?? emptyQA()}
              onSave={handleSaveQA}
              onCancel={() => { setFormDirty(false); setEditing(null); setDraftEntry(null); }}
              onDirtyChange={setFormDirty}
            />
          )}

          {qaList.loading && <Loading label={tc('loading')} />}

          {!qaList.loading && !qaList.error && !entries.length && editing !== 'new' && (
            <Card>
              <EmptyState icon="bot" title={t('noEntries')} text={t('noEntriesHint')} />
            </Card>
          )}

          {entries.map((entry) => {
            const question = firstFilled(entry, 'question', t.lang);
            const answer = firstFilled(entry, 'answer', t.lang);
            const name = question || `#${entry.id}`;
            const tags = (entry.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
            return editing === entry.id ? (
              <QAForm
                key={entry.id}
                initial={entry}
                onSave={handleSaveQA}
                onCancel={() => { setFormDirty(false); setEditing(null); }}
                onDirtyChange={setFormDirty}
              />
            ) : (
              <Card
                key={entry.id}
                title={<><span className="adm-text-muted">{t('qPrefix')}</span> <span dir="auto">{question || '—'}</span></>}
                actions={(
                  <div className="adm-row-actions">
                    <IconButton icon="edit" size="sm" label={t('editEntryLabel', { name })} onClick={() => openEditor(entry.id)} />
                    <IconButton
                      icon="trash"
                      tone="danger"
                      size="sm"
                      label={t('deleteEntryLabel', { name })}
                      onClick={() => handleDelete(entry.id)}
                      loading={deletingId === entry.id}
                    />
                  </div>
                )}
              >
                <p className="adm-text-muted" style={{ margin: 0 }}>
                  {t('aPrefix')} <span dir="auto">{answer.slice(0, 120)}{answer.length > 120 ? '…' : ''}</span>
                </p>
                {(!entry.active || tags.length > 0) && (
                  <div className="adm-flex" style={{ flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {!entry.active && <StatusBadge status="inactive" />}
                    {tags.map((tag) => (
                      <Badge key={tag}><bdi>{tag}</bdi></Badge>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div hidden={tab !== 'questions'}>
        <Toolbar
          end={selected.length > 0 && (
            <>
              <span className="adm-toolbar-label">{t.plural('selected', selected.length)}</span>
              <Button size="sm" icon="check" onClick={() => handleBulkReview('reviewed')} disabled={saving}>
                {t('markReviewed')}
              </Button>
              <Button size="sm" variant="ghost" icon="ban" onClick={() => handleBulkReview('ignored')} disabled={saving}>
                {t('ignore')}
              </Button>
            </>
          )}
        >
          <Tabs
            variant="segmented"
            ariaLabel={t('statusFilter')}
            value={qStatus}
            onChange={(s) => {
              // The ticked ids belong to the list being left; carrying them
              // over bulk-updated rows the admin could no longer see.
              if (s !== qStatus) setSelected([]);
              setQStatus(s);
            }}
            items={QUESTION_STATUSES.map((s) => ({
              value: s.value,
              label: t(`status_${s.value}`),
              icon: s.icon,
              badge: fmtNumber(getCount(s.value)),
            }))}
          />
        </Toolbar>

        {qsData.error && (
          <Alert
            tone="danger"
            action={<Button size="sm" icon="refresh" onClick={() => qsData.reload()}>{tc('retry')}</Button>}
          >
            {t('loadQuestionsFailed', { error: qsData.error })}
          </Alert>
        )}

        {qsData.loading ? (
          <Loading label={tc('loading')} />
        ) : !qsData.error && !questions.length ? (
          <Card>
            <EmptyState icon="checkCircle" title={t(`empty_${qStatus}`)} compact />
          </Card>
        ) : questions.length > 0 && (
          <Card flush>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th style={{ width: '1%' }}><span className="adm-sr-only">{t('colSelect')}</span></th>
                    <th>{t('colQuestion')}</th>
                    <th>{tc('language')}</th>
                    <th>{t('colDate')}</th>
                    <th>{tc('status')}</th>
                    <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const status = QUESTION_STATUSES.some((s) => s.value === q.status) ? q.status : qStatus;
                    return (
                      <tr key={q.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={t('selectQuestion', { question: q.question })}
                            checked={selected.includes(q.id)}
                            onChange={(e) => setSelected((sel) => e.target.checked ? [...sel, q.id] : sel.filter((i) => i !== q.id))}
                          />
                        </td>
                        <td dir="auto">{q.question}</td>
                        <td>{q.language ? <LangTag lang={q.language} /> : <span className="adm-text-muted">—</span>}</td>
                        <td className="adm-cell-date">{fmtDateTime(q.created_at)}</td>
                        <td><StatusBadge status={status} label={t(`status_${status}`)} /></td>
                        <td className="adm-col-actions">
                          <Button
                            size="sm"
                            icon="plus"
                            title={t('convertTitle')}
                            onClick={() => {
                              const entry = emptyQA();
                              const languageKey = (['ar', 'en', 'tr', 'ru'].includes(q.language) ? q.language : 'en') as LangKey;
                              (entry as Record<string, string>)[`question_${languageKey}`] = q.question;
                              startNewEntry(entry);
                            }}
                          >
                            {t('addAnswer')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div hidden={tab !== 'preview'}>
        <Toolbar>
          <LangTabs value={previewLang} onChange={setPreviewLang} />
        </Toolbar>
        <Alert tone="info">{t('previewNote')}</Alert>

        {previewError ? (
          <Alert
            tone="danger"
            action={<Button size="sm" icon="refresh" onClick={() => setPreviewAttempt((n) => n + 1)}>{tc('retry')}</Button>}
          >
            {t('loadPreviewFailed', { error: previewError.message ?? t('previewFailed') })}
          </Alert>
        ) : !preview ? (
          <Loading label={tc('loading')} />
        ) : (
          <div className="adm-stack">
            <Card title={t('catalogTitle')} icon="products">
              {/* The assistant's prompt text (English structure): left to right. */}
              <pre dir="ltr" className="adm-mono adm-text-muted" style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>
                {preview.productContext || t('noProducts')}
              </pre>
            </Card>
            <Card title={t('customQaTitle')} icon="lightbulb">
              <pre dir="ltr" className="adm-mono adm-text-muted" style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {preview.customQA || t('noCustomQa')}
              </pre>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

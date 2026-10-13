import React, { useEffect, useRef, useState } from 'react';
import { adminApi, type AbExperimentRow, type AbVariantRow, type AbExperimentResults } from '../utils/adminApi';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

/**
 * A/B testing dashboard (Phase G4).
 *
 * A single-page admin for the whole experiment lifecycle:
 *
 *   - Create a new experiment (auto-seeded with control + variant_a).
 *   - Edit name / description / goal_event.
 *   - Add / remove / re-weight variants — while the experiment is a
 *     draft only; the server locks them once it starts (re-weighting a
 *     running test moves visitors between variants).
 *   - Start / Stop transitions (start stamps started_at, stop stamps
 *     stopped_at; assignments freeze when stopped).
 *   - Live results panel: exposed, converted, conversion rate, lift
 *     vs baseline, and z-test confidence.
 *
 * Layout: left column = experiment list, right column = the selected
 * experiment's editor + results. Single round-trip per selection
 * change because the GET endpoint bundles experiment + variants +
 * results into one payload.
 */

const messages = defineMessages({
  en: {
    title: 'A/B testing',
    subtitle: 'Manage experiments, allocate variant weights, and read results attributed via the visitor_events stream.',
    newExperiment: '+ New experiment',
    keySlug: 'Key (slug)',
    name: 'Name',
    namePlaceholder: 'Hero CTA color test',
    goalEvent: 'Goal event',
    create: 'Create',
    noExperiments: 'No experiments yet. Create one to start testing.',
    status_draft: '📝 Draft',
    status_running: '▶️ Running',
    status_stopped: '⏹ Stopped',
    status_done: '✓ Done',
    start: '▶️ Start',
    stop: '⏹ Stop',
    deleteBtn: '🗑 Delete',
    goal: 'goal:',
    started: 'started {date}',
    stopped: 'stopped {date}',
    variants: 'Variants',
    variantsLocked: '🔒 Variants and weights are locked once an experiment has started — changing them would move visitors between variants. Create a new experiment to test a different split.',
    colKey: 'Key',
    colLabel: 'Label',
    colWeight: 'Weight',
    weightOf: 'Weight of {key}',
    removeVariant: 'Remove variant {key}',
    addVariant: '+ Add variant',
    results: 'Results',
    colVariant: 'Variant',
    colExposed: 'Exposed',
    colConverted: 'Converted',
    colRate: 'Rate',
    colLift: 'Lift',
    colConfidence: 'Confidence',
    baseline: '(baseline)',
    pickAbove: 'Pick an experiment above, or create a new one.',
    pickSide: 'Pick an experiment on the left, or create a new one.',
    confirmStart: 'Start "{name}"? Its variants and weights are locked once it is running.',
    confirmStop: 'Stop "{name}"? Visitors stop being assigned to its variants.',
    confirmDelete: 'Delete the experiment "{name}"? Its variants and results will be lost.',
    promptVariantKey: 'Variant key for "{name}" (e.g. "variant_b"):',
    confirmRemoveVariant: 'Remove variant "{key}" from "{name}"?',
    weightInvalid: 'A weight must be a whole number of 0 or more.',
  },
  ar: {
    title: 'اختبارات A/B',
    subtitle: 'أدِر التجارب، ووزّع أوزان النسخ، واطّلع على النتائج المحتسبة من سجل أحداث الزوار visitor_events.',
    newExperiment: '+ تجربة جديدة',
    keySlug: 'المفتاح (slug)',
    name: 'الاسم',
    namePlaceholder: 'تجربة لون زر الدعوة في الواجهة',
    goalEvent: 'حدث الهدف',
    create: 'إنشاء',
    noExperiments: 'لا توجد تجارب بعد. أنشئ تجربة لبدء الاختبار.',
    status_draft: '📝 مسودة',
    status_running: '▶️ قيد التشغيل',
    status_stopped: '⏹ متوقفة',
    status_done: '✓ منتهية',
    start: '▶️ بدء',
    stop: '⏹ إيقاف',
    deleteBtn: '🗑 حذف',
    goal: 'الهدف:',
    started: 'بدأت {date}',
    stopped: 'توقفت {date}',
    variants: 'النسخ',
    variantsLocked: '🔒 تُقفل النسخ وأوزانها بعد بدء التجربة، لأن تغييرها ينقل الزوار بين النسخ. أنشئ تجربة جديدة لاختبار توزيع مختلف.',
    colKey: 'المفتاح',
    colLabel: 'التسمية',
    colWeight: 'الوزن',
    weightOf: 'وزن {key}',
    removeVariant: 'إزالة النسخة {key}',
    addVariant: '+ إضافة نسخة',
    results: 'النتائج',
    colVariant: 'النسخة',
    colExposed: 'المعروضة لهم',
    colConverted: 'المتحوّلون',
    colRate: 'المعدل',
    colLift: 'التحسّن',
    colConfidence: 'الثقة',
    baseline: '(الأساس)',
    pickAbove: 'اختر تجربة من القائمة أعلاه، أو أنشئ تجربة جديدة.',
    pickSide: 'اختر تجربة من القائمة على اليمين، أو أنشئ تجربة جديدة.',
    confirmStart: 'بدء "{name}"؟ تُقفل نسخها وأوزانها بمجرد تشغيلها.',
    confirmStop: 'إيقاف "{name}"؟ سيتوقف توزيع الزوار على نسخها.',
    confirmDelete: 'حذف التجربة "{name}"؟ ستُفقد نسخها ونتائجها.',
    promptVariantKey: 'مفتاح النسخة الجديدة في "{name}" (مثل "variant_b"):',
    confirmRemoveVariant: 'إزالة النسخة "{key}" من "{name}"؟',
    weightInvalid: 'يجب أن يكون الوزن عددًا صحيحًا يساوي 0 أو أكثر.',
  },
});

const STATUS_BADGE: Record<AbExperimentRow['status'], { bg: string; label: 'status_draft' | 'status_running' | 'status_stopped' | 'status_done' }> = {
  draft:   { bg: '#94a3b8', label: 'status_draft' },
  running: { bg: '#22c55e', label: 'status_running' },
  stopped: { bg: '#dc2626', label: 'status_stopped' },
  done:    { bg: '#4f6ef7', label: 'status_done' },
};

type Details = { experiment: AbExperimentRow; variants: AbVariantRow[]; results: AbExperimentResults | null };

export const AdminAbTests: React.FC = () => {
  const t = useT(messages);
  const tc = useT(common);
  const [experiments, setExperiments] = useState<(AbExperimentRow & { variants: AbVariantRow[] })[]>([]);
  const [selectedId, setSelectedIdState] = useState<number | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  // The id whose details may be shown. A response for any other id (the
  // admin clicked on before it arrived) is dropped — it used to land and
  // show experiment A's panel while B was selected, so Delete / Start /
  // Stop acted on B with A on screen.
  const selectedRef = useRef<number | null>(null);
  const isMobile = useIsMobile(767);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create-form state
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('whatsapp_click');

  // Clear the panel on every selection change so the old experiment
  // never sits under the new selection while its details load.
  const setSelectedId = (id: number | null) => {
    if (id === selectedRef.current) return;
    selectedRef.current = id;
    setSelectedIdState(id);
    setDetails(null);
  };

  const reloadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listAbTests();
      setExperiments(res.experiments);
      // Auto-select the first one if nothing is selected.
      if (selectedRef.current == null && res.experiments[0]) setSelectedId(res.experiments[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const reloadDetails = async (id: number) => {
    try {
      const res = await adminApi.getAbTest(id);
      if (selectedRef.current !== id) return;
      setDetails({ experiment: res.experiment, variants: res.variants, results: res.results });
    } catch (e) {
      if (selectedRef.current === id) setError((e as Error).message);
    }
  };

  useEffect(() => { void reloadList(); /* on mount */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (selectedId != null) void reloadDetails(selectedId); }, [selectedId]);

  const handleCreate = async () => {
    if (!newKey.trim() || !newName.trim() || !newGoal.trim()) return;
    try {
      const res = await adminApi.createAbTest({ key: newKey.trim(), name: newName.trim(), goal_event: newGoal.trim() });
      await reloadList();
      setSelectedId(res.experiment.id);
      setShowCreate(false);
      setNewKey(''); setNewName(''); setNewGoal('whatsapp_click');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Every mutation targets the experiment whose panel is on screen
  // (details.experiment), never just the selected id.
  const handleStartStop = async (action: 'start' | 'stop') => {
    if (!details) return;
    const { id, name } = details.experiment;
    if (action === 'start' && !confirm(t('confirmStart', { name }))) return;
    if (action === 'stop' && !confirm(t('confirmStop', { name }))) return;
    try {
      if (action === 'start') await adminApi.startAbTest(id);
      else await adminApi.stopAbTest(id);
      await Promise.all([reloadList(), reloadDetails(id)]);
    } catch (e) { setError((e as Error).message); }
  };

  const handleDeleteExp = async () => {
    if (!details) return;
    const { id, name } = details.experiment;
    if (!confirm(t('confirmDelete', { name }))) return;
    try {
      await adminApi.deleteAbTest(id);
      if (selectedRef.current === id) setSelectedId(null);
      await reloadList();
    } catch (e) { setError((e as Error).message); }
  };

  const handleAddVariant = async () => {
    if (!details) return;
    const { id } = details.experiment;
    const key = prompt(t('promptVariantKey', { name: details.experiment.name }));
    if (!key) return;
    try {
      await adminApi.addAbVariant(id, { variant_key: key.trim(), weight: 25, label: key.trim() });
      await reloadDetails(id);
    } catch (e) { setError((e as Error).message); }
  };
  const handleUpdateWeight = async (variantKey: string, weight: number) => {
    if (!details) return;
    const { id } = details.experiment;
    try {
      await adminApi.updateAbVariant(id, variantKey, { weight });
      await reloadDetails(id);
    } catch (e) { setError((e as Error).message); }
  };
  const handleDeleteVariant = async (variantKey: string) => {
    if (!details) return;
    const { id, name } = details.experiment;
    if (!confirm(t('confirmRemoveVariant', { key: variantKey, name }))) return;
    try {
      await adminApi.deleteAbVariant(id, variantKey);
      await reloadDetails(id);
    } catch (e) { setError((e as Error).message); }
  };

  // Variants are editable only in draft (the server answers 409 otherwise).
  const variantsLocked = details != null && details.experiment.status !== 'draft';

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setShowCreate((v) => !v)}>
          {t('newExperiment')}
        </button>
      </div>

      {showCreate && (
        <div className="adm-card" style={{ marginBottom: 16, padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('keySlug')}</span>
            <input className="adm-input adm-input-sm" dir="ltr" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="hero_cta_color" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('name')}</span>
            <input className="adm-input adm-input-sm" dir="auto" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('namePlaceholder')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('goalEvent')}</span>
            {/* Event identifiers, shown as they are stored. */}
            <select className="adm-select adm-input-sm" dir="ltr" value={newGoal} onChange={(e) => setNewGoal(e.target.value)}>
              <option value="whatsapp_click">whatsapp_click</option>
              <option value="chat_open">chat_open</option>
              <option value="chat_message_sent">chat_message_sent</option>
              <option value="product_view">product_view</option>
              <option value="newsletter_subscribe">newsletter_subscribe</option>
            </select>
          </label>
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={handleCreate}>{t('create')}</button>
        </div>
      )}

      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}
      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '260px minmax(0, 1fr)', gap: 16 }}>
          {/* List */}
          <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
            {experiments.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--adm-text-dim)' }}>
                {t('noExperiments')}
              </div>
            ) : experiments.map((exp) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => setSelectedId(exp.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'start',
                  padding: '10px 12px',
                  background: selectedId === exp.id ? 'var(--adm-surface2)' : 'transparent',
                  border: 0,
                  borderBottom: '1px solid var(--adm-border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{exp.name}</strong>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    color: '#fff',
                    background: STATUS_BADGE[exp.status]?.bg ?? '#666',
                  }}>
                    {STATUS_BADGE[exp.status] ? t(STATUS_BADGE[exp.status].label) : exp.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 2 }}><bdi dir="ltr">{exp.key}</bdi></div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="adm-card" style={{ padding: 16 }}>
            {details ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{details.experiment.name}</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {details.experiment.status === 'draft' && (
                      <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => handleStartStop('start')}>{t('start')}</button>
                    )}
                    {details.experiment.status === 'running' && (
                      <button className="adm-btn adm-btn-warning adm-btn-sm" onClick={() => handleStartStop('stop')}>{t('stop')}</button>
                    )}
                    <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={handleDeleteExp}>{t('deleteBtn')}</button>
                  </div>
                </div>
                <p style={{ color: 'var(--adm-text-dim)', fontSize: 13, marginTop: 4 }}>
                  <code dir="ltr">{details.experiment.key}</code> • {t('goal')} <code dir="ltr">{details.experiment.goal_event}</code>
                  {details.experiment.started_at && <> • {t('started', { date: fmtDateTime(details.experiment.started_at) })}</>}
                  {details.experiment.stopped_at && details.experiment.status !== 'running' && (
                    <> • {t('stopped', { date: fmtDateTime(details.experiment.stopped_at) })}</>
                  )}
                </p>

                <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>{t('variants')}</h3>
                {variantsLocked && (
                  <p style={{ color: 'var(--adm-text-dim)', fontSize: 12, marginTop: 0, marginBottom: 8 }}>
                    {t('variantsLocked')}
                  </p>
                )}
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>{t('colKey')}</th>
                        <th>{t('colLabel')}</th>
                        <th style={{ width: 100 }}>{t('colWeight')}</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.variants.map((v) => (
                        // Keyed by experiment too: experiments share variant
                        // keys ("control", "variant_b"), so switching tests
                        // reused the uncontrolled inputs — they kept showing
                        // the previous test's weights, and blurring one wrote
                        // that stale weight into the newly selected test.
                        <tr key={`${details.experiment.id}:${v.variant_key}`}>
                          <td><code dir="ltr">{v.variant_key}</code></td>
                          <td><bdi>{v.label || '—'}</bdi></td>
                          <td>
                            {variantsLocked ? fmtNumber(v.weight) : (
                              <input
                                // Remount on a server-side change so the field
                                // shows the saved value.
                                key={v.weight}
                                type="number"
                                className="adm-input adm-input-sm"
                                defaultValue={v.weight}
                                min={0}
                                step={1}
                                aria-label={t('weightOf', { key: v.variant_key })}
                                style={{ width: 80 }}
                                onBlur={(e) => {
                                  // An emptied box used to save weight 0
                                  // (Number('') is 0). Only a whole number
                                  // >= 0 is saved; anything else snaps back.
                                  const raw = e.target.value.trim();
                                  const next = Number(raw);
                                  if (raw === '' || !Number.isInteger(next) || next < 0) {
                                    e.target.value = String(v.weight);
                                    if (raw !== '') setError(t('weightInvalid'));
                                    return;
                                  }
                                  if (next !== v.weight) void handleUpdateWeight(v.variant_key, next);
                                }}
                              />
                            )}
                          </td>
                          <td>
                            {!variantsLocked && (
                              <button
                                className="adm-btn adm-btn-danger adm-btn-sm"
                                onClick={() => handleDeleteVariant(v.variant_key)}
                                aria-label={t('removeVariant', { key: v.variant_key })}
                                title={t('removeVariant', { key: v.variant_key })}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!variantsLocked && (
                  <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginTop: 8 }} onClick={handleAddVariant}>{t('addVariant')}</button>
                )}

                {details.results && details.results.results.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>{t('results')}</h3>
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>{t('colVariant')}</th>
                            <th style={{ width: 80 }}>{t('colExposed')}</th>
                            <th style={{ width: 90 }}>{t('colConverted')}</th>
                            <th style={{ width: 90 }}>{t('colRate')}</th>
                            <th style={{ width: 80 }}>{t('colLift')}</th>
                            <th style={{ width: 100 }}>{t('colConfidence')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.results.results.map((r, idx) => (
                            <tr key={r.variant_key}>
                              <td>
                                <strong><bdi>{r.label}</bdi></strong>
                                {idx === 0 && <span style={{ fontSize: 10, color: 'var(--adm-text-dim)', marginInlineStart: 6 }}>{t('baseline')}</span>}
                              </td>
                              <td>{fmtNumber(r.exposed)}</td>
                              <td>{fmtNumber(r.converted)}</td>
                              <td>{(r.rate * 100).toFixed(2)}%</td>
                              <td style={{ color: r.lift > 0 ? '#22c55e' : r.lift < 0 ? '#dc2626' : 'inherit' }}>
                                {/* dir="ltr": a signed number ("+12%") otherwise shows its sign on the wrong side in Arabic. */}
                                {idx === 0 ? '—' : <span dir="ltr">{`${r.lift > 0 ? '+' : ''}${r.lift}%`}</span>}
                              </td>
                              <td>{idx === 0 ? '—' : `${r.confidence}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            ) : selectedId != null ? (
              <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>
            ) : (
              <div style={{ color: 'var(--adm-text-dim)', textAlign: 'center', padding: 32 }}>
                {/* The list sits beside the panel on the reading-start side:
                    left in English, right in Arabic (worded in each message). */}
                {isMobile ? t('pickAbove') : t('pickSide')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

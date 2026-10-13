import React, { useEffect, useRef, useState } from 'react';
import { adminApi, type AbExperimentRow, type AbVariantRow, type AbExperimentResults } from '../utils/adminApi';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { AdminIcon, Alert, Badge, Button, Card, EmptyState, Field, IconButton, Loading, NumberInput, PageHeader, StatusBadge } from '../ui';

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
    newExperiment: 'New experiment',
    keySlug: 'Key (slug)',
    name: 'Name',
    namePlaceholder: 'Hero CTA color test',
    goalEvent: 'Goal event',
    create: 'Create',
    colExperiment: 'Experiment',
    noExperiments: 'No experiments yet.',
    noExperimentsText: 'Create one to start testing.',
    // StatusBadge words, except where the experiment needs its own:
    // "stopped" is feminine in Arabic (تجربة), "done" has no shared status.
    status_stopped: 'Stopped',
    status_done: 'Done',
    start: 'Start',
    stop: 'Stop',
    goal: 'goal:',
    started: 'started {date}',
    stopped: 'stopped {date}',
    variants: 'Variants',
    variantsLocked: 'Variants and weights are locked once an experiment has started — changing them would move visitors between variants. Create a new experiment to test a different split.',
    colKey: 'Key',
    colLabel: 'Label',
    colWeight: 'Weight',
    weightOf: 'Weight of {key}',
    removeVariant: 'Remove variant {key}',
    addVariant: 'Add variant',
    results: 'Results',
    colVariant: 'Variant',
    colExposed: 'Exposed',
    colConverted: 'Converted',
    colRate: 'Rate',
    colLift: 'Lift',
    colConfidence: 'Confidence',
    baseline: 'Baseline',
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
    newExperiment: 'تجربة جديدة',
    keySlug: 'المفتاح (slug)',
    name: 'الاسم',
    namePlaceholder: 'تجربة لون زر الدعوة في الواجهة',
    goalEvent: 'حدث الهدف',
    create: 'إنشاء',
    colExperiment: 'التجربة',
    noExperiments: 'لا توجد تجارب بعد.',
    noExperimentsText: 'أنشئ تجربة لبدء الاختبار.',
    status_stopped: 'متوقفة',
    status_done: 'منتهية',
    start: 'بدء',
    stop: 'إيقاف',
    goal: 'الهدف:',
    started: 'بدأت {date}',
    stopped: 'توقفت {date}',
    variants: 'النسخ',
    variantsLocked: 'تُقفل النسخ وأوزانها بعد بدء التجربة، لأن تغييرها ينقل الزوار بين النسخ. أنشئ تجربة جديدة لاختبار توزيع مختلف.',
    colKey: 'المفتاح',
    colLabel: 'التسمية',
    colWeight: 'الوزن',
    weightOf: 'وزن {key}',
    removeVariant: 'إزالة النسخة {key}',
    addVariant: 'إضافة نسخة',
    results: 'النتائج',
    colVariant: 'النسخة',
    colExposed: 'المعروضة لهم',
    colConverted: 'المتحوّلون',
    colRate: 'المعدل',
    colLift: 'التحسّن',
    colConfidence: 'الثقة',
    baseline: 'الأساس',
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

type Details = { experiment: AbExperimentRow; variants: AbVariantRow[]; results: AbExperimentResults | null };

export const AdminAbTests: React.FC = () => {
  const t = useT(messages);
  const tc = useT(common);

  const statusBadge = (status: AbExperimentRow['status']) => {
    switch (status) {
      case 'draft':
      case 'running':
        return <StatusBadge status={status} />;
      case 'stopped':
        return <StatusBadge status="stopped" label={t('status_stopped')} />;
      case 'done':
        return <StatusBadge status="done" label={t('status_done')} />;
      default:
        // A status this build doesn't know yet: show it as stored.
        return <Badge>{String(status)}</Badge>;
    }
  };

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
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={(
          // One primary action per view: while the form is open, its
          // Create button is the primary one.
          <Button
            variant={showCreate ? 'secondary' : 'primary'}
            icon="plus"
            aria-expanded={showCreate}
            onClick={() => setShowCreate((v) => !v)}
          >
            {t('newExperiment')}
          </Button>
        )}
      />

      {showCreate && (
        <Card title={t('newExperiment')} icon="abtest" className="adm-mb-16">
          <div className="adm-form-grid">
            <Field label={t('keySlug')}>
              <input className="adm-input" dir="ltr" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="hero_cta_color" />
            </Field>
            <Field label={t('name')}>
              <input className="adm-input" dir="auto" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('namePlaceholder')} />
            </Field>
            <Field label={t('goalEvent')}>
              {/* Event identifiers, shown as they are stored. */}
              <select className="adm-select" dir="ltr" value={newGoal} onChange={(e) => setNewGoal(e.target.value)}>
                <option value="whatsapp_click">whatsapp_click</option>
                <option value="chat_open">chat_open</option>
                <option value="chat_message_sent">chat_message_sent</option>
                <option value="product_view">product_view</option>
                <option value="newsletter_subscribe">newsletter_subscribe</option>
              </select>
            </Field>
          </div>
          <div className="adm-flex">
            <Button variant="primary" icon="check" onClick={handleCreate}>{t('create')}</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>{tc('cancel')}</Button>
          </div>
        </Card>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <Loading label={tc('loading')} />}

      {/* No experiments yet: one empty state, not an empty list beside an
          empty detail panel. */}
      {!loading && !error && experiments.length === 0 && (
        <Card>
          <EmptyState icon="abtest" title={t('noExperiments')} text={t('noExperimentsText')} />
        </Card>
      )}

      {!loading && experiments.length > 0 && (
        <div className="adm-master-detail">
          {/* List */}
          <Card flush>
            <div className="adm-select-list" role="list" aria-label={t('colExperiment')}>
              {experiments.map((exp) => {
                const selected = selectedId === exp.id;
                return (
                  <button
                    key={exp.id}
                    type="button"
                    role="listitem"
                    className={`adm-select-item${selected ? ' is-selected' : ''}`}
                    aria-current={selected || undefined}
                    onClick={() => setSelectedId(exp.id)}
                  >
                    <span style={{ minWidth: 0 }}>
                      <bdi className="adm-truncate" style={{ display: 'block' }}>{exp.name}</bdi>
                      <span className="adm-mono adm-text-muted adm-text-sm"><bdi dir="ltr">{exp.key}</bdi></span>
                    </span>
                    {statusBadge(exp.status)}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Detail */}
          {details ? (
            <div className="adm-stack">
              <Card
                title={details.experiment.name}
                icon="abtest"
                subtitle={<bdi dir="ltr" className="adm-mono">{details.experiment.key}</bdi>}
                actions={(
                  <>
                    {details.experiment.status === 'draft' && (
                      <Button size="sm" icon="play" onClick={() => handleStartStop('start')}>{t('start')}</Button>
                    )}
                    {details.experiment.status === 'running' && (
                      <Button size="sm" icon="stop" onClick={() => handleStartStop('stop')}>{t('stop')}</Button>
                    )}
                    <Button size="sm" variant="danger" icon="trash" onClick={handleDeleteExp}>{tc('delete')}</Button>
                  </>
                )}
              >
                <div className="adm-flex" style={{ flexWrap: 'wrap' }}>
                  {statusBadge(details.experiment.status)}
                  <Badge icon="target">
                    {t('goal')} <bdi dir="ltr">{details.experiment.goal_event}</bdi>
                  </Badge>
                  {details.experiment.started_at && (
                    <Badge icon="calendar">{t('started', { date: fmtDateTime(details.experiment.started_at) })}</Badge>
                  )}
                  {details.experiment.stopped_at && details.experiment.status !== 'running' && (
                    <Badge icon="calendar">{t('stopped', { date: fmtDateTime(details.experiment.stopped_at) })}</Badge>
                  )}
                </div>
              </Card>

              <Card
                flush
                title={t('variants')}
                icon="sort"
                subtitle={variantsLocked ? <><AdminIcon name="lock" size="xs" /> {t('variantsLocked')}</> : undefined}
                actions={!variantsLocked && (
                  <Button size="sm" icon="plus" onClick={handleAddVariant}>{t('addVariant')}</Button>
                )}
              >
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>{t('colKey')}</th>
                        <th>{t('colLabel')}</th>
                        <th style={{ width: 110 }}>{t('colWeight')}</th>
                        {!variantsLocked && (
                          <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                        )}
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
                          <td className="adm-mono adm-cell-ltr">{v.variant_key}</td>
                          <td><bdi>{v.label || '—'}</bdi></td>
                          <td>
                            {variantsLocked ? fmtNumber(v.weight) : (
                              <NumberInput
                                // Remount on a server-side change so the field
                                // shows the saved value.
                                key={v.weight}
                                className="adm-input adm-input-sm"
                                defaultValue={v.weight}
                                min={0}
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
                          {!variantsLocked && (
                            <td className="adm-col-actions">
                              <div className="adm-row-actions">
                                <IconButton
                                  icon="trash"
                                  tone="danger"
                                  size="sm"
                                  label={t('removeVariant', { key: v.variant_key })}
                                  onClick={() => handleDeleteVariant(v.variant_key)}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {details.results && details.results.results.length > 0 && (
                <Card flush title={t('results')} icon="insights">
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>{t('colVariant')}</th>
                          <th style={{ width: 90 }}>{t('colExposed')}</th>
                          <th style={{ width: 100 }}>{t('colConverted')}</th>
                          <th style={{ width: 90 }}>{t('colRate')}</th>
                          <th style={{ width: 90 }}>{t('colLift')}</th>
                          <th style={{ width: 100 }}>{t('colConfidence')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.results.results.map((r, idx) => (
                          <tr key={r.variant_key}>
                            <td>
                              <div className="adm-flex">
                                <strong><bdi>{r.label}</bdi></strong>
                                {idx === 0 && <Badge>{t('baseline')}</Badge>}
                              </div>
                            </td>
                            <td>{fmtNumber(r.exposed)}</td>
                            <td>{fmtNumber(r.converted)}</td>
                            <td>{(r.rate * 100).toFixed(2)}%</td>
                            <td>
                              {idx === 0 ? '—' : (
                                <Badge tone={r.lift > 0 ? 'success' : r.lift < 0 ? 'danger' : 'neutral'}>
                                  {/* dir="ltr": a signed number ("+12%") otherwise shows its sign on the wrong side in Arabic. */}
                                  <span dir="ltr">{`${r.lift > 0 ? '+' : ''}${r.lift}%`}</span>
                                </Badge>
                              )}
                            </td>
                            <td>{idx === 0 ? '—' : `${r.confidence}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          ) : selectedId != null ? (
            <Card><Loading label={tc('loading')} /></Card>
          ) : (
            <Card>
              {/* The list sits beside the panel on the reading-start side:
                  left in English, right in Arabic (worded in each message). */}
              <EmptyState icon="abtest" title={isMobile ? t('pickAbove') : t('pickSide')} compact />
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

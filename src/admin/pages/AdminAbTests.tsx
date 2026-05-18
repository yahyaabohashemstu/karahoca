import React, { useEffect, useState } from 'react';
import { adminApi, type AbExperimentRow, type AbVariantRow, type AbExperimentResults } from '../utils/adminApi';

/**
 * A/B testing dashboard (Phase G4).
 *
 * A single-page admin for the whole experiment lifecycle:
 *
 *   - Create a new experiment (auto-seeded with control + variant_a).
 *   - Edit name / description / goal_event.
 *   - Add / remove / re-weight variants.
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

const STATUS_BADGE: Record<AbExperimentRow['status'], { bg: string; label: string }> = {
  draft:   { bg: '#94a3b8', label: '📝 Draft' },
  running: { bg: '#22c55e', label: '▶️ Running' },
  stopped: { bg: '#dc2626', label: '⏹ Stopped' },
  done:    { bg: '#4f6ef7', label: '✓ Done' },
};

export const AdminAbTests: React.FC = () => {
  const [experiments, setExperiments] = useState<(AbExperimentRow & { variants: AbVariantRow[] })[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<{ experiment: AbExperimentRow; variants: AbVariantRow[]; results: AbExperimentResults | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create-form state
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('whatsapp_click');

  const reloadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listAbTests();
      setExperiments(res.experiments);
      // Auto-select the first one if nothing is selected.
      if (selectedId == null && res.experiments[0]) setSelectedId(res.experiments[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const reloadDetails = async (id: number) => {
    try {
      const res = await adminApi.getAbTest(id);
      setDetails({ experiment: res.experiment, variants: res.variants, results: res.results });
    } catch (e) {
      setError((e as Error).message);
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

  const handleStartStop = async (action: 'start' | 'stop') => {
    if (!selectedId) return;
    try {
      if (action === 'start') await adminApi.startAbTest(selectedId);
      else await adminApi.stopAbTest(selectedId);
      await Promise.all([reloadList(), reloadDetails(selectedId)]);
    } catch (e) { setError((e as Error).message); }
  };

  const handleDeleteExp = async () => {
    if (!selectedId || !confirm('Delete this experiment? Variants and assignment history will be lost.')) return;
    try {
      await adminApi.deleteAbTest(selectedId);
      setSelectedId(null);
      setDetails(null);
      await reloadList();
    } catch (e) { setError((e as Error).message); }
  };

  const handleAddVariant = async () => {
    if (!selectedId) return;
    const key = prompt('Variant key (e.g. "variant_b"):');
    if (!key) return;
    try {
      await adminApi.addAbVariant(selectedId, { variant_key: key.trim(), weight: 25, label: key.trim() });
      await reloadDetails(selectedId);
    } catch (e) { setError((e as Error).message); }
  };
  const handleUpdateWeight = async (variantKey: string, weight: number) => {
    if (!selectedId) return;
    try {
      await adminApi.updateAbVariant(selectedId, variantKey, { weight });
      await reloadDetails(selectedId);
    } catch (e) { setError((e as Error).message); }
  };
  const handleDeleteVariant = async (variantKey: string) => {
    if (!selectedId) return;
    if (!confirm(`Remove variant "${variantKey}"?`)) return;
    try {
      await adminApi.deleteAbVariant(selectedId, variantKey);
      await reloadDetails(selectedId);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">A/B testing</h1>
          <p className="adm-page-subtitle">
            Manage experiments, allocate variant weights, and read results attributed via the visitor_events stream.
          </p>
        </div>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setShowCreate((v) => !v)}>
          + New experiment
        </button>
      </div>

      {showCreate && (
        <div className="adm-card" style={{ marginBottom: 16, padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Key (slug)</span>
            <input className="adm-input adm-input-sm" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="hero_cta_color" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Name</span>
            <input className="adm-input adm-input-sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Hero CTA color test" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Goal event</span>
            <select className="adm-input adm-input-sm" value={newGoal} onChange={(e) => setNewGoal(e.target.value)}>
              <option value="whatsapp_click">whatsapp_click</option>
              <option value="chat_open">chat_open</option>
              <option value="chat_message_sent">chat_message_sent</option>
              <option value="product_view">product_view</option>
              <option value="newsletter_subscribe">newsletter_subscribe</option>
            </select>
          </label>
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={handleCreate}>Create</button>
        </div>
      )}

      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}
      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading…</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* List */}
          <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
            {experiments.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--adm-text-dim)' }}>
                No experiments yet. Create one to start testing.
              </div>
            ) : experiments.map((exp) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => setSelectedId(exp.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
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
                    {STATUS_BADGE[exp.status]?.label ?? exp.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 2 }}>{exp.key}</div>
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
                      <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => handleStartStop('start')}>▶️ Start</button>
                    )}
                    {details.experiment.status === 'running' && (
                      <button className="adm-btn adm-btn-warning adm-btn-sm" onClick={() => handleStartStop('stop')}>⏹ Stop</button>
                    )}
                    <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={handleDeleteExp}>🗑 Delete</button>
                  </div>
                </div>
                <p style={{ color: 'var(--adm-text-dim)', fontSize: 13, marginTop: 4 }}>
                  <code>{details.experiment.key}</code> • goal: <code>{details.experiment.goal_event}</code>
                </p>

                <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>Variants</h3>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Label</th>
                        <th style={{ width: 100 }}>Weight</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.variants.map((v) => (
                        <tr key={v.variant_key}>
                          <td><code>{v.variant_key}</code></td>
                          <td>{v.label || '—'}</td>
                          <td>
                            <input
                              type="number"
                              className="adm-input adm-input-sm"
                              defaultValue={v.weight}
                              min={0}
                              style={{ width: 80 }}
                              onBlur={(e) => {
                                const next = Number(e.target.value);
                                if (Number.isFinite(next) && next !== v.weight) {
                                  void handleUpdateWeight(v.variant_key, next);
                                }
                              }}
                            />
                          </td>
                          <td>
                            <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => handleDeleteVariant(v.variant_key)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginTop: 8 }} onClick={handleAddVariant}>+ Add variant</button>

                {details.results && details.results.results.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>Results</h3>
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Variant</th>
                            <th style={{ width: 80 }}>Exposed</th>
                            <th style={{ width: 90 }}>Converted</th>
                            <th style={{ width: 90 }}>Rate</th>
                            <th style={{ width: 80 }}>Lift</th>
                            <th style={{ width: 100 }}>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.results.results.map((r, idx) => (
                            <tr key={r.variant_key}>
                              <td>
                                <strong>{r.label}</strong>
                                {idx === 0 && <span style={{ fontSize: 10, color: 'var(--adm-text-dim)', marginLeft: 6 }}>(baseline)</span>}
                              </td>
                              <td>{r.exposed.toLocaleString()}</td>
                              <td>{r.converted.toLocaleString()}</td>
                              <td>{(r.rate * 100).toFixed(2)}%</td>
                              <td style={{ color: r.lift > 0 ? '#22c55e' : r.lift < 0 ? '#dc2626' : 'inherit' }}>
                                {idx === 0 ? '—' : `${r.lift > 0 ? '+' : ''}${r.lift}%`}
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
            ) : (
              <div style={{ color: 'var(--adm-text-dim)', textAlign: 'center', padding: 32 }}>
                Pick an experiment on the left, or create a new one.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

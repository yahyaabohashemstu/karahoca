import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';

const STATUS_COLOR: Record<string, string> = {
  draft: '#f59e0b', scheduled: '#4f6ef7', sent: '#22c55e',
};
const STATUS_ICON: Record<string, string> = {
  draft: '✏️', scheduled: '🕐', sent: '✅',
};
const TPL_LABEL: Record<string, string> = {
  custom: 'Custom', new_product: '🧴 New Product', offer: '🏷️ Special Offer', news: '📰 Company News',
};

export const AdminCampaigns: React.FC = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.getCampaigns(), []);
  const [sending, setSending] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this campaign?')) return;
    await adminApi.deleteCampaign(id);
    reload();
  };

  const handleSend = async (id: number) => {
    if (!confirm('Send this campaign to ALL active subscribers now?')) return;
    setSending(id); setMsg('');
    try {
      const res = await adminApi.sendCampaign(id);
      setMsg(`✅ Sent to ${res.sent} subscribers!`);
      reload();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Send failed'}`);
    } finally { setSending(null); }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Email Campaigns</h1>
          <p className="adm-page-subtitle">Compose, schedule & send newsletters to all subscribers</p>
        </div>
        <Link to="/admin/campaigns/new" className="adm-btn adm-btn-primary">
          ✉️ New Campaign
        </Link>
      </div>

      {msg && (
        <div className={`adm-alert ${msg.startsWith('✅') ? 'adm-alert-success' : 'adm-alert-error'}`}
             style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /></div>}
      {error   && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          {data?.campaigns && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total',     value: data.campaigns.length,                              color: 'var(--adm-accent)' },
                { label: 'Drafts',    value: data.campaigns.filter(c => c.status === 'draft').length,    color: '#f59e0b' },
                { label: 'Scheduled', value: data.campaigns.filter(c => c.status === 'scheduled').length, color: '#4f6ef7' },
                { label: 'Sent',      value: data.campaigns.filter(c => c.status === 'sent').length,     color: '#22c55e' },
                { label: 'Opens',     value: data.campaigns.reduce((s, c) => s + c.open_count, 0),       color: '#8b5cf6' },
              ].map(card => (
                <div key={card.label} className="adm-stat-card" style={{ padding: '16px 18px' }}>
                  <div className="adm-stat-label">{card.label}</div>
                  <div className="adm-stat-value" style={{ color: card.color, fontSize: 24 }}>{card.value}</div>
                </div>
              ))}
            </div>
          )}

          {!data?.campaigns?.length ? (
            <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <p className="adm-text-muted">No campaigns yet.</p>
              <Link to="/admin/campaigns/new" className="adm-btn adm-btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
                Create Your First Campaign
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data!.campaigns.map(c => (
                <div key={c.id} style={{
                  background: 'var(--adm-surface)', border: '1px solid var(--adm-border)',
                  borderRadius: 12, padding: '18px 20px',
                  borderLeft: `3px solid ${STATUS_COLOR[c.status] || 'var(--adm-border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{STATUS_ICON[c.status]}</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--adm-text)' }}>{c.title}</span>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: `${STATUS_COLOR[c.status]}22`, color: STATUS_COLOR[c.status],
                          fontWeight: 600, textTransform: 'capitalize',
                        }}>{c.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        <span>{TPL_LABEL[c.template_type] || c.template_type}</span>
                        <span>Created: {fmtDate(c.created_at)}</span>
                        {c.sent_at && <span style={{ color: '#22c55e' }}>Sent: {fmtDate(c.sent_at)}</span>}
                        {c.scheduled_at && c.status === 'scheduled' && (
                          <span style={{ color: '#4f6ef7' }}>Scheduled: {new Date(c.scheduled_at).toLocaleString()}</span>
                        )}
                        {c.status === 'sent' && (
                          <>
                            <span>👥 {c.recipient_count} recipients</span>
                            <span>👁 {c.open_count} opens
                              {c.recipient_count > 0 && (
                                <span style={{ color: '#22c55e', marginLeft: 4 }}>
                                  ({Math.round((c.open_count / c.recipient_count) * 100)}%)
                                </span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {c.status === 'sent' && (
                        <Link to={`/admin/campaigns/${c.id}?tab=stats`}
                              className="adm-btn adm-btn-sm"
                              style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)' }}>
                          📊 Stats
                        </Link>
                      )}
                      {c.status !== 'sent' && (
                        <button
                          className="adm-btn adm-btn-sm adm-btn-primary"
                          onClick={() => handleSend(c.id)}
                          disabled={sending === c.id}
                        >
                          {sending === c.id ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> Sending…</> : '🚀 Send Now'}
                        </button>
                      )}
                      <Link to={`/admin/campaigns/${c.id}`} className="adm-btn adm-btn-sm">✏️ Edit</Link>
                      <button className="adm-btn adm-btn-sm adm-btn-danger" onClick={() => handleDelete(c.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime } from '../utils/dateUtils';

export const AdminChatDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useAsync(
    () => adminApi.getChatUser(decodeURIComponent(userId!)),
    [userId]
  );

  const handleDelete = async () => {
    if (!confirm('Delete all messages from this user?')) return;
    try {
      await adminApi.deleteChatUser(decodeURIComponent(userId!));
      navigate('/admin/chats');
    } catch {
      alert('Failed to delete user');
    }
  };

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;
  if (error) return <div className="adm-alert adm-alert-error">⚠ {error}</div>;

  const user = data?.user;
  const messages = data?.messages ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/chats" className="adm-btn adm-btn-ghost adm-btn-sm">← Back</Link>
          <div>
            <h1 className="adm-page-title" style={{ fontFamily: 'monospace', fontSize: 16 }}>
              {user?.id}
            </h1>
            <p className="adm-page-subtitle">
              <span className="adm-badge adm-badge-blue" style={{ marginRight: 8 }}>{user?.language}</span>
              {user?.message_count} messages · First seen {user?.first_seen ? fmtDate(user.first_seen) : '—'}
            </p>
          </div>
        </div>
        <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={handleDelete}>
          🗑 Delete User
        </button>
      </div>

      <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--adm-border)' }}>
          <span className="adm-card-title">Conversation</span>
          <span className="adm-text-muted adm-text-sm" style={{ marginLeft: 12 }}>
            {messages.length} messages
          </span>
        </div>

        {/* Messages */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: '68vh',
          overflowY: 'auto',
          padding: '20px 16px',
          background: 'var(--adm-bg)',
        }}>
          {messages.length === 0 ? (
            <p className="adm-text-muted adm-text-sm" style={{ textAlign: 'center', padding: 32 }}>
              No messages found.
            </p>
          ) : messages.map(msg => (
            <div
              key={msg.id}
              className={`adm-chat-row adm-chat-row-${msg.role}`}
            >
              <div className={`adm-chat-bubble adm-chat-${msg.role}`}>
                {/* Meta: time + lang */}
                <div className="adm-chat-meta">
                  {msg.role === 'assistant' && <span>🤖 Bot</span>}
                  {msg.language && (
                    <span style={{
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: 4,
                      padding: '0 5px',
                    }}>
                      {msg.language}
                    </span>
                  )}
                  <span>{fmtDateTime(msg.created_at)}</span>
                  {msg.role === 'user' && <span>User 👤</span>}
                </div>
                {/* Content */}
                <div className="adm-chat-content">{msg.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

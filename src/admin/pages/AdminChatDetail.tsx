import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

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
              {user?.message_count} messages · First seen {user?.first_seen ? new Date(user.first_seen).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
        <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={handleDelete}>
          🗑 Delete User
        </button>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Conversation</div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto', padding: '0 4px' }}>
          {messages.length === 0 ? (
            <p className="adm-text-muted adm-text-sm">No messages found.</p>
          ) : messages.map(msg => (
            <div key={msg.id} className={`adm-chat-bubble adm-chat-${msg.role}`}>
              <div className="adm-chat-meta">
                <span className={`adm-badge ${msg.role === 'user' ? 'adm-badge-blue' : 'adm-badge-green'}`}>
                  {msg.role === 'user' ? '👤 User' : '🤖 Assistant'}
                </span>
                <span className="adm-text-muted adm-text-sm">{new Date(msg.created_at).toLocaleString()}</span>
                {msg.language && <span className="adm-badge">{msg.language}</span>}
              </div>
              <div className="adm-chat-content">{msg.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

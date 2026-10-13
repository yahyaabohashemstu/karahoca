import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime } from '../utils/dateUtils';

// Assistant replies are Markdown (the visitor's widget renders them), so the
// admin showed raw "**KARAHOCA**" and "[+90…](https://wa.me/…)". Rendered
// without rehype-raw: any HTML in a message stays inert text, and
// react-markdown's default URL filter drops javascript: links.
const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

export const AdminChatDetail: React.FC = () => {
  // useParams already decodes; decoding again threw "URI malformed" for an
  // id containing "%" (ids are client-supplied).
  const { userId = '' } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getChatUser(userId),
    [userId]
  );

  const handleDelete = async () => {
    if (!confirm(`Delete this visitor's whole conversation (${data?.messages.length ?? 0} messages)? This cannot be undone.`)) return;
    setDeleteError('');
    try {
      await adminApi.deleteChatUser(userId);
      navigate('/admin/chats');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete the conversation');
    }
  };

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;
  if (error) {
    return (
      <div>
        <Link to="/admin/chats" className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginBottom: 16 }}>← Back to chats</Link>
        <div className="adm-alert adm-alert-error">⚠ {error}</div>
      </div>
    );
  }

  const user = data?.user;
  const messages = data?.messages ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Link to="/admin/chats" className="adm-btn adm-btn-ghost adm-btn-sm">← Back</Link>
          <div style={{ minWidth: 0 }}>
            <h1 className="adm-page-title adm-chat-title">{user?.id}</h1>
            <p className="adm-page-subtitle">
              <span className="adm-badge adm-badge-blue" style={{ marginRight: 8 }}>{user?.language}</span>
              {messages.length} messages · First seen {fmtDateTime(user?.first_seen)} · Last active {fmtDateTime(user?.last_seen)}
            </p>
          </div>
        </div>
        <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={handleDelete}>
          🗑 Delete conversation
        </button>
      </div>

      {deleteError && <div className="adm-alert adm-alert-error" role="alert">⚠ {deleteError}</div>}

      <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--adm-border)' }}>
          <span className="adm-card-title">Conversation</span>
          <span className="adm-text-muted adm-text-sm" style={{ marginLeft: 12 }}>
            {messages.length} messages
          </span>
        </div>

        {/* Messages */}
        <div className="adm-chat-thread adm-chat-thread-page">
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
                <div className="adm-chat-meta">
                  <strong>{msg.role === 'assistant' ? 'Assistant' : 'Visitor'}</strong>
                  {msg.language && <span className="adm-chat-lang">{msg.language}</span>}
                  <span>{fmtDateTime(msg.created_at)}</span>
                </div>
                {/* dir="auto": Arabic messages in this left-to-right page put
                    their punctuation and Latin brand names on the wrong side. */}
                <div className="adm-chat-content" dir="auto">
                  {msg.role === 'assistant' ? (
                    <div className="adm-chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

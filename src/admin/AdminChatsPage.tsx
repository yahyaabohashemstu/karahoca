import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminChatUsers,
  getAdminConversationMessages,
  getAdminUserConversations
} from '../utils/adminApi';
import { clearAdminToken } from '../utils/adminAuth';

type ChatUser = {
  id: string;
  conversation_count: string;
  message_count: string;
  last_seen_at: string;
};

type Conversation = {
  id: string;
  created_at: string;
  last_message_at: string;
};

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

function AdminChatsPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminChatUsers();
      setUsers(response.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users.';
      setError(message);
      if (message.toLowerCase().includes('unauthorized')) {
        clearAdminToken();
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openUserConversations = async (userId: string) => {
    setSelectedUserId(userId);
    setSelectedConversationId('');
    setMessages([]);
    setError('');
    try {
      const response = await getAdminUserConversations(userId);
      setConversations(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations.');
    }
  };

  const openConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setError('');
    try {
      const response = await getAdminConversationMessages(conversationId);
      setMessages(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages.');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Admin Chats</h1>
      <button onClick={() => navigate('/admin/products')}>Go to Products</button>
      <button onClick={() => navigate('/admin/news')} style={{ marginInlineStart: 8 }}>
        Go to News
      </button>
      {error && <p style={{ color: '#d32f2f' }}>{error}</p>}
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 12, marginTop: 16 }}>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10 }}>
            <h3>Users</h3>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => openUserConversations(u.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8 }}
              >
                {u.id}
                <br />
                conv: {u.conversation_count} | msg: {u.message_count}
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10 }}>
            <h3>Conversations</h3>
            <p>User: {selectedUserId || '-'}</p>
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8 }}
              >
                {c.id}
                <br />
                last: {new Date(c.last_message_at).toLocaleString()}
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10 }}>
            <h3>Messages</h3>
            <p>Conversation: {selectedConversationId || '-'}</p>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #eee' }}>
                <b>{m.role}</b> - {new Date(m.created_at).toLocaleString()}
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminChatsPage;

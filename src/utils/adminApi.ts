import { buildApiUrl } from './api';
import { getAdminToken } from './adminAuth';

const getHeaders = () => {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {})
  };
};

const readJson = async (response: Response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Request failed.');
  }
  return payload;
};

export const adminLogin = async (email: string, password: string) => {
  const response = await fetch(buildApiUrl('/admin/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return readJson(response);
};

export const getAdminProducts = async () => {
  const response = await fetch(buildApiUrl('/admin/products'), {
    method: 'GET',
    headers: getHeaders()
  });
  return readJson(response);
};

export const updateAdminProduct = async (
  id: number,
  payload: {
    slug?: string;
    status?: 'draft' | 'published';
    scheduledAt?: string | null;
    translations?: Array<{ lang: string; name: string; description: string }>;
  }
) => {
  const response = await fetch(buildApiUrl('/admin/products/' + id), {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
};

export const deleteAdminProduct = async (id: number) => {
  const response = await fetch(buildApiUrl('/admin/products/' + id), {
    method: 'DELETE',
    headers: getHeaders()
  });
  return readJson(response);
};

export const createAdminProduct = async (payload: {
  slug: string;
  sourceLang: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  scheduledAt?: string | null;
}) => {
  const response = await fetch(buildApiUrl('/admin/products'), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
};

export const getAdminChatUsers = async () => {
  const response = await fetch(buildApiUrl('/admin/chats/users'), {
    method: 'GET',
    headers: getHeaders()
  });
  return readJson(response);
};

export const getAdminNews = async () => {
  const response = await fetch(buildApiUrl('/admin/news'), {
    method: 'GET',
    headers: getHeaders()
  });
  return readJson(response);
};

export const createAdminNews = async (payload: {
  slug: string;
  sourceLang: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  scheduledAt?: string | null;
}) => {
  const response = await fetch(buildApiUrl('/admin/news'), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
};

export const updateAdminNews = async (
  id: number,
  payload: {
    slug?: string;
    status?: 'draft' | 'published';
    scheduledAt?: string | null;
    translations?: Array<{ lang: string; title: string; content: string }>;
  }
) => {
  const response = await fetch(buildApiUrl('/admin/news/' + id), {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
};

export const deleteAdminNews = async (id: number) => {
  const response = await fetch(buildApiUrl('/admin/news/' + id), {
    method: 'DELETE',
    headers: getHeaders()
  });
  return readJson(response);
};

export const getAdminUserConversations = async (userId: string) => {
  const response = await fetch(
    buildApiUrl('/admin/chats/users/' + encodeURIComponent(userId) + '/conversations'),
    {
      method: 'GET',
      headers: getHeaders()
    }
  );
  return readJson(response);
};

export const getAdminConversationMessages = async (conversationId: string) => {
  const response = await fetch(
    buildApiUrl('/admin/chats/conversations/' + encodeURIComponent(conversationId) + '/messages'),
    {
      method: 'GET',
      headers: getHeaders()
    }
  );
  return readJson(response);
};

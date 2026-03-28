import { buildApiUrl } from '../../utils/api';

const TOKEN_KEY = 'karahoca_admin_token';

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized.padEnd(normalized.length + (4 - padding), '=') : normalized;
  return window.atob(padded);
};

const parseTokenPayload = (token: string): { exp?: number; role?: string } | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as { exp?: number; role?: string };
  } catch {
    return null;
  }
};

const isTokenUsable = (token: string | null) => {
  if (!token) return false;
  const payload = parseTokenPayload(token);
  if (!payload) return false;
  if (payload.role && payload.role !== 'admin') return false;
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return false;
  return true;
};

const readStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const getToken = (): string | null => {
  const token = readStoredToken();
  if (!isTokenUsable(token)) {
    clearToken();
    return null;
  }
  return token;
};
export const hasValidToken = () => !!getToken();
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);

const authHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});
const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = '/admin';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({})) as T & { success?: boolean; error?: string };

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${response.status})`);
  }

  return data;
};

export const adminApi = {
  login: (username: string, password: string) =>
    request<{ success: boolean; token: string }>('POST', '/api/admin/login', { username, password }),

  getStats: () => request<AdminStats>('GET', '/api/admin/stats'),

  getAnalytics: () => request<AdminAnalytics>('GET', '/api/admin/analytics'),

  getGaData: () => request<GaData>('GET', '/api/admin/ga'),

  // Chats
  getChats: (params?: { page?: number; lang?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.lang) q.set('lang', params.lang);
    return request<ChatListResponse>('GET', `/api/admin/chats?${q}`);
  },
  getChatUser: (userId: string) =>
    request<{ success: boolean; user: ChatUser; messages: ChatMessage[] }>('GET', `/api/admin/chats/${encodeURIComponent(userId)}`),
  deleteChatUser: (userId: string) =>
    request<{ success: boolean }>('DELETE', `/api/admin/chats/${encodeURIComponent(userId)}`),

  // Products
  getProducts: (brand?: string, all = false) => {
    const q = new URLSearchParams();
    if (brand) q.set('brand', brand);
    if (all) q.set('all', '1');
    return request<{ success: boolean; products: Product[] }>('GET', `/api/admin/products?${q}`);
  },
  getProduct: (id: string) =>
    request<{ success: boolean; product: Product }>('GET', `/api/admin/products/${encodeURIComponent(id)}`),
  createProduct: (data: Partial<Product>) =>
    request<{ success: boolean; product: Product }>('POST', '/api/admin/products', data),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<{ success: boolean; product: Product }>('PUT', `/api/admin/products/${encodeURIComponent(id)}`, data),
  deleteProduct: (id: string) =>
    request<{ success: boolean }>('DELETE', `/api/admin/products/${encodeURIComponent(id)}`),

  // Categories
  getCategories: (brand?: string) => {
    const q = brand ? `?brand=${brand}` : '';
    return request<{ success: boolean; categories: ProductCategory[] }>('GET', `/api/admin/categories${q}`);
  },
  createCategory: (data: Partial<ProductCategory>) =>
    request<{ success: boolean; category: ProductCategory }>('POST', '/api/admin/categories', data),
  updateCategory: (id: string, data: Partial<ProductCategory>) =>
    request<{ success: boolean; category: ProductCategory }>('PUT', `/api/admin/categories/${encodeURIComponent(id)}`, data),
  deleteCategory: (id: string) =>
    request<{ success: boolean }>('DELETE', `/api/admin/categories/${encodeURIComponent(id)}`),

  // News
  getNews: (all = false) =>
    request<{ success: boolean; items: NewsItem[] }>('GET', `/api/admin/news${all ? '?all=1' : ''}`),
  getNewsItem: (id: string) =>
    request<{ success: boolean; item: NewsItem }>('GET', `/api/admin/news/${encodeURIComponent(id)}`),
  createNews: (data: Partial<NewsItem>) =>
    request<{ success: boolean; item: NewsItem }>('POST', '/api/admin/news', data),
  updateNews: (id: string, data: Partial<NewsItem>) =>
    request<{ success: boolean; item: NewsItem }>('PUT', `/api/admin/news/${encodeURIComponent(id)}`, data),
  deleteNews: (id: string) =>
    request<{ success: boolean }>('DELETE', `/api/admin/news/${encodeURIComponent(id)}`),

  // Newsletter
  getNewsletter: (page?: number) => {
    const q = page ? `?page=${page}` : '';
    return request<NewsletterResponse>('GET', `/api/admin/newsletter${q}`);
  },

  // AI Translation
  translate: (data: TranslateRequest) =>
    request<{ success: boolean; translations: Record<string, unknown> }>('POST', '/api/admin/translate', data),

  // Email Campaigns
  getCampaigns: () =>
    request<{ success: boolean; campaigns: Campaign[] }>('GET', '/api/admin/campaigns'),
  getCampaign: (id: number) =>
    request<{ success: boolean; campaign: Campaign }>('GET', `/api/admin/campaigns/${id}`),
  createCampaign: (data: Partial<Campaign>) =>
    request<{ success: boolean; campaign: Campaign }>('POST', '/api/admin/campaigns', data),
  updateCampaign: (id: number, data: Partial<Campaign>) =>
    request<{ success: boolean; campaign: Campaign }>('PUT', `/api/admin/campaigns/${id}`, data),
  deleteCampaign: (id: number) =>
    request<{ success: boolean }>('DELETE', `/api/admin/campaigns/${id}`),
  sendCampaign: (id: number) =>
    request<{ success: boolean; sent: number; errors: Array<{ email: string; error: string }> }>('POST', `/api/admin/campaigns/${id}/send`),
  scheduleCampaign: (id: number, scheduledAt: string) =>
    request<{ success: boolean }>('POST', `/api/admin/campaigns/${id}/schedule`, { scheduledAt }),
  getCampaignStats: (id: number) =>
    request<{ success: boolean; campaign: Campaign; sends: CampaignSend[] }>('GET', `/api/admin/campaigns/${id}/stats`),

  // AI Knowledge Base
  getAiKnowledge: () =>
    request<{ success: boolean; entries: AiQA[] }>('GET', '/api/admin/ai-knowledge'),
  createAiQA: (data: Partial<AiQA>) =>
    request<{ success: boolean; entry: AiQA }>('POST', '/api/admin/ai-knowledge', data),
  updateAiQA: (id: number, data: Partial<AiQA>) =>
    request<{ success: boolean; entry: AiQA }>('PUT', `/api/admin/ai-knowledge/${id}`, data),
  deleteAiQA: (id: number) =>
    request<{ success: boolean }>('DELETE', `/api/admin/ai-knowledge/${id}`),
  getAiQuestions: (status?: string) =>
    request<{ success: boolean; questions: AiQuestion[]; counts: { status: string; c: number }[] }>(
      'GET', `/api/admin/ai-knowledge/questions${status ? `?status=${status}` : ''}`
    ),
  reviewAiQuestions: (ids: number[], status: string) =>
    request<{ success: boolean }>('PUT', '/api/admin/ai-knowledge/questions', { ids, status }),
  getAiPreview: (lang: string) =>
    request<{ success: boolean; productContext: string; customQA: string }>(
      'GET', `/api/admin/ai-knowledge/preview?lang=${lang}`
    ),
  uploadImage: (imageBase64: string, fileName: string) =>
    request<{ success: boolean; path: string }>('POST', '/api/admin/upload-image', { imageBase64, fileName }),};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  success: boolean;
  stats: {
    products: number;
    news: number;
    subscribers: number;
    chatUsers: number;
    chatMessages: number;
    recentMessages: number;
  };
  recentUsers: ChatUser[];
}

export interface AdminAnalytics {
  success: boolean;
  summary: {
    total_messages: number;
    total_users: number;
    total_subscribers: number;
    total_news: number;
    total_products: number;
  };
  chatPerDay: Array<{ date: string; count: number }>;
  newsletterPerDay: Array<{ date: string; count: number }>;
  langDistribution: Array<{ language: string; count: number }>;
  topUsers: ChatUser[];
}

export interface ChatUser {
  id: string;
  language: string;
  message_count: number;
  first_seen: string;
  last_seen: string;
  last_message?: string;
  last_user_message?: string;
  last_message_at?: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  language: string;
  created_at: string;
}

export interface ChatListResponse {
  success: boolean;
  users: ChatUser[];
  total: number;
  page: number;
  limit: number;
}

export interface Product {
  id: string;
  brand: 'DIOX' | 'AYLUX';
  category_id: string;
  name_ar: string; name_en: string; name_tr: string; name_ru: string;
  description_ar: string; description_en: string; description_tr: string; description_ru: string;
  image: string;
  alt_ar: string; alt_en: string; alt_tr: string; alt_ru: string;
  weight: string;
  material_ar: string; material_en: string; material_tr: string; material_ru: string;
  count_ar: string; count_en: string; count_tr: string; count_ru: string;
  sizes?: Array<{ label: string; image?: string }> | null;
  display_order: number;
  active: number;
  created_at: string;
  updated_at: string;
  category_title_ar?: string;
  category_title_en?: string;
}

export interface ProductCategory {
  id: string;
  brand: 'DIOX' | 'AYLUX';
  key: string;
  title_ar: string; title_en: string; title_tr: string; title_ru: string;
  display_order: number;
}

export interface NewsItem {
  id: string;
  slug: string;
  image: string;
  published_at: string;
  category_ar: string; category_en: string; category_tr: string; category_ru: string;
  title_ar: string; title_en: string; title_tr: string; title_ru: string;
  excerpt_ar: string; excerpt_en: string; excerpt_tr: string; excerpt_ru: string;
  body_ar: string[]; body_en: string[]; body_tr: string[]; body_ru: string[];
  active: number;
  created_at: string;
  updated_at: string;
}

export interface NewsletterResponse {
  success: boolean;
  subscribers: Array<{ email: string; subscribed_at: string }>;
  total: number;
  page: number;
  limit: number;
}

export interface TranslateRequest {
  text?: string;
  fields?: Record<string, string>;
  sourceLang?: string;
}

// ── Email Campaigns ──────────────────────────────────────────────────────────
export interface Campaign {
  id: number;
  title: string;
  template_type: 'custom' | 'new_product' | 'offer' | 'news';
  subject_ar: string; subject_en: string; subject_tr: string; subject_ru: string;
  body_ar: string; body_en: string; body_tr: string; body_ru: string;
  image_url?: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at?: string;
  sent_at?: string;
  recipient_count: number;
  open_count: number;
  created_at: string;
  updated_at: string;
}
export interface CampaignSend {
  id: number; email: string; opened: number; opened_at?: string; created_at: string;
}

// ── AI Knowledge ─────────────────────────────────────────────────────────────
export interface AiQA {
  id: number;
  question_ar: string; question_en: string; question_tr: string; question_ru: string;
  answer_ar: string; answer_en: string; answer_tr: string; answer_ru: string;
  tags: string;
  active: number;
  created_at: string;
  updated_at: string;
}
export interface AiQuestion {
  id: number; question: string; language: string; user_id?: string;
  status: 'new' | 'reviewed' | 'ignored'; created_at: string;
}

// ── Google Analytics ────────────────────────────────────────────────────────
export interface GaData {
  configured: boolean;
  message?: string;
  steps?: string[];
  error?: string;
  summary?: {
    sessions: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  byDay?: Array<{ date: string; sessions: number; users: number }>;
  byCountry?: Array<{ country: string; sessions: number }>;
  byPage?: Array<{ page: string; views: number }>;
  byDevice?: Array<{ device: string; sessions: number }>;
  bySource?: Array<{ source: string; sessions: number }>;
}



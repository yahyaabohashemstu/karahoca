import { buildApiUrl } from '../../utils/api';

const TOKEN_KEY = 'karahoca_admin_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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
};

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

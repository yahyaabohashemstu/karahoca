import { buildApiUrl } from '../../utils/api';

export type AdminRequestError = Error & { status?: number };

interface RequestOptions {
  redirectOn401?: boolean;
}

const buildRequestError = (message: string, status: number): AdminRequestError => {
  const error = new Error(message) as AdminRequestError;
  error.status = status;
  return error;
};

// CSRF double-submit: the server sets a `karahoca_admin_csrf` cookie on
// login (NOT httpOnly so the SPA can read it) and expects the same value
// echoed back as an `X-CSRF-Token` header on every mutation. Browsers never
// send custom headers cross-origin without CORS preflight, so an attacker
// page cannot replay these requests even if a SameSite edge-case leaks the
// session cookie. Safe-method calls (GET/HEAD/OPTIONS) skip the header.
const CSRF_COOKIE_NAME = 'karahoca_admin_csrf';

const readCsrfToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  // Match the cookie even if it is not the first one in the jar.
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
};

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const request = async <T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> => {
  const { redirectOn401 = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (MUTATION_METHODS.has(method.toUpperCase())) {
    const csrf = readCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const response = await fetch(buildApiUrl(path), {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({})) as T & { success?: boolean; error?: string };

  if (response.status === 401) {
    if (redirectOn401) {
      window.location.href = '/admin';
    }
    throw buildRequestError('Session expired. Please log in again.', response.status);
  }

  if (!response.ok) {
    throw buildRequestError((data as { error?: string }).error || `Request failed (${response.status})`, response.status);
  }

  return data;
};

export const adminApi = {
  login: (username: string, password: string) =>
    request<{ success: boolean }>('POST', '/api/admin/login', { username, password }, { redirectOn401: false }),

  logout: () =>
    request<{ success: boolean }>('POST', '/api/admin/logout', undefined, { redirectOn401: false }),

  getSession: () =>
    request<AdminSessionResponse>('GET', '/api/admin/session', undefined, { redirectOn401: false }),

  getStats: () => request<AdminStats>('GET', '/api/admin/stats'),

  getAnalytics: (days?: number) => request<AdminAnalytics>('GET', `/api/admin/analytics${days ? `?days=${days}` : ''}`),

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
  reorderProducts: (items: { id: string; display_order: number }[]) =>
    request<{ success: boolean }>('PUT', '/api/admin/products/reorder', { items }),

  /**
   * CSV export URL for products. Used as the href of a <a download> in
   * the admin toolbar so the browser handles streaming + Save dialog.
   * Honours an optional brand filter the same way the JSON list does.
   */
  productsExportCsvUrl: (brand?: string) =>
    buildApiUrl(`/api/admin/products/export.csv${brand ? `?brand=${brand}` : ''}`),
  /**
   * CSV import. `dryRun: true` returns a per-row validation summary
   * without writing — used to power the preview step before the admin
   * confirms. With dryRun:false the server runs the import in a single
   * transaction (all-or-nothing).
   */
  importProductsCsv: (csv: string, dryRun = false) =>
    request<{
      success: boolean;
      summary: {
        total: number;
        inserted: number;
        updated: number;
        errors: Array<{ line: number; error: string }>;
        dryRun: boolean;
      };
      error?: string;
    }>('POST', '/api/admin/products/import.csv', { csv, dryRun }),

  /**
   * AI description writer. Given a brief (name + brand + optional
   * category + optional hint), returns polished marketing copy in all
   * four languages. The model is asked to author the four versions
   * together so terminology stays consistent across translations.
   *
   * The endpoint already routes through the same Gemini → OpenRouter
   * provider chain as the visitor-facing chat, so retries / fallbacks
   * are handled server-side; failures here are user-actionable (model
   * 503, parse failure) and should be surfaced verbatim.
   */
  generateProductDescriptions: (params: {
    name: string;
    brand: 'DIOX' | 'AYLUX';
    category?: string;
    hint?: string;
    sourceLang?: 'ar' | 'en' | 'tr' | 'ru';
  }) =>
    request<{
      success: boolean;
      descriptions: Partial<Record<'ar' | 'en' | 'tr' | 'ru', string>>;
    }>('POST', '/api/admin/products/ai-description', params),

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
  deleteSubscriber: (email: string) =>
    request<{ success: boolean }>('DELETE', `/api/admin/newsletter/${encodeURIComponent(email)}`),
  /**
   * CSV export returns a file blob (not JSON) so it bypasses the typed
   * `request` helper. This function handles auth + CSRF inline, surfaces
   * 401 as a redirect, and returns a blob the caller can save.
   */
  exportNewsletterCsv: async (): Promise<Blob> => {
    const response = await fetch(buildApiUrl('/api/admin/newsletter/export'), {
      method: 'GET',
      credentials: 'include',
    });
    if (response.status === 401) {
      window.location.href = '/admin';
      throw buildRequestError('Session expired. Please log in again.', 401);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw buildRequestError(payload.error || `Export failed (${response.status})`, response.status);
    }
    return response.blob();
  },

  // AI Translation
  translate: (data: TranslateRequest) =>
    request<{ success: boolean; translations: Record<string, unknown> }>('POST', '/api/admin/translate', data),

  /**
   * Conversion funnel + search-terms aggregation (Phase G1 + G2).
   * One round-trip; both panels read the same visitor_events table
   * over the same date window so it's cheaper to bundle them
   * server-side than fan out two GETs.
   */
  getFunnel: (params: { from?: string; to?: string; lang?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to)   query.set('to',   params.to);
    if (params.lang) query.set('lang', params.lang);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<{
      success: boolean;
      range: { from: string; to: string };
      lang: string | null;
      funnel: Array<{
        key: string;
        label: string;
        icon: string;
        visitors: number;
        dropFromPrev: number;
        conversionFromStart: number;
      }>;
      searchTerms: Array<{ term: string; count: number; topLang: string | null }>;
    }>('GET', `/api/admin/funnel${suffix}`);
  },

  // ── G4 A/B testing ───────────────────────────────────────────────────────
  // Thin CRUD wrappers — every endpoint round-trips JSON, the admin
  // page handles its own optimistic-update logic so these stay typed
  // but unopinionated.
  listAbTests: () => request<{
    success: boolean;
    experiments: Array<AbExperimentRow & { variants: AbVariantRow[] }>;
  }>('GET', '/api/admin/ab-tests'),
  getAbTest: (id: number) => request<{
    success: boolean;
    experiment: AbExperimentRow;
    variants: AbVariantRow[];
    results: AbExperimentResults | null;
  }>('GET', `/api/admin/ab-tests/${id}`),
  createAbTest: (body: { key: string; name: string; description?: string; goal_event: string }) =>
    request<{ success: boolean; experiment: AbExperimentRow & { variants: AbVariantRow[] } }>('POST', '/api/admin/ab-tests', body),
  updateAbTest: (id: number, body: Partial<AbExperimentRow>) =>
    request<{ success: boolean; experiment: AbExperimentRow }>('PUT', `/api/admin/ab-tests/${id}`, body),
  deleteAbTest: (id: number) =>
    request<{ success: boolean }>('DELETE', `/api/admin/ab-tests/${id}`),
  startAbTest: (id: number) =>
    request<{ success: boolean; experiment: AbExperimentRow }>('POST', `/api/admin/ab-tests/${id}/start`, {}),
  stopAbTest: (id: number) =>
    request<{ success: boolean; experiment: AbExperimentRow }>('POST', `/api/admin/ab-tests/${id}/stop`, {}),
  addAbVariant: (id: number, body: { variant_key: string; label?: string; weight?: number }) =>
    request<{ success: boolean; variants: AbVariantRow[] }>('POST', `/api/admin/ab-tests/${id}/variants`, body),
  updateAbVariant: (id: number, variantKey: string, body: { label?: string; weight?: number }) =>
    request<{ success: boolean; variants: AbVariantRow[] }>('PUT', `/api/admin/ab-tests/${id}/variants/${encodeURIComponent(variantKey)}`, body),
  deleteAbVariant: (id: number, variantKey: string) =>
    request<{ success: boolean; variants: AbVariantRow[] }>('DELETE', `/api/admin/ab-tests/${id}/variants/${encodeURIComponent(variantKey)}`),

  /**
   * G3: cohort retention. Returns a triangular matrix where rows are
   * cohorts (visitors who first appeared in a given week/month) and
   * columns are time-since-cohort (period 0 = same bucket, period 1 =
   * one bucket later, etc.) with the retention % per cell.
   */
  getCohorts: (params: { bucket?: 'week' | 'month'; periods?: number; lang?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.bucket)  q.set('bucket', params.bucket);
    if (params.periods) q.set('periods', String(params.periods));
    if (params.lang)    q.set('lang', params.lang);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<{
      success: boolean;
      bucket: 'week' | 'month';
      periods: number;
      lang: string | null;
      cohorts: Array<{
        cohort: string;
        size: number;
        retention: Array<{ period: number; label: string; returners: number; pct: number }>;
      }>;
    }>('GET', `/api/admin/cohorts${suffix}`);
  },

  /**
   * Karo Insights: first-party analytics aggregated from visitor_events
   * + chat_messages. Returns ALL sections in one round-trip — see
   * server/routes/admin-karo-insights.mjs for the schema rationale.
   */
  getKaroInsights: (params: { from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<{
      success: boolean;
      range: { from: string; to: string };
      kpi: {
        chatOpens: number;
        uniqueVisitors: number;
        totalMessages: number;
        userMessages: number;
        assistantMessages: number;
        avgMessagesPerConvo: number;
        whatsappCtr: number;
        droppedConversations: number;
      };
      byDay: Array<{ day: string; unique_visitors: number; opens: number }>;
      byLang: Array<{ lang: string; count: number }>;
      byCountry: Array<{ country: string; count: number }>;
      topProducts: Array<{ product_id: string; hits: number }>;
      topFollowupChips: Array<{ chip: string; count: number }>;
    }>('GET', `/api/admin/karo-insights${suffix}`);
  },

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
  sendCampaign: (id: number, opts?: { excludedEmails?: string[] }) =>
    request<{ success: boolean; queued: boolean; alreadyQueued?: boolean }>(
      'POST', `/api/admin/campaigns/${id}/send`,
      opts?.excludedEmails?.length ? { excludedEmails: opts.excludedEmails } : undefined,
    ),
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
    request<{ success: boolean; path: string; url: string }>('POST', '/api/admin/upload-image', { imageBase64, fileName }),

  // Audit Log
  getAuditLog: (params?: {
    limit?: number;
    offset?: number;
    entity?: string;
    action?: string;
    q?: string;
    from?: string;
    to?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.entity) q.set('entity', params.entity);
    if (params?.action) q.set('action', params.action);
    if (params?.q)      q.set('q', params.q);
    if (params?.from)   q.set('from', params.from);
    if (params?.to)     q.set('to', params.to);
    return request<{ success: boolean; logs: AuditLogEntry[]; total: number }>('GET', `/api/admin/audit-log?${q}`);
  },
  /**
   * Builds the URL of the CSV export of the audit log so the caller can
   * point a hidden <a download> at it. Doing the download via a plain
   * link (rather than `request()`) avoids a JSON→Blob roundtrip and
   * lets the browser handle the Save dialog natively.
   */
  auditLogExportUrl: (params?: {
    entity?: string;
    action?: string;
    q?: string;
    from?: string;
    to?: string;
  }) => {
    const q = new URLSearchParams();
    q.set('format', 'csv');
    if (params?.entity) q.set('entity', params.entity);
    if (params?.action) q.set('action', params.action);
    if (params?.q)      q.set('q', params.q);
    if (params?.from)   q.set('from', params.from);
    if (params?.to)     q.set('to', params.to);
    // buildApiUrl honours VITE_BACKEND_URL so this works on prod where
    // the API lives at api.karahoca.com.
    return buildApiUrl(`/api/admin/audit-log?${q.toString()}`);
  },
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

export interface AdminSessionResponse {
  success: boolean;
  user: {
    username: string;
    role: string;
  };
}

export interface AdminAnalytics {
  success: boolean;
  days?: number;
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
  gallery?: string;          // JSON string of string[] — stored as TEXT in DB
  alt_ar: string; alt_en: string; alt_tr: string; alt_ru: string;
  weight: string;
  material_ar: string; material_en: string; material_tr: string; material_ru: string;
  count_ar: string; count_en: string; count_tr: string; count_ru: string;
  weight_count_table?: string;  // JSON string: [{"weight":"1.2 kg","count":6}, ...]
  image_scale?: number;         // 0.3–1.5, controls product image size in card (default 0.85)
  display_order: number;
  active: number;
  // D5 publishing state machine — same shape as news. 'published' is
  // the default for backward compat; 'draft' rows are admin-only;
  // 'scheduled' rows auto-publish at `publish_at` (ISO 8601 UTC).
  status?: 'draft' | 'scheduled' | 'published';
  publish_at?: string | null;
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

// ─── G4 A/B testing types ────────────────────────────────────────────────────
export interface AbExperimentRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  status: 'draft' | 'running' | 'stopped' | 'done';
  goal_event: string;
  started_at: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface AbVariantRow {
  id: number;
  variant_key: string;
  label: string | null;
  weight: number;
  created_at: string;
}
export interface AbExperimentResults {
  experiment: AbExperimentRow;
  results: Array<{
    variant_key: string;
    label: string;
    weight: number;
    exposed: number;
    converted: number;
    rate: number;
    lift: number;
    confidence: number;
  }>;
}

export interface NewsItem {
  id: string;
  slug: string;
  image: string;
  published_at: string;
  status: 'draft' | 'published' | 'scheduled';
  publish_at: string | null;
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
  /** A/B testing: alternate subject lines for group B */
  subject_b_ar?: string; subject_b_en?: string; subject_b_tr?: string; subject_b_ru?: string;
  body_ar: string; body_en: string; body_tr: string; body_ru: string;
  image_url?: string;
  status: 'draft' | 'scheduled' | 'queued' | 'sent';
  scheduled_at?: string;
  sent_at?: string;
  recipient_count: number;
  open_count: number;
  click_count: number;
  created_at: string;
  updated_at: string;
}
export interface CampaignSend {
  id: number;
  email: string;
  opened: number;
  opened_at?: string;
  created_at: string;
  ab_variant?: 'a' | 'b';
  click_count?: number;
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

// ── Audit Log ────────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  admin_user: string;
  details: string | null;
  created_at: string;
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



import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { logger } from '../utils/logger.mjs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: this module lives at server/services/db.mjs. The on-disk data layout
// is pinned at server/data/ and the shared i18n catalogue is at src/locales/,
// both one level above this file.
const serverDir = path.join(__dirname, '..');
const projectRoot = path.join(__dirname, '..', '..');
const dbPath = path.join(serverDir, 'data', 'karahoca.db');
const localesDir = path.join(projectRoot, 'src', 'locales');
const newsletterFile = path.join(serverDir, 'data', 'newsletter.json');

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Safely get a nested key from an object using dot notation */
const get = (obj, dotPath) =>
  dotPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

/** Load a locale JSON file */
const loadLocale = (lang) => {
  try {
    const raw = readFileSync(path.join(localesDir, lang, 'translation.json'), 'utf8');
    return JSON.parse(raw).translation;
  } catch {
    return {};
  }
};

/**
 * Normalize a weight string:
 * - Ensure space between number and unit: "9kg" → "9 KG"
 * - Uppercase all units: "kg" → "KG", "ml" → "ML", "5l" → "5 L"
 * - Handles compound weights: "900ml / 5L" → "900 ML / 5 L"
 */
export const normalizeWeight = (w) => {
  if (!w || typeof w !== 'string') return w || '';
  return w.split('/').map(part =>
    part.trim().replace(/([\d.]+)\s*(kg|g|ml|l)\b/gi,
      (_, num, unit) => `${num} ${unit.toUpperCase()}`)
  ).join(' / ');
};

const normalizeLegacyCatalogAssetPath = (assetPath) => {
  if (typeof assetPath !== 'string') {
    return assetPath;
  }

  if (assetPath.startsWith('/diox/')) {
    return assetPath.replace('/diox/', '/diox-images/');
  }

  if (assetPath.startsWith('/aylux/')) {
    return assetPath.replace('/aylux/', '/aylux-images/');
  }

  return assetPath;
};

const AYLUX_WEIGHT_BY_PRODUCT_ID = {
  'aylux-general-cleaner': '750 ML',
  'aylux-air-freshener': '400 ML',
  'aylux-super-gel': '450 ML / 900 ML',
  'aylux-floor-fragrance': '600 ML',
  'aylux-glass-cleaner': '750 ML',
  'aylux-chlorine': '900 ML / 5 L',
  'aylux-oven-cleaner': '750 ML',
  'aylux-flash': '900 ML',
  'aylux-bathroom-cleaner': '750 ML',
  'aylux-dish-gel': '1.5 KG',
  'aylux-dish-liquid2': '3 L',
  'aylux-auto-powder1': '150 G / 1.2 KG / 3.5 KG / 9 KG',

  'aylux-liquid-detergent': '900 ML',
  'aylux-fabric-softener': '900 ML',
  'aylux-stain-remover': '900 ML',
  'aylux-regular-powder': '300 G / 600 G / 3 KG / 5 KG / 9 KG',
  'aylux-liquid-soap1': '3 L',
  'aylux-liquid-soap2': '400 ML',
};

const PRODUCT_CATEGORY_TITLE_KEYS = [
  { id: 'diox-home', titleKey: 'diox.categories.homeCleaning' },
  { id: 'diox-laundry', titleKey: 'diox.categories.laundryCleaning' },
  { id: 'diox-personal', titleKey: 'diox.categories.personalHygiene' },
  { id: 'aylux-home', titleKey: 'aylux.categories.homeCleaning' },
  { id: 'aylux-laundry', titleKey: 'aylux.categories.laundryCleaning' },
  { id: 'aylux-personal', titleKey: 'aylux.categories.personalHygiene' },
];

// ─── Init DB ────────────────────────────────────────────────────────────────

let db;

export const generateOpaqueSubscriberKey = () => randomBytes(18).toString('base64url');

const createUniqueNewsletterSubscriberKey = () => {
  let key = generateOpaqueSubscriberKey();

  while (db.prepare('SELECT 1 FROM newsletter_subscribers WHERE unsubscribe_key = ?').get(key)) {
    key = generateOpaqueSubscriberKey();
  }

  return key;
};

export const getDb = () => {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
};

/**
 * Append an entry to admin_audit_log (non-fatal — never throws).
 * @param {{ action: string, entityType: string, entityId?: string|number, entityName?: string, adminUser?: string, details?: string }} opts
 */
export const logAudit = (opts) => {
  try {
    const { action, entityType, entityId = null, entityName = null, adminUser = 'admin', details = null } = opts;
    db.prepare(
      `INSERT INTO admin_audit_log(action, entity_type, entity_id, entity_name, admin_user, details) VALUES(?,?,?,?,?,?)`
    ).run(action, entityType, entityId != null ? String(entityId) : null, entityName, adminUser, details);
  } catch { /* non-fatal */ }
};

export const initDb = () => {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema();
  migrateNewsStatusColumn();
  migrateInitialData();
  migrateNewsletterSubscriberKeys();
  return db;
};

// ─── Migration: news status + publish_at columns ─────────────────────────────
const migrateNewsStatusColumn = () => {
  const cols = db.prepare('PRAGMA table_info(news)').all().map(c => c.name);
  if (!cols.includes('status')) {
    db.exec(`ALTER TABLE news ADD COLUMN status TEXT DEFAULT 'published'`);
    // Mark all existing active articles as published
    db.exec(`UPDATE news SET status='published' WHERE active=1 AND status IS NULL`);
    db.exec(`UPDATE news SET status='published' WHERE status IS NULL`);
  }
  if (!cols.includes('publish_at')) {
    db.exec(`ALTER TABLE news ADD COLUMN publish_at TEXT`);
  }
};

// ─── Schema ─────────────────────────────────────────────────────────────────

const createSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_users (
      id TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      language TEXT DEFAULT 'ar',
      message_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      language TEXT DEFAULT 'ar',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

    CREATE TABLE IF NOT EXISTS product_categories (
      id TEXT PRIMARY KEY,
      brand TEXT NOT NULL CHECK(brand IN ('DIOX','AYLUX')),
      key TEXT NOT NULL,
      title_ar TEXT, title_en TEXT, title_tr TEXT, title_ru TEXT,
      display_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name_ar TEXT, name_en TEXT, name_tr TEXT, name_ru TEXT,
      description_ar TEXT, description_en TEXT, description_tr TEXT, description_ru TEXT,
      image TEXT,
      alt_ar TEXT, alt_en TEXT, alt_tr TEXT, alt_ru TEXT,
      weight TEXT,
      material_ar TEXT, material_en TEXT, material_tr TEXT, material_ru TEXT,
      count_ar TEXT, count_en TEXT, count_tr TEXT, count_ru TEXT,
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(category_id) REFERENCES product_categories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      image TEXT,
      published_at TEXT NOT NULL,
      category_ar TEXT, category_en TEXT, category_tr TEXT, category_ru TEXT,
      title_ar TEXT, title_en TEXT, title_tr TEXT, title_ru TEXT,
      excerpt_ar TEXT, excerpt_en TEXT, excerpt_tr TEXT, excerpt_ru TEXT,
      body_ar TEXT, body_en TEXT, body_tr TEXT, body_ru TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      email TEXT PRIMARY KEY,
      subscribed_at TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      unsubscribe_key TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT NOT NULL,
      metric TEXT NOT NULL,
      value INTEGER DEFAULT 0,
      PRIMARY KEY (date, metric)
    );

    -- ── Email Campaigns ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      template_type TEXT DEFAULT 'custom',
      subject_ar TEXT, subject_en TEXT, subject_tr TEXT, subject_ru TEXT,
      body_ar TEXT, body_en TEXT, body_tr TEXT, body_ru TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'draft',
      scheduled_at TEXT,
      sent_at TEXT,
      recipient_count INTEGER DEFAULT 0,
      open_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      opened INTEGER DEFAULT 0,
      opened_at TEXT,
      resend_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign_id);

    -- ── AI Knowledge Base ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ai_custom_qa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_ar TEXT, question_en TEXT, question_tr TEXT, question_ru TEXT,
      answer_ar TEXT, answer_en TEXT, answer_tr TEXT, answer_ru TEXT,
      tags TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_user_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      language TEXT DEFAULT 'ar',
      user_id TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_questions_status ON ai_user_questions(status);

    -- ── AI knowledge base (Phase 3 extrication from src/data/aiKnowledge.ts) ─
    -- Holds the static "base knowledge" sections that describe the company,
    -- brands, pricing policy, and contact channels. Content is language-
    -- neutral-ish (same Arabic blob served to every locale; the LLM is
    -- instructed to translate on the fly). Seeded once at boot if empty —
    -- admins can edit freely afterwards without triggering a re-seed.
    CREATE TABLE IF NOT EXISTS ai_knowledge_sections (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active ON ai_knowledge_sections(active);

    -- Free-form key/value store for assistant-wide settings (tone guidelines,
    -- feature flags, per-deploy tweaks). Avoids a separate table per setting.
    CREATE TABLE IF NOT EXISTS ai_assistant_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);
};

// ─── Migration ───────────────────────────────────────────────────────────────

const hasMigration = (name) =>
  db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name) != null;

const markMigration = (name) =>
  db.prepare('INSERT OR IGNORE INTO migrations(name) VALUES(?)').run(name);

const migrateInitialData = () => {
  migrateProducts();
  migrateNews();
  migrateNewsletter();
  migrateCatalogAssetPathsAndMetadata();
  // Add image_url column to email_campaigns if missing
  try { db.exec("ALTER TABLE email_campaigns ADD COLUMN image_url TEXT"); } catch { /* already exists */ }

  // ── A/B Testing: add subject_b_* columns to email_campaigns ───────────────
  for (const lang of ['ar', 'en', 'tr', 'ru']) {
    try { db.exec(`ALTER TABLE email_campaigns ADD COLUMN subject_b_${lang} TEXT`); } catch { /* already exists */ }
  }

  // ── A/B Testing: add ab_variant column to email_sends ─────────────────────
  try { db.exec("ALTER TABLE email_sends ADD COLUMN ab_variant TEXT DEFAULT 'a'"); } catch { /* already exists */ }

  // ── Email click tracking table ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_link_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      send_id INTEGER REFERENCES email_sends(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      clicked_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_link_clicks_send ON email_link_clicks(send_id);
  `);

  // ── click_count column for campaign-level aggregation ─────────────────────
  try { db.exec("ALTER TABLE email_campaigns ADD COLUMN click_count INTEGER DEFAULT 0"); } catch { /* already exists */ }

  // ── Admin audit log ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      admin_user TEXT DEFAULT 'admin',
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON admin_audit_log(entity_type, entity_id);
  `);

  // ── Visitor analytics events ──────────────────────────────────────────────
  // Stores per-visitor activity for the Karo analytics dashboard (Phase C),
  // conversion funnel + cohorts (Phase G), and A/B variant attribution
  // (Phase G4). Schema notes:
  //   - `visitor_id` is the value resolved by the visitorIdentity middleware
  //     (X-Visitor-Id header > kara_visitor_id cookie). Null is allowed for
  //     server-emitted events that lack an originating browser.
  //   - `event_type` is an open string (no enum) so new event types can be
  //     introduced without a migration. The current vocabulary lives in
  //     src/utils/track.ts.
  //   - `payload_json` carries event-specific extras (e.g. chip label,
  //     product brand, country) — never PII.
  //   - `ip_country` is the ISO-3166 2-letter code derived once at insert
  //     time from CF-IPCountry / X-Country headers. The raw IP is NEVER
  //     stored.
  //   - Indices target the three hot read paths: (visitor, time) for cohort
  //     analysis, (type, time) for KPI rollups, (product_id) for product-
  //     inquiry leaderboards.
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT,
      event_type TEXT NOT NULL,
      page_path TEXT,
      product_id TEXT,
      lang TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_country TEXT,
      payload_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ve_visitor_time ON visitor_events(visitor_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ve_type_time ON visitor_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_ve_product ON visitor_events(product_id);
    CREATE INDEX IF NOT EXISTS idx_ve_created ON visitor_events(created_at);
  `);

  // ── Gallery column for products (DIOX colour-variant images) ──────────────
  try { db.exec("ALTER TABLE products ADD COLUMN gallery TEXT"); } catch { /* already exists */ }

  // ── Gift columns for products ─────────────────────────────────────────────
  try { db.exec("ALTER TABLE products ADD COLUMN gift_ar TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE products ADD COLUMN gift_en TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE products ADD COLUMN gift_tr TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE products ADD COLUMN gift_ru TEXT"); } catch { /* already exists */ }

  // ── Weight-count mapping table (JSON) ────────────────────────────────────
  try { db.exec("ALTER TABLE products ADD COLUMN weight_count_table TEXT"); } catch { /* already exists */ }

  // ── Per-product image scale (0.3–1.5, default 0.85 = 85%) ──────────────
  try { db.exec("ALTER TABLE products ADD COLUMN image_scale REAL DEFAULT 0.85"); } catch { /* already exists */ }

  // ── Performance indexes ─────────────────────────────────────────────────
  // Each wrapped in try/catch so an index that fails on a corrupt row (very
  // rare) doesn't prevent the server from booting — we'd rather run slow
  // than not at all.
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email)"); } catch { /* */ }
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_key ON newsletter_subscribers(unsubscribe_key)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_products_brand_active ON products(brand, active)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_news_active ON news(active)"); } catch { /* */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status)"); } catch { /* */ }

  // ── PHASE 6.2 indexes (read-heavy hot paths) ────────────────────────────
  // Composite (active, status) on news: hit on every SPA fallback render
  // (static-spa injectMeta looks up `WHERE slug=? AND active=1`), every
  // sitemap generation (`WHERE active=1 AND status='published'`), and
  // every public /api/news call. With active FIRST, SQLite can short-circuit
  // inactive rows before status comparison — the common case where most
  // news rows ARE active but only a subset are `published`.
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_news_active_status ON news(active, status)"); } catch { /* */ }

  // email_sends.email: needed for campaign dedup ("did this address already
  // receive this campaign?") and future bounce/complaint webhook handling
  // (the webhook posts the email, we look up every send to mark deliverable).
  // Without this, bounce handling at scale would full-scan email_sends on
  // every webhook call.
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_sends_email ON email_sends(email)"); } catch { /* */ }

  migrateDioxPowderProducts();
  migrateDioxPowderGalleryFix();
  migrateDiox6kgDelete();
  migrateAutoPowder1Gift();
  migrateAyluxCategoryTitleFix();
  migrateHardDeleteOrphans();
  migrateDeleteAyluxAutoPowder2();
  migrateNormalizeWeights();
  migrateDropTestimonials();
  migrateAiKnowledgeSeed();
  migrateToneGuidelinesMaleGender();
  migrateToneGuidelinesProductLinks();
};

/**
 * Phase-3 extrication: seed the AI knowledge table from the static content
 * that used to live in `src/data/aiKnowledge.ts`. One-shot — we only seed
 * when the table is empty so admin edits through the panel are preserved
 * across restarts.
 */
const migrateAiKnowledgeSeed = () => {
  if (hasMigration('ai_knowledge_initial_seed')) return;
  const existing = db.prepare('SELECT COUNT(*) AS c FROM ai_knowledge_sections').get();
  if (existing?.c > 0) {
    markMigration('ai_knowledge_initial_seed');
    return;
  }

  const sections = [
    {
      id: 'company-identity',
      title: 'هوية الشركة',
      content:
        'KARAHOCA KIMYA شركة تركية تعمل في تصنيع منتجات التنظيف المنزلية والصناعية مع التركيز على الجودة العالية والتقنيات الحديثة. تقع خطوط الإنتاج في تركيا مع شبكة توزيع تغطي السوق المحلي وأسواق التصدير.',
      tags: 'company,identity',
      display_order: 10,
    },
    {
      id: 'brand-diox',
      title: 'علامة DIOX',
      content:
        'علامة DIOX متخصصة في حلول التنظيف المنزلية الكاملة وتشمل منظفات الأسطح، الزجاج، المطبخ والحمام، بالإضافة إلى منتجات الغسيل مثل مساحيق الغسيل السائل والبودرة ومزيلات البقع ومطرّي الأقمشة.',
      tags: 'diox,products,home-cleaning',
      display_order: 20,
    },
    {
      id: 'brand-aylux',
      title: 'علامة AYLUX',
      content:
        'علامة AYLUX تقدم منتجات تنظيف فاخرة بمعايير عطرية مميزة، من بينها جل غسيل الصحون، منظفات الأرضيات والهواء، مساحيق الغسيل، مطري الأقمشة، ومنتجات النظافة الشخصية مثل الصابون السائل.',
      tags: 'aylux,products,premium',
      display_order: 30,
    },
    {
      id: 'quality-certifications',
      title: 'الاعتمادات والجودة',
      content:
        'تلتزم KARAHOCA بأنظمة تصنيع نظيفة وتتبنى اختبارات جودة دقيقة ومختبرات داخلية لضمان ثبات النتائج. الشركة تعمل وفق معايير التصنيع الجيد وتراقب سلسلة التوريد بعناية للحفاظ على سلامة المنتجات.',
      tags: 'quality,certifications',
      display_order: 40,
    },
    {
      id: 'industrial-partnerships',
      title: 'الخدمات الصناعية والشراكات',
      content:
        'يمكن لـ KARAHOCA توفير حلول تصنيع مخصصة وعقود تصنيع لصالح العلامات الخاصة، مع إمكانات تعبئة وتغليف مرنة وتطوير تركيبات جديدة بالتعاون مع العملاء.',
      tags: 'b2b,manufacturing,private-label',
      display_order: 50,
    },
    {
      id: 'contact-channels',
      title: 'قنوات التواصل',
      content:
        'للاستفسارات المباشرة يمكن التواصل عبر البريد info@karahoca.com أو عبر واتساب على الرقم +905305914990. كما يمكن استخدام نموذج الاتصال في الموقع الرسمي.',
      tags: 'contact,support',
      display_order: 60,
    },
    {
      id: 'pricing-shipping-policy',
      title: 'سياسة الأسعار والشحن | Pricing and Shipping Policy',
      content:
        'تختلف أسعار منتجاتنا بناءً على عدة عوامل رئيسية: نوع المنتج، الكمية المطلوبة، والحجم. نحن نقدم أسعاراً تنافسية بنظام البيع من أرض المصنع (Ex Works - EXW)، مما يمنح عملاءنا مرونة أكبر في ترتيبات الشحن. كما نسعى جاهدين لتوفير أفضل أسعار الشحن الممكنة من خلال شبكتنا اللوجستية الواسعة، ونزود عملاءنا بعروض أسعار شاملة تضمن لهم أفضل خدمة ممكنة. للحصول على عرض سعر مفصل ومخصص يناسب احتياجاتكم، يرجى التواصل مباشرة مع فريق خدمة العملاء لدينا عبر البريد الإلكتروني info@karahoca.com أو عبر واتساب على الرقم +905305914990.\n\nPricing for our products varies based on several key factors: product type, order quantity, and size. We offer competitive prices under Ex Works (EXW) terms from our factory, providing our clients with greater flexibility in shipping arrangements. We also work diligently to secure the best possible shipping rates through our extensive logistics network, and we provide our clients with comprehensive price quotes to ensure the best service possible. For a detailed and customized price quotation that meets your specific needs, please contact our customer service team directly via email at info@karahoca.com or through WhatsApp at +905305914990.',
      tags: 'pricing,shipping,exw,quotation,أسعار,شحن',
      display_order: 70,
    },
  ];

  const insertSection = db.prepare(
    'INSERT INTO ai_knowledge_sections (id, title, content, tags, display_order, active) VALUES (?, ?, ?, ?, ?, 1)',
  );
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insertSection.run(row.id, row.title, row.content, row.tags, row.display_order);
    }
  });
  insertMany(sections);

  // Tone guidelines — single row in the config table. Kept verbatim from the
  // client-side string so existing prompt behaviour is preserved byte-for-byte.
  const toneGuidelines = `
🌍 LANGUAGE RESPONSE RULES (ABSOLUTE PRIORITY):
- You MUST detect the language of the customer's question FIRST
- You MUST respond in the EXACT SAME LANGUAGE as the question
- Arabic question = Arabic response | English question = English response | Turkish question = Turkish response | Russian question = Russian response
- DO NOT respond in Arabic if the question is in English
- DO NOT respond in English if the question is in Arabic
- DO NOT respond in Turkish if the question is in Russian
- Translate the knowledge base content to match the customer's language

👤 IDENTITY & GENDER (ABSOLUTE):
- You are Karo, a MALE assistant (مذكّر).
- Whenever a language marks gender on verbs, adjectives, pronouns, or participles, ALWAYS use the masculine form for any word that refers to yourself.
- Arabic: "أنا المساعد الذكي" (NOT "المساعدة")، "أنا مستعد" (NOT "مستعدة")، "جاهز" (NOT "جاهزة")، "سعيد بمساعدتك" (NOT "سعيدة")، "يسعدني أن أساعدك"، "أنا هنا لمساعدتك".
- Russian: "я готов", "я рад", "я уверен" (NOT "готова/рада/уверена").
- English / Turkish: not gendered — no change needed.

🔗 PRODUCT BROWSE LINK (CRITICAL — ALWAYS INCLUDE WHEN RELEVANT):
- When the question touches on the products / catalogue of DIOX or AYLUX, append a markdown link to the brand catalogue page at the END of the reply.
- Use the SAME LANGUAGE as the response, and the correct locale URL prefix:
  • Arabic: https://karahoca.com/ar/diox   |   https://karahoca.com/ar/aylux
  • English: https://karahoca.com/en/diox   |   https://karahoca.com/en/aylux
  • Turkish: https://karahoca.com/tr/diox   |   https://karahoca.com/tr/aylux
  • Russian: https://karahoca.com/ru/diox   |   https://karahoca.com/ru/aylux
- Always wrap in markdown: [text](url). NEVER post a bare URL.
- Examples:
  • Arabic: [تصفّح كل منتجات DIOX](https://karahoca.com/ar/diox)
  • English: [Browse all DIOX products](https://karahoca.com/en/diox)
  • Turkish: [Tüm DIOX ürünlerini görüntüle](https://karahoca.com/tr/diox)
  • Russian: [Посмотреть все товары DIOX](https://karahoca.com/ru/diox)
- Decision rules:
  • Only DIOX mentioned → only DIOX link.
  • Only AYLUX mentioned → only AYLUX link.
  • Both / generic ("what products do you have?", "ما هي منتجاتكم؟") → BOTH links on separate lines.
  • Unrelated to products (shipping, contact, history, AI capabilities) → NO product link.
- Place link(s) AFTER the answer, separated by one blank line. The link is a follow-up pointer, not the lead.

TONE & STYLE:
- Sound like a natural human sales/support assistant, not a keyword bot
- Answer the customer's actual question directly before offering extra context
- Do not answer with a generic list of available topics unless the customer explicitly asks what you can help with
- If the question is broad, infer the most likely intent from the wording and answer naturally
- If some commercial detail depends on quantity, size, or exact SKU, explain that clearly and ask only the needed follow-up
- Provide answers in short paragraphs or easy-to-read bullet points
- Always include brand names (DIOX, AYLUX, KARAHOCA) in English regardless of response language
- Use the actual product data from the website catalog whenever the question is about products, variants, sizes, materials, counts, or comparisons
- Use the actual website sections whenever the question is about company history, milestones, production, goals, dryer technology, news, newsletter, or contact details
- If the customer asks to compare products, compare using the catalog fields that are actually available: brand, category, description, weight/size, material, and count
- Never say that product comparison information is unavailable if the catalog already contains relevant product entries
- If the customer asks about recent news, launches, contracts, or exhibitions, answer from the news items already shown on the website
- If information is not in the knowledge base, acknowledge this clearly and provide contact information
- Do not mention details outside of KARAHOCA's scope
- Remind customers of official contact options: info@karahoca.com | WhatsApp: +90 530 591 4990
`;

  db.prepare(
    'INSERT OR REPLACE INTO ai_assistant_config (key, value) VALUES (?, ?)',
  ).run('tone_guidelines', toneGuidelines);

  markMigration('ai_knowledge_initial_seed');
};

/**
 * Force-update existing tone_guidelines on production deployments so the
 * "Karo is male" identity rule is applied immediately, not only on fresh
 * installs. Safe because tone_guidelines is not user-editable through the
 * admin panel today — the row is exactly the seeded version.
 *
 * Idempotent via the migrations table; runs at most once per database.
 */
const migrateToneGuidelinesMaleGender = () => {
  if (hasMigration('tone_guidelines_male_gender_v1')) return;

  const current = db
    .prepare('SELECT value FROM ai_assistant_config WHERE key = ?')
    .get('tone_guidelines');

  // Skip if the row is missing entirely (the initial seed will create it
  // on next boot) or if it already contains the gender rule (e.g. an op
  // hand-edited it ahead of this migration).
  if (current?.value && !current.value.includes('IDENTITY & GENDER')) {
    const genderBlock = `
👤 IDENTITY & GENDER (ABSOLUTE):
- You are Karo, a MALE assistant (مذكّر).
- Whenever a language marks gender on verbs, adjectives, pronouns, or participles, ALWAYS use the masculine form for any word that refers to yourself.
- Arabic: "أنا المساعد الذكي" (NOT "المساعدة")، "أنا مستعد" (NOT "مستعدة")، "جاهز" (NOT "جاهزة")، "سعيد بمساعدتك" (NOT "سعيدة")، "يسعدني أن أساعدك"، "أنا هنا لمساعدتك".
- Russian: "я готов", "я рад", "я уверен" (NOT "готова/рада/уверена").
- English / Turkish: not gendered — no change needed.
`;

    // Insert the gender block right before the existing "TONE & STYLE:"
    // anchor so the order matches the canonical seed text. If the anchor
    // isn't present (extremely unlikely — same row was written by the
    // initial seed), append instead so nothing is lost.
    const anchor = 'TONE & STYLE:';
    const next = current.value.includes(anchor)
      ? current.value.replace(anchor, `${genderBlock.trim()}\n\n${anchor}`)
      : `${current.value.trimEnd()}\n${genderBlock}`;

    db.prepare(
      'INSERT OR REPLACE INTO ai_assistant_config (key, value) VALUES (?, ?)',
    ).run('tone_guidelines', next);
  }

  markMigration('tone_guidelines_male_gender_v1');
};

/**
 * Force-add the "always include a brand catalogue link when answering
 * product questions" rule to the existing tone_guidelines row in
 * production. The seed (above) carries the same block for fresh installs;
 * this migration splices it into databases that pre-date this change.
 *
 * Idempotent via the migrations table AND via a presence check on the
 * "PRODUCT BROWSE LINK" anchor — running on a hand-edited row that
 * already has the rule is a no-op.
 */
const migrateToneGuidelinesProductLinks = () => {
  if (hasMigration('tone_guidelines_product_links_v1')) return;

  const current = db
    .prepare('SELECT value FROM ai_assistant_config WHERE key = ?')
    .get('tone_guidelines');

  if (current?.value && !current.value.includes('PRODUCT BROWSE LINK')) {
    const productLinkBlock = `
🔗 PRODUCT BROWSE LINK (CRITICAL — ALWAYS INCLUDE WHEN RELEVANT):
- When the question touches on the products / catalogue of DIOX or AYLUX, append a markdown link to the brand catalogue page at the END of the reply.
- Use the SAME LANGUAGE as the response, and the correct locale URL prefix:
  • Arabic: https://karahoca.com/ar/diox   |   https://karahoca.com/ar/aylux
  • English: https://karahoca.com/en/diox   |   https://karahoca.com/en/aylux
  • Turkish: https://karahoca.com/tr/diox   |   https://karahoca.com/tr/aylux
  • Russian: https://karahoca.com/ru/diox   |   https://karahoca.com/ru/aylux
- Always wrap in markdown: [text](url). NEVER post a bare URL.
- Examples:
  • Arabic: [تصفّح كل منتجات DIOX](https://karahoca.com/ar/diox)
  • English: [Browse all DIOX products](https://karahoca.com/en/diox)
  • Turkish: [Tüm DIOX ürünlerini görüntüle](https://karahoca.com/tr/diox)
  • Russian: [Посмотреть все товары DIOX](https://karahoca.com/ru/diox)
- Decision rules:
  • Only DIOX mentioned → only DIOX link.
  • Only AYLUX mentioned → only AYLUX link.
  • Both / generic ("what products do you have?", "ما هي منتجاتكم؟") → BOTH links on separate lines.
  • Unrelated to products (shipping, contact, history, AI capabilities) → NO product link.
- Place link(s) AFTER the answer, separated by one blank line. The link is a follow-up pointer, not the lead.
`;

    // Insert right before the "TONE & STYLE:" anchor so block ordering
    // matches the canonical seed. Falls back to appending if the anchor
    // isn't found (defensive — same row was written by the initial seed).
    const anchor = 'TONE & STYLE:';
    const next = current.value.includes(anchor)
      ? current.value.replace(anchor, `${productLinkBlock.trim()}\n\n${anchor}`)
      : `${current.value.trimEnd()}\n${productLinkBlock}`;

    db.prepare(
      'INSERT OR REPLACE INTO ai_assistant_config (key, value) VALUES (?, ?)',
    ).run('tone_guidelines', next);
  }

  markMigration('tone_guidelines_product_links_v1');
};

// ─── Newsletter opaque-key migration ────────────────────────────────────────

const migrateNewsletterSubscriberKeys = () => {
  const cols = db.prepare('PRAGMA table_info(newsletter_subscribers)').all().map((column) => column.name);

  if (!cols.includes('unsubscribe_key')) {
    db.exec('ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_key TEXT');
  }

  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_key ON newsletter_subscribers(unsubscribe_key)');
  } catch {
    // Index creation is best-effort; missing keys are still backfilled below.
  }

  const missingRows = db.prepare(`
    SELECT email
    FROM newsletter_subscribers
    WHERE unsubscribe_key IS NULL OR trim(unsubscribe_key) = ''
  `).all();

  if (!missingRows.length) {
    return;
  }

  const updateKey = db.prepare('UPDATE newsletter_subscribers SET unsubscribe_key = ? WHERE email = ?');

  for (const row of missingRows) {
    updateKey.run(createUniqueNewsletterSubscriberKey(), row.email);
  }

  logger.info(`[db] Backfilled opaque unsubscribe keys for ${missingRows.length} subscriber(s)`);
};

// ─── DIOX Powder Products Migration (2026) ───────────────────────────────────

const migrateDioxPowderProducts = () => {
  if (hasMigration('diox_powder_products_2026')) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO products(
      id, brand, category_id,
      name_ar, name_en, name_tr, name_ru,
      description_ar, description_en, description_tr, description_ru,
      image, gallery,
      alt_ar, alt_en, alt_tr, alt_ru,
      weight,
      material_ar, material_en, material_tr, material_ru,
      count_ar, count_en, count_tr, count_ru,
      display_order, active, created_at, updated_at
    ) VALUES(
      @id, 'DIOX', 'diox-laundry',
      @name_ar, @name_en, @name_tr, @name_ru,
      @desc_ar, @desc_en, @desc_tr, @desc_ru,
      @image, @gallery,
      @alt_ar, @alt_en, @alt_tr, @alt_ru,
      @weight,
      'كيس بلاستيك', 'Plastic bag', 'Plastik torba', 'Пластиковый пакет',
      @cnt_ar, @cnt_en, @cnt_tr, @cnt_ru,
      @display_order, 1, @now, @now
    )
  `);

  const products = [
    {
      id: 'diox-auto-powder-1-2kg',
      name_ar: 'ديوكس مسحوق غسيل أوتوماتيك 1.2 كيلو',
      name_en: 'DIOX Automatic Laundry Powder 1.2 KG',
      name_tr: 'DIOX Otomatik Çamaşır Tozu 1,2 KG',
      name_ru: 'DIOX стиральный порошок автомат 1,2 кг',
      desc_ar: 'مسحوق غسيل أوتوماتيك عالي الجودة — متوفر بلونين',
      desc_en: 'High-quality automatic laundry powder — available in two colours',
      desc_tr: 'Yüksek kaliteli otomatik çamaşır tozu — iki renkte mevcut',
      desc_ru: 'Высококачественный стиральный порошок автомат — доступен в двух цветах',
      image: '/diox-images/ديوكس مسحوق غسيل أوتوماتيك 1.2 كيلو.png',
      gallery: JSON.stringify([
        '/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - أزرق.png',
        '/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - زهري.png',
      ]),
      alt_ar: 'ديوكس مسحوق غسيل أوتوماتيك 1.2 كيلو بلونين',
      alt_en: 'DIOX Automatic Laundry Powder 1.2 KG in two colours',
      alt_tr: 'DIOX Otomatik Çamaşır Tozu 1,2 KG iki renk',
      alt_ru: 'DIOX стиральный порошок автомат 1,2 кг двух цветов',
      weight: '1.2 KG',
      cnt_ar: '6 قطع', cnt_en: '6 pieces', cnt_tr: '6 adet', cnt_ru: '6 штук',
      display_order: 6, now,
    },
    {
      id: 'diox-auto-powder-3kg',
      name_ar: 'ديوكس مسحوق غسيل أوتوماتيك 3 كيلو',
      name_en: 'DIOX Automatic Laundry Powder 3 KG',
      name_tr: 'DIOX Otomatik Çamaşır Tozu 3 KG',
      name_ru: 'DIOX стиральный порошок автомат 3 кг',
      desc_ar: 'مسحوق غسيل أوتوماتيك اقتصادي — متوفر بأربعة ألوان',
      desc_en: 'Economy automatic laundry powder — available in four colours',
      desc_tr: 'Ekonomik otomatik çamaşır tozu — dört renkte mevcut',
      desc_ru: 'Экономичный стиральный порошок автомат — доступен в четырёх цветах',
      image: '/diox-images/ديوكس مسحوق غسيل أوتوماتيك 3 كيلو.png',
      gallery: JSON.stringify([
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - أزرق.png',
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - برتقالي.png',
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - بنفسجي.png',
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - زهري.png',
      ]),
      alt_ar: 'ديوكس مسحوق غسيل أوتوماتيك 3 كيلو بأربعة ألوان',
      alt_en: 'DIOX Automatic Laundry Powder 3 KG in four colours',
      alt_tr: 'DIOX Otomatik Çamaşır Tozu 3 KG dört renk',
      alt_ru: 'DIOX стиральный порошок автомат 3 кг четырёх цветов',
      weight: '3 KG',
      cnt_ar: '4 قطع', cnt_en: '4 pieces', cnt_tr: '4 adet', cnt_ru: '4 штуки',
      display_order: 7, now,
    },
    {
      id: 'diox-auto-powder-9kg',
      name_ar: 'ديوكس مسحوق غسيل أوتوماتيك 9 كيلو',
      name_en: 'DIOX Automatic Laundry Powder 9 KG',
      name_tr: 'DIOX Otomatik Çamaşır Tozu 9 KG',
      name_ru: 'DIOX стиральный порошок автомат 9 кг',
      desc_ar: 'مسحوق غسيل أوتوماتيك بحجم كبير — متوفر بأربعة ألوان',
      desc_en: 'Large automatic laundry powder — available in four colours',
      desc_tr: 'Büyük boy otomatik çamaşır tozu — dört renkte mevcut',
      desc_ru: 'Большой стиральный порошок автомат — доступен в четырёх цветах',
      image: '/diox-images/ديوكس مسحوق غسيل أوتوماتيك 9 كيلو.png',
      gallery: JSON.stringify([
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - أزرق.png',
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - برتقالي.png',
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - بنفسجي.png',
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - زهري.png',
      ]),
      alt_ar: 'ديوكس مسحوق غسيل أوتوماتيك 9 كيلو بأربعة ألوان',
      alt_en: 'DIOX Automatic Laundry Powder 9 KG in four colours',
      alt_tr: 'DIOX Otomatik Çamaşır Tozu 9 KG dört renk',
      alt_ru: 'DIOX стиральный порошок автомат 9 кг четyrёх цветов',
      weight: '9 KG',
      cnt_ar: '4 قطع', cnt_en: '4 pieces', cnt_tr: '4 adet', cnt_ru: '4 штуки',
      display_order: 9, now,
    },
  ];

  const txn = db.transaction(() => { for (const p of products) insert.run(p); });
  txn();

  markMigration('diox_powder_products_2026');
  logger.info('[db] DIOX powder products migration complete');
};

// ─── Fix: Force-update gallery for DIOX powder products ─────────────────────
// Runs after INSERT OR IGNORE — ensures gallery is populated even if a product
// was previously inserted without gallery data (e.g. via admin panel or old seeding).

const migrateDioxPowderGalleryFix = () => {
  if (hasMigration('diox_powder_gallery_fix_2026')) return;

  const update = db.prepare(
    `UPDATE products SET gallery = @gallery WHERE id = @id AND (gallery IS NULL OR gallery = '' OR gallery = '[]')`
  );

  const fixes = [
    {
      id: 'diox-auto-powder-1-2kg',
      gallery: JSON.stringify([
        '/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - أزرق.png',
        '/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - زهري.png',
      ]),
    },
    {
      id: 'diox-auto-powder-3kg',
      gallery: JSON.stringify([
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - أزرق.png',
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - برتقالي.png',
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - بنفسجي.png',
        '/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - زهري.png',
      ]),
    },
    {
      id: 'diox-auto-powder-9kg',
      gallery: JSON.stringify([
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - أزرق.png',
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - برتقالي.png',
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - بنفسجي.png',
        '/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - زهري.png',
      ]),
    },
  ];

  const txn = db.transaction(() => { for (const f of fixes) update.run(f); });
  txn();

  markMigration('diox_powder_gallery_fix_2026');
  logger.info('[db] DIOX powder gallery fix migration complete');
};

// ─── Delete 6kg product completely ───────────────────────────────────────────

const migrateDiox6kgDelete = () => {
  if (hasMigration('diox_6kg_delete_2026')) return;

  try { db.prepare(`DELETE FROM wishlist WHERE product_id = 'diox-auto-powder-6kg'`).run(); } catch (_) { /* table may not exist yet */ }
  db.prepare(`DELETE FROM products WHERE id = 'diox-auto-powder-6kg'`).run();

  markMigration('diox_6kg_delete_2026');
  logger.info('[db] DIOX 6kg product deleted');
};

// ─── Gift field migration for AYLUX Auto Powder 1 ────────────────────────────
const migrateAutoPowder1Gift = () => {
  if (hasMigration('aylux_auto_powder1_gift_2026')) return;

  db.prepare(`
    UPDATE products SET
      gift_ar = 'معطر أرضيات آيلوكس',
      gift_en = 'AYLUX Floor Freshener',
      gift_tr = 'AYLUX Zemin Spreyi',
      gift_ru = 'Освежитель пола AYLUX'
    WHERE id = 'aylux-auto-powder1'
  `).run();

  markMigration('aylux_auto_powder1_gift_2026');
  logger.info('[db] AYLUX auto powder 1 gift field set');
};

// ─── Products Migration ──────────────────────────────────────────────────────

const migrateProducts = () => {
  if (hasMigration('initial_products')) return;

  const langs = ['ar', 'en', 'tr', 'ru'];
  const locale = {};
  for (const l of langs) locale[l] = loadLocale(l);

  const t = (lang, key) => get(locale[lang], key) || key;

  // ── Categories ────────────────────────────────────────────────────────────
  const categories = [
    { id: 'diox-home',     brand: 'DIOX',  key: 'homeCleaning', order: 0, titleKey: 'diox.categories.homeCleaning' },
    { id: 'diox-laundry',  brand: 'DIOX',  key: 'laundryCleaning', order: 1, titleKey: 'diox.categories.laundryCleaning' },
    { id: 'diox-personal', brand: 'DIOX',  key: 'personalHygiene', order: 2, titleKey: 'diox.categories.personalHygiene' },
    { id: 'aylux-home',    brand: 'AYLUX', key: 'homeCleaning', order: 0, titleKey: 'aylux.categories.homeCleaning' },
    { id: 'aylux-laundry', brand: 'AYLUX', key: 'laundryCleaning', order: 1, titleKey: 'aylux.categories.laundryCleaning' },
    { id: 'aylux-personal',brand: 'AYLUX', key: 'personalHygiene', order: 2, titleKey: 'aylux.categories.personalHygiene' },
  ];

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO product_categories(id,brand,key,title_ar,title_en,title_tr,title_ru,display_order)
    VALUES(@id,@brand,@key,@title_ar,@title_en,@title_tr,@title_ru,@display_order)
  `);

  for (const cat of categories) {
    insertCat.run({
      id: cat.id, brand: cat.brand, key: cat.key,
      title_ar: t('ar', cat.titleKey),
      title_en: t('en', cat.titleKey),
      title_tr: t('tr', cat.titleKey),
      title_ru: t('ru', cat.titleKey),
      display_order: cat.order,
    });
  }

  // ── DIOX Products ─────────────────────────────────────────────────────────
  // For DIOX, material and count use the materials.* keys
  const dioxMat = (lang, mat) => t(lang, `materials.${mat}`);
  const dioxCount = (lang, n, plural = false) =>
    `${n} ${t(lang, plural ? 'materials.pieces_plural' : 'materials.pieces')}`;

  const dioxProducts = [
    // Home
    { id: 'diox-general-cleaner', cat: 'diox-home', order: 0,
      image: '/diox/ديوكس منظف عام.png', weight: '750 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.generalCleaner' },
    { id: 'diox-super-gel', cat: 'diox-home', order: 1,
      image: '/diox/ديوكس سوبر جل.png', weight: '450 ML / 900 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.superGel' },
    { id: 'diox-floor-fragrance', cat: 'diox-home', order: 2,
      image: '/diox/ديوكس معطر أرضيات.png', weight: '600 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.floorFragrance' },
    { id: 'diox-floor-fragrance2', cat: 'diox-home', order: 3,
      image: '/diox/ديوكس معطر الأرضيات.png', weight: '600 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.floorFragrance2' },
    { id: 'diox-glass-cleaner', cat: 'diox-home', order: 4,
      image: '/diox/ديوكس منظف الزجاج.png', weight: '750 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.glassCleaner' },
    { id: 'diox-chlorine', cat: 'diox-home', order: 5,
      image: '/diox/ديوكس كلور.png', weight: '900 ML / 5 L', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.chlorine' },
    { id: 'diox-oven-cleaner', cat: 'diox-home', order: 6,
      image: '/diox/ديوكس منظف الأفران.png', weight: '750 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.ovenCleaner' },
    { id: 'diox-flash', cat: 'diox-home', order: 7,
      image: '/diox/ديوكس فلاش.png', weight: '900 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.flash' },
    { id: 'diox-bathroom-cleaner', cat: 'diox-home', order: 8,
      image: '/diox/ديوكس منظف الحمام.png', weight: '750 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.bathroomCleaner' },
    { id: 'diox-dish-gel', cat: 'diox-home', order: 9,
      image: '/diox/ديوكس جل غسيل الصحون.png', weight: '1.5 KG', mat: 'plasticBottle', count: 4, plural: true,
      k: 'diox.products.home.dishGel' },
    { id: 'diox-dish-liquid1', cat: 'diox-home', order: 10,
      image: '/diox/ديوكس سائل غسيل الصحون (1).png', weight: '700 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.dishLiquid1' },
    { id: 'diox-dish-liquid2', cat: 'diox-home', order: 11,
      image: '/diox/ديوكس سائل غسيل الصحون (2).png', weight: '3 L', mat: 'plasticBottle', count: 4, plural: true,
      k: 'diox.products.home.dishLiquid2' },
    // Laundry
    { id: 'diox-auto-powder1', cat: 'diox-laundry', order: 0,
      image: '/diox/ديوكس مسحوق غسيل أوتوماتيك (1).png', weight: '2.5 KG / 4.5 KG', mat: 'plasticBag', count: 4, plural: true,
      k: 'diox.products.laundry.autoPowder1' },
    { id: 'diox-auto-powder2', cat: 'diox-laundry', order: 1,
      image: '/diox/ديوكس مسحوق غسيل أوتوماتيك (2).png', weight: '2.5 KG / 4.5 KG', mat: 'plasticBag', count: 4, plural: true,
      k: 'diox.products.laundry.autoPowder2' },
    { id: 'diox-liquid-detergent', cat: 'diox-laundry', order: 2,
      image: '/diox/ديوكس سائل غسيل (1).png', weight: '900 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.laundry.liquidDetergent' },
    { id: 'diox-fabric-softener', cat: 'diox-laundry', order: 3,
      image: '/diox/ديوكس مطري الغسيل.png', weight: '900 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.laundry.fabricSoftener' },
    { id: 'diox-stain-remover', cat: 'diox-laundry', order: 4,
      image: '/diox/ديوكس مزيل البقع.png', weight: '900 ML', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.laundry.stainRemover' },
    { id: 'diox-regular-powder', cat: 'diox-laundry', order: 5,
      image: '/diox/ديوكس مسحوق غسيل عادي.png', weight: '150 G / 1.2 KG / 3.5 KG / 9 KG', mat: 'plasticBag', count: 6, plural: true,
      k: 'diox.products.laundry.regularPowder' },
    // Personal
    { id: 'diox-liquid-soap', cat: 'diox-personal', order: 0,
      image: '/diox/ديوكس صابون سائل.png', weight: '400 ML / 3 L', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.personal.liquidSoap' },
  ];

  // ── AYLUX Products (locale has material and count directly) ───────────────
  const ayluxProducts = [
    // Home
    { id: 'aylux-general-cleaner', cat: 'aylux-home', order: 0,
      image: '/aylux/آيلوكس منظف عام.png', k: 'aylux.products.home.generalCleaner' },
    { id: 'aylux-air-freshener', cat: 'aylux-home', order: 1,
      image: '/aylux/آيلوكس معطر الهواء.png', k: 'aylux.products.home.airFreshener' },
    { id: 'aylux-super-gel', cat: 'aylux-home', order: 2,
      image: '/aylux/آيلوكس سوبر جل.png', k: 'aylux.products.home.superGel' },
    { id: 'aylux-floor-fragrance', cat: 'aylux-home', order: 3,
      image: '/aylux/آيلوكس معطر الأرضيات.png', k: 'aylux.products.home.floorFragrance' },
    { id: 'aylux-glass-cleaner', cat: 'aylux-home', order: 4,
      image: '/aylux/آيلوكس منظف الزجاج.png', k: 'aylux.products.home.glassCleaner' },
    { id: 'aylux-chlorine', cat: 'aylux-home', order: 5,
      image: '/aylux/آيلوكس كلور (مبيض).png', k: 'aylux.products.home.chlorine' },
    { id: 'aylux-oven-cleaner', cat: 'aylux-home', order: 6,
      image: '/aylux/آيلوكس منظف الفرن.png', k: 'aylux.products.home.ovenCleaner' },
    { id: 'aylux-flash', cat: 'aylux-home', order: 7,
      image: '/aylux/آيلوكس فلاش المنظف.png', k: 'aylux.products.home.flash' },
    { id: 'aylux-bathroom-cleaner', cat: 'aylux-home', order: 8,
      image: '/aylux/آيلوكس منظف الحمام.png', k: 'aylux.products.home.bathroomCleaner' },
    { id: 'aylux-dish-gel', cat: 'aylux-home', order: 9,
      image: '/aylux/آيلوكس جل غسيل الصحون.png', k: 'aylux.products.home.dishGel' },
    { id: 'aylux-dish-liquid2', cat: 'aylux-home', order: 10,
      image: '/aylux/آيلوكس سائل غسيل الصحون (2).png', k: 'aylux.products.home.dishLiquid2' },
    // Laundry
    { id: 'aylux-auto-powder1', cat: 'aylux-laundry', order: 0,
      image: '/aylux/آيلوكس مسحوق غسيل أوتوماتيك (1).png', k: 'aylux.products.laundry.autoPowder1' },
    { id: 'aylux-liquid-detergent', cat: 'aylux-laundry', order: 2,
      image: '/aylux/آيلوكس مسحوق الغسيل السائل.png', k: 'aylux.products.laundry.liquidDetergent' },
    { id: 'aylux-fabric-softener', cat: 'aylux-laundry', order: 3,
      image: '/aylux/آيلوكس مطري الغسيل.png', k: 'aylux.products.laundry.fabricSoftener' },
    { id: 'aylux-stain-remover', cat: 'aylux-laundry', order: 4,
      image: '/aylux/آيلوكس مزيل البقع.png', k: 'aylux.products.laundry.stainRemover' },
    { id: 'aylux-regular-powder', cat: 'aylux-laundry', order: 5,
      image: '/aylux/آيلوكس مسحوق الغسيل اليدوي.png', k: 'aylux.products.laundry.regularPowder' },
    // Personal
    { id: 'aylux-liquid-soap1', cat: 'aylux-personal', order: 0,
      image: '/aylux/آيلوكس صابون سائل (1).png', k: 'aylux.products.personal.liquidSoap1' },
    { id: 'aylux-liquid-soap2', cat: 'aylux-personal', order: 1,
      image: '/aylux/آيلوكس صابون سائل (2).png', k: 'aylux.products.personal.liquidSoap2' },
  ];

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products(
      id, brand, category_id,
      name_ar, name_en, name_tr, name_ru,
      description_ar, description_en, description_tr, description_ru,
      image,
      alt_ar, alt_en, alt_tr, alt_ru,
      weight,
      material_ar, material_en, material_tr, material_ru,
      count_ar, count_en, count_tr, count_ru,
      display_order, active
    ) VALUES(
      @id, @brand, @category_id,
      @name_ar, @name_en, @name_tr, @name_ru,
      @desc_ar, @desc_en, @desc_tr, @desc_ru,
      @image,
      @alt_ar, @alt_en, @alt_tr, @alt_ru,
      @weight,
      @mat_ar, @mat_en, @mat_tr, @mat_ru,
      @cnt_ar, @cnt_en, @cnt_tr, @cnt_ru,
      @display_order, 1
    )
  `);

  const brand = (id) => (id.startsWith('diox') ? 'DIOX' : 'AYLUX');

  // Insert DIOX
  for (const p of dioxProducts) {
    insertProduct.run({
      id: p.id, brand: brand(p.id), category_id: p.cat,
      name_ar: t('ar', `${p.k}.name`), name_en: t('en', `${p.k}.name`),
      name_tr: t('tr', `${p.k}.name`), name_ru: t('ru', `${p.k}.name`),
      desc_ar: t('ar', `${p.k}.description`), desc_en: t('en', `${p.k}.description`),
      desc_tr: t('tr', `${p.k}.description`), desc_ru: t('ru', `${p.k}.description`),
      image: normalizeLegacyCatalogAssetPath(p.image),
      alt_ar: t('ar', `${p.k}.alt`), alt_en: t('en', `${p.k}.alt`),
      alt_tr: t('tr', `${p.k}.alt`), alt_ru: t('ru', `${p.k}.alt`),
      weight: p.weight,
      mat_ar: dioxMat('ar', p.mat), mat_en: dioxMat('en', p.mat),
      mat_tr: dioxMat('tr', p.mat), mat_ru: dioxMat('ru', p.mat),
      cnt_ar: dioxCount('ar', p.count, p.plural), cnt_en: dioxCount('en', p.count, p.plural),
      cnt_tr: dioxCount('tr', p.count, p.plural), cnt_ru: dioxCount('ru', p.count, p.plural),
      display_order: p.order,
    });
  }

  // Insert AYLUX
  for (const p of ayluxProducts) {
    insertProduct.run({
      id: p.id, brand: brand(p.id), category_id: p.cat,
      name_ar: t('ar', `${p.k}.name`), name_en: t('en', `${p.k}.name`),
      name_tr: t('tr', `${p.k}.name`), name_ru: t('ru', `${p.k}.name`),
      desc_ar: t('ar', `${p.k}.description`), desc_en: t('en', `${p.k}.description`),
      desc_tr: t('tr', `${p.k}.description`), desc_ru: t('ru', `${p.k}.description`),
      image: normalizeLegacyCatalogAssetPath(p.image),
      alt_ar: t('ar', `${p.k}.alt`), alt_en: t('en', `${p.k}.alt`),
      alt_tr: t('tr', `${p.k}.alt`), alt_ru: t('ru', `${p.k}.alt`),
      weight: AYLUX_WEIGHT_BY_PRODUCT_ID[p.id] || '',
      mat_ar: t('ar', `${p.k}.material`), mat_en: t('en', `${p.k}.material`),
      mat_tr: t('tr', `${p.k}.material`), mat_ru: t('ru', `${p.k}.material`),
      cnt_ar: t('ar', `${p.k}.count`), cnt_en: t('en', `${p.k}.count`),
      cnt_tr: t('tr', `${p.k}.count`), cnt_ru: t('ru', `${p.k}.count`),
      display_order: p.order,
    });
  }

  markMigration('initial_products');
  logger.info('[db] Products migration complete');
};

const migrateCatalogAssetPathsAndMetadata = () => {
  if (hasMigration('catalog_asset_paths_and_metadata_v2')) return;

  db.prepare(`
    UPDATE products
    SET image = REPLACE(image, '/diox/', '/diox-images/')
    WHERE image LIKE '/diox/%'
  `).run();

  db.prepare(`
    UPDATE products
    SET image = REPLACE(image, '/aylux/', '/aylux-images/')
    WHERE image LIKE '/aylux/%'
  `).run();

  db.prepare(`
    UPDATE news
    SET image = REPLACE(image, '/diox/', '/diox-images/')
    WHERE image LIKE '/diox/%'
  `).run();

  db.prepare(`
    UPDATE news
    SET image = REPLACE(image, '/aylux/', '/aylux-images/')
    WHERE image LIKE '/aylux/%'
  `).run();

  const updateWeight = db.prepare(`
    UPDATE products
    SET weight = ?
    WHERE id = ?
      AND (weight IS NULL OR TRIM(weight) = '')
  `);

  for (const [productId, weight] of Object.entries(AYLUX_WEIGHT_BY_PRODUCT_ID)) {
    updateWeight.run(weight, productId);
  }

  const langs = ['ar', 'en', 'tr', 'ru'];
  const locale = {};
  for (const l of langs) locale[l] = loadLocale(l);
  const t = (lang, key) => get(locale[lang], key) || key;

  const readCategory = db.prepare(`
    SELECT id, title_ar, title_en, title_tr, title_ru
    FROM product_categories
    WHERE id = ?
  `);
  const updateCategory = db.prepare(`
    UPDATE product_categories
    SET title_ar = @title_ar,
        title_en = @title_en,
        title_tr = @title_tr,
        title_ru = @title_ru
    WHERE id = @id
  `);

  for (const category of PRODUCT_CATEGORY_TITLE_KEYS) {
    const existing = readCategory.get(category.id);
    if (!existing) continue;

    const shouldReplace = (value) =>
      !value || value.trim().length === 0 || value === category.titleKey;

    const next = {
      id: category.id,
      title_ar: shouldReplace(existing.title_ar) ? t('ar', category.titleKey) : existing.title_ar,
      title_en: shouldReplace(existing.title_en) ? t('en', category.titleKey) : existing.title_en,
      title_tr: shouldReplace(existing.title_tr) ? t('tr', category.titleKey) : existing.title_tr,
      title_ru: shouldReplace(existing.title_ru) ? t('ru', category.titleKey) : existing.title_ru,
    };

    if (
      next.title_ar !== existing.title_ar ||
      next.title_en !== existing.title_en ||
      next.title_tr !== existing.title_tr ||
      next.title_ru !== existing.title_ru
    ) {
      updateCategory.run(next);
    }
  }

  markMigration('catalog_asset_paths_and_metadata_v2');
  logger.info('[db] Catalog asset paths and metadata migration complete');
};

// ─── Aylux Category Title Fix ────────────────────────────────────────────────
// Force-corrects aylux-laundry / aylux-personal titles that were stored as
// raw i18n keys (aylux.categories.laundry / aylux.categories.personal)
// because the old seed used non-existent translation keys.

const migrateAyluxCategoryTitleFix = () => {
  if (hasMigration('aylux_category_title_fix_v1')) return;

  const langs = ['ar', 'en', 'tr', 'ru'];
  const locale = {};
  for (const l of langs) locale[l] = loadLocale(l);
  const t = (lang, key) => get(locale[lang], key) || key;

  const fixes = [
    { id: 'aylux-laundry',  titleKey: 'aylux.categories.laundryCleaning' },
    { id: 'aylux-personal', titleKey: 'aylux.categories.personalHygiene'  },
  ];

  const updateCat = db.prepare(`
    UPDATE product_categories
    SET title_ar = @title_ar,
        title_en = @title_en,
        title_tr = @title_tr,
        title_ru = @title_ru
    WHERE id = @id
  `);

  for (const fix of fixes) {
    updateCat.run({
      id:       fix.id,
      title_ar: t('ar', fix.titleKey),
      title_en: t('en', fix.titleKey),
      title_tr: t('tr', fix.titleKey),
      title_ru: t('ru', fix.titleKey),
    });
  }

  markMigration('aylux_category_title_fix_v1');
  logger.info('[db] Aylux category title fix migration complete');
};

// ─── Hard-delete orphan / unwanted products ──────────────────────────────────
// Products that should not exist at all — hard-deleted from DB permanently.
// This migration runs once and is idempotent (DELETE is safe if row is missing).

const migrateHardDeleteOrphans = () => {
  if (hasMigration('hard_delete_orphan_products_v1')) return;

  const orphanIds = [
    'aylux-dish-liquid1',   // AYLUX 700ml dishwashing liquid — removed from catalog
    'diox-auto-powder-6kg', // DIOX 6kg powder — removed from catalog
  ];

  const delProduct = db.prepare('DELETE FROM products WHERE id = ?');

  for (const id of orphanIds) {
    // Remove from wishlist first — wrapped fully in try/catch because
    // db.prepare() itself throws if the table does not exist yet.
    try { db.prepare('DELETE FROM wishlist WHERE product_id = ?').run(id); } catch (_) {}
    const info = delProduct.run(id);
    if (info.changes > 0) {
      logger.info(`[db] Hard-deleted orphan product: ${id}`);
    }
  }

  markMigration('hard_delete_orphan_products_v1');
  logger.info('[db] Orphan product hard-delete migration complete');
};

// ─── Delete AYLUX auto-powder2 (no-gift variant) ─────────────────────────────

const migrateDeleteAyluxAutoPowder2 = () => {
  if (hasMigration('delete_aylux_auto_powder2_v1')) return;

  try { db.prepare('DELETE FROM wishlist WHERE product_id = ?').run('aylux-auto-powder2'); } catch (_) {}
  const info = db.prepare('DELETE FROM products WHERE id = ?').run('aylux-auto-powder2');
  if (info.changes > 0) logger.info('[db] Deleted aylux-auto-powder2');

  markMigration('delete_aylux_auto_powder2_v1');
};

// ─── Drop the `testimonials` table (never wired to the UI) ─────────────────
//
// The table arrived from the staging-server export with three hand-seeded
// placeholder testimonials, but it was never wired to any frontend section
// or admin route — orphan storage. The owner decided not to display
// testimonials on the site, so we permanently drop both the rows and the
// schema. Re-introducing testimonials later means re-adding the CREATE TABLE
// statement explicitly, which is the right way: an unused table shouldn't
// hide silently in the schema waiting to confuse future readers.
//
// DROP TABLE IF EXISTS keeps the migration idempotent — already-dropped on
// some instances (the table never existed in the original seed) won't error.
const migrateDropTestimonials = () => {
  if (hasMigration('drop_testimonials_table_v1')) return;
  const rowCount = (() => {
    try { return db.prepare('SELECT COUNT(*) AS c FROM testimonials').get()?.c ?? 0; }
    catch { return 0; }
  })();
  db.exec('DROP TABLE IF EXISTS testimonials');
  markMigration('drop_testimonials_table_v1');
  if (rowCount > 0) logger.info(`[db] Dropped testimonials table (${rowCount} rows removed)`);
};

// ─── Normalize all existing weight values in DB ─────────────────────────────

const migrateNormalizeWeights = () => {
  if (hasMigration('normalize_weights_v2')) return;

  const products = db.prepare('SELECT id, weight, weight_count_table FROM products WHERE weight IS NOT NULL OR weight_count_table IS NOT NULL').all();
  const update = db.prepare('UPDATE products SET weight = @weight, weight_count_table = @wct WHERE id = @id');

  let changed = 0;
  for (const p of products) {
    const nw = normalizeWeight(p.weight);
    let nwct = p.weight_count_table;
    if (nwct) {
      try {
        const rows = JSON.parse(nwct);
        if (Array.isArray(rows)) nwct = JSON.stringify(rows.map(r => ({ ...r, weight: normalizeWeight(r.weight) })));
      } catch {}
    }
    if (nw !== p.weight || nwct !== p.weight_count_table) {
      update.run({ id: p.id, weight: nw, wct: nwct || null });
      changed++;
    }
  }

  markMigration('normalize_weights_v2');
  if (changed > 0) logger.info(`[db] Normalized weights for ${changed} products`);
};

// ─── News Migration ──────────────────────────────────────────────────────────

const migrateNews = () => {
  if (hasMigration('initial_news')) return;

  const newsItems = [
    {
      id: 'diox-dish-gel-launch', slug: 'diox-dish-gel-launch',
      image: '/diox/ديوكس جل غسيل الصحون.png', published_at: '2026-02-18',
      category: { ar: 'إطلاق منتج', en: 'Product launch', tr: 'Yeni urun', ru: 'Запуск продукта' },
      title: {
        ar: 'إطلاق جيل مطور من جل الصحون DIOX',
        en: 'Launching the new DIOX dishwashing gel line',
        tr: 'Yeni DIOX bulasik jeli serisinin lansmani',
        ru: 'Запуск новой линейки геля для посуды DIOX'
      },
      excerpt: {
        ar: 'أطلقنا تركيبة مطورة تمنح إزالة دهون أسرع وثبات رغوة أعلى لتلبية احتياجات شركائنا في أسواق التوزيع الجديدة.',
        en: 'We introduced an upgraded formula with faster grease removal and more stable foam for our expanding distribution markets.',
        tr: 'Yeni formulumuz daha hizli yag cozme ve daha dengeli kopuk performansi ile dagitim pazarlarimizin ihtiyaclarina yanit veriyor.',
        ru: 'Мы представили обновленную формулу с более быстрым удалением жира и стабильной пеной для новых рынков дистрибуции.'
      },
      body: {
        ar: ['أعلنت KARAHOCA عن إطلاق نسخة مطورة من جل غسيل الصحون ضمن علامة DIOX مع تركيز أعلى على الأداء اليومي وثبات النتائج في الاستخدام المنزلي والتجاري.','التركيبة الجديدة صممت لتوازن بين سرعة إزالة الدهون، سهولة الشطف، وثبات الرغوة، مع الحفاظ على المظهر البصري والهوية القوية التي تميز خط DIOX في نقاط البيع.','هذا الإطلاق يأتي ضمن خطتنا لتحديث المنتجات الأكثر طلباً في الأسواق الحالية وتهيئتها للتوسع في قنوات توزيع جديدة خلال الفترة القادمة.'],
        en: ['KARAHOCA has introduced an upgraded DIOX dishwashing gel designed to deliver stronger daily performance for both household and professional use.','The new formula balances quicker grease removal, easier rinsing, and more stable foam while preserving the bold shelf identity that defines the DIOX line.','This launch is part of our roadmap to refresh high-demand products and prepare them for wider distribution in the coming period.'],
        tr: ['KARAHOCA, evsel ve profesyonel kullanim icin daha guclu gunluk performans sunan gelistirilmis DIOX bulasik jeli formulu piyasaya sundu.','Yeni formul; daha hizli yag cozme, daha kolay durulama ve daha stabil kopuk dengesini ayni urunde toplarken DIOX serisinin guclu raf kimligini de koruyor.','Bu lansman, yuksek talep goren urunleri yenileme ve onlari daha genis dagitim kanallarina hazirlama planimizin bir parcasidir.'],
        ru: ['KARAHOCA представила обновленный гель для мытья посуды DIOX, рассчитанный на более высокую ежедневную эффективность как в бытовом, так и в профессиональном использовании.','Новая формула сочетает более быстрое удаление жира, легкое смывание и стабильную пену, сохраняя при этом узнаваемую визуальную айдентику линейки DIOX.','Этот запуск является частью нашей программы по обновлению самых востребованных продуктов и подготовке их к расширению каналов дистрибуции.']
      }
    },
    {
      id: 'north-africa-distribution', slug: 'north-africa-distribution',
      image: '/KARAHOCA-1-newPhoto.webp', published_at: '2026-01-12',
      category: { ar: 'عقود وتوزيع', en: 'Contracts & distribution', tr: 'Anlasmalar ve dagitim', ru: 'Контракты и дистрибуция' },
      title: {
        ar: 'اتفاقيات توزيع جديدة لدعم حضورنا الإقليمي',
        en: 'New distribution agreements to expand our regional reach',
        tr: 'Bolgesel varligimizi buyuten yeni dagitim anlasmalari',
        ru: 'Новые дистрибьюторские соглашения для расширения регионального присутствия'
      },
      excerpt: {
        ar: 'وسعنا شبكة شركائنا من خلال اتفاقيات جديدة تستهدف رفع الجاهزية اللوجستية وتسريع الوصول إلى العملاء في أسواق استراتيجية.',
        en: 'We expanded our partner network with new agreements focused on logistics readiness and faster access to customers in strategic markets.',
        tr: 'Lojistik hazirlik ve stratejik pazarlarda musterilere daha hizli ulasim hedefiyle partner agimizi yeni anlasmalarla genislettik.',
        ru: 'Мы расширили партнерскую сеть новыми соглашениями, ориентированными на логистическую готовность и более быстрый доступ к клиентам на стратегических рынках.'
      },
      body: {
        ar: ['خلال الربع الأول من العام، أتمت KARAHOCA سلسلة اتفاقيات توزيع جديدة مع شركاء إقليميين لدعم انتشار منتجاتنا في أسواق ذات طلب متزايد على حلول التنظيف عالية الجودة.','التركيز في هذه الاتفاقيات كان على جاهزية المخزون، سرعة التوريد، وتخصيص التشكيلات المناسبة لكل سوق بما يتماشى مع سلوك الاستهلاك المحلي.','هذه الخطوة تعزز حضورنا التجارِوتمنحنا مرونة أكبر في خدمة عملائنا وشركائنا على نطاق جغرافي أوسع.'],
        en: ['During the first quarter, KARAHOCA completed a new group of distribution agreements with regional partners to support the rollout of our cleaning portfolio in high-demand markets.','These agreements focus on stock readiness, faster supply, and assortment planning tailored to the needs of each local market.','The move strengthens our commercial presence and gives us greater flexibility in serving partners and customers across a wider geography.'],
        tr: ['Yilin ilk ceyreginde KARAHOCA, yuksek talep potansiyeline sahip pazarlarda urun portfoyumuzu guclendirmek icin bolgesel partnerlerle yeni dagitim anlasmalari tamamladi.','Bu anlasmalar; stok hazirligi, daha hizli tedarik ve her pazar icin uygun urun karmasinin planlanmasi uzerine kuruldu.','Bu adim ticari varligimizi guclendirirken partnerlerimize ve musterilerimize daha genis bir cografyada daha esnek hizmet sunmamizi sagliyor.'],
        ru: ['В первом квартале KARAHOCA заключила новую серию дистрибьюторских соглашений с региональными партнерами для усиления присутствия нашего портфеля в рынках с высоким спросом.','Ключевой акцент в соглашениях сделан на готовности складских запасов, скорости поставок и формировании ассортимента под особенности каждого рынка.','Этот шаг усиливает наше коммерческое присутствие и дает нам больше гибкости в обслуживании партнеров и клиентов на более широкой географии.']
      }
    },
    {
      id: 'industry-exhibitions', slug: 'industry-exhibitions',
      image: '/KARAHOCA-4-web.webp', published_at: '2025-11-07',
      category: { ar: 'المعارض والفعاليات', en: 'Exhibitions & events', tr: 'Fuarlar ve etkinlikler', ru: 'Выставки и мероприятия' },
      title: {
        ar: 'مشاركتنا في المعارض الصناعية المتخصصة',
        en: 'Our participation in specialized industry exhibitions',
        tr: 'Uzmanlik fuarlarina katilimimiz',
        ru: 'Наше участие в профильных отраслевых выставках'
      },
      excerpt: {
        ar: 'نواصل الظهور في الفعاليات المهنية لعرض منتجاتنا، لقاء الشركاء، وقراءة اتجاهات السوق عن قرب.',
        en: 'We continue to join professional events to present our products, meet partners, and read market shifts up close.',
        tr: 'Urunlerimizi sergilemek, partnerlerle bulusmak ve pazar yonelimlerini yakindan okumak icin profesyonel etkinliklerde yer almaya devam ediyoruz.',
        ru: 'Мы продолжаем участвовать в профессиональных мероприятиях, чтобы представлять продукцию, встречаться с партнерами и ближе отслеживать изменения рынка.'
      },
      body: {
        ar: ['تعد المعارض المتخصصة مساحة مهمة لعرض تطور منتجات KARAHOCA وتقديم علامتَي DIOX وAYLUX أمام موزعين ومشترين من قطاعات مختلفة.','خلال مشاركاتنا الأخيرة، ركزنا على إبراز قوة خط الإنتاج، مرونة التعبئة، وإمكانيات الشراكات طويلة المدى في الأسواق المستهدفة.','وجودنا في هذه الفعاليات لا يقتصر على العرض فقط، بل يشكل أيضاً قناة مباشرة لفهم احتياجات السوق وتغذية خططنا التطويرية القادمة.'],
        en: ['Specialized exhibitions remain an important space for KARAHOCA to showcase product development and present both DIOX and AYLUX to distributors and buyers from multiple sectors.','In our recent participation, we highlighted manufacturing strength, packaging flexibility, and our ability to build long-term market partnerships.','These events are not only about visibility; they are also a direct channel for understanding demand and feeding that insight back into future product planning.'],
        tr: ['Uzmanlik fuarlari, KARAHOCA icin urun gelisimini sergilemek ve hem DIOX hem de AYLUX markalarini farkli sektorlerden distribütorler ve satin almacilarla bulusturmak adina onemli bir alan olmaya devam ediyor.','Son katilimlarimizda uretim gucu, ambalaj esnekligi ve uzun vadeli pazar ortakliklari kurma kabiliyetimiz one cikti.','Bu etkinlikler yalnizca gorunurluk saglamiyor; ayni zamanda talebi dogrudan anlamamiza ve bu icgoruleri sonraki urun planlarina aktarmamiza yardimci oluyor.'],
        ru: ['Профильные выставки остаются для KARAHOCA важной площадкой, где мы демонстрируем развитие продуктов и представляем бренды DIOX и AYLUX дистрибьюторам и закупщикам из разных отраслей.','В рамках последних участий мы акцентировали внимание на производственной мощности, гибкости упаковки и потенциале долгосрочных партнерств на целевых рынках.','Такие мероприятия важны не только для узнаваемости, но и как прямой канал понимания спроса и передачи этих знаний в будущие продуктовые планы.']
      }
    },
    {
      id: 'production-upgrade', slug: 'production-upgrade',
      image: '/KARAHOCA-2-wb.webp', published_at: '2025-09-03',
      category: { ar: 'التطوير والتشغيل', en: 'Operations & upgrades', tr: 'Operasyon ve gelistirme', ru: 'Производство и модернизация' },
      title: {
        ar: 'توسعة تشغيلية لرفع كفاءة خطوط الإنتاج',
        en: 'Operational expansion to improve production efficiency',
        tr: 'Uretim verimliligini artiran operasyonel genisleme',
        ru: 'Операционное расширение для повышения эффективности производства'
      },
      excerpt: {
        ar: 'واصلنا تحديث بيئة الإنتاج لرفع الاستقرار التشغيلي، تحسين التدفق، والاستجابة بشكل أسرع لطلبات العملاء المتزايدة.',
        en: 'We continued upgrading the production environment to strengthen operational stability, improve flow, and respond faster to growing demand.',
        tr: 'Artan talebe daha hizli yanit verebilmek icin uretim ortamini gelistirmeyi, akis verimliligini ve operasyonel istikrari guclendirmeyi surdurduk.',
        ru: 'Мы продолжили модернизацию производственной среды, чтобы повысить операционную стабильность, улучшить поток и быстрее реагировать на растущий спрос.'
      },
      body: {
        ar: ['ضمن خطتنا للتطوير المستمر، نفذت KARAHOCA حزمة تحديثات تشغيلية استهدفت تحسين تدفق العمل داخل المرافق ورفع كفاءة الاستفادة من الطاقة الإنتاجية.','شملت التحديثات تحسين جاهزية بعض المراحل، تنظيم الحركة الداخلية للمواد، ورفع مرونة الاستجابة عند اختلاف أحجام الطلبات بين الأسواق والعملاء.','هذا التطور التشغيلي يدعم قدرتنا على الحفاظ على الجودة مع تسليم أكثر استقراراً وسرعة في المشاريع الحالية والمستقبلية.'],
        en: ['As part of our continuous improvement roadmap, KARAHOCA implemented a new package of operational upgrades to improve workflow across the facility and make better use of production capacity.','The upgrades included stronger stage readiness, improved internal material flow, and greater flexibility in handling different order sizes across markets and customer groups.','This operational step supports our ability to maintain quality while delivering with more consistency and speed in current and upcoming projects.'],
        tr: ['Surekli gelisim yol haritamizin bir parcasi olarak KARAHOCA, tesis icindeki is akislarini iyilestiren ve uretim kapasitesinden daha verimli yararlanilmasini saglayan yeni bir operasyonel gelistirme paketi uyguladi.','Bu guncellemeler; asama hazirligini guclendirmeyi, ic malzeme akislarini iyilestirmeyi ve farkli siparis hacimlerine daha esnek yanit verebilmeyi kapsadi.','Bu operasyonel adim, kaliteyi korurken mevcut ve gelecek projelerde daha istikrarli ve hizli teslimat yapmamizi destekliyor.'],
        ru: ['В рамках программы непрерывного развития KARAHOCA внедрила новый пакет операционных улучшений, направленных на оптимизацию рабочих процессов на площадке и более эффективное использование производственной мощности.','Обновления включали повышение готовности отдельных этапов, улучшение внутреннего потока материалов и большую гибкость при работе с разными объемами заказов по рынкам и клиентским группам.','Этот шаг усиливает нашу способность сохранять качество и обеспечивать более стабильные и быстрые поставки по текущим и будущим проектам.']
      }
    },
  ];

  const insertNews = db.prepare(`
    INSERT OR IGNORE INTO news(
      id, slug, image, published_at,
      category_ar, category_en, category_tr, category_ru,
      title_ar, title_en, title_tr, title_ru,
      excerpt_ar, excerpt_en, excerpt_tr, excerpt_ru,
      body_ar, body_en, body_tr, body_ru,
      active
    ) VALUES(
      @id, @slug, @image, @published_at,
      @cat_ar, @cat_en, @cat_tr, @cat_ru,
      @title_ar, @title_en, @title_tr, @title_ru,
      @excerpt_ar, @excerpt_en, @excerpt_tr, @excerpt_ru,
      @body_ar, @body_en, @body_tr, @body_ru,
      1
    )
  `);

  for (const item of newsItems) {
    insertNews.run({
      id: item.id, slug: item.slug, image: normalizeLegacyCatalogAssetPath(item.image), published_at: item.published_at,
      cat_ar: item.category.ar, cat_en: item.category.en, cat_tr: item.category.tr, cat_ru: item.category.ru,
      title_ar: item.title.ar, title_en: item.title.en, title_tr: item.title.tr, title_ru: item.title.ru,
      excerpt_ar: item.excerpt.ar, excerpt_en: item.excerpt.en, excerpt_tr: item.excerpt.tr, excerpt_ru: item.excerpt.ru,
      body_ar: JSON.stringify(item.body.ar), body_en: JSON.stringify(item.body.en),
      body_tr: JSON.stringify(item.body.tr), body_ru: JSON.stringify(item.body.ru),
    });
  }

  markMigration('initial_news');
  logger.info('[db] News migration complete');
};

// ─── Newsletter Migration ────────────────────────────────────────────────────

const migrateNewsletter = () => {
  if (hasMigration('initial_newsletter')) return;

  if (!existsSync(newsletterFile)) {
    markMigration('initial_newsletter');
    return;
  }

  try {
    const raw = readFileSync(newsletterFile, 'utf8');
    const subscribers = JSON.parse(raw);
    if (!Array.isArray(subscribers)) { markMigration('initial_newsletter'); return; }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO newsletter_subscribers(email, subscribed_at, unsubscribe_key)
      VALUES(@email, @subscribed_at, @unsubscribe_key)
    `);

    for (const s of subscribers) {
      if (s.email) {
        insert.run({
          email: s.email,
          subscribed_at: s.subscribedAt || new Date().toISOString(),
          unsubscribe_key: createUniqueNewsletterSubscriberKey(),
        });
      }
    }
    logger.info(`[db] Newsletter migration: ${subscribers.length} subscribers`);
  } catch (e) {
    logger.error('[db] Newsletter migration failed:', e.message);
  }

  markMigration('initial_newsletter');
};

// ─── Stats helpers ───────────────────────────────────────────────────────────

export const incrementStat = (metric) => {
  const today = new Date().toISOString().slice(0, 10);
  getDb().prepare(`
    INSERT INTO daily_stats(date, metric, value) VALUES(?, ?, 1)
    ON CONFLICT(date, metric) DO UPDATE SET value = value + 1
  `).run(today, metric);
};

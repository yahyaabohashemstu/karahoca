import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'karahoca.db');
const localesDir = path.join(__dirname, '..', 'src', 'locales');
const newsletterFile = path.join(__dirname, 'data', 'newsletter.json');

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

// ─── Init DB ────────────────────────────────────────────────────────────────

let db;

export const getDb = () => {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
};

export const initDb = () => {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema();
  migrateInitialData();
  return db;
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
      active INTEGER DEFAULT 1
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
  // Add image_url column to email_campaigns if missing
  try { db.exec("ALTER TABLE email_campaigns ADD COLUMN image_url TEXT"); } catch { /* already exists */ }
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
    { id: 'aylux-laundry', brand: 'AYLUX', key: 'laundry', order: 1, titleKey: 'aylux.categories.laundry' },
    { id: 'aylux-personal',brand: 'AYLUX', key: 'personal', order: 2, titleKey: 'aylux.categories.personal' },
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
      image: '/diox/ديوكس منظف عام.png', weight: '750ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.generalCleaner' },
    { id: 'diox-super-gel', cat: 'diox-home', order: 1,
      image: '/diox/ديوكس سوبر جل.png', weight: '450ml / 900ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.superGel' },
    { id: 'diox-floor-fragrance', cat: 'diox-home', order: 2,
      image: '/diox/ديوكس معطر أرضيات.png', weight: '600ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.floorFragrance' },
    { id: 'diox-floor-fragrance2', cat: 'diox-home', order: 3,
      image: '/diox/ديوكس معطر الأرضيات.png', weight: '600ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.floorFragrance2' },
    { id: 'diox-glass-cleaner', cat: 'diox-home', order: 4,
      image: '/diox/ديوكس منظف الزجاج.png', weight: '750ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.glassCleaner' },
    { id: 'diox-chlorine', cat: 'diox-home', order: 5,
      image: '/diox/ديوكس كلور.png', weight: '900ml / 5L', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.chlorine' },
    { id: 'diox-oven-cleaner', cat: 'diox-home', order: 6,
      image: '/diox/ديوكس منظف الأفران.png', weight: '750ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.ovenCleaner' },
    { id: 'diox-flash', cat: 'diox-home', order: 7,
      image: '/diox/ديوكس فلاش.png', weight: '900ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.flash' },
    { id: 'diox-bathroom-cleaner', cat: 'diox-home', order: 8,
      image: '/diox/ديوكس منظف الحمام.png', weight: '750ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.bathroomCleaner' },
    { id: 'diox-dish-gel', cat: 'diox-home', order: 9,
      image: '/diox/ديوكس جل غسيل الصحون.png', weight: '1.5kg', mat: 'plasticBottle', count: 4, plural: true,
      k: 'diox.products.home.dishGel' },
    { id: 'diox-dish-liquid1', cat: 'diox-home', order: 10,
      image: '/diox/ديوكس سائل غسيل الصحون (1).png', weight: '700ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.home.dishLiquid1' },
    { id: 'diox-dish-liquid2', cat: 'diox-home', order: 11,
      image: '/diox/ديوكس سائل غسيل الصحون (2).png', weight: '3L', mat: 'plasticBottle', count: 4, plural: true,
      k: 'diox.products.home.dishLiquid2' },
    // Laundry
    { id: 'diox-auto-powder1', cat: 'diox-laundry', order: 0,
      image: '/diox/ديوكس مسحوق غسيل أوتوماتيك (1).png', weight: '2.5kg / 4.5kg', mat: 'plasticBag', count: 4, plural: true,
      k: 'diox.products.laundry.autoPowder1' },
    { id: 'diox-auto-powder2', cat: 'diox-laundry', order: 1,
      image: '/diox/ديوكس مسحوق غسيل أوتوماتيك (2).png', weight: '2.5kg / 4.5kg', mat: 'plasticBag', count: 4, plural: true,
      k: 'diox.products.laundry.autoPowder2' },
    { id: 'diox-liquid-detergent', cat: 'diox-laundry', order: 2,
      image: '/diox/ديوكس سائل غسيل (1).png', weight: '900ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.laundry.liquidDetergent' },
    { id: 'diox-fabric-softener', cat: 'diox-laundry', order: 3,
      image: '/diox/ديوكس مطري الغسيل.png', weight: '900ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.laundry.fabricSoftener' },
    { id: 'diox-stain-remover', cat: 'diox-laundry', order: 4,
      image: '/diox/ديوكس مزيل البقع.png', weight: '900ml', mat: 'plasticBottle', count: 12, plural: false,
      k: 'diox.products.laundry.stainRemover' },
    { id: 'diox-regular-powder', cat: 'diox-laundry', order: 5,
      image: '/diox/ديوكس مسحوق غسيل عادي.png', weight: '150g / 1.2kg / 3.5kg / 9kg', mat: 'plasticBag', count: 6, plural: true,
      k: 'diox.products.laundry.regularPowder' },
    // Personal
    { id: 'diox-liquid-soap', cat: 'diox-personal', order: 0,
      image: '/diox/ديوكس صابون سائل.png', weight: '400ml / 3L', mat: 'plasticBottle', count: 12, plural: false,
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
    { id: 'aylux-dish-liquid1', cat: 'aylux-home', order: 10,
      image: '/aylux/آيلوكس سائل غسيل الصحون (1).png', k: 'aylux.products.home.dishLiquid1' },
    { id: 'aylux-dish-liquid2', cat: 'aylux-home', order: 11,
      image: '/aylux/آيلوكس سائل غسيل الصحون (2).png', k: 'aylux.products.home.dishLiquid2' },
    // Laundry
    { id: 'aylux-auto-powder1', cat: 'aylux-laundry', order: 0,
      image: '/aylux/آيلوكس مسحوق غسيل أوتوماتيك (1).png', k: 'aylux.products.laundry.autoPowder1' },
    { id: 'aylux-auto-powder2', cat: 'aylux-laundry', order: 1,
      image: '/aylux/آيلوكس مسحوق غسيل أوتوماتيك (2).png', k: 'aylux.products.laundry.autoPowder2' },
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
      image: p.image,
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
      image: p.image,
      alt_ar: t('ar', `${p.k}.alt`), alt_en: t('en', `${p.k}.alt`),
      alt_tr: t('tr', `${p.k}.alt`), alt_ru: t('ru', `${p.k}.alt`),
      weight: t('ar', `${p.k}.weight`) !== `${p.k}.weight` ? t('ar', `${p.k}.weight`) : '',
      mat_ar: t('ar', `${p.k}.material`), mat_en: t('en', `${p.k}.material`),
      mat_tr: t('tr', `${p.k}.material`), mat_ru: t('ru', `${p.k}.material`),
      cnt_ar: t('ar', `${p.k}.count`), cnt_en: t('en', `${p.k}.count`),
      cnt_tr: t('tr', `${p.k}.count`), cnt_ru: t('ru', `${p.k}.count`),
      display_order: p.order,
    });
  }

  markMigration('initial_products');
  console.log('[db] Products migration complete');
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
        ar: ['خلال الربع الأول من العام، أتمت KARAHOCA سلسلة اتفاقيات توزيع جديدة مع شركاء إقليميين لدعم انتشار منتجاتنا في أسواق ذات طلب متزايد على حلول التنظيف عالية الجودة.','التركيز في هذه الاتفاقيات كان على جاهزية المخزون، سرعة التوريد، وتخصيص التشكيلات المناسبة لكل سوق بما يتماشى مع سلوك الاستهلاك المحلي.','هذه الخطوة تعزز حضورنا التجاري وتمنحنا مرونة أكبر في خدمة عملائنا وشركائنا على نطاق جغرافي أوسع.'],
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
      id: item.id, slug: item.slug, image: item.image, published_at: item.published_at,
      cat_ar: item.category.ar, cat_en: item.category.en, cat_tr: item.category.tr, cat_ru: item.category.ru,
      title_ar: item.title.ar, title_en: item.title.en, title_tr: item.title.tr, title_ru: item.title.ru,
      excerpt_ar: item.excerpt.ar, excerpt_en: item.excerpt.en, excerpt_tr: item.excerpt.tr, excerpt_ru: item.excerpt.ru,
      body_ar: JSON.stringify(item.body.ar), body_en: JSON.stringify(item.body.en),
      body_tr: JSON.stringify(item.body.tr), body_ru: JSON.stringify(item.body.ru),
    });
  }

  markMigration('initial_news');
  console.log('[db] News migration complete');
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
      INSERT OR IGNORE INTO newsletter_subscribers(email, subscribed_at)
      VALUES(@email, @subscribed_at)
    `);

    for (const s of subscribers) {
      if (s.email) {
        insert.run({ email: s.email, subscribed_at: s.subscribedAt || new Date().toISOString() });
      }
    }
    console.log(`[db] Newsletter migration: ${subscribers.length} subscribers`);
  } catch (e) {
    console.error('[db] Newsletter migration failed:', e.message);
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

import type { TFunction } from 'i18next';
import { normalizeLanguageCode, type SupportedLanguageCode } from '../../utils/language';
import { getBrandCatalogs, type BrandCatalogData, type BrandProductInfo } from '../../data/brandCatalog';
import { getLocalizedNewsItems, type LocalizedNewsItem } from '../../data/news';
import type { KnowledgeSection } from './types';
import { getCachedAiContext } from './context';

// ─── Text normalisation & tokenisation ────────────────────────────────────

const normalizeSearchText = (value: string) =>
  value
    .replace(/\u0130/g, 'i')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[()[\]{}.,/#!$%^&*;:{}=_`~?"'|\\+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeSearchText = (value: string) =>
  normalizeSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 2);

// ─── Ranking of knowledge sections against the customer's question ────────

const scoreKnowledgeSection = (question: string, section: KnowledgeSection) => {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) return 0;

  const questionTokens = tokenizeSearchText(question);
  if (questionTokens.length === 0) return 0;

  const sectionTitle = normalizeSearchText(section.title);
  const sectionContent = normalizeSearchText(section.content);
  const sectionTags = normalizeSearchText((section.tags || []).join(' '));

  let score = 0;
  for (const token of questionTokens) {
    if (sectionTitle.includes(token)) score += 4;
    if (sectionTags.includes(token)) score += 3;
    if (sectionContent.includes(token)) score += 1;
  }
  if (sectionTitle.includes(normalizedQuestion)) score += 8;
  if (sectionContent.includes(normalizedQuestion)) score += 5;
  return score;
};

const dedupeKnowledgeSections = (sections: KnowledgeSection[]) => {
  const seenTitles = new Set<string>();
  return sections.filter((section) => {
    const normalizedTitle = normalizeSearchText(section.title);
    if (seenTitles.has(normalizedTitle)) return false;
    seenTitles.add(normalizedTitle);
    return true;
  });
};

const selectRelevantKnowledgeSections = (
  question: string,
  sections: KnowledgeSection[],
  maxSections: number,
) => {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) return dedupeKnowledgeSections(sections).slice(0, maxSections);

  const scoredSections = sections
    .map((section) => ({ section, score: scoreKnowledgeSection(question, section) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.section);

  return dedupeKnowledgeSections(scoredSections).slice(0, maxSections);
};

// ─── Catalog-derived sections ─────────────────────────────────────────────

const buildCatalogLine = (
  brand: BrandCatalogData['brand'],
  categoryTitle: string,
  product: BrandProductInfo,
) => {
  const details = [
    product.details?.weight ? `Weight: ${product.details.weight}` : null,
    product.details?.material ? `Material: ${product.details.material}` : null,
    product.details?.count ? `Count: ${product.details.count}` : null,
  ].filter(Boolean);
  return `- ${brand} | ${categoryTitle} | ${product.name}: ${product.description}${
    details.length > 0 ? ` | ${details.join(' | ')}` : ''
  }`;
};

const stripBrandTokens = (value: string) =>
  value
    .replace(/\b(diox|aylux|karahoca)\b/gi, ' ')
    .replace(/ديوكس|آيلوكس|ايلوكس|كراهوكا/gu, ' ')
    .replace(/\b[12]\b/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getFamilyLabel = (name: string) => stripBrandTokens(name);
const getFamilyKey = (name: string) => normalizeSearchText(getFamilyLabel(name));

type FlattenedCatalogEntry = {
  brand: BrandCatalogData['brand'];
  categoryTitle: string;
  product: BrandProductInfo;
  familyKey: string;
  familyLabel: string;
};

const flattenCatalogEntries = (catalogs: BrandCatalogData[]): FlattenedCatalogEntry[] =>
  catalogs.flatMap((catalog) =>
    catalog.categories.flatMap((category) =>
      category.products.map((product) => ({
        brand: catalog.brand,
        categoryTitle: category.title,
        product,
        familyKey: getFamilyKey(product.name),
        familyLabel: getFamilyLabel(product.name),
      })),
    ),
  );

const comparisonPattern =
  /compare|comparison|vs|versus|difference|different|مقارنة|قارن|مقارن|فرق|karşılaştır|karşılaştırma|fark|сравн|разниц/u;

const productPattern =
  /product|products|cleaner|cleaning|gel|liquid|powder|soap|freshener|منتج|منتجات|منظف|تنظيف|جل|سائل|مسحوق|صابون|معطر|ürün|temizlik|jel|sıvı|toz|sabun|освеж|продукт|товар|гель|жидк|порош|мыло/u;

const shouldPrioritizeProductKnowledge = (question: string) =>
  comparisonPattern.test(question) || productPattern.test(question);

const getMatchedCatalogEntries = (question: string, catalogs: BrandCatalogData[]) => {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion || !shouldPrioritizeProductKnowledge(normalizedQuestion)) return [];

  return flattenCatalogEntries(catalogs)
    .map((entry) => {
      const brandMatch = normalizedQuestion.includes(entry.brand.toLowerCase()) ? 1 : 0;
      const familyPhraseMatch =
        entry.familyKey && normalizedQuestion.includes(entry.familyKey) ? 3 : 0;
      const familyTokens = entry.familyKey.split(' ').filter((token) => token.length >= 3);
      const tokenMatches = familyTokens.filter((token) => normalizedQuestion.includes(token)).length;
      return { ...entry, score: brandMatch + familyPhraseMatch + tokenMatches };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
};

const getFocusedProductGroups = (question: string, catalogs: BrandCatalogData[]) => {
  const matchedEntries = getMatchedCatalogEntries(question, catalogs);
  if (matchedEntries.length === 0) return [];

  const groupedByFamily = new Map<string, typeof matchedEntries>();
  for (const entry of matchedEntries) {
    const group = groupedByFamily.get(entry.familyKey) || [];
    group.push(entry);
    groupedByFamily.set(entry.familyKey, group);
  }

  return [...groupedByFamily.values()]
    .sort((left, right) => right[0].score - left[0].score)
    .slice(0, 4);
};

const buildBrandComparisonSection = (catalogs: BrandCatalogData[]): KnowledgeSection => {
  const dioxCatalog = catalogs.find((catalog) => catalog.brand === 'DIOX');
  const ayluxCatalog = catalogs.find((catalog) => catalog.brand === 'AYLUX');
  const entries = flattenCatalogEntries(catalogs);
  const familyGroups = new Map<
    string,
    { label: string; brands: Set<BrandCatalogData['brand']> }
  >();

  for (const entry of entries) {
    const existing = familyGroups.get(entry.familyKey);
    if (existing) {
      existing.brands.add(entry.brand);
      continue;
    }
    familyGroups.set(entry.familyKey, { label: entry.familyLabel, brands: new Set([entry.brand]) });
  }

  const sharedFamilies = [...familyGroups.values()]
    .filter((group) => group.brands.size > 1)
    .map((group) => group.label)
    .sort((left, right) => left.localeCompare(right));

  const dioxOnlyFamilies = [...familyGroups.values()]
    .filter((group) => group.brands.size === 1 && group.brands.has('DIOX'))
    .map((group) => group.label)
    .sort((left, right) => left.localeCompare(right));

  const ayluxOnlyFamilies = [...familyGroups.values()]
    .filter((group) => group.brands.size === 1 && group.brands.has('AYLUX'))
    .map((group) => group.label)
    .sort((left, right) => left.localeCompare(right));

  const categoryComparisonLines =
    dioxCatalog && ayluxCatalog
      ? dioxCatalog.categories.map((category, index) => {
          const ayluxCategory = ayluxCatalog.categories[index];
          const categoryLabel = category.title || ayluxCategory?.title || `Category ${index + 1}`;
          return `${categoryLabel}: DIOX ${category.products.length} products | AYLUX ${
            ayluxCategory?.products.length ?? 0
          } products`;
        })
      : [];

  const totalDioxProducts = dioxCatalog
    ? dioxCatalog.categories.reduce((count, category) => count + category.products.length, 0)
    : 0;
  const totalAyluxProducts = ayluxCatalog
    ? ayluxCatalog.categories.reduce((count, category) => count + category.products.length, 0)
    : 0;

  return {
    title: 'Website catalog comparison snapshot',
    content: [
      `DIOX currently shows ${totalDioxProducts} products on the website. AYLUX currently shows ${totalAyluxProducts} products on the website.`,
      categoryComparisonLines.length > 0
        ? `Category-by-category counts:\n- ${categoryComparisonLines.join('\n- ')}`
        : null,
      sharedFamilies.length > 0
        ? `Shared product families visible in both brands:\n- ${sharedFamilies.join('\n- ')}`
        : null,
      dioxOnlyFamilies.length > 0
        ? `Product families currently visible only under DIOX:\n- ${dioxOnlyFamilies.join('\n- ')}`
        : null,
      ayluxOnlyFamilies.length > 0
        ? `Product families currently visible only under AYLUX:\n- ${ayluxOnlyFamilies.join('\n- ')}`
        : null,
      'When a customer asks for a general comparison, mention concrete catalog facts such as category counts, shared families, and any visible differences in range breadth.',
    ]
      .filter(Boolean)
      .join('\n'),
    tags: ['comparison', 'products', 'catalog', 'snapshot'],
  };
};

const buildFocusedComparisonSection = (
  question: string,
  catalogs: BrandCatalogData[],
): KnowledgeSection | null => {
  const focusedGroups = getFocusedProductGroups(question, catalogs);
  if (focusedGroups.length === 0) return null;

  const familySections = focusedGroups.map((group) => {
    const lines = group
      .sort((left, right) => left.brand.localeCompare(right.brand))
      .map((entry) => buildCatalogLine(entry.brand, entry.categoryTitle, entry.product));
    return `${group[0].familyLabel}:\n${lines.join('\n')}`;
  });

  return {
    title: 'Focused product matches for this question',
    content: ['Use the matched entries below before giving a generic answer.', ...familySections].join('\n'),
    tags: ['comparison', 'products', 'matched'],
  };
};

const buildCatalogSection = (catalog: BrandCatalogData): KnowledgeSection => {
  const totalProducts = catalog.categories.reduce(
    (count, category) => count + category.products.length,
    0,
  );
  const categorySummaries = catalog.categories.map((category) => {
    const productNames = category.products.map((product) => product.name).join(', ');
    return `- ${category.title} (${category.products.length} products): ${productNames}`;
  });
  return {
    title: `${catalog.brand} website catalog overview`,
    content: [
      `This section summarizes the current ${catalog.brand} product names visible on the website.`,
      `${catalog.brand} currently shows ${totalProducts} products across ${catalog.categories.length} categories.`,
      ...categorySummaries,
    ].join('\n'),
    tags: [catalog.brand.toLowerCase(), 'products', 'catalog', 'website-sections'],
  };
};

// ─── i18n-driven website sections ─────────────────────────────────────────

type SiteSnapshot = {
  language: SupportedLanguageCode;
  contact: {
    address: string;
    email: string;
    phone: string;
    whatsapp: string;
    newsletterTitle: string;
    newsletterDescription: string;
    footerDescription: string;
  };
  about: {
    heroDescription: string;
    history: string[];
    milestones: Array<{ year: string; title: string; description: string }>;
    visionDescription: string;
    stats: Array<{ value: string; label: string }>;
    values: Array<{ title: string; description: string }>;
  };
  production: {
    heroDescription: string;
    processSubtitle: string;
    processCards: Array<{ title: string; description: string }>;
    safetyContent: string[];
  };
  goal: {
    heroDescription: string;
    pillarsSubtitle: string;
    pillars: Array<{ title: string; description: string }>;
    goalsContent: string[];
  };
  dryer: {
    heroDescription: string;
    pillarsSubtitle: string;
    pillars: Array<{ title: string; description: string }>;
    goalsContent: string[];
  };
  news: LocalizedNewsItem[];
};

const WEBSITE_WHATSAPP_NUMBER = '+90 530 591 4990';

const toSupportedLanguageCode = (language: string): SupportedLanguageCode =>
  normalizeLanguageCode(language) as SupportedLanguageCode;

const buildSiteSnapshot = (t: TFunction, language: string = 'ar'): SiteSnapshot => {
  const normalizedLanguage = toSupportedLanguageCode(language);
  return {
    language: normalizedLanguage,
    contact: {
      address: t('footer.contact.address'),
      email: t('footer.contact.email'),
      phone: t('footer.contact.phone'),
      whatsapp: WEBSITE_WHATSAPP_NUMBER,
      newsletterTitle: t('footer.newsletter.title'),
      newsletterDescription: t('footer.newsletter.description'),
      footerDescription: t('footer.description'),
    },
    about: {
      heroDescription: t('aboutPage.hero.description'),
      history: [t('aboutPage.history.paragraph1'), t('aboutPage.history.paragraph2')],
      milestones: [
        { year: t('aboutPage.milestones.year1.year'), title: t('aboutPage.milestones.year1.title'), description: t('aboutPage.milestones.year1.description') },
        { year: t('aboutPage.milestones.year2.year'), title: t('aboutPage.milestones.year2.title'), description: t('aboutPage.milestones.year2.description') },
        { year: t('aboutPage.milestones.year3.year'), title: t('aboutPage.milestones.year3.title'), description: t('aboutPage.milestones.year3.description') },
      ],
      visionDescription: t('aboutPage.vision.description'),
      stats: [
        { value: '15+', label: t('aboutPage.vision.countries') },
        { value: '30+', label: t('aboutPage.vision.experience') },
        { value: '2', label: t('aboutPage.vision.brands') },
        { value: '4', label: t('aboutPage.vision.industries') },
      ],
      values: [
        { title: t('aboutPage.values.quality.title'), description: t('aboutPage.values.quality.description') },
        { title: t('aboutPage.values.innovation.title'), description: t('aboutPage.values.innovation.description') },
        { title: t('aboutPage.values.sustainability.title'), description: t('aboutPage.values.sustainability.description') },
      ],
    },
    production: {
      heroDescription: t('production.heroDescription'),
      processSubtitle: t('production.sections.process.subtitle'),
      processCards: [
        { title: t('production.sections.process.cards.sourcing.title'), description: t('production.sections.process.cards.sourcing.description') },
        { title: t('production.sections.process.cards.mixing.title'), description: t('production.sections.process.cards.mixing.description') },
        { title: t('production.sections.process.cards.packaging.title'), description: t('production.sections.process.cards.packaging.description') },
      ],
      safetyContent: [
        t('production.sections.safety.content1'),
        t('production.sections.safety.content2'),
        t('production.sections.safety.content3'),
      ],
    },
    goal: {
      heroDescription: t('goal.heroDescription'),
      pillarsSubtitle: t('goal.sections.pillars.subtitle'),
      pillars: [
        { title: t('goal.sections.pillars.innovation.title'), description: t('goal.sections.pillars.innovation.description') },
        { title: t('goal.sections.pillars.expansion.title'), description: t('goal.sections.pillars.expansion.description') },
        { title: t('goal.sections.pillars.quality.title'), description: t('goal.sections.pillars.quality.description') },
      ],
      goalsContent: [
        t('goal.sections.goals.content1'),
        t('goal.sections.goals.content2'),
        t('goal.sections.goals.content3'),
      ],
    },
    dryer: {
      heroDescription: t('dryer.heroDescription'),
      pillarsSubtitle: t('dryer.sections.pillars.subtitle'),
      pillars: [
        { title: t('dryer.sections.pillars.cards.capacity.title'), description: t('dryer.sections.pillars.cards.capacity.description') },
        { title: t('dryer.sections.pillars.cards.integration.title'), description: t('dryer.sections.pillars.cards.integration.description') },
        { title: t('dryer.sections.pillars.cards.consistency.title'), description: t('dryer.sections.pillars.cards.consistency.description') },
      ],
      goalsContent: [
        t('dryer.sections.goals.content1'),
        t('dryer.sections.goals.content2'),
        t('dryer.sections.goals.content3'),
      ],
    },
    news: getLocalizedNewsItems(normalizedLanguage),
  };
};

const buildWebsiteKnowledgeSections = (t: TFunction, language: string = 'ar'): KnowledgeSection[] => {
  const snapshot = buildSiteSnapshot(t, language);
  const latestNewsLines = snapshot.news.map(
    (item) => `- ${item.dateLabel} | ${item.category} | ${item.title}: ${item.excerpt}`,
  );

  return [
    {
      title: 'Website company profile',
      content: [
        snapshot.contact.footerDescription,
        snapshot.about.heroDescription,
        'Portfolio brands: DIOX, AYLUX.',
        `Direct contact channels on the website: ${snapshot.contact.email} | ${snapshot.contact.phone} | WhatsApp ${snapshot.contact.whatsapp}.`,
      ].join('\n'),
      tags: ['company', 'about', 'contact'],
    },
    {
      title: 'Company history and milestones',
      content: [
        ...snapshot.about.history,
        ...snapshot.about.milestones.map(
          (m) => `- ${m.year}: ${m.title} - ${m.description}`,
        ),
      ].join('\n'),
      tags: ['about', 'history', 'milestones'],
    },
    {
      title: 'Global vision and values',
      content: [
        snapshot.about.visionDescription,
        `Key numbers: ${snapshot.about.stats.map((s) => `${s.value} ${s.label}`).join(' | ')}`,
        `Core values:\n${snapshot.about.values.map((v) => `- ${v.title}: ${v.description}`).join('\n')}`,
      ].join('\n'),
      tags: ['vision', 'values', 'about'],
    },
    {
      title: 'Production process and safety',
      content: [
        snapshot.production.heroDescription,
        `Production pillars (${snapshot.production.processSubtitle}):\n${snapshot.production.processCards
          .map((c) => `- ${c.title}: ${c.description}`)
          .join('\n')}`,
        `Safety and control:\n${snapshot.production.safetyContent.map((s) => `- ${s}`).join('\n')}`,
      ].join('\n'),
      tags: ['production', 'factory', 'manufacturing', 'quality'],
    },
    {
      title: 'Goals and growth roadmap',
      content: [
        snapshot.goal.heroDescription,
        `Strategic pillars (${snapshot.goal.pillarsSubtitle}):\n${snapshot.goal.pillars
          .map((p) => `- ${p.title}: ${p.description}`)
          .join('\n')}`,
        `Roadmap details:\n${snapshot.goal.goalsContent.map((g) => `- ${g}`).join('\n')}`,
      ].join('\n'),
      tags: ['goal', 'vision', 'strategy', 'growth'],
    },
    {
      title: 'Dryer technology and industrial capability',
      content: [
        snapshot.dryer.heroDescription,
        `Dryer pillars (${snapshot.dryer.pillarsSubtitle}):\n${snapshot.dryer.pillars
          .map((p) => `- ${p.title}: ${p.description}`)
          .join('\n')}`,
        `Dryer goals and benefits:\n${snapshot.dryer.goalsContent.map((g) => `- ${g}`).join('\n')}`,
      ].join('\n'),
      tags: ['dryer', 'raw-materials', 'capacity', 'production'],
    },
    {
      title: 'Contact, newsletter, and support',
      content: [
        `Address: ${snapshot.contact.address}`,
        `Email: ${snapshot.contact.email}`,
        `Phone: ${snapshot.contact.phone}`,
        `WhatsApp: ${snapshot.contact.whatsapp}`,
        `${snapshot.contact.newsletterTitle}: ${snapshot.contact.newsletterDescription}`,
      ].join('\n'),
      tags: ['contact', 'support', 'newsletter'],
    },
    {
      title: 'Latest website news and announcements',
      content: latestNewsLines.join('\n'),
      tags: ['news', 'announcements', 'events', 'contracts', 'launches'],
    },
  ];
};

// ─── News matching ────────────────────────────────────────────────────────

const getMatchedNewsItems = (question: string, language: string): LocalizedNewsItem[] => {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) return [];

  const items = getLocalizedNewsItems(toSupportedLanguageCode(language));
  return items
    .map((item) => {
      const searchableText = normalizeSearchText(
        `${item.category} ${item.title} ${item.excerpt} ${item.body.join(' ')}`,
      );
      const titleTokens = normalizeSearchText(item.title)
        .split(' ')
        .filter((token) => token.length >= 3);
      const tokenScore = titleTokens.filter((token) => normalizedQuestion.includes(token)).length;
      const phraseScore = normalizedQuestion.includes(normalizeSearchText(item.title)) ? 3 : 0;
      const bodyScore = searchableText.includes(normalizedQuestion) ? 2 : 0;
      return { item, score: tokenScore + phraseScore + bodyScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item)
    .slice(0, 3);
};

const buildFocusedNewsSection = (
  question: string,
  language: string,
): KnowledgeSection | null => {
  const matched = getMatchedNewsItems(question, language);
  if (matched.length === 0) return null;
  return {
    title: 'Focused news items for this question',
    content: matched
      .map((item) => `- ${item.dateLabel} | ${item.category} | ${item.title}: ${item.excerpt}\n  ${item.body.join(' ')}`)
      .join('\n'),
    tags: ['news', 'focused'],
  };
};

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Assemble the full knowledge base for a single question.
 *
 * - BASE sections come from SQLite via `loadAiContext()` (cached after first
 *   load). The synchronous `getCachedAiContext()` returns either the cached
 *   fetched payload or the inline fallback, so this function never blocks.
 * - WEBSITE sections are built from `react-i18next` translations at call-time.
 * - CATALOG sections come from `getBrandCatalogs(t)` — live data.
 * - Sections are ranked against the question; product-focused questions get
 *   a priority reshuffle so catalog context lands first in the prompt.
 */
export const buildKnowledgeBase = (
  t: TFunction,
  question: string = '',
  language: string = 'ar',
): KnowledgeSection[] => {
  const catalogs = getBrandCatalogs(t);
  const catalogSections = catalogs.map(buildCatalogSection);
  const websiteSections = buildWebsiteKnowledgeSections(t, language);
  const comparisonSection = buildBrandComparisonSection(catalogs);
  const focusedComparisonSection = buildFocusedComparisonSection(question, catalogs);
  const focusedNewsSection = buildFocusedNewsSection(question, language);

  const productPrioritySections: KnowledgeSection[] = [
    {
      title: 'Product comparison guidance from live website catalog',
      content: [
        'The product catalog sections below are taken from the actual DIOX and AYLUX product sections displayed on the website.',
        'If the customer asks to compare products or brands, use the listed categories, descriptions, weights, materials, and pack counts before saying any information is unavailable.',
        'If the customer asks for a broad comparison without naming exact items, give a concise comparison by brand/category/use case first, then invite them to specify the exact products for a deeper comparison.',
        'Do not claim that product comparison details are unavailable when relevant items already appear in the catalog below.',
      ].join(' '),
      tags: ['comparison', 'catalog', 'products'],
    },
    comparisonSection,
    ...(focusedComparisonSection ? [focusedComparisonSection] : []),
    ...(focusedNewsSection ? [focusedNewsSection] : []),
  ];

  const baseSections = getCachedAiContext().sections;

  const supportSections = [
    ...websiteSections,
    ...productPrioritySections,
    ...catalogSections,
    ...baseSections,
  ];

  const relevantSections = selectRelevantKnowledgeSections(question, supportSections, 10);
  const fallbackSections = dedupeKnowledgeSections([
    ...relevantSections,
    ...websiteSections.slice(0, 3),
    ...productPrioritySections,
    ...baseSections.slice(0, 2),
  ]);

  if (shouldPrioritizeProductKnowledge(question)) {
    return dedupeKnowledgeSections([
      ...productPrioritySections,
      ...relevantSections,
      ...catalogSections,
      ...websiteSections,
      ...baseSections,
    ]).slice(0, 14);
  }

  return fallbackSections.slice(0, 12);
};

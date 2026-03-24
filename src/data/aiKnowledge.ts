import type { TFunction } from 'i18next';
import { normalizeLanguageCode, type SupportedLanguageCode } from '../utils/language';
import { getBrandCatalogs, type BrandCatalogData, type BrandProductInfo } from './brandCatalog';
import { getLocalizedNewsItems, type LocalizedNewsItem } from './news';

export interface KnowledgeSection {
  /** عنوان القسم المعرفي */
  title: string;
  /** محتوى القسم مع التفاصيل الدقيقة */
  content: string;
  /** وسوم اختيارية تساعد على التصنيف */
  tags?: string[];
}

const baseKnowledgeSections: KnowledgeSection[] = [
  {
    title: 'هوية الشركة',
    content:
      'KARAHOCA KIMYA شركة تركية تعمل في تصنيع منتجات التنظيف المنزلية والصناعية مع التركيز على الجودة العالية والتقنيات الحديثة. تقع خطوط الإنتاج في تركيا مع شبكة توزيع تغطي السوق المحلي وأسواق التصدير.',
    tags: ['company', 'identity']
  },
  {
    title: 'علامة DIOX',
    content:
      'علامة DIOX متخصصة في حلول التنظيف المنزلية الكاملة وتشمل منظفات الأسطح، الزجاج، المطبخ والحمام، بالإضافة إلى منتجات الغسيل مثل مساحيق الغسيل السائل والبودرة ومزيلات البقع ومطرّي الأقمشة.',
    tags: ['diox', 'products', 'home-cleaning']
  },
  {
    title: 'علامة AYLUX',
    content:
      'علامة AYLUX تقدم منتجات تنظيف فاخرة بمعايير عطرية مميزة، من بينها جل غسيل الصحون، منظفات الأرضيات والهواء، مساحيق الغسيل، مطري الأقمشة، ومنتجات النظافة الشخصية مثل الصابون السائل.',
    tags: ['aylux', 'products', 'premium']
  },
  {
    title: 'الاعتمادات والجودة',
    content:
      'تلتزم KARAHOCA بأنظمة تصنيع نظيفة وتتبنى اختبارات جودة دقيقة ومختبرات داخلية لضمان ثبات النتائج. الشركة تعمل وفق معايير التصنيع الجيد وتراقب سلسلة التوريد بعناية للحفاظ على سلامة المنتجات.',
    tags: ['quality', 'certifications']
  },
  {
    title: 'الخدمات الصناعية والشراكات',
    content:
      'يمكن لـ KARAHOCA توفير حلول تصنيع مخصصة وعقود تصنيع لصالح العلامات الخاصة، مع إمكانات تعبئة وتغليف مرنة وتطوير تركيبات جديدة بالتعاون مع العملاء.',
    tags: ['b2b', 'manufacturing', 'private-label']
  },
  {
    title: 'قنوات التواصل',
    content:
      'للاستفسارات المباشرة يمكن التواصل عبر البريد info@karahoca.com أو عبر واتساب على الرقم +905305914990. كما يمكن استخدام نموذج الاتصال في الموقع الرسمي.',
    tags: ['contact', 'support']
  },
  {
    title: 'سياسة الأسعار والشحن | Pricing and Shipping Policy',
    content:
      'تختلف أسعار منتجاتنا بناءً على عدة عوامل رئيسية: نوع المنتج، الكمية المطلوبة، والحجم. نحن نقدم أسعاراً تنافسية بنظام البيع من أرض المصنع (Ex Works - EXW)، مما يمنح عملاءنا مرونة أكبر في ترتيبات الشحن. كما نسعى جاهدين لتوفير أفضل أسعار الشحن الممكنة من خلال شبكتنا اللوجستية الواسعة، ونزود عملاءنا بعروض أسعار شاملة تضمن لهم أفضل خدمة ممكنة. للحصول على عرض سعر مفصل ومخصص يناسب احتياجاتكم، يرجى التواصل مباشرة مع فريق خدمة العملاء لدينا عبر البريد الإلكتروني info@karahoca.com أو عبر واتساب على الرقم +905305914990.\n\nPricing for our products varies based on several key factors: product type, order quantity, and size. We offer competitive prices under Ex Works (EXW) terms from our factory, providing our clients with greater flexibility in shipping arrangements. We also work diligently to secure the best possible shipping rates through our extensive logistics network, and we provide our clients with comprehensive price quotes to ensure the best service possible. For a detailed and customized price quotation that meets your specific needs, please contact our customer service team directly via email at info@karahoca.com or through WhatsApp at +905305914990.',
    tags: ['pricing', 'shipping', 'exw', 'quotation', 'أسعار', 'شحن']
  }
];

const buildCatalogLine = (
  brand: BrandCatalogData['brand'],
  categoryTitle: string,
  product: BrandProductInfo
) => {
  const details = [
    product.details?.weight ? `Weight: ${product.details.weight}` : null,
    product.details?.material ? `Material: ${product.details.material}` : null,
    product.details?.count ? `Count: ${product.details.count}` : null,
  ].filter(Boolean);

  return `- ${brand} | ${categoryTitle} | ${product.name}: ${product.description}${details.length > 0 ? ` | ${details.join(' | ')}` : ''}`;
};

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[()[\]{}.,/#!$%^&*;:{}=_`~?"'|\\+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeSearchText = (value: string) =>
  normalizeSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 2);

const scoreKnowledgeSection = (question: string, section: KnowledgeSection) => {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) {
    return 0;
  }

  const questionTokens = tokenizeSearchText(question);
  if (questionTokens.length === 0) {
    return 0;
  }

  const sectionTitle = normalizeSearchText(section.title);
  const sectionContent = normalizeSearchText(section.content);
  const sectionTags = normalizeSearchText((section.tags || []).join(' '));

  let score = 0;

  for (const token of questionTokens) {
    if (sectionTitle.includes(token)) {
      score += 4;
    }

    if (sectionTags.includes(token)) {
      score += 3;
    }

    if (sectionContent.includes(token)) {
      score += 1;
    }
  }

  if (sectionTitle.includes(normalizedQuestion)) {
    score += 8;
  }

  if (sectionContent.includes(normalizedQuestion)) {
    score += 5;
  }

  return score;
};

const dedupeKnowledgeSections = (sections: KnowledgeSection[]) => {
  const seenTitles = new Set<string>();

  return sections.filter((section) => {
    const normalizedTitle = normalizeSearchText(section.title);
    if (seenTitles.has(normalizedTitle)) {
      return false;
    }

    seenTitles.add(normalizedTitle);
    return true;
  });
};

const selectRelevantKnowledgeSections = (
  question: string,
  sections: KnowledgeSection[],
  maxSections: number
) => {
  const normalizedQuestion = normalizeSearchText(question);

  if (!normalizedQuestion) {
    return dedupeKnowledgeSections(sections).slice(0, maxSections);
  }

  const scoredSections = sections
    .map((section) => ({
      section,
      score: scoreKnowledgeSection(question, section)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.section);

  const uniqueSections = dedupeKnowledgeSections(scoredSections);
  return uniqueSections.slice(0, maxSections);
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
      }))
    )
  );

const comparisonPattern =
  /compare|comparison|vs|versus|difference|different|مقارنة|قارن|مقارن|فرق|karşılaştır|karşılaştırma|fark|сравн|разниц/u;

const productPattern =
  /product|products|cleaner|cleaning|gel|liquid|powder|soap|freshener|منتج|منتجات|منظف|تنظيف|جل|سائل|مسحوق|صابون|معطر|ürün|temizlik|jel|sıvı|toz|sabun|освеж|продукт|товар|гель|жидк|порош|мыло/u;

const shouldPrioritizeProductKnowledge = (question: string) =>
  comparisonPattern.test(question) || productPattern.test(question);

const getMatchedCatalogEntries = (
  question: string,
  catalogs: BrandCatalogData[]
) => {
  const normalizedQuestion = normalizeSearchText(question);

  if (!normalizedQuestion || !shouldPrioritizeProductKnowledge(normalizedQuestion)) {
    return [];
  }

  const entries = flattenCatalogEntries(catalogs);

  return entries
    .map((entry) => {
      const brandMatch = normalizedQuestion.includes(entry.brand.toLowerCase()) ? 1 : 0;
      const familyPhraseMatch = entry.familyKey && normalizedQuestion.includes(entry.familyKey) ? 3 : 0;
      const familyTokens = entry.familyKey.split(' ').filter((token) => token.length >= 3);
      const tokenMatches = familyTokens.filter((token) => normalizedQuestion.includes(token)).length;
      const score = brandMatch + familyPhraseMatch + tokenMatches;

      return {
        ...entry,
        score
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
};

const getFocusedProductGroups = (
  question: string,
  catalogs: BrandCatalogData[]
) => {
  const matchedEntries = getMatchedCatalogEntries(question, catalogs);

  if (matchedEntries.length === 0) {
    return [];
  }

  const groupedByFamily = new Map<string, typeof matchedEntries>();

  for (const entry of matchedEntries) {
    const familyGroup = groupedByFamily.get(entry.familyKey) || [];
    familyGroup.push(entry);
    groupedByFamily.set(entry.familyKey, familyGroup);
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

    familyGroups.set(entry.familyKey, {
      label: entry.familyLabel,
      brands: new Set([entry.brand])
    });
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

          return `${categoryLabel}: DIOX ${category.products.length} products | AYLUX ${ayluxCategory?.products.length ?? 0} products`;
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
      'When a customer asks for a general comparison, mention concrete catalog facts such as category counts, shared families, and any visible differences in range breadth.'
    ]
      .filter(Boolean)
      .join('\n'),
    tags: ['comparison', 'products', 'catalog', 'snapshot']
  };
};

const buildFocusedComparisonSection = (
  question: string,
  catalogs: BrandCatalogData[]
): KnowledgeSection | null => {
  const focusedGroups = getFocusedProductGroups(question, catalogs);

  if (focusedGroups.length === 0) {
    return null;
  }

  const familySections = focusedGroups.map((group) => {
    const lines = group
      .sort((left, right) => left.brand.localeCompare(right.brand))
      .map((entry) => buildCatalogLine(entry.brand, entry.categoryTitle, entry.product));

    return `${group[0].familyLabel}:\n${lines.join('\n')}`;
  });

  return {
    title: 'Focused product matches for this question',
    content: [
      'Use the matched entries below before giving a generic answer.',
      ...familySections
    ].join('\n'),
    tags: ['comparison', 'products', 'matched']
  };
};

const buildCatalogSection = (catalog: BrandCatalogData): KnowledgeSection => {
  const totalProducts = catalog.categories.reduce(
    (count, category) => count + category.products.length,
    0
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
    tags: [catalog.brand.toLowerCase(), 'products', 'catalog', 'website-sections']
  };
};

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

const buildSiteSnapshot = (
  t: TFunction,
  language: string = 'ar'
): SiteSnapshot => {
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
      footerDescription: t('footer.description')
    },
    about: {
      heroDescription: t('aboutPage.hero.description'),
      history: [t('aboutPage.history.paragraph1'), t('aboutPage.history.paragraph2')],
      milestones: [
        {
          year: t('aboutPage.milestones.year1.year'),
          title: t('aboutPage.milestones.year1.title'),
          description: t('aboutPage.milestones.year1.description')
        },
        {
          year: t('aboutPage.milestones.year2.year'),
          title: t('aboutPage.milestones.year2.title'),
          description: t('aboutPage.milestones.year2.description')
        },
        {
          year: t('aboutPage.milestones.year3.year'),
          title: t('aboutPage.milestones.year3.title'),
          description: t('aboutPage.milestones.year3.description')
        }
      ],
      visionDescription: t('aboutPage.vision.description'),
      stats: [
        { value: '15+', label: t('aboutPage.vision.countries') },
        { value: '30+', label: t('aboutPage.vision.experience') },
        { value: '2', label: t('aboutPage.vision.brands') },
        { value: '4', label: t('aboutPage.vision.industries') }
      ],
      values: [
        {
          title: t('aboutPage.values.quality.title'),
          description: t('aboutPage.values.quality.description')
        },
        {
          title: t('aboutPage.values.innovation.title'),
          description: t('aboutPage.values.innovation.description')
        },
        {
          title: t('aboutPage.values.sustainability.title'),
          description: t('aboutPage.values.sustainability.description')
        }
      ]
    },
    production: {
      heroDescription: t('production.heroDescription'),
      processSubtitle: t('production.sections.process.subtitle'),
      processCards: [
        {
          title: t('production.sections.process.cards.sourcing.title'),
          description: t('production.sections.process.cards.sourcing.description')
        },
        {
          title: t('production.sections.process.cards.mixing.title'),
          description: t('production.sections.process.cards.mixing.description')
        },
        {
          title: t('production.sections.process.cards.packaging.title'),
          description: t('production.sections.process.cards.packaging.description')
        }
      ],
      safetyContent: [
        t('production.sections.safety.content1'),
        t('production.sections.safety.content2'),
        t('production.sections.safety.content3')
      ]
    },
    goal: {
      heroDescription: t('goal.heroDescription'),
      pillarsSubtitle: t('goal.sections.pillars.subtitle'),
      pillars: [
        {
          title: t('goal.sections.pillars.innovation.title'),
          description: t('goal.sections.pillars.innovation.description')
        },
        {
          title: t('goal.sections.pillars.expansion.title'),
          description: t('goal.sections.pillars.expansion.description')
        },
        {
          title: t('goal.sections.pillars.quality.title'),
          description: t('goal.sections.pillars.quality.description')
        }
      ],
      goalsContent: [
        t('goal.sections.goals.content1'),
        t('goal.sections.goals.content2'),
        t('goal.sections.goals.content3')
      ]
    },
    dryer: {
      heroDescription: t('dryer.heroDescription'),
      pillarsSubtitle: t('dryer.sections.pillars.subtitle'),
      pillars: [
        {
          title: t('dryer.sections.pillars.cards.capacity.title'),
          description: t('dryer.sections.pillars.cards.capacity.description')
        },
        {
          title: t('dryer.sections.pillars.cards.integration.title'),
          description: t('dryer.sections.pillars.cards.integration.description')
        },
        {
          title: t('dryer.sections.pillars.cards.consistency.title'),
          description: t('dryer.sections.pillars.cards.consistency.description')
        }
      ],
      goalsContent: [
        t('dryer.sections.goals.content1'),
        t('dryer.sections.goals.content2'),
        t('dryer.sections.goals.content3')
      ]
    },
    news: getLocalizedNewsItems(normalizedLanguage)
  };
};

const buildWebsiteKnowledgeSections = (
  t: TFunction,
  language: string = 'ar'
): KnowledgeSection[] => {
  const snapshot = buildSiteSnapshot(t, language);

  const latestNewsLines = snapshot.news.map((item) =>
    `- ${item.dateLabel} | ${item.category} | ${item.title}: ${item.excerpt}`
  );

  return [
    {
      title: 'Website company profile',
      content: [
        snapshot.contact.footerDescription,
        snapshot.about.heroDescription,
        `Portfolio brands: DIOX, AYLUX.`,
        `Direct contact channels on the website: ${snapshot.contact.email} | ${snapshot.contact.phone} | WhatsApp ${snapshot.contact.whatsapp}.`
      ].join('\n'),
      tags: ['company', 'about', 'contact']
    },
    {
      title: 'Company history and milestones',
      content: [
        ...snapshot.about.history,
        ...snapshot.about.milestones.map(
          (milestone) => `- ${milestone.year}: ${milestone.title} - ${milestone.description}`
        )
      ].join('\n'),
      tags: ['about', 'history', 'milestones']
    },
    {
      title: 'Global vision and values',
      content: [
        snapshot.about.visionDescription,
        `Key numbers: ${snapshot.about.stats
          .map((stat) => `${stat.value} ${stat.label}`)
          .join(' | ')}`,
        `Core values:\n${snapshot.about.values
          .map((value) => `- ${value.title}: ${value.description}`)
          .join('\n')}`
      ].join('\n'),
      tags: ['vision', 'values', 'about']
    },
    {
      title: 'Production process and safety',
      content: [
        snapshot.production.heroDescription,
        `Production pillars (${snapshot.production.processSubtitle}):\n${snapshot.production.processCards
          .map((card) => `- ${card.title}: ${card.description}`)
          .join('\n')}`,
        `Safety and control:\n${snapshot.production.safetyContent.map((item) => `- ${item}`).join('\n')}`
      ].join('\n'),
      tags: ['production', 'factory', 'manufacturing', 'quality']
    },
    {
      title: 'Goals and growth roadmap',
      content: [
        snapshot.goal.heroDescription,
        `Strategic pillars (${snapshot.goal.pillarsSubtitle}):\n${snapshot.goal.pillars
          .map((pillar) => `- ${pillar.title}: ${pillar.description}`)
          .join('\n')}`,
        `Roadmap details:\n${snapshot.goal.goalsContent.map((item) => `- ${item}`).join('\n')}`
      ].join('\n'),
      tags: ['goal', 'vision', 'strategy', 'growth']
    },
    {
      title: 'Dryer technology and industrial capability',
      content: [
        snapshot.dryer.heroDescription,
        `Dryer pillars (${snapshot.dryer.pillarsSubtitle}):\n${snapshot.dryer.pillars
          .map((pillar) => `- ${pillar.title}: ${pillar.description}`)
          .join('\n')}`,
        `Dryer goals and benefits:\n${snapshot.dryer.goalsContent
          .map((item) => `- ${item}`)
          .join('\n')}`
      ].join('\n'),
      tags: ['dryer', 'raw-materials', 'capacity', 'production']
    },
    {
      title: 'Contact, newsletter, and support',
      content: [
        `Address: ${snapshot.contact.address}`,
        `Email: ${snapshot.contact.email}`,
        `Phone: ${snapshot.contact.phone}`,
        `WhatsApp: ${snapshot.contact.whatsapp}`,
        `${snapshot.contact.newsletterTitle}: ${snapshot.contact.newsletterDescription}`
      ].join('\n'),
      tags: ['contact', 'support', 'newsletter']
    },
    {
      title: 'Latest website news and announcements',
      content: latestNewsLines.join('\n'),
      tags: ['news', 'announcements', 'events', 'contracts', 'launches']
    }
  ];
};

const getMatchedNewsItems = (question: string, language: string): LocalizedNewsItem[] => {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) {
    return [];
  }

  const items = getLocalizedNewsItems(toSupportedLanguageCode(language));

  return items
    .map((item) => {
      const searchableText = normalizeSearchText(
        `${item.category} ${item.title} ${item.excerpt} ${item.body.join(' ')}`
      );
      const titleTokens = normalizeSearchText(item.title)
        .split(' ')
        .filter((token) => token.length >= 3);
      const tokenScore = titleTokens.filter((token) => normalizedQuestion.includes(token)).length;
      const phraseScore = normalizedQuestion.includes(normalizeSearchText(item.title)) ? 3 : 0;
      const bodyScore = searchableText.includes(normalizedQuestion) ? 2 : 0;
      const score = tokenScore + phraseScore + bodyScore;

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item)
    .slice(0, 3);
};

const buildFocusedNewsSection = (
  question: string,
  language: string
): KnowledgeSection | null => {
  const matchedItems = getMatchedNewsItems(question, language);

  if (matchedItems.length === 0) {
    return null;
  }

  return {
    title: 'Focused news items for this question',
    content: matchedItems
      .map(
        (item) =>
          `- ${item.dateLabel} | ${item.category} | ${item.title}: ${item.excerpt}\n  ${item.body.join(' ')}`
      )
      .join('\n'),
    tags: ['news', 'focused']
  };
};

export const buildKnowledgeBase = (
  t: TFunction,
  question: string = '',
  language: string = 'ar'
): KnowledgeSection[] => {
  const catalogs = getBrandCatalogs(t);
  const catalogSections = catalogs.map(buildCatalogSection);
  const websiteSections = buildWebsiteKnowledgeSections(t, language);
  const comparisonSection = buildBrandComparisonSection(catalogs);
  const focusedComparisonSection = buildFocusedComparisonSection(question, catalogs);
  const focusedNewsSection = buildFocusedNewsSection(question, language);
  const productPrioritySections = [
    {
      title: 'Product comparison guidance from live website catalog',
      content: [
        'The product catalog sections below are taken from the actual DIOX and AYLUX product sections displayed on the website.',
        'If the customer asks to compare products or brands, use the listed categories, descriptions, weights, materials, and pack counts before saying any information is unavailable.',
        'If the customer asks for a broad comparison without naming exact items, give a concise comparison by brand/category/use case first, then invite them to specify the exact products for a deeper comparison.',
        'Do not claim that product comparison details are unavailable when relevant items already appear in the catalog below.'
      ].join(' '),
      tags: ['comparison', 'catalog', 'products']
    },
    comparisonSection,
    ...(focusedComparisonSection ? [focusedComparisonSection] : []),
    ...(focusedNewsSection ? [focusedNewsSection] : [])
  ];

  const supportSections = [
    ...websiteSections,
    ...productPrioritySections,
    ...catalogSections,
    ...baseKnowledgeSections
  ];

  const relevantSections = selectRelevantKnowledgeSections(question, supportSections, 10);
  const fallbackSections = dedupeKnowledgeSections([
    ...relevantSections,
    ...websiteSections.slice(0, 3),
    ...productPrioritySections,
    ...baseKnowledgeSections.slice(0, 2)
  ]);

  if (shouldPrioritizeProductKnowledge(question)) {
    return dedupeKnowledgeSections([
      ...productPrioritySections,
      ...relevantSections,
      ...catalogSections,
      ...websiteSections,
      ...baseKnowledgeSections
    ]).slice(0, 14);
  }

  return fallbackSections.slice(0, 12);
};

/** إرشادات لغوية لضمان اتساق إجابات المساعد. */
export const assistantToneGuidelines = `
🌍 LANGUAGE RESPONSE RULES (ABSOLUTE PRIORITY):
- You MUST detect the language of the customer's question FIRST
- You MUST respond in the EXACT SAME LANGUAGE as the question
- Arabic question = Arabic response | English question = English response | Turkish question = Turkish response | Russian question = Russian response
- DO NOT respond in Arabic if the question is in English
- DO NOT respond in English if the question is in Arabic
- DO NOT respond in Turkish if the question is in Russian
- Translate the knowledge base content to match the customer's language

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


const getSingleAssistantWelcomeMessage = (lang: SupportedLanguageCode) => {
  switch (lang) {
    case 'en':
      return `**Welcome!** 👋

I'm the AI assistant for **KARAHOCA**.
You can ask me about our products, company, production, news, shipping, and contact details.`;
    case 'tr':
      return `**Hoş geldiniz!** 👋

Ben **KARAHOCA** için hazırlanan yapay zeka asistanıyım.
Urunlerimiz, sirketimiz, uretim, haberler, sevkiyat ve iletisim hakkinda soru sorabilirsiniz.`;
    case 'ru':
      return `**Добро пожаловать!** 👋

Я виртуальный помощник компании **KARAHOCA**.
Вы можете спросить меня о продукции, компании, производстве, новостях, доставке и способах связи.`;
    case 'ar':
    default:
      return `**مرحباً بك!** 👋

أنا المساعد الذكي لشركة **KARAHOCA**.
يمكنك سؤالي عن المنتجات، الشركة، الإنتاج، الأخبار، الشحن، ووسائل التواصل.`;
  }
};

/** نص ترحيبي ثنائي اللغة: لغة الموقع الحالية + الإنجليزية. */
export const getAssistantWelcomeMessage = (lang: string) => {
  const normalizedLanguage = normalizeLanguageCode(lang);
  const localizedMessage = getSingleAssistantWelcomeMessage(normalizedLanguage);
  const englishMessage = getSingleAssistantWelcomeMessage('en');

  if (normalizedLanguage === 'en') {
    return englishMessage;
  }

  return `${localizedMessage}\n\n${englishMessage}`;
};
/**
 * 🧠 دالة مساعدة لاستخراج المواضيع التي تم التطرق لها في المحادثة
 * @param conversationHistory - مصفوفة الرسائل الكاملة
 * @returns Set من المواضيع المطروقة
 */
function getDiscussedTopics(conversationHistory: Array<{role: string, content: string}>): Set<string> {
  const discussedTopics = new Set<string>();
  
  // دمج كل محتوى المحادثة
  const fullConversation = conversationHistory
    .map(msg => msg.content.toLowerCase())
    .join(' ');
  
  // كشف المواضيع بناءً على الكلمات المفتاحية
  const topicPatterns = {
    company: /من نحن|من أنت|karahoca|شركة|company|about|hakkımızda|kim/,
    diox: /diox|ديوكس/,
    aylux: /aylux|آيلوكس|ايلوكس/,
    pricing: /سعر|أسعار|price|pricing|fiyat|exw|تكلفة|cost/,
    shipping: /شحن|توصيل|delivery|shipping|kargo|teslimat/,
    contact: /تواصل|اتصال|contact|whatsapp|واتساب|email|iletişim/,
    quality: /جودة|شهادة|certificate|quality|kalite|مصنع|factory|fabrika/,
    products: /منتج|منتجات|product|ürün|cleaning|تنظيف|temizlik/,
    news: /خبر|أخبار|اخبار|مستجد|إطلاق|معرض|عقد|اتفاق|news|announcement|launch|exhibition|contract|haber|duyuru|lansman|fuar|anlaşma|новост|анонс|запуск|выстав|контракт/,
    production: /إنتاج|تصنيع|عملية|production|manufacturing|process|üretim|süreç|производ|процесс/,
  };
  
  // فحص كل موضوع
  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(fullConversation)) {
      discussedTopics.add(topic);
    }
  }
  
  return discussedTopics;
}

/**
 * 🎯 دالة لتوليد اقتراحات ذكية بناءً على محتوى المحادثة
 * @param lastUserMessage - آخر رسالة من المستخدم
 * @param lastBotResponse - آخر رد من البوت
 * @param conversationHistory - مصفوفة الرسائل الكاملة (NEW!)
 * @param language - اللغة الحالية (ar, en, tr)
 * @returns مصفوفة اقتراحات (3-4 اقتراحات) مفلترة
 */
export function generateSmartSuggestions(
  lastUserMessage: string,
  lastBotResponse: string,
  conversationHistory: Array<{role: string, content: string}>,
  language: string = 'ar'
): string[] {
  const lowerMessage = normalizeSearchText(lastUserMessage);
  const lowerResponse = lastBotResponse.toLowerCase();
  
  // 🧠 استخراج المواضيع المطروقة سابقاً
  const discussedTopics = getDiscussedTopics(conversationHistory);

  // اقتراحات متعددة اللغات
  const suggestions = {
    ar: {
      diox: ['منتجات AYLUX', 'الأسعار والشحن', 'طلب عرض سعر'],
      aylux: ['منتجات DIOX', 'مقارنة المنتجات', 'معلومات التواصل'],
      pricing: ['شروط الشحن EXW', 'الحد الأدنى للطلب', 'التواصل للعرض'],
      products: ['معلومات الأسعار', 'الشحن والتوصيل', 'المصنع والجودة'],
      contact: ['منتجاتنا', 'أسئلة عن الأسعار', 'معلومات الشركة'],
      company: ['منتجات DIOX', 'منتجات AYLUX', 'طرق التواصل'],
      quality: ['شهادات الجودة', 'المصنع', 'المنتجات'],
      news: ['آخر الأخبار', 'الإنتاج', 'وسائل التواصل'],
      production: ['الجودة والمصنع', 'هدفنا', 'آخر الأخبار'],
      default: ['من نحن؟', 'منتجاتنا', 'آخر الأخبار', 'التواصل معنا']
    },
    en: {
      diox: ['AYLUX Products', 'Pricing & Shipping', 'Request Quote'],
      aylux: ['DIOX Products', 'Compare Products', 'Contact Info'],
      pricing: ['EXW Shipping Terms', 'Minimum Order', 'Contact for Quote'],
      products: ['Pricing Info', 'Shipping & Delivery', 'Factory & Quality'],
      contact: ['Our Products', 'Pricing Questions', 'Company Info'],
      company: ['DIOX Products', 'AYLUX Products', 'Contact Methods'],
      quality: ['Quality Certificates', 'Factory', 'Products'],
      news: ['Latest News', 'Production', 'Contact Methods'],
      production: ['Factory & Quality', 'Our Goal', 'Latest News'],
      default: ['About Us?', 'Our Products', 'Latest News', 'Contact Us']
    },
    tr: {
      diox: ['AYLUX Ürünleri', 'Fiyat & Kargo', 'Teklif İste'],
      aylux: ['DIOX Ürünleri', 'Ürün Karşılaştır', 'İletişim Bilgileri'],
      pricing: ['EXW Kargo Şartları', 'Minimum Sipariş', 'Teklif İçin İletişim'],
      products: ['Fiyat Bilgisi', 'Kargo & Teslimat', 'Fabrika & Kalite'],
      contact: ['Ürünlerimiz', 'Fiyat Soruları', 'Şirket Bilgisi'],
      company: ['DIOX Ürünleri', 'AYLUX Ürünleri', 'İletişim Yöntemleri'],
      quality: ['Kalite Sertifikaları', 'Fabrika', 'Ürünler'],
      news: ['Son Haberler', 'Üretim', 'İletişim Yöntemleri'],
      production: ['Fabrika & Kalite', 'Hedefimiz', 'Son Haberler'],
      default: ['Hakkımızda?', 'Ürünlerimiz', 'Son Haberler', 'Bize Ulaşın']
    },
    ru: {
      diox: ['Продукты AYLUX', 'Цены и доставка', 'Запросить предложение'],
      aylux: ['Продукты DIOX', 'Сравнить продукты', 'Контактная информация'],
      pricing: ['Условия доставки EXW', 'Минимальный заказ', 'Связаться для предложения'],
      products: ['Информация о ценах', 'Доставка', 'Завод и качество'],
      contact: ['Наши продукты', 'Вопросы о ценах', 'Информация о компании'],
      company: ['Продукты DIOX', 'Продукты AYLUX', 'Способы связи'],
      quality: ['Сертификаты качества', 'Завод', 'Продукты'],
      news: ['Последние новости', 'Производство', 'Способы связи'],
      production: ['Завод и качество', 'Наша цель', 'Последние новости'],
      default: ['О нас?', 'Наши продукты', 'Последние новости', 'Связаться с нами']
    }
  };

  const lang = normalizeLanguageCode(language);
  const langSuggestions = suggestions[lang];

  // تحديد الاقتراحات بناءً على الكلمات المفتاحية
  if (lowerMessage.includes('diox') || lowerMessage.includes('ديوكس')) {
    return langSuggestions.diox;
  }
  if (lowerMessage.includes('aylux') || lowerMessage.includes('آيلوكس') || lowerMessage.includes('ايلوكس')) {
    return langSuggestions.aylux;
  }
  if (lowerMessage.includes('price') || lowerMessage.includes('سعر') || lowerMessage.includes('اسعار') || 
      lowerMessage.includes('fiyat') || lowerResponse.includes('exw')) {
    return langSuggestions.pricing;
  }
  if (lowerMessage.includes('product') || lowerMessage.includes('منتج') || lowerMessage.includes('ürün')) {
    return langSuggestions.products;
  }
  if (lowerMessage.includes('contact') || lowerMessage.includes('تواصل') || lowerMessage.includes('iletişim') ||
      lowerMessage.includes('whatsapp') || lowerMessage.includes('واتساب')) {
    return langSuggestions.contact;
  }
  if (lowerMessage.includes('news') || lowerMessage.includes('خبر') || lowerMessage.includes('اخبار') ||
      lowerMessage.includes('haber') || lowerMessage.includes('новост')) {
    return langSuggestions.news;
  }
  if (lowerMessage.includes('production') || lowerMessage.includes('انتاج') || lowerMessage.includes('تصنيع') ||
      lowerMessage.includes('üretim') || lowerMessage.includes('производ')) {
    return langSuggestions.production;
  }
  if (lowerMessage.includes('company') || lowerMessage.includes('شركة') || lowerMessage.includes('karahoca') ||
      lowerMessage.includes('من أنت') || lowerMessage.includes('who are')) {
    return langSuggestions.company;
  }
  if (lowerMessage.includes('quality') || lowerMessage.includes('جودة') || lowerMessage.includes('kalite') ||
      lowerMessage.includes('شهادة') || lowerMessage.includes('certificate')) {
    return langSuggestions.quality;
  }

  // اقتراحات افتراضية
  let finalSuggestions = langSuggestions.default;
  
  // 🎯 فلترة الاقتراحات بناءً على المواضيع المطروقة
  const allSuggestions = Object.values(langSuggestions).flat();
  const uniqueSuggestions = [...new Set(allSuggestions)];
  
  // خريطة ربط الاقتراحات بالمواضيع (للفلترة)
  const suggestionTopicMap: {[key: string]: string[]} = {
    // عربي
    'من نحن؟': ['company'],
    'منتجاتنا': ['products'],
    'منتجات DIOX': ['diox'],
    'منتجات AYLUX': ['aylux'],
    'الأسعار': ['pricing'],
    'التواصل معنا': ['contact'],
    'معلومات الأسعار': ['pricing'],
    'الشحن والتوصيل': ['shipping'],
    'المصنع والجودة': ['quality'],
    'طلب عرض سعر': ['pricing'],
    'معلومات التواصل': ['contact'],
    'أسئلة عن الأسعار': ['pricing'],
    'معلومات الشركة': ['company'],
    'طرق التواصل': ['contact'],
    'شهادات الجودة': ['quality'],
    'المصنع': ['quality'],
    'المنتجات': ['products'],
    'آخر الأخبار': ['news'],
    'الإنتاج': ['production'],
    'الجودة والمصنع': ['quality', 'production'],
    'هدفنا': ['company'],
    'مقارنة المنتجات': ['diox', 'aylux'],
    'شروط الشحن EXW': ['shipping'],
    'الحد الأدنى للطلب': ['pricing'],
    'التواصل للعرض': ['contact', 'pricing'],
    
    // English
    'About Us?': ['company'],
    'Our Products': ['products'],
    'DIOX Products': ['diox'],
    'AYLUX Products': ['aylux'],
    'Pricing': ['pricing'],
    'Contact Us': ['contact'],
    'Pricing Info': ['pricing'],
    'Shipping & Delivery': ['shipping'],
    'Factory & Quality': ['quality'],
    'Request Quote': ['pricing'],
    'Contact Info': ['contact'],
    'Pricing Questions': ['pricing'],
    'Company Info': ['company'],
    'Contact Methods': ['contact'],
    'Quality Certificates': ['quality'],
    'Factory': ['quality'],
    'Products': ['products'],
    'Latest News': ['news'],
    'Production': ['production'],
    'Our Goal': ['company'],
    'Compare Products': ['diox', 'aylux'],
    'EXW Shipping Terms': ['shipping'],
    'Minimum Order': ['pricing'],
    'Contact for Quote': ['contact', 'pricing'],
    'Pricing & Shipping': ['pricing', 'shipping'],
    
    // Türkçe
    'Hakkımızda?': ['company'],
    'Ürünlerimiz': ['products'],
    'DIOX Ürünleri': ['diox'],
    'AYLUX Ürünleri': ['aylux'],
    'Fiyatlandırma': ['pricing'],
    'Bize Ulaşın': ['contact'],
    'Fiyat Bilgisi': ['pricing'],
    'Kargo & Teslimat': ['shipping'],
    'Fabrika & Kalite': ['quality'],
    'Teklif İste': ['pricing'],
    'İletişim Bilgileri': ['contact'],
    'Fiyat Soruları': ['pricing'],
    'Şirket Bilgisi': ['company'],
    'İletişim Yöntemleri': ['contact'],
    'Kalite Sertifikaları': ['quality'],
    'Fabrika': ['quality'],
    'Ürünler': ['products'],
    'Son Haberler': ['news'],
    'Üretim': ['production'],
    'Hedefimiz': ['company'],
    'Ürün Karşılaştır': ['diox', 'aylux'],
    'EXW Kargo Şartları': ['shipping'],
    'Minimum Sipariş': ['pricing'],
    'Teklif İçin İletişim': ['contact', 'pricing'],
    'Fiyat & Kargo': ['pricing', 'shipping'],
    
    // Русский
    'О нас?': ['company'],
    'Наши продукты': ['products'],
    'Продукты DIOX': ['diox'],
    'Продукты AYLUX': ['aylux'],
    'Цены': ['pricing'],
    'Связаться с нами': ['contact'],
    'Информация о ценах': ['pricing'],
    'Доставка': ['shipping'],
    'Завод и качество': ['quality'],
    'Запросить предложение': ['pricing'],
    'Контактная информация': ['contact'],
    'Вопросы о ценах': ['pricing'],
    'Информация о компании': ['company'],
    'Способы связи': ['contact'],
    'Сертификаты качества': ['quality'],
    'Завод': ['quality'],
    'Продукты': ['products'],
    'Последние новости': ['news'],
    'Производство': ['production'],
    'Наша цель': ['company'],
    'Сравнить продукты': ['diox', 'aylux'],
    'Условия доставки EXW': ['shipping'],
    'Минимальный заказ': ['pricing'],
    'Связаться для предложения': ['contact', 'pricing'],
    'Цены и доставка': ['pricing', 'shipping'],
  };
  
  // فلترة الاقتراحات: إزالة المواضيع المطروقة
  finalSuggestions = finalSuggestions.filter(suggestion => {
    const relatedTopics = suggestionTopicMap[suggestion] || [];
    // إذا كان الاقتراح مرتبط بموضوع تم التطرق له، استبعده
    return !relatedTopics.some(topic => discussedTopics.has(topic));
  });
  
  // إذا تم استبعاد كل الاقتراحات، نعيد اقتراحات بديلة غير مطروقة
  if (finalSuggestions.length === 0) {
    const fallbackSuggestions = uniqueSuggestions.filter(suggestion => {
      const relatedTopics = suggestionTopicMap[suggestion] || [];
      return !relatedTopics.some(topic => discussedTopics.has(topic));
    });
    
    // نأخذ أول 3-4 اقتراحات غير مطروقة
    return fallbackSuggestions.slice(0, 4);
  }
  
  return finalSuggestions;
}

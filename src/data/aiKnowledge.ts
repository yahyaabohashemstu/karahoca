import type { TFunction } from 'i18next';
import { normalizeLanguageCode } from '../utils/language';
import { getBrandCatalogs, type BrandCatalogData, type BrandProductInfo } from './brandCatalog';

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
    .replace(/[()[\]{}.,/#!$%^&*;:{}=_`~?"'|\\+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

export const buildLocalProductFallbackReply = (
  question: string,
  t: TFunction,
  language: string = 'ar'
): string | null => {
  if (!shouldPrioritizeProductKnowledge(question)) {
    return null;
  }

  const catalogs = getBrandCatalogs(t);
  const dioxCatalog = catalogs.find((catalog) => catalog.brand === 'DIOX');
  const ayluxCatalog = catalogs.find((catalog) => catalog.brand === 'AYLUX');

  if (!dioxCatalog || !ayluxCatalog) {
    return null;
  }

  const totalDioxProducts = dioxCatalog.categories.reduce(
    (count, category) => count + category.products.length,
    0
  );
  const totalAyluxProducts = ayluxCatalog.categories.reduce(
    (count, category) => count + category.products.length,
    0
  );

  const categoryLines = dioxCatalog.categories.map((category, index) => {
    const ayluxCategory = ayluxCatalog.categories[index];
    return {
      label: category.title || ayluxCategory?.title || `Category ${index + 1}`,
      dioxCount: category.products.length,
      ayluxCount: ayluxCategory?.products.length ?? 0
    };
  });
  const focusedGroups = getFocusedProductGroups(question, catalogs);

  if (focusedGroups.length > 0) {
    const arabicReply = [
      'اعتمادًا على المنتجات الظاهرة في الموقع، هذه هي المطابقات الأقرب لسؤالك:',
      ...focusedGroups.map((group) => {
        const lines = group.map((entry) => {
          const detailParts = [
            entry.product.details?.weight ? `الحجم/الوزن: ${entry.product.details.weight}` : null,
            entry.product.details?.material ? `المادة: ${entry.product.details.material}` : null,
            entry.product.details?.count ? `العدد: ${entry.product.details.count}` : null,
          ].filter(Boolean);

          return `  - ${entry.brand} | ${entry.categoryTitle} | ${entry.product.name}: ${entry.product.description}${detailParts.length > 0 ? ` | ${detailParts.join(' | ')}` : ''}`;
        });

        return `- ${group[0].familyLabel}:\n${lines.join('\n')}`;
      }),
      'إذا رغبت، أرسل اسم المنتجين تحديدًا وسأرتب لك المقارنة بشكل أوضح.'
    ].join('\n');

    const englishReply = [
      'Based on the products visible on the website, these are the closest matches to your question:',
      ...focusedGroups.map((group) => {
        const lines = group.map((entry) => {
          const detailParts = [
            entry.product.details?.weight ? `Weight/Size: ${entry.product.details.weight}` : null,
            entry.product.details?.material ? `Material: ${entry.product.details.material}` : null,
            entry.product.details?.count ? `Count: ${entry.product.details.count}` : null,
          ].filter(Boolean);

          return `  - ${entry.brand} | ${entry.categoryTitle} | ${entry.product.name}: ${entry.product.description}${detailParts.length > 0 ? ` | ${detailParts.join(' | ')}` : ''}`;
        });

        return `- ${group[0].familyLabel}:\n${lines.join('\n')}`;
      }),
      'If you want, send the exact two product names and I will structure the comparison more clearly.'
    ].join('\n');

    const turkishReply = [
      'Sitede gorunen urunlere gore, sorunuza en yakin eslesen urunler sunlar:',
      ...focusedGroups.map((group) => {
        const lines = group.map((entry) => {
          const detailParts = [
            entry.product.details?.weight ? `Agirlik/Boyut: ${entry.product.details.weight}` : null,
            entry.product.details?.material ? `Malzeme: ${entry.product.details.material}` : null,
            entry.product.details?.count ? `Adet: ${entry.product.details.count}` : null,
          ].filter(Boolean);

          return `  - ${entry.brand} | ${entry.categoryTitle} | ${entry.product.name}: ${entry.product.description}${detailParts.length > 0 ? ` | ${detailParts.join(' | ')}` : ''}`;
        });

        return `- ${group[0].familyLabel}:\n${lines.join('\n')}`;
      }),
      'Isterseniz tam urun adlarini gonderin; karsilastirmayi daha net duzenleyeyim.'
    ].join('\n');

    const russianReply = [
      'По товарам, видимым на сайте, вот самые близкие совпадения к вашему вопросу:',
      ...focusedGroups.map((group) => {
        const lines = group.map((entry) => {
          const detailParts = [
            entry.product.details?.weight ? `Вес/размер: ${entry.product.details.weight}` : null,
            entry.product.details?.material ? `Материал: ${entry.product.details.material}` : null,
            entry.product.details?.count ? `Количество: ${entry.product.details.count}` : null,
          ].filter(Boolean);

          return `  - ${entry.brand} | ${entry.categoryTitle} | ${entry.product.name}: ${entry.product.description}${detailParts.length > 0 ? ` | ${detailParts.join(' | ')}` : ''}`;
        });

        return `- ${group[0].familyLabel}:\n${lines.join('\n')}`;
      }),
      'Если хотите, отправьте точные названия двух товаров, и я оформлю сравнение более наглядно.'
    ].join('\n');

    switch (normalizeLanguageCode(language)) {
      case 'en':
        return englishReply;
      case 'tr':
        return turkishReply;
      case 'ru':
        return russianReply;
      case 'ar':
      default:
        return arabicReply;
    }
  }

  switch (normalizeLanguageCode(language)) {
    case 'en':
      return [
        'I can still help using the product catalog currently shown on the website:',
        `- DIOX currently shows ${totalDioxProducts} products.`,
        `- AYLUX currently shows ${totalAyluxProducts} products.`,
        '- Category comparison:',
        ...categoryLines.map(
          (line) => `  - ${line.label}: DIOX ${line.dioxCount} | AYLUX ${line.ayluxCount}`
        ),
        'If you want a more exact comparison, send the product name or category and I will compare what is visible on the site.'
      ].join('\n');
    case 'tr':
      return [
        'Yine de sitede gorunen mevcut urun kataloguna gore yardimci olabilirim:',
        `- DIOX su anda ${totalDioxProducts} urun gosteriyor.`,
        `- AYLUX su anda ${totalAyluxProducts} urun gosteriyor.`,
        '- Kategori karsilastirmasi:',
        ...categoryLines.map(
          (line) => `  - ${line.label}: DIOX ${line.dioxCount} | AYLUX ${line.ayluxCount}`
        ),
        'Daha net bir karsilastirma isterseniz urun adini veya kategoriyi yazin; sitede gorunen bilgilere gore karsilastirayim.'
      ].join('\n');
    case 'ru':
      return [
        'Я все равно могу помочь по текущему каталогу товаров, показанному на сайте:',
        `- DIOX сейчас показывает ${totalDioxProducts} товаров.`,
        `- AYLUX сейчас показывает ${totalAyluxProducts} товаров.`,
        '- Сравнение по категориям:',
        ...categoryLines.map(
          (line) => `  - ${line.label}: DIOX ${line.dioxCount} | AYLUX ${line.ayluxCount}`
        ),
        'Если нужна более точная сравнительная информация, отправьте название продукта или категории, и я сравню данные, видимые на сайте.'
      ].join('\n');
    case 'ar':
    default:
      return [
        'يمكنني مع ذلك مساعدتك اعتمادًا على كتالوج المنتجات الظاهر حاليًا في الموقع:',
        `- DIOX يعرض الآن ${totalDioxProducts} منتجًا.`,
        `- AYLUX يعرض الآن ${totalAyluxProducts} منتجًا.`,
        '- مقارنة حسب الفئات:',
        ...categoryLines.map(
          (line) => `  - ${line.label}: DIOX ${line.dioxCount} | AYLUX ${line.ayluxCount}`
        ),
        'إذا أردت مقارنة أدق، أرسل اسم المنتج أو الفئة وسأقارن لك المتاح الظاهر في الموقع مباشرة.'
      ].join('\n');
  }
};

export const buildLocalAssistantReply = (
  question: string,
  t: TFunction,
  language: string = 'ar'
): string => {
  const normalizedQuestion = normalizeSearchText(question);

  if (!normalizedQuestion) {
    switch (normalizeLanguageCode(language)) {
      case 'en':
        return [
          'I can still help using the information currently available on the KARAHOCA website.',
          'You can ask me about DIOX products, AYLUX products, pricing, shipping, company information, or contact details.'
        ].join('\n');
      case 'tr':
        return [
          'KARAHOCA web sitesinde mevcut olan bilgilerle yine de yardimci olabilirim.',
          'Bana DIOX urunleri, AYLUX urunleri, fiyatlar, kargo, sirket bilgileri veya iletisim detaylari hakkinda sorabilirsiniz.'
        ].join('\n');
      case 'ru':
        return [
          'Я все равно могу помочь, используя информацию, которая сейчас доступна на сайте KARAHOCA.',
          'Вы можете спросить меня о продуктах DIOX, продуктах AYLUX, ценах, доставке, информации о компании или контактах.'
        ].join('\n');
      case 'ar':
      default:
        return [
          'يمكنني مع ذلك مساعدتك بالاعتماد على المعلومات المتاحة حاليًا في موقع KARAHOCA.',
          'يمكنك سؤالي عن منتجات DIOX وAYLUX أو الأسعار أو الشحن أو معلومات الشركة أو وسائل التواصل.'
        ].join('\n');
    }
  }

  const contactPattern = /contact|email|mail|whatsapp|phone|تواصل|اتصال|بريد|واتساب|رقم|iletişim|eposta|telefon|контакт|почт|ватсап|телефон/u;
  const pricingPattern = /price|pricing|quote|quotation|cost|exw|shipping|delivery|سعر|أسعار|عرض سعر|تكلفة|شحن|توصيل|fiyat|teklif|maliyet|kargo|teslimat|цена|стоимость|доставка|exw/u;
  const companyPattern = /about|company|who are|karahoca|من نحن|شركة|عن الشركة|hakkımızda|firma|компан|о вас/u;
  const qualityPattern = /quality|certificate|factory|private label|manufacturing|جودة|شهادة|مصنع|تصنيع|علامة خاصة|kalite|sertifika|fabrika|uretim|özel marka|качество|сертифик|завод|производ/u;

  if (contactPattern.test(normalizedQuestion)) {
    switch (normalizeLanguageCode(language)) {
      case 'en':
        return [
          'You can contact KARAHOCA directly through the official channels below:',
          '- Email: info@karahoca.com',
          '- WhatsApp: +90 530 591 4990'
        ].join('\n');
      case 'tr':
        return [
          'KARAHOCA ile dogrudan asagidaki resmi kanallardan iletisime gecebilirsiniz:',
          '- E-posta: info@karahoca.com',
          '- WhatsApp: +90 530 591 4990'
        ].join('\n');
      case 'ru':
        return [
          'Вы можете связаться с KARAHOCA по официальным каналам ниже:',
          '- Email: info@karahoca.com',
          '- WhatsApp: +90 530 591 4990'
        ].join('\n');
      case 'ar':
      default:
        return [
          'يمكنك التواصل مع KARAHOCA مباشرة عبر القنوات الرسمية التالية:',
          '- البريد الإلكتروني: info@karahoca.com',
          '- الواتساب: +90 530 591 4990'
        ].join('\n');
    }
  }

  if (pricingPattern.test(normalizedQuestion)) {
    switch (normalizeLanguageCode(language)) {
      case 'en':
        return [
          'Pricing depends on the product type, order quantity, and size.',
          'KARAHOCA offers Ex Works (EXW) terms from the factory, and detailed quotations are provided directly by the sales team.',
          'For a custom quote, contact info@karahoca.com or WhatsApp +90 530 591 4990.'
        ].join('\n');
      case 'tr':
        return [
          'Fiyatlar urun tipi, siparis miktari ve boyuta gore degisir.',
          'KARAHOCA fabrikadan Ex Works (EXW) sartlariyla calisir ve detayli teklif satis ekibi tarafindan hazirlanir.',
          'Ozel teklif icin info@karahoca.com veya WhatsApp +90 530 591 4990 uzerinden ulasabilirsiniz.'
        ].join('\n');
      case 'ru':
        return [
          'Цена зависит от типа продукта, объема заказа и размера.',
          'KARAHOCA работает на условиях Ex Works (EXW) с завода, а подробные коммерческие предложения готовит отдел продаж.',
          'Для индивидуального предложения свяжитесь с нами: info@karahoca.com или WhatsApp +90 530 591 4990.'
        ].join('\n');
      case 'ar':
      default:
        return [
          'تعتمد الأسعار على نوع المنتج والكمية المطلوبة والحجم.',
          'تعمل KARAHOCA بنظام Ex Works (EXW) من المصنع، ويتم إعداد عروض الأسعار التفصيلية مباشرة عبر فريق المبيعات.',
          'لطلب عرض سعر مخصص يمكنك التواصل عبر info@karahoca.com أو الواتساب +90 530 591 4990.'
        ].join('\n');
    }
  }

  if (companyPattern.test(normalizedQuestion)) {
    switch (normalizeLanguageCode(language)) {
      case 'en':
        return [
          'KARAHOCA KIMYA is a Turkish company that manufactures household and industrial cleaning products.',
          'Its portfolio includes the DIOX and AYLUX brands, with production focused on quality, modern processes, and export-ready supply.'
        ].join('\n');
      case 'tr':
        return [
          'KARAHOCA KIMYA, evsel ve endustriyel temizlik urunleri ureten Turk bir sirkettir.',
          'Portfoyunde DIOX ve AYLUX markalari bulunur; uretimde kaliteye, modern sureclere ve ihracata uygun tedarige odaklanir.'
        ].join('\n');
      case 'ru':
        return [
          'KARAHOCA KIMYA — турецкая компания, производящая бытовые и промышленные чистящие средства.',
          'В портфеле есть бренды DIOX и AYLUX; производство ориентировано на качество, современные процессы и экспортные поставки.'
        ].join('\n');
      case 'ar':
      default:
        return [
          'KARAHOCA KIMYA شركة تركية متخصصة في تصنيع منتجات التنظيف المنزلية والصناعية.',
          'وتضم ضمن محفظتها علامتي DIOX وAYLUX مع تركيز على الجودة والتقنيات الحديثة والاستعداد لأسواق التصدير.'
        ].join('\n');
    }
  }

  if (qualityPattern.test(normalizedQuestion)) {
    switch (normalizeLanguageCode(language)) {
      case 'en':
        return [
          'KARAHOCA focuses on controlled production quality, internal testing, and careful supply-chain monitoring.',
          'The company can also support private-label and flexible manufacturing partnerships depending on customer needs.'
        ].join('\n');
      case 'tr':
        return [
          'KARAHOCA kontrollu uretim kalitesine, ic testlere ve tedarik zinciri takibine odaklanir.',
          'Sirket, ihtiyaca gore ozel marka ve esnek uretim is birliklerini de destekleyebilir.'
        ].join('\n');
      case 'ru':
        return [
          'KARAHOCA уделяет внимание контролю качества производства, внутренним испытаниям и отслеживанию цепочки поставок.',
          'Компания также может поддерживать private label и гибкие производственные партнерства в зависимости от потребностей клиента.'
        ].join('\n');
      case 'ar':
      default:
        return [
          'تركز KARAHOCA على جودة الإنتاج والاختبارات الداخلية ومراقبة سلسلة التوريد بعناية.',
          'كما يمكنها دعم التصنيع المرن وتصنيع العلامات الخاصة بحسب احتياجات العميل.'
        ].join('\n');
    }
  }

  const productReply = buildLocalProductFallbackReply(question, t, language);
  if (productReply) {
    return productReply;
  }

  switch (normalizeLanguageCode(language)) {
    case 'en':
      return [
        'I can still help using the information currently available on the KARAHOCA website.',
        'Available topics include DIOX products, AYLUX products, pricing, shipping, company information, quality, and contact details.',
        'For direct contact: info@karahoca.com | WhatsApp: +90 530 591 4990'
      ].join('\n');
    case 'tr':
      return [
        'KARAHOCA web sitesinde mevcut olan bilgilerle yine de yardimci olabilirim.',
        'Mevcut konular: DIOX urunleri, AYLUX urunleri, fiyatlar, kargo, sirket bilgileri, kalite ve iletisim detaylari.',
        'Dogrudan iletisim: info@karahoca.com | WhatsApp: +90 530 591 4990'
      ].join('\n');
    case 'ru':
      return [
        'Я все равно могу помочь, используя информацию, доступную на сайте KARAHOCA.',
        'Доступные темы: продукты DIOX, продукты AYLUX, цены, доставка, информация о компании, качество и контакты.',
        'Прямой контакт: info@karahoca.com | WhatsApp: +90 530 591 4990'
      ].join('\n');
    case 'ar':
    default:
      return [
        'يمكنني مع ذلك مساعدتك بالاعتماد على المعلومات المتاحة في موقع KARAHOCA.',
        'الموضوعات المتاحة تشمل منتجات DIOX وAYLUX والأسعار والشحن ومعلومات الشركة والجودة ووسائل التواصل.',
        'للتواصل المباشر: info@karahoca.com | الواتساب: +90 530 591 4990'
      ].join('\n');
  }
};

export const buildKnowledgeBase = (
  t: TFunction,
  question: string = ''
): KnowledgeSection[] => {
  const catalogs = getBrandCatalogs(t);
  const catalogSections = catalogs.map(buildCatalogSection);
  const comparisonSection = buildBrandComparisonSection(catalogs);
  const focusedComparisonSection = buildFocusedComparisonSection(question, catalogs);
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
    ...(focusedComparisonSection ? [focusedComparisonSection] : [])
  ];

  if (shouldPrioritizeProductKnowledge(question)) {
    return [...productPrioritySections, ...catalogSections, ...baseKnowledgeSections];
  }

  return [...baseKnowledgeSections, ...productPrioritySections, ...catalogSections];
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
- Use a friendly and professional tone
- Provide answers in short paragraphs or easy-to-read bullet points
- Always include brand names (DIOX, AYLUX, KARAHOCA) in English regardless of response language
- Use the actual product data from the website catalog whenever the question is about products, variants, sizes, materials, counts, or comparisons
- If the customer asks to compare products, compare using the catalog fields that are actually available: brand, category, description, weight/size, material, and count
- Never say that product comparison information is unavailable if the catalog already contains relevant product entries
- If information is not in the knowledge base, acknowledge this clearly and provide contact information
- Do not mention details outside of KARAHOCA's scope
- Remind customers of official contact options: info@karahoca.com | WhatsApp: +90 530 591 4990
`;


/** نص ترحيبي مبني على اللغة الحالية. */
export const getAssistantWelcomeMessage = (lang: string) => {
  switch (normalizeLanguageCode(lang)) {
    case 'en':
      return `**Welcome!** 👋

I'm the AI assistant for **KARAHOCA**.
You can ask me about our products, company, shipping, and contact details.`;
    case 'tr':
      return `**Hoş geldiniz!** 👋

Ben **KARAHOCA** için hazırlanan yapay zeka asistanıyım.
Ürünlerimiz, şirketimiz, sevkiyat ve iletişim hakkında soru sorabilirsiniz.`;
    case 'ru':
      return `**Добро пожаловать!** 👋

Я виртуальный помощник компании **KARAHOCA**.
Вы можете спросить меня о продукции, компании, доставке и способах связи.`;
    case 'ar':
    default:
      return `**مرحباً بك!** 👋

أنا المساعد الذكي لشركة **KARAHOCA**.
يمكنك سؤالي عن المنتجات، الشركة، الشحن، ووسائل التواصل.`;
  }
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
  const lowerMessage = lastUserMessage.toLowerCase();
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
      default: ['من نحن؟', 'منتجاتنا', 'التواصل معنا', 'الأسعار']
    },
    en: {
      diox: ['AYLUX Products', 'Pricing & Shipping', 'Request Quote'],
      aylux: ['DIOX Products', 'Compare Products', 'Contact Info'],
      pricing: ['EXW Shipping Terms', 'Minimum Order', 'Contact for Quote'],
      products: ['Pricing Info', 'Shipping & Delivery', 'Factory & Quality'],
      contact: ['Our Products', 'Pricing Questions', 'Company Info'],
      company: ['DIOX Products', 'AYLUX Products', 'Contact Methods'],
      quality: ['Quality Certificates', 'Factory', 'Products'],
      default: ['About Us?', 'Our Products', 'Contact Us', 'Pricing']
    },
    tr: {
      diox: ['AYLUX Ürünleri', 'Fiyat & Kargo', 'Teklif İste'],
      aylux: ['DIOX Ürünleri', 'Ürün Karşılaştır', 'İletişim Bilgileri'],
      pricing: ['EXW Kargo Şartları', 'Minimum Sipariş', 'Teklif İçin İletişim'],
      products: ['Fiyat Bilgisi', 'Kargo & Teslimat', 'Fabrika & Kalite'],
      contact: ['Ürünlerimiz', 'Fiyat Soruları', 'Şirket Bilgisi'],
      company: ['DIOX Ürünleri', 'AYLUX Ürünleri', 'İletişim Yöntemleri'],
      quality: ['Kalite Sertifikaları', 'Fabrika', 'Ürünler'],
      default: ['Hakkımızda?', 'Ürünlerimiz', 'Bize Ulaşın', 'Fiyatlandırma']
    },
    ru: {
      diox: ['Продукты AYLUX', 'Цены и доставка', 'Запросить предложение'],
      aylux: ['Продукты DIOX', 'Сравнить продукты', 'Контактная информация'],
      pricing: ['Условия доставки EXW', 'Минимальный заказ', 'Связаться для предложения'],
      products: ['Информация о ценах', 'Доставка', 'Завод и качество'],
      contact: ['Наши продукты', 'Вопросы о ценах', 'Информация о компании'],
      company: ['Продукты DIOX', 'Продукты AYLUX', 'Способы связи'],
      quality: ['Сертификаты качества', 'Завод', 'Продукты'],
      default: ['О нас?', 'Наши продукты', 'Связаться с нами', 'Цены']
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
  if (lowerMessage.includes('price') || lowerMessage.includes('سعر') || lowerMessage.includes('أسعار') || 
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

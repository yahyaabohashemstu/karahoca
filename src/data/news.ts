import { buildApiUrl } from "../utils/api";
import type { SupportedLanguageCode } from "../utils/language";

interface LocalizedTextMap {
  ar: string;
  en: string;
  tr: string;
  ru: string;
}

interface LocalizedParagraphMap {
  ar: string[];
  en: string[];
  tr: string[];
  ru: string[];
}

interface NewsItem {
  id: string;
  slug: string;
  image: string;
  publishedAt: string;
  category: LocalizedTextMap;
  title: LocalizedTextMap;
  excerpt: LocalizedTextMap;
  body: LocalizedParagraphMap;
}

export interface LocalizedNewsItem {
  id: string;
  slug: string;
  image: string;
  publishedAt: string;
  dateLabel: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  alt: string;
}

const newsItems: NewsItem[] = [
  {
    id: "diox-dish-gel-launch",
    slug: "diox-dish-gel-launch",
    image: "/diox-images/ديوكس جل غسيل الصحون.png",
    publishedAt: "2026-02-18",
    category: {
      ar: "إطلاق منتج",
      en: "Product launch",
      tr: "Yeni urun",
      ru: "Запуск продукта",
    },
    title: {
      ar: "إطلاق جيل مطور من جل الصحون DIOX",
      en: "Launching the new DIOX dishwashing gel line",
      tr: "Yeni DIOX bulasik jeli serisinin lansmani",
      ru: "Запуск новой линейки геля для посуды DIOX",
    },
    excerpt: {
      ar: "أطلقنا تركيبة مطورة تمنح إزالة دهون أسرع وثبات رغوة أعلى لتلبية احتياجات شركائنا في أسواق التوزيع الجديدة.",
      en: "We introduced an upgraded formula with faster grease removal and more stable foam for our expanding distribution markets.",
      tr: "Yeni formulumuz daha hizli yag cozme ve daha dengeli kopuk performansi ile dagitim pazarlarimizin ihtiyaclarina yanit veriyor.",
      ru: "Мы представили обновленную формулу с более быстрым удалением жира и стабильной пеной для новых рынков дистрибуции.",
    },
    body: {
      ar: [
        "أعلنت KARAHOCA عن إطلاق نسخة مطورة من جل غسيل الصحون ضمن علامة DIOX مع تركيز أعلى على الأداء اليومي وثبات النتائج في الاستخدام المنزلي والتجاري.",
        "التركيبة الجديدة صممت لتوازن بين سرعة إزالة الدهون، سهولة الشطف، وثبات الرغوة، مع الحفاظ على المظهر البصري والهوية القوية التي تميز خط DIOX في نقاط البيع.",
        "هذا الإطلاق يأتي ضمن خطتنا لتحديث المنتجات الأكثر طلباً في الأسواق الحالية وتهيئتها للتوسع في قنوات توزيع جديدة خلال الفترة القادمة.",
      ],
      en: [
        "KARAHOCA has introduced an upgraded DIOX dishwashing gel designed to deliver stronger daily performance for both household and professional use.",
        "The new formula balances quicker grease removal, easier rinsing, and more stable foam while preserving the bold shelf identity that defines the DIOX line.",
        "This launch is part of our roadmap to refresh high-demand products and prepare them for wider distribution in the coming period.",
      ],
      tr: [
        "KARAHOCA, evsel ve profesyonel kullanim icin daha guclu gunluk performans sunan gelistirilmis DIOX bulasik jeli formulu piyasaya sundu.",
        "Yeni formul; daha hizli yag cozme, daha kolay durulama ve daha stabil kopuk dengesini ayni urunde toplarken DIOX serisinin guclu raf kimligini de koruyor.",
        "Bu lansman, yuksek talep goren urunleri yenileme ve onlari daha genis dagitim kanallarina hazirlama planimizin bir parcasidir.",
      ],
      ru: [
        "KARAHOCA представила обновленный гель для мытья посуды DIOX, рассчитанный на более высокую ежедневную эффективность как в бытовом, так и в профессиональном использовании.",
        "Новая формула сочетает более быстрое удаление жира, легкое смывание и стабильную пену, сохраняя при этом узнаваемую визуальную айдентику линейки DIOX.",
        "Этот запуск является частью нашей программы по обновлению самых востребованных продуктов и подготовке их к расширению каналов дистрибуции.",
      ],
    },
  },
  {
    id: "north-africa-distribution",
    slug: "north-africa-distribution",
    image: "/KARAHOCA-1-newPhoto.webp",
    publishedAt: "2026-01-12",
    category: {
      ar: "عقود وتوزيع",
      en: "Contracts & distribution",
      tr: "Anlasmalar ve dagitim",
      ru: "Контракты и дистрибуция",
    },
    title: {
      ar: "اتفاقيات توزيع جديدة لدعم حضورنا الإقليمي",
      en: "New distribution agreements to expand our regional reach",
      tr: "Bolgesel varligimizi buyuten yeni dagitim anlasmalari",
      ru: "Новые дистрибьюторские соглашения для расширения регионального присутствия",
    },
    excerpt: {
      ar: "وسعنا شبكة شركائنا من خلال اتفاقيات جديدة تستهدف رفع الجاهزية اللوجستية وتسريع الوصول إلى العملاء في أسواق استراتيجية.",
      en: "We expanded our partner network with new agreements focused on logistics readiness and faster access to customers in strategic markets.",
      tr: "Lojistik hazirlik ve stratejik pazarlarda musterilere daha hizli ulasim hedefiyle partner agimizi yeni anlasmalarla genislettik.",
      ru: "Мы расширили партнерскую сеть новыми соглашениями, ориентированными на логистическую готовность и более быстрый доступ к клиентам на стратегических рынках.",
    },
    body: {
      ar: [
        "خلال الربع الأول من العام، أتمت KARAHOCA سلسلة اتفاقيات توزيع جديدة مع شركاء إقليميين لدعم انتشار منتجاتنا في أسواق ذات طلب متزايد على حلول التنظيف عالية الجودة.",
        "التركيز في هذه الاتفاقيات كان على جاهزية المخزون، سرعة التوريد، وتخصيص التشكيلات المناسبة لكل سوق بما يتماشى مع سلوك الاستهلاك المحلي.",
        "هذه الخطوة تعزز حضورنا التجاري وتمنحنا مرونة أكبر في خدمة عملائنا وشركائنا على نطاق جغرافي أوسع.",
      ],
      en: [
        "During the first quarter, KARAHOCA completed a new group of distribution agreements with regional partners to support the rollout of our cleaning portfolio in high-demand markets.",
        "These agreements focus on stock readiness, faster supply, and assortment planning tailored to the needs of each local market.",
        "The move strengthens our commercial presence and gives us greater flexibility in serving partners and customers across a wider geography.",
      ],
      tr: [
        "Yilin ilk ceyreginde KARAHOCA, yuksek talep potansiyeline sahip pazarlarda urun portfoyumuzu guclendirmek icin bolgesel partnerlerle yeni dagitim anlasmalari tamamladi.",
        "Bu anlasmalar; stok hazirligi, daha hizli tedarik ve her pazar icin uygun urun karmasinin planlanmasi uzerine kuruldu.",
        "Bu adim ticari varligimizi guclendirirken partnerlerimize ve musterilerimize daha genis bir cografyada daha esnek hizmet sunmamizi sagliyor.",
      ],
      ru: [
        "В первом квартале KARAHOCA заключила новую серию дистрибьюторских соглашений с региональными партнерами для усиления присутствия нашего портфеля в рынках с высоким спросом.",
        "Ключевой акцент в соглашениях сделан на готовности складских запасов, скорости поставок и формировании ассортимента под особенности каждого рынка.",
        "Этот шаг усиливает наше коммерческое присутствие и дает нам больше гибкости в обслуживании партнеров и клиентов на более широкой географии.",
      ],
    },
  },
  {
    id: "industry-exhibitions",
    slug: "industry-exhibitions",
    image: "/KARAHOCA-4-web.webp",
    publishedAt: "2025-11-07",
    category: {
      ar: "المعارض والفعاليات",
      en: "Exhibitions & events",
      tr: "Fuarlar ve etkinlikler",
      ru: "Выставки и мероприятия",
    },
    title: {
      ar: "مشاركتنا في المعارض الصناعية المتخصصة",
      en: "Our participation in specialized industry exhibitions",
      tr: "Uzmanlik fuarlarina katilimimiz",
      ru: "Наше участие в профильных отраслевых выставках",
    },
    excerpt: {
      ar: "نواصل الظهور في الفعاليات المهنية لعرض منتجاتنا، لقاء الشركاء، وقراءة اتجاهات السوق عن قرب.",
      en: "We continue to join professional events to present our products, meet partners, and read market shifts up close.",
      tr: "Urunlerimizi sergilemek, partnerlerle bulusmak ve pazar yonelimlerini yakindan okumak icin profesyonel etkinliklerde yer almaya devam ediyoruz.",
      ru: "Мы продолжаем участвовать в профессиональных мероприятиях, чтобы представлять продукцию, встречаться с партнерами и ближе отслеживать изменения рынка.",
    },
    body: {
      ar: [
        "تعد المعارض المتخصصة مساحة مهمة لعرض تطور منتجات KARAHOCA وتقديم علامتَي DIOX وAYLUX أمام موزعين ومشترين من قطاعات مختلفة.",
        "خلال مشاركاتنا الأخيرة، ركزنا على إبراز قوة خط الإنتاج، مرونة التعبئة، وإمكانيات الشراكات طويلة المدى في الأسواق المستهدفة.",
        "وجودنا في هذه الفعاليات لا يقتصر على العرض فقط، بل يشكل أيضاً قناة مباشرة لفهم احتياجات السوق وتغذية خططنا التطويرية القادمة.",
      ],
      en: [
        "Specialized exhibitions remain an important space for KARAHOCA to showcase product development and present both DIOX and AYLUX to distributors and buyers from multiple sectors.",
        "In our recent participation, we highlighted manufacturing strength, packaging flexibility, and our ability to build long-term market partnerships.",
        "These events are not only about visibility; they are also a direct channel for understanding demand and feeding that insight back into future product planning.",
      ],
      tr: [
        "Uzmanlik fuarlari, KARAHOCA icin urun gelisimini sergilemek ve hem DIOX hem de AYLUX markalarini farkli sektorlerden distribütorler ve satin almacilarla bulusturmak adina onemli bir alan olmaya devam ediyor.",
        "Son katilimlarimizda uretim gucu, ambalaj esnekligi ve uzun vadeli pazar ortakliklari kurma kabiliyetimiz one cikti.",
        "Bu etkinlikler yalnizca gorunurluk saglamiyor; ayni zamanda talebi dogrudan anlamamiza ve bu icgoruleri sonraki urun planlarina aktarmamiza yardimci oluyor.",
      ],
      ru: [
        "Профильные выставки остаются для KARAHOCA важной площадкой, где мы демонстрируем развитие продуктов и представляем бренды DIOX и AYLUX дистрибьюторам и закупщикам из разных отраслей.",
        "В рамках последних участий мы акцентировали внимание на производственной мощности, гибкости упаковки и потенциале долгосрочных партнерств на целевых рынках.",
        "Такие мероприятия важны не только для узнаваемости, но и как прямой канал понимания спроса и передачи этих знаний в будущие продуктовые планы.",
      ],
    },
  },
  {
    id: "production-upgrade",
    slug: "production-upgrade",
    image: "/KARAHOCA-2-wb.webp",
    publishedAt: "2025-09-03",
    category: {
      ar: "التطوير والتشغيل",
      en: "Operations & upgrades",
      tr: "Operasyon ve gelistirme",
      ru: "Производство и модернизация",
    },
    title: {
      ar: "توسعة تشغيلية لرفع كفاءة خطوط الإنتاج",
      en: "Operational expansion to improve production efficiency",
      tr: "Uretim verimliligini artiran operasyonel genisleme",
      ru: "Операционное расширение для повышения эффективности производства",
    },
    excerpt: {
      ar: "واصلنا تحديث بيئة الإنتاج لرفع الاستقرار التشغيلي، تحسين التدفق، والاستجابة بشكل أسرع لطلبات العملاء المتزايدة.",
      en: "We continued upgrading the production environment to strengthen operational stability, improve flow, and respond faster to growing demand.",
      tr: "Artan talebe daha hizli yanit verebilmek icin uretim ortamini gelistirmeyi, akis verimliligini ve operasyonel istikrari guclendirmeyi surdurduk.",
      ru: "Мы продолжили модернизацию производственной среды, чтобы повысить операционную стабильность, улучшить поток и быстрее реагировать на растущий спрос.",
    },
    body: {
      ar: [
        "ضمن خطتنا للتطوير المستمر، نفذت KARAHOCA حزمة تحديثات تشغيلية استهدفت تحسين تدفق العمل داخل المرافق ورفع كفاءة الاستفادة من الطاقة الإنتاجية.",
        "شملت التحديثات تحسين جاهزية بعض المراحل، تنظيم الحركة الداخلية للمواد، ورفع مرونة الاستجابة عند اختلاف أحجام الطلبات بين الأسواق والعملاء.",
        "هذا التطور التشغيلي يدعم قدرتنا على الحفاظ على الجودة مع تسليم أكثر استقراراً وسرعة في المشاريع الحالية والمستقبلية.",
      ],
      en: [
        "As part of our continuous improvement roadmap, KARAHOCA implemented a new package of operational upgrades to improve workflow across the facility and make better use of production capacity.",
        "The upgrades included stronger stage readiness, improved internal material flow, and greater flexibility in handling different order sizes across markets and customer groups.",
        "This operational step supports our ability to maintain quality while delivering with more consistency and speed in current and upcoming projects.",
      ],
      tr: [
        "Surekli gelisim yol haritamizin bir parcasi olarak KARAHOCA, tesis icindeki is akislarini iyilestiren ve uretim kapasitesinden daha verimli yararlanilmasini saglayan yeni bir operasyonel gelistirme paketi uyguladi.",
        "Bu guncellemeler; asama hazirligini guclendirmeyi, ic malzeme akislarini iyilestirmeyi ve farkli siparis hacimlerine daha esnek yanit verebilmeyi kapsadi.",
        "Bu operasyonel adim, kaliteyi korurken mevcut ve gelecek projelerde daha istikrarli ve hizli teslimat yapmamizi destekliyor.",
      ],
      ru: [
        "В рамках программы непрерывного развития KARAHOCA внедрила новый пакет операционных улучшений, направленных на оптимизацию рабочих процессов на площадке и более эффективное использование производственной мощности.",
        "Обновления включали повышение готовности отдельных этапов, улучшение внутреннего потока материалов и большую гибкость при работе с разными объемами заказов по рынкам и клиентским группам.",
        "Этот шаг усиливает нашу способность сохранять качество и обеспечивать более стабильные и быстрые поставки по текущим и будущим проектам.",
      ],
    },
  },
];

const localeMap: Record<SupportedLanguageCode, string> = {
  ar: "ar",
  en: "en-US",
  tr: "tr-TR",
  ru: "ru-RU",
};

export const formatNewsDate = (
  publishedAt: string,
  language: SupportedLanguageCode,
) =>
  new Intl.DateTimeFormat(localeMap[language], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(publishedAt));

export const getLocalizedNewsItems = (
  language: SupportedLanguageCode,
): LocalizedNewsItem[] =>
  newsItems
    .slice()
    .sort(
      (first, second) =>
        new Date(second.publishedAt).getTime() -
        new Date(first.publishedAt).getTime(),
    )
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      image: item.image,
      publishedAt: item.publishedAt,
      dateLabel: formatNewsDate(item.publishedAt, language),
      category: item.category[language],
      title: item.title[language],
      excerpt: item.excerpt[language],
      body: item.body[language],
      alt: item.title[language],
    }));

// ─── API-based fetching (primary source when server is available) ────────────
// The public API (/api/news?lang=xx) already returns fully translated, ready-to-use
// LocalizedNewsItem objects — no further mapping is needed.

export const fetchNewsFromApi = async (
  language: SupportedLanguageCode,
): Promise<LocalizedNewsItem[] | null> => {
  try {
    const res = await fetch(buildApiUrl(`/api/news?lang=${language}`));
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success: boolean;
      items: LocalizedNewsItem[];
    };
    if (!data.success || !Array.isArray(data.items)) return null;
    return data.items;
  } catch {
    return null;
  }
};

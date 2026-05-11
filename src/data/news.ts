import { apiFetch } from "../utils/apiFetch";
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

// Static fallback was emptied on 2026-05-11 — the previous entries were
// placeholder/marketing copy used during development. Real news now lives
// in the SQLite `news` table and is exposed via `GET /api/news`. The
// `fetchNewsFromApi` call in NewsSection takes the API result as the
// source of truth; an empty array here means the news strip and the
// /news page hide themselves cleanly when the API also returns nothing,
// instead of falling back to fake content.
const newsItems: NewsItem[] = [
  // Intentionally empty. To add seed news, prefer the admin panel at
  // /admin/news rather than this file — admin edits persist and survive
  // redeploys, hard-coded items don't.
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
    const res = await apiFetch(`/api/news?lang=${language}`);
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

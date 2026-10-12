import { useEffect, useRef, useState } from 'react';
import { fetchNewsFromApi, getLocalizedNewsItems, getPrerenderedNews, type LocalizedNewsItem } from '../data/news';
import type { SupportedLanguageCode } from '../utils/language';

/**
 * The news list for a language. Starts from the prerendered snapshot's data
 * (or the built-in items), then refreshes from the API, which is the source
 * of truth. A failed refresh keeps the list on screen when it is in this
 * language: the API being briefly unreachable must not empty a page that
 * rendered fine.
 */
export const useNewsItems = (language: SupportedLanguageCode): LocalizedNewsItem[] => {
  const [items, setItems] = useState<LocalizedNewsItem[]>(
    () => getPrerenderedNews(language) ?? getLocalizedNewsItems(language),
  );
  const itemsLanguage = useRef(language);

  useEffect(() => {
    let cancelled = false;
    fetchNewsFromApi(language).then((apiItems) => {
      if (cancelled) return;
      if (apiItems === null && itemsLanguage.current === language) return;
      setItems(apiItems && apiItems.length > 0 ? apiItems : getLocalizedNewsItems(language));
      itemsLanguage.current = language;
    });
    return () => { cancelled = true; };
  }, [language]);

  return items;
};

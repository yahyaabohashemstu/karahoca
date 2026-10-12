import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchBrandCatalogFromApi,
  getAyluxCategories,
  getDioxCategories,
  initialBrandCategories,
  mergeApiWithStaticCatalog,
  type BrandCategoryData,
} from '../data/brandCatalog';
import { normalizeLanguageCode } from '../utils/language';

const STATIC_CATEGORIES = { DIOX: getDioxCategories, AYLUX: getAyluxCategories } as const;

/**
 * A brand's product categories. Starts from the prerendered snapshot's data
 * (or the built-in catalog), then refreshes from the API merged over the
 * built-in catalog. A failed refresh keeps the categories on screen when
 * they are in the current language: the API being briefly unreachable must
 * not swap a rendered catalog for the built-in one.
 */
export const useBrandCategories = (brand: 'DIOX' | 'AYLUX'): BrandCategoryData[] => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [categories, setCategories] = useState<BrandCategoryData[]>(
    () => initialBrandCategories(brand, lang, STATIC_CATEGORIES[brand](t)),
  );
  const categoriesLang = useRef(lang);

  useEffect(() => {
    let cancelled = false;
    const staticCats = STATIC_CATEGORIES[brand](t);
    fetchBrandCatalogFromApi(brand, lang).then((apiCats) => {
      if (cancelled) return;
      if (apiCats === null && categoriesLang.current === lang) return;
      setCategories(apiCats && apiCats.length > 0 ? mergeApiWithStaticCatalog(apiCats, staticCats) : staticCats);
      categoriesLang.current = lang;
    });
    return () => { cancelled = true; };
  }, [brand, lang, t]);

  return categories;
};

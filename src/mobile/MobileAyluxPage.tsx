import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import MobileBrandPageTemplate from "./MobileBrandPageTemplate";
import { getAyluxCategories, fetchBrandCatalogFromApi, type BrandCategoryData } from "../data/brandCatalog";
import { normalizeLanguageCode } from "../utils/language";

export default function MobileAyluxPage() {
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [categories, setCategories] = useState<BrandCategoryData[]>(() => getAyluxCategories(t));

  useEffect(() => {
    let cancelled = false;
    const staticCats = getAyluxCategories(t);
    fetchBrandCatalogFromApi("AYLUX", currentLang).then(apiCats => {
      if (cancelled) return;
      if (apiCats && apiCats.length > 0) {
        const merged = apiCats.map((apiCat, ci) => ({
          ...apiCat,
          products: apiCat.products.map((apiProd, pi) => {
            const staticProd = staticCats[ci]?.products[pi];
            const gift = apiProd.details?.gift ?? staticProd?.details?.gift;
            return {
              ...apiProd,
              details: { ...apiProd.details, ...(gift ? { gift } : {}) },
            };
          }),
        }));
        setCategories(merged);
      } else {
        setCategories(staticCats);
      }
    });
    return () => { cancelled = true; };
  }, [currentLang]);

  return (
    <MobileBrandPageTemplate
      seoTitle={t("aylux.seo.title")}
      seoDescription={t("aylux.seo.description")}
      seoKeywords={t("aylux.seo.keywords")}
      canonicalUrl="https://karahoca.com/aylux"
      ogImage="/Aylux-logo.png.webp"
      brandName="AYLUX"
      brandNameArabic={t("aylux.brandNameArabic")}
      heroTitle={t("aylux.hero.title")}
      heroDescription={t("aylux.hero.description")}
      heroImage="/Aylux-logo.png.webp"
      heroImageAlt={t("aylux.hero.imageAlt")}
      badges={[
        t("aylux.hero.badge1"),
        t("aylux.hero.badge2"),
        t("aylux.hero.badge3"),
      ]}
      aboutTitle={t("aylux.about.title")}
      aboutSubtitle={t("aylux.about.subtitle")}
      aboutMainHeading={t("aylux.about.mainHeading")}
      aboutSections={[
        {
          title: t("aylux.about.section1.title"),
          content: t("aylux.about.content"),
        },
      ]}
      productsTitle={t("aylux.productsSection.title")}
      productsSubtitle={t("aylux.productsSection.subtitle")}
      categories={categories}
      aboutId="about-aylux"
    />
  );
}

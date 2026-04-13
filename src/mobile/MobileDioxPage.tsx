import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import MobileBrandPageTemplate from "./MobileBrandPageTemplate";
import { getDioxCategories, fetchBrandCatalogFromApi, type BrandCategoryData } from "../data/brandCatalog";
import { normalizeLanguageCode } from "../utils/language";

export default function MobileDioxPage() {
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [categories, setCategories] = useState<BrandCategoryData[]>(() => getDioxCategories(t));

  useEffect(() => {
    let cancelled = false;
    const staticCats = getDioxCategories(t);
    fetchBrandCatalogFromApi("DIOX", currentLang).then(apiCats => {
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
      seoTitle={t("diox.seo.title")}
      seoDescription={t("diox.seo.description")}
      seoKeywords={t("diox.seo.keywords")}
      canonicalUrl="https://karahoca.com/diox"
      ogImage="/Diox-logo.png.webp"
      brandName="DIOX"
      brandNameArabic={t("diox.brandNameArabic")}
      heroTitle={t("diox.hero.title")}
      heroDescription={t("diox.hero.description")}
      heroImage="/Diox-logo.png.webp"
      heroImageAlt={t("diox.hero.imageAlt")}
      badges={[
        t("diox.hero.badge1"),
        t("diox.hero.badge2"),
        t("diox.hero.badge3"),
      ]}
      aboutTitle={t("diox.about.title")}
      aboutSubtitle={t("diox.about.subtitle")}
      aboutMainHeading={t("diox.about.mainHeading")}
      aboutSections={[
        {
          title: t("diox.about.section1.title"),
          content: t("diox.about.content"),
        },
      ]}
      productsTitle={t("diox.productsSection.title")}
      productsSubtitle={t("diox.productsSection.subtitle")}
      categories={categories}
      aboutId="about-diox"
      catalogImages={Array.from({ length: 18 }, (_, i) =>
        `/Catalog/DIOX catalog imgs - 2/page-${String(i + 1).padStart(2, '0')}.png`
      )}
      pdfUrl="/Catalog/DIOX-KATALOG.pdf"
    />
  );
}

import { useTranslation } from "react-i18next";
import MobileBrandPageTemplate from "./MobileBrandPageTemplate";
import { getDioxCategories } from "../data/brandCatalog";

export default function MobileDioxPage() {
  const { t } = useTranslation();

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
      categories={getDioxCategories(t)}
      aboutId="about-diox"
    />
  );
}

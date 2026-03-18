import { useTranslation } from "react-i18next";
import MobileBrandPageTemplate from "./MobileBrandPageTemplate";
import { getAyluxCategories } from "../data/brandCatalog";

export default function MobileAyluxPage() {
  const { t } = useTranslation();

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
      categories={getAyluxCategories(t)}
      aboutId="about-aylux"
    />
  );
}

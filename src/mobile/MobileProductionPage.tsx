import { useTranslation } from "react-i18next";
import MobileSubPageTemplate, {
  type MobileInfoSection,
} from "./MobileSubPageTemplate";

export default function MobileProductionPage() {
  const { t } = useTranslation();

  const sections: MobileInfoSection[] = [
    {
      id: "process",
      title: t("production.sections.process.title"),
      subtitle: t("production.sections.process.subtitle"),
      cards: [
        {
          title: t("production.sections.process.cards.sourcing.title"),
          description: t("production.sections.process.cards.sourcing.description"),
          accent: "var(--khc-orange)",
        },
        {
          title: t("production.sections.process.cards.mixing.title"),
          description: t("production.sections.process.cards.mixing.description"),
          accent: "var(--khc-deep)",
        },
        {
          title: t("production.sections.process.cards.packaging.title"),
          description: t("production.sections.process.cards.packaging.description"),
          accent: "var(--khc-orange)",
        },
      ],
    },
    {
      id: "safety",
      title: t("production.sections.safety.title"),
      splitContent: {
        title: t("production.sections.safety.title"),
        content: [
          t("production.sections.safety.content1"),
          t("production.sections.safety.content2"),
          t("production.sections.safety.content3"),
        ],
        image: "/KARAHOCA-4-web.webp",
        imageAlt: t("production.sections.safety.imageAlt"),
      },
    },
  ];

  return (
    <MobileSubPageTemplate
      seoTitle={t("production.seo.title")}
      seoDescription={t("production.seo.description")}
      seoKeywords={t("production.seo.keywords")}
      canonicalUrl="https://karahoca.com/production"
      ogImage="/KARAHOCA-4-web.webp"
      eyebrow={t("work.production.title")}
      heroTitle={t("production.heroTitle")}
      heroDescription={t("production.heroDescription")}
      heroImage="/KARAHOCA-4-web.webp"
      heroImageAlt={t("production.heroImageAlt")}
      heroBadges={[
        t("hero.badges.quality"),
        t("hero.badges.experience"),
        t("hero.badges.countries"),
      ]}
      sections={sections}
    />
  );
}

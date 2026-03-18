import { useTranslation } from "react-i18next";
import MobileSubPageTemplate, {
  type MobileInfoSection,
} from "./MobileSubPageTemplate";

export default function MobileDryerPage() {
  const { t } = useTranslation();

  const sections: MobileInfoSection[] = [
    {
      id: "pillars",
      title: t("dryer.sections.pillars.title"),
      subtitle: t("dryer.sections.pillars.subtitle"),
      cards: [
        {
          title: t("dryer.sections.pillars.cards.capacity.title"),
          description: t("dryer.sections.pillars.cards.capacity.description"),
          accent: "var(--khc-orange)",
        },
        {
          title: t("dryer.sections.pillars.cards.integration.title"),
          description: t("dryer.sections.pillars.cards.integration.description"),
          accent: "var(--khc-deep)",
        },
        {
          title: t("dryer.sections.pillars.cards.consistency.title"),
          description: t("dryer.sections.pillars.cards.consistency.description"),
          accent: "var(--khc-orange)",
        },
      ],
    },
    {
      id: "goals",
      title: t("dryer.sections.goals.title"),
      splitContent: {
        title: t("dryer.sections.goals.title"),
        content: [
          t("dryer.sections.goals.content1"),
          t("dryer.sections.goals.content2"),
          t("dryer.sections.goals.content3"),
        ],
        image: "/KARAHOCA-2-wb.webp",
        imageAlt: t("dryer.sections.goals.imageAlt"),
      },
    },
  ];

  return (
    <MobileSubPageTemplate
      seoTitle={t("dryer.seo.title")}
      seoDescription={t("dryer.seo.description")}
      seoKeywords={t("dryer.seo.keywords")}
      canonicalUrl="https://karahoca.com/dryer"
      ogImage="/KARAHOCA-2-wb.webp"
      eyebrow={t("work.dryer.title")}
      heroTitle={t("dryer.heroTitle")}
      heroDescription={t("dryer.heroDescription")}
      heroImage="/KARAHOCA-2-wb.webp"
      heroImageAlt={t("dryer.heroImageAlt")}
      heroBadges={[
        t("hero.badges.quality"),
        t("hero.badges.experience"),
        t("hero.badges.countries"),
      ]}
      sections={sections}
    />
  );
}

import { useTranslation } from "react-i18next";
import MobileSubPageTemplate, {
  type MobileInfoSection,
} from "./MobileSubPageTemplate";

export default function MobileGoalPage() {
  const { t } = useTranslation();

  const sections: MobileInfoSection[] = [
    {
      id: "pillars",
      title: t("goal.sections.pillars.title"),
      subtitle: t("goal.sections.pillars.subtitle"),
      cards: [
        {
          title: t("goal.sections.pillars.innovation.title"),
          description: t("goal.sections.pillars.innovation.description"),
          accent: "var(--khc-orange)",
        },
        {
          title: t("goal.sections.pillars.expansion.title"),
          description: t("goal.sections.pillars.expansion.description"),
          accent: "var(--khc-deep)",
        },
        {
          title: t("goal.sections.pillars.quality.title"),
          description: t("goal.sections.pillars.quality.description"),
          accent: "var(--khc-orange)",
        },
      ],
    },
    {
      id: "goals",
      title: t("goal.sections.goals.title"),
      splitContent: {
        title: t("goal.sections.goals.title"),
        content: [
          t("goal.sections.goals.content1"),
          t("goal.sections.goals.content2"),
          t("goal.sections.goals.content3"),
        ],
        image: "/KARAHOCA-2-wb.webp",
        imageAlt: t("goal.sections.goals.imageAlt"),
      },
    },
  ];

  return (
    <MobileSubPageTemplate
      seoTitle={t("goal.seo.title")}
      seoDescription={t("goal.seo.description")}
      seoKeywords={t("goal.seo.keywords")}
      canonicalUrl="https://karahoca.com/goal"
      ogImage="/KARAHOCA-2-wb.webp"
      eyebrow={t("work.goal.title")}
      heroTitle={t("goal.heroTitle")}
      heroDescription={t("goal.heroDescription")}
      heroImage="/KARAHOCA-2-wb.webp"
      heroImageAlt={t("goal.heroImageAlt")}
      heroBadges={[
        t("hero.badges.quality"),
        t("hero.badges.experience"),
        t("hero.badges.countries"),
      ]}
      sections={sections}
    />
  );
}

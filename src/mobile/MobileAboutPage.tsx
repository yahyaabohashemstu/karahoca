import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";

export default function MobileAboutPage() {
  const { t } = useTranslation();

  const milestones = [
    {
      year: t("aboutPage.milestones.year1.year"),
      title: t("aboutPage.milestones.year1.title"),
      description: t("aboutPage.milestones.year1.description"),
    },
    {
      year: t("aboutPage.milestones.year2.year"),
      title: t("aboutPage.milestones.year2.title"),
      description: t("aboutPage.milestones.year2.description"),
    },
    {
      year: t("aboutPage.milestones.year3.year"),
      title: t("aboutPage.milestones.year3.title"),
      description: t("aboutPage.milestones.year3.description"),
    },
  ];

  const values = [
    {
      title: t("aboutPage.values.quality.title"),
      description: t("aboutPage.values.quality.description"),
      accent: "var(--khc-orange)",
    },
    {
      title: t("aboutPage.values.innovation.title"),
      description: t("aboutPage.values.innovation.description"),
      accent: "var(--khc-deep)",
    },
    {
      title: t("aboutPage.values.sustainability.title"),
      description: t("aboutPage.values.sustainability.description"),
      accent: "var(--khc-orange)",
    },
  ];

  const stats = [
    { value: "15+", label: t("aboutPage.vision.countries") },
    { value: "30+", label: t("aboutPage.vision.experience") },
    { value: "2", label: t("aboutPage.vision.brands") },
    { value: "4", label: t("aboutPage.vision.industries") },
  ];

  return (
    <>
      <SEO
        title={t("aboutPage.seo.title")}
        description={t("aboutPage.seo.description")}
        keywords={t("aboutPage.seo.keywords")}
        canonicalUrl="https://karahoca.com/about"
        ogImage="/KARAHOCA-1-newPhoto.webp"
      />

      <main className="m-page">
        <section className="m-pageHero m-container">
          <div className="m-pageHero__content">
            <span className="m-pageHero__eyebrow">{t("nav.about")}</span>
            <h1 className="m-pageHero__title">{t("aboutPage.hero.title")}</h1>
            <p className="m-pageHero__desc">{t("aboutPage.hero.description")}</p>
            <div className="m-pageHero__badges">
              <span className="m-pageHero__badge">{t("hero.badges.quality")}</span>
              <span className="m-pageHero__badge">{t("hero.badges.experience")}</span>
              <span className="m-pageHero__badge">{t("hero.badges.countries")}</span>
            </div>
            <div className="m-pageHero__actions">
              <a href="#history" className="m-cta">
                {t("aboutPage.history.title")}
              </a>
              <a href="#contact" className="m-ghost">
                {t("nav.contact")}
              </a>
            </div>
          </div>

          <div className="m-pageHero__visual m-card">
            <img src="/KARAHOCA-2-wb.webp" alt={t("aboutPage.hero.imageAlt")} />
          </div>
        </section>

        <section id="history" className="m-pageSection m-container">
          <div className="m-section-header">
            <h2 className="m-section-title">{t("aboutPage.history.title")}</h2>
          </div>
          <div className="m-copyStack">
            <article className="m-richCard m-card">
              <p>{t("aboutPage.history.paragraph1")}</p>
            </article>
            <article className="m-richCard m-card">
              <p>{t("aboutPage.history.paragraph2")}</p>
            </article>
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-section-header">
            <h2 className="m-section-title">{t("aboutPage.milestones.title")}</h2>
          </div>

          <div className="m-timeline">
            {milestones.map((milestone) => (
              <article key={milestone.year} className="m-timelineItem m-card">
                <div className="m-timelineItem__year">{milestone.year}</div>
                <div className="m-timelineItem__body">
                  <h3>{milestone.title}</h3>
                  <p>{milestone.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-section-header">
            <h2 className="m-section-title">{t("aboutPage.vision.title")}</h2>
          </div>

          <div className="m-featureCard m-card">
            <div className="m-featureCard__media">
              <img src="/KARAHOCA-1-newPhoto.webp" alt={t("aboutPage.vision.imageAlt")} />
            </div>
            <div className="m-featureCard__content">
              <h3 className="m-featureCard__title">{t("aboutPage.vision.title")}</h3>
              <p className="m-featureCard__text">{t("aboutPage.vision.description")}</p>

              <div className="m-aboutStats">
                {stats.map((stat) => (
                  <article key={stat.label} className="m-aboutStat">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-section-header">
            <h2 className="m-section-title">{t("aboutPage.values.title")}</h2>
          </div>

          <div className="m-pageCards">
            {values.map((value) => (
              <article key={value.title} className="m-infoCard m-card">
                <span
                  className="m-infoCard__accent"
                  style={{ background: value.accent }}
                />
                <div className="m-infoCard__body">
                  <h3 className="m-infoCard__title">{value.title}</h3>
                  <p className="m-infoCard__desc">{value.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

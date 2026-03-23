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

  const heroBadges = [
    t("hero.badges.quality"),
    t("hero.badges.experience"),
    t("hero.badges.countries"),
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

      <main className="m-page m-aboutPage">
        <section className="m-aboutHero m-container">
          <div className="m-aboutHero__panel m-card">
            <div className="m-aboutHero__copy">
              <span className="m-aboutEyebrow">{t("nav.about")}</span>
              <h1 className="m-aboutHero__title">{t("aboutPage.hero.title")}</h1>
              <p className="m-aboutHero__desc">{t("aboutPage.hero.description")}</p>
            </div>

            <div className="m-aboutHero__badges">
              {heroBadges.map((badge) => (
                <span key={badge} className="m-aboutHero__badge">
                  {badge}
                </span>
              ))}
            </div>

            <div className="m-aboutHero__stage m-card">
              <figure className="m-aboutHero__primaryShot">
                <img src="/KARAHOCA-2-wb.webp" alt={t("aboutPage.hero.imageAlt")} />
              </figure>
              <figure className="m-aboutHero__secondaryShot">
                <img src="/KARAHOCA-1-newPhoto.webp" alt={t("aboutPage.vision.imageAlt")} />
              </figure>
              <div className="m-aboutHero__stageChip">
                <strong>{t("hero.badges.quality")}</strong>
                <span>{t("hero.badges.countries")}</span>
              </div>
            </div>

            <div className="m-aboutHero__actions">
              <a href="#history" className="m-cta">
                {t("aboutPage.history.title")}
              </a>
              <a href="#contact" className="m-ghost">
                {t("nav.contact")}
              </a>
            </div>
          </div>
        </section>

        <section id="history" className="m-pageSection m-container">
          <div className="m-section-header m-aboutSectionHeader">
            <span className="m-aboutSectionHeader__eyebrow">
              {t("hero.badges.experience")}
            </span>
            <h2 className="m-section-title">{t("aboutPage.history.title")}</h2>
          </div>

          <div className="m-aboutStoryGrid">
            <article className="m-aboutStoryCard m-aboutStoryCard--lead m-card">
              <span className="m-aboutStoryCard__label">
                {t("aboutPage.hero.title")}
              </span>
              <p>{t("aboutPage.history.paragraph1")}</p>
            </article>

            <article className="m-aboutStoryCard m-card">
              <span className="m-aboutStoryCard__label">
                {t("aboutPage.vision.title")}
              </span>
              <p>{t("aboutPage.history.paragraph2")}</p>
            </article>
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-section-header m-aboutSectionHeader">
            <span className="m-aboutSectionHeader__eyebrow">
              {t("hero.badges.experience")}
            </span>
            <h2 className="m-section-title">{t("aboutPage.milestones.title")}</h2>
          </div>

          <div className="m-aboutTimeline">
            {milestones.map((milestone, index) => (
              <article key={milestone.year} className="m-aboutTimeline__item m-card">
                <div className="m-aboutTimeline__rail" aria-hidden="true">
                  <span className="m-aboutTimeline__dot" />
                  {index < milestones.length - 1 && (
                    <span className="m-aboutTimeline__line" />
                  )}
                </div>
                <div className="m-aboutTimeline__content">
                  <div className="m-aboutTimeline__year">{milestone.year}</div>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-aboutVision m-card">
            <div className="m-aboutVision__media">
              <img src="/KARAHOCA-1-newPhoto.webp" alt={t("aboutPage.vision.imageAlt")} />
            </div>
            <div className="m-aboutVision__body">
              <span className="m-aboutSectionHeader__eyebrow">
                {t("hero.badges.countries")}
              </span>
              <h2 className="m-aboutVision__title">{t("aboutPage.vision.title")}</h2>
              <p className="m-aboutVision__text">{t("aboutPage.vision.description")}</p>

              <div className="m-aboutVision__stats">
                {stats.map((stat) => (
                  <article key={stat.label} className="m-aboutVision__stat">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-section-header m-aboutSectionHeader">
            <span className="m-aboutSectionHeader__eyebrow">
              {t("hero.badges.quality")}
            </span>
            <h2 className="m-section-title">{t("aboutPage.values.title")}</h2>
          </div>

          <div className="m-aboutValuesGrid">
            {values.map((value, index) => (
              <article key={value.title} className="m-aboutValueCard m-card">
                <div className="m-aboutValueCard__top">
                  <span className="m-aboutValueCard__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="m-aboutValueCard__bar"
                    style={{ background: value.accent }}
                  />
                </div>
                <h3 className="m-aboutValueCard__title">{value.title}</h3>
                <p className="m-aboutValueCard__desc">{value.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="m-pageSection m-container">
          <div className="m-aboutJourney m-card">
            <div className="m-aboutJourney__copy">
              <span className="m-aboutSectionHeader__eyebrow">
                {t("nav.contact")}
              </span>
              <h2 className="m-aboutJourney__title">{t("aboutPage.hero.title")}</h2>
              <p className="m-aboutJourney__desc">{t("footer.description")}</p>
            </div>
            <div className="m-aboutJourney__actions">
              <a href="mailto:info@karahoca.com" className="m-ghost">
                info@karahoca.com
              </a>
              <a href="https://wa.me/905305914990" className="m-cta">
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

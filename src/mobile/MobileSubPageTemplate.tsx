import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";

export interface MobileInfoCard {
  title: string;
  description: string;
  accent: string;
}

export interface MobileSplitContent {
  title: string;
  content: string | string[];
  image: string;
  imageAlt: string;
}

export interface MobileInfoSection {
  id: string;
  title: string;
  subtitle?: string;
  cards?: MobileInfoCard[];
  splitContent?: MobileSplitContent;
}

interface MobileSubPageTemplateProps {
  seoTitle: string;
  seoDescription: string;
  seoKeywords?: string;
  canonicalUrl: string;
  ogImage?: string;
  eyebrow?: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  heroImageAlt: string;
  heroBadges?: string[];
  sections: MobileInfoSection[];
}

export default function MobileSubPageTemplate({
  seoTitle,
  seoDescription,
  seoKeywords,
  canonicalUrl,
  ogImage,
  eyebrow,
  heroTitle,
  heroDescription,
  heroImage,
  heroImageAlt,
  heroBadges = [],
  sections,
}: MobileSubPageTemplateProps) {
  const { t } = useTranslation();
  const firstSection = sections[0];

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
      />

      <main className="m-page">
        <section className="m-pageHero m-container">
          <div className="m-pageHero__content">
            {eyebrow && <span className="m-pageHero__eyebrow">{eyebrow}</span>}
            <h1 className="m-pageHero__title">{heroTitle}</h1>
            <p className="m-pageHero__desc">{heroDescription}</p>

            {heroBadges.length > 0 && (
              <div className="m-pageHero__badges">
                {heroBadges.map((badge) => (
                  <span key={badge} className="m-pageHero__badge">
                    {badge}
                  </span>
                ))}
              </div>
            )}

            <div className="m-pageHero__actions">
              {firstSection && (
                <a href={`#${firstSection.id}`} className="m-cta">
                  {firstSection.title}
                </a>
              )}
              <a href="#contact" className="m-ghost">
                {t("nav.contact")}
              </a>
            </div>
          </div>

          <div className="m-pageHero__visual m-card">
            <img src={heroImage} alt={heroImageAlt} />
          </div>
        </section>

        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="m-pageSection m-container"
          >
            <div className="m-section-header">
              <h2 className="m-section-title">{section.title}</h2>
              {section.subtitle && (
                <p className="m-section-subtitle">{section.subtitle}</p>
              )}
            </div>

            {section.cards && (
              <div className="m-pageCards">
                {section.cards.map((card) => (
                  <article key={card.title} className="m-infoCard m-card">
                    <span
                      className="m-infoCard__accent"
                      style={{ background: card.accent }}
                    />
                    <div className="m-infoCard__body">
                      <h3 className="m-infoCard__title">{card.title}</h3>
                      <p className="m-infoCard__desc">{card.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {section.splitContent && (
              <div className="m-featureCard m-card">
                <div className="m-featureCard__media">
                  <img
                    src={section.splitContent.image}
                    alt={section.splitContent.imageAlt}
                  />
                </div>
                <div className="m-featureCard__content">
                  <h3 className="m-featureCard__title">
                    {section.splitContent.title}
                  </h3>

                  {Array.isArray(section.splitContent.content) ? (
                    <ul className="m-featureCard__list">
                      {section.splitContent.content.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-featureCard__text">
                      {section.splitContent.content}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        ))}

        <section className="m-pageSection m-container">
          <div className="m-journeyCard m-card">
            <div className="m-journeyCard__copy">
              <h2 className="m-journeyCard__title">{t("footer.links.title")}</h2>
              <p className="m-journeyCard__desc">{t("footer.description")}</p>
            </div>
            <div className="m-journeyCard__actions">
              <Link to="/" className="m-ghost">
                {t("nav.home")}
              </Link>
              <a href="#contact" className="m-cta">
                {t("nav.contact")}
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

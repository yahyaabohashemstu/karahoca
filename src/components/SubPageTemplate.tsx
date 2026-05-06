import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';
import Header from './Header';
import Footer from './Footer';
import PageHero from './PageHero';

interface SubPageCard {
  title: string;
  description: string;
  accent: string;
}

interface SubPageSplitContent {
  title: string;
  content: string | string[];
  image: string;
  imageAlt: string;
}

interface SubPageSection {
  id: string;
  title: string;
  subtitle?: string;
  isAlt?: boolean;
  cards?: SubPageCard[];
  splitContent?: SubPageSplitContent;
}

interface SubPageTemplateProps {
  pageClass: string;
  heroEyebrow?: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroDescription: string;
  heroImage: string;
  heroImageAlt: string;
  sectionsData: SubPageSection[];
}

const SubPageTemplate: React.FC<SubPageTemplateProps> = ({
  pageClass,
  heroEyebrow,
  heroTitle,
  heroDescription,
  heroImage,
  heroImageAlt,
  sectionsData,
}) => {
  const { t } = useTranslation();

  return (
    <div className={pageClass}>
      <Header />

      <main id="main">
        <PageHero
          sectionId="subpage-hero"
          eyebrow={
            heroEyebrow ? (
              <>
                <Sparkle weight="fill" size={12} aria-hidden="true" />
                <span>{heroEyebrow}</span>
              </>
            ) : undefined
          }
          title={heroTitle}
          description={heroDescription}
          primaryAction={
            <a href="#contact" className="btn-premium btn-premium--primary">
              <span className="btn-premium__label">{t('nav.contact')}</span>
              <span className="btn-premium__icon" aria-hidden="true">
                <ArrowRight size={16} weight="bold" />
              </span>
            </a>
          }
          image={heroImage}
          imageAlt={heroImageAlt}
          imageLCP
        />

        {sectionsData.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className={`section ${section.isAlt ? 'section--alt' : ''}`}
          >
            <div className="container section__head fx-reveal">
              <h2 className="section-title">{section.title}</h2>
              {section.subtitle && (
                <p className="section-subtitle">{section.subtitle}</p>
              )}
            </div>

            {section.cards && (
              <div className="container">
                <div className="cards subpage-cards">
                  {section.cards.map((card, cardIndex) => (
                    <div
                      key={cardIndex}
                      className="card glass-card fx-up subpage-cards__item"
                      style={{ '--card-accent': card.accent } as React.CSSProperties}
                    >
                      <div className="card__media subpage-cards__media">
                        <div className="card-glow"></div>
                      </div>
                      <div className="card__body">
                        <h3>{card.title}</h3>
                        <p>{card.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section.splitContent && (
              <div className="container split">
                <div className="fx-reveal">
                  <h2 className="section-title">
                    {section.splitContent.title}
                  </h2>
                  {Array.isArray(section.splitContent.content) ? (
                    <ul>
                      {section.splitContent.content.map((item, itemIndex) => (
                        <li key={itemIndex}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{section.splitContent.content}</p>
                  )}
                </div>
                <div className="fx-up">
                  <div className="about-media glass-media">
                    <img
                      src={section.splitContent.image}
                      alt={section.splitContent.imageAlt}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        ))}
      </main>

      <Footer />
    </div>
  );
};

export default SubPageTemplate;

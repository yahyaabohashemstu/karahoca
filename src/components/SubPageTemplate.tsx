import React from 'react';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import Footer from './Footer';

interface SubPageTemplateProps {
  pageClass: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroDescription: string;
  heroImage: string;
  heroImageAlt: string;
  sectionsData: Array<{
    id: string;
    title: string;
    subtitle?: string;
    isAlt?: boolean;
    cards?: Array<{
      title: string;
      description: string;
      accent: string;
    }>;
    splitContent?: {
      title: string;
      content: string | string[];
      image: string;
      imageAlt: string;
    };
  }>;
}

const SubPageTemplate: React.FC<SubPageTemplateProps> = ({
  pageClass,
  heroTitle,
  heroSubtitle,
  heroDescription,
  heroImage,
  heroImageAlt,
  sectionsData
}) => {
  const { t } = useTranslation();

  return (
    <div className={pageClass}>
      <div className="bg-elements">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>
      
      <Header />
      
      <main>
        <section className="hero" style={{ padding: '40px 0 40px' }}>
          <div className="container hero__grid">
            <div className="hero__copy">
              <h1 className="fx-reveal hero-title">
                <span className="gradient-text">{heroTitle}</span>
                {heroSubtitle && <br />}
                {heroSubtitle}
              </h1>
              <p className="lead fx-reveal">
                {heroDescription}
              </p>
              <div className="hero__cta fx-reveal">
                <a href="#contact" className="btn btn--primary">{t('nav.contact')}</a>
              </div>
            </div>
            <div className="hero__visual">
              <div className="orb orb--1"></div>
              <div className="orb orb--2"></div>
              <div className="card-3d">
                <div className="card-3d__inner">
                  <img src={heroImage} alt={heroImageAlt} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {sectionsData.map((section) => (
          <section 
            key={section.id} 
            id={section.id} 
            className={`section ${section.isAlt ? 'section--alt' : ''}`}
          >
            <div className="container section__head fx-reveal">
              <h2 className="section-title">{section.title}</h2>
              {section.subtitle && <p className="section-subtitle">{section.subtitle}</p>}
            </div>
            
            {section.cards && (
              <div className="container">
                {section.cards.length > 6 ? (
                  // إذا كان عدد البطاقات أكثر من 6، قسمها إلى شبكات متعددة
                  <>
                    <div className="cards">
                      {section.cards.slice(0, 6).map((card, cardIndex) => (
                        <div key={cardIndex} className="card glass-card fx-up">
                          <div 
                            className="card__media" 
                            style={{ '--card-accent': card.accent } as React.CSSProperties}
                          >
                            <div className="card-glow"></div>
                          </div>
                          <div className="card__body">
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {section.cards.length > 6 && (
                      <div className="cards" style={{ marginTop: '2rem' }}>
                        {section.cards.slice(6).map((card, cardIndex) => (
                          <div key={cardIndex + 6} className="card glass-card fx-up">
                            <div 
                              className="card__media" 
                              style={{ '--card-accent': card.accent } as React.CSSProperties}
                            >
                              <div className="card-glow"></div>
                            </div>
                            <div className="card__body">
                              <h3>{card.title}</h3>
                              <p>{card.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // إذا كان عدد البطاقات 6 أو أقل، استخدم شبكة واحدة
                  <div className="cards">
                    {section.cards.map((card, cardIndex) => (
                      <div key={cardIndex} className="card glass-card fx-up">
                        <div 
                          className="card__media" 
                          style={{ '--card-accent': card.accent } as React.CSSProperties}
                        >
                          <div className="card-glow"></div>
                        </div>
                        <div className="card__body">
                          <h3>{card.title}</h3>
                          <p>{card.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section.splitContent && (
              <div className="container split">
                <div className="fx-reveal">
                  <h2 className="section-title">{section.splitContent.title}</h2>
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
                    <div className="animated-blob blob"></div>
                    <div className="animated-blob blob--alt"></div>
                    <img src={section.splitContent.image} alt={section.splitContent.imageAlt} />
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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';
import SEO from '../components/SEO';
import { AboutPageSchema, BreadcrumbSchema } from '../components/SchemaOrg';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageHero from '../components/PageHero';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('aboutPage.seo.title')}
        description={t('aboutPage.seo.description')}
        keywords={t('aboutPage.seo.keywords')}
      />
      <AboutPageSchema />
      <BreadcrumbSchema
        items={[
          { name: 'KARAHOCA', url: '/' },
          { name: t('aboutPage.seo.title'), url: '/about' },
        ]}
      />

      <div className="about-page">
        <Header />

        <main id="main">
          <PageHero
            sectionId="about-hero"
            eyebrow={
              <>
                <Sparkle weight="fill" size={12} aria-hidden="true" />
                <span>
                  {t('about.eyebrow', { defaultValue: 'About KARAHOCA' })}
                </span>
              </>
            }
            title={t('aboutPage.hero.title')}
            description={t('aboutPage.hero.description')}
            primaryAction={
              <a href="#contact" className="btn-premium btn-premium--primary">
                <span className="btn-premium__label">{t('nav.contact')}</span>
                <span className="btn-premium__icon" aria-hidden="true">
                  <ArrowRight size={16} weight="bold" />
                </span>
              </a>
            }
            image="/KARAHOCA-2-wb.webp"
            imageAlt={t('aboutPage.hero.imageAlt')}
            imageLCP
          />

          {/* Company History */}
          <section className="section glass-section about-history">
            <div className="section-divider" aria-hidden="true" />
            <div className="container">
              <div className="content-wrapper fx-reveal about-history__inner">
                <h2 className="section-title gradient-text">
                  {t('aboutPage.history.title')}
                </h2>
                <div className="glass-card about-history__card">
                  <p className="about-history__paragraph">
                    {t('aboutPage.history.paragraph1')}
                  </p>
                  <div
                    className="section-divider about-history__divider"
                    aria-hidden="true"
                  />
                  <p className="about-history__paragraph">
                    {t('aboutPage.history.paragraph2')}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Milestones */}
          <section className="section glass-section section--alt">
            <div className="section-divider" aria-hidden="true" />
            <div className="container">
              <h2 className="section-title gradient-text fx-reveal">
                {t('aboutPage.milestones.title')}
              </h2>
              <div className="timeline fx-up about-milestones">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="timeline-item glass-card">
                    <div className="timeline-year">
                      {t(`aboutPage.milestones.year${n}.year`)}
                    </div>
                    <div className="timeline-content">
                      <h3>{t(`aboutPage.milestones.year${n}.title`)}</h3>
                      <p>{t(`aboutPage.milestones.year${n}.description`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Vision */}
          <section className="section glass-section about-vision">
            <div className="section-divider" aria-hidden="true" />
            <div className="container split">
              <div className="fx-reveal about-vision__copy">
                <h2 className="section-title gradient-text">
                  {t('aboutPage.vision.title')}
                </h2>
                <div className="glass-card about-vision__card">
                  <p className="about-vision__lead">
                    {t('aboutPage.vision.description')}
                  </p>
                  <div
                    className="section-divider about-vision__divider"
                    aria-hidden="true"
                  />
                  <div className="about-vision__stats">
                    {[
                      { num: '15+', label: t('aboutPage.vision.countries') },
                      { num: '30+', label: t('aboutPage.vision.experience') },
                      { num: '2', label: t('aboutPage.vision.brands') },
                      { num: '4', label: t('aboutPage.vision.industries') },
                    ].map((stat) => (
                      <div key={stat.label} className="about-vision__stat glass-card">
                        <div className="about-vision__stat-num gradient-text">
                          {stat.num}
                        </div>
                        <div className="about-vision__stat-label">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fx-up about-vision__media-wrap">
                <div className="glass-media about-vision__media">
                  <img
                    src="/KARAHOCA-1-newPhoto.webp"
                    alt={t('aboutPage.vision.imageAlt')}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Values */}
          <section className="section glass-section section--alt about-values">
            <div className="section-divider" aria-hidden="true" />
            <div className="container">
              <h2 className="section-title gradient-text fx-reveal">
                {t('aboutPage.values.title')}
              </h2>
              <div className="cards-grid fx-up about-values__grid">
                {(['quality', 'innovation', 'sustainability'] as const).map(
                  (key) => (
                    <div key={key} className="card glass-card about-values__item">
                      <div className="card__body">
                        <h3 className="gradient-text about-values__title">
                          {t(`aboutPage.values.${key}.title`)}
                        </h3>
                        <p className="about-values__body">
                          {t(`aboutPage.values.${key}.description`)}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default AboutPage;

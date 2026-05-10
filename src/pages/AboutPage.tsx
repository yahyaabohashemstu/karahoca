import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { AboutPageSchema, BreadcrumbSchema } from '../components/SchemaOrg';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  BRAND_ARABIC_PRIMARY,
  BRAND_ARABIC_VARIANTS,
  BRAND_LATIN_OFFICIAL,
} from '../constants/brandNames';

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
      <BreadcrumbSchema items={[
        { name: 'KARAHOCA', url: '/' },
        { name: t('aboutPage.seo.title'), url: '/about' },
      ]} />
      
      <div className="about-page">
        <div className="bg-elements">
          <div className="floating-orb orb-1"></div>
          <div className="floating-orb orb-2"></div>
          <div className="floating-orb orb-3"></div>
        </div>
        
        <Header />
        
        <main>
          {/* Hero Section - نفس تصميم باقي الصفحات */}
          <section className="hero" style={{ padding: '40px 0 40px' }}>
            <div className="container hero__grid">
              <div className="hero__copy">
                <h1 className="fx-reveal hero-title">
                  <span className="gradient-text">{t('aboutPage.hero.title')}</span>
                </h1>
                <p className="lead fx-reveal">
                  {t('aboutPage.hero.description')}
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
                    <img
                      src="/KARAHOCA-2-wb.webp"
                      alt={t('aboutPage.hero.imageAlt')}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

        {/* ── Naming / disambiguation Section ─────────────────────────────
            Renders the company's name in Latin + Arabic + every common
            transliteration as a visible block. This is the single most
            important on-page SEO surface for the "قره خوجة" search
            cluster: search engines weight HEADINGS and BODY TEXT far
            more than meta tags or alt attributes. By making the
            variants part of the actual page content (not hidden, not
            stuffed — presented as legitimate disambiguation copy a
            visitor can read) we tell Google "this URL is the canonical
            answer for any of these spellings."

            Also serves a real product purpose: visitors who searched
            for the Aleppo company by mistake immediately see the
            "we are the Türkiye-based KARAHOCA" disambiguation. */}
        <section className="section glass-section">
          <div className="section-divider"></div>
          <div className="container">
            <div className="content-wrapper fx-reveal">
              <h2 className="section-title gradient-text">
                {t('aboutPage.naming.title')}
              </h2>
              <div className="glass-card" style={{ padding: '32px 64px', marginTop: '24px' }}>
                <p style={{ fontSize: '1.2em', lineHeight: '1.8', marginBottom: '16px' }}>
                  {t('aboutPage.naming.lead')}
                </p>
                {/* The full variants chip-list. Marked with itemprop
                    `alternateName` so search engines that parse
                    microdata (Bing in particular) pick up each chip
                    as an additional name node tied to the page's
                    Organization schema via the @id reference above. */}
                <div
                  itemScope
                  itemType="https://schema.org/Organization"
                  itemID="https://karahoca.com/#organization"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.8rem',
                    margin: '1.25rem 0',
                  }}
                >
                  <strong
                    itemProp="name"
                    style={{ fontSize: '1.6em', letterSpacing: '0.02em' }}
                  >
                    {BRAND_ARABIC_PRIMARY} ({BRAND_LATIN_OFFICIAL})
                  </strong>
                  <span style={{ fontSize: '1em', opacity: 0.75 }}>
                    {t('aboutPage.naming.variantsLabel')}
                  </span>
                  <ul
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px 12px',
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      justifyContent: 'center',
                    }}
                  >
                    {BRAND_ARABIC_VARIANTS.map((variant) => (
                      <li
                        key={variant}
                        itemProp="alternateName"
                        style={{
                          padding: '6px 14px',
                          borderRadius: 999,
                          background: 'var(--surface-glass-medium)',
                          border: '1px solid var(--surface-card-border)',
                          fontSize: '0.95em',
                          fontWeight: 600,
                        }}
                      >
                        {variant}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="section-divider" style={{ margin: '20px auto', width: '60%' }}></div>
                <p style={{ fontSize: '1.1em', lineHeight: '1.8', marginBottom: '12px' }}>
                  {t('aboutPage.naming.explainTurkish')}
                </p>
                <p style={{ fontSize: '1.1em', lineHeight: '1.8' }}>
                  {t('aboutPage.naming.explainDistinction')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Company History Section */}
        <section className="section glass-section section--alt">
          <div className="section-divider"></div>
          <div className="container">
            <div className="content-wrapper fx-reveal">
              <h2 className="section-title gradient-text">
                {t('aboutPage.history.title')}
              </h2>
              <div className="glass-card" style={{ padding: '32px 64px', marginTop: '24px' }}>
                <p style={{ fontSize: '1.2em', lineHeight: '1.8', marginBottom: '20px' }}>
                  {t('aboutPage.history.paragraph1')}
                </p>
                <div className="section-divider" style={{ margin: '24px auto', width: '60%' }}></div>
                <p style={{ fontSize: '1.2em', lineHeight: '1.8' }}>
                  {t('aboutPage.history.paragraph2')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Milestones Section */}
        <section className="section glass-section section--alt">
          <div className="section-divider"></div>
          <div className="container">
            <h2 className="section-title gradient-text fx-reveal">
              {t('aboutPage.milestones.title')}
            </h2>
            <div className="timeline fx-up" style={{ marginTop: '48px' }}>
              <div className="timeline-item glass-card">
                <div className="timeline-year">
                  {t('aboutPage.milestones.year1.year')}
                </div>
                <div className="timeline-content">
                  <h3>{t('aboutPage.milestones.year1.title')}</h3>
                  <p>{t('aboutPage.milestones.year1.description')}</p>
                </div>
              </div>

              <div className="timeline-item glass-card">
                <div className="timeline-year">
                  {t('aboutPage.milestones.year2.year')}
                </div>
                <div className="timeline-content">
                  <h3>{t('aboutPage.milestones.year2.title')}</h3>
                  <p>{t('aboutPage.milestones.year2.description')}</p>
                </div>
              </div>

              <div className="timeline-item glass-card">
                <div className="timeline-year">
                  {t('aboutPage.milestones.year3.year')}
                </div>
                <div className="timeline-content">
                  <h3>{t('aboutPage.milestones.year3.title')}</h3>
                  <p>{t('aboutPage.milestones.year3.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="section glass-section">
          <div className="section-divider"></div>
          <div className="container split">
            <div className="fx-reveal" style={{ flex: 1 }}>
              <h2 className="section-title gradient-text">
                {t('aboutPage.vision.title')}
              </h2>
              <div className="glass-card" style={{ padding: '32px', marginTop: '24px' }}>
                <p style={{ fontSize: '1.2em', lineHeight: '1.8', marginBottom: '20px' }}>
                  {t('aboutPage.vision.description')}
                </p>
                <div className="section-divider" style={{ margin: '24px auto', width: '60%' }}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginTop: '24px' }}>
                  <div className="stat-card glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="gradient-text" style={{ fontSize: '2.5em', fontWeight: 'bold' }}>15+</div>
                    <div style={{ fontSize: '1.1em', marginTop: '8px' }}>{t('aboutPage.vision.countries')}</div>
                  </div>
                  <div className="stat-card glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="gradient-text" style={{ fontSize: '2.5em', fontWeight: 'bold' }}>30+</div>
                    <div style={{ fontSize: '1.1em', marginTop: '8px' }}>{t('aboutPage.vision.experience')}</div>
                  </div>
                  <div className="stat-card glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="gradient-text" style={{ fontSize: '2.5em', fontWeight: 'bold' }}>2</div>
                    <div style={{ fontSize: '1.1em', marginTop: '8px' }}>{t('aboutPage.vision.brands')}</div>
                  </div>
                  <div className="stat-card glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="gradient-text" style={{ fontSize: '2.5em', fontWeight: 'bold' }}>4</div>
                    <div style={{ fontSize: '1.1em', marginTop: '8px' }}>{t('aboutPage.vision.industries')}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="fx-up">
              <div className="glass-media">
                <div className="blob animated-blob"></div>
                <img
                  src="/KARAHOCA-1-newPhoto.webp"
                  alt={t('aboutPage.vision.imageAlt')}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="section glass-section section--alt">
          <div className="section-divider"></div>
          <div className="container">
            <h2 className="section-title gradient-text fx-reveal">
              {t('aboutPage.values.title')}
            </h2>
            <div className="cards-grid fx-up" style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="card glass-card">
                <div className="card__body">
                  <h3 className="gradient-text" style={{ fontSize: '1.8em', marginBottom: '16px' }}>
                    {t('aboutPage.values.quality.title')}
                  </h3>
                  <p style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
                    {t('aboutPage.values.quality.description')}
                  </p>
                </div>
              </div>

              <div className="card glass-card">
                <div className="card__body">
                  <h3 className="gradient-text" style={{ fontSize: '1.8em', marginBottom: '16px' }}>
                    {t('aboutPage.values.innovation.title')}
                  </h3>
                  <p style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
                    {t('aboutPage.values.innovation.description')}
                  </p>
                </div>
              </div>

              <div className="card glass-card">
                <div className="card__body">
                  <h3 className="gradient-text" style={{ fontSize: '1.8em', marginBottom: '16px' }}>
                    {t('aboutPage.values.sustainability.title')}
                  </h3>
                  <p style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
                    {t('aboutPage.values.sustainability.description')}
                  </p>
                </div>
              </div>
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

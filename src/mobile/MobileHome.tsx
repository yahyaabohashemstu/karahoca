import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import NumbersSection from "../components/NumbersSection";

export default function MobileHome() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('home.seo.title')}
        description={t('home.seo.description')}
        keywords={t('home.seo.keywords')}
        ogImage="/KARAHOCA-1-newPhoto.webp"
        canonicalUrl="https://karahoca.com/"
      />

      <main>
        {/* HERO */}
        <section className="m-hero m-container">
          <div className="m-hero__badges">
            <span className="m-hero__badge">{t('hero.badges.quality')}</span>
            <span className="m-hero__badge">{t('hero.badges.experience')}</span>
            <span className="m-hero__badge">{t('hero.badges.countries')}</span>
          </div>
          <h1 className="m-hero__title">{t('hero.title')}</h1>
          <p className="m-hero__desc">{t('hero.subtitle')}</p>
          <div className="m-hero__ctaRow">
            <a href="#brands" className="m-cta">{t('hero.cta.products')}</a>
            <a href="#contact" className="m-ghost">{t('hero.cta.about')}</a>
          </div>
          <div className="m-hero__visual">
            <img
              src="/KARAHOCA-1-newPhoto.webp"
              alt="KARAHOCA"
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '16px',
                marginTop: '20px',
                boxShadow: '0 8px 32px rgba(0,0,0,.25)'
              }}
            />
          </div>
        </section>

        {/* BRANDS */}
        <section id="brands" className="m-container" style={{ display: 'grid', gap: 16, marginTop: 32 }}>
          <div className="m-section-header">
            <h2 className="m-section-title">{t('brands.title')}</h2>
            <p className="m-section-subtitle">{t('brands.subtitle')}</p>
          </div>
          <div className="m-grid">
            <Link className="m-brandCard m-brandCard--full" to="/diox">
              <img className="m-brandCard__logo" src="/Diox-logo.png.webp" alt="DIOX" />
              <div className="m-brandCard__content">
                <div className="m-brandCard__name">DIOX</div>
                <div className="m-brandCard__desc">{t('brands.diox.description')}</div>
                <span className="m-brandCard__link">{t('brands.diox.link')} →</span>
              </div>
            </Link>
            <Link className="m-brandCard m-brandCard--full" to="/aylux">
              <img className="m-brandCard__logo" src="/Aylux-logo.png.webp" alt="AYLUX" />
              <div className="m-brandCard__content">
                <div className="m-brandCard__name">AYLUX</div>
                <div className="m-brandCard__desc">{t('brands.aylux.description')}</div>
                <span className="m-brandCard__link">{t('brands.aylux.link')} →</span>
              </div>
            </Link>
          </div>
        </section>

        {/* WORK SECTION */}
        <section id="work" className="m-container" style={{ display: 'grid', gap: 16, marginTop: 32 }}>
          <div className="m-section-header">
            <h2 className="m-section-title">{t('work.title')}</h2>
          </div>
          <div className="m-grid">
            <Link className="m-workCard" to="/production">
              <div className="m-workCard__media">
                <img
                  src="/KARAHOCA-4-web.webp"
                  alt={t('work.production.alt')}
                />
              </div>
              <div className="m-workCard__body">
                <h3 className="m-workCard__title">{t('work.production.title')}</h3>
                <p className="m-workCard__subtitle">{t('work.production.subtitle')}</p>
                <span className="m-workCard__link">{t('work.production.link')} →</span>
              </div>
            </Link>

            <Link className="m-workCard" to="/dryer">
              <div className="m-workCard__media">
                <img
                  src="/KARAHOCA-3-wb.webp"
                  alt={t('work.dryer.alt')}
                />
              </div>
              <div className="m-workCard__body">
                <h3 className="m-workCard__title">{t('work.dryer.title')}</h3>
                <p className="m-workCard__subtitle">{t('work.dryer.subtitle')}</p>
                <span className="m-workCard__link">{t('work.dryer.link')} →</span>
              </div>
            </Link>

            <Link className="m-workCard" to="/goal">
              <div className="m-workCard__media">
                <img
                  src="/KARAHOCA-2-wb.webp"
                  alt={t('work.goal.alt')}
                />
              </div>
              <div className="m-workCard__body">
                <h3 className="m-workCard__title">{t('work.goal.title')}</h3>
                <p className="m-workCard__subtitle">{t('work.goal.subtitle')}</p>
                <span className="m-workCard__link">{t('work.goal.link')} →</span>
              </div>
            </Link>
          </div>
        </section>

        {/* NUMBERS - استخدام NumbersSection من التصميم الأساسي */}
        <NumbersSection />

        {/* ABOUT */}
        <section id="about" className="m-container" style={{ display: 'grid', gap: 16, marginTop: 32, marginBottom: 32 }}>
          <div className="m-section-header">
            <h2 className="m-section-title">{t('about.title')}</h2>
          </div>
          <div className="m-about">
            <div className="m-about__media">
              <img
                src="/KARAHOCA-2-wb.webp"
                alt={t('about.imageAlt')}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,.25)'
                }}
              />
            </div>
            <div className="m-card" style={{ padding: 20 }}>
              <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>
                {t('about.shortDescription')}
              </p>
              <Link
                to="/about"
                className="m-cta"
                style={{
                  display: 'inline-block',
                  textAlign: 'center',
                  textDecoration: 'none'
                }}
              >
                {t('about.learnMoreButton')}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

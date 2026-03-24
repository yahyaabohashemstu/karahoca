import React from "react";
import { useTranslation } from "react-i18next";

export default function MobileHome() {
  const { t } = useTranslation();

  return (
    <main>
      {/* HERO */}
      <section className="m-hero m-container">
        <span className="m-hero__badge">KARAHOCA • Premium Clean</span>
        <h1 className="m-hero__title">{t('hero.title')}</h1>
        <p className="m-hero__desc">{t('hero.description')}</p>
        <div className="m-hero__ctaRow">
          <a href="#contact" className="m-cta">{t('hero.ctaPrimary')}</a>
          <a href="#brands" className="m-ghost">{t('hero.ctaSecondary')}</a>
        </div>
      </section>

      {/* BRANDS */}
      <section id="brands" className="m-container" style={{display:'grid', gap:12, marginTop:6}}>
        <h2 style={{fontSize:18, fontWeight:800, letterSpacing:'.2px'}}>{t('brands.title')}</h2>
        <div className="m-grid">
          {/* Example brand cards — replace images/labels based on your data */}
          <a className="m-brandCard" href="#diox">
            <img className="m-brandCard__logo" src="/brands/diox.png" alt="DIOX" />
            <div>
              <div className="m-brandCard__name">DIOX</div>
              <div className="m-brandCard__sub">{t('brands.kitchenCare')}</div>
            </div>
          </a>
          <a className="m-brandCard" href="#aylox">
            <img className="m-brandCard__logo" src="/brands/aylox.png" alt="AYLOX" />
            <div>
              <div className="m-brandCard__name">AYLOX</div>
              <div className="m-brandCard__sub">{t('brands.floorCare')}</div>
            </div>
          </a>
        </div>
      </section>

      {/* NUMBERS */}
      <section id="numbers" className="m-container" style={{display:'grid', gap:12, marginTop:20}}>
        <h2 style={{fontSize:18, fontWeight:800}}>{t('numbers.title')}</h2>
        <div className="m-stats">
          <div className="m-stat">
            <div className="m-stat__val">35+</div>
            <div className="m-stat__label">{t('numbers.products')}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat__val">12</div>
            <div className="m-stat__label">{t('numbers.countries')}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat__val">7</div>
            <div className="m-stat__label">{t('numbers.brands')}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat__val">100%</div>
            <div className="m-stat__label">{t('numbers.quality')}</div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="m-container" style={{display:'grid', gap:12, marginTop:20, marginBottom:24}}>
        <h2 style={{fontSize:18, fontWeight:800}}>{t('about.title')}</h2>
        <div className="m-card" style={{padding:14}}>
          <p style={{fontSize:14, lineHeight:1.6}}>{t('about.description')}</p>
        </div>
      </section>
    </main>
  );
}

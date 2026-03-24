import React from "react";
import { useTranslation } from "react-i18next";

export default function MobileFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="m-footer" role="contentinfo">
      <div className="m-container" style={{display:'grid', gap:14}}>
        <section className="m-newsletter">
          <strong>{t('footer.newsletter.title')}</strong>
          <p style={{opacity:.85, fontSize:12}}>{t('footer.newsletter.description')}</p>
          <form onSubmit={(e)=>e.preventDefault()}>
            <label htmlFor="m-email" className="sr-only">Email</label>
            <input id="m-email" type="email" className="m-input" placeholder="name@email.com" />
            <div style={{height:8}} />
            <button className="m-cta">{t('footer.newsletter.subscribe')}</button>
          </form>
        </section>

        <div style={{display:'flex', gap:10, justifyContent:'center'}}>
          <a href="https://www.facebook.com/KARAHOCAKIMYA/" aria-label="Facebook">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.44 18.63 0 12 0 5.37 0 0 5.44 0 12.07 0 18.1 4.39 23.1 10.13 24v-8.49H7.08v-3.44h3.05V9.41c0-3.02 1.79-4.69 4.52-4.69 1.31 0 2.67.24 2.67.24v2.94h-1.5c-1.48 0-1.94.93-1.94 1.88v2.27h3.31l-.53 3.44h-2.78V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
          </a>
          <a href="https://www.instagram.com/karahocakimya/?hl=ar" aria-label="Instagram">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm10 2a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h10zm-5 3.5A5.5 5.5 0 1111.99 20.5 5.5 5.5 0 0112 7.5zm6-2a1 1 0 110 2 1 1 0 010-2z"/></svg>
          </a>
        </div>

        <p className="m-footnote">© {year} KARAHOCA. {t('footer.allRights')}</p>
      </div>
    </footer>
  );
}

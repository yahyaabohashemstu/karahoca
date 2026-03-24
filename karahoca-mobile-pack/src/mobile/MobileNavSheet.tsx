import React from "react";
import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`m-sheet ${open ? 'm-sheet--open' : ''}`} aria-hidden={!open}>
      <div className="m-sheet__backdrop" onClick={onClose} />
      <aside className="m-sheet__panel" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10}}>
          <strong style={{letterSpacing:'.3px'}}>Menu</strong>
          <button onClick={onClose} aria-label="Close menu" style={{ background:'transparent', border:0, color:'#fff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.71L12 12.01 5.7 5.7 4.29 7.11l6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.3 6.3 1.41-1.41-6.3-6.3 6.3-6.3z"/></svg>
          </button>
        </div>
        <nav className="m-nav" onClick={onClose}>
          <a href="#brands">{t('nav.brands')}</a>
          <a href="#numbers">{t('numbers.title')}</a>
          <a href="#about">{t('nav.about')}</a>
          <a href="#contact" className="m-cta">{t('nav.contact')}</a>
        </nav>
      </aside>
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../utils/language";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavSheet({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const currentLanguageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isArabic = currentLanguageCode === "ar";
  const isHomePage = location.pathname === '/';
  const brandsHref = isHomePage ? '#brands' : '/#brands';
  const numbersHref = isHomePage ? '#numbers' : '/#numbers';

  return (
    <div
      className={`m-sheet ${open ? 'm-sheet--open' : ''} ${isArabic ? 'm-sheet--rtl' : 'm-sheet--ltr'}`}
      aria-hidden={!open}
    >
      <div className="m-sheet__backdrop" onClick={onClose} />
      <aside className="m-sheet__panel" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10}}>
          <strong style={{letterSpacing:'.3px'}}>{t('nav.menu')}</strong>
          <button onClick={onClose} aria-label={t('nav.closeMenu')} style={{ background:'transparent', border:0, color:'#fff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.71L12 12.01 5.7 5.7 4.29 7.11l6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.3 6.3 1.41-1.41-6.3-6.3 6.3-6.3z"/></svg>
          </button>
        </div>
        <nav className="m-nav">
          <Link to="/" onClick={onClose}>{t('nav.home')}</Link>
          <Link to="/about" onClick={onClose}>{t('nav.about')}</Link>
          {isHomePage ? (
            <a href={brandsHref} onClick={onClose}>{t('nav.brands')}</a>
          ) : (
            <Link to="/#brands" onClick={onClose}>{t('nav.brands')}</Link>
          )}
          <Link to="/diox" onClick={onClose}>DIOX</Link>
          <Link to="/aylux" onClick={onClose}>AYLUX</Link>
          <Link to="/production" onClick={onClose}>{t('work.production.title')}</Link>
          <Link to="/dryer" onClick={onClose}>{t('work.dryer.title')}</Link>
          <Link to="/goal" onClick={onClose}>{t('work.goal.title')}</Link>
          {isHomePage ? (
            <a href={numbersHref} onClick={onClose}>{t('numbers.title')}</a>
          ) : (
            <Link to="/#numbers" onClick={onClose}>{t('numbers.title')}</Link>
          )}
          <a href="#contact" className="m-cta" onClick={onClose}>{t('nav.contact')}</a>
        </nav>
      </aside>
    </div>
  );
}

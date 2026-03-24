import React from "react";
import { useTranslation } from "react-i18next";

type Props = {
  onMenu: () => void;
};

export default function MobileHeader({ onMenu }: Props) {
  const { t } = useTranslation();
  return (
    <header className="m-header" role="banner">
      <div className="m-header__bar">
        <button
          aria-label={t('nav.menu')}
          className="icon-btn"
          onClick={onMenu}
          style={{ background: "transparent", border: 0, color: "white" }}
        >
          {/* burger */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
          </svg>
        </button>
        <div className="m-brand">
          <img className="m-brand__logo" src="/logo.png" alt="KARAHOCA" />
          <span className="m-brand__name">KARAHOCA</span>
        </div>
        <div className="m-lang">
          {/* Placeholder for your LanguageSwitcher component */}
          <a href="#lang" aria-label="Language" style={{ color: "white", opacity: .9 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9..."/></svg>
          </a>
        </div>
      </div>
    </header>
  );
}

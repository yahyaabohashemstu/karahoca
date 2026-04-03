import React from 'react';
import { useTranslation } from 'react-i18next';

const CustomOrderSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="custom-order-section">
      <div className="container custom-order-inner">
        <div className="custom-order-left">
          <span className="custom-order-badge">{t('customOrder.badge')}</span>
          <h2 className="custom-order-title">{t('customOrder.title')}</h2>
          <p className="custom-order-desc">{t('customOrder.description')}</p>
        </div>
        <a
          href="mailto:info@karahoca.com"
          className="custom-order-cta"
        >
          {t('customOrder.cta')} →
        </a>
      </div>
    </section>
  );
};

export default CustomOrderSection;

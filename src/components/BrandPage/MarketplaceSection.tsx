import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketplaceStore } from '../../constants/marketplaces';
import { MarketplaceLink } from './MarketplaceLinks';

interface MarketplaceSectionProps {
  /** Already filtered for the visitor's language — empty renders nothing. */
  stores: readonly MarketplaceStore[];
  brandName: string;
}

/**
 * Closing "online stores" band after the product grid: a visitor who has
 * just browsed the whole range gets one large card per storefront instead
 * of having to scroll back up to the hero.
 *
 * `id="buy-online"` makes the band linkable (`/tr/aylux#buy-online`). It
 * never collides with the product deep-link hashes BrandPage resolves,
 * because those are product ids.
 */
const MarketplaceSectionComponent: React.FC<MarketplaceSectionProps> = ({ stores, brandName }) => {
  const { t } = useTranslation();
  // Fixed id (one band per page), not useId(): prerendered snapshots and
  // hydration generate different useId values.
  const titleId = 'buy-online-title';
  if (stores.length === 0) return null;

  return (
    <section id="buy-online" className="section glass-section mkt-section" aria-labelledby={titleId}>
      <div className="section-divider"></div>
      <div className="container section__head fx-reveal">
        <span className="bfb-eyebrow">{t('brandPage.marketplace.sectionEyebrow')}</span>
        <h2 id={titleId} className="section-title">
          {t('brandPage.marketplace.sectionTitle', { brand: brandName })}
        </h2>
        <p className="section-subtitle">{t('brandPage.marketplace.sectionSubtitle')}</p>
      </div>

      <div className="container fx-reveal">
        <div className="mkt mkt--section">
          <ul className="mkt__list">
            {stores.map((store) => (
              <li key={store.id} className="mkt__item">
                <MarketplaceLink
                  store={store}
                  brandName={brandName}
                  placement="section"
                  size="lg"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const MarketplaceSection = memo(MarketplaceSectionComponent);
MarketplaceSection.displayName = 'MarketplaceSection';

export default MarketplaceSection;

import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketplaceStore } from '../../constants/marketplaces';
import { toBrandId } from '../../constants/brandNames';
import { trackMarketplaceClick, type MarketplacePlacement } from '../../utils/analytics';
import '../../styles/marketplaces.css';

const BagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const ExternalArrowIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

interface MarketplaceLinkProps {
  store: MarketplaceStore;
  brandName: string;
  placement: MarketplacePlacement;
  /** `md` = compact badge (hero, product modal); `lg` = roomy card (closing band). */
  size?: 'md' | 'lg';
  /** Set when the link sits inside a product's details, for analytics. */
  product?: { id?: string; name: string };
}

/**
 * One storefront button — the whole badge is a single link.
 *
 * Visible text stays short ("Resmi mağaza / Trendyol"); the full phrase a
 * screen reader announces lives in `aria-label` and still starts with the
 * store name, so voice-control users can say what they see.
 */
export const MarketplaceLink: React.FC<MarketplaceLinkProps> = ({
  store,
  brandName,
  placement,
  size = 'md',
  product,
}) => {
  const { t } = useTranslation();
  const storeDescription = t('brandPage.marketplace.officialBrandStore', { brand: brandName });
  const track = () => trackMarketplaceClick(store.id, toBrandId(brandName), placement, product);

  return (
    <a
      href={store.url}
      target="_blank"
      // `noopener` only, deliberately NOT `noreferrer`: the marketplace
      // still sees the karahoca.com origin, so storefront traffic from the
      // site stays attributable in the seller's own analytics.
      rel="noopener"
      className={`mkt-btn mkt-btn--${size} mkt-btn--${store.id}`}
      aria-label={`${t(`brandPage.marketplace.buyOn.${store.id}`)} — ${storeDescription} (${t('brandPage.marketplace.opensInNewTab')})`}
      onClick={track}
      // Middle-click opens the store in a background tab without firing
      // `click`; count it too. (Right-click fires `auxclick` with button 2
      // in some browsers — ignored, it isn't a visit.)
      onAuxClick={(event) => { if (event.button === 1) track(); }}
    >
      <span className="mkt-btn__tile">
        <BagIcon />
      </span>

      <span className="mkt-btn__text">
        {size === 'md' && (
          <span className="mkt-btn__eyebrow">{t('brandPage.marketplace.officialStore')}</span>
        )}
        <span className="mkt-btn__name">{store.name}</span>
        {size === 'lg' && <span className="mkt-btn__desc">{storeDescription}</span>}
      </span>

      {size === 'lg' ? (
        <span className="mkt-btn__cta">
          <span className="mkt-btn__cta-label">{t('brandPage.marketplace.visitStore')}</span>
          <ExternalArrowIcon />
        </span>
      ) : (
        <span className="mkt-btn__arrow">
          <ExternalArrowIcon />
        </span>
      )}
    </a>
  );
};

const PLACEMENT_CLASS: Record<Exclude<MarketplacePlacement, 'section'>, string> = {
  hero: 'mkt--hero',
  product_modal: 'mkt--modal',
};

interface MarketplaceLinksProps {
  /** Already filtered for the visitor's language — empty renders nothing. */
  stores: readonly MarketplaceStore[];
  brandName: string;
  placement: Exclude<MarketplacePlacement, 'section'>;
  /** Short heading above the buttons, e.g. "Online satın alın". */
  label: string;
  product?: { id?: string; name: string };
  className?: string;
}

/**
 * Labelled row of storefront badges for the brand hero and the product
 * modal. Two side-by-side badges when the placement is wide enough, one
 * per row otherwise — decided by a container query in marketplaces.css,
 * so the same markup fits the hero column and the narrower modal column.
 */
const MarketplaceLinks: React.FC<MarketplaceLinksProps> = ({
  stores,
  brandName,
  placement,
  label,
  product,
  className,
}) => {
  const labelId = useId();
  if (stores.length === 0) return null;

  return (
    <div className={`mkt ${PLACEMENT_CLASS[placement]}${className ? ` ${className}` : ''}`}>
      <p className="mkt__label" id={labelId}>{label}</p>
      <ul className="mkt__list" aria-labelledby={labelId}>
        {stores.map((store) => (
          <li key={store.id} className="mkt__item">
            <MarketplaceLink
              store={store}
              brandName={brandName}
              placement={placement}
              product={product}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MarketplaceLinks;

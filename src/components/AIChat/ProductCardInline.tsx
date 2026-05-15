import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import ImageWithFallback from '../ImageWithFallback';
import { toWebp } from '../../utils/image';
import type { ChatProduct } from '../../hooks/useChatState';

interface ProductCardInlineProps {
  product: ChatProduct;
  /** Localised label for the "View" CTA. */
  viewLabel: string;
  /** Localised label for the "Ask via WhatsApp" CTA. */
  whatsappLabel: string;
}

/**
 * Inline product card rendered inside an assistant chat message when Karo
 * invokes the search_products tool. The card carries everything a buyer
 * needs to decide whether to click through:
 *   - Thumbnail (lazy-loaded; falls back to a coloured tile if missing)
 *   - Localised name + weight + brand badge
 *   - Two CTAs: open the product on its brand page, or ask via WhatsApp
 *
 * Why a separate component (vs. inline JSX in MessageList):
 *   1. Memoisation. Each card renders the same data every time the
 *      parent message updates (e.g. while streaming new tokens), so
 *      `React.memo` here cuts dozens of unnecessary subtree
 *      reconciliations per stream.
 *   2. CSS isolation. The chat composer's font-size + RTL conventions
 *      bleed into nested elements; encapsulating the card lets us
 *      override them precisely (`direction: ltr` on the price column,
 *      `text-align: start` for the name, etc.).
 *   3. The Phase-5 polish list includes "wishlist toggle" — easier to
 *      add inside a typed component than to thread props through a
 *      forest of inline tags.
 */
const ProductCardInlineComponent: React.FC<ProductCardInlineProps> = ({
  product,
  viewLabel,
  whatsappLabel,
}) => {
  // WhatsApp share URL: pre-fills a message with the product name + URL.
  // We deliberately use the bare hostname rather than the API origin so
  // the visitor lands on the actual brand page when they tap through
  // from WhatsApp (the API host serves no HTML).
  const whatsappMessage = `أهلاً! أودّ الاستفسار عن ${product.name} (${product.brand})\n\nhttps://karahoca.com${product.url}`;
  const whatsappUrl = `https://wa.me/905305914990?text=${encodeURIComponent(whatsappMessage)}`;

  const brandColor = product.brand === 'DIOX' ? '#153D7A' : '#F54B1A';

  return (
    <div className="ai-chat-product-card" role="article">
      <Link
        to={product.url}
        className="ai-chat-product-card__media"
        aria-label={`${product.name} — ${viewLabel}`}
      >
        {product.image ? (
          // Production builds prune the original .png after generating its
          // optimised .webp sibling (see `scripts/prune-dist.mjs`), so a
          // bare `<img src=".../foo.png">` returns 404 in production. We
          // mirror the brand page's strategy here: request the .webp form
          // first via `toWebp()`, fall back to the raw .png if the webp
          // is genuinely missing (e.g. dev environment that hasn't run
          // the optimise step yet).
          <ImageWithFallback
            src={toWebp(product.image)}
            fallbackSrc={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="ai-chat-product-card__img"
          />
        ) : (
          <div
            className="ai-chat-product-card__placeholder"
            style={{ background: brandColor }}
            aria-hidden="true"
          >
            {product.brand === 'DIOX' ? 'D' : 'A'}
          </div>
        )}
        <span
          className="ai-chat-product-card__brand-badge"
          style={{ background: brandColor }}
        >
          {product.brand}
        </span>
      </Link>

      <div className="ai-chat-product-card__body">
        <Link to={product.url} className="ai-chat-product-card__name">
          {product.name}
        </Link>

        {(product.weight || product.material) && (
          <div className="ai-chat-product-card__meta">
            {product.weight && (
              <span className="ai-chat-product-card__meta-item">
                {product.weight}
              </span>
            )}
            {product.material && (
              <span className="ai-chat-product-card__meta-item ai-chat-product-card__meta-item--muted">
                {product.material}
              </span>
            )}
          </div>
        )}

        <div className="ai-chat-product-card__actions">
          <Link
            to={product.url}
            className="ai-chat-product-card__cta ai-chat-product-card__cta--primary"
          >
            {viewLabel}
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-chat-product-card__cta ai-chat-product-card__cta--secondary"
          >
            {whatsappLabel}
          </a>
        </div>
      </div>
    </div>
  );
};

const ProductCardInline = memo(ProductCardInlineComponent);
ProductCardInline.displayName = 'ProductCardInline';

export default ProductCardInline;

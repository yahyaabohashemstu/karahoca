import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageWithFallback from '../ImageWithFallback';
import { useWishlist } from '../../hooks/useWishlist';
import { toWebp } from '../../utils/image';
import type { CategoryData, ProductInfo } from './types';

interface ProductGridProps {
  brandName: string;
  productsTitle: string;
  productsSubtitle: string;
  categories: CategoryData[];
  onProductOpen: (product: ProductInfo) => void;
}

/**
 * The full products section: section header, then one card grid per category.
 *
 * Each card has a front face (image + name + brief) and a back face (details
 * + "view image" and wishlist buttons). Clicking "view image" calls the
 * parent's `onProductOpen` — the modal itself lives in `ProductModal.tsx`.
 *
 * Extracted from the former `BrandPageTemplate.tsx` monolith.
 */
const ProductGridComponent: React.FC<ProductGridProps> = ({
  brandName,
  productsTitle,
  productsSubtitle,
  categories,
  onProductOpen,
}) => {
  const { t } = useTranslation();
  const { isInWishlist, toggle } = useWishlist();
  const sectionRef = useRef<HTMLElement | null>(null);

  // ─── Tap-to-flip ─────────────────────────────────────────────────────────
  // `:hover` is gated behind `(hover: hover) and (pointer: fine)` in CSS so
  // it cannot stick on touch devices. To still let touch users see the back
  // (with weight / material / view-image / wishlist) we add an `.is-flipped`
  // class on tap. Only ONE card is flipped at a time, so tapping a new card
  // closes the previous one — same model as a single-select accordion.
  // Children with their own click semantics (the wishlist heart, the
  // "view image" button, any future <a>) opt out via `closest('button, a')`,
  // so their taps run their own handler without re-toggling the flip.
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const handleCardActivate = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, id: string) => {
      const target = event.target as HTMLElement;
      if (target.closest('button, a')) return;
      setFlippedId((current) => (current === id ? null : id));
    },
    [],
  );

  // ─── Viewport-driven reveal — React-state, not DOM-mutation ──────────────
  // Earlier this added `.product-auto-reveal--visible` directly via
  // `classList.add()`. Whenever any other state changed (a tap toggling
  // `flippedId`, the wishlist context updating), React re-rendered every
  // card and **wrote the className prop straight back to the DOM**, wiping
  // every visible class added by JS. The visual symptom: tap a card → the
  // tapped card AND every previously-revealed card snap back to opacity 0
  // (i.e. the bug the user saw — flipping made the card "disappear").
  //
  // The fix: keep the revealed-id set in React state so the className prop
  // itself carries the `--visible` modifier on every render. setState in
  // the observer batches multiple intersections in one update.
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    if (typeof IntersectionObserver === 'undefined') {
      // SSR / very old browser fallback: reveal everything immediately.
      const ids: string[] = [];
      root.querySelectorAll<HTMLElement>('[data-reveal-id]').forEach((el) => {
        const id = el.dataset.revealId;
        if (id) ids.push(id);
      });
      setRevealedIds(new Set(ids));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const newlyRevealed: string[] = [];
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.revealId;
            if (id) newlyRevealed.push(id);
            observer.unobserve(entry.target);
          }
        }
        if (newlyRevealed.length === 0) return;
        setRevealedIds((prev) => {
          const next = new Set(prev);
          for (const id of newlyRevealed) next.add(id);
          return next;
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );

    root.querySelectorAll('[data-reveal-id]').forEach((card) =>
      observer.observe(card),
    );

    return () => observer.disconnect();
  }, [categories]);

  return (
    <section id="products" className="section glass-section" ref={sectionRef}>
      <div className="section-divider"></div>
      <div className="container section__head fx-reveal">
        <h2 className="section-title">{productsTitle}</h2>
        <p className="section-subtitle">{productsSubtitle}</p>
      </div>

      {categories.map((category) => (
        <div key={category.title} className="container">
          <h3 className="category-title gradient-heading">{category.title}</h3>
          <div className="products-grid-compact">
            {category.products.map((product) => {
              const wishlistId = `${brandName}-${product.name}`;
              const inWishlist = isInWishlist(wishlistId);

              const isFlipped = flippedId === wishlistId;
              const isRevealed = revealedIds.has(wishlistId);

              return (
                <div
                  key={product.name}
                  data-reveal-id={wishlistId}
                  className={`product-card-flip-container product-auto-reveal${
                    isRevealed ? ' product-auto-reveal--visible' : ''
                  }${isFlipped ? ' is-flipped' : ''}`}
                  onClick={(event) => handleCardActivate(event, wishlistId)}
                >
                  <div className="product-card-mini glass-card">
                    {product.details?.gift && (
                      <div className="product-gift-ribbon" aria-label={t('brandPage.giftIncluded')}>
                        <span>🎁 {t('brandPage.giftIncluded')}</span>
                      </div>
                    )}
                    <div className="product-card-front">
                      <ImageWithFallback
                        src={toWebp(product.image)}
                        fallbackSrc={product.image}
                        alt={product.alt}
                        className="product-mini-image"
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={320}
                        /* Image is now centred via flexbox `margin-inline: auto`,
                           so the legacy `translateX(-50%)` (paired with a
                           `position: absolute; left: 50%`) is gone. Per-product
                           `imageScale` still applies as a pure scale transform. */
                        style={
                          product.imageScale
                            ? { transform: `scale(${product.imageScale / 0.85})` }
                            : undefined
                        }
                      />
                      <div className="product-mini-info">
                        <h4>{product.name}</h4>
                        <p>{product.description}</p>
                      </div>
                    </div>
                    <div className="product-card-back">
                      <div className="product-details">
                        <h4 className="details-title">{product.name}</h4>
                        <div className="details-stack">
                          <div className="detail-item-full">
                            <span className="detail-label">{t('brandPage.weight')}</span>
                            <span className="detail-value">{product.details?.weight || t('brandPage.notSpecified')}</span>
                          </div>
                          <div className="detail-item-full">
                            <span className="detail-label">{t('brandPage.material')}</span>
                            <span className="detail-value">{product.details?.material || t('brandPage.notSpecified')}</span>
                          </div>
                          <div className="detail-item-full">
                            <span className="detail-label">{t('brandPage.count')}</span>
                            <span className="detail-value">{product.details?.count || t('brandPage.notSpecified')}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            className="image-preview-btn"
                            style={{ flex: 1 }}
                            onClick={() => onProductOpen(product)}
                            aria-label={`${t('brandPage.viewImageAria')} ${product.name}`}
                          >
                            {t('brandPage.viewImage')}
                          </button>
                          <button
                            className={`product-wishlist-btn${inWishlist ? ' product-wishlist-btn--active' : ''}`}
                            onClick={() => {
                              toggle({
                                id: wishlistId,
                                productDbId: product.id,
                                name: product.name,
                                description: product.description,
                                image: product.image,
                                alt: product.alt,
                                brand: brandName,
                                details: product.details,
                              });
                            }}
                            title={
                              inWishlist
                                ? t('brandPage.removeWishlist', 'Remove from Wishlist')
                                : t('brandPage.addWishlist', 'Add to Wishlist')
                            }
                            aria-label={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
                          >
                            {inWishlist ? '♥' : '♡'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};

const ProductGrid = memo(ProductGridComponent);
ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;

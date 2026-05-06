import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Heart } from '@phosphor-icons/react';
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

  return (
    <section id="products" className="section glass-section">
      <div className="section-divider"></div>
      <div className="container section__head fx-reveal">
        <h2 className="section-title">{productsTitle}</h2>
        <p className="section-subtitle">{productsSubtitle}</p>
      </div>

      {categories.map((category) => (
        <div key={category.title} className="container">
          <h3 className="category-title gradient-heading">{category.title}</h3>
          <div className="products-grid-compact">
            {category.products.map((product, productIndex) => {
              const wishlistId = `${brandName}-${product.name}`;
              const inWishlist = isInWishlist(wishlistId);

              return (
                <div
                  key={product.name}
                  className="product-card-flip-container product-auto-reveal"
                  style={{ animationDelay: `${productIndex * 0.05}s` }}
                >
                  <div className="product-card-mini glass-card">
                    {product.details?.gift && (
                      <div className="product-gift-ribbon" aria-label={t('brandPage.giftIncluded')}>
                        <span>
                          <Gift size={11} weight="fill" aria-hidden="true" />
                          {t('brandPage.giftIncluded')}
                        </span>
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
                        style={
                          product.imageScale
                            ? { transform: `translateX(-50%) scale(${product.imageScale / 0.85})` }
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
                            <Heart
                              size={18}
                              weight={inWishlist ? 'fill' : 'regular'}
                              aria-hidden="true"
                            />
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

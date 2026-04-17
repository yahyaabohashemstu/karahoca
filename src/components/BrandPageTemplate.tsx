import React, { useEffect, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';

import Header from '../components/Header';
import Footer from '../components/Footer';
import FlipBook from './FlipBook';
import ImageWithFallback from './ImageWithFallback';
import { useWishlist } from '../hooks/useWishlist';
import { toWebp } from '../utils/image';

// ─── Structural equality helpers for the React.memo comparator ────────────
// The goal of the comparator below is to skip re-renders when a parent
// re-renders and passes FRESHLY-CONSTRUCTED arrays/objects with the same
// content as before (common source of wasted renders in React).
//
// We avoid a single catch-all deep-equal to keep the comparator cheap:
//   - scalars are handled via Object.is,
//   - flat string arrays (badges / catalogImages) use per-element compare,
//   - nested structures (aboutSections, categories) use JSON.stringify — a
//     reliable hash for pure data with no functions/dates/undefined fields.
//     The categories tree is ≤ a few dozen products per brand, so the
//     stringify cost is negligible compared to re-rendering the entire
//     subtree's DOM. If the tree ever grows to thousands of rows, swap
//     this for a bespoke walker.
const arrayOfPrimitivesEqual = (a?: readonly unknown[], b?: readonly unknown[]) => {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const deepValueEqual = (a: unknown, b: unknown) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/** Build a WhatsApp share URL for the given product.
 *  Appends the product id as a URL hash so the recipient lands directly
 *  on the product modal (e.g. https://karahoca.com/aylux#aylux-dishwash-gel).
 */
function buildWhatsAppUrl(
  productName: string,
  productDesc: string,
  pageUrl: string,
  productId?: string,
): string {
  const desc = productDesc
    ? productDesc.slice(0, 130) + (productDesc.length > 130 ? '…' : '')
    : '';
  const base = pageUrl.split('#')[0];
  const productUrl = productId ? `${base}#${productId}` : base;
  const text = `🧹 *${productName}*${desc ? '\n' + desc : ''}\n\n🔗 ${productUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

interface ProductInfo {
  /** DB product ID — available from API; used for deep-link hash */
  id?: string;
  name: string;
  description: string;
  image: string;
  alt: string;
  details?: {
    weight?: string;
    material?: string;
    package?: string;
    count?: string;
    gift?: string;
    weightCountTable?: Array<{ weight: string; count: number }>;
  };
  gallery?: string[];
  imageScale?: number;
}

interface CategoryData {
  title: string;
  products: ProductInfo[];
}

interface BrandPageProps {
  brandName: string;
  brandNameArabic: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  heroImageFallback?: string;
  heroImageAlt: string;
  badges: string[];
  aboutTitle: string;
  aboutSubtitle: string;
  aboutMainHeading: string;
  aboutSections: {
    title: string;
    content: string;
  }[];
  productsTitle: string;
  productsSubtitle: string;
  categories: CategoryData[];
  pageClass: string;
  aboutId: string;
  pdfUrl?: string;
  catalogImages?: string[];
}

const BrandPageTemplate: React.FC<BrandPageProps> = ({
  brandName,
  brandNameArabic,
  heroTitle,
  heroDescription,
  heroImage,
  heroImageFallback,
  heroImageAlt,
  badges,
  aboutTitle,
  aboutSubtitle,
  aboutMainHeading,
  aboutSections,
  productsTitle,
  productsSubtitle,
  categories,
  pageClass,
  aboutId,
  pdfUrl,
  catalogImages
}) => {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const { isInWishlist, toggle } = useWishlist();

  // ── Deep-link: open product modal when URL contains a product hash ─────────
  // e.g. https://karahoca.com/aylux#aylux-dishwash-gel
  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip '#'
    if (!hash) return;
    for (const cat of categories) {
      const found = cat.products.find(p => p.id === hash);
      if (found) {
        setSelectedProduct(found);
        setGalleryIndex(0);
        break;
      }
    }
  }, [categories]);

  // All images for the popup: main image first, then gallery colour variants
  const allPopupImages = selectedProduct
    ? [selectedProduct.image, ...(selectedProduct.gallery ?? [])]
    : [];

  const openImagePopup = (product: ProductInfo) => {
    setSelectedProduct(product);
    setGalleryIndex(0);
  };

  const closeImagePopup = () => {
    setSelectedProduct(null);
    setGalleryIndex(0);
  };

  return (
    <div className={pageClass}>
      <div className="bg-elements">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>

      <Header />

      <main>
        <section className="hero">
          <div className="container hero__grid">
            <div className="hero__copy">
              <h1 className="fx-reveal hero-title">
                <span className="gradient-text">{brandName}</span><br />
                {heroTitle}
              </h1>
              <p className="lead fx-reveal">{heroDescription}</p>
              <div className="hero__cta fx-reveal">
                <a href="#products" className="btn btn--primary btn-hover-effect">{t('brandPage.exploreProducts')}</a>
                <a href="#contact" className="btn btn--ghost btn-hover-effect">{t('brandPage.requestQuote')}</a>
              </div>
              <ul className="hero__badges">
                {badges.map((badge) => (
                  <li key={badge} className="chip glass-chip">{badge}</li>
                ))}
              </ul>
            </div>
            <div className="hero__visual">
              <div className="hero-orb hero-orb--1"></div>
              <div className="hero-orb hero-orb--2"></div>
                <div className="card-3d" data-tilt="true">
                  <div className="card-3d__inner glass-panel">
                    <ImageWithFallback
                      src={heroImage}
                      fallbackSrc={heroImageFallback}
                      alt={heroImageAlt}
                      width={800}
                      height={800}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
          </div>
          <a href={`#${aboutId}`} className="scroll-indicator" aria-label={t('brandPage.scrollDown')}>
            <span className="scroll-indicator__dot"></span>
          </a>
        </section>

        <section id={aboutId} className="section glass-section section--alt">
          <div className="section-divider"></div>
          <div className="container section__head fx-reveal">
            <h2 className="section-title">{aboutTitle}</h2>
            <p className="section-subtitle">{aboutSubtitle}</p>
          </div>
          <div className="container split">
            <div className="fx-reveal" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '18px', padding: '18px', maxHeight: '320px', overflowY: 'auto', width: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.18)' }}>
                <div className="main-heading" style={{ marginBottom: '1em' }}>{aboutMainHeading}</div>
                {aboutSections.map((section, index) => (
                  <React.Fragment key={index}>
                    <div className="section-divider" style={{ width: '80%', height: '2.5px', margin: '0.5em auto 1em auto' }}></div>
                    <div className="gradient-heading" style={{ marginBottom: '1em', fontWeight: 'bold', fontSize: '1.35em', letterSpacing: '0.5px' }}>{section.title}</div>
                    <p style={{ marginBottom: '1em' }}>{section.content}</p>
                  </React.Fragment>
                ))}
              </div>
              <a href="#products" className="link gradient-text" style={{ marginTop: '18px' }}>{t('brandPage.exploreProducts')}</a>
            </div>
            <div className="fx-up">
              <div className="about-media glass-media">
                <div className="animated-blob blob"></div>
                <div className="animated-blob blob--alt"></div>
                <img
                  src="/KARAHOCA-1-newPhoto.webp"
                  alt={`${t('brandPage.productsAlt')} ${brandNameArabic}`}
                  width={900}
                  height={600}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Flipbook Catalog — BEFORE products ──────────────────────── */}
        {(catalogImages || pdfUrl) && (
          <section id="catalog" className="section bfb-section">
            <div className="section-divider"></div>

            <div className="container bfb-header fx-reveal">
              <div className="bfb-header__left">
                <span className="bfb-eyebrow">Interactive Catalog</span>
                <h2 className="bfb-title">
                  كتالوج <span className="gradient-text">{brandName}</span> التفاعلي
                </h2>
                <p className="bfb-subtitle">
                  تصفّح جميع المنتجات بتجربة قراءة رقمية سلسة — قلّب الصفحات وشاهد بوضع ملء الشاشة
                </p>
              </div>
              <div className="bfb-header__badges">
                <span className="bfb-badge"><span className="bfb-badge__dot bfb-badge__dot--green"></span>متاح الآن</span>
                <span className="bfb-badge">⛶ ملء الشاشة</span>
              </div>
            </div>

            <div className="container bfb-frame-wrap fx-reveal">
              <FlipBook
                imageUrls={catalogImages}
                downloadUrl={pdfUrl}
                brandName={brandName}
              />
            </div>
          </section>
        )}

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
                {category.products.map((product, productIndex) => (
                  <div
                    key={product.name}
                    className="product-card-flip-container product-auto-reveal"
                    style={{ animationDelay: `${productIndex * 0.05}s` }}
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
                          style={product.imageScale ? { transform: `translateX(-50%) scale(${product.imageScale / 0.85})` } : undefined}
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
                              onClick={() => openImagePopup(product)}
                              aria-label={`${t('brandPage.viewImageAria')} ${product.name}`}
                            >
                              {t('brandPage.viewImage')}
                            </button>
                            <button
                              className={`product-wishlist-btn${isInWishlist(`${brandName}-${product.name}`) ? ' product-wishlist-btn--active' : ''}`}
                              onClick={() => {
                                const id = `${brandName}-${product.name}`;
                                toggle({
                                  id,
                                  productDbId: product.id,
                                  name: product.name,
                                  description: product.description,
                                  image: product.image,
                                  alt: product.alt,
                                  brand: brandName,
                                  details: product.details,
                                });
                              }}
                              title={isInWishlist(`${brandName}-${product.name}`) ? t('brandPage.removeWishlist', 'Remove from Wishlist') : t('brandPage.addWishlist', 'Add to Wishlist')}
                              aria-label={isInWishlist(`${brandName}-${product.name}`) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                            >
                              {isInWishlist(`${brandName}-${product.name}`) ? '♥' : '♡'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

      </main>

      {/* Image Popup */}
      {selectedProduct && (
        <div className="image-popup-overlay" onClick={closeImagePopup}>
          <div className="image-popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-popup-close" onClick={closeImagePopup}>
              ✕
            </button>

            <div className="popup-layout">
              <div className="popup-image-section">
                {/* Main image */}
                <div className="popup-main-image-wrap">
                  <ImageWithFallback
                    src={toWebp(allPopupImages[galleryIndex])}
                    fallbackSrc={allPopupImages[galleryIndex]}
                    alt={selectedProduct.alt}
                    className="image-popup-img"
                    width={900}
                    height={900}
                    loading="eager"
                    decoding="async"
                    key={allPopupImages[galleryIndex]}
                  />
                </div>

                {/* Thumbnail strip with side arrows */}
                {allPopupImages.length > 1 && (
                  <div className="popup-thumb-nav">
                    <button
                      className="popup-thumb-arrow"
                      onClick={() => setGalleryIndex(i => (i - 1 + allPopupImages.length) % allPopupImages.length)}
                      aria-label="Previous"
                    >‹</button>

                    <div className="popup-thumbnails">
                      {allPopupImages.map((img, idx) => (
                        <button
                          key={idx}
                          className={`popup-thumbnail${idx === galleryIndex ? ' popup-thumbnail--active' : ''}`}
                          onClick={() => setGalleryIndex(idx)}
                          aria-label={`Image ${idx + 1}`}
                        >
                          <ImageWithFallback
                            src={toWebp(img)}
                            fallbackSrc={img}
                            alt={`${selectedProduct.alt} ${idx + 1}`}
                            width={96}
                            height={96}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ))}
                    </div>

                    <button
                      className="popup-thumb-arrow"
                      onClick={() => setGalleryIndex(i => (i + 1) % allPopupImages.length)}
                      aria-label="Next"
                    >›</button>
                  </div>
                )}
              </div>

              <div className="popup-info-section">
                <div className="image-popup-title">{selectedProduct.name}</div>
                <div className="image-popup-description">{selectedProduct.description}</div>

                {selectedProduct.details && (
                  <div className="image-popup-details">
                    {selectedProduct.details.weightCountTable && selectedProduct.details.weightCountTable.length > 0 ? (
                      <>
                        {/* Weight → Count mapping table */}
                        <div className="popup-wc-table-wrap">
                          <table className="popup-wc-table">
                            <thead>
                              <tr>
                                <th>{t('brandPage.weight')}</th>
                                <th>{t('brandPage.count')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedProduct.details.weightCountTable.map((row, idx) => (
                                <tr key={idx}>
                                  <td>{row.weight}</td>
                                  <td>{row.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Material shown separately */}
                        {selectedProduct.details.material && (
                          <div className="popup-details-grid" style={{ marginTop: '0.7rem' }}>
                            <div className="popup-detail-item">
                              <span className="popup-detail-label">{t('brandPage.material')}</span>
                              <span className="popup-detail-value">{selectedProduct.details.material}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="popup-details-grid">
                        {selectedProduct.details.weight && (
                          <div className="popup-detail-item">
                            <span className="popup-detail-label">{t('brandPage.weight')}</span>
                            <span className="popup-detail-value">{selectedProduct.details.weight}</span>
                          </div>
                        )}
                        {selectedProduct.details.material && (
                          <div className="popup-detail-item">
                            <span className="popup-detail-label">{t('brandPage.material')}</span>
                            <span className="popup-detail-value">{selectedProduct.details.material}</span>
                          </div>
                        )}
                        {selectedProduct.details.count && (
                          <div className="popup-detail-item">
                            <span className="popup-detail-label">{t('brandPage.count')}</span>
                            <span className="popup-detail-value">{selectedProduct.details.count}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedProduct.details.gift && (
                      <div className="popup-gift-section">
                        <div className="popup-gift-icon">🎁</div>
                        <div className="popup-gift-body">
                          <span className="popup-gift-label">{t('brandPage.gift')}</span>
                          <span className="popup-gift-value">{selectedProduct.details.gift}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── WhatsApp share ─────────────────────────────────────── */}
                <a
                  href={buildWhatsAppUrl(
                    selectedProduct.name,
                    selectedProduct.description,
                    window.location.href,
                    selectedProduct.id,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="popup-whatsapp-share"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.526 5.845L.057 23.428a.5.5 0 0 0 .515.572l5.764-1.512A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882c-1.85 0-3.574-.497-5.063-1.362l-.363-.214-3.76.986 1.003-3.668-.236-.375A9.855 9.855 0 0 1 2.118 12c0-5.449 4.433-9.882 9.882-9.882 5.449 0 9.882 4.433 9.882 9.882 0 5.449-4.433 9.882-9.882 9.882z"/>
                  </svg>
                  {t('brandPage.shareWhatsApp')}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

/**
 * Custom `areEqual` comparator for React.memo.
 *
 * Ignores REFERENCE changes on array / object props when their CONTENT is
 * unchanged — the common case when a parent re-renders (for any reason,
 * e.g. language switch bubbling up) while passing the same static catalog
 * data. Catches any genuine value change so the product grid updates when
 * the admin edits it.
 *
 * Ordering: cheapest checks first (string identity), then flat arrays,
 * then the nested structures. Returns `true` = skip render.
 */
const propsAreEqual = (prev: BrandPageProps, next: BrandPageProps): boolean => {
  // Strings / scalars — Object.is (null-safe for undefined vs null).
  if (
    prev.brandName !== next.brandName ||
    prev.brandNameArabic !== next.brandNameArabic ||
    prev.heroTitle !== next.heroTitle ||
    prev.heroDescription !== next.heroDescription ||
    prev.heroImage !== next.heroImage ||
    prev.heroImageFallback !== next.heroImageFallback ||
    prev.heroImageAlt !== next.heroImageAlt ||
    prev.aboutTitle !== next.aboutTitle ||
    prev.aboutSubtitle !== next.aboutSubtitle ||
    prev.aboutMainHeading !== next.aboutMainHeading ||
    prev.productsTitle !== next.productsTitle ||
    prev.productsSubtitle !== next.productsSubtitle ||
    prev.pageClass !== next.pageClass ||
    prev.aboutId !== next.aboutId ||
    prev.pdfUrl !== next.pdfUrl
  ) {
    return false;
  }

  // Flat string arrays — element-wise compare avoids reference-only diffs.
  if (!arrayOfPrimitivesEqual(prev.badges, next.badges)) return false;
  if (!arrayOfPrimitivesEqual(prev.catalogImages, next.catalogImages)) return false;

  // Nested objects — structural compare via JSON serialization.
  if (!deepValueEqual(prev.aboutSections, next.aboutSections)) return false;
  if (!deepValueEqual(prev.categories, next.categories)) return false;

  return true;
};

const MemoizedBrandPageTemplate = memo(BrandPageTemplate, propsAreEqual);
MemoizedBrandPageTemplate.displayName = 'BrandPageTemplate';

export default MemoizedBrandPageTemplate;

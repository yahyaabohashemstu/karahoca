import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FlipBook from './FlipBook';
import { useWishlist } from '../hooks/useWishlist';

// ── Smart product-image content-centering ────────────────────────────────────
// Reads pixel data from a transparent PNG/WebP to find the bounding-box of the
// actual product (non-transparent pixels), then returns the (x, y) percentage
// offset needed so the product centroid aligns with the image centre.
// A 128×128 down-sample is used for speed; results are cached by URL.

const _imgOffsetCache = new Map<string, { x: number; y: number }>();

function analyzeContentCenter(src: string): Promise<{ x: number; y: number }> {
  const hit = _imgOffsetCache.get(src);
  if (hit) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const N = 128;
        const canvas = document.createElement('canvas');
        canvas.width = N;
        canvas.height = N;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve({ x: 0, y: 0 }); return; }
        ctx.drawImage(img, 0, 0, N, N);
        const { data } = ctx.getImageData(0, 0, N, N);

        let minX = N, minY = N, maxX = 0, maxY = 0, found = false;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            // alpha threshold = 15 to ignore anti-aliasing fringe
            if (data[(y * N + x) * 4 + 3] > 15) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        // Content centroid vs. canvas centre → percentage shift
        const result = found
          ? {
              x: Math.round(((N / 2 - (minX + maxX) / 2) / N) * 100),
              y: Math.round(((N / 2 - (minY + maxY) / 2) / N) * 100),
            }
          : { x: 0, y: 0 };

        _imgOffsetCache.set(src, result);
        resolve(result);
      } catch {
        resolve({ x: 0, y: 0 });
      }
    };
    img.onerror = () => resolve({ x: 0, y: 0 });
    img.src = src;
  });
}

// ── CenteredProductThumb ──────────────────────────────────────────────────────
// Drop-in replacement for the card thumbnail <img>.
// Inherits the existing absolute-centre positioning (translate -50%,-50%) and
// adds the content-centering offset so the real product sits in the visual centre.
interface CenteredThumbProps {
  src: string;
  alt: string;
  className?: string;
}
const CenteredProductThumb: React.FC<CenteredThumbProps> = ({ src, alt, className }) => {
  const [off, setOff] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!src) return;
    analyzeContentCenter(src).then(setOff);
  }, [src]);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      style={{
        // Merge absolute-centering (-50%) with content-centering offset
        transform: `translate(calc(-50% + ${off.x}%), calc(-50% + ${off.y}%))`,
        transition: 'transform 0.35s ease',
      }}
    />
  );
};

interface ProductInfo {
  name: string;
  description: string;
  image: string;
  alt: string;
  details?: {
    weight?: string;
    material?: string;
    package?: string;
    count?: string;
  };
  gallery?: string[];
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
}

const BrandPageTemplate: React.FC<BrandPageProps> = ({
  brandName,
  brandNameArabic,
  heroTitle,
  heroDescription,
  heroImage,
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
  pdfUrl
}) => {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const { isInWishlist, toggle, items: wishlistItems } = useWishlist();

  // Analyse the currently-displayed popup image and centre its content
  useEffect(() => {
    if (!selectedProduct) { setImageOffset({ x: 0, y: 0 }); return; }
    const images = [selectedProduct.image, ...(selectedProduct.gallery ?? [])];
    const src = images[galleryIndex] ?? '';
    if (!src) return;
    setImageOffset({ x: 0, y: 0 }); // reset while analysing
    analyzeContentCenter(src).then(setImageOffset);
  }, [selectedProduct, galleryIndex]);

  // All images for the popup: main image first, then gallery images
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

  const galleryPrev = () => {
    setGalleryIndex(i => (i - 1 + allPopupImages.length) % allPopupImages.length);
  };

  const galleryNext = () => {
    setGalleryIndex(i => (i + 1) % allPopupImages.length);
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
                  <img src={heroImage} alt={heroImageAlt} />
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
                <img src="/KARAHOCA-1-newPhoto.webp" alt={`${t('brandPage.productsAlt')} ${brandNameArabic}`} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Flipbook Catalog — BEFORE products ──────────────────────── */}
        {pdfUrl && (
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
              <FlipBook pdfUrl={pdfUrl} brandName={brandName} />
            </div>
          </section>
        )}

        <section id="products" className="section glass-section">
          <div className="section-divider"></div>
          <div className="container section__head fx-reveal" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h2 className="section-title">{productsTitle}</h2>
              <p className="section-subtitle">{productsSubtitle}</p>
            </div>
            {wishlistItems.length > 0 && (
              <Link
                to="/wishlist"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem', borderRadius: 8, background: 'rgba(79,110,247,0.15)', border: '1px solid rgba(79,110,247,0.35)', color: '#6b84ff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}
              >
                ♥ {t('brandPage.wishlist', 'Wishlist')}
                <span style={{ background: '#4f6ef7', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                  {wishlistItems.length}
                </span>
              </Link>
            )}
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
                      <div className="product-card-front">
                        <CenteredProductThumb src={product.image} alt={product.alt} className="product-mini-image" />
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
                              onClick={() => {
                                const id = `${brandName}-${product.name}`;
                                toggle({ id, name: product.name, description: product.description, image: product.image, alt: product.alt, brand: brandName, details: product.details });
                              }}
                              title={isInWishlist(`${brandName}-${product.name}`) ? t('brandPage.removeWishlist', 'Remove from Wishlist') : t('brandPage.addWishlist', 'Add to Wishlist')}
                              aria-label={isInWishlist(`${brandName}-${product.name}`) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                              style={{
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: isInWishlist(`${brandName}-${product.name}`) ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                                color: isInWishlist(`${brandName}-${product.name}`) ? '#ef4444' : 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                transition: 'all 0.2s',
                              }}
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
                {/* Gallery wrapper */}
                <div className="popup-gallery-wrapper">
                  {/* Image frame — clips shifted transparent canvas edges */}
                  <div className="popup-image-frame">
                    <img
                      src={allPopupImages[galleryIndex]}
                      alt={selectedProduct.alt}
                      className="image-popup-img"
                      key={allPopupImages[galleryIndex]}
                      style={{
                        transform: `translate(${imageOffset.x}%, ${imageOffset.y}%)`,
                        transition: 'transform 0.35s ease',
                      }}
                    />
                  </div>

                  {/* Navigation arrows — outside the frame so they're never clipped */}
                  {allPopupImages.length > 1 && (
                    <>
                      <button
                        className="popup-gallery-arrow popup-gallery-arrow--prev"
                        onClick={galleryPrev}
                        aria-label="Previous image"
                      >
                        ‹
                      </button>
                      <button
                        className="popup-gallery-arrow popup-gallery-arrow--next"
                        onClick={galleryNext}
                        aria-label="Next image"
                      >
                        ›
                      </button>
                    </>
                  )}
                </div>

                {/* Dot indicators */}
                {allPopupImages.length > 1 && (
                  <div className="popup-gallery-dots">
                    {allPopupImages.map((_, idx) => (
                      <button
                        key={idx}
                        className={`popup-gallery-dot${idx === galleryIndex ? ' popup-gallery-dot--active' : ''}`}
                        onClick={() => setGalleryIndex(idx)}
                        aria-label={`Image ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="popup-info-section">
                <div className="image-popup-title">{selectedProduct.name}</div>
                <div className="image-popup-description">{selectedProduct.description}</div>

                {/* Counter for multi-image products */}
                {allPopupImages.length > 1 && (
                  <div className="popup-gallery-counter">
                    {galleryIndex + 1} / {allPopupImages.length}
                  </div>
                )}

                {selectedProduct.details && (
                  <div className="image-popup-details">
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
};

export default BrandPageTemplate;
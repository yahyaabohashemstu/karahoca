import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface ProductSize {
  label: string;
  image?: string;
}

interface ProductInfo {
  name: string;
  description: string;
  image: string;
  alt: string;
  sizes?: ProductSize[] | null;
  details?: {
    weight?: string;
    material?: string;
    package?: string;
    count?: string;
  };
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
  flipbookUrl?: string;
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
  flipbookUrl
}) => {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const [popupSizeIdx, setPopupSizeIdx] = useState(0);
  // key: `${catIdx}-${prodIdx}`, value: selected size index
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({});

  const getSizeIdx = (key: string) => selectedSizes[key] ?? 0;

  const getActiveImage = (product: ProductInfo, sizeIdx: number): string => {
    if (!product.sizes?.length) return product.image;
    const sz = product.sizes[sizeIdx];
    return (sz?.image?.trim()) ? sz.image : product.image;
  };

  const getActiveWeight = (product: ProductInfo, sizeIdx: number): string => {
    if (!product.sizes?.length) return product.details?.weight || '';
    return product.sizes[sizeIdx]?.label || '';
  };

  const openImagePopup = (product: ProductInfo, sizeIdx = 0) => {
    setSelectedProduct(product);
    setPopupSizeIdx(sizeIdx);
  };

  const closeImagePopup = () => {
    setSelectedProduct(null);
    setPopupSizeIdx(0);
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
                {badges.map((badge, index) => (
                  <li key={index} className="chip glass-chip">{badge}</li>
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
        {flipbookUrl && (
          <section id="catalog" className="section bfb-section">
            <div className="section-divider"></div>

            {/* header row */}
            <div className="container bfb-header fx-reveal">
              <div className="bfb-header__left">
                <span className="bfb-eyebrow">Interactive Catalog</span>
                <h2 className="bfb-title">
                  كتالوج <span className="gradient-text">{brandName}</span> التفاعلي
                </h2>
                <p className="bfb-subtitle">
                  تصفّح جميع المنتجات بتجربة قراءة رقمية سلسة — قلّب الصفحات، كبّر، وشاهد بوضع ملء الشاشة
                </p>
              </div>
              <div className="bfb-header__badges">
                <span className="bfb-badge"><span className="bfb-badge__dot bfb-badge__dot--green"></span>متاح الآن</span>
                <span className="bfb-badge">⛶ ملء الشاشة</span>
                <span className="bfb-badge">🔊 صوت التقليب</span>
              </div>
            </div>

            {/* iframe frame */}
            <div className="container bfb-frame-wrap fx-reveal">
              <div className="bfb-frame">
                <div className="bfb-frame__topbar">
                  <div className="bfb-frame__dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span className="bfb-frame__label">📖 {brandName} — Catalog</span>
                  <span className="bfb-frame__hint">انقر على ⛶ لعرض ملء الشاشة</span>
                </div>
                <iframe
                  src={flipbookUrl}
                  allowFullScreen
                  allow="clipboard-write; fullscreen"
                  title={`${brandName} Catalog`}
                  className="bfb-iframe"
                />
              </div>
            </div>
          </section>
        )}

        <section id="products" className="section glass-section">
          <div className="section-divider"></div>
          <div className="container section__head fx-reveal">
            <h2 className="section-title">{productsTitle}</h2>
            <p className="section-subtitle">{productsSubtitle}</p>
          </div>

          {categories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="container">
              <h3 className="category-title gradient-heading">{category.title}</h3>
              <div className="products-grid-compact">
                {category.products.map((product, productIndex) => {
                  const cardKey = `${categoryIndex}-${productIndex}`;
                  const sizeIdx = getSizeIdx(cardKey);
                  const hasSizes = !!(product.sizes?.length);
                  const activeImage = getActiveImage(product, sizeIdx);
                  const activeWeight = getActiveWeight(product, sizeIdx);
                  return (
                    <div
                      key={productIndex}
                      className="product-card-flip-container product-auto-reveal"
                      style={{ animationDelay: `${productIndex * 0.05}s` }}
                    >
                      <div className="product-card-mini glass-card">
                        <div className="product-card-front">
                          <img src={activeImage} alt={product.alt} className="product-mini-image" loading="lazy" />
                          <div className="product-mini-info">
                            <h4>{product.name}</h4>
                            <p>{product.description}</p>
                          </div>
                          {hasSizes && (
                            <div className="product-size-pills" onClick={e => e.stopPropagation()}>
                              {product.sizes!.map((sz, si) => (
                                <button
                                  key={si}
                                  className={`product-size-pill${sizeIdx === si ? ' active' : ''}`}
                                  onClick={() => setSelectedSizes(prev => ({ ...prev, [cardKey]: si }))}
                                >
                                  {sz.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="product-card-back">
                          <div className="product-details">
                            <h4 className="details-title">{product.name}</h4>
                            {hasSizes && (
                              <div className="product-size-pills product-size-pills--back" onClick={e => e.stopPropagation()}>
                                {product.sizes!.map((sz, si) => (
                                  <button
                                    key={si}
                                    className={`product-size-pill${sizeIdx === si ? ' active' : ''}`}
                                    onClick={() => setSelectedSizes(prev => ({ ...prev, [cardKey]: si }))}
                                  >
                                    {sz.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="details-stack">
                              <div className="detail-item-full">
                                <span className="detail-label">{t('brandPage.weight')}</span>
                                <span className="detail-value">{activeWeight || t('brandPage.notSpecified')}</span>
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
                            <button
                              className="image-preview-btn"
                              onClick={() => openImagePopup(product, sizeIdx)}
                              aria-label={`${t('brandPage.viewImageAria')} ${product.name}`}
                            >
                              {t('brandPage.viewImage')}
                            </button>
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
                <img
                  src={getActiveImage(selectedProduct, popupSizeIdx)}
                  alt={selectedProduct.alt}
                  className="image-popup-img"
                />
                {selectedProduct.sizes?.length && (
                  <div className="product-size-pills product-size-pills--popup" style={{ justifyContent: 'center', marginTop: 12 }}>
                    {selectedProduct.sizes.map((sz, si) => (
                      <button
                        key={si}
                        className={`product-size-pill${popupSizeIdx === si ? ' active' : ''}`}
                        onClick={() => setPopupSizeIdx(si)}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="popup-info-section">
                <div className="image-popup-title">{selectedProduct.name}</div>
                <div className="image-popup-description">{selectedProduct.description}</div>

                <div className="image-popup-details">
                  <div className="popup-details-grid">
                    {(getActiveWeight(selectedProduct, popupSizeIdx) || selectedProduct.details?.weight) && (
                      <div className="popup-detail-item">
                        <span className="popup-detail-label">{t('brandPage.weight')}</span>
                        <span className="popup-detail-value">
                          {getActiveWeight(selectedProduct, popupSizeIdx) || selectedProduct.details?.weight}
                        </span>
                      </div>
                    )}
                    {selectedProduct.details?.material && (
                      <div className="popup-detail-item">
                        <span className="popup-detail-label">{t('brandPage.material')}</span>
                        <span className="popup-detail-value">{selectedProduct.details.material}</span>
                      </div>
                    )}
                    {selectedProduct.details?.count && (
                      <div className="popup-detail-item">
                        <span className="popup-detail-label">{t('brandPage.count')}</span>
                        <span className="popup-detail-value">{selectedProduct.details.count}</span>
                      </div>
                    )}
                  </div>
                </div>
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
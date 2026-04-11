import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";
import type { BrandCategoryData, BrandProductInfo } from "../data/brandCatalog";
import FlipBook from "../components/FlipBook";

/** Build a WhatsApp share URL for the given product.
 *  If the product has an `id`, the link points directly to that product
 *  via a URL hash (e.g. https://karahoca.com/aylux#aylux-dishwash-gel).
 *  Opening that link auto-opens the product modal (see useEffect below).
 */
function buildWhatsAppUrl(product: BrandProductInfo, pageUrl: string): string {
  const name = product.name;
  const desc = product.description
    ? product.description.slice(0, 130) + (product.description.length > 130 ? '…' : '')
    : '';
  // Strip any existing hash then append product id if available
  const base = pageUrl.split('#')[0];
  const productUrl = product.id ? `${base}#${product.id}` : base;
  const text = `🧹 *${name}*${desc ? '\n' + desc : ''}\n\n🔗 ${productUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

interface BrandAboutSection {
  title: string;
  content: string;
}

interface MobileBrandPageTemplateProps {
  seoTitle: string;
  seoDescription: string;
  seoKeywords?: string;
  canonicalUrl: string;
  ogImage?: string;
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
  aboutSections: BrandAboutSection[];
  productsTitle: string;
  productsSubtitle: string;
  categories: BrandCategoryData[];
  aboutId: string;
  pdfUrl?: string;
}

export default function MobileBrandPageTemplate({
  seoTitle,
  seoDescription,
  seoKeywords,
  canonicalUrl,
  ogImage,
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
  aboutId,
  pdfUrl,
}: MobileBrandPageTemplateProps) {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<BrandProductInfo | null>(null);

  // ── Deep-link: open product modal when URL contains a product hash ─────────
  // e.g. https://karahoca.com/m/aylux#aylux-dishwash-gel
  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip '#'
    if (!hash) return;
    for (const cat of categories) {
      const found = cat.products.find(p => p.id === hash);
      if (found) {
        setSelectedProduct(found);
        break;
      }
    }
  }, [categories]);

  const totalProducts = useMemo(
    () =>
      categories.reduce(
        (total, category) => total + category.products.length,
        0
      ),
    [categories]
  );

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
      />

      <main className="m-page m-brandPage">
        <section className="m-pageHero m-container m-brandHero">
          <div className="m-pageHero__content">
            <span className="m-pageHero__eyebrow">{brandNameArabic}</span>
            <h1 className="m-pageHero__title">
              <span className="m-brandHero__name">{brandName}</span>
              <span className="m-brandHero__subtitle">{heroTitle}</span>
            </h1>
            <p className="m-pageHero__desc">{heroDescription}</p>

            <div className="m-pageHero__badges">
              {badges.map((badge) => (
                <span key={badge} className="m-pageHero__badge">
                  {badge}
                </span>
              ))}
            </div>

            <div className="m-pageHero__actions">
              <a href="#products" className="m-cta">
                {t("brandPage.exploreProducts")}
              </a>
              <a href={`#${aboutId}`} className="m-ghost">
                {aboutTitle}
              </a>
            </div>
          </div>

          <div className="m-pageHero__visual m-card">
            <img src={heroImage} alt={heroImageAlt} className="m-brandHero__logo" />
          </div>
        </section>

        <section className="m-pageSection m-container">
          <div className="m-brandHighlights">
            <article className="m-highlightCard m-card">
              <strong>{brandNameArabic}</strong>
              <span>{aboutSubtitle}</span>
            </article>
            <article className="m-highlightCard m-card">
              <strong>{totalProducts}</strong>
              <span>{productsTitle}</span>
            </article>
            <article className="m-highlightCard m-card">
              <strong>{brandName}</strong>
              <span>{badges[0] || t("brandPage.exploreProducts")}</span>
            </article>
          </div>
        </section>

        <section id={aboutId} className="m-pageSection m-container">
          <div className="m-section-header">
            <h2 className="m-section-title">{aboutTitle}</h2>
            <p className="m-section-subtitle">{aboutSubtitle}</p>
          </div>

          <div className="m-brandAbout m-card">
            <h3 className="m-brandAbout__heading">{aboutMainHeading}</h3>

            <div className="m-brandAbout__sections">
              {aboutSections.map((section) => (
                <article key={section.title} className="m-brandAbout__section">
                  <h4>{section.title}</h4>
                  <p>{section.content}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Flipbook Catalog — BEFORE products ───────────────────────── */}
        {pdfUrl && (
          <section id="catalog" className="m-pageSection m-container m-bfbSection">
            <div className="m-section-header">
              <h2 className="m-section-title">
                كتالوج <span style={{ color: 'var(--accent, #f54b1a)' }}>{brandName}</span> التفاعلي
              </h2>
              <p className="m-section-subtitle">
                تصفّح جميع المنتجات بتجربة قراءة رقمية سلسة
              </p>
            </div>
            <FlipBook pdfUrl={pdfUrl} brandName={brandName} />
          </section>
        )}

        <section id="products" className="m-pageSection m-container">
          <div className="m-section-header">
            <h2 className="m-section-title">{productsTitle}</h2>
            <p className="m-section-subtitle">{productsSubtitle}</p>
          </div>

          <div className="m-brandCategories">
            {categories.map((category, catIdx) => (
              <section key={catIdx} className="m-categoryBlock">
                <div className="m-categoryBlock__head">
                  <h3 className="m-categoryBlock__title">{category.title}</h3>
                  <span className="m-categoryBlock__count">
                    {category.products.length}
                  </span>
                </div>

                <div className="m-productsList">
                  {category.products.map((product, prodIdx) => (
                    <article key={prodIdx} className="m-productCard m-card">
                      <button
                        type="button"
                        className="m-productCard__imageButton"
                        onClick={() => setSelectedProduct(product)}
                        aria-label={`${t("brandPage.viewImageAria")} ${product.name}`}
                      >
                        <img src={product.image} alt={product.alt} />
                      </button>

                      <div className="m-productCard__body">
                        <h4 className="m-productCard__title">{product.name}</h4>
                        <p className="m-productCard__desc">{product.description}</p>

                        <div className="m-productCard__details">
                          <span className="m-productChip">
                            <strong>{t("brandPage.weight")}</strong>
                            {product.details?.weight || t("brandPage.notSpecified")}
                          </span>
                          <span className="m-productChip">
                            <strong>{t("brandPage.material")}</strong>
                            {product.details?.material || t("brandPage.notSpecified")}
                          </span>
                          <span className="m-productChip">
                            <strong>{t("brandPage.count")}</strong>
                            {product.details?.count || t("brandPage.notSpecified")}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="m-productCard__view"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {t("brandPage.viewImage")}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

      </main>

      {selectedProduct && (
        <div
          className="m-productModal"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProduct.name}
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="m-productModal__dialog m-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="m-productModal__close"
              onClick={() => setSelectedProduct(null)}
              aria-label={t("nav.closeMenu")}
            >
              ×
            </button>

            <div className="m-productModal__media">
              <img src={selectedProduct.image} alt={selectedProduct.alt} />
            </div>

            <div className="m-productModal__body">
              <h3>{selectedProduct.name}</h3>
              <p>{selectedProduct.description}</p>
              <div className="m-productModal__details">
                {selectedProduct.details?.weightCountTable && selectedProduct.details.weightCountTable.length > 0 ? (
                  <>
                    <div className="popup-wc-table-wrap" style={{ width: '100%', marginBottom: 6 }}>
                      <table className="popup-wc-table">
                        <thead>
                          <tr>
                            <th>{t("brandPage.weight")}</th>
                            <th>{t("brandPage.count")}</th>
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
                    <span className="m-productChip">
                      <strong>{t("brandPage.material")}</strong>
                      {selectedProduct.details?.material || t("brandPage.notSpecified")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="m-productChip">
                      <strong>{t("brandPage.weight")}</strong>
                      {selectedProduct.details?.weight || t("brandPage.notSpecified")}
                    </span>
                    <span className="m-productChip">
                      <strong>{t("brandPage.material")}</strong>
                      {selectedProduct.details?.material || t("brandPage.notSpecified")}
                    </span>
                    <span className="m-productChip">
                      <strong>{t("brandPage.count")}</strong>
                      {selectedProduct.details?.count || t("brandPage.notSpecified")}
                    </span>
                  </>
                )}
              </div>

              {/* ── WhatsApp share ─────────────────────────────────────── */}
              <a
                href={buildWhatsAppUrl(selectedProduct, canonicalUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="m-productModal__share"
              >
                {/* WhatsApp SVG icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.526 5.845L.057 23.428a.5.5 0 0 0 .515.572l5.764-1.512A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882c-1.85 0-3.574-.497-5.063-1.362l-.363-.214-3.76.986 1.003-3.668-.236-.375A9.855 9.855 0 0 1 2.118 12c0-5.449 4.433-9.882 9.882-9.882 5.449 0 9.882 4.433 9.882 9.882 0 5.449-4.433 9.882-9.882 9.882z"/>
                </svg>
                {t("brandPage.shareWhatsApp") || "مشاركة عبر واتساب"}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

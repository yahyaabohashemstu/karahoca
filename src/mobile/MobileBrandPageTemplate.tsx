import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";
import type { BrandCategoryData, BrandProductInfo } from "../data/brandCatalog";
import FlipBook from "../components/FlipBook";

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
  const [selectedProduct, setSelectedProduct] = useState<BrandProductInfo | null>(
    null
  );
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
            {categories.map((category) => (
              <section key={category.title} className="m-categoryBlock">
                <div className="m-categoryBlock__head">
                  <h3 className="m-categoryBlock__title">{category.title}</h3>
                  <span className="m-categoryBlock__count">
                    {category.products.length}
                  </span>
                </div>

                <div className="m-productsList">
                  {category.products.map((product) => (
                    <article key={product.name} className="m-productCard m-card">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

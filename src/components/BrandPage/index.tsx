import React, { memo, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../Header';
import Footer from '../Footer';
import FlipBook from '../FlipBook';
import BrandHero from './BrandHero';
import ProductGrid from './ProductGrid';
import ProductModal from './ProductModal';
import type { CategoryData, ProductInfo } from './types';

// ─── React.memo structural equality helpers ──────────────────────────────
// Same strategy as the previous `BrandPageTemplate` — cheap primitive /
// flat-array checks first, then JSON comparisons for the nested trees. The
// categories tree is ≤ a few dozen products per brand, so stringify cost
// is negligible compared to re-rendering the whole grid.

const arrayOfPrimitivesEqual = (a?: readonly unknown[], b?: readonly unknown[]) => {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const deepValueEqual = (a: unknown, b: unknown) => {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch { return false; }
};

// ─── Props ────────────────────────────────────────────────────────────────

export interface BrandPageProps {
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
  aboutSections: Array<{ title: string; content: string }>;
  productsTitle: string;
  productsSubtitle: string;
  categories: CategoryData[];
  pageClass: string;
  aboutId: string;
  pdfUrl?: string;
  catalogImages?: string[];
}

// ─── Orchestrator ─────────────────────────────────────────────────────────

/**
 * Brand landing page template used by DIOX and AYLUX.
 *
 * Previously: `src/components/BrandPageTemplate.tsx` — a single 622-line
 * file. Phase 3 split it into:
 *
 *   components/BrandPage/
 *     index.tsx         (this file — orchestrator, ~110 lines)
 *     BrandHero.tsx     (hero + about sections)
 *     ProductGrid.tsx   (categorised product cards)
 *     ProductModal.tsx  (native <dialog> details + gallery + share)
 *     types.ts          (ProductInfo, CategoryData)
 *
 * Responsibilities retained here:
 *   - Hold the selected-product state (lifts it above grid + modal so they
 *     stay decoupled).
 *   - Handle the URL-hash deep-link (`/aylux#aylux-dishwash-gel`) on mount
 *     so a shared WhatsApp link lands on the right product.
 *   - Render the static page chrome: header, footer, flipbook catalog band.
 */
const BrandPage: React.FC<BrandPageProps> = ({
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
  catalogImages,
}) => {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Deep-link: open the matching product modal whenever the URL hash points
  // at a product id. Two entry paths exercise this:
  //
  //   1. First-mount arrival from an external share (WhatsApp / SMS / etc.)
  //      — the page mounts WITH the hash set and we need to open the right
  //      modal on first render.
  //
  //   2. In-page hash navigation from the AI chat — the visitor is already
  //      on the brand page (chat overlays it) and taps "View product" on
  //      a card. React Router updates `location.hash` WITHOUT remounting
  //      the BrandPage component. So the effect MUST depend on
  //      `location.hash`, not just `categories`, otherwise the second
  //      (and any subsequent) "View product" tap silently does nothing.
  //
  // Tied to (2): the modal close handler clears the hash. If we left it
  // sticky, clicking the SAME "View product" link a second time wouldn't
  // change `location.hash`, the effect wouldn't re-run, and the modal
  // would stay closed.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    for (const cat of categories) {
      const found = cat.products.find((p) => p.id === hash);
      if (found) {
        setSelectedProduct(found);
        break;
      }
    }
  }, [categories, location.hash]);

  const handleProductOpen = useCallback((product: ProductInfo) => {
    setSelectedProduct(product);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedProduct(null);
    // Strip the deep-link hash so a subsequent click on ANY product link
    // (including the same one) re-fires the open effect. Guarded so we
    // don't push an extra history entry when there was no hash to begin
    // with (e.g. modal opened via the grid card click, not a deep link).
    if (location.hash) {
      navigate(`${location.pathname}${location.search}`, { replace: true });
    }
  }, [navigate, location.hash, location.pathname, location.search]);

  return (
    <div className={pageClass}>
      <div className="bg-elements">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>

      <Header />

      <main>
        <BrandHero
          brandName={brandName}
          brandNameArabic={brandNameArabic}
          heroTitle={heroTitle}
          heroDescription={heroDescription}
          heroImage={heroImage}
          heroImageFallback={heroImageFallback}
          heroImageAlt={heroImageAlt}
          badges={badges}
          aboutTitle={aboutTitle}
          aboutSubtitle={aboutSubtitle}
          aboutMainHeading={aboutMainHeading}
          aboutSections={aboutSections}
          aboutId={aboutId}
        />

        {/* Flipbook catalog band — only rendered when there's actually a
            catalog to show. Deliberately BEFORE the product grid so visitors
            see the richest brand visual first. */}
        {(catalogImages || pdfUrl) && (
          <section id="catalog" className="section bfb-section">
            <div className="section-divider"></div>

            {/* Centered catalog header — no inline "متاح الآن" /
                "⛶ ملء الشاشة" badges (removed per directive). The
                title pieces come from i18n so they swap language with
                the rest of the page; the brand name stays unlocalised
                because DIOX / AYLUX are Latin marks regardless of UI
                language. The prefix/suffix split is so each language
                can position the brand mid-sentence naturally (Arabic
                "كتالوج DIOX التفاعلي" vs English "DIOX Interactive
                Catalog" vs Russian "Интерактивный каталог DIOX"). */}
            <div className="container bfb-header bfb-header--centered fx-reveal">
              <span className="bfb-eyebrow">{t('brandPage.catalogEyebrow')}</span>
              <h2 className="bfb-title">
                {t('brandPage.catalogTitlePrefix') && (
                  <>{t('brandPage.catalogTitlePrefix')} </>
                )}
                <span className="gradient-text">{brandName}</span>
                {t('brandPage.catalogTitleSuffix') && (
                  <> {t('brandPage.catalogTitleSuffix')}</>
                )}
              </h2>
              <p className="bfb-subtitle">
                {t('brandPage.catalogSubtitle')}
              </p>
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

        <ProductGrid
          brandName={brandName}
          productsTitle={productsTitle}
          productsSubtitle={productsSubtitle}
          categories={categories}
          onProductOpen={handleProductOpen}
        />
      </main>

      <ProductModal product={selectedProduct} onClose={handleModalClose} />

      <Footer />
    </div>
  );
};

// Custom `areEqual` comparator for React.memo. Ignores reference-only
// changes on array/object props; catches any real content change. Returns
// `true` = skip render.
const propsAreEqual = (prev: BrandPageProps, next: BrandPageProps): boolean => {
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
  ) return false;

  if (!arrayOfPrimitivesEqual(prev.badges, next.badges)) return false;
  if (!arrayOfPrimitivesEqual(prev.catalogImages, next.catalogImages)) return false;
  if (!deepValueEqual(prev.aboutSections, next.aboutSections)) return false;
  if (!deepValueEqual(prev.categories, next.categories)) return false;

  return true;
};

const MemoizedBrandPage = memo(BrandPage, propsAreEqual);
MemoizedBrandPage.displayName = 'BrandPage';

export default MemoizedBrandPage;

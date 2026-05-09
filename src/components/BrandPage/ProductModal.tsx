import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageWithFallback from '../ImageWithFallback';
import { toWebp } from '../../utils/image';
import type { ProductInfo } from './types';

interface ProductModalProps {
  product: ProductInfo | null;
  onClose: () => void;
}

/**
 * Build a WhatsApp share URL for a product. Appends the product id as a URL
 * fragment so the recipient opening the link lands directly on the correct
 * modal via the BrandPage deep-link handler.
 */
const buildWhatsAppUrl = (
  productName: string,
  productDesc: string,
  pageUrl: string,
  productId?: string,
): string => {
  const desc = productDesc
    ? productDesc.slice(0, 130) + (productDesc.length > 130 ? '…' : '')
    : '';
  const base = pageUrl.split('#')[0];
  const productUrl = productId ? `${base}#${productId}` : base;
  const text = `🧹 *${productName}*${desc ? '\n' + desc : ''}\n\n🔗 ${productUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

/**
 * Product details modal — built on the native HTML5 `<dialog>` element.
 *
 * Why `<dialog>` instead of a `<div role="dialog">`:
 *   - Browser-native Escape key handling (no manual keydown listener).
 *   - Browser-native focus containment (Tab wraps inside the dialog).
 *   - ::backdrop pseudo-element for the overlay styling.
 *   - Correctly announced as a modal to screen readers without ARIA polish.
 *
 * We call `showModal()` / `close()` imperatively as the `product` prop
 * transitions between null and a value, and bridge the dialog's native
 * `close` event (fired by Escape / form method=dialog) to the `onClose`
 * callback so the parent's state stays consistent.
 */
const ProductModalComponent: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Reset gallery to the main image whenever a different product is opened.
  useEffect(() => {
    if (product) setGalleryIndex(0);
  }, [product]);

  // Open / close the native dialog imperatively in sync with the `product` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (product && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Fallback: if the browser rejects showModal (older Safari quirks),
        // degrade to the non-modal open() so content stays reachable.
        try { dialog.show(); } catch { /* noop */ }
      }
    } else if (!product && dialog.open) {
      try { dialog.close(); } catch { /* noop */ }
    }
  }, [product]);

  // Forward the dialog's native `close` event (Escape key, form method=dialog)
  // to the parent so parent-side state transitions to closed too.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  // Close when the user clicks the backdrop (the <dialog> element itself,
  // outside the inner .image-popup-content). Native dialogs don't do this
  // by default — we add it as a usability win.
  const handleDialogClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) {
        dialogRef.current?.close();
      }
    },
    [],
  );

  const handleCloseClick = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // Always render the <dialog> element so we can imperatively open it; we
  // just render a placeholder inside when there's no product. Memoised
  // render trick below keeps the contents cheap in the closed state.
  if (!product) {
    return <dialog ref={dialogRef} className="image-popup-overlay" aria-label="Product details" />;
  }

  const allPopupImages = [product.image, ...(product.gallery ?? [])];

  return (
    <dialog
      ref={dialogRef}
      className="image-popup-overlay"
      aria-label={product.name}
      onClick={handleDialogClick}
    >
      <div className="image-popup-content">
        <button
          type="button"
          className="image-popup-close"
          onClick={handleCloseClick}
          aria-label={t('brandPage.closeImage', 'Close')}
        >
          ✕
        </button>

        <div className="popup-layout">
          <div className="popup-image-section">
            <div className="popup-main-image-wrap">
              <ImageWithFallback
                src={toWebp(allPopupImages[galleryIndex])}
                fallbackSrc={allPopupImages[galleryIndex]}
                alt={product.alt}
                className="image-popup-img"
                width={900}
                height={900}
                loading="eager"
                decoding="async"
                key={allPopupImages[galleryIndex]}
              />
            </div>

            {allPopupImages.length > 1 && (
              <div className="popup-thumb-nav">
                <button
                  type="button"
                  className="popup-thumb-arrow"
                  onClick={() =>
                    setGalleryIndex((i) => (i - 1 + allPopupImages.length) % allPopupImages.length)
                  }
                  aria-label="Previous"
                >‹</button>

                <div className="popup-thumbnails">
                  {allPopupImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`popup-thumbnail${idx === galleryIndex ? ' popup-thumbnail--active' : ''}`}
                      onClick={() => setGalleryIndex(idx)}
                      aria-label={`Image ${idx + 1}`}
                    >
                      <ImageWithFallback
                        src={toWebp(img)}
                        fallbackSrc={img}
                        alt={`${product.alt} ${idx + 1}`}
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="popup-thumb-arrow"
                  onClick={() =>
                    setGalleryIndex((i) => (i + 1) % allPopupImages.length)
                  }
                  aria-label="Next"
                >›</button>
              </div>
            )}
          </div>

          <div className="popup-info-section">
            <div className="image-popup-title">{product.name}</div>
            <div className="image-popup-description">{product.description}</div>

            {product.details && (
              <div className="image-popup-details">
                {product.details.weightCountTable && product.details.weightCountTable.length > 0 ? (
                  <>
                    <div className="popup-wc-table-wrap">
                      <table className="popup-wc-table">
                        <thead>
                          <tr>
                            <th>{t('brandPage.weight')}</th>
                            <th>{t('brandPage.count')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.details.weightCountTable.map((row, idx) => (
                            <tr key={idx}>
                              <td>{row.weight}</td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {product.details.material && (
                      <div className="popup-details-grid" style={{ marginTop: '0.7rem' }}>
                        <div className="popup-detail-item">
                          <span className="popup-detail-label">{t('brandPage.material')}</span>
                          <span className="popup-detail-value">{product.details.material}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="popup-details-grid">
                    {product.details.weight && (
                      <div className="popup-detail-item">
                        <span className="popup-detail-label">{t('brandPage.weight')}</span>
                        <span className="popup-detail-value">{product.details.weight}</span>
                      </div>
                    )}
                    {product.details.material && (
                      <div className="popup-detail-item">
                        <span className="popup-detail-label">{t('brandPage.material')}</span>
                        <span className="popup-detail-value">{product.details.material}</span>
                      </div>
                    )}
                    {product.details.count && (
                      <div className="popup-detail-item">
                        <span className="popup-detail-label">{t('brandPage.count')}</span>
                        <span className="popup-detail-value">{product.details.count}</span>
                      </div>
                    )}
                  </div>
                )}

                {product.details.gift && (
                  <div className="popup-gift-section">
                    <div className="popup-gift-icon">🎁</div>
                    <div className="popup-gift-body">
                      <span className="popup-gift-label">{t('brandPage.gift')}</span>
                      <span className="popup-gift-value">{product.details.gift}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <a
              href={buildWhatsAppUrl(
                product.name,
                product.description,
                typeof window !== 'undefined' ? window.location.href : '',
                product.id,
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
    </dialog>
  );
};

const ProductModal = memo(ProductModalComponent);
ProductModal.displayName = 'ProductModal';

export default ProductModal;

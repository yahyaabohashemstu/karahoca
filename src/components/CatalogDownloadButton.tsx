import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../utils/language';
import { apiFetch } from '../utils/apiFetch';
import { trackCatalogDownload } from '../utils/analytics';

interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  details: { weight?: string; material?: string };
}

interface CatalogCategory {
  id: string;
  title: string;
  products: CatalogProduct[];
}

interface BrandData {
  brand: string;
  categories: CatalogCategory[];
}

interface CatalogPrintPayload {
  requestId: number;
  brands: BrandData[];
}

interface CatalogPrintPortalProps {
  payload: CatalogPrintPayload;
  isRtl: boolean;
  today: string;
  printSubtitle: string;
  printDateLabel: string;
  printContactLabel: string;
  printFooter: string;
}

const PRINT_RENDER_DELAY_MS = 350;
const PRINT_CLEANUP_DELAY_MS = 1500;

const CatalogPrintImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [hidden, setHidden] = useState(false);

  if (!src || hidden) {
    return null;
  }

  return (
    <img
      className="catalog-print__product-img"
      src={src}
      alt={alt}
      onError={() => setHidden(true)}
    />
  );
};

const CatalogPrintPortal: React.FC<CatalogPrintPortalProps> = ({
  payload,
  isRtl,
  today,
  printSubtitle,
  printDateLabel,
  printContactLabel,
  printFooter,
}) => {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="catalog-print-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="catalog-print__header">
        <div>
          <div style={{ fontSize: '26pt', fontWeight: 900, letterSpacing: '2px' }}>KARAHOCA</div>
          <div style={{ fontSize: '11pt', opacity: 0.8, marginTop: '4px' }}>{printSubtitle}</div>
        </div>
        <div
          style={{
            textAlign: isRtl ? 'left' : 'right',
            fontSize: '9pt',
            opacity: 0.75,
          }}
        >
          <div>{printDateLabel}: {today}</div>
          <div style={{ marginTop: '4px' }}>{printContactLabel}</div>
        </div>
      </div>

      {payload.brands.map((brand) => (
        <div key={`${payload.requestId}-${brand.brand}`} className="catalog-print__brand-section">
          <div className="catalog-print__brand-title">{brand.brand}</div>
          {brand.categories.filter((category) => category.products.length > 0).map((category) => (
            <div key={category.id} style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '12pt',
                  fontWeight: 700,
                  color: '#555',
                  marginBottom: '12px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid #e0e6ef',
                }}
              >
                {category.title}
              </div>
              <div className="catalog-print__product-grid">
                {category.products.map((product) => (
                  <div key={product.id} className="catalog-print__product-card">
                    <CatalogPrintImage src={product.image} alt={product.name} />
                    <div className="catalog-print__product-name">{product.name}</div>
                    <div className="catalog-print__product-desc">{product.description || ''}</div>
                    {product.details?.weight && (
                      <div style={{ fontSize: '7.5pt', color: '#888', marginTop: '4px' }}>
                        {'\u2696'} {product.details.weight}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="catalog-print__footer">
        <span>{printFooter}</span>
        <span>karahoca.com</span>
      </div>
    </div>,
    document.body
  );
};

const CatalogDownloadButton: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [printPayload, setPrintPayload] = useState<CatalogPrintPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const nextPrintJobIdRef = useRef(0);

  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isRtl = lang === 'ar';
  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'tr' ? 'tr-TR' : lang === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fetchBrand = async (brand: string): Promise<BrandData> => {
    const res = await apiFetch(`/api/products/${brand}?lang=${lang}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${brand}`);
    }
    return res.json() as Promise<BrandData>;
  };

  useEffect(() => {
    if (!printPayload) {
      return;
    }

    let cleanupTimerId: number | null = null;
    const clearPrintPayload = () => {
      setPrintPayload((current) => (
        current?.requestId === printPayload.requestId ? null : current
      ));
    };

    const afterPrint = () => {
      if (cleanupTimerId !== null) {
        window.clearTimeout(cleanupTimerId);
      }
      clearPrintPayload();
    };

    const printTimerId = window.setTimeout(() => {
      window.print();
      cleanupTimerId = window.setTimeout(clearPrintPayload, PRINT_CLEANUP_DELAY_MS);
    }, PRINT_RENDER_DELAY_MS);

    window.addEventListener('afterprint', afterPrint);

    return () => {
      window.clearTimeout(printTimerId);
      if (cleanupTimerId !== null) {
        window.clearTimeout(cleanupTimerId);
      }
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [printPayload]);

  const handlePrint = async () => {
    setLoading(true);
    setErrorMessage('');
    trackCatalogDownload(lang);

    try {
      const brands = await Promise.all([fetchBrand('DIOX'), fetchBrand('AYLUX')]);
      nextPrintJobIdRef.current += 1;
      setPrintPayload({
        requestId: nextPrintJobIdRef.current,
        brands,
      });
    } catch {
      setErrorMessage('Failed to load catalog data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="catalog-print-trigger"
        onClick={handlePrint}
        disabled={loading || !!printPayload}
        title={t('catalog.downloadBtn')}
      >
        {loading ? '⏳' : '📄'} {t('catalog.downloadBtn')}
      </button>

      {errorMessage && (
        <div role="status" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#dc2626' }}>
          {errorMessage}
        </div>
      )}

      {printPayload && (
        <CatalogPrintPortal
          payload={printPayload}
          isRtl={isRtl}
          today={today}
          printSubtitle={t('catalog.printSubtitle')}
          printDateLabel={t('catalog.printDate')}
          printContactLabel={t('catalog.printContact')}
          printFooter={t('catalog.printFooter')}
        />
      )}
    </>
  );
};

export default CatalogDownloadButton;

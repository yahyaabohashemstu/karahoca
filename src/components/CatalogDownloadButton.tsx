import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../utils/language';
import { buildApiUrl } from '../utils/api';
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

const CatalogDownloadButton: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isRtl = lang === 'ar';
  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'tr' ? 'tr-TR' : lang === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const fetchBrand = async (brand: string): Promise<BrandData> => {
    const res = await fetch(buildApiUrl(`/api/products/${brand}?lang=${lang}`));
    if (!res.ok) throw new Error(`Failed to fetch ${brand}`);
    return res.json() as Promise<BrandData>;
  };

  const handlePrint = useCallback(async () => {
    setLoading(true);
    trackCatalogDownload(lang);
    try {
      const [diox, aylux] = await Promise.all([fetchBrand('DIOX'), fetchBrand('AYLUX')]);

      // Build the print-page HTML inside the ref
      if (!printRef.current) return;
      const el = printRef.current;

      const brands = [diox, aylux];
      el.innerHTML = `
        <div class="catalog-print__header">
          <div>
            <div style="font-size:26pt;font-weight:900;letter-spacing:2px;">KARAHOCA</div>
            <div style="font-size:11pt;opacity:.8;margin-top:4px;">${t('catalog.printSubtitle')}</div>
          </div>
          <div style="text-align:${isRtl ? 'left' : 'right'};font-size:9pt;opacity:.75;">
            <div>${t('catalog.printDate')}: ${today}</div>
            <div style="margin-top:4px;">${t('catalog.printContact')}</div>
          </div>
        </div>

        ${brands.map(b => `
          <div class="catalog-print__brand-section">
            <div class="catalog-print__brand-title">${b.brand}</div>
            ${b.categories.filter(c => c.products.length > 0).map(cat => `
              <div style="margin-bottom:24px;">
                <div style="font-size:12pt;font-weight:700;color:#555;margin-bottom:12px;padding-bottom:4px;border-bottom:1px solid #e0e6ef;">
                  ${cat.title}
                </div>
                <div class="catalog-print__product-grid">
                  ${cat.products.map(p => `
                    <div class="catalog-print__product-card">
                      <img class="catalog-print__product-img" src="${p.image}" alt="${p.name}" onerror="this.style.display='none'" />
                      <div class="catalog-print__product-name">${p.name}</div>
                      <div class="catalog-print__product-desc">${p.description || ''}</div>
                      ${p.details?.weight ? `<div style="font-size:7.5pt;color:#888;margin-top:4px;">⚖ ${p.details.weight}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}

        <div class="catalog-print__footer">
          <span>${t('catalog.printFooter')}</span>
          <span>karahoca.com</span>
        </div>
      `;

      el.style.display = 'block';
      // Small delay for images to start loading before print dialog
      setTimeout(() => {
        window.print();
        // Hide again after print (works because print is synchronous in most browsers)
        setTimeout(() => { el.style.display = 'none'; }, 500);
      }, 300);
    } catch {
      alert('Failed to load catalog data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [lang, t, isRtl, today]);

  return (
    <>
      <button
        className="catalog-print-trigger"
        onClick={handlePrint}
        disabled={loading}
        title={t('catalog.downloadBtn')}
      >
        {loading ? '⏳' : '📄'} {t('catalog.downloadBtn')}
      </button>

      {/* Hidden print container — rendered into via innerHTML then printed */}
      <div
        ref={printRef}
        className="catalog-print-page"
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default CatalogDownloadButton;

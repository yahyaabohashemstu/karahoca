import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../hooks/useWishlist';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const WishlistPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { items, remove, clear } = useWishlist();
  const lang = (i18n.resolvedLanguage || i18n.language || 'ar').slice(0, 2);

  const labels: Record<string, { title: string; empty: string; emptyBtn: string; remove: string; clear: string }> = {
    ar: { title: 'المنتجات المفضلة', empty: 'لم تضف أي منتج للمفضلة بعد.', emptyBtn: 'تصفح المنتجات', remove: 'إزالة', clear: 'مسح الكل' },
    en: { title: 'Wishlist', empty: 'No products saved yet.', emptyBtn: 'Browse Products', remove: 'Remove', clear: 'Clear all' },
    tr: { title: 'İstek Listesi', empty: 'Henüz ürün eklenmedi.', emptyBtn: 'Ürünleri İncele', remove: 'Kaldır', clear: 'Tümünü Temizle' },
    ru: { title: 'Список желаний', empty: 'Товаров пока нет.', emptyBtn: 'Просмотреть товары', remove: 'Удалить', clear: 'Очистить всё' },
  };
  const l = labels[lang] ?? labels.en;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #0f1117)', color: 'var(--text-primary, #fff)' }}>
      <SEO title={`KARAHOCA — ${l.title}`} description={l.title} />
      <Header />
      <main style={{ flex: 1, padding: '6rem 1.5rem 3rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg,#4f6ef7,#6b84ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ♡ {l.title}
            </h1>
            {items.length > 0 && (
              <button
                onClick={clear}
                style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-secondary,#aaa)', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                {l.clear}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>♡</div>
              <p style={{ color: 'var(--text-secondary,#999)', marginBottom: '1.5rem' }}>{l.empty}</p>
              <Link
                to="/diox"
                style={{ display: 'inline-block', padding: '0.75rem 2rem', background: 'linear-gradient(135deg,#4f6ef7,#6b84ff)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}
              >
                {l.emptyBtn}
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <img src={item.image} alt={item.alt} style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 8 }} loading="lazy" />
                  </div>
                  <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.75rem', color: '#4f6ef7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{item.brand}</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{item.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary,#999)', margin: 0, flex: 1 }}>{item.description}</p>
                    {item.details && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#888)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {item.details.weight && <span>⚖️ {item.details.weight}</span>}
                        {item.details.material && <span>🧪 {item.details.material}</span>}
                        {item.details.count && <span>📦 {item.details.count}</span>}
                      </div>
                    )}
                    <button
                      onClick={() => remove(item.id)}
                      style={{ marginTop: 'auto', padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      ✕ {l.remove}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WishlistPage;

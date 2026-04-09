import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../hooks/useWishlist';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

/* ─── translations ───────────────────────────────────────────────────────── */
const L = {
  ar: {
    title: 'المنتجات المفضّلة',
    subtitle: 'المنتجات التي أثارت اهتمامك',
    empty: 'لم تضف أي منتج إلى المفضّلة بعد',
    emptyHint: 'تصفّح منتجاتنا وانقر على القلب لحفظ ما يعجبك',
    browseDiox: 'تصفّح DIOX',
    browseAylux: 'تصفّح AYLUX',
    clearAll: 'مسح الكل',
    clearConfirm: 'هل تريد مسح قائمة المفضّلة كاملاً؟',
    remove: 'إزالة',
    filterAll: 'الكل',
    saved: 'محفوظ',
    weight: 'الوزن',
    material: 'العبوة',
    count: 'العدد',
    items: (n: number) => n === 1 ? 'منتج واحد' : `${n} منتجات`,
  },
  en: {
    title: 'My Wishlist',
    subtitle: 'Products you saved for later',
    empty: 'Your wishlist is empty',
    emptyHint: 'Browse our products and tap the heart icon to save them here',
    browseDiox: 'Browse DIOX',
    browseAylux: 'Browse AYLUX',
    clearAll: 'Clear all',
    clearConfirm: 'Clear your entire wishlist?',
    remove: 'Remove',
    filterAll: 'All',
    saved: 'saved',
    weight: 'Weight',
    material: 'Packaging',
    count: 'Count',
    items: (n: number) => `${n} item${n !== 1 ? 's' : ''}`,
  },
  tr: {
    title: 'İstek Listesi',
    subtitle: 'Kaydettiğiniz ürünler',
    empty: 'İstek listeniz boş',
    emptyHint: 'Ürünlerimize göz atın ve kaydetmek istediğinize ♥ basın',
    browseDiox: 'DIOX\'u İncele',
    browseAylux: 'AYLUX\'u İncele',
    clearAll: 'Tümünü temizle',
    clearConfirm: 'Tüm istek listesi temizlensin mi?',
    remove: 'Kaldır',
    filterAll: 'Tümü',
    saved: 'kaydedildi',
    weight: 'Ağırlık',
    material: 'Ambalaj',
    count: 'Adet',
    items: (n: number) => `${n} ürün`,
  },
  ru: {
    title: 'Список желаний',
    subtitle: 'Сохранённые товары',
    empty: 'Список желаний пуст',
    emptyHint: 'Просматривайте наши товары и нажимайте ♥ для сохранения',
    browseDiox: 'Каталог DIOX',
    browseAylux: 'Каталог AYLUX',
    clearAll: 'Очистить всё',
    clearConfirm: 'Очистить список желаний?',
    remove: 'Удалить',
    filterAll: 'Все',
    saved: 'сохранено',
    weight: 'Вес',
    material: 'Упаковка',
    count: 'Количество',
    items: (n: number) => `${n} товар${n === 1 ? '' : n < 5 ? 'а' : 'ов'}`,
  },
};

/* ─── component ─────────────────────────────────────────────────────────── */
const WishlistPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { items, remove, clear } = useWishlist();
  const lang = (i18n.resolvedLanguage || i18n.language || 'ar').slice(0, 2) as keyof typeof L;
  const l = L[lang] ?? L.en;

  const [filter, setFilter] = useState<'ALL' | 'DIOX' | 'AYLUX'>('ALL');

  const displayed = filter === 'ALL' ? items : items.filter(i => i.brand === filter);
  const dioxCount  = items.filter(i => i.brand === 'DIOX').length;
  const ayluxCount = items.filter(i => i.brand === 'AYLUX').length;

  const handleClear = () => {
    if (window.confirm(l.clearConfirm)) clear();
  };

  /* ── Empty state ────────────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <div style={styles.page}>
        <SEO title={`KARAHOCA — ${l.title}`} description={l.subtitle} />
        <Header />
        <main style={styles.main}>
          <div style={styles.emptyWrap}>
            {/* animated heart */}
            <div style={styles.emptyHeart}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.35)" strokeWidth="1.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h1 style={styles.emptyTitle}>{l.empty}</h1>
            <p style={styles.emptyHint}>{l.emptyHint}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/diox" style={styles.emptyBtnDiox}>{l.browseDiox}</Link>
              <Link to="/aylux" style={styles.emptyBtnAylux}>{l.browseAylux}</Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ── Filled state ───────────────────────────────────────────────────── */
  return (
    <div style={styles.page}>
      <SEO title={`KARAHOCA — ${l.title} (${items.length})`} description={l.subtitle} />
      <Header />

      <main style={styles.main}>
        {/* ── Hero ── */}
        <div style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.heroIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <div>
              <h1 style={styles.heroTitle}>{l.title}</h1>
              <p style={styles.heroSub}>{l.items(items.length)} {l.saved}</p>
            </div>
          </div>
          <button onClick={handleClear} style={styles.clearBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
            {l.clearAll}
          </button>
        </div>

        {/* ── Brand filter ── */}
        <div style={styles.filterBar}>
          {(['ALL', 'DIOX', 'AYLUX'] as const).map(b => (
            <button
              key={b}
              onClick={() => setFilter(b)}
              style={{
                ...styles.filterBtn,
                ...(filter === b ? styles.filterBtnActive : {}),
              }}
            >
              {b === 'ALL' ? l.filterAll : b}
              <span style={{
                ...styles.filterCount,
                background: filter === b ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              }}>
                {b === 'ALL' ? items.length : b === 'DIOX' ? dioxCount : ayluxCount}
              </span>
            </button>
          ))}
        </div>

        {/* ── Grid ── */}
        {displayed.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '3rem' }}>
            {l.empty}
          </p>
        ) : (
          <div style={styles.grid}>
            {displayed.map(item => (
              <WishCard key={item.id} item={item} l={l} onRemove={() => remove(item.id)} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

/* ─── WishCard ───────────────────────────────────────────────────────────── */
interface CardProps {
  item: ReturnType<typeof useWishlist>['items'][number];
  l: typeof L['ar'];
  onRemove: () => void;
}

const WishCard: React.FC<CardProps> = ({ item, l, onRemove }) => {
  const [hovered, setHovered] = useState(false);

  const brandColor = item.brand === 'DIOX'
    ? { bg: 'rgba(79,110,247,0.12)', border: 'rgba(79,110,247,0.3)', text: '#6b84ff' }
    : { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#fb923c' };

  return (
    <div
      style={{
        ...styles.card,
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div style={styles.cardImg}>
        <img
          src={item.image}
          alt={item.alt || item.name}
          style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      </div>

      {/* Body */}
      <div style={styles.cardBody}>
        {/* Brand badge */}
        <span style={{ ...styles.brandBadge, background: brandColor.bg, border: `1px solid ${brandColor.border}`, color: brandColor.text }}>
          {item.brand}
        </span>

        {/* Name */}
        <h3 style={styles.cardName}>{item.name}</h3>

        {/* Description */}
        {item.description && (
          <p style={styles.cardDesc}>{item.description}</p>
        )}

        {/* Details */}
        {item.details && (
          <div style={styles.details}>
            {item.details.weight && (
              <span style={styles.detailChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                {item.details.weight}
              </span>
            )}
            {item.details.material && (
              <span style={styles.detailChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                {item.details.material}
              </span>
            )}
            {item.details.count && (
              <span style={styles.detailChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                {item.details.count}
              </span>
            )}
          </div>
        )}

        {/* Remove */}
        <button onClick={onRemove} style={styles.removeBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          {l.remove}
        </button>
      </div>
    </div>
  );
};

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary, #0f1117)',
    color: 'var(--text-primary, #fff)',
  },
  main: {
    flex: 1,
    padding: '7rem 1.5rem 4rem',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
  },

  /* empty */
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '55vh',
    gap: '1.25rem',
    textAlign: 'center',
  },
  emptyHeart: {
    animation: 'wishlist-empty-pulse 2.5s ease-in-out infinite',
    marginBottom: '0.5rem',
  },
  emptyTitle: {
    fontSize: 'clamp(1.4rem, 3vw, 2rem)',
    fontWeight: 700,
    margin: 0,
    color: 'rgba(255,255,255,0.85)',
  },
  emptyHint: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.45)',
    maxWidth: 400,
    margin: 0,
  },
  emptyBtnDiox: {
    padding: '0.75rem 2rem',
    background: 'linear-gradient(135deg, #4f6ef7, #6b84ff)',
    color: '#fff',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  emptyBtnAylux: {
    padding: '0.75rem 2rem',
    background: 'linear-gradient(135deg, #f97316, #fb923c)',
    color: '#fff',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
  },

  /* hero */
  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: '2rem',
    padding: '1.5rem 2rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    backdropFilter: 'blur(12px)',
  },
  heroLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
    fontWeight: 800,
    margin: 0,
    background: 'linear-gradient(135deg, #ef4444, #f97316)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    margin: '0.25rem 0 0',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.45)',
  },
  clearBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.5rem 1.25rem',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.08)',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  },

  /* filter */
  filterBar: {
    display: 'flex',
    gap: 8,
    marginBottom: '2rem',
    flexWrap: 'wrap',
  },
  filterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.5rem 1.25rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  filterBtnActive: {
    background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.2))',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#fff',
  },
  filterCount: {
    borderRadius: 999,
    padding: '1px 8px',
    fontSize: '0.75rem',
    fontWeight: 700,
    transition: 'background 0.2s',
  },

  /* grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '1.5rem',
  },

  /* card */
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    cursor: 'default',
  },
  cardImg: {
    background: 'rgba(255,255,255,0.03)',
    padding: '1.5rem 1rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 180,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  cardBody: {
    padding: '1.25rem',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  brandBadge: {
    alignSelf: 'flex-start',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  cardName: {
    fontSize: '1rem',
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.4,
    color: 'rgba(255,255,255,0.92)',
  },
  cardDesc: {
    fontSize: '0.83rem',
    color: 'rgba(255,255,255,0.45)',
    margin: 0,
    lineHeight: 1.5,
  },
  details: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  detailChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
  },
  removeBtn: {
    marginTop: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '0.55rem',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.2)',
    background: 'rgba(239,68,68,0.06)',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '0.83rem',
    fontWeight: 600,
    transition: 'all 0.2s',
    width: '100%',
  },
};

export default WishlistPage;

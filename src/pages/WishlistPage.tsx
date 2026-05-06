import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist, type WishlistItem } from '../hooks/useWishlist';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ImageWithFallback';
import { useLocalizedPath } from '../hooks/useLocalizedPath';
import { toWebp } from '../utils/image';

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
    view: 'عرض التفاصيل',
    gift: 'هدية مجانية',
    countPerBox: 'العدد / الصندوق',
    shareWa: 'مشاركة عبر واتساب',
    removeWishlist: 'إزالة من المفضّلة',
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
    view: 'View Details',
    gift: 'Free Gift',
    countPerBox: 'Per Box',
    shareWa: 'Share via WhatsApp',
    removeWishlist: 'Remove from Wishlist',
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
    view: 'Detayları Gör',
    gift: 'Ücretsiz Hediye',
    countPerBox: 'Kutu Adedi',
    shareWa: 'WhatsApp\'ta Paylaş',
    removeWishlist: 'İstek Listesinden Kaldır',
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
    view: 'Подробнее',
    gift: 'Бесплатный подарок',
    countPerBox: 'Кол-во в коробке',
    shareWa: 'Поделиться в WhatsApp',
    removeWishlist: 'Удалить из списка',
    items: (n: number) => `${n} товар${n === 1 ? '' : n < 5 ? 'а' : 'ов'}`,
  },
};

/* ─── WhatsApp share URL ─────────────────────────────────────────────────── */
function buildWaUrl(item: WishlistItem): string {
  const brandPath = item.brand === 'DIOX' ? 'diox' : 'aylux';
  const base = `${window.location.origin}/${brandPath}`;
  const productUrl = item.productDbId ? `${base}#${item.productDbId}` : base;
  const desc = item.description
    ? item.description.slice(0, 130) + (item.description.length > 130 ? '…' : '')
    : '';
  const text = `🧹 *${item.name}*${desc ? '\n' + desc : ''}\n\n🔗 ${productUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/* ─── Popup component ────────────────────────────────────────────────────── */
interface PopupProps {
  item: WishlistItem;
  l: typeof L['ar'];
  onClose: () => void;
  onRemove: () => void;
}

const WishlistPopup: React.FC<PopupProps> = ({ item, l, onClose, onRemove }) => {
  const brandColor = item.brand === 'DIOX'
    ? { bg: 'rgba(79,110,247,0.15)', border: 'rgba(79,110,247,0.35)', text: '#6b84ff' }
    : { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', text: '#fb923c' };

  const hasTable = !!(item.details?.weightCountTable && item.details.weightCountTable.length > 0);

  return (
    <div style={ps.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={ps.dialog} onClick={e => e.stopPropagation()}>

        {/* ── Close ── */}
        <button style={ps.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        {/* ── Image ── */}
        <div style={ps.imageWrap}>
          <ImageWithFallback
            src={toWebp(item.image)}
            fallbackSrc={item.image}
            alt={item.alt || item.name}
            style={ps.image}
            onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
          />
        </div>

        {/* ── Info ── */}
        <div style={ps.info}>
          {/* Brand badge */}
          <span style={{ ...ps.badge, background: brandColor.bg, border: `1px solid ${brandColor.border}`, color: brandColor.text }}>
            {item.brand}
          </span>

          {/* Name */}
          <h2 style={ps.name}>{item.name}</h2>

          {/* Description */}
          {item.description && <p style={ps.desc}>{item.description}</p>}

          {/* ── Details ── */}
          <div style={ps.detailsArea}>
            {hasTable ? (
              /* Weight-count table */
              <>
                <div style={ps.tableWrap}>
                  <table style={ps.table}>
                    <thead>
                      <tr>
                        <th style={ps.th}>{l.weight}</th>
                        <th style={ps.th}>{l.countPerBox}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.details!.weightCountTable!.map((row, i) => (
                        <tr key={i} style={i % 2 === 0 ? ps.trEven : {}}>
                          <td style={ps.td}>{row.weight}</td>
                          <td style={{ ...ps.td, ...ps.tdCount }}>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Material below table */}
                {item.details?.material && (
                  <div style={ps.detailRow}>
                    <span style={ps.detailLabel}>{l.material}</span>
                    <span style={ps.detailValue}>{item.details.material}</span>
                  </div>
                )}
              </>
            ) : (
              /* Individual detail rows */
              <>
                {item.details?.weight && (
                  <div style={ps.detailRow}>
                    <span style={ps.detailLabel}>{l.weight}</span>
                    <span style={ps.detailValue}>{item.details.weight}</span>
                  </div>
                )}
                {item.details?.material && (
                  <div style={ps.detailRow}>
                    <span style={ps.detailLabel}>{l.material}</span>
                    <span style={ps.detailValue}>{item.details.material}</span>
                  </div>
                )}
                {item.details?.count && (
                  <div style={ps.detailRow}>
                    <span style={ps.detailLabel}>{l.count}</span>
                    <span style={ps.detailValue}>{item.details.count}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Gift ── */}
          {item.details?.gift && (
            <div style={ps.giftBox}>
              <span style={ps.giftIcon}>🎁</span>
              <div>
                <div style={ps.giftLabel}>{l.gift}</div>
                <div style={ps.giftValue}>{item.details.gift}</div>
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div style={ps.actions}>
            <a
              href={buildWaUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              style={ps.shareBtn}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.526 5.845L.057 23.428a.5.5 0 0 0 .515.572l5.764-1.512A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882c-1.85 0-3.574-.497-5.063-1.362l-.363-.214-3.76.986 1.003-3.668-.236-.375A9.855 9.855 0 0 1 2.118 12c0-5.449 4.433-9.882 9.882-9.882 5.449 0 9.882 4.433 9.882 9.882 0 5.449-4.433 9.882-9.882 9.882z"/>
              </svg>
              {l.shareWa}
            </a>

            <button
              style={ps.removeBtn}
              onClick={onRemove}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              {l.removeWishlist}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── WishCard ───────────────────────────────────────────────────────────── */
interface CardProps {
  item: WishlistItem;
  l: typeof L['ar'];
  onRemove: () => void;
  onView: () => void;
}

const WishCard: React.FC<CardProps> = ({ item, l, onRemove, onView }) => {
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
      {/* Clickable image → opens popup */}
      <button
        type="button"
        style={styles.cardImgBtn}
        onClick={onView}
        aria-label={`${l.view}: ${item.name}`}
      >
        <ImageWithFallback
          src={toWebp(item.image)}
          fallbackSrc={item.image}
          alt={item.alt || item.name}
          style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      </button>

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

        {/* Detail chips (compact) */}
        {item.details && (
          <div style={styles.details}>
            {item.details.weightCountTable && item.details.weightCountTable.length > 0 ? (
              /* Show first weight as a hint */
              <span style={styles.detailChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                {item.details.weightCountTable[0].weight}
                {item.details.weightCountTable.length > 1 && ` +${item.details.weightCountTable.length - 1}`}
              </span>
            ) : (
              item.details.weight && (
                <span style={styles.detailChip}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                  {item.details.weight}
                </span>
              )
            )}
            {item.details.material && (
              <span style={styles.detailChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                {item.details.material}
              </span>
            )}
            {!item.details.weightCountTable && item.details.count && (
              <span style={styles.detailChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                {item.details.count}
              </span>
            )}
            {item.details.gift && (
              <span style={{ ...styles.detailChip, color: 'rgba(251,146,60,0.9)', borderColor: 'rgba(251,146,60,0.2)' }}>
                🎁 {item.details.gift}
              </span>
            )}
          </div>
        )}

        {/* View + Remove buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <button onClick={onView} style={styles.viewBtn}>
            {l.view}
          </button>
          <button onClick={onRemove} style={styles.removeBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            {l.remove}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Page component ─────────────────────────────────────────────────────── */
const WishlistPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { items, remove, clear } = useWishlist();
  const { lp } = useLocalizedPath();
  const lang = (i18n.resolvedLanguage || i18n.language || 'ar').slice(0, 2) as keyof typeof L;
  const l = L[lang] ?? L.en;

  const [filter, setFilter] = useState<'ALL' | 'DIOX' | 'AYLUX'>('ALL');
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);

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
        <SEO title={`KARAHOCA — ${l.title}`} description={l.subtitle} noindex />
        <Header />
        <main id="main" style={styles.main}>
          <div style={styles.emptyWrap}>
            <div style={styles.emptyHeart}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.35)" strokeWidth="1.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h1 style={styles.emptyTitle}>{l.empty}</h1>
            <p style={styles.emptyHint}>{l.emptyHint}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to={lp('/diox')} style={styles.emptyBtnDiox}>{l.browseDiox}</Link>
              <Link to={lp('/aylux')} style={styles.emptyBtnAylux}>{l.browseAylux}</Link>
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
              style={{ ...styles.filterBtn, ...(filter === b ? styles.filterBtnActive : {}) }}
            >
              {b === 'ALL' ? l.filterAll : b}
              <span style={{ ...styles.filterCount, background: filter === b ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)' }}>
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
              <WishCard
                key={item.id}
                item={item}
                l={l}
                onRemove={() => remove(item.id)}
                onView={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Popup ── */}
      {selectedItem && (
        <WishlistPopup
          item={selectedItem}
          l={l}
          onClose={() => setSelectedItem(null)}
          onRemove={() => {
            remove(selectedItem.id);
            setSelectedItem(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
};

/* ─── Card styles ────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #0f1117)', color: 'var(--text-primary, #fff)' },
  main: { flex: 1, padding: '7rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto', width: '100%' },

  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '1.25rem', textAlign: 'center' },
  emptyHeart: { animation: 'wishlist-empty-pulse 2.5s ease-in-out infinite', marginBottom: '0.5rem' },
  emptyTitle: { fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700, margin: 0, color: 'rgba(255,255,255,0.85)' },
  emptyHint: { fontSize: '1rem', color: 'rgba(255,255,255,0.45)', maxWidth: 400, margin: 0 },
  emptyBtnDiox: { padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #4f6ef7, #6b84ff)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' },
  emptyBtnAylux: { padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' },

  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: '2rem', padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, backdropFilter: 'blur(12px)' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: '1rem' },
  heroIcon: { width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroTitle: { fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #ef4444, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  heroSub: { margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)' },
  clearBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' },

  filterBar: { display: 'flex', gap: 8, marginBottom: '2rem', flexWrap: 'wrap' },
  filterBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 1.25rem', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' },
  filterBtnActive: { background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.2))', border: '1px solid rgba(239,68,68,0.4)', color: '#fff' },
  filterCount: { borderRadius: 999, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700, transition: 'background 0.2s' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' },

  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.3s ease, box-shadow 0.3s ease' },
  cardImgBtn: { background: 'rgba(255,255,255,0.03)', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180, borderBottom: '1px solid rgba(255,255,255,0.05)', border: 'none', width: '100%', cursor: 'zoom-in' },
  cardBody: { padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  brandBadge: { alignSelf: 'flex-start', padding: '2px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
  cardName: { fontSize: '1rem', fontWeight: 700, margin: 0, lineHeight: 1.4, color: 'rgba(255,255,255,0.92)' },
  cardDesc: { fontSize: '0.83rem', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 },
  details: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  detailChip: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' },
  viewBtn: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.55rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, transition: 'all 0.2s' },
  removeBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.55rem', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, transition: 'all 0.2s' },
};

/* ─── Popup styles ───────────────────────────────────────────────────────── */
const ps: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' },
  dialog: { position: 'relative', background: 'rgba(18,20,28,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'row', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' },

  closeBtn: { position: 'absolute', top: '1rem', insetInlineStart: '1rem', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, transition: 'background 0.2s' } as React.CSSProperties,

  imageWrap: { flex: '0 0 45%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', borderInlineEnd: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties,
  image: { maxWidth: '100%', maxHeight: 340, objectFit: 'contain', display: 'block' },

  info: { flex: 1, overflowY: 'auto', padding: '2rem 1.75rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' } as React.CSSProperties,

  badge: { alignSelf: 'flex-start', padding: '3px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' },
  name: { fontSize: '1.3rem', fontWeight: 800, margin: 0, lineHeight: 1.35, color: '#fff' },
  desc: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 },

  detailsArea: { display: 'flex', flexDirection: 'column', gap: 8 },

  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 },
  detailLabel: { fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500 },
  detailValue: { fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(135deg,#f54b1a,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },

  tableWrap: { borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' },
  td: { padding: '0.55rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  tdCount: { fontWeight: 700, background: 'linear-gradient(135deg,#f54b1a,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  trEven: { background: 'rgba(255,255,255,0.03)' },

  giftBox: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'linear-gradient(135deg,rgba(255,91,46,0.1),rgba(255,140,0,0.08))', border: '1px solid rgba(255,91,46,0.2)', borderRadius: 12 },
  giftIcon: { fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 },
  giftLabel: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', marginBottom: '0.1rem' },
  giftValue: { fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(90deg,#ff5b2e,#ff8c00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },

  actions: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: '0.5rem' },
  shareBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '0.7rem 1rem', borderRadius: 12, border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.07)', color: '#25D366', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', transition: 'background 0.18s' },
  removeBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.65rem 1rem', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.07)', color: '#f87171', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.2s' },
};

export default WishlistPage;

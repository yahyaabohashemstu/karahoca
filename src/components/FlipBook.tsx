import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFlipBookLoader } from '../hooks/useFlipBookLoader';
import { useIsMobile } from '../hooks/useIsMobile';
import '../styles/flipbook.css';

// Reference-safe comparator for the `imageUrls?: string[]` prop. Pages are
// stored as a flat string array in brandCatalog — a new literal with the
// same 30-ish slugs would otherwise trigger a full PDF viewer re-render
// and reset the user's zoom/pan/spread state. Element-wise compare keeps
// that state stable while still catching a genuine catalog swap.
const imageUrlsEqual = (a?: readonly string[], b?: readonly string[]) => {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

// ── Spread model ─────────────────────────────────────────────────────────────
// Desktop (book/landscape) — two pages per spread:
//   spread 0 → left = null (empty/brand),  right = pages[0]  (cover)
//   spread k → left = pages[2k-1],         right = pages[2k]
//   maxSpread = Math.floor(totalPages / 2)
//
// Mobile (portrait, screen too narrow for two facing pages) — one page per
// spread. The CSS hides `.fb-half--l` on `max-width: 768px`, so previously
// every odd page was invisible (spread N showed only `pages[2N]`, the
// `pages[2N-1]` slot was rendered but hidden, skipping half the catalog).
//
//   spread k → left = null, right = pages[k]
//   maxSpread = totalPages - 1
//
// Picking `mode: 'mobile'` here keeps the function pure (no React import)
// while still parameterising the layout. The component picks the mode
// from `useIsMobile(768)` at render time.

type FlipBookMode = 'desktop' | 'mobile';

function getSpreadPages(
  spread: number,
  total: number,
  mode: FlipBookMode = 'desktop',
): [number | null, number | null] {
  if (spread < 0 || total === 0) return [null, null];

  if (mode === 'mobile') {
    // One page per spread; left slot is always empty since the CSS hides
    // the left half on small viewports. Right slot is the page we want.
    return spread < total ? [null, spread] : [null, null];
  }

  // Desktop / wide-viewport layout — original two-page book spread.
  if (spread === 0) return [null, total > 0 ? 0 : null];
  const l = 2 * spread - 1;
  const r = 2 * spread;
  return [l < total ? l : null, r < total ? r : null];
}

// ── Pan clamping ─────────────────────────────────────────────────────────────
function clampPan(
  book: HTMLDivElement | null,
  x: number,
  y: number,
  z: number,
): [number, number] {
  if (!book || z <= 1) return [0, 0];
  const maxX = (book.offsetWidth  * (z - 1)) / 2;
  const maxY = (book.offsetHeight * (z - 1)) / 2;
  return [
    Math.max(-maxX, Math.min(maxX, x)),
    Math.max(-maxY, Math.min(maxY, y)),
  ];
}

// ── Constants ─────────────────────────────────────────────────────────────────
// FLIP_MS MUST equal the `animation-duration` on `.fb-flip--next` /
// `.fb-flip--prev` in flipbook.css. The component sets isFlipping=true,
// waits FLIP_MS, then commits the new spread and unmounts the .fb-flip
// overlay. If the CSS duration is longer than FLIP_MS the overlay
// disappears mid-flip and the page snaps; if shorter, the overlay
// lingers as a freeze-frame after the animation completes.
const FLIP_MS      = 720;
const MIN_ZOOM     = 0.5;
const MAX_ZOOM     = 3.0;
const ZOOM_STEP    = 0.15;
const AUTO_MS      = 3500;

// ── Props ─────────────────────────────────────────────────────────────────────
interface FlipBookProps {
  /** Pre-rendered image URLs (preferred — no PDF dependency) */
  imageUrls?: string[];
  /** Legacy: PDF URL (will be rendered client-side via pdfjs-dist) */
  pdfUrl?: string;
  /** Original PDF for download button (optional) */
  downloadUrl?: string;
  brandName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
const FlipBook: React.FC<FlipBookProps> = ({ imageUrls, pdfUrl, downloadUrl, brandName = '' }) => {

  // i18n — all toolbar/chrome labels resolve through the active language.
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  // ── Page data (delegated to useFlipBookLoader) ──────────────────────────────
  // All I/O — image preloading AND PDF fallback rendering — lives in the
  // hook. FlipBook itself only owns navigation/zoom/pan/render state.
  const { pages, loading, loadPct, loadErr } = useFlipBookLoader(imageUrls, pdfUrl);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [spread, setSpread]     = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipDir, setFlipDir]   = useState<'next' | 'prev'>('next');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom,       setZoom]       = useState(1);
  const [panX,       setPanX]       = useState(0);
  const [panY,       setPanY]       = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoPlay,   setAutoPlay]   = useState(false);
  const [jumpInput,  setJumpInput]  = useState('');

  // ── Refs ────────────────────────────────────────────────────────────────────
  const wrapRef       = useRef<HTMLDivElement>(null);
  const bookRef       = useRef<HTMLDivElement>(null);
  const timerRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const autoRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef  = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const panXRef       = useRef(0);
  const panYRef       = useRef(0);
  const zoomRef       = useRef(zoom);
  const canNextRef    = useRef(false);
  const flippingRef   = useRef(false);
  const goNextRef     = useRef<() => void>(() => {});

  panXRef.current     = panX;
  panYRef.current     = panY;
  zoomRef.current     = zoom;

  // ── Derived ─────────────────────────────────────────────────────────────────
  // useIsMobile re-renders on viewport crossing 768 px so the layout
  // switches live if a tablet user rotates between portrait and landscape.
  // `mode` then drives both the page-tuple math and the page-label
  // formatting below — single source of truth for "are we one-page or
  // two-page right now".
  const isMobile = useIsMobile(768);
  const mode: FlipBookMode = isMobile ? 'mobile' : 'desktop';

  const total   = pages.length;
  // maxSpr depends on the mode: on mobile each spread is one page
  // (so the last reachable spread is total-1); on desktop the cover is
  // spread 0 then pairs from spread 1 (so the last is floor(total/2)).
  const maxSpr  = total === 0 ? 0 : (mode === 'mobile' ? total - 1 : Math.floor(total / 2));
  const canNext = spread < maxSpr;
  const canPrev = spread > 0;

  canNextRef.current  = canNext;
  flippingRef.current = flipping;

  // ── Reset UI state when the source content changes ──────────────────────
  // The actual fetching is in useFlipBookLoader; we only reset the
  // navigation state here so the viewer returns to the cover when a new
  // catalog is loaded. Guarded so the reset only fires on true content
  // changes, not on every render of the hook's returned values.
  useEffect(() => {
    setSpread(0);
  }, [imageUrls, pdfUrl]);

  // Clear any lingering timer on unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (flipping || !canNext) return;
    setFlipDir('next');
    setFlipping(true);
    timerRef.current = setTimeout(() => {
      setSpread(s => s + 1);
      setFlipping(false);
    }, FLIP_MS);
  }, [flipping, canNext]);

  const goPrev = useCallback(() => {
    if (flipping || !canPrev) return;
    setFlipDir('prev');
    setFlipping(true);
    timerRef.current = setTimeout(() => {
      setSpread(s => s - 1);
      setFlipping(false);
    }, FLIP_MS);
  }, [flipping, canPrev]);

  goNextRef.current = goNext;

  // ── Zoom controls ─────────────────────────────────────────────────────────
  const zoomIn  = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2)))), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2)))), []);
  const zoomReset = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); }, []);

  useEffect(() => { setPanX(0); setPanY(0); }, [spread]);
  useEffect(() => { if (zoom === 1) { setPanX(0); setPanY(0); } }, [zoom]);

  // ── Drag-to-pan ────────────────────────────────────────────────────────────
  const startDrag = useCallback((clientX: number, clientY: number) => {
    if (zoomRef.current <= 1) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      panX: panXRef.current,
      panY: panYRef.current,
    };
  }, []);

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      const [cx, cy] = clampPan(
        bookRef.current,
        dragStartRef.current.panX + dx,
        dragStartRef.current.panY + dy,
        zoomRef.current,
      );
      setPanX(cx);
      setPanY(cy);
    };

    const onEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    const onMouseMove  = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove  = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY);

    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchmove',  onTouchMove, { passive: true });
    document.addEventListener('touchend',   onEnd);

    return () => {
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mouseup',    onEnd);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onEnd);
    };
  }, []);

  // ── Jump to page ──────────────────────────────────────────────────────────
  // Mobile: page N (1-indexed) lives on spread N-1 (one page per spread).
  // Desktop: page 1 = cover on spread 0; pages 2/3 on spread 1; 4/5 on
  //          spread 2; i.e. spread = floor(N/2) when N >= 2.
  const doJump = useCallback(() => {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1 || n > total) return;
    const target = mode === 'mobile'
      ? n - 1
      : (n <= 1 ? 0 : Math.floor(n / 2));
    setSpread(Math.min(Math.max(0, target), maxSpr));
    setJumpInput('');
  }, [jumpInput, total, maxSpr, mode]);

  // ── Auto-play slideshow ───────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlay) {
      if (autoRef.current) clearInterval(autoRef.current);
      return;
    }
    autoRef.current = setInterval(() => {
      if (flippingRef.current) return;
      if (canNextRef.current) goNextRef.current();
      else setAutoPlay(false);
    }, AUTO_MS);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoPlay]);

  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current); }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if      (e.key === 'ArrowRight' || e.key === 'PageDown') goNext();
      else if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   goPrev();
      else if (e.key === 'Escape' && fullscreen) setFullscreen(false);
      else if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      else if (e.ctrlKey && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomOut(); }
      else if (e.ctrlKey &&  e.key === '0')                   { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, fullscreen, zoomIn, zoomOut, zoomReset]);

  // ── Fullscreen ──────────────────────────────────────────────────────────
  // Only react to EXIT events from the browser (Escape key, browser UI).
  // Entering is owned by `toggleFS` below — we set state first so the
  // portal can move the viewer to <body>, THEN call requestFullscreen on
  // the now-stable element. Listening for both directions caused a feedback
  // loop where setting state moved the element, the move broke fullscreen,
  // and fullscreenchange flipped state back to false.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFS = useCallback(() => {
    if (!fullscreen) {
      // STEP 1: enter CSS-fullscreen FIRST. `flushSync` forces React to
      // commit synchronously so the portal mounts the viewer onto <body>
      // BEFORE we hand the (now-stable) element to `requestFullscreen`.
      // Without this order the previous parent moved the element AFTER
      // requestFullscreen succeeded — the browser saw the fullscreen
      // element being detached from its container and immediately
      // exited fullscreen, which fired fullscreenchange and bounced the
      // state back to false. (User-visible symptom: tap → flash of FS →
      // exit). Doing the portal first keeps the element identity stable
      // for the entire requestFullscreen lifecycle.
      flushSync(() => setFullscreen(true));

      // STEP 2: ask for true browser fullscreen on the now-portal-mounted
      // element. Succeeds on desktop / Android Chrome; fails (no API) on
      // iOS Safari, where the CSS-fullscreen we just enabled is already
      // covering the viewport. We swallow the rejection silently — the
      // user still gets a full-viewport viewer either way.
      const el = wrapRef.current;
      const req = el?.requestFullscreen?.();
      if (req && typeof (req as Promise<void>).catch === 'function') {
        (req as Promise<void>).catch(() => {});
      }
    } else {
      // EXIT: prefer the browser's native exit so the fullscreenchange
      // listener above can drive the state cleanly. If we're in
      // CSS-only fullscreen (iOS / failed requestFullscreen), no native
      // fullscreenElement exists, so close the portal directly.
      if (document.fullscreenElement) {
        const exit = document.exitFullscreen?.();
        if (exit && typeof (exit as Promise<void>).catch === 'function') {
          (exit as Promise<void>).catch(() => setFullscreen(false));
        }
      } else {
        setFullscreen(false);
      }
    }
  }, [fullscreen]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pg = (idx: number | null) =>
    idx !== null && idx < pages.length ? pages[idx] : null;

  const [cL, cR] = getSpreadPages(spread,     total, mode);
  const [nL, nR] = getSpreadPages(spread + 1, total, mode);
  const [pL, pR] = getSpreadPages(spread - 1, total, mode);

  const isFlippingNext = flipping && flipDir === 'next';
  const isFlippingPrev = flipping && flipDir === 'prev';

  const PageImg = ({ idx }: { idx: number | null }) =>
    pg(idx) ? (
      <img
        src={pg(idx)!}
        alt={`Catalog page ${(idx ?? 0) + 1}`}
        className="fb-pg-img"
        decoding="async"
        draggable={false}
      />
    ) : (
      <div className="fb-pg-blank">
        {idx === null && brandName && (
          <span className="fb-blank-brand">{brandName}</span>
        )}
      </div>
    );

  const pageLabel = (() => {
    if (!total) return '';
    if (mode === 'mobile') {
      // One-page-per-spread: spread N → page N+1 (1-indexed for display).
      if (spread === 0) return `${t('flipbook.coverLabel')} — ${total} ${t('flipbook.pagesUnit')}`;
      return `${spread + 1} / ${total}`;
    }
    // Two-page desktop spread.
    if (spread === 0) return `${t('flipbook.coverLabel')} — ${total} ${t('flipbook.pagesUnit')}`;
    const lo = 2 * spread;
    const hi = Math.min(lo + 1, total - 1);
    return lo === hi ? `${lo + 1} / ${total}` : `${lo + 1}–${hi + 1} / ${total}`;
  })();

  const bookTransform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const bookCursor    = zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : undefined;
  const bookTouchAction = zoom > 1 ? 'none' : undefined;

  // Resolve download URL: explicit prop > pdfUrl > null
  const dlUrl = downloadUrl || pdfUrl || null;

  // ── Render ───────────────────────────────────────────────────────────────
  // When `fullscreen` is true we render the viewer through a portal mounted
  // on `document.body`. This is essential because two ancestors create a
  // containing block that traps `position: fixed` inside their box:
  //
  //   .bfb-frame-wrap → has `will-change: opacity, transform`
  //                     (inherited from `.fx-reveal` reveal animation)
  //   .bfb-section    → has `backdrop-filter: blur(10px)`
  //
  // Per CSS spec, any of `transform`, `filter`, `backdrop-filter`,
  // `perspective`, `contain: paint/layout`, or `will-change: transform/
  // opacity/filter` makes that ancestor the containing block for any
  // descendant `position: fixed` — so `inset: 0` resolves to the
  // ancestor's box (which here was 375 × 0px), not the viewport.
  //
  // On desktop the native `requestFullscreen()` succeeds and lifts the
  // element out of the DOM flow, so the bug was invisible. On mobile
  // (especially iOS Safari, where Element.requestFullscreen is not
  // supported) the catch-fallback set `fullscreen=true` and added
  // `.fb--fs`, but the CSS could not escape the containing block —
  // so tapping fullscreen looked like nothing happened.
  //
  // Portal-mounting bypasses ALL ancestor containing blocks because
  // `<body>` is the new parent in the DOM, regardless of where the
  // component appears in the React tree.
  const viewer = (
    <div ref={wrapRef} className={`fb${fullscreen ? ' fb--fs' : ''}`}>

      {/* ── Top chrome bar ─────────────────────────────────────────────── */}
      <div className="fb-chrome">
        <div className="fb-chrome__dots"><span /><span /><span /></div>
        <span className="fb-chrome__title">📖 {brandName} — {t('flipbook.chromeTitle')}</span>
        <button className="fb-chrome__btn" onClick={toggleFS} aria-label={fullscreen ? t('flipbook.close') : t('flipbook.fullscreen')}>
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      {!loading && !loadErr && (
        <div className="fb-toolbar" dir={isRtl ? 'rtl' : 'ltr'}>

          {/* Group 1 — Zoom */}
          <div className="fb-tg">
            <button className="fb-tbtn" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} title={t('flipbook.zoomOutTitle')} aria-label={t('flipbook.zoomOut')}>−</button>
            <button className="fb-tbtn fb-tbtn--zoom-val" onClick={zoomReset} title={t('flipbook.zoomReset')}>
              {Math.round(zoom * 100)}%
            </button>
            <button className="fb-tbtn" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} title={t('flipbook.zoomInTitle')} aria-label={t('flipbook.zoomIn')}>+</button>
            <span className="fb-tg-label">{t('flipbook.zoomLabel')}</span>
          </div>

          <div className="fb-tsep" />

          {/* Group 2 — Jump to page */}
          <div className="fb-tg">
            <span className="fb-tg-label">{t('flipbook.jumpLabel')}</span>
            <input
              className="fb-tinput"
              type="number"
              min={1}
              max={total}
              value={jumpInput}
              placeholder={t('flipbook.jumpPlaceholder')}
              aria-label={t('flipbook.jumpAriaLabel')}
              onChange={e => setJumpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doJump()}
            />
            <button className="fb-tbtn fb-tbtn--go" onClick={doJump} aria-label={t('flipbook.jumpGo')}>↵</button>
          </div>

          <div className="fb-tsep" />

          {/* Group 3 — Auto-play */}
          <div className="fb-tg">
            <button
              className={`fb-tbtn fb-tbtn--auto${autoPlay ? ' fb-tbtn--active' : ''}`}
              onClick={() => setAutoPlay(a => !a)}
              title={autoPlay ? t('flipbook.autoStopTitle') : t('flipbook.autoPlayTitle')}
              aria-label={autoPlay ? t('flipbook.autoStop') : t('flipbook.autoPlayTitle')}
            >
              {autoPlay
                ? <><span className="fb-tbtn__icon">⏹</span> {t('flipbook.autoStop')}</>
                : <><span className="fb-tbtn__icon">▶</span> {t('flipbook.autoPlay')}</>}
            </button>
          </div>

          {dlUrl && (
            <>
              <div className="fb-tsep" />
              {/* Group 4 — Download & Print */}
              <div className="fb-tg">
                <a
                  className="fb-tbtn fb-tbtn--dl"
                  href={dlUrl}
                  download={`${brandName || 'catalog'}-katalog.pdf`}
                  title={t('flipbook.downloadTitle')}
                >
                  <span className="fb-tbtn__icon">⬇</span> {t('flipbook.download')}
                </a>
                <button
                  className="fb-tbtn"
                  onClick={() => window.open(dlUrl, '_blank')}
                  title={t('flipbook.printTitle')}
                >
                  <span className="fb-tbtn__icon">🖨</span> {t('flipbook.print')}
                </button>
              </div>
            </>
          )}

        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="fb-loading">
          <div className="fb-loading__ring" />
          <p>{t('flipbook.loading')} {loadPct}%</p>
          <div className="fb-loading__track">
            <div className="fb-loading__fill" style={{ width: `${loadPct}%` }} />
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {loadErr && <div className="fb-error">{t('flipbook.errorPrefix')} {loadErr}</div>}

      {/* ── Book ────────────────────────────────────────────────────────── */}
      {!loading && !loadErr && (
        <div className="fb-scene">

          <button
            className={`fb-nav fb-nav--l${!canPrev || flipping ? ' fb-nav--off' : ''}`}
            onClick={goPrev}
            disabled={!canPrev || flipping}
            aria-label={t('flipbook.prevPage')}
          >‹</button>

          <div
            ref={bookRef}
            className="fb-book"
            style={{
              transform: bookTransform,
              transformOrigin: 'center center',
              cursor: bookCursor,
              touchAction: bookTouchAction,
            }}
            onMouseDown={e => {
              if (zoom <= 1) return;
              e.preventDefault();
              startDrag(e.clientX, e.clientY);
            }}
            onTouchStart={e => {
              if (zoom <= 1) return;
              startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
          >
            <div className={`fb-half fb-half--l${isFlippingPrev ? ' fb-half--under' : ''}`}>
              <PageImg idx={isFlippingPrev ? pL : cL} />
              <div className="fb-pgshad fb-pgshad--r" />
            </div>

            <div className={`fb-half fb-half--r${isFlippingNext ? ' fb-half--under' : ''}`}>
              <PageImg idx={isFlippingNext ? nR : cR} />
              <div className="fb-pgshad fb-pgshad--l" />
            </div>

            {isFlippingNext && (
              <div className="fb-flip fb-flip--next">
                <div className="fb-face fb-face--front"><PageImg idx={cR} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={nL} /></div>
                <div className="fb-flip-grad" />
              </div>
            )}

            {isFlippingPrev && (
              <div className="fb-flip fb-flip--prev">
                <div className="fb-face fb-face--front"><PageImg idx={cL} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={pR} /></div>
                <div className="fb-flip-grad" />
              </div>
            )}

            <div className="fb-spine" />
          </div>

          <button
            className={`fb-nav fb-nav--r${!canNext || flipping ? ' fb-nav--off' : ''}`}
            onClick={goNext}
            disabled={!canNext || flipping}
            aria-label={t('flipbook.nextPage')}
          >›</button>

        </div>
      )}

      {/* ── Bottom controls bar ─────────────────────────────────────────── */}
      {!loading && !loadErr && (
        <div className="fb-bar">
          <span className="fb-bar__label">{pageLabel}</span>
          <div className="fb-bar__dots">
            {Array.from({ length: maxSpr + 1 }, (_, i) => (
              <button
                key={i}
                className={`fb-dot${i === spread ? ' fb-dot--on' : ''}`}
                onClick={() => { if (!flipping) setSpread(i); }}
                aria-label={`${t('flipbook.jumpToAria')} ${i === 0 ? t('flipbook.cover') : `${t('flipbook.page')} ${i * 2}`}`}
              />
            ))}
          </div>
          <button className="fb-bar__fs" onClick={toggleFS}>
            {fullscreen ? `⊡ ${t('flipbook.close')}` : `⛶ ${t('flipbook.fullscreen')}`}
          </button>
        </div>
      )}

    </div>
  );

  // In fullscreen, mount through a portal directly on `<body>` so the
  // viewer escapes any ancestor containing block that would otherwise
  // trap `position: fixed`. Inline mode keeps the original DOM position
  // so React's reconciliation, refs and event handlers stay intact.
  return fullscreen && typeof document !== 'undefined'
    ? createPortal(viewer, document.body)
    : viewer;
};

/**
 * Custom `areEqual` comparator for React.memo.
 *
 * Skips re-render when the parent re-renders with the SAME viewer content.
 * Scalar props use Object.is; `imageUrls` uses element-wise compare.
 * Critical for preserving the user's zoom/pan/spread state across parent
 * re-renders (language toggles, wishlist changes, etc.).
 */
const flipBookPropsAreEqual = (prev: FlipBookProps, next: FlipBookProps): boolean => {
  if (prev.pdfUrl !== next.pdfUrl) return false;
  if (prev.downloadUrl !== next.downloadUrl) return false;
  if (prev.brandName !== next.brandName) return false;
  return imageUrlsEqual(prev.imageUrls, next.imageUrls);
};

const MemoizedFlipBook = memo(FlipBook, flipBookPropsAreEqual);
MemoizedFlipBook.displayName = 'FlipBook';

export default MemoizedFlipBook;

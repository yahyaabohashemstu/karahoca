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

// ── Drag-to-flip tuning ───────────────────────────────────────────────────────
// DRAG_FLIP_THRESHOLD: minimum horizontal travel (px) before a pointer-down
//   is interpreted as a page-turn drag, not a stray click or vertical scroll.
// DRAG_FLIP_VERT_RATIO: if |dy| > |dx| * this, the user is scrolling, not
//   flipping — abort the gesture so the page scroll still works.
// DRAG_FLIP_COMMIT: progress threshold on release. ≥ this snaps forward to
//   complete the flip; below it snaps back to the original spread.
// DRAG_RELEASE_MS: duration of the snap animation after the user lets go.
//   Kept short so commit/abort feels responsive but not jarring.
const DRAG_FLIP_THRESHOLD = 10;
const DRAG_FLIP_VERT_RATIO = 1.5;
const DRAG_FLIP_COMMIT = 0.5;
const DRAG_RELEASE_MS = 260;
const DRAG_RELEASE_EASING = 'cubic-bezier(0.45, 0.10, 0.55, 0.95)';

// State of an in-progress page-turn drag.
// `progress` is normalized 0 → 1 along the rotation arc:
//   • 0   = page sits flat in its starting half
//   • 0.5 = page is perpendicular to the book (90° world rotation)
//   • 1   = page lies flat in the destination half (180° world rotation)
// `releasing` is true while we're animating the snap-back / snap-forward
// triggered by the user lifting their pointer. While releasing, the CSS
// transform transitions toward progress 0 or 1; the user can no longer
// drive `progress` directly.
type DragFlipState = {
  dir: 'next' | 'prev';
  progress: number;
  releasing: boolean;
};

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
  // Page-turn drag — when non-null, the user is mid-grab and rotating a
  // page. Coexists with the button-triggered `flipping` state but the two
  // are mutually exclusive (the pointer-down handler refuses to start a
  // drag while `flipping`, and the button/keyboard handlers refuse to fire
  // while `dragFlip` is set).
  const [dragFlip,   setDragFlip]   = useState<DragFlipState | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const wrapRef       = useRef<HTMLDivElement>(null);
  const bookRef       = useRef<HTMLDivElement>(null);
  const timerRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const autoRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  // Snap-back / snap-forward timer fired on pointer-up. Kept in a ref so a
  // rapid second drag can cancel an in-flight release cleanly.
  const dragReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef  = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const panXRef       = useRef(0);
  const panYRef       = useRef(0);
  const zoomRef       = useRef(zoom);
  const canNextRef    = useRef(false);
  const canPrevRef    = useRef(false);
  const maxSprRef     = useRef(0);
  const flippingRef   = useRef(false);
  const goNextRef     = useRef<() => void>(() => {});
  // Live mirror of dragFlip state — read inside DOM event listeners
  // (which are registered once and would otherwise close over stale state).
  const dragFlipRef   = useRef<DragFlipState | null>(null);
  // Where the pointer landed and which direction the drag is intended for.
  // `engaged` flips to true after the pointer crosses DRAG_FLIP_THRESHOLD
  // in the correct horizontal direction — only then do we start rendering
  // the flip overlay. Before that, the gesture is still ambiguous (could
  // be a click, a vertical scroll, or a flip in the wrong direction).
  const flipDragStartRef = useRef<{
    x: number;
    y: number;
    dir: 'next' | 'prev' | null;
    engaged: boolean;
  }>({ x: 0, y: 0, dir: null, engaged: false });

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
  canPrevRef.current  = canPrev;
  maxSprRef.current   = maxSpr;
  flippingRef.current = flipping;
  dragFlipRef.current = dragFlip;

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
  // Refuses while either form of flip is active: the button-triggered CSS
  // animation (`flipping`) AND the user-driven page-turn drag (`dragFlip`).
  // Without the second guard, a keyboard arrow during a drag would commit a
  // second flip on top of the in-progress one and corrupt the spread state.
  const goNext = useCallback(() => {
    if (flipping || dragFlip || !canNext) return;
    setFlipDir('next');
    setFlipping(true);
    timerRef.current = setTimeout(() => {
      setSpread(s => s + 1);
      setFlipping(false);
    }, FLIP_MS);
  }, [flipping, dragFlip, canNext]);

  const goPrev = useCallback(() => {
    if (flipping || dragFlip || !canPrev) return;
    setFlipDir('prev');
    setFlipping(true);
    timerRef.current = setTimeout(() => {
      setSpread(s => s - 1);
      setFlipping(false);
    }, FLIP_MS);
  }, [flipping, dragFlip, canPrev]);

  goNextRef.current = goNext;

  // ── Zoom controls ─────────────────────────────────────────────────────────
  const zoomIn  = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2)))), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2)))), []);
  const zoomReset = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); }, []);

  useEffect(() => { setPanX(0); setPanY(0); }, [spread]);
  useEffect(() => { if (zoom === 1) { setPanX(0); setPanY(0); } }, [zoom]);

  // ── Drag-to-pan (zoomed view) ──────────────────────────────────────────────
  // Activated only when zoom > 1: clicking on a zoomed-in page should pan
  // the view, not start a page-turn drag. The page-turn gesture below owns
  // the pointer-down handler when zoom === 1.
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

  // ── Drag-to-flip (page-turn gesture) ───────────────────────────────────────
  // Records the pointer-down origin and probable direction, but does NOT
  // commit to a flip yet. The actual engagement happens in the move handler
  // once we know whether the user is dragging horizontally in the correct
  // direction (and not just clicking or scrolling vertically).
  //
  // Decision matrix:
  //   pointer down on right half + canNext  → potential NEXT flip
  //   pointer down on left  half + canPrev  → potential PREV flip
  //   anything else                          → ignored (click falls through)
  //
  // Refuses while a button-triggered animation OR a previous release is
  // still in flight so we never have two flips queued on top of each
  // other. Also no-ops on zoomed views — pan owns that case.
  const tryStartPageDrag = useCallback((clientX: number, clientY: number) => {
    if (zoomRef.current > 1) return;
    if (flippingRef.current) return;
    if (dragFlipRef.current?.releasing) return;

    const book = bookRef.current;
    if (!book) return;

    const rect = book.getBoundingClientRect();
    const relX = clientX - rect.left;
    const onRightHalf = relX > rect.width / 2;

    let dir: 'next' | 'prev' | null = null;
    if (onRightHalf && canNextRef.current) dir = 'next';
    else if (!onRightHalf && canPrevRef.current) dir = 'prev';

    if (!dir) return;

    flipDragStartRef.current = {
      x: clientX,
      y: clientY,
      dir,
      engaged: false,
    };
  }, []);

  // Snap-back or snap-forward animation after the user releases mid-drag.
  // Called from the pointer-up handler with the final progress; threshold
  // logic decides which direction to snap.
  const releaseDragFlip = useCallback(() => {
    const drag = dragFlipRef.current;
    if (!drag || drag.releasing) return;

    const commit = drag.progress >= DRAG_FLIP_COMMIT;
    const released: DragFlipState = {
      dir: drag.dir,
      progress: commit ? 1 : 0,
      releasing: true,
    };
    dragFlipRef.current = released;
    setDragFlip(released);

    if (dragReleaseTimerRef.current) clearTimeout(dragReleaseTimerRef.current);
    dragReleaseTimerRef.current = setTimeout(() => {
      if (commit) {
        if (drag.dir === 'next') {
          setSpread(s => Math.min(s + 1, maxSprRef.current));
        } else {
          setSpread(s => Math.max(s - 1, 0));
        }
      }
      dragFlipRef.current = null;
      setDragFlip(null);
      dragReleaseTimerRef.current = null;
    }, DRAG_RELEASE_MS);
  }, []);

  // Cleanup any in-flight release timer on unmount so we don't try to
  // setState on an unmounted component.
  useEffect(() => () => {
    if (dragReleaseTimerRef.current) clearTimeout(dragReleaseTimerRef.current);
  }, []);

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      // Pan mode owns the gesture if it was started on a zoomed view.
      if (isDraggingRef.current) {
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
        return;
      }

      // Page-turn drag — handled per-direction.
      const start = flipDragStartRef.current;
      if (!start.dir) return;
      // While a snap animation is running, don't let new moves re-engage
      // — the release is committed and we wait for the timer to clear it.
      if (dragFlipRef.current?.releasing) return;

      const dx = clientX - start.x;
      const dy = clientY - start.y;

      if (!start.engaged) {
        // Three reasons to drop the gesture before we ever render anything:
        //   1. Not enough horizontal travel yet — could still be a click.
        //   2. Vertical travel dominates — the user is scrolling the page.
        //   3. Horizontal travel is in the wrong direction for the side
        //      they grabbed (e.g. grabbed right half but dragging right).
        if (Math.abs(dx) < DRAG_FLIP_THRESHOLD) return;
        if (Math.abs(dy) > Math.abs(dx) * DRAG_FLIP_VERT_RATIO) {
          flipDragStartRef.current = { x: 0, y: 0, dir: null, engaged: false };
          return;
        }
        if (start.dir === 'next' && dx > 0) {
          flipDragStartRef.current = { x: 0, y: 0, dir: null, engaged: false };
          return;
        }
        if (start.dir === 'prev' && dx < 0) {
          flipDragStartRef.current = { x: 0, y: 0, dir: null, engaged: false };
          return;
        }
        start.engaged = true;
      }

      const book = bookRef.current;
      if (!book) return;
      const pageWidth = book.getBoundingClientRect().width / 2;
      if (pageWidth <= 0) return;

      // Progress is normalised so 0 = at-rest and 1 = fully flipped.
      // For NEXT, drag-left is negative dx → flip is `-dx / pageWidth`.
      // For PREV, drag-right is positive dx → flip is `dx / pageWidth`.
      // Clamped to [0, 1] so dragging past the spine doesn't oversteer.
      let progress: number;
      if (start.dir === 'next') {
        progress = -dx / pageWidth;
      } else {
        progress = dx / pageWidth;
      }
      progress = Math.max(0, Math.min(1, progress));

      const next: DragFlipState = { dir: start.dir, progress, releasing: false };
      dragFlipRef.current = next;
      setDragFlip(next);
    };

    const onEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }
      const start = flipDragStartRef.current;
      flipDragStartRef.current = { x: 0, y: 0, dir: null, engaged: false };
      // Nothing engaged = nothing to release (click without drag).
      if (!start.engaged) return;
      releaseDragFlip();
    };

    const onMouseMove  = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove  = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY);

    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchmove',  onTouchMove, { passive: true });
    document.addEventListener('touchend',   onEnd);
    document.addEventListener('touchcancel', onEnd);

    return () => {
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mouseup',    onEnd);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [releaseDragFlip]);

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
      if (flippingRef.current || dragFlipRef.current) return;
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
  // Cursor cue: zoomed view = pan grab/grabbing; otherwise we suggest the
  // page is grabbable for flipping (only on potentially-navigable spreads).
  const bookCursor = zoom > 1
    ? (isDragging ? 'grabbing' : 'grab')
    : (dragFlip?.releasing
        ? undefined
        : (dragFlip
            ? 'grabbing'
            : ((canNext || canPrev) ? 'grab' : undefined)));
  // touch-action policy:
  //   zoomed view  → 'none'  (we own pan, browser must not scroll/zoom)
  //   normal view  → 'pan-y' (allow vertical page scroll, claim the
  //                          horizontal axis for our page-turn drag)
  // Without 'pan-y' on touch screens, a horizontal swipe inside the book
  // gets consumed by the browser's horizontal-overscroll behaviour and
  // never reaches our touchmove listener.
  const bookTouchAction = zoom > 1 ? 'none' : 'pan-y';

  // Combined visibility — render the flip overlay when either a CSS
  // animation OR a manual drag has it active. The same boolean drives
  // the halves' --under z-index swap so the destination half is exposed
  // underneath while the flipping page rotates over it.
  const showFlipNext = isFlippingNext || dragFlip?.dir === 'next';
  const showFlipPrev = isFlippingPrev || dragFlip?.dir === 'prev';

  // Inline transform that takes over from the CSS keyframe animation
  // while the user is dragging. `animation: none` removes the keyframe
  // rule's authority; the manual `transform: rotateY(...)` then drives
  // the page directly. While `releasing` we restore a CSS transition so
  // the snap eases instead of teleporting.
  const dragFlipInlineStyle = (forDir: 'next' | 'prev'): React.CSSProperties | undefined => {
    if (!dragFlip || dragFlip.dir !== forDir) return undefined;
    const rot = dragFlip.dir === 'next'
      ? -180 * dragFlip.progress
      :  180 * dragFlip.progress;
    return {
      animation: 'none',
      transform: `rotateY(${rot}deg)`,
      WebkitTransform: `rotateY(${rot}deg)`,
      transition: dragFlip.releasing
        ? `transform ${DRAG_RELEASE_MS}ms ${DRAG_RELEASE_EASING}`
        : 'none',
    };
  };

  // Mid-flip surface darkening on the gradient overlay, mirroring the
  // sin-shaped pulse from the keyframe animation but driven by the drag
  // progress. 4·p·(1−p) is a smooth parabola peaking at 1 when p=0.5.
  // While not dragging this returns undefined so the keyframe animation
  // remains in charge.
  const dragGradInlineStyle: React.CSSProperties | undefined = dragFlip
    ? {
        animation: 'none',
        opacity: 4 * dragFlip.progress * (1 - dragFlip.progress),
      }
    : undefined;

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
            className={`fb-nav fb-nav--l${!canPrev || flipping || dragFlip ? ' fb-nav--off' : ''}`}
            onClick={goPrev}
            disabled={!canPrev || flipping || !!dragFlip}
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
              if (zoom > 1) {
                // Zoom > 1 → pan mode. preventDefault to suppress the
                // browser's drag-image behaviour on the underlying <img>.
                e.preventDefault();
                startDrag(e.clientX, e.clientY);
                return;
              }
              // Normal view → potential page-turn drag. Do NOT preventDefault
              // here so clicks on inner controls (none today, but future-
              // proofed) still bubble; the move handler decides whether
              // to engage based on travel distance & direction.
              tryStartPageDrag(e.clientX, e.clientY);
            }}
            onTouchStart={e => {
              if (zoom > 1) {
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
                return;
              }
              tryStartPageDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
          >
            <div className={`fb-half fb-half--l${showFlipPrev ? ' fb-half--under' : ''}`}>
              <PageImg idx={showFlipPrev ? pL : cL} />
              <div className="fb-pgshad fb-pgshad--r" />
            </div>

            <div className={`fb-half fb-half--r${showFlipNext ? ' fb-half--under' : ''}`}>
              <PageImg idx={showFlipNext ? nR : cR} />
              <div className="fb-pgshad fb-pgshad--l" />
            </div>

            {showFlipNext && (
              <div
                className={`fb-flip fb-flip--next${dragFlip?.dir === 'next' ? ' fb-flip--dragging' : ''}`}
                style={dragFlipInlineStyle('next')}
              >
                <div className="fb-face fb-face--front"><PageImg idx={cR} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={nL} /></div>
                <div className="fb-flip-grad" style={dragGradInlineStyle} />
              </div>
            )}

            {showFlipPrev && (
              <div
                className={`fb-flip fb-flip--prev${dragFlip?.dir === 'prev' ? ' fb-flip--dragging' : ''}`}
                style={dragFlipInlineStyle('prev')}
              >
                <div className="fb-face fb-face--front"><PageImg idx={cL} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={pR} /></div>
                <div className="fb-flip-grad" style={dragGradInlineStyle} />
              </div>
            )}

            <div className="fb-spine" />
          </div>

          <button
            className={`fb-nav fb-nav--r${!canNext || flipping || dragFlip ? ' fb-nav--off' : ''}`}
            onClick={goNext}
            disabled={!canNext || flipping || !!dragFlip}
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

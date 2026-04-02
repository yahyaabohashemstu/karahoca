import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/flipbook.css';

// ── Spread model ─────────────────────────────────────────────────────────────
// All page indices are 0-based. PDF pages are rendered in order 0…n-1.
//
// spread 0 → left = null (empty/brand),  right = pages[0]  (cover)
// spread k → left = pages[2k-1],         right = pages[2k]
// maxSpread = Math.floor(totalPages / 2)

function getSpreadPages(
  spread: number,
  total: number,
): [number | null, number | null] {
  if (spread < 0 || total === 0) return [null, null];
  if (spread === 0) return [null, total > 0 ? 0 : null];
  const l = 2 * spread - 1;
  const r = 2 * spread;
  return [l < total ? l : null, r < total ? r : null];
}

// ── Pan clamping (pure function, outside component) ───────────────────────────
// Constrains the pan offset so the user cannot drag the book outside its
// zoomed bounds. offsetWidth/Height give layout size (pre-transform).
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
const RENDER_SCALE = 1.5;
const FLIP_MS      = 620;
const MIN_ZOOM     = 0.5;
const MAX_ZOOM     = 2.0;
const ZOOM_STEP    = 0.15;
const AUTO_MS      = 3500;

// ── Props ─────────────────────────────────────────────────────────────────────
interface FlipBookProps {
  pdfUrl: string;
  brandName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
const FlipBook: React.FC<FlipBookProps> = ({ pdfUrl, brandName = '' }) => {

  // ── Page data ───────────────────────────────────────────────────────────────
  const [pages, setPages]   = useState<string[]>([]);
  const [loadPct, setLoadPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [spread, setSpread]     = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipDir, setFlipDir]   = useState<'next' | 'prev'>('next');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom,       setZoom]       = useState(1);
  const [panX,       setPanX]       = useState(0);
  const [panY,       setPanY]       = useState(0);
  const [isDragging, setIsDragging] = useState(false);   // for cursor only
  const [autoPlay,   setAutoPlay]   = useState(false);
  const [jumpInput,  setJumpInput]  = useState('');

  // ── Refs ────────────────────────────────────────────────────────────────────
  const wrapRef       = useRef<HTMLDivElement>(null);
  const bookRef       = useRef<HTMLDivElement>(null);
  const timerRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const autoRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs used inside global event listeners (stale-closure-safe)
  const isDraggingRef = useRef(false);
  const dragStartRef  = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const panXRef       = useRef(0);
  const panYRef       = useRef(0);
  const zoomRef       = useRef(zoom);
  const canNextRef    = useRef(false);
  const flippingRef   = useRef(false);
  const goNextRef     = useRef<() => void>(() => {});

  // Keep live refs in sync
  panXRef.current     = panX;
  panYRef.current     = panY;
  zoomRef.current     = zoom;

  // ── Derived ─────────────────────────────────────────────────────────────────
  const total   = pages.length;
  const maxSpr  = Math.floor(total / 2);
  const canNext = spread < maxSpr;
  const canPrev = spread > 0;

  canNextRef.current  = canNext;
  flippingRef.current = flipping;

  // ── PDF loading & rendering ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    setPages([]);
    setLoadPct(0);
    setSpread(0);

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;

        const n = pdf.numPages;
        const rendered: string[] = [];

        for (let i = 1; i <= n; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const vp   = page.getViewport({ scale: RENDER_SCALE });
          const cvs  = document.createElement('canvas');
          cvs.width  = vp.width;
          cvs.height = vp.height;
          await page.render({ canvas: cvs, viewport: vp }).promise;
          rendered.push(cvs.toDataURL('image/jpeg', 0.85));
          setLoadPct(Math.round((i / n) * 100));
          if (i <= 2 || i % 5 === 0) setPages([...rendered]);
        }

        if (!cancelled) {
          setPages([...rendered]);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadErr(err instanceof Error ? err.message : 'Failed to load PDF');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pdfUrl]);

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

  // Reset pan when spread changes (new page → center the view)
  useEffect(() => { setPanX(0); setPanY(0); }, [spread]);

  // Reset pan when zoom goes back to 1
  useEffect(() => { if (zoom === 1) { setPanX(0); setPanY(0); } }, [zoom]);

  // ── Drag-to-pan (global listeners, only active when zoom > 1) ────────────
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
  }, []); // mount once — reads current values via refs

  // ── Jump to page ──────────────────────────────────────────────────────────
  const doJump = useCallback(() => {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1 || n > total) return;
    const target = n <= 1 ? 0 : Math.floor(n / 2);
    setSpread(Math.min(Math.max(0, target), maxSpr));
    setJumpInput('');
  }, [jumpInput, total, maxSpr]);

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
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFS = () => {
    if (!fullscreen) {
      wrapRef.current?.requestFullscreen?.().catch(() => setFullscreen(true));
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else setFullscreen(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pg = (idx: number | null) =>
    idx !== null && idx < pages.length ? pages[idx] : null;

  const [cL, cR] = getSpreadPages(spread,     total);
  const [nL, nR] = getSpreadPages(spread + 1, total);
  const [pL, pR] = getSpreadPages(spread - 1, total);

  const isFlippingNext = flipping && flipDir === 'next';
  const isFlippingPrev = flipping && flipDir === 'prev';

  const PageImg = ({ idx }: { idx: number | null }) =>
    pg(idx) ? (
      <img src={pg(idx)!} alt="" className="fb-pg-img" draggable={false} />
    ) : (
      <div className="fb-pg-blank">
        {idx === null && brandName && (
          <span className="fb-blank-brand">{brandName}</span>
        )}
      </div>
    );

  const pageLabel = (() => {
    if (!total) return '';
    if (spread === 0) return `غلاف — ${total} صفحة`;
    const lo = 2 * spread;
    const hi = Math.min(lo + 1, total - 1);
    return lo === hi ? `${lo + 1} / ${total}` : `${lo + 1}–${hi + 1} / ${total}`;
  })();

  // ── Book transform: pan + zoom ────────────────────────────────────────────
  // translate() applied first in CSS so it offsets in screen-space after scaling.
  const bookTransform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const bookCursor    = zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : undefined;
  const bookTouchAction = zoom > 1 ? 'none' : undefined;   // disables native scroll when panning

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={`fb${fullscreen ? ' fb--fs' : ''}`}>

      {/* ── Top chrome bar ─────────────────────────────────────────────── */}
      <div className="fb-chrome">
        <div className="fb-chrome__dots"><span /><span /><span /></div>
        <span className="fb-chrome__title">📖 {brandName} — الكتالوج التفاعلي</span>
        <button className="fb-chrome__btn" onClick={toggleFS} aria-label={fullscreen ? 'إغلاق' : 'ملء الشاشة'}>
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      {!loading && !loadErr && (
        <div className="fb-toolbar" dir="rtl">

          {/* Group 1 — Zoom */}
          <div className="fb-tg">
            <button
              className="fb-tbtn"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              title="تصغير (Ctrl + −)"
              aria-label="تصغير"
            >−</button>
            <button
              className="fb-tbtn fb-tbtn--zoom-val"
              onClick={zoomReset}
              title="إعادة الضبط إلى 100% (Ctrl + 0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="fb-tbtn"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              title="تكبير (Ctrl + =)"
              aria-label="تكبير"
            >+</button>
            <span className="fb-tg-label">تكبير</span>
          </div>

          <div className="fb-tsep" />

          {/* Group 2 — Jump to page */}
          <div className="fb-tg">
            <span className="fb-tg-label">انتقال</span>
            <input
              className="fb-tinput"
              type="number"
              min={1}
              max={total}
              value={jumpInput}
              placeholder="صفحة"
              aria-label="رقم الصفحة"
              onChange={e => setJumpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doJump()}
            />
            <button className="fb-tbtn fb-tbtn--go" onClick={doJump} aria-label="انتقل">
              ↵
            </button>
          </div>

          <div className="fb-tsep" />

          {/* Group 3 — Auto-play */}
          <div className="fb-tg">
            <button
              className={`fb-tbtn fb-tbtn--auto${autoPlay ? ' fb-tbtn--active' : ''}`}
              onClick={() => setAutoPlay(a => !a)}
              title={autoPlay ? 'إيقاف التشغيل التلقائي' : 'تشغيل تلقائي'}
              aria-label={autoPlay ? 'إيقاف' : 'تشغيل تلقائي'}
            >
              {autoPlay
                ? <><span className="fb-tbtn__icon">⏹</span> إيقاف</>
                : <><span className="fb-tbtn__icon">▶</span> تلقائي</>}
            </button>
          </div>

          <div className="fb-tsep" />

          {/* Group 4 — Download & Print */}
          <div className="fb-tg">
            <a
              className="fb-tbtn fb-tbtn--dl"
              href={pdfUrl}
              download={`${brandName || 'catalog'}-katalog.pdf`}
              title="تحميل ملف PDF الأصلي"
            >
              <span className="fb-tbtn__icon">⬇</span> تحميل
            </a>
            <button
              className="fb-tbtn"
              onClick={() => window.open(pdfUrl, '_blank')}
              title="فتح PDF للطباعة"
            >
              <span className="fb-tbtn__icon">🖨</span> طباعة
            </button>
          </div>

        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="fb-loading">
          <div className="fb-loading__ring" />
          <p>جاري تحميل الكتالوج… {loadPct}%</p>
          <div className="fb-loading__track">
            <div className="fb-loading__fill" style={{ width: `${loadPct}%` }} />
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {loadErr && <div className="fb-error">تعذّر تحميل الكتالوج: {loadErr}</div>}

      {/* ── Book ────────────────────────────────────────────────────────── */}
      {!loading && !loadErr && (
        <div className="fb-scene">

          {/* ← Prev arrow — absolutely positioned at left edge */}
          <button
            className={`fb-nav fb-nav--l${!canPrev || flipping ? ' fb-nav--off' : ''}`}
            onClick={goPrev}
            disabled={!canPrev || flipping}
            aria-label="الصفحة السابقة"
          >‹</button>

          {/* Book stage */}
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
              e.preventDefault();   // prevent native image/text drag
              startDrag(e.clientX, e.clientY);
            }}
            onTouchStart={e => {
              if (zoom <= 1) return;
              startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
          >
            {/* Left half */}
            <div className={`fb-half fb-half--l${isFlippingPrev ? ' fb-half--under' : ''}`}>
              <PageImg idx={isFlippingPrev ? pL : cL} />
              <div className="fb-pgshad fb-pgshad--r" />
            </div>

            {/* Right half */}
            <div className={`fb-half fb-half--r${isFlippingNext ? ' fb-half--under' : ''}`}>
              <PageImg idx={isFlippingNext ? nR : cR} />
              <div className="fb-pgshad fb-pgshad--l" />
            </div>

            {/* NEXT flip overlay */}
            {isFlippingNext && (
              <div className="fb-flip fb-flip--next">
                <div className="fb-face fb-face--front"><PageImg idx={cR} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={nL} /></div>
                <div className="fb-flip-grad" />
              </div>
            )}

            {/* PREV flip overlay */}
            {isFlippingPrev && (
              <div className="fb-flip fb-flip--prev">
                <div className="fb-face fb-face--front"><PageImg idx={cL} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={pR} /></div>
                <div className="fb-flip-grad" />
              </div>
            )}

            {/* Spine */}
            <div className="fb-spine" />
          </div>

          {/* → Next arrow — absolutely positioned at right edge */}
          <button
            className={`fb-nav fb-nav--r${!canNext || flipping ? ' fb-nav--off' : ''}`}
            onClick={goNext}
            disabled={!canNext || flipping}
            aria-label="الصفحة التالية"
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
                aria-label={`الانتقال إلى ${i === 0 ? 'الغلاف' : `الصفحة ${i * 2}`}`}
              />
            ))}
          </div>
          <button className="fb-bar__fs" onClick={toggleFS}>
            {fullscreen ? '⊡ إغلاق' : '⛶ ملء الشاشة'}
          </button>
        </div>
      )}

    </div>
  );
};

export default FlipBook;

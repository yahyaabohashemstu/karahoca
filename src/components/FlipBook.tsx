import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/flipbook.css';

// ── Spread model ─────────────────────────────────────────────────────────────
// All page indices are 0-based. PDF pages are rendered in order 0…n-1.
//
// spread 0 → left = null (empty/brand),  right = pages[0]  (cover)
// spread k → left = pages[2k-1],         right = pages[2k]
// maxSpread = Math.floor(totalPages / 2)
//
// During NEXT flip (spread → spread+1):
//   Static left     (z:2) shows cL = currentLeft   [stays unchanged]
//   Static right    (z:1) shows nR = nextRight      [revealed underneath flip]
//   Flip overlay    (z:3) right-half, rotates -180° around left edge (spine)
//     Front face         shows cR = currentRight
//     Back face          shows nL = nextLeft
//
// During PREV flip (spread → spread-1):
//   Static left     (z:1) shows pL = prevLeft       [revealed underneath flip]
//   Static right    (z:2) shows cR = currentRight   [stays unchanged]
//   Flip overlay    (z:3) left-half, rotates +180° around right edge (spine)
//     Front face         shows cL = currentLeft
//     Back face          shows pR = prevRight
//
// After the animation timer fires, setSpread is called and overlays disappear.
// The static halves then show the exact same images → seamless transition.

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

// ── Constants ─────────────────────────────────────────────────────────────────
const RENDER_SCALE = 1.5;   // canvas render DPI multiplier
const FLIP_MS     = 620;    // animation duration in ms (must match CSS)

// ── Props ─────────────────────────────────────────────────────────────────────
interface FlipBookProps {
  pdfUrl: string;
  brandName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
const FlipBook: React.FC<FlipBookProps> = ({ pdfUrl, brandName = '' }) => {
  const [pages, setPages]           = useState<string[]>([]);
  const [loadPct, setLoadPct]       = useState(0);
  const [loading, setLoading]       = useState(true);
  const [loadErr, setLoadErr]       = useState<string | null>(null);
  const [spread, setSpread]         = useState(0);
  const [flipping, setFlipping]     = useState(false);
  const [flipDir, setFlipDir]       = useState<'next' | 'prev'>('next');
  const [fullscreen, setFullscreen] = useState(false);

  const wrapRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total    = pages.length;
  const maxSpr   = Math.floor(total / 2);
  const canNext  = spread < maxSpr;
  const canPrev  = spread > 0;

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
        // Dynamically import pdfjs-dist so it is split into its own chunk
        // and does not bloat the initial bundle.
        const pdfjsLib = await import('pdfjs-dist');
        // Use CDN worker to avoid nginx MIME-type issue with .mjs files on Coolify.
        // jsDelivr serves the file with correct application/javascript MIME type.
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
          // pdfjs-dist v5 API: pass canvas element directly (canvasContext is deprecated)
          await page.render({ canvas: cvs, viewport: vp }).promise;
          rendered.push(cvs.toDataURL('image/jpeg', 0.85));
          setLoadPct(Math.round((i / n) * 100));
          // Progressive: expose first two pages quickly for fast first render
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

  // ── Keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPrev();
      else if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, fullscreen]);

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

  // ── Page image helper ────────────────────────────────────────────────────
  const pg = (idx: number | null) =>
    idx !== null && idx < pages.length ? pages[idx] : null;

  // ── Spread index tuples ──────────────────────────────────────────────────
  const [cL, cR] = getSpreadPages(spread,     total);
  const [nL, nR] = getSpreadPages(spread + 1, total);
  const [pL, pR] = getSpreadPages(spread - 1, total);

  const isFlippingNext = flipping && flipDir === 'next';
  const isFlippingPrev = flipping && flipDir === 'prev';

  // ── Page image element ───────────────────────────────────────────────────
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

  // ── Page count label ────────────────────────────────────────────────────
  const pageLabel = (() => {
    if (!total) return '';
    if (spread === 0) return `غلاف — ${total} صفحة`;
    const lo = 2 * spread;
    const hi = Math.min(lo + 1, total - 1);
    return lo === hi ? `${lo + 1} / ${total}` : `${lo + 1}–${hi + 1} / ${total}`;
  })();

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={`fb${fullscreen ? ' fb--fs' : ''}`}>

      {/* Top chrome bar */}
      <div className="fb-chrome">
        <div className="fb-chrome__dots"><span /><span /><span /></div>
        <span className="fb-chrome__title">📖 {brandName} — الكتالوج التفاعلي</span>
        <button className="fb-chrome__btn" onClick={toggleFS} aria-label={fullscreen ? 'إغلاق' : 'ملء الشاشة'}>
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="fb-loading">
          <div className="fb-loading__ring" />
          <p>جاري تحميل الكتالوج… {loadPct}%</p>
          <div className="fb-loading__track">
            <div className="fb-loading__fill" style={{ width: `${loadPct}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {loadErr && <div className="fb-error">تعذّر تحميل الكتالوج: {loadErr}</div>}

      {/* Book */}
      {!loading && !loadErr && (
        <div className="fb-scene">

          {/* ← Prev arrow */}
          <button
            className={`fb-nav fb-nav--l${!canPrev || flipping ? ' fb-nav--off' : ''}`}
            onClick={goPrev} disabled={!canPrev || flipping}
            aria-label="الصفحة السابقة"
          >‹</button>

          {/* Book stage */}
          <div className="fb-book">

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

            {/* NEXT flip overlay: right page rotates -180° around left edge (spine) */}
            {isFlippingNext && (
              <div className="fb-flip fb-flip--next">
                <div className="fb-face fb-face--front"><PageImg idx={cR} /></div>
                <div className="fb-face fb-face--back"><PageImg idx={nL} /></div>
                <div className="fb-flip-grad" />
              </div>
            )}

            {/* PREV flip overlay: left page rotates +180° around right edge (spine) */}
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

          {/* Next arrow → */}
          <button
            className={`fb-nav fb-nav--r${!canNext || flipping ? ' fb-nav--off' : ''}`}
            onClick={goNext} disabled={!canNext || flipping}
            aria-label="الصفحة التالية"
          >›</button>

        </div>
      )}

      {/* Controls bar */}
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

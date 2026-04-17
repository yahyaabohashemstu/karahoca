import { useEffect, useState } from 'react';

/**
 * Loader hook for the FlipBook viewer.
 *
 * Accepts either a list of pre-rendered image URLs (the fast path) or a
 * legacy PDF URL (the fallback path where pdfjs-dist is dynamically loaded
 * and pages are canvas-rendered on the client). Returns a uniform
 * `{ pages, loading, loadPct, loadErr }` shape regardless of source.
 *
 * Why extract: the loader was tangled into the main FlipBook component,
 * which also owned spread navigation, zoom, pan, keyboard, fullscreen and
 * auto-play. Pulling just the I/O concern out keeps the main component's
 * state coherent (navigation + interaction stays together) while isolating
 * the one piece that has genuine boundary concerns (async fetch, PDF
 * worker init, cancellation on unmount).
 */

export interface FlipBookLoaderResult {
  /** Ordered page sources — either original URLs or data: URLs for PDF-rendered pages. */
  pages: string[];
  /** True while the loader is still fetching / rendering. */
  loading: boolean;
  /** 0–100 progress percentage. */
  loadPct: number;
  /** Null on success; error message string on failure. */
  loadErr: string | null;
}

export const useFlipBookLoader = (
  imageUrls: string[] | undefined,
  pdfUrl: string | undefined,
): FlipBookLoaderResult => {
  const [pages, setPages] = useState<string[]>([]);
  const [loadPct, setLoadPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // ── Image-based loading (preferred) ──────────────────────────────────────
  useEffect(() => {
    if (!imageUrls || imageUrls.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    setPages([]);
    setLoadPct(0);

    const loaded: string[] = [];
    let count = 0;

    imageUrls.forEach((url, i) => {
      const img = new Image();
      const onSettle = () => {
        if (cancelled) return;
        loaded[i] = url;
        count += 1;
        setLoadPct(Math.round((count / imageUrls.length) * 100));
        if (count === imageUrls.length) {
          setPages(loaded);
          setLoading(false);
        }
      };
      img.onload = onSettle;
      // On failure we still include the URL — the browser will render the
      // broken-image placeholder rather than skipping pages silently.
      img.onerror = onSettle;
      img.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrls]);

  // ── PDF-based loading (legacy fallback) ─────────────────────────────────
  useEffect(() => {
    if (imageUrls && imageUrls.length > 0) return; // images take priority
    if (!pdfUrl) return;

    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    setPages([]);
    setLoadPct(0);

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = new Uint8Array(await resp.arrayBuffer());

        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        const n = pdf.numPages;
        const rendered: string[] = [];

        for (let i = 1; i <= n; i += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1.5 });
          const cvs = document.createElement('canvas');
          cvs.width = vp.width;
          cvs.height = vp.height;
          await page.render({ canvas: cvs, viewport: vp }).promise;
          rendered.push(cvs.toDataURL('image/jpeg', 0.85));
          setLoadPct(Math.round((i / n) * 100));
          // Show partial pages as they arrive so the viewer isn't a
          // 100 % progress bar until the very end. Coarse check — first
          // two pages + every fifth after that.
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
    };
  }, [pdfUrl, imageUrls]);

  return { pages, loading, loadPct, loadErr };
};

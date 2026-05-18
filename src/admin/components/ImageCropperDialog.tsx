import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Pure-client image cropper.
 *
 * Why not a library: every popular React cropper (react-image-crop,
 * react-easy-crop) brings its own pan/zoom abstractions, sometimes a
 * sub-dependency for image loading, and styling that doesn't match
 * the admin theme. A square-/rectangular-crop tool is ~200 LOC of
 * Canvas + pointer events; the dep cost isn't worth it.
 *
 * What this component does:
 *   1. Reads a File (from <input type="file">) into an <img> via a
 *      blob URL. The original image is never decoded into the canvas
 *      at this point — we just need its dimensions for the overlay.
 *   2. Renders an aspect-ratio-locked draggable / resizable crop box
 *      on top. The box constraints live in viewport-space (CSS pixels)
 *      so the math stays simple.
 *   3. On confirm, projects the box back into image-space (the original
 *      file's pixel dimensions) and renders the cropped region through
 *      a hidden canvas. We export at the SOURCE resolution — no
 *      downscaling — so the product photo retains the detail it
 *      shipped with.
 *
 * Aspect-ratio choices: KARAHOCA's catalogue mixes square pack-shots
 * (most products) with 3:2 hero shots (the brand banners). We support
 * three presets the admin can switch between:
 *
 *   - Free        (no constraint)
 *   - 1:1 Square  (the catalogue default — product cards are square)
 *   - 3:2 Banner  (matches hero / FlipBook layouts)
 *
 * Output format: PNG with sane compression. We considered emitting
 * WebP (smaller) but the existing optimize-images.mjs build step
 * already produces WebP siblings from any PNG it finds — keeping
 * PNG here means the existing image pipeline still recognises the
 * file.
 */

interface Props {
  open: boolean;
  /** The original image file the admin picked. */
  file: File | null;
  /** Called with a cropped File when the admin clicks Apply. */
  onCropped: (cropped: File) => void;
  onCancel: () => void;
}

type AspectRatio = 'free' | 'square' | 'banner';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ASPECT_VALUES: Record<AspectRatio, number | null> = {
  free: null,
  square: 1,
  banner: 3 / 2,
};

const ASPECT_LABELS: Record<AspectRatio, string> = {
  free: 'Free',
  square: '1:1 Square (catalogue default)',
  banner: '3:2 Banner (hero / flipbook)',
};

const MIN_BOX_SIDE = 24; // px in viewport space — anything smaller is gesture noise

export const ImageCropperDialog: React.FC<Props> = ({ open, file, onCropped, onCancel }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>('square');
  const [box, setBox] = useState<Box | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Drag state is kept in refs because pointer-move fires at high
  // frequency and triggering React re-renders on every event would
  // jank the interaction; we render via a manual CSS-transform style
  // patch instead.
  const dragRef = useRef<{
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;
    startX: number;
    startY: number;
    startBox: Box;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startBox: { x: 0, y: 0, width: 0, height: 0 },
  });

  // ─── Load the file as a blob URL ────────────────────────────────────────
  useEffect(() => {
    if (!open || !file) {
      setImageUrl(null);
      setImgDims(null);
      setBox(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setError(null);
    return () => { URL.revokeObjectURL(url); };
  }, [open, file]);

  // ─── Initialise the box once we know the image dimensions ──────────────
  // We center a box of ~70% of the image's smaller side, clamped by the
  // chosen aspect ratio. This matches the convention every photo app
  // uses on first open — give the admin a reasonable starting frame
  // they can nudge from.
  useEffect(() => {
    if (!imgDims) return;
    const containerW = containerRef.current?.clientWidth ?? imgDims.w;
    // Compute the viewport-space scale so the image fits while
    // preserving aspect. Same as object-fit: contain.
    const scale = Math.min(containerW / imgDims.w, (window.innerHeight * 0.6) / imgDims.h, 1);
    const renderedW = imgDims.w * scale;
    const renderedH = imgDims.h * scale;
    const targetAspect = ASPECT_VALUES[aspect];
    let width = renderedW * 0.7;
    let height = renderedH * 0.7;
    if (targetAspect != null) {
      // Clamp the smaller axis to make the box honour the ratio.
      if (width / height > targetAspect) width = height * targetAspect;
      else height = width / targetAspect;
    }
    setBox({
      x: (renderedW - width) / 2,
      y: (renderedH - height) / 2,
      width,
      height,
    });
  }, [imgDims, aspect]);

  if (!open) return null;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Bounds-clamp + aspect-ratio fix for a candidate box.
  const sanitiseBox = (next: Box): Box => {
    const img = containerRef.current?.querySelector('img');
    if (!img) return next;
    const renderedW = img.clientWidth;
    const renderedH = img.clientHeight;
    let { x, y, width, height } = next;
    // Aspect lock — applied AFTER any size change.
    const targetAspect = ASPECT_VALUES[aspect];
    if (targetAspect != null) {
      // Keep the larger side, derive the other.
      if (width / height > targetAspect) width = height * targetAspect;
      else height = width / targetAspect;
    }
    // Min size.
    if (width < MIN_BOX_SIDE) width = MIN_BOX_SIDE;
    if (height < MIN_BOX_SIDE) height = MIN_BOX_SIDE;
    // Inside the image bounds.
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > renderedW) x = renderedW - width;
    if (y + height > renderedH) y = renderedH - height;
    if (x < 0) { x = 0; width = renderedW; }
    if (y < 0) { y = 0; height = renderedH; }
    return { x, y, width, height };
  };

  const startDrag = (e: React.PointerEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...box },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.mode || !box) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    let next: Box = { ...drag.startBox };
    if (drag.mode === 'move') {
      next.x = drag.startBox.x + dx;
      next.y = drag.startBox.y + dy;
    } else {
      // Corner-resize: opposite corner stays anchored.
      const right = drag.startBox.x + drag.startBox.width;
      const bottom = drag.startBox.y + drag.startBox.height;
      if (drag.mode === 'nw') {
        next.x = drag.startBox.x + dx;
        next.y = drag.startBox.y + dy;
        next.width = right - next.x;
        next.height = bottom - next.y;
      } else if (drag.mode === 'ne') {
        next.y = drag.startBox.y + dy;
        next.width = drag.startBox.width + dx;
        next.height = bottom - next.y;
      } else if (drag.mode === 'sw') {
        next.x = drag.startBox.x + dx;
        next.width = right - next.x;
        next.height = drag.startBox.height + dy;
      } else if (drag.mode === 'se') {
        next.width = drag.startBox.width + dx;
        next.height = drag.startBox.height + dy;
      }
    }
    setBox(sanitiseBox(next));
  };

  const endDrag = () => {
    dragRef.current.mode = null;
  };

  // Project the viewport-space box back into image-space and render.
  const applyCrop = async () => {
    if (!file || !box || !imgDims) return;
    setWorking(true);
    setError(null);
    try {
      const img = containerRef.current?.querySelector('img');
      if (!img) throw new Error('Image element missing.');
      const renderedW = img.clientWidth;
      const renderedH = img.clientHeight;
      const scaleX = imgDims.w / renderedW;
      const scaleY = imgDims.h / renderedH;
      // Source rect on the original-resolution image.
      const sx = box.x * scaleX;
      const sy = box.y * scaleY;
      const sw = box.width * scaleX;
      const sh = box.height * scaleY;

      // Decode the file via createImageBitmap (fast path) when available;
      // fall back to a plain Image for older Safari.
      const bitmap: ImageBitmap | HTMLImageElement = typeof createImageBitmap === 'function'
        ? await createImageBitmap(file)
        : await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(file);
          });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas → blob conversion failed.'))),
          'image/png',
          0.92,
        );
      });

      // Preserve the original filename stem so the uploaded file is
      // recognisable in the data/uploads directory after the round-trip.
      const stem = file.name.replace(/\.[^.]+$/, '') || 'cropped';
      const cropped = new File([blob], `${stem}-cropped.png`, { type: 'image/png' });
      onCropped(cropped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crop failed.');
    } finally {
      setWorking(false);
    }
  };

  // Memoise the overlay handles' positions so re-renders during drag
  // don't reallocate the array shape.
  const handleStyles = useMemo(() => {
    if (!box) return null;
    return {
      nw: { left: box.x - 6, top: box.y - 6 },
      ne: { left: box.x + box.width - 6, top: box.y - 6 },
      sw: { left: box.x - 6, top: box.y + box.height - 6 },
      se: { left: box.x + box.width - 6, top: box.y + box.height - 6 },
    } as const;
  }, [box]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        className="adm-card"
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>✂️ Crop image</h2>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={onCancel}
            disabled={working}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Aspect-ratio selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['free', 'square', 'banner'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`adm-btn adm-btn-sm ${aspect === a ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
              onClick={() => setAspect(a)}
            >
              {ASPECT_LABELS[a]}
            </button>
          ))}
        </div>

        {/* The image + crop overlay */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            display: 'inline-block',
            userSelect: 'none',
            background: '#000',
            maxWidth: '100%',
            maxHeight: '60vh',
            overflow: 'hidden',
            alignSelf: 'center',
          }}
          onPointerMove={onPointerMove}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Crop source"
              onLoad={handleImageLoad}
              draggable={false}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
            />
          )}
          {box && (
            <>
              {/* Darken overlay outside the crop box — four absolutely
                  positioned strips that fill the rectangle's complement.
                  Simpler than CSS clip-path for cross-browser. */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {/* Top */}
                <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: box.y, background: 'rgba(0,0,0,0.55)' }} />
                {/* Bottom */}
                <div style={{ position: 'absolute', left: 0, top: box.y + box.height, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />
                {/* Left */}
                <div style={{ position: 'absolute', left: 0, top: box.y, width: box.x, height: box.height, background: 'rgba(0,0,0,0.55)' }} />
                {/* Right */}
                <div style={{ position: 'absolute', left: box.x + box.width, top: box.y, right: 0, height: box.height, background: 'rgba(0,0,0,0.55)' }} />
              </div>

              {/* The crop box itself */}
              <div
                role="region"
                aria-label="Crop selection"
                onPointerDown={(e) => startDrag(e, 'move')}
                style={{
                  position: 'absolute',
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                  cursor: 'move',
                  touchAction: 'none',
                }}
              />

              {/* Resize handles — corner-only keeps the geometry simple. */}
              {handleStyles && (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <div
                  key={corner}
                  role="slider"
                  aria-label={`Resize ${corner}`}
                  onPointerDown={(e) => startDrag(e, corner)}
                  style={{
                    position: 'absolute',
                    width: 12,
                    height: 12,
                    background: '#fff',
                    border: '1px solid #0f172a',
                    cursor: `${corner}-resize`,
                    touchAction: 'none',
                    ...handleStyles[corner],
                  }}
                />
              ))}
            </>
          )}
        </div>

        {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
            {imgDims && box
              ? `${Math.round(box.width)} × ${Math.round(box.height)} px (preview) — exports at ${Math.round(box.width * (imgDims.w / (containerRef.current?.querySelector('img')?.clientWidth || imgDims.w)))} × ${Math.round(box.height * (imgDims.h / (containerRef.current?.querySelector('img')?.clientHeight || imgDims.h)))} px (full res)`
              : 'Pick a file to crop'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={onCancel}
              disabled={working}
            >
              Cancel
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={applyCrop}
              disabled={working || !box || !imgDims}
            >
              {working ? 'Cropping…' : '✓ Apply crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

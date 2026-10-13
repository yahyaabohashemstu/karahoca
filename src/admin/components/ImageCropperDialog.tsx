import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useModalDialog } from '../utils/useModalDialog';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: '✂️ Crop image',
    aspect_free: 'Free',
    aspect_square: '1:1 Square (catalogue default)',
    aspect_banner: '3:2 Banner (hero / flipbook)',
    cropSource: 'Crop source',
    cropSelection: 'Crop selection',
    resize_nw: 'Resize nw',
    resize_ne: 'Resize ne',
    resize_sw: 'Resize sw',
    resize_se: 'Resize se',
    sizeInfo: '{w} × {h} px (preview) — saves at {outW} × {outH} px',
    pickFile: 'Pick a file to crop',
    cropping: 'Cropping…',
    applyCrop: '✓ Apply crop',
    errImageMissing: 'Image element missing.',
    errCanvas: 'Canvas 2D context unavailable.',
    errBlob: 'Canvas → blob conversion failed.',
    errTooBig: 'The cropped image is {size} MB, over the 10 MB upload limit. Crop a smaller area.',
    cropFailed: 'Crop failed.',
  },
  ar: {
    title: '✂️ قص الصورة',
    aspect_free: 'حرّ',
    aspect_square: '1:1 مربع (الافتراضي في الكتالوج)',
    aspect_banner: '3:2 لافتة (الواجهة الرئيسية / الكتيّب)',
    cropSource: 'الصورة المراد قصها',
    cropSelection: 'منطقة القص',
    resize_nw: 'تغيير الحجم من الزاوية العلوية اليسرى',
    resize_ne: 'تغيير الحجم من الزاوية العلوية اليمنى',
    resize_sw: 'تغيير الحجم من الزاوية السفلية اليسرى',
    resize_se: 'تغيير الحجم من الزاوية السفلية اليمنى',
    sizeInfo: '{w} × {h} بكسل (معاينة) — تُحفظ بحجم {outW} × {outH} بكسل',
    pickFile: 'اختر ملفًا لقصه',
    cropping: 'جارٍ القص…',
    applyCrop: '✓ تطبيق القص',
    errImageMissing: 'عنصر الصورة غير موجود.',
    errCanvas: 'لا يتيح المتصفح الرسم على Canvas 2D.',
    errBlob: 'تعذّر تحويل الصورة المقصوصة إلى ملف.',
    errTooBig: 'حجم الصورة المقصوصة {size} ميغابايت، وهو أكبر من حد الرفع البالغ 10 ميغابايت. اختر منطقة أصغر.',
    cropFailed: 'فشل القص.',
  },
});

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
 *      a hidden canvas, at most MAX_EXPORT_SIDE px on the long side.
 *
 * Aspect-ratio choices: KARAHOCA's catalogue mixes square pack-shots
 * (most products) with 3:2 hero shots (the brand banners). We support
 * three presets the admin can switch between:
 *
 *   - Free        (no constraint)
 *   - 1:1 Square  (the catalogue default — product cards are square)
 *   - 3:2 Banner  (matches hero / FlipBook layouts)
 *
 * Output format: WebP at 0.9 (JPEG where the browser can't encode WebP),
 * or PNG when the picture has transparent pixels. It used to be a
 * full-resolution PNG whatever the source: a cropped 4000 px phone photo
 * came out at 15–30 MB, over the 10 MB upload limit, so the crop was
 * rejected. The server makes the resized WebP variants the site serves
 * from whatever is uploaded (server/services/uploadVariants.mjs).
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

const MIN_BOX_SIDE = 24; // px in viewport space — anything smaller is gesture noise

// Long-side cap for the exported file. The site never shows product
// photos wider than ~1300 px; 2400 leaves room for zoom and retina.
const MAX_EXPORT_SIDE = 2400;
const EXPORT_QUALITY = 0.9;
// Same limit the editors and the upload endpoint enforce.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' };

type Corner = 'nw' | 'ne' | 'sw' | 'se';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Keep a box inside the rendered image: an oversize side is shrunk (with
 * the other side too when a ratio is locked), then the box is slid back in.
 * The old clamp moved x/y and, when the box was still too big, stretched it
 * to the full image width or height — which broke the 1:1 / 3:2 lock every
 * time a resize hit an image edge.
 */
const fitInside = (box: Box, boundsW: number, boundsH: number, ratio: number | null): Box => {
  let { width, height } = box;
  if (width > boundsW) { if (ratio != null) height = boundsW / ratio; width = boundsW; }
  if (height > boundsH) { if (ratio != null) width = boundsH * ratio; height = boundsH; }
  return { x: clamp(box.x, 0, boundsW - width), y: clamp(box.y, 0, boundsH - height), width, height };
};

/** Corner resize: the opposite corner stays put, the dragged one follows the pointer (inside the image). */
const resizeFromCorner = (
  start: Box, corner: Corner, dx: number, dy: number, boundsW: number, boundsH: number, ratio: number | null,
): Box => {
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const anchorX = west ? start.x + start.width : start.x;
  const anchorY = north ? start.y + start.height : start.y;
  const cornerX = clamp((west ? start.x : start.x + start.width) + dx, 0, boundsW);
  const cornerY = clamp((north ? start.y : start.y + start.height) + dy, 0, boundsH);
  let width = Math.max(MIN_BOX_SIDE, west ? anchorX - cornerX : cornerX - anchorX);
  let height = Math.max(MIN_BOX_SIDE, north ? anchorY - cornerY : cornerY - anchorY);
  if (ratio != null) {
    // Shrink the side that is too long for the ratio — never grow one, so
    // the box can't pass the (already clamped) pointer position.
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
  }
  return fitInside(
    { x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height },
    boundsW, boundsH, ratio,
  );
};

/** Output pixel size for a source-space crop of sw × sh. */
const exportSize = (sw: number, sh: number) => {
  const scale = Math.min(1, MAX_EXPORT_SIDE / Math.max(sw, sh, 1));
  return { w: Math.max(1, Math.round(sw * scale)), h: Math.max(1, Math.round(sh * scale)) };
};

/** Any non-opaque pixel, checked on a small nearest-neighbour sample (cheap even for big crops). */
const hasTransparency = (canvas: HTMLCanvasElement): boolean => {
  const sample = document.createElement('canvas');
  const scale = Math.min(1, 256 / Math.max(canvas.width, canvas.height));
  sample.width = Math.max(1, Math.round(canvas.width * scale));
  sample.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true; // can't tell — PNG is the lossless, alpha-safe choice
  // No smoothing: a filtered edge could blend in transparent padding and
  // mark an opaque photo as transparent.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const { data } = ctx.getImageData(0, 0, sample.width, sample.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export const ImageCropperDialog: React.FC<Props> = ({ open, file, onCropped, onCancel }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>('square');
  const [box, setBox] = useState<Box | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT(messages);
  const tc = useT(common);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Drag state is kept in refs because pointer-move fires at high
  // frequency and triggering React re-renders on every event would
  // jank the interaction; we render via a manual CSS-transform style
  // patch instead.
  const dragRef = useRef<{
    mode: 'move' | Corner | null;
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

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const startDrag = (e: React.PointerEvent, mode: 'move' | Corner) => {
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
    const img = containerRef.current?.querySelector('img');
    if (!img) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const ratio = ASPECT_VALUES[aspect];
    setBox(drag.mode === 'move'
      ? fitInside({ ...drag.startBox, x: drag.startBox.x + dx, y: drag.startBox.y + dy }, img.clientWidth, img.clientHeight, ratio)
      : resizeFromCorner(drag.startBox, drag.mode, dx, dy, img.clientWidth, img.clientHeight, ratio));
  };

  const endDrag = () => {
    dragRef.current.mode = null;
  };

  // Project the viewport-space box back into image-space and render.
  const applyCrop = async () => {
    if (!file || !box || !imgDims) return;
    setWorking(true);
    setError(null);
    // Released in `finally`: a decoded full-size bitmap holds tens of MB
    // until it is closed, and the fallback blob URL leaked on every crop.
    let bitmap: ImageBitmap | HTMLImageElement | null = null;
    let fallbackUrl: string | null = null;
    try {
      const img = containerRef.current?.querySelector('img');
      if (!img) throw new Error(t('errImageMissing'));
      const renderedW = img.clientWidth;
      const renderedH = img.clientHeight;
      const scaleX = imgDims.w / renderedW;
      const scaleY = imgDims.h / renderedH;
      // Source rect on the original-resolution image. Float error can put
      // it a fraction past the edge, which leaves a transparent sliver.
      const sx = clamp(box.x * scaleX, 0, imgDims.w);
      const sy = clamp(box.y * scaleY, 0, imgDims.h);
      const sw = Math.min(box.width * scaleX, imgDims.w - sx);
      const sh = Math.min(box.height * scaleY, imgDims.h - sy);

      // Decode the file via createImageBitmap (fast path) when available;
      // fall back to a plain Image for older Safari.
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(file);
      } else {
        const url = URL.createObjectURL(file);
        fallbackUrl = url;
        bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
      }

      const { w, h } = exportSize(sw, sh);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('errCanvas'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);

      // Only formats that can carry transparency are worth checking.
      const mayHaveAlpha = ['image/png', 'image/webp', 'image/gif'].includes(file.type);
      let blob: Blob | null;
      if (mayHaveAlpha && hasTransparency(canvas)) {
        blob = await canvasToBlob(canvas, 'image/png');
        // A detailed 2400 px PNG can still pass 10 MB; WebP keeps the
        // transparency at a fraction of the size.
        if (blob && blob.size > MAX_UPLOAD_BYTES) {
          const webp = await canvasToBlob(canvas, 'image/webp', EXPORT_QUALITY);
          if (webp?.type === 'image/webp') blob = webp;
        }
      } else {
        const webp = await canvasToBlob(canvas, 'image/webp', EXPORT_QUALITY);
        // A browser that can't encode WebP hands back a PNG instead (or null).
        blob = webp?.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/jpeg', EXPORT_QUALITY);
      }
      if (!blob) throw new Error(t('errBlob'));
      if (blob.size > MAX_UPLOAD_BYTES) {
        throw new Error(t('errTooBig', { size: (blob.size / 1048576).toFixed(1) }));
      }

      // Preserve the original filename stem so the uploaded file is
      // recognisable in the data/uploads directory after the round-trip.
      // The extension must match the real type: the server checks both.
      const ext = EXTENSION_BY_TYPE[blob.type] ?? 'png';
      const type = EXTENSION_BY_TYPE[blob.type] ? blob.type : 'image/png';
      const stem = file.name.replace(/\.[^.]+$/, '') || 'cropped';
      const cropped = new File([blob], `${stem}-cropped.${ext}`, { type });
      onCropped(cropped);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cropFailed'));
    } finally {
      if (bitmap && 'close' in bitmap) bitmap.close();
      if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
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

  // Escape cancels, except mid-export (the result would arrive after close).
  const panelRef = useModalDialog<HTMLDivElement>(open, () => { if (!working) onCancel(); });

  // Early exit only AFTER every hook has run: returning before `useMemo`
  // above made the closed → open render call one more hook than the
  // previous one, which React rejects ("Rendered more hooks than during
  // the previous render") — the "Crop & upload" button crashed the page.
  if (!open) return null;

  const outputSize = (() => {
    if (!imgDims || !box) return null;
    const img = containerRef.current?.querySelector('img');
    return exportSize(
      box.width * (imgDims.w / (img?.clientWidth || imgDims.w)),
      box.height * (imgDims.h / (img?.clientHeight || imgDims.h)),
    );
  })();

  return (
    <div
      role="presentation"
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-cropper-title"
        tabIndex={-1}
        className="adm-card"
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 id="image-cropper-title" style={{ margin: 0, fontSize: 18 }}>{t('title')}</h2>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={onCancel}
            disabled={working}
            aria-label={tc('close')}
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
              {t(`aspect_${a}`)}
            </button>
          ))}
        </div>

        {/* The image + crop overlay. Always left-to-right: the box,
            strips and handles are positioned in px from the left edge. */}
        <div
          ref={containerRef}
          dir="ltr"
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
              alt={t('cropSource')}
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
                aria-label={t('cropSelection')}
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
                  aria-label={t(`resize_${corner}`)}
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
            {box && outputSize
              ? t('sizeInfo', { w: Math.round(box.width), h: Math.round(box.height), outW: outputSize.w, outH: outputSize.h })
              : t('pickFile')}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={onCancel}
              disabled={working}
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={applyCrop}
              disabled={working || !box || !imgDims}
            >
              {working ? t('cropping') : t('applyCrop')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

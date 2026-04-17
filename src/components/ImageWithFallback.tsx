import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

interface ImageWithFallbackProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'srcSet'> {
  src: string;
  fallbackSrc?: string;
  /** Explicit intrinsic width — required for CLS-safe rendering. */
  width?: number | string;
  /** Explicit intrinsic height — required for CLS-safe rendering. */
  height?: number | string;
  /**
   * Optional responsive descriptor list. When provided, the component emits a
   * `<picture>` with a `<source srcset>` in modern formats first, so a phone
   * doesn't download the 4K-monitor variant. Each entry is a `{ src, width }`
   * pair; the component builds the corresponding `srcset` string.
   *
   * Named `srcSet` instead of `srcset` to match React prop conventions; the
   * parent `ImgHTMLAttributes` is `Omit`-ed on that key so we can narrow the
   * type from `string` to the structured form without a type clash.
   */
  srcSet?: Array<{ src: string; width: number }>;
  /** `sizes` attribute, e.g. `(max-width: 768px) 100vw, 50vw`. Required for meaningful srcset use. */
  sizes?: string;
}

/**
 * Image wrapper with a single retry to `fallbackSrc` on error.
 *
 * Always forwards width/height (via ...rest) so the browser reserves the box
 * before the asset arrives — preventing Cumulative Layout Shift.
 *
 * When `srcSet` is provided, renders a `<picture>` so the browser can pick
 * the most appropriate variant based on `sizes`. Without `srcSet`, behaves
 * identically to a plain `<img>` — existing call sites keep working unchanged.
 *
 * Defaults: async decoding and lazy loading, both overridable per-instance.
 */
const buildSrcSetAttribute = (entries: Array<{ src: string; width: number }>) =>
  entries
    .filter((entry) => typeof entry?.src === 'string' && Number.isFinite(entry?.width))
    .sort((a, b) => a.width - b.width)
    .map((entry) => `${entry.src} ${entry.width}w`)
    .join(', ');

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fallbackSrc,
  onError,
  loading = 'lazy',
  decoding = 'async',
  srcSet,
  sizes,
  ...rest
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setErrored(false);
  }, [src]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setErrored(true); // suppress srcset on retry so the browser uses fallbackSrc directly
      return;
    }
    onError?.(event);
  };

  // If the caller supplied a srcSet AND the primary source hasn't errored,
  // emit a <picture> so the browser picks the right variant. Otherwise fall
  // back to a plain <img> — identical to the historical behaviour.
  if (srcSet && srcSet.length > 0 && !errored) {
    const srcSetAttr = buildSrcSetAttribute(srcSet);
    return (
      <picture>
        {srcSetAttr && <source srcSet={srcSetAttr} sizes={sizes} />}
        <img
          {...rest}
          src={currentSrc}
          loading={loading}
          decoding={decoding}
          onError={handleError}
        />
      </picture>
    );
  }

  return (
    <img
      {...rest}
      src={currentSrc}
      loading={loading}
      decoding={decoding}
      onError={handleError}
    />
  );
};

export default ImageWithFallback;

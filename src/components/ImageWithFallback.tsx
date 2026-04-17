import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  /** Explicit intrinsic width — required for CLS-safe rendering. */
  width?: number | string;
  /** Explicit intrinsic height — required for CLS-safe rendering. */
  height?: number | string;
}

/**
 * Image with a single retry to `fallbackSrc` on error. Always forwards
 * width / height (via ...rest) so the browser reserves the box before
 * the asset arrives — preventing Cumulative Layout Shift.
 *
 * Defaults: async decoding and lazy loading, both overridable per-instance.
 */
const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fallbackSrc,
  onError,
  loading = 'lazy',
  decoding = 'async',
  ...rest
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    onError?.(event);
  };

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

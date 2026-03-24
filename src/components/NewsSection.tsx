import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NewsCard from './NewsCard';
import NewsModal from './NewsModal';
import { getLocalizedNewsItems, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';

const AUTO_SCROLL_PAUSE_MS = 3000;
const AUTO_SCROLL_SPEED_PX_PER_MS = 0.03;
const DRAG_THRESHOLD_PX = 6;

const NewsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeNews, setActiveNews] = useState<LocalizedNewsItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const loopWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const suppressClickUntilRef = useRef(0);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startOffset: 0,
    pointerId: -1
  });

  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const newsItems = getLocalizedNewsItems(currentLanguage);
  const marqueeItems = [...newsItems, ...newsItems, ...newsItems];

  const pauseAutoScroll = (duration = AUTO_SCROLL_PAUSE_MS) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pausedUntilRef.current = now + duration;
  };

  const normalizeOffset = useCallback((offset: number) => {
    const loopWidth = loopWidthRef.current;
    if (!loopWidth) {
      return offset;
    }

    let normalized = offset;

    while (normalized >= 0) {
      normalized -= loopWidth;
    }

    while (normalized < -2 * loopWidth) {
      normalized += loopWidth;
    }

    return normalized;
  }, []);

  const applyOffset = useCallback((offset: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const normalized = normalizeOffset(offset);
    offsetRef.current = normalized;
    track.style.transform = `translate3d(${normalized}px, 0, 0)`;
  }, [normalizeOffset]);

  useEffect(() => {
    const track = trackRef.current;

    if (!track || newsItems.length === 0) {
      return undefined;
    }

    const measureLoop = () => {
      const loopWidth = track.scrollWidth / 3;
      loopWidthRef.current = loopWidth;
      applyOffset(-loopWidth);
    };

    const step = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }

      const delta = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      if (!dragStateRef.current.active && timestamp >= pausedUntilRef.current && loopWidthRef.current > 0) {
        applyOffset(offsetRef.current + delta * AUTO_SCROLL_SPEED_PX_PER_MS);
      }

      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    measureLoop();
    window.addEventListener('resize', measureLoop);
    animationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener('resize', measureLoop);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
      dragStateRef.current.active = false;
      setIsDragging(false);
    };
  }, [applyOffset, newsItems.length, currentLanguage]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    dragStateRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startOffset: offsetRef.current,
      pointerId: event.pointerId
    };

    pauseAutoScroll();
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !dragStateRef.current.active) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;

    if (!dragStateRef.current.moved && Math.abs(deltaX) >= DRAG_THRESHOLD_PX) {
      dragStateRef.current.moved = true;
      setIsDragging(true);
    }

    if (dragStateRef.current.moved) {
      applyOffset(dragStateRef.current.startOffset + deltaX);
      pauseAutoScroll();
    }
  };

  const handlePointerRelease = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !dragStateRef.current.active) {
      return;
    }

    const moved = dragStateRef.current.moved;
    dragStateRef.current.active = false;
    dragStateRef.current.moved = false;
    setIsDragging(false);
    pauseAutoScroll();

    if (moved) {
      suppressClickUntilRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 250;
    }

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <section id="news" className="section glass-section news-section">
      <div className="section-divider"></div>

      <div className="container section__head news-section__head fx-reveal">
        <div className="news-section__copy">
          <span className="news-page__eyebrow">{t('newsPage.eyebrow')}</span>
          <h2 className="section-title">{t('newsPage.sectionTitle')}</h2>
          <p className="section-subtitle">{t('newsPage.sectionSubtitle')}</p>
        </div>

        <Link to="/news" className="btn btn--ghost news-section__all">
          {t('newsPage.viewAll')}
        </Link>
      </div>

      <div
        ref={viewportRef}
        className={`container news-section__viewport fx-up${isDragging ? ' is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerRelease}
        onPointerCancel={handlePointerRelease}
        onClickCapture={handleClickCapture}
      >
        <div ref={trackRef} className="news-section__track">
          {marqueeItems.map((item, index) => (
            <div key={`${item.id}-${index}`} className="news-section__item">
              <NewsCard news={item} onOpen={setActiveNews} compact />
            </div>
          ))}
        </div>
      </div>

      <NewsModal news={activeNews} onClose={() => setActiveNews(null)} />
    </section>
  );
};

export default NewsSection;

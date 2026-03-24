import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NewsCard from './NewsCard';
import NewsModal from './NewsModal';
import { getLocalizedNewsItems, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';

const AUTO_SCROLL_PAUSE_MS = 3000;
const AUTO_SCROLL_SPEED_PX_PER_MS = 0.03;

const NewsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeNews, setActiveNews] = useState<LocalizedNewsItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const pausedUntilRef = useRef(0);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0
  });

  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const newsItems = getLocalizedNewsItems(currentLanguage);
  const marqueeItems = [...newsItems, ...newsItems, ...newsItems];

  const pauseAutoScroll = (duration = AUTO_SCROLL_PAUSE_MS) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pausedUntilRef.current = now + duration;
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;

    if (!viewport || !track || newsItems.length === 0) {
      return undefined;
    }

    const getLoopWidth = () => track.scrollWidth / 3;

    const resetToMiddle = () => {
      const loopWidth = getLoopWidth();
      if (loopWidth > 0) {
        viewport.scrollLeft = loopWidth;
      }
    };

    resetToMiddle();

    const handleResize = () => {
      const loopWidth = getLoopWidth();
      if (!loopWidth) {
        return;
      }

      if (viewport.scrollLeft <= 0 || viewport.scrollLeft >= loopWidth * 2) {
        viewport.scrollLeft = loopWidth;
        return;
      }

      viewport.scrollLeft = Math.max(loopWidth * 0.25, Math.min(viewport.scrollLeft, loopWidth * 1.75));
    };

    const step = (timestamp: number) => {
      const loopWidth = getLoopWidth();

      if (!loopWidth) {
        animationFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }

      const delta = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      if (!dragStateRef.current.active && timestamp >= pausedUntilRef.current) {
        viewport.scrollLeft -= delta * AUTO_SCROLL_SPEED_PX_PER_MS;

        if (viewport.scrollLeft <= 0) {
          viewport.scrollLeft += loopWidth;
        } else if (viewport.scrollLeft >= loopWidth * 2) {
          viewport.scrollLeft -= loopWidth;
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    window.addEventListener('resize', handleResize);
    animationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
      dragStateRef.current.active = false;
      setIsDragging(false);
    };
  }, [newsItems.length, currentLanguage]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft
    };

    setIsDragging(true);
    pauseAutoScroll();
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !dragStateRef.current.active) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    viewport.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
    pauseAutoScroll();
  };

  const handlePointerRelease = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !dragStateRef.current.active) {
      return;
    }

    dragStateRef.current.active = false;
    setIsDragging(false);
    pauseAutoScroll();

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
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
        onPointerLeave={handlePointerRelease}
        onWheel={() => pauseAutoScroll()}
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

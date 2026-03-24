import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NewsCard from './NewsCard';
import NewsModal from './NewsModal';
import { getLocalizedNewsItems, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';

const AUTO_SCROLL_PAUSE_MS = 3000;
const AUTO_SCROLL_SPEED_PX_PER_MS = 0.03;

const ARROW_LABELS = {
  ar: {
    previous: 'تحريك الأخبار إلى اليمين',
    next: 'تحريك الأخبار إلى اليسار'
  },
  en: {
    previous: 'Move news to the right',
    next: 'Move news to the left'
  },
  tr: {
    previous: 'Haberleri saga kaydir',
    next: 'Haberleri sola kaydir'
  },
  ru: {
    previous: 'Sdvinit novosti vpravo',
    next: 'Sdvinit novosti vlevo'
  }
} as const;

const NewsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeNews, setActiveNews] = useState<LocalizedNewsItem | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const loopWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const isHoveringRef = useRef(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const newsItems = getLocalizedNewsItems(currentLanguage);
  const marqueeItems = [...newsItems, ...newsItems, ...newsItems];
  const arrowLabels = useMemo(
    () => ARROW_LABELS[currentLanguage as keyof typeof ARROW_LABELS] ?? ARROW_LABELS.en,
    [currentLanguage]
  );

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

  const animateToOffset = useCallback((offset: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    track.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
    applyOffset(offset);
    transitionTimeoutRef.current = window.setTimeout(() => {
      track.style.transition = '';
      transitionTimeoutRef.current = null;
    }, 460);
  }, [applyOffset]);

  const focusNearestCard = useCallback((direction: 'previous' | 'next') => {
    const viewport = viewportRef.current;
    const track = trackRef.current;

    if (!viewport || !track) {
      return;
    }

    const items = Array.from(track.querySelectorAll<HTMLElement>('.news-section__item'));
    if (items.length === 0) {
      return;
    }

    const viewportCenter = -offsetRef.current + viewport.clientWidth / 2;
    const epsilon = 1;
    const itemCenters = items.map((item) => item.offsetLeft + item.offsetWidth / 2);

    let targetCenter: number | undefined;

    if (direction === 'previous') {
      const previousCenters = itemCenters.filter((center) => center < viewportCenter - epsilon);
      targetCenter = previousCenters.length > 0 ? previousCenters[previousCenters.length - 1] : itemCenters[itemCenters.length - 1];
    } else {
      const nextCenters = itemCenters.filter((center) => center > viewportCenter + epsilon);
      targetCenter = nextCenters.length > 0 ? nextCenters[0] : itemCenters[0];
    }

    if (targetCenter === undefined) {
      return;
    }

    pauseAutoScroll();
    animateToOffset(viewport.clientWidth / 2 - targetCenter);
  }, [animateToOffset]);

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

      if (!isHoveringRef.current && timestamp >= pausedUntilRef.current && loopWidthRef.current > 0) {
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
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      if (track) {
        track.style.transition = '';
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [applyOffset, newsItems.length, currentLanguage]);

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
        className="container news-section__carousel fx-up"
        onMouseEnter={() => {
          isHoveringRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveringRef.current = false;
        }}
      >
        <button
          type="button"
          className="news-section__arrow news-section__arrow--previous"
          aria-label={arrowLabels.previous}
          onClick={() => focusNearestCard('previous')}
        >
          <span aria-hidden="true">←</span>
        </button>

        <div ref={viewportRef} className="news-section__viewport">
          <div ref={trackRef} className="news-section__track">
            {marqueeItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="news-section__item">
                <NewsCard news={item} onOpen={setActiveNews} compact />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="news-section__arrow news-section__arrow--next"
          aria-label={arrowLabels.next}
          onClick={() => focusNearestCard('next')}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <NewsModal news={activeNews} onClose={() => setActiveNews(null)} />
    </section>
  );
};

export default NewsSection;

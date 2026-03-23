import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { LocalizedNewsItem } from '../data/news';

interface NewsModalProps {
  news: LocalizedNewsItem | null;
  onClose: () => void;
}

const NewsModal: React.FC<NewsModalProps> = ({ news, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!news) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [news, onClose]);

  if (!news || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="news-modal" role="presentation" onClick={onClose}>
      <article
        className="news-modal__dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`news-modal-title-${news.id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="news-modal__close"
          onClick={onClose}
          aria-label={t('newsPage.modalClose')}
        >
          ×
        </button>

        <div className="news-modal__media">
          <img src={news.image} alt={news.alt} />
        </div>

        <div className="news-modal__body">
          <div className="news-modal__meta">
            <span className="news-card__chip">{news.category}</span>
            <time dateTime={news.publishedAt} className="news-card__date">
              {news.dateLabel}
            </time>
          </div>

          <h3 id={`news-modal-title-${news.id}`} className="news-modal__title">
            {news.title}
          </h3>

          <div className="news-modal__content">
            {news.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>
    </div>,
    document.body
  );
};

export default NewsModal;

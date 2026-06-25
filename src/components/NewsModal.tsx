import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LocalizedNewsItem } from '../data/news';

interface NewsModalProps {
  news: LocalizedNewsItem | null;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const NewsModal: React.FC<NewsModalProps> = ({ news, onClose }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!news) {
      return undefined;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      (closeButtonRef.current ?? dialogRef.current)?.focus();
    });

    const getFocusableElements = () => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return [];
      }

      return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      const previousActiveElement = previousActiveElementRef.current;
      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus();
      }
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
        tabIndex={-1}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="news-modal__close"
          onClick={onClose}
          aria-label={t('newsPage.modalClose')}
          ref={closeButtonRef}
        >
          ×
        </button>

        <div className="news-modal__media">
          <img src={news.image} alt={news.alt} decoding="async" />
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
            {/* Body is markdown (same contract as the full article page):
                plain-text paragraphs still render as <p>, and richer items
                — inline images, links, lists — render properly instead of
                showing raw markdown syntax. */}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, href, ...rest }) => (
                  <a
                    href={href}
                    target={href?.startsWith('http') ? '_blank' : undefined}
                    rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    {...rest}
                  />
                ),
                img: ({ node, src, alt, ...rest }) => (
                  <img
                    src={src}
                    alt={alt || ''}
                    loading="lazy"
                    decoding="async"
                    style={{ display: 'block', width: '100%', maxWidth: 630, height: 'auto', borderRadius: 8, margin: '0.75rem auto' }}
                    {...rest}
                  />
                ),
              }}
            >
              {news.body.join('\n\n')}
            </ReactMarkdown>
          </div>
        </div>
      </article>
    </div>,
    document.body
  );
};

export default NewsModal;

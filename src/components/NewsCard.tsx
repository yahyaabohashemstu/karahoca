import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LocalizedNewsItem } from '../data/news';

interface NewsCardProps {
  news: LocalizedNewsItem;
  onOpen?: (news: LocalizedNewsItem) => void;
  compact?: boolean;
  featured?: boolean;
}

const NewsCard: React.FC<NewsCardProps> = ({ news, onOpen, compact = false, featured = false }) => {
  const { t } = useTranslation();

  return (
    <article className={`news-card glass-panel${compact ? ' news-card--compact' : ''}${featured ? ' news-card--featured' : ''}`}>
      <figure className="news-card__media">
        <img
          src={news.image}
          alt={news.alt}
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
        />
      </figure>

      <div className="news-card__body">
        <div className="news-card__meta">
          <span className="news-card__chip">{news.category}</span>
          <time dateTime={news.publishedAt} className="news-card__date">
            {news.dateLabel}
          </time>
        </div>

        <h3 className="news-card__title">{news.title}</h3>
        <p className="news-card__excerpt">{news.excerpt}</p>

        {onOpen ? (
          <button
            type="button"
            className="news-card__action"
            onClick={() => onOpen(news)}
            aria-label={`${t('newsPage.readMore')} - ${news.title}`}
          >
            {t('newsPage.readMore')}
          </button>
        ) : (
          <Link
            to={`/news/${news.slug}`}
            className="news-card__action"
            aria-label={`${t('newsPage.readMore')} - ${news.title}`}
          >
            {t('newsPage.readMore')}
          </Link>
        )}
      </div>
    </article>
  );
};

export default NewsCard;

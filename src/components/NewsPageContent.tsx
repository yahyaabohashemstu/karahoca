import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import NewsCard from './NewsCard';
import NewsModal from './NewsModal';
import { getLocalizedNewsItems, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';

const NewsPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeNews, setActiveNews] = useState<LocalizedNewsItem | null>(null);
  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const newsItems = getLocalizedNewsItems(currentLanguage);
  const featuredNews = newsItems[0];

  return (
    <>
      <section className="section glass-section news-page__hero">
        <div className="section-divider"></div>
        <div className="container news-page__heroGrid">
          <div className="news-page__heroCopy fx-reveal">
            <span className="news-page__eyebrow">{t('newsPage.eyebrow')}</span>
            <h1 className="section-title news-page__title">{t('newsPage.pageTitle')}</h1>
            <p className="section-subtitle news-page__lead">{t('newsPage.pageDescription')}</p>

            {featuredNews && (
              <div className="news-page__heroMeta">
                <span className="news-page__heroTag">{t('newsPage.featuredLabel')}</span>
                <span className="news-page__heroDate">{featuredNews.dateLabel}</span>
              </div>
            )}

            {featuredNews && (
              <button
                type="button"
                className="btn btn--primary news-page__heroButton"
                onClick={() => setActiveNews(featuredNews)}
              >
                {t('newsPage.readMore')}
              </button>
            )}
          </div>

          {featuredNews && (
            <div className="news-page__heroFeatured fx-up">
              <NewsCard news={featuredNews} onOpen={setActiveNews} featured />
            </div>
          )}
        </div>
      </section>

      <section id="news-feed" className="section glass-section section--alt news-page__feed">
        <div className="section-divider"></div>
        <div className="container section__head fx-reveal">
          <span className="news-page__eyebrow">{t('newsPage.latestLabel')}</span>
          <h2 className="section-title">{t('newsPage.sectionTitle')}</h2>
          <p className="section-subtitle">{t('newsPage.sectionSubtitle')}</p>
        </div>

        <div className="container news-page__grid">
          {newsItems.map((item) => (
            <div key={item.id} className="fx-up">
              <NewsCard news={item} onOpen={setActiveNews} />
            </div>
          ))}
        </div>
      </section>

      <NewsModal news={activeNews} onClose={() => setActiveNews(null)} />
    </>
  );
};

export default NewsPageContent;

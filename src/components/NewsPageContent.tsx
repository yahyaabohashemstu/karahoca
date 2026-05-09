import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NewsCard from './NewsCard';
import { NewsListSchema } from './SchemaOrg';
import { getLocalizedNewsItems, fetchNewsFromApi, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';

const NewsPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [newsItems, setNewsItems] = useState<LocalizedNewsItem[]>(() => getLocalizedNewsItems(currentLanguage));
  const featuredNews = newsItems[0];

  useEffect(() => {
    let cancelled = false;
    fetchNewsFromApi(currentLanguage).then(apiItems => {
      if (cancelled) return;
      if (apiItems && apiItems.length > 0) {
        setNewsItems(apiItems);
      } else {
        setNewsItems(getLocalizedNewsItems(currentLanguage));
      }
    });
    return () => { cancelled = true; };
  }, [currentLanguage]);

  return (
    <>
      {/* JSON-LD ItemList of NewsArticle entries — surfaces the news index
          as a Google News rich result. Emitted from inside the content
          component (not the page wrapper) because this is where the items
          state actually lives. NewsListSchema cross-references the global
          Organization @id so the publisher block is not duplicated. */}
      {newsItems.length > 0 && (
        <NewsListSchema items={newsItems} lang={currentLanguage} />
      )}

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
              <Link
                to={`/news/${featuredNews.slug}`}
                className="btn btn--primary news-page__heroButton"
              >
                {t('newsPage.readMore')}
              </Link>
            )}
          </div>

          {featuredNews && (
            <div className="news-page__heroFeatured fx-up">
              <NewsCard news={featuredNews} featured />
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
              <NewsCard news={item} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default NewsPageContent;

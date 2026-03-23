import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NewsCard from './NewsCard';
import NewsModal from './NewsModal';
import { getLocalizedNewsItems, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';

const NewsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeNews, setActiveNews] = useState<LocalizedNewsItem | null>(null);
  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const newsItems = getLocalizedNewsItems(currentLanguage);
  const marqueeItems = [...newsItems, ...newsItems];

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

      <div className="container news-section__viewport fx-up">
        <div className="news-section__track">
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

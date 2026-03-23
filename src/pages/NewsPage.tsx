import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Header from '../components/Header';
import Footer from '../components/Footer';
import NewsPageContent from '../components/NewsPageContent';

const NewsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="news-page">
      <SEO
        title={t('newsPage.seo.title')}
        description={t('newsPage.seo.description')}
        keywords={t('newsPage.seo.keywords')}
        ogImage="/KARAHOCA-1-newPhoto.webp"
        canonicalUrl="https://karahoca.com/news"
      />

      <div className="bg-elements">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>

      <Header />
      <main>
        <NewsPageContent />
      </main>
      <Footer />
    </div>
  );
};

export default NewsPage;

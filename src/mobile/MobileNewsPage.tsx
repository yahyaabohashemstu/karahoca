import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import NewsPageContent from '../components/NewsPageContent';

export default function MobileNewsPage() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('newsPage.seo.title')}
        description={t('newsPage.seo.description')}
        keywords={t('newsPage.seo.keywords')}
        ogImage="/KARAHOCA-1-newPhoto.webp"
        canonicalUrl="https://karahoca.com/news"
      />

      <main className="news-page news-page--mobile">
        <NewsPageContent />
      </main>
    </>
  );
}

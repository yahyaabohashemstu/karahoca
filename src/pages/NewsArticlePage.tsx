import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { ArticleSchema, BreadcrumbSchema } from '../components/SchemaOrg';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getLocalizedNewsItems, fetchNewsFromApi, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';
import { useIsMobile } from '../hooks/useIsMobile';

const NewsArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isMobile = useIsMobile(768);
  const [article, setArticle] = useState<LocalizedNewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchNewsFromApi(currentLang).then(apiItems => {
      if (cancelled) return;
      const items = apiItems && apiItems.length > 0 ? apiItems : getLocalizedNewsItems(currentLang);
      const found = items.find(n => n.slug === slug) || null;
      setArticle(found);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [slug, currentLang]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loader" />
      </div>
    );
  }

  if (!article) {
    return (
      <>
        <Header />
        <main style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{t('newsPage.notFound', 'Article not found')}</h1>
          <Link to="/news" className="btn btn--primary">{t('newsPage.backToNews', 'Back to News')}</Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEO
        title={`${article.title} | KARAHOCA`}
        description={article.excerpt}
        ogImage={article.image}
        ogType="article"
        canonicalUrl={`https://karahoca.com/news/${article.slug}`}
      />
      <ArticleSchema
        headline={article.title}
        description={article.excerpt}
        image={article.image}
        datePublished={article.publishedAt}
        lang={currentLang}
      />
      <BreadcrumbSchema items={[
        { name: t('nav.home'), url: '/' },
        { name: t('newsPage.seo.title'), url: '/news' },
        { name: article.title, url: `/news/${article.slug}` },
      ]} />

      <Header />

      <main className="news-article-page">
        <article className="news-article">
          <div className="container" style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 1.5rem' }}>
            {/* Back link */}
            <Link to="/news" className="news-article__back" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem',
              fontWeight: 600, marginBottom: '2rem',
            }}>
              ← {t('newsPage.backToNews', 'Back to News')}
            </Link>

            {/* Meta */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1rem' }}>
              <span className="news-card__chip">{article.category}</span>
              <time dateTime={article.publishedAt} className="news-card__date">{article.dateLabel}</time>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '1.5rem' }}>
              {article.title}
            </h1>

            {/* Image */}
            <figure style={{ margin: '0 0 2rem', borderRadius: 16, overflow: 'hidden' }}>
              <img
                src={article.image}
                alt={article.alt}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </figure>

            {/* Body */}
            <div className="news-article__body" style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>
              {article.body.map((paragraph, i) => (
                <p key={i} style={{ marginBottom: '1.2rem' }}>{paragraph}</p>
              ))}
            </div>

            {/* Back to news */}
            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <Link to="/news" className="btn btn--primary">
                {t('newsPage.backToNews', 'Back to News')}
              </Link>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
};

export default NewsArticlePage;

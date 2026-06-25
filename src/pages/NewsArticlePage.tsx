import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SEO from '../components/SEO';
import { ArticleSchema, BreadcrumbSchema } from '../components/SchemaOrg';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getLocalizedNewsItems, fetchNewsFromApi, type LocalizedNewsItem } from '../data/news';
import { normalizeLanguageCode } from '../utils/language';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLocalizedPath } from '../hooks/useLocalizedPath';

const NewsArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isMobile = useIsMobile(768);
  const { lp } = useLocalizedPath();
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
          <Link to={lp('/news')} className="btn btn--primary">{t('newsPage.backToNews', 'Back to News')}</Link>
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
        canonicalUrl={`/news/${article.slug}`}
      />
      <ArticleSchema
        headline={article.title}
        description={article.excerpt}
        image={article.image}
        datePublished={article.publishedAt}
        lang={currentLang}
      />
      <BreadcrumbSchema items={[
        { name: t('nav.home'), url: lp('/') },
        { name: t('newsPage.seo.title'), url: lp('/news') },
        { name: article.title, url: lp(`/news/${article.slug}`) },
      ]} />

      <Header />

      <main className="news-article-page">
        <article className="news-article">
          <div className="container" style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 1.5rem' }}>
            {/* Back link */}
            <Link to={lp('/news')} className="news-article__back" style={{
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
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </figure>

            {/* Body — phase F markdown rendering.
                Existing articles authored as a paragraph array still
                render correctly because joining on "\n\n" → markdown's
                blank-line paragraph separator. New articles authored
                with the rich editor get full markdown semantics:
                headings, lists, blockquotes, links, code, tables. */}
            <div
              className="news-article__body"
              style={{ fontSize: '1.05rem', lineHeight: 1.8 }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node, ...rest }) => <p {...rest} style={{ marginBottom: '1.2rem' }} />,
                  h1: ({ node, ...rest }) => <h2 {...rest} style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 700, marginTop: '2rem', marginBottom: '1rem' }} />,
                  h2: ({ node, ...rest }) => <h3 {...rest} style={{ fontSize: isMobile ? '1.15rem' : '1.4rem', fontWeight: 700, marginTop: '1.6rem', marginBottom: '0.8rem' }} />,
                  h3: ({ node, ...rest }) => <h4 {...rest} style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '1.2rem', marginBottom: '0.6rem' }} />,
                  a: ({ node, href, ...rest }) => (
                    <a
                      href={href}
                      target={href?.startsWith('http') ? '_blank' : undefined}
                      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                      {...rest}
                    />
                  ),
                  blockquote: ({ node, ...rest }) => (
                    <blockquote
                      {...rest}
                      style={{
                        borderInlineStart: '4px solid var(--primary)',
                        paddingInlineStart: '1rem',
                        margin: '1.2rem 0',
                        color: 'var(--text-secondary, #555)',
                        fontStyle: 'italic',
                      }}
                    />
                  ),
                  ul: ({ node, ...rest }) => <ul {...rest} style={{ marginBottom: '1.2rem', paddingInlineStart: '1.5rem' }} />,
                  ol: ({ node, ...rest }) => <ol {...rest} style={{ marginBottom: '1.2rem', paddingInlineStart: '1.5rem' }} />,
                  img: ({ node, src, alt, ...rest }) => (
                    <img
                      src={src}
                      alt={alt || ''}
                      loading="lazy"
                      decoding="async"
                      // Cap inline body images well below the 800px text column
                      // and centre them — full-width inline photos read as too
                      // large/heavy. Stays responsive (100%) on narrow screens.
                      style={{ display: 'block', width: '100%', maxWidth: 520, height: 'auto', borderRadius: 8, margin: '1.2rem auto' }}
                      {...rest}
                    />
                  ),
                }}
              >
                {article.body.join('\n\n')}
              </ReactMarkdown>
            </div>

            {/* Back to news */}
            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <Link to={lp('/news')} className="btn btn--primary">
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

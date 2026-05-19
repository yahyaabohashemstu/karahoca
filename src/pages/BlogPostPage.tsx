/**
 * /:lang/blog/:slug — single blog post.
 *
 * Renders:
 *   - Hero image + category badge + title + meta (reading time, author, date)
 *   - Markdown body via react-markdown + remark-gfm (matches the
 *     AdminBlogEdit preview exactly)
 *   - Related posts strip (3 posts from same category)
 *   - WhatsApp + native share buttons
 *
 * SEO:
 *   - BlogPosting JSON-LD via SchemaOrg
 *   - hreflang for all 4 languages
 *   - og:image uses post.heroImage if absolute, else falls back to
 *     the brand-level OG card
 *
 * Side effects:
 *   - On mount, POST /api/blog/posts/:slug/view to increment view_count.
 *     Best-effort, fire-and-forget — no user-visible impact on failure.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SEO from '../components/SEO';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { BreadcrumbSchema, ArticleSchema } from '../components/SchemaOrg';
import { useLocalizedPath } from '../hooks/useLocalizedPath';
import { normalizeLanguageCode } from '../utils/language';
import { apiFetch } from '../utils/apiFetch';
import '../styles/blog.css';

interface BlogPost {
  id: string;
  slug: string;
  image: string | null;
  heroImage: string | null;
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  authorName: string | null;
  authorAvatar: string | null;
  readingTime: number;
  viewCount: number;
  featured: boolean;
  publishedAt: string;
  tags: string[];
  category: {
    id: string;
    slug: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

interface RelatedPost {
  id: string;
  slug: string;
  image: string | null;
  title: string;
  excerpt: string;
  readingTime: number;
}

const STRINGS: Record<string, Record<string, string>> = {
  ar: {
    backToBlog: '← العودة للمدوّنة',
    minRead: 'دقائق قراءة',
    minReadSingle: 'دقيقة قراءة',
    publishedOn: 'نُشِر في',
    related: 'منشورات ذات صلة',
    share: 'شارك',
    shareWa: 'شارك على واتساب',
    notFound: 'المنشور غير موجود',
    notFoundBack: 'العودة إلى المدوّنة',
    by: 'بقلم',
  },
  en: {
    backToBlog: '← Back to blog',
    minRead: 'min read',
    minReadSingle: 'min read',
    publishedOn: 'Published on',
    related: 'Related posts',
    share: 'Share',
    shareWa: 'Share on WhatsApp',
    notFound: 'Post not found',
    notFoundBack: 'Back to blog',
    by: 'by',
  },
  tr: {
    backToBlog: '← Bloga geri dön',
    minRead: 'dk okuma',
    minReadSingle: 'dk okuma',
    publishedOn: 'Yayın tarihi',
    related: 'İlgili yazılar',
    share: 'Paylaş',
    shareWa: 'WhatsApp\'ta paylaş',
    notFound: 'Yazı bulunamadı',
    notFoundBack: 'Bloga geri dön',
    by: 'tarafından',
  },
  ru: {
    backToBlog: '← Назад в блог',
    minRead: 'мин чтения',
    minReadSingle: 'мин чтения',
    publishedOn: 'Опубликовано',
    related: 'Похожие статьи',
    share: 'Поделиться',
    shareWa: 'Поделиться в WhatsApp',
    notFound: 'Статья не найдена',
    notFoundBack: 'Назад в блог',
    by: 'автор',
  },
};

const formatDate = (iso: string, lang: string): string => {
  try {
    return new Date(iso).toLocaleDateString(
      { ar: 'ar-EG', en: 'en-US', tr: 'tr-TR', ru: 'ru-RU' }[lang] || 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' },
    );
  } catch {
    return iso.slice(0, 10);
  }
};

const buildWhatsAppShareUrl = (post: BlogPost, currentUrl: string): string => {
  const text = `${post.title}\n\n${currentUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const t = STRINGS[lang] || STRINGS.ar;
  const { lp } = useLocalizedPath();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);

    apiFetch(`/api/blog/posts/${encodeURIComponent(slug)}?lang=${lang}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPost(d?.item || null);
        setRelated(d?.related || []);
        setLoading(false);

        // Fire-and-forget view-count increment. We do this AFTER the
        // article HTML has rendered so the count tracks actual reads,
        // not redirect probes. CSRF is required by the public mutation
        // gate; apiFetch attaches the cookie automatically.
        if (d?.item) {
          apiFetch(`/api/blog/posts/${encodeURIComponent(slug)}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).catch(() => { /* ignored */ });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPost(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug, lang]);

  if (loading) {
    return (
      <>
        <Header />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loader" />
        </main>
        <Footer />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <SEO title={t.notFound} description={t.notFound} noindex />
        <Header />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
          <h1>{t.notFound}</h1>
          <Link to={lp('/blog')} className="btn btn-primary">{t.notFoundBack}</Link>
        </main>
        <Footer />
      </>
    );
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : `https://karahoca.com${lp(`/blog/${post.slug}`)}`;
  const heroImage = post.heroImage || post.image || '/KARAHOCA-1-newPhoto.webp';

  return (
    <div className="blog-post-page">
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        keywords={post.tags.join(', ')}
        ogImage={heroImage}
        ogType="article"
        canonicalUrl={`https://karahoca.com/blog/${post.slug}`}
      />
      <BreadcrumbSchema items={[
        { name: 'KARAHOCA', url: '/' },
        { name: 'Blog', url: '/blog' },
        { name: post.title, url: `/blog/${post.slug}` },
      ]} />
      <ArticleSchema
        headline={post.title}
        description={post.excerpt}
        image={heroImage}
        datePublished={post.publishedAt}
        lang={lang}
      />

      <Header />

      <main className="blog-post-main">
        {/* Hero */}
        <article className="blog-post-article">
          {heroImage && (
            <div className="blog-post-hero">
              <img src={heroImage} alt={post.title} className="blog-post-hero__img" />
            </div>
          )}

          <div className="container blog-post-container">
            <Link to={lp('/blog')} className="blog-post-back">
              {t.backToBlog}
            </Link>

            <header className="blog-post-header">
              {post.category && (
                <Link
                  to={lp(`/blog?category=${post.category.slug}`)}
                  className="blog-category-badge"
                  style={post.category.color ? { background: post.category.color } : undefined}
                >
                  {post.category.icon} {post.category.name}
                </Link>
              )}
              <h1 className="blog-post-title">{post.title}</h1>
              <p className="blog-post-excerpt">{post.excerpt}</p>

              <div className="blog-post-meta">
                <span>📅 {formatDate(post.publishedAt, lang)}</span>
                <span>⏱ {post.readingTime} {post.readingTime === 1 ? t.minReadSingle : t.minRead}</span>
                {post.authorName && <span>✍️ {t.by} {post.authorName}</span>}
              </div>
            </header>

            <div className="blog-post-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Open external links in a new tab without losing the
                  // referrer policy (which `<a target=_blank>` strips
                  // for `noopener`).
                  a: ({ href, children, ...props }) => {
                    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                    }
                    return <a href={href} {...props}>{children}</a>;
                  },
                  img: ({ src, alt }) => <img src={src || ''} alt={alt || ''} loading="lazy" />,
                }}
              >
                {post.body}
              </ReactMarkdown>
            </div>

            {/* Tag cloud */}
            {post.tags.length > 0 && (
              <div className="blog-post-tags">
                {post.tags.map((tag) => (
                  <span key={tag} className="blog-tag">#{tag}</span>
                ))}
              </div>
            )}

            {/* Share */}
            <div className="blog-post-share">
              <a
                href={buildWhatsAppShareUrl(post, currentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="blog-share-btn blog-share-btn--whatsapp"
              >
                💬 {t.shareWa}
              </a>
            </div>
          </div>
        </article>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="blog-related">
            <div className="container">
              <h2 className="blog-section-title">{t.related}</h2>
              <div className="blog-related__grid">
                {related.map((r) => (
                  <Link key={r.id} to={lp(`/blog/${r.slug}`)} className="blog-related-card">
                    {r.image && (
                      <div className="blog-related-card__media">
                        <img src={r.image} alt={r.title} loading="lazy" />
                      </div>
                    )}
                    <div className="blog-related-card__body">
                      <h3 className="blog-related-card__title">{r.title}</h3>
                      <span className="blog-related-card__meta">
                        ⏱ {r.readingTime} {r.readingTime === 1 ? t.minReadSingle : t.minRead}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogPostPage;

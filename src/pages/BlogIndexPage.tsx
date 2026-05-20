/**
 * /:lang/blog — public blog index.
 *
 * Layout:
 *   - Hero strip introducing the blog
 *   - Category pill row (sticky on scroll on desktop)
 *   - Featured posts: large 2-up grid
 *   - All posts: 3-column responsive grid with pagination
 *
 * Data sources:
 *   GET /api/blog/categories?lang=...
 *   GET /api/blog/posts?lang=...&page=...&limit=...
 *   GET /api/blog/posts?lang=...&featured=1&limit=2  (separate fetch
 *     so the featured strip stays full even on a category filter)
 *
 * SEO:
 *   - <SEO> emits hreflang for all 4 languages + x-default → AR
 *   - BreadcrumbSchema and CollectionPage JSON-LD via SchemaOrg
 *   - og:image points at the brand-level OG card (runtime generator)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { BreadcrumbSchema } from '../components/SchemaOrg';
import { useLocalizedPath } from '../hooks/useLocalizedPath';
import { normalizeLanguageCode } from '../utils/language';
import { apiFetch } from '../utils/apiFetch';
import '../styles/blog.css';

interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string | null;
  icon: string | null;
  postCount: number;
}

interface BlogPostSummary {
  id: string;
  slug: string;
  image: string | null;
  heroImage: string | null;
  title: string;
  excerpt: string;
  readingTime: number;
  publishedAt: string;
  featured: boolean;
  authorName: string | null;
  tags: string[];
  category: {
    slug: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

const PAGE_SIZE = 12;

/** Localised UI strings for the blog index/category page. */
const STRINGS: Record<string, Record<string, string>> = {
  ar: {
    pageTitle: 'مدوّنة قره خوجة',
    pageSubtitle: 'نصائح، أدلّة، وأفكار عملية حول التنظيف الاحترافي ومنتجات DIOX و AYLUX',
    allPosts: 'كل المنشورات',
    featured: 'المختارة',
    latest: 'الأحدث',
    minRead: 'دقائق قراءة',
    minReadSingle: 'دقيقة قراءة',
    readMore: 'اقرأ المزيد',
    noPosts: 'لا توجد منشورات بعد.',
    prev: '← السابق',
    next: 'التالي →',
    page: 'صفحة',
    of: 'من',
    seoTitle: 'مدوّنة قره خوجة — نصائح وأدلّة التنظيف',
    seoDescription: 'مقالات حول طرق التنظيف الاحترافية، أدلّة استخدام منتجات DIOX و AYLUX، ونصائح لمالكي الفنادق والمنشآت التجارية.',
    seoKeywords: 'مدونة, تنظيف, نصائح, DIOX, AYLUX, قره خوجة, طرق استخدام',
  },
  en: {
    pageTitle: 'KARAHOCA Blog',
    pageSubtitle: 'Tips, guides, and practical ideas on professional cleaning with DIOX and AYLUX',
    allPosts: 'All posts',
    featured: 'Featured',
    latest: 'Latest',
    minRead: 'min read',
    minReadSingle: 'min read',
    readMore: 'Read more',
    noPosts: 'No posts yet.',
    prev: '← Previous',
    next: 'Next →',
    page: 'Page',
    of: 'of',
    seoTitle: 'KARAHOCA Blog — Cleaning Tips and Guides',
    seoDescription: 'Articles on professional cleaning methods, usage guides for DIOX and AYLUX products, and tips for hotels and businesses.',
    seoKeywords: 'blog, cleaning, tips, DIOX, AYLUX, KARAHOCA, how-to',
  },
  tr: {
    pageTitle: 'KARAHOCA Blog',
    pageSubtitle: 'DIOX ve AYLUX ile profesyonel temizlik üzerine ipuçları, rehberler ve pratik fikirler',
    allPosts: 'Tüm yazılar',
    featured: 'Öne çıkanlar',
    latest: 'En yeni',
    minRead: 'dk okuma',
    minReadSingle: 'dk okuma',
    readMore: 'Devamını oku',
    noPosts: 'Henüz yazı yok.',
    prev: '← Önceki',
    next: 'Sonraki →',
    page: 'Sayfa',
    of: '/',
    seoTitle: 'KARAHOCA Blog — Temizlik İpuçları ve Rehberler',
    seoDescription: 'Profesyonel temizlik yöntemleri, DIOX ve AYLUX ürün kullanım rehberleri ve oteller için ipuçları.',
    seoKeywords: 'blog, temizlik, ipuçları, DIOX, AYLUX, KARAHOCA, nasıl yapılır',
  },
  ru: {
    pageTitle: 'Блог KARAHOCA',
    pageSubtitle: 'Советы, руководства и практические идеи по профессиональной уборке с DIOX и AYLUX',
    allPosts: 'Все статьи',
    featured: 'Избранное',
    latest: 'Свежие',
    minRead: 'мин чтения',
    minReadSingle: 'мин чтения',
    readMore: 'Читать дальше',
    noPosts: 'Пока статей нет.',
    prev: '← Предыдущая',
    next: 'Следующая →',
    page: 'Стр.',
    of: 'из',
    seoTitle: 'Блог KARAHOCA — Советы и гиды по уборке',
    seoDescription: 'Статьи о профессиональных методах уборки, руководства по продуктам DIOX и AYLUX, советы для отелей и бизнеса.',
    seoKeywords: 'блог, уборка, советы, DIOX, AYLUX, KARAHOCA, как сделать',
  },
};

const BlogIndexPage: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const t = STRINGS[lang] || STRINGS.ar;
  const { lp } = useLocalizedPath();

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const categorySlug = searchParams.get('category') || '';

  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<BlogPostSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/blog/categories?lang=${lang}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.items) setCategories(d.items); })
      .catch(() => { /* silent — empty category strip is acceptable */ });
    return () => { cancelled = true; };
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      lang,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (categorySlug) params.set('category', categorySlug);

    apiFetch(`/api/blog/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPosts(d?.items || []);
        setTotalPages(d?.totalPages || 1);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lang, page, categorySlug]);

  // Featured strip — separate fetch so it stays full even on category filters.
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/blog/posts?lang=${lang}&featured=1&limit=2`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setFeaturedPosts(d?.items || []); })
      .catch(() => { /* */ });
    return () => { cancelled = true; };
  }, [lang]);

  const handleCategoryClick = useCallback((slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug === categorySlug) next.delete('category');
    else next.set('category', slug);
    next.delete('page');
    setSearchParams(next);
  }, [searchParams, categorySlug, setSearchParams]);

  const handlePage = useCallback((nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
    // Scroll to top of post grid.
    document.getElementById('blog-grid-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [searchParams, setSearchParams]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug) || null,
    [categories, categorySlug],
  );

  return (
    <div className="blog-page">
      <SEO
        title={t.seoTitle}
        description={t.seoDescription}
        keywords={t.seoKeywords}
        ogImage="/KARAHOCA-1-newPhoto.webp"
        canonicalUrl="https://karahoca.com/blog"
      />
      <BreadcrumbSchema items={[
        { name: 'KARAHOCA', url: '/' },
        { name: t.pageTitle, url: '/blog' },
      ]} />

      <Header />

      <main className="blog-main">
        {/* Hero */}
        <section className="blog-hero">
          <div className="container blog-hero__inner">
            <h1 className="blog-hero__title">{t.pageTitle}</h1>
            <p className="blog-hero__subtitle">{t.pageSubtitle}</p>
          </div>
        </section>

        {/* Category strip */}
        {categories.length > 0 && (
          <section className="blog-category-strip">
            <div className="container">
              <div className="blog-category-strip__pills">
                <button
                  type="button"
                  className={`blog-category-pill ${!categorySlug ? 'is-active' : ''}`}
                  onClick={() => handleCategoryClick('')}
                >
                  {t.allPosts}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`blog-category-pill ${categorySlug === cat.slug ? 'is-active' : ''}`}
                    onClick={() => handleCategoryClick(cat.slug)}
                    style={cat.color && categorySlug === cat.slug ? { background: cat.color, borderColor: cat.color, color: '#fff' } : undefined}
                  >
                    {cat.icon ? <span aria-hidden="true">{cat.icon}</span> : null}{' '}
                    {cat.name}{' '}
                    <span className="blog-category-pill__count">({cat.postCount})</span>
                  </button>
                ))}
              </div>
              {activeCategory?.description && (
                <p className="blog-category-strip__desc">{activeCategory.description}</p>
              )}
            </div>
          </section>
        )}

        {/* Featured (hidden when filtering, since the filter is the
            user's stated intent) */}
        {!categorySlug && featuredPosts.length > 0 && (
          <section className="blog-featured">
            <div className="container">
              <h2 className="blog-section-title">{t.featured}</h2>
              <div className="blog-featured__grid">
                {featuredPosts.map((post) => (
                  <FeaturedCard key={post.id} post={post} t={t} lp={lp} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* All posts grid */}
        <section className="blog-grid-section" id="blog-grid-anchor">
          <div className="container">
            <h2 className="blog-section-title">{categorySlug ? activeCategory?.name : t.latest}</h2>
            {loading ? (
              <div className="blog-loading"><div className="loader" /></div>
            ) : posts.length === 0 ? (
              <p className="blog-empty">{t.noPosts}</p>
            ) : (
              <>
                <div className="blog-grid">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} t={t} lp={lp} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <nav className="blog-pagination" aria-label="Pagination">
                    <button
                      type="button"
                      onClick={() => handlePage(page - 1)}
                      disabled={page <= 1}
                      className="blog-pagination__btn"
                    >
                      {t.prev}
                    </button>
                    <span className="blog-pagination__status">
                      {t.page} {page} {t.of} {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePage(page + 1)}
                      disabled={page >= totalPages}
                      className="blog-pagination__btn"
                    >
                      {t.next}
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

interface CardProps {
  post: BlogPostSummary;
  t: Record<string, string>;
  lp: (path: string) => string;
}

const FeaturedCard: React.FC<CardProps> = ({ post, t, lp }) => (
  <Link to={lp(`/blog/${post.slug}`)} className="blog-featured-card">
    {post.heroImage && (
      <div className="blog-featured-card__media">
        <img src={post.heroImage} alt={post.title} loading="lazy" />
      </div>
    )}
    <div className="blog-featured-card__body">
      {post.category && (
        <span
          className="blog-category-badge"
          style={post.category.color ? { background: post.category.color } : undefined}
        >
          {post.category.icon} {post.category.name}
        </span>
      )}
      <h3 className="blog-featured-card__title">{post.title}</h3>
      <p className="blog-featured-card__excerpt">{post.excerpt}</p>
      <div className="blog-card__meta">
        <span>⏱ {post.readingTime} {post.readingTime === 1 ? t.minReadSingle : t.minRead}</span>
        {post.authorName && <span>· {post.authorName}</span>}
      </div>
    </div>
  </Link>
);

const PostCard: React.FC<CardProps> = ({ post, t, lp }) => (
  <Link to={lp(`/blog/${post.slug}`)} className="blog-card">
    {post.image && (
      <div className="blog-card__media">
        <img src={post.image} alt={post.title} loading="lazy" />
      </div>
    )}
    <div className="blog-card__body">
      {post.category && (
        <span
          className="blog-category-badge"
          style={post.category.color ? { background: post.category.color } : undefined}
        >
          {post.category.icon} {post.category.name}
        </span>
      )}
      <h3 className="blog-card__title">{post.title}</h3>
      <p className="blog-card__excerpt">{post.excerpt}</p>
      <div className="blog-card__meta">
        <span>⏱ {post.readingTime} {post.readingTime === 1 ? t.minReadSingle : t.minRead}</span>
      </div>
    </div>
  </Link>
);

export default BlogIndexPage;

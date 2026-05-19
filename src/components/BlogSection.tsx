import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '../hooks/useLocalizedPath';
import { normalizeLanguageCode } from '../utils/language';
import { apiFetch } from '../utils/apiFetch';
import '../styles/blog.css';

/**
 * Home-page Blog teaser strip.
 *
 * Fetches the 3 latest published blog posts and shows them as cards
 * with category badge + title + reading time + a "Read more" link.
 * Below the grid sits a primary CTA to /blog so visitors who scan
 * the home page have one obvious tap to reach the full archive.
 *
 * Hidden gracefully when the blog has fewer than 1 published post —
 * an empty strip with a "no posts yet" line is worse UX than no
 * strip at all.
 */

interface BlogTeaserPost {
  id: string;
  slug: string;
  image: string | null;
  heroImage: string | null;
  title: string;
  excerpt: string;
  readingTime: number;
  category: {
    slug: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

const STRINGS: Record<string, Record<string, string>> = {
  ar: {
    sectionLabel: 'المدوّنة',
    sectionTitle: 'نصائح وأدلّة من خبراء كاراهوكا',
    sectionSubtitle: 'مقالات عملية حول التنظيف الاحترافي، اختيار المنتجات، والاستخدام الأمثل لـ DIOX و AYLUX.',
    viewAll: 'عرض كل المنشورات ←',
    minRead: 'دقائق قراءة',
    minReadSingle: 'دقيقة',
  },
  en: {
    sectionLabel: 'The Blog',
    sectionTitle: 'Tips and guides from KARAHOCA experts',
    sectionSubtitle: 'Practical articles on professional cleaning, picking the right product, and getting the most out of DIOX and AYLUX.',
    viewAll: 'View all posts →',
    minRead: 'min read',
    minReadSingle: 'min',
  },
  tr: {
    sectionLabel: 'Blog',
    sectionTitle: 'KARAHOCA uzmanlarından ipuçları ve rehberler',
    sectionSubtitle: 'Profesyonel temizlik, doğru ürün seçimi ve DIOX ile AYLUX\'tan maksimum verim almak üzerine pratik yazılar.',
    viewAll: 'Tüm yazılar →',
    minRead: 'dk okuma',
    minReadSingle: 'dk',
  },
  ru: {
    sectionLabel: 'Блог',
    sectionTitle: 'Советы и руководства от экспертов KARAHOCA',
    sectionSubtitle: 'Практические статьи о профессиональной уборке, выборе продуктов и максимальной отдаче от DIOX и AYLUX.',
    viewAll: 'Все статьи →',
    minRead: 'мин чтения',
    minReadSingle: 'мин',
  },
};

const BlogSection: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const t = STRINGS[lang] || STRINGS.ar;
  const { lp } = useLocalizedPath();

  const [posts, setPosts] = useState<BlogTeaserPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/blog/posts?lang=${lang}&limit=3&page=1`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPosts(Array.isArray(d?.items) ? d.items : []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [lang]);

  // Don't render the section at all when there's nothing to show —
  // better than a half-empty placeholder.
  if (loaded && posts.length === 0) return null;

  return (
    <section className="home-blog-section" aria-labelledby="home-blog-heading">
      <div className="container home-blog-section__inner">
        <header className="home-blog-section__header">
          <span className="home-blog-section__eyebrow">{t.sectionLabel}</span>
          <h2 id="home-blog-heading" className="home-blog-section__title">{t.sectionTitle}</h2>
          <p className="home-blog-section__subtitle">{t.sectionSubtitle}</p>
        </header>

        {!loaded ? (
          <div className="home-blog-section__loading"><div className="loader" /></div>
        ) : (
          <>
            <div className="home-blog-section__grid">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={lp(`/blog/${post.slug}`)}
                  className="home-blog-card"
                >
                  {post.image && (
                    <div className="home-blog-card__media">
                      <img src={post.image} alt={post.title} loading="lazy" />
                    </div>
                  )}
                  <div className="home-blog-card__body">
                    {post.category && (
                      <span
                        className="home-blog-card__category"
                        style={post.category.color ? { background: post.category.color } : undefined}
                      >
                        {post.category.icon ? `${post.category.icon} ` : ''}{post.category.name}
                      </span>
                    )}
                    <h3 className="home-blog-card__title">{post.title}</h3>
                    <p className="home-blog-card__excerpt">{post.excerpt}</p>
                    <span className="home-blog-card__meta">
                      ⏱ {post.readingTime} {post.readingTime === 1 ? t.minReadSingle : t.minRead}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="home-blog-section__cta">
              <Link to={lp('/blog')} className="home-blog-section__cta-link">
                {t.viewAll}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default BlogSection;

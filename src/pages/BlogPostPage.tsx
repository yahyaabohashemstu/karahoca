/**
 * /:lang/blog/:slug — single blog post (premium magazine-style layout).
 *
 * Layout (top → bottom):
 *   1. Reading-progress bar pinned to the top of the viewport
 *   2. Full-width cinematic hero — image + dark gradient overlay +
 *      breadcrumb + category badge + title + dek + meta strip
 *   3. Three-column content layout (desktop):
 *        ─────────────────────────────────────────────────────
 *        [floating share rail]   [article column]   [sticky TOC]
 *        ─────────────────────────────────────────────────────
 *      On tablet (<1100px) the TOC moves into a `<details>` block
 *      above the article; on phone (<768px) the share rail folds
 *      into the action bar at the bottom of the article.
 *   4. Tag cloud + share-CTAs + author byline
 *   5. Related posts strip — 3-up grid with stronger cards
 *
 * SEO + analytics unchanged from the previous revision: BlogPosting
 * JSON-LD, hreflang, og:image, fire-and-forget view count increment.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

const STRINGS: Record<string, Record<string, string>> = {
  ar: {
    home: 'الرئيسية',
    blog: 'المدوّنة',
    backToBlog: 'العودة للمدوّنة',
    minRead: 'دقائق قراءة',
    minReadSingle: 'دقيقة قراءة',
    publishedOn: 'نُشِر في',
    tableOfContents: 'محتويات المقال',
    related: 'منشورات قد تعجبك',
    relatedSub: 'استكمل القراءة مع مقالات أخرى من نفس التصنيف',
    share: 'شارك',
    shareWa: 'شارك على واتساب',
    shareTw: 'شارك على تويتر',
    copyLink: 'انسخ الرابط',
    copied: 'تمّ النسخ ✓',
    notFound: 'المنشور غير موجود',
    notFoundBack: 'العودة إلى المدوّنة',
    by: 'بقلم',
    views: 'مشاهدة',
  },
  en: {
    home: 'Home',
    blog: 'Blog',
    backToBlog: 'Back to blog',
    minRead: 'min read',
    minReadSingle: 'min read',
    publishedOn: 'Published',
    tableOfContents: 'In this article',
    related: 'You might also like',
    relatedSub: 'Keep reading with more articles from the same category',
    share: 'Share',
    shareWa: 'Share on WhatsApp',
    shareTw: 'Share on Twitter',
    copyLink: 'Copy link',
    copied: 'Copied ✓',
    notFound: 'Post not found',
    notFoundBack: 'Back to blog',
    by: 'by',
    views: 'views',
  },
  tr: {
    home: 'Ana sayfa',
    blog: 'Blog',
    backToBlog: 'Bloga geri dön',
    minRead: 'dk okuma',
    minReadSingle: 'dk okuma',
    publishedOn: 'Yayın tarihi',
    tableOfContents: 'Bu yazıda',
    related: 'Bunları da beğenebilirsin',
    relatedSub: 'Aynı kategorideki diğer yazılarla okumaya devam et',
    share: 'Paylaş',
    shareWa: 'WhatsApp\'ta paylaş',
    shareTw: 'Twitter\'da paylaş',
    copyLink: 'Bağlantıyı kopyala',
    copied: 'Kopyalandı ✓',
    notFound: 'Yazı bulunamadı',
    notFoundBack: 'Bloga geri dön',
    by: 'tarafından',
    views: 'görüntüleme',
  },
  ru: {
    home: 'Главная',
    blog: 'Блог',
    backToBlog: 'Назад в блог',
    minRead: 'мин чтения',
    minReadSingle: 'мин чтения',
    publishedOn: 'Опубликовано',
    tableOfContents: 'В этой статье',
    related: 'Вам также может понравиться',
    relatedSub: 'Продолжите чтение со статьями из той же категории',
    share: 'Поделиться',
    shareWa: 'WhatsApp',
    shareTw: 'Twitter',
    copyLink: 'Копировать ссылку',
    copied: 'Скопировано ✓',
    notFound: 'Статья не найдена',
    notFoundBack: 'Назад в блог',
    by: 'автор',
    views: 'просмотров',
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

const buildWhatsAppShareUrl = (title: string, url: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${title}\n\n${url}`)}`;

const buildTwitterShareUrl = (title: string, url: string) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

/**
 * Convert a heading text to a URL-safe id. Unicode-aware (handles
 * Arabic / Cyrillic by leaving the letters intact and only swapping
 * whitespace + punctuation). Matches what react-markdown's slugger
 * produces for the same headings inside the article body.
 */
const slugifyHeading = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[*_`~[\]()#>!]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/**
 * Pre-walk the markdown body for H2/H3 headings to build a table of
 * contents BEFORE the body renders. Keeps the TOC and the article in
 * sync (they both derive heading ids from the same slugify function).
 *
 * We deliberately ONLY pull H2/H3 — H1 is the article title (already
 * shown in the hero), and H4+ is too deep to surface in a TOC.
 */
const extractToc = (markdown: string): TocEntry[] => {
  if (!markdown) return [];
  const out: TocEntry[] = [];
  const lines = markdown.split('\n');
  let inCodeFence = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCodeFence = !inCodeFence; continue; }
    if (inCodeFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = (m[1].length === 2 ? 2 : 3) as 2 | 3;
    const text = m[2].replace(/[*_`]/g, '').trim();
    if (!text) continue;
    out.push({ id: slugifyHeading(text), text, level });
  }
  return out;
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
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const articleRef = useRef<HTMLDivElement | null>(null);

  // ── Data fetch ─────────────────────────────────────────────────────
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

        if (d?.item) {
          apiFetch(`/api/blog/posts/${encodeURIComponent(slug)}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).catch(() => { /* fire-and-forget */ });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPost(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug, lang]);

  // ── Reading-progress bar ──────────────────────────────────────────
  // Tracks how far through the article column the visitor has scrolled.
  // Updates a CSS custom property so the progress bar transition stays
  // smooth even at 60Hz scroll updates.
  useEffect(() => {
    if (!post) return;
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      const pct = total > 0 ? Math.max(0, Math.min(1, scrolled / total)) : 0;
      setProgress(pct);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [post]);

  const toc = useMemo(() => extractToc(post?.body || ''), [post?.body]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard rejected — silently swallow */
    }
  };

  // ── Render guards ─────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Header />
        <main className="blog-post-loading">
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
        <main className="blog-post-not-found">
          <h1>{t.notFound}</h1>
          <Link to={lp('/blog')} className="blog-cta-primary">{t.notFoundBack}</Link>
        </main>
        <Footer />
      </>
    );
  }

  const currentUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://karahoca.com${lp(`/blog/${post.slug}`)}`;
  const heroImage = post.heroImage || post.image || '/KARAHOCA-1-newPhoto.webp';
  const isRtl = lang === 'ar';

  return (
    <div className={`blog-post-page ${isRtl ? 'is-rtl' : ''}`}>
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

      {/* Reading-progress bar */}
      <div className="blog-progress-bar" role="presentation" aria-hidden="true">
        <div
          className="blog-progress-bar__fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <Header />

      <main className="blog-post-main">
        {/* ── Editorial hero ──────────────────────────────────────────
            Split layout: text + product image side by side on desktop,
            stacked (text → image) on mobile. The background is a
            blurred/tinted version of the hero image so the whole
            page feels color-coordinated with the article without the
            image being stretched as a full-bleed banner. */}
        <header className="blog-hero-v3">
          {/* Soft blurred backdrop using the same image — gives the
              hero a cohesive colour without the harsh detail of a
              stretched product photo. */}
          <div
            className="blog-hero-v3__backdrop"
            style={{ backgroundImage: `url("${heroImage}")` }}
            aria-hidden="true"
          />
          <div className="blog-hero-v3__veil" aria-hidden="true" />

          <div className="container blog-hero-v3__inner">
            {/* Breadcrumb */}
            <nav className="blog-hero-v3__breadcrumb" aria-label="Breadcrumb">
              <Link to={lp('/')}>{t.home}</Link>
              <span aria-hidden="true">/</span>
              <Link to={lp('/blog')}>{t.blog}</Link>
              {post.category && (
                <>
                  <span aria-hidden="true">/</span>
                  <Link to={lp(`/blog?category=${post.category.slug}`)}>
                    {post.category.icon ? `${post.category.icon} ` : ''}{post.category.name}
                  </Link>
                </>
              )}
            </nav>

            <div className="blog-hero-v3__grid">
              {/* Text column */}
              <div className="blog-hero-v3__text">
                {post.category && (
                  <span
                    className="blog-hero-v3__category"
                    style={post.category.color ? {
                      background: post.category.color,
                      boxShadow: `0 8px 28px ${post.category.color}40`,
                    } : undefined}
                  >
                    {post.category.icon ? `${post.category.icon}  ` : ''}{post.category.name}
                  </span>
                )}

                <h1 className="blog-hero-v3__title">{post.title}</h1>
                <p className="blog-hero-v3__dek">{post.excerpt}</p>

                <div className="blog-hero-v3__meta">
                  {post.authorName && (
                    <span className="blog-hero-v3__meta-item">
                      <span aria-hidden="true">✍️</span>
                      {t.by} <strong>{post.authorName}</strong>
                    </span>
                  )}
                  <span className="blog-hero-v3__meta-item">
                    <span aria-hidden="true">📅</span>
                    {formatDate(post.publishedAt, lang)}
                  </span>
                  <span className="blog-hero-v3__meta-item">
                    <span aria-hidden="true">⏱️</span>
                    {post.readingTime} {post.readingTime === 1 ? t.minReadSingle : t.minRead}
                  </span>
                  {post.viewCount > 0 && (
                    <span className="blog-hero-v3__meta-item">
                      <span aria-hidden="true">👁️</span>
                      {post.viewCount.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')} {t.views}
                    </span>
                  )}
                </div>
              </div>

              {/* Image column — the actual product photo lives inside
                  a contained card with rounded corners + soft shadow,
                  so it reads as a designed asset instead of a
                  cropped background. */}
              <div className="blog-hero-v3__image-wrap">
                <div className="blog-hero-v3__image-frame">
                  <img
                    src={heroImage}
                    alt={post.title}
                    className="blog-hero-v3__image"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Three-column body ──────────────────────────────────────── */}
        <div className="blog-body-layout" ref={articleRef}>
          {/* Floating share rail (desktop only) */}
          <aside className="blog-share-rail" aria-label={t.share}>
            <a
              href={buildWhatsAppShareUrl(post.title, currentUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-share-rail__btn blog-share-rail__btn--whatsapp"
              aria-label={t.shareWa}
              title={t.shareWa}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.526 5.845L.057 23.428a.5.5 0 0 0 .515.572l5.764-1.512A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882c-1.85 0-3.574-.497-5.063-1.362l-.363-.214-3.76.986 1.003-3.668-.236-.375A9.855 9.855 0 0 1 2.118 12c0-5.449 4.433-9.882 9.882-9.882 5.449 0 9.882 4.433 9.882 9.882 0 5.449-4.433 9.882-9.882 9.882z"/>
              </svg>
            </a>
            <a
              href={buildTwitterShareUrl(post.title, currentUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-share-rail__btn blog-share-rail__btn--twitter"
              aria-label={t.shareTw}
              title={t.shareTw}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="blog-share-rail__btn blog-share-rail__btn--copy"
              aria-label={t.copyLink}
              title={copied ? t.copied : t.copyLink}
            >
              {copied ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
            </button>
          </aside>

          {/* Article content */}
          <article className="blog-article-v2">
            {/* Mobile TOC (collapsed by default) */}
            {toc.length > 0 && (
              <details className="blog-toc-mobile">
                <summary>{t.tableOfContents}</summary>
                <ol>
                  {toc.map((entry) => (
                    <li key={entry.id} className={`blog-toc-mobile__item-l${entry.level}`}>
                      <a href={`#${entry.id}`}>{entry.text}</a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className="blog-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Assign deterministic ids to H2/H3 so the sticky TOC
                  // anchors land on the right heading. Matches the
                  // slugifyHeading() pre-pass in extractToc().
                  h2: ({ children, ...props }) => {
                    const text = String(children).replace(/[*_`]/g, '');
                    return <h2 id={slugifyHeading(text)} {...props}>{children}</h2>;
                  },
                  h3: ({ children, ...props }) => {
                    const text = String(children).replace(/[*_`]/g, '');
                    return <h3 id={slugifyHeading(text)} {...props}>{children}</h3>;
                  },
                  a: ({ href, children, ...props }) => {
                    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                    }
                    return <a href={href} {...props}>{children}</a>;
                  },
                  // Wrap every image in a figure so an optional alt
                  // text doubles as a caption beneath. Lazy-loaded,
                  // rounded corners + drop shadow via blog.css.
                  img: ({ src, alt }) => (
                    <figure className="blog-figure">
                      <img src={src || ''} alt={alt || ''} loading="lazy" />
                      {alt ? <figcaption>{alt}</figcaption> : null}
                    </figure>
                  ),
                  // Wrap tables in a horizontally-scrollable container
                  // so wide tables on phones become swipable instead of
                  // overflowing the viewport.
                  table: ({ children, ...props }) => (
                    <div className="blog-table-wrap">
                      <table {...props}>{children}</table>
                    </div>
                  ),
                }}
              >
                {post.body}
              </ReactMarkdown>
            </div>

            {/* Tag cloud */}
            {post.tags.length > 0 && (
              <div className="blog-tags-v2">
                {post.tags.map((tag) => (
                  <span key={tag} className="blog-tag-v2">#{tag}</span>
                ))}
              </div>
            )}

            {/* Mobile share strip (replaces the floating rail on phones) */}
            <div className="blog-share-strip-mobile">
              <span className="blog-share-strip-mobile__label">{t.share}</span>
              <a
                href={buildWhatsAppShareUrl(post.title, currentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="blog-share-strip-mobile__btn blog-share-strip-mobile__btn--whatsapp"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.526 5.845L.057 23.428a.5.5 0 0 0 .515.572l5.764-1.512A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882c-1.85 0-3.574-.497-5.063-1.362l-.363-.214-3.76.986 1.003-3.668-.236-.375A9.855 9.855 0 0 1 2.118 12c0-5.449 4.433-9.882 9.882-9.882 5.449 0 9.882 4.433 9.882 9.882 0 5.449-4.433 9.882-9.882 9.882z"/>
                </svg>
                {t.shareWa}
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className="blog-share-strip-mobile__btn blog-share-strip-mobile__btn--copy"
              >
                {copied ? t.copied : t.copyLink}
              </button>
            </div>
          </article>

          {/* Sticky TOC (desktop only) */}
          {toc.length > 0 && (
            <aside className="blog-toc-desktop" aria-label={t.tableOfContents}>
              <div className="blog-toc-desktop__sticky">
                <h4 className="blog-toc-desktop__title">{t.tableOfContents}</h4>
                <ol className="blog-toc-desktop__list">
                  {toc.map((entry) => (
                    <li key={entry.id} className={`blog-toc-desktop__item-l${entry.level}`}>
                      <a href={`#${entry.id}`}>{entry.text}</a>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          )}
        </div>

        {/* ── Related posts ──────────────────────────────────────────── */}
        {related.length > 0 && (
          <section className="blog-related-v2">
            <div className="container">
              <header className="blog-related-v2__header">
                <h2>{t.related}</h2>
                <p>{t.relatedSub}</p>
              </header>
              <div className="blog-related-v2__grid">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={lp(`/blog/${r.slug}`)}
                    className="blog-related-v2__card"
                  >
                    {r.image && (
                      <div className="blog-related-v2__media">
                        <img src={r.image} alt={r.title} loading="lazy" />
                      </div>
                    )}
                    <div className="blog-related-v2__body">
                      <h3>{r.title}</h3>
                      <p>{r.excerpt}</p>
                      <span className="blog-related-v2__meta">
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

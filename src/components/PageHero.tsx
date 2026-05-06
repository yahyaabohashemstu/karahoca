import React, { type ReactNode } from 'react';

/**
 * Premium PageHero — single source of truth for the v3 hero across the
 * entire site. Used by Home, BrandHero (DIOX/AYLUX), SubPageTemplate
 * (Production/Goal/Dryer), AboutPage.
 *
 * Layout:
 *   [eyebrow tag]
 *   [H1 title]
 *   [lead paragraph]
 *   [primary CTA + tertiary link?]
 *   [chips? — middot-separated]
 *   ───────────  (asymmetric grid)  ───────────
 *   [visual: double-bezel shell + image]
 *
 * v3.1: replaced framer-motion (~50KB) with pure CSS animations
 * (`hero-stagger-*` utility classes). Saves bundle weight and uses the
 * project's existing `.fx-reveal` infrastructure.
 */
export interface PageHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  tertiaryAction?: ReactNode;
  chips?: string[];
  image: string;
  imageFallback?: string;
  imageAlt: string;
  sectionId?: string;
  imageLCP?: boolean;
}

const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  description,
  primaryAction,
  tertiaryAction,
  chips,
  image,
  imageFallback,
  imageAlt,
  sectionId,
  imageLCP = false,
}) => (
  <section
    id={sectionId}
    className="hero hero--v3"
    aria-labelledby={sectionId ? `${sectionId}-title` : 'page-hero-title'}
  >
    <div className="hero__halo" aria-hidden="true" />

    <div className="container hero__grid hero__grid--v3">
      <div className="hero__copy hero__stagger">
        {eyebrow && (
          <span className="hero__eyebrow hero__stagger-item">
            {eyebrow}
          </span>
        )}

        <h1
          id={sectionId ? `${sectionId}-title` : 'page-hero-title'}
          className="hero__title hero__stagger-item"
        >
          <span className="hero__title-accent">{title}</span>
        </h1>

        {description && (
          <p className="hero__lead hero__stagger-item">{description}</p>
        )}

        {(primaryAction || tertiaryAction) && (
          <div className="hero__actions hero__stagger-item">
            {primaryAction}
            {tertiaryAction}
          </div>
        )}

        {chips && chips.length > 0 && (
          <ul className="hero__chips hero__stagger-item">
            {chips.map((chip, i) => (
              <React.Fragment key={chip}>
                {i > 0 && (
                  <li className="hero__chip-divider" aria-hidden="true">·</li>
                )}
                <li className="hero__chip">{chip}</li>
              </React.Fragment>
            ))}
          </ul>
        )}
      </div>

      <div className="hero__visual hero__visual--enter">
        <div className="hero__visual-shell">
          <div className="hero__visual-core">
            <img
              src={image}
              alt={imageAlt}
              fetchPriority={imageLCP ? 'high' : undefined}
              loading={imageLCP ? 'eager' : 'lazy'}
              decoding="async"
              className="hero__visual-img"
              {...(imageFallback
                ? {
                    onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
                      (e.currentTarget as HTMLImageElement).src = imageFallback;
                    },
                  }
                : {})}
            />
            <div className="hero__visual-highlight" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default PageHero;

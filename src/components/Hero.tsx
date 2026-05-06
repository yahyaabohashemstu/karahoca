import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';

/**
 * KARAHOCA Hero — premium v3 redesign.
 *
 * Anti-slop changes vs the original:
 *   - Removed cheap "left text / right image" cliché → asymmetric grid
 *     with offset visual + halo gradient pulled from brand palette.
 *   - Replaced floating-orb noise → no decorative blobs (banned by audit).
 *   - Removed scroll-indicator filler (banned).
 *   - Replaced 2-button (filled + ghost) with one premium primary CTA
 *     using "button-in-button" trailing icon, plus a tertiary text link.
 *   - Added eyebrow tag (small pill) above the H1 — "Editorial" typography
 *     prelude per high-end-visual-design spec.
 *   - Title constrained to max-w (~5xl) with clamp(3rem, 5vw + 1rem,
 *     5.5rem) — guarantees 2-3 lines never 6.
 *   - All entry animations via framer-motion spring physics
 *     (stiffness: 80, damping: 18) — premium "weight".
 */
const Hero: React.FC = () => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  // Spring-physics motion values. Disabled when user requests reduced motion.
  const springTransition = prefersReducedMotion
    ? { duration: 0.001 }
    : { type: 'spring' as const, stiffness: 80, damping: 18, mass: 0.8 };

  const fadeUp = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 24 },
    show:   { opacity: 1, y: 0 },
  };

  const stagger = {
    show: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  return (
    <section className="hero hero--v3" aria-labelledby="hero-title">
      {/* Brand-tinted ambient halo — replaces the banned floating orbs.
          Single radial blur, fixed, pointer-events disabled. */}
      <div className="hero__halo" aria-hidden="true" />

      <div className="container hero__grid hero__grid--v3">
        <motion.div
          className="hero__copy"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.span
            className="hero__eyebrow"
            variants={fadeUp}
            transition={springTransition}
          >
            <Sparkle weight="fill" size={12} />
            <span>{t('hero.eyebrow', { defaultValue: 'Premium Cleaning Manufacturer' })}</span>
          </motion.span>

          <motion.h1
            id="hero-title"
            className="hero__title"
            variants={fadeUp}
            transition={springTransition}
          >
            <span className="hero__title-accent">{t('hero.title')}</span>
          </motion.h1>

          <motion.p
            className="hero__lead"
            variants={fadeUp}
            transition={springTransition}
          >
            {t('hero.subtitle')}
          </motion.p>

          <motion.div
            className="hero__actions"
            variants={fadeUp}
            transition={springTransition}
          >
            {/* Primary CTA — "Button-in-Button" pattern: nested circular
                icon wrapper inside the pill. The icon translates on hover
                (group-hover) for kinetic tension. */}
            <a href="#brands" className="btn-premium btn-premium--primary">
              <span className="btn-premium__label">{t('hero.cta.products')}</span>
              <span className="btn-premium__icon" aria-hidden="true">
                <ArrowRight size={16} weight="bold" />
              </span>
            </a>

            {/* Tertiary text link — replaces the cheap "ghost" button.
                Underlined chevron pattern, premium quiet aesthetic. */}
            <a href="#about" className="btn-premium btn-premium--tertiary">
              {t('hero.cta.about')}
              <span className="btn-premium__chevron" aria-hidden="true">→</span>
            </a>
          </motion.div>

          <motion.ul
            className="hero__chips"
            variants={fadeUp}
            transition={springTransition}
          >
            <li className="hero__chip">{t('hero.badges.quality')}</li>
            <li className="hero__chip-divider" aria-hidden="true">·</li>
            <li className="hero__chip">{t('hero.badges.experience')}</li>
            <li className="hero__chip-divider" aria-hidden="true">·</li>
            <li className="hero__chip">{t('hero.badges.countries')}</li>
          </motion.ul>
        </motion.div>

        <motion.div
          className="hero__visual"
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.001 }
              : { type: 'spring', stiffness: 60, damping: 20, mass: 0.9, delay: 0.15 }
          }
        >
          {/* Double-bezel: outer shell + inner core for depth.
              Replaces the old card-3d__inner glass-panel with a more
              architectural, "machined hardware" feel. */}
          <div className="hero__visual-shell">
            <div className="hero__visual-core">
              <img
                src="/KARAHOCA-1-newPhoto.webp"
                alt="KARAHOCA"
                fetchPriority="high"
                className="hero__visual-img"
              />
              {/* Subtle inner highlight for the "glass plate in tray" effect */}
              <div className="hero__visual-highlight" aria-hidden="true" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;

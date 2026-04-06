import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { buildApiUrl } from '../utils/api';
import { normalizeLanguageCode } from '../utils/language';

interface Testimonial {
  id: number;
  client_name: string;
  company: string;
  country: string;
  role_ar: string; role_en: string; role_tr: string; role_ru: string;
  text_ar: string; text_en: string; text_tr: string; text_ru: string;
  rating: number;
}

const TestimonialsSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  useEffect(() => {
    fetch(buildApiUrl('/api/testimonials'))
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.testimonials)) {
          setTestimonials(data.testimonials);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % testimonials.length);
    }, 6000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [testimonials.length]);

  if (testimonials.length === 0) return null;

  const getText = (t: Testimonial) =>
    (t[`text_${lang}` as keyof Testimonial] as string) ||
    t.text_en || t.text_ar || '';

  const getRole = (t: Testimonial) =>
    (t[`role_${lang}` as keyof Testimonial] as string) ||
    t.role_en || t.role_ar || '';

  const prev = () => setCurrent(c => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent(c => (c + 1) % testimonials.length);

  const item = testimonials[current];

  return (
    <section id="testimonials" className="testimonials-section glass-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">{t('testimonials.title')}</h2>
          <p className="section-subtitle">{t('testimonials.subtitle')}</p>
        </div>

        <div className="testimonials-carousel">
          {testimonials.length > 1 && (
            <button
              className="testimonials-arrow testimonials-arrow--prev"
              onClick={prev}
              aria-label={t('testimonials.prev')}
            >
              ‹
            </button>
          )}

          <div className="testimonials-card glass-card" key={item.id}>
            <div className="testimonials-stars">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < item.rating ? 'star star--filled' : 'star'}>★</span>
              ))}
            </div>

            <blockquote className="testimonials-text">
              "{getText(item)}"
            </blockquote>

            <div className="testimonials-author">
              <div className="testimonials-avatar">
                {item.client_name.charAt(0).toUpperCase()}
              </div>
              <div className="testimonials-meta">
                <strong className="testimonials-name">{item.client_name}</strong>
                <span className="testimonials-role">
                  {getRole(item)}{item.company ? ` · ${item.company}` : ''}
                </span>
                {item.country && (
                  <span className="testimonials-country">{item.country}</span>
                )}
              </div>
            </div>
          </div>

          {testimonials.length > 1 && (
            <button
              className="testimonials-arrow testimonials-arrow--next"
              onClick={next}
              aria-label={t('testimonials.next')}
            >
              ›
            </button>
          )}
        </div>

        {testimonials.length > 1 && (
          <div className="testimonials-dots">
            {testimonials.map((_, i) => (
              <button
                key={i}
                className={`testimonials-dot${i === current ? ' testimonials-dot--active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;

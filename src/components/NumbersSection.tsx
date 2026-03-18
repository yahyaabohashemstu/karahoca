import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const NumbersSection: React.FC = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement | null>(null);
  const countRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const experienceSvgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeAnimations = new Map<HTMLSpanElement, number>();

    const formatValue = (value: number, target: number, suffix: string) => {
      const rounded = Math.floor(value);
      if (target === 15) {
        return `${rounded}+`;
      }
      if (target === 30) {
        return `${rounded} ${suffix}`.trim();
      }
      if (target === 99) {
        return `${rounded}%`;
      }
      if (target === 200) {
        return `${rounded}+ ${suffix}`.trim();
      }
      return `${rounded} ${suffix}`.trim();
    };

    const animateCount = (element: HTMLSpanElement, target: number) => {
      const suffix = element.getAttribute('data-suffix') || '';
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = prefersReducedMotion ? 800 : 1400;
      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (startTime === null) {
          startTime = timestamp;
        }

        const progress = Math.min((timestamp - startTime) / duration, 1);
        const currentValue = progress * target;
        element.textContent = formatValue(currentValue, target, suffix);

        if (progress < 1) {
          const frameId = requestAnimationFrame(step);
          activeAnimations.set(element, frameId);
        } else {
          activeAnimations.delete(element);
        }
      };

      const frameId = requestAnimationFrame(step);
      activeAnimations.set(element, frameId);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLSpanElement;
          const count = parseInt(element.getAttribute('data-count') || '0');
          animateCount(element, count);
          observer.unobserve(element);
        }
      });
    });

    countRefs.current.forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      observer.disconnect();
      activeAnimations.forEach((frameId) => cancelAnimationFrame(frameId));
      activeAnimations.clear();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const containers = Array.from(section.querySelectorAll<HTMLElement>('.main-container'));
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            target.classList.add('is-visible');
          } else {
            target.classList.remove('is-visible');
          }
        });
      },
      { threshold: 0.25 }
    );

    const observeAll = () => containers.forEach((container) => observer.observe(container));
    const unobserveAll = () => containers.forEach((container) => {
      observer.unobserve(container);
      container.classList.remove('is-visible');
    });

    if (mediaQuery.matches) {
      unobserveAll();
    } else {
      observeAll();
    }

    const listener = (event: MediaQueryListEvent) => {
      if (event.matches) {
        unobserveAll();
      } else {
        observeAll();
      }
    };

    mediaQuery.addEventListener('change', listener);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    const container = experienceSvgRef.current;
    if (!container) {
      return;
    }

    let isMounted = true;
    const timers: number[] = [];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const schedule = (handler: () => void, delay: number) => {
      const id = window.setTimeout(handler, delay);
      timers.push(id);
    };

    fetch('/Experience.svg')
      .then((response) => response.text())
      .then((rawSvg) => {
        if (!isMounted) {
          return;
        }

        const sanitizedSvg = rawSvg.replace(/<script[\s\S]*?<\/script>/gi, '');
        container.innerHTML = sanitizedSvg;

        const svgElement = container.querySelector('svg');
        const textElement = svgElement?.querySelector('#animated-number');

        if (!(textElement instanceof SVGTextElement)) {
          return;
        }

        if (prefersReducedMotion) {
          textElement.textContent = '30';
          return;
        }

        let current = 1;
        const tickInterval = 180;
        const startCycle = () => {
          if (!isMounted) {
            return;
          }

          if (current <= 30) {
            textElement.textContent = current.toString();
            current += 1;
            schedule(startCycle, tickInterval);
          } else {
            schedule(() => {
              current = 1;
              schedule(startCycle, 2000);
            }, 4000);
          }
        };

        schedule(startCycle, 1200);
      })
      .catch(() => {
        if (isMounted) {
          container.innerHTML = '';
        }
      });

    return () => {
      isMounted = false;
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  return (
    <section ref={sectionRef} id="numbers" className="section glass-section">
      <div className="section-divider"></div>
      <div className="container section__head fx-reveal">
        <h2 className="section-title">{t('numbers.title')}</h2>
        <p className="section-subtitle">{t('numbers.subtitle')}</p>
      </div>
      <div className="container kpis">
        {/* دولة التوزيع */}
        <div className="main-container">
          <div className="animation-container" id="animationContainer">
            <div className="spotlight"></div>
            <div className="wave-effect">
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
            </div>
            <div className="smoke-effect">
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
            </div>
            <div
              style={{
                width: '180px',
                height: '204px',
                margin: 'auto',
                marginTop: '18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <img
                src="/world-map.svg"
                alt="خريطة العالم"
                loading="lazy"
                style={{
                  width: '400px',
                  height: '280px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
            
            <div className="info-panel">
              <div 
                className="info-title kpi__num" 
                data-count="15"
                ref={(el) => { countRefs.current[0] = el; }}
              >
                0+
              </div>
              <div className="info-subtitle">{t('numbers.countries')}</div>
            </div>
          </div>
        </div>

        {/* الموظفين */}
        <div className="main-container">
          <div className="animation-container">
            <div className="spotlight"></div>
            <div className="wave-effect">
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
            </div>
            <div className="smoke-effect">
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
            </div>
            
            <div className="camera-sequence">
              <img
                src="/employees.svg"
                alt="موظفين KARAHOCA"
                className="employees-svg"
                loading="lazy"
              />
            </div>
            
            <div className="info-panel">
              <div 
                className="info-title kpi__num" 
                data-count="200"
                data-suffix={t('numbers.employees')}
                ref={(el) => { countRefs.current[3] = el; }}
              >
                0+
              </div>
              <div className="info-subtitle">{t('numbers.employeesLabel')}</div>
            </div>
          </div>
        </div>

        {/* سنوات الخبرة */}
        <div className="main-container">
          <div className="animation-container">
            <div className="spotlight"></div>
            <div className="wave-effect">
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
            </div>
            <div className="smoke-effect">
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
            </div>
            
            <div
              ref={experienceSvgRef}
              style={{
                width: '180px',
                height: '204px',
                margin: 'auto',
                marginTop: '18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            />
            
            <div className="info-panel">
              <div 
                className="info-title kpi__num" 
                data-count="30"
                data-suffix={t('numbers.years')}
                ref={(el) => { countRefs.current[1] = el; }}
              >
                0
              </div>
              <div className="info-subtitle">{t('numbers.experience')}</div>
            </div>
          </div>
        </div>

        {/* رضا العملاء */}
        <div className="main-container">
          <div className="animation-container">
            <div className="spotlight"></div>
            <div className="wave-effect">
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
            </div>
            <div className="smoke-effect">
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
              <div className="smoke"></div>
            </div>
            
            <div
              style={{
                width: '180px',
                height: '204px',
                margin: 'auto',
                marginTop: '18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <img 
                src="/rate.svg" 
                alt="رضا العملاء"
                loading="lazy"
                style={{
                  width: '320px',
                  height: '230px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
            
            <div className="info-panel">
              <div 
                className="info-title kpi__num" 
                data-count="99"
                ref={(el) => { countRefs.current[2] = el; }}
              >
                0%
              </div>
              <div className="info-subtitle">{t('numbers.satisfaction')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NumbersSection;
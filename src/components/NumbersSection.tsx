import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const NumbersSection: React.FC = () => {
  const { t } = useTranslation();
  const countRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    // Animation for counting numbers
    const animateCount = (element: HTMLSpanElement, target: number) => {
      let current = 0;
      const increment = target / 100;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        const suffix = element.getAttribute('data-suffix') || '';
        if (target === 15) {
          element.textContent = Math.floor(current).toString() + '+';
        } else if (target === 30) {
          element.textContent = Math.floor(current).toString() + ' ' + suffix;
        } else if (target === 99) {
          element.textContent = Math.floor(current).toString() + '%';
        } else if (target === 200) {
          element.textContent = Math.floor(current).toString() + '+ ' + suffix;
        }
      }, 20);
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
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="numbers" className="section glass-section">
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
              <img src="/employees.svg" alt="موظفين KARAHOCA" className="employees-svg" />
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
                src="/Experience.svg" 
                alt="سنوات الخبرة"
                style={{
                  width: '320px',
                  height: '200px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
            
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
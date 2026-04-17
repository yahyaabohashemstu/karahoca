import React, { useEffect, useRef } from 'react';
import { loadSanitizedSvgIntoContainer } from '../utils/safeSvg';

const ExperienceBadge: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let isMounted = true;
    const timers: number[] = [];

    const schedule = (handler: () => void, delay: number) => {
      const id = window.setTimeout(handler, delay);
      timers.push(id);
    };

    loadSanitizedSvgIntoContainer(container, '/Experience.svg')
      .then((svgElement) => {
        if (!isMounted || !svgElement) {
          return;
        }

        const textElement = svgElement.querySelector('#animated-number');
        if (!(textElement instanceof SVGTextElement)) {
          return;
        }

        let current = 1;
        const startCycle = () => {
          if (!isMounted) {
            return;
          }

          if (current <= 30) {
            textElement.textContent = current.toString();
            current += 1;
            schedule(startCycle, 150);
          } else {
            schedule(() => {
              current = 1;
              schedule(startCycle, 2000);
            }, 5000);
          }
        };

        schedule(startCycle, 2000);
      })
      .catch(() => {
        if (isMounted) {
          container.replaceChildren();
        }
      });

    return () => {
      isMounted = false;
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="experience-badge"
      aria-hidden="true"
    />
  );
};

export default ExperienceBadge;


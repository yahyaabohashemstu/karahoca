import React, { useEffect, useRef, useState } from 'react';

const ExperienceBadge: React.FC = () => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch('/Experience.svg')
      .then((response) => response.text())
      .then((rawSvg) => {
        if (!isMounted) {
          return;
        }
        const sanitizedSvg = rawSvg.replace(/<script[\s\S]*?<\/script>/gi, '');
        setSvgMarkup(sanitizedSvg);
      })
      .catch(() => {
        if (isMounted) {
          setSvgMarkup('');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!svgMarkup || !containerRef.current) {
      return;
    }

    const svgElement = containerRef.current.querySelector('svg');
    const textElement = svgElement?.querySelector('#animated-number');

    if (!(textElement instanceof SVGTextElement)) {
      return;
    }

    let current = 1;
    let isRunning = true;
    const timers: number[] = [];

    const schedule = (handler: () => void, delay: number) => {
      const id = window.setTimeout(handler, delay);
      timers.push(id);
    };

    const startCycle = () => {
      if (!isRunning) {
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

    return () => {
      isRunning = false;
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [svgMarkup]);

  return (
    <div
      ref={containerRef}
      className="experience-badge"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};

export default ExperienceBadge;


import React, { useEffect, useRef, useState } from 'react';

/** Sanitize SVG using DOMParser — removes event handlers, scripts, and dangerous attributes */
const sanitizeSvg = (rawSvg: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
    // Remove script and foreignObject elements entirely
    doc.querySelectorAll('script, foreignObject').forEach(el => el.remove());
    // Strip dangerous attributes from every element
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) { el.removeAttribute(attr.name); return; }
        if ((name === 'href' || name === 'xlink:href' || name === 'src') &&
            /^(javascript:|data:text)/i.test(attr.value.trim())) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return '';
  }
};

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
        setSvgMarkup(sanitizeSvg(rawSvg));
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


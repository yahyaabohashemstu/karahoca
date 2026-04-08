import { useEffect } from 'react';

// Hook لإدارة تأثيرات التمرير والرسوم المتحركة
export const useScrollAnimations = () => {
  useEffect(() => {
    const observers: Array<() => void> = [];

    const initObserver = (selector: string, animationClass: string) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(animationClass);
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (!el.classList.contains(animationClass)) {
          observer.observe(el);
        }
      });

      observers.push(() => observer.disconnect());

      return observer;
    };

    const revealObserver = initObserver('.fx-reveal', 'fx-reveal-active');
    const upObserver = initObserver('.fx-up', 'fx-up-active');
    const scaleObserver = initObserver('.fx-scale', 'fx-scale-active');
    const slideLeftObserver = initObserver('.fx-slide-left', 'fx-slide-left-active');
    const slideRightObserver = initObserver('.fx-slide-right', 'fx-slide-right-active');

    // Stagger parent: when visible, add active class to trigger children cascade
    const staggerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fx-stagger-active');
          staggerObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.fx-stagger-children').forEach(el => {
      if (!el.classList.contains('fx-stagger-active')) staggerObserver.observe(el);
    });
    observers.push(() => staggerObserver.disconnect());

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return;
          }

          const pairs: [string, string, IntersectionObserver][] = [
            ['.fx-reveal', 'fx-reveal-active', revealObserver],
            ['.fx-up', 'fx-up-active', upObserver],
            ['.fx-scale', 'fx-scale-active', scaleObserver],
            ['.fx-slide-left', 'fx-slide-left-active', slideLeftObserver],
            ['.fx-slide-right', 'fx-slide-right-active', slideRightObserver],
          ];
          for (const [sel, cls, obs] of pairs) {
            if (node.matches(sel) && !node.classList.contains(cls)) obs.observe(node);
            node.querySelectorAll?.(sel).forEach(child => {
              if (!child.classList.contains(cls)) obs.observe(child);
            });
          }
          if (node.matches('.fx-stagger-children') && !node.classList.contains('fx-stagger-active')) {
            staggerObserver.observe(node);
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    observers.push(() => mutationObserver.disconnect());

    // إضافة CSS للرسوم المتحركة إذا لم تكن موجودة
    const styleId = 'fx-animations-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
      .fx-reveal {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.8s ease-out;
      }
      
      .fx-reveal-active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .fx-up {
        opacity: 0;
        transform: translateY(50px);
        transition: all 0.6s ease-out;
      }
      
      .fx-up-active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .fx-up:nth-child(2) { transition-delay: 0.1s; }
      .fx-up:nth-child(3) { transition-delay: 0.2s; }
      .fx-up:nth-child(4) { transition-delay: 0.3s; }

      /* Scale entrance */
      .fx-scale {
        opacity: 0;
        transform: scale(0.82);
        transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .fx-scale-active { opacity: 1; transform: none; }

      /* Slide from sides */
      .fx-slide-left {
        opacity: 0;
        transform: translateX(-60px);
        transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .fx-slide-left-active { opacity: 1; transform: none; }

      .fx-slide-right {
        opacity: 0;
        transform: translateX(60px);
        transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .fx-slide-right-active { opacity: 1; transform: none; }

      /* Stagger children cascade */
      .fx-stagger-children > * {
        opacity: 0;
        transform: translateY(40px) scale(0.96);
        transition: opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1),
                    transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
        transition-delay: calc(var(--stagger-i, 0) * 0.09s);
      }
      .fx-stagger-active > * {
        opacity: 1;
        transform: none;
      }

      /* Scroll progress bar */
      .scroll-progress-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: 99999;
        pointer-events: none;
        transform-origin: left;
        transform: scaleX(0);
        background: linear-gradient(90deg, #FF5B2E, #FF7A50, #FFB347);
        will-change: transform;
        transition: none;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .fx-scale, .fx-slide-left, .fx-slide-right,
        .fx-stagger-children > * {
          opacity: 1 !important;
          transform: none !important;
          transition: none !important;
        }
        .scroll-progress-bar { display: none; }
      }
    `;
      document.head.appendChild(style);
    }

    // ── Scroll progress bar ───────────────────────────────────────────────
    let progressBar = document.querySelector('.scroll-progress-bar') as HTMLElement | null;
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'scroll-progress-bar';
      document.body.appendChild(progressBar);
    }

    let rafId = 0;
    const updateProgress = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const progress = scrollHeight <= clientHeight ? 0 : scrollTop / (scrollHeight - clientHeight);
      if (progressBar) progressBar.style.transform = `scaleX(${Math.min(progress, 1)})`;
    };
    const onScroll = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(updateProgress); };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
      progressBar?.remove();

      while (observers.length) {
        const dispose = observers.pop();
        dispose?.();
      }

      if (style && style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);
};

// Hook لإدارة تغيير المظهر
export const useThemeToggle = () => {
  useEffect(() => {
    // تطبيق المظهر المحفوظ
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
    }
  }, []);

  const toggleTheme = () => {
    const body = document.body;
    const isLight = body.classList.toggle('light-mode');
    
    // حفظ التفضيل
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    // تأثير الانتقال
    body.classList.add('theme-transitioning');
    setTimeout(() => {
      body.classList.remove('theme-transitioning');
    }, 300);
  };

  return { toggleTheme };
};

// Hook لتحسين الأداء والتحميل
export const usePerformanceOptimizations = () => {
  useEffect(() => {
    // Lazy loading للصور
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach((img) => imageObserver.observe(img));

    return () => imageObserver.disconnect();
  }, []);
};

// Hook لتحديث السنة في التذييل
export const useCurrentYear = () => {
  useEffect(() => {
    const yearElement = document.getElementById('year');
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear().toString();
    }
  }, []);
};
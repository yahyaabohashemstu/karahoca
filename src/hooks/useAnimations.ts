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

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return;
          }

          if (node.matches('.fx-reveal') && !node.classList.contains('fx-reveal-active')) {
            revealObserver.observe(node);
          }
          if (node.matches('.fx-up') && !node.classList.contains('fx-up-active')) {
            upObserver.observe(node);
          }

          node.querySelectorAll?.('.fx-reveal').forEach((child) => {
            if (!child.classList.contains('fx-reveal-active')) {
              revealObserver.observe(child);
            }
          });

          node.querySelectorAll?.('.fx-up').forEach((child) => {
            if (!child.classList.contains('fx-up-active')) {
              upObserver.observe(child);
            }
          });
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
    `;
      document.head.appendChild(style);
    }

    return () => {
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
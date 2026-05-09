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

    // ─── Fix for Issue #5 ────────────────────────────────────────────────
    // Removed the runtime <style> injection that re-defined `.fx-reveal`,
    // `.fx-up`, and their `*-active` pairs with `transition: all`. The
    // canonical definitions live in `src/styles/main.css` now and target
    // only `opacity` & `transform` (no layout-property thrashing on the
    // GPU). Source-of-truth is one place; cascading `transition: all`
    // jank is gone.
    return () => {
      while (observers.length) {
        const dispose = observers.pop();
        dispose?.();
      }
    };
  }, []);
};

// Hook لإدارة تغيير المظهر
export const useThemeToggle = () => {
  useEffect(() => {
    // الوضع الفاتح هو الافتراضي — لا يُزال إلا إذا اختار المستخدم الداكن
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.remove('light-mode');
    } else {
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
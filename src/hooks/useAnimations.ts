import { useEffect } from 'react';

// Hook لإدارة تأثيرات التمرير والرسوم المتحركة
export const useScrollAnimations = () => {
  useEffect(() => {
    // Intersection Observer للرسوم المتحركة عند التمرير
    const observeElements = (selector: string, animationClass: string) => {
      const elements = document.querySelectorAll(selector);
      
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

      elements.forEach((el) => observer.observe(el));
      
      return () => observer.disconnect();
    };

    // تطبيق الرسوم المتحركة
    const cleanup1 = observeElements('.fx-reveal', 'fx-reveal-active');
    const cleanup2 = observeElements('.fx-up', 'fx-up-active');

    // إضافة CSS للرسوم المتحركة إذا لم تكن موجودة
    const style = document.createElement('style');
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

    return () => {
      cleanup1?.();
      cleanup2?.();
      document.head.removeChild(style);
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
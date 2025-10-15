import React from 'react';
import BrandPageTemplate from '../components/BrandPageTemplate';

const DioxPage: React.FC = () => {
  const dioxData = {
    brandName: 'DIOX',
    brandNameArabic: 'ديوكس',
    heroTitle: 'القوة الاحترافية للنظافة',
    heroDescription: 'منتجات تنظيف احترافية بقوة فائقة وفعالية مثبتة للبيئات التجارية والمنزلية الصعبة.',
    heroImage: '/Diox-logo.png.webp',
    heroImageAlt: 'DIOX - منتجات التنظيف الاحترافية',
    badges: ['قوة احترافية', 'فعالية مثبتة', 'تركيبة متقدمة'],
    aboutTitle: 'عن DIOX',
    aboutSubtitle: 'القوة والفعالية في كل منتج.',
    aboutMainHeading: 'التميز في التنظيف الاحترافي',
    aboutSections: [
      {
        title: 'قوة استثنائية',
        content: 'تمثل علامة DIOX مجموعة شاملة من منتجات التنظيف الاحترافية المصممة خصيصاً للتعامل مع أصعب التحديات. تجمع تركيباتنا المتقدمة بين القوة الفائقة والأمان، مما يجعلها الخيار الأمثل للبيئات التجارية والمنزلية.'
      },
      {
        title: 'تقنية متقدمة',
        content: 'بفضل التقنيات المتطورة والاختبارات الصارمة، تحقق منتجات DIOX نتائج فورية ومضمونة. تركيباتنا المبتكرة تضمن فعالية تنظيف تصل إلى 99.9% ضد البكتيريا والجراثيم.'
      },
      {
        title: 'الأمان والاستدامة',
        content: 'نحن نؤمن بأهمية توفير منتجات آمنة وصديقة للبيئة دون التنازل عن الفعالية. جميع منتجاتنا تخضع لاختبارات السلامة الصارمة وتتوافق مع المعايير الدولية للجودة والأمان.'
      }
    ],
    productsTitle: 'مجموعة منتجات DIOX الكاملة',
    productsSubtitle: 'جميع حلول التنظيف التي تحتاجها في مكان واحد',
    categories: [
      {
        title: 'تنظيف المنزل',
        products: [
          { name: 'ديوكس معطر الأرضيات', description: 'منظف أرضيات بعطر منعش', image: '/KARAHOCA-1-newPhoto.webp', alt: 'ديوكس معطر الأرضيات' },
          { name: 'ديوكس معطر أرضيات', description: 'لأرضيات نظيفة ومعطرة', image: '/KARAHOCA-2-wb.webp', alt: 'ديوكس معطر أرضيات' },
          { name: 'ديوكس سوبر جل', description: 'جل فائق القوة للتنظيف', image: '/KARAHOCA-3-wb.webp', alt: 'ديوكس سوبر جل' },
          { name: 'ديوكس منظف عام', description: 'للتنظيف الشامل والعميق', image: '/KARAHOCA-4-web.webp', alt: 'ديوكس منظف عام' },
          { name: 'ديوكس فلاش', description: 'منظف سريع المفعول', image: '/KARAHOCA-1-newPhoto.webp', alt: 'ديوكس فلاش' },
          { name: 'ديوكس منظف الأفران', description: 'متخصص لتنظيف الأفران', image: '/KARAHOCA-2-wb.webp', alt: 'ديوكس منظف الأفران' },
          { name: 'ديوكس كلور', description: 'مبيض وتطهير فعال', image: '/KARAHOCA-3-wb.webp', alt: 'ديوكس كلور' },
          { name: 'ديوكس منظف الزجاج', description: 'لزجاج نظيف وشفاف', image: '/KARAHOCA-4-web.webp', alt: 'ديوكس منظف الزجاج' },
          { name: 'ديوكس سائل غسيل الصحون', description: 'لصحون نظيفة ولامعة', image: '/KARAHOCA-1-newPhoto.webp', alt: 'ديوكس سائل غسيل الصحون' },
          { name: 'ديوكس سائل غسيل الصحون', description: 'تركيبة محسّنة للتنظيف', image: '/KARAHOCA-2-wb.webp', alt: 'ديوكس سائل غسيل الصحون' },
          { name: 'ديوكس جل غسيل الصحون', description: 'جل مركز للتنظيف العميق', image: '/KARAHOCA-3-wb.webp', alt: 'ديوكس جل غسيل الصحون' },
          { name: 'ديوكس منظف الحمام', description: 'متخصص لتنظيف الحمامات', image: '/KARAHOCA-4-web.webp', alt: 'ديوكس منظف الحمام' }
        ]
      },
      {
        title: 'تنظيف الغسيل',
        products: [
          { name: 'ديوكس مطري الغسيل', description: 'لملابس ناعمة ومعطرة', image: '/KARAHOCA-1-newPhoto.webp', alt: 'ديوكس مطري الغسيل' },
          { name: 'ديوكس سائل غسيل', description: 'سائل غسيل فعال للملابس', image: '/KARAHOCA-2-wb.webp', alt: 'ديوكس سائل غسيل' },
          { name: 'ديوكس مسحوق غسيل - للغسالات الاوتوماتيكية', description: 'مسحوق متقدم للغسالات الأوتوماتيكية', image: '/KARAHOCA-3-wb.webp', alt: 'ديوكس مسحوق غسيل - للغسالات الاوتوماتيكية' },
          { name: 'ديوكس مسحوق غسيل - للغسالات الاوتوماتيكية', description: 'تركيبة محسّنة للغسالات', image: '/KARAHOCA-4-web.webp', alt: 'ديوكس مسحوق غسيل للغسالات الاوتوماتيكية' },
          { name: 'ديوكس مسحوق غسيل - للغسالات العادية', description: 'للغسيل اليدوي والغسالات العادية', image: '/KARAHOCA-1-newPhoto.webp', alt: 'ديوكس مسحوق غسيل للغسالات العادية' },
          { name: 'ديوكس مزيل البقع', description: 'فعال في إزالة البقع الصعبة', image: '/KARAHOCA-2-wb.webp', alt: 'ديوكس مزيل البقع' }
        ]
      },
      {
        title: 'النظافة الشخصية',
        products: [
          { name: 'ديوكس صابون سائل', description: 'صابون سائل لطيف على البشرة', image: '/KARAHOCA-3-wb.webp', alt: 'ديوكس صابون سائل' }
        ]
      }
    ],
    pageClass: 'diox-page',
    aboutId: 'about-diox'
  };

  return <BrandPageTemplate {...dioxData} />;
};

export default DioxPage;
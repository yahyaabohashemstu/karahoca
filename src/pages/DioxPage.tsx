import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import BrandPageTemplate from '../components/BrandPageTemplate';

const DioxPage: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <>
      <SEO
        title={t('diox.seo.title')}
        description={t('diox.seo.description')}
        keywords={t('diox.seo.keywords')}
        ogImage="/Diox-logo.png.webp"
        canonicalUrl="https://karahoca.com/diox"
      />
      <DioxPageContent />
    </>
  );
};

const DioxPageContent: React.FC = () => {
  const { t } = useTranslation();
  const dioxData = {
    brandName: 'DIOX',
    brandNameArabic: t('diox.brandNameArabic'),
    heroTitle: t('diox.hero.title'),
    heroDescription: t('diox.hero.description'),
    heroImage: '/Diox-logo.png.webp',
    heroImageAlt: t('diox.hero.imageAlt'),
    badges: [t('diox.hero.badge1'), t('diox.hero.badge2'), t('diox.hero.badge3')],
    aboutTitle: t('diox.about.title'),
    aboutSubtitle: t('diox.about.subtitle'),
    aboutMainHeading: t('diox.about.mainHeading'),
    aboutSections: [
      {
        title: t('diox.about.section1.title'),
        content: t('diox.about.content')
      }
    ],
    productsTitle: t('diox.productsSection.title'),
    productsSubtitle: t('diox.productsSection.subtitle'),
    categories: [
      {
        title: t('diox.categories.homeCleaning'),
        products: [
          { 
            name: t('diox.products.home.generalCleaner.name'), 
            description: t('diox.products.home.generalCleaner.description'), 
            image: '/diox/ديوكس منظف عام.png', 
            alt: t('diox.products.home.generalCleaner.alt'),
            details: {
              weight: '750ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.superGel.name'), 
            description: t('diox.products.home.superGel.description'), 
            image: '/diox/ديوكس سوبر جل.png', 
            alt: t('diox.products.home.superGel.alt'),
            details: {
              weight: '450ml / 900ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.floorFragrance.name'), 
            description: t('diox.products.home.floorFragrance.description'), 
            image: '/diox/ديوكس معطر أرضيات.png', 
            alt: t('diox.products.home.floorFragrance.alt'),
            details: {
              weight: '600ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.floorFragrance2.name'), 
            description: t('diox.products.home.floorFragrance2.description'), 
            image: '/diox/ديوكس معطر الأرضيات.png', 
            alt: t('diox.products.home.floorFragrance2.alt'),
            details: {
              weight: '600ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.glassCleaner.name'), 
            description: t('diox.products.home.glassCleaner.description'), 
            image: '/diox/ديوكس منظف الزجاج.png', 
            alt: t('diox.products.home.glassCleaner.alt'),
            details: {
              weight: '750ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.chlorine.name'), 
            description: t('diox.products.home.chlorine.description'), 
            image: '/diox/ديوكس كلور.png', 
            alt: t('diox.products.home.chlorine.alt'),
            details: {
              weight: '900ml / 5L',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.ovenCleaner.name'), 
            description: t('diox.products.home.ovenCleaner.description'), 
            image: '/diox/ديوكس منظف الأفران.png', 
            alt: t('diox.products.home.ovenCleaner.alt'),
            details: {
              weight: '750ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.flash.name'), 
            description: t('diox.products.home.flash.description'), 
            image: '/diox/ديوكس فلاش.png', 
            alt: t('diox.products.home.flash.alt'),
            details: {
              weight: '900ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.bathroomCleaner.name'), 
            description: t('diox.products.home.bathroomCleaner.description'), 
            image: '/diox/ديوكس منظف الحمام.png', 
            alt: t('diox.products.home.bathroomCleaner.alt'),
            details: {
              weight: '750ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.dishGel.name'), 
            description: t('diox.products.home.dishGel.description'), 
            image: '/diox/ديوكس جل غسيل الصحون.png', 
            alt: t('diox.products.home.dishGel.alt'),
            details: {
              weight: '1.5kg',
              material: t('materials.plasticBottle'),
              count: `4 ${t('materials.pieces_plural')}`
            }
          },
          { 
            name: t('diox.products.home.dishLiquid1.name'), 
            description: t('diox.products.home.dishLiquid1.description'), 
            image: '/diox/ديوكس سائل غسيل الصحون (1).png', 
            alt: t('diox.products.home.dishLiquid1.alt'),
            details: {
              weight: '700ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.home.dishLiquid2.name'), 
            description: t('diox.products.home.dishLiquid2.description'), 
            image: '/diox/ديوكس سائل غسيل الصحون (2).png', 
            alt: t('diox.products.home.dishLiquid2.alt'),
            details: {
              weight: '3L',
              material: t('materials.plasticBottle'),
              count: `4 ${t('materials.pieces_plural')}`
            }
          }
        ]
      },
      {
        title: t('diox.categories.laundryCleaning'),
        products: [
          { 
            name: t('diox.products.laundry.autoPowder1.name'), 
            description: t('diox.products.laundry.autoPowder1.description'), 
            image: '/diox/ديوكس مسحوق غسيل أوتوماتيك (1).png', 
            alt: t('diox.products.laundry.autoPowder1.alt'),
            details: {
              weight: '150g / 1.2kg / 3.5kg / 9kg',
              material: t('materials.plasticBag'),
              count: `6 ${t('materials.pieces_plural')}`
            }
          },
          { 
            name: t('diox.products.laundry.autoPowder2.name'), 
            description: t('diox.products.laundry.autoPowder2.description'), 
            image: '/diox/ديوكس مسحوق غسيل أوتوماتيك (2).png', 
            alt: t('diox.products.laundry.autoPowder2.alt'),
            details: {
              weight: '2.5kg / 4.5kg',
              material: t('materials.cardboardBox'),
              count: `4 ${t('materials.pieces_plural')}`
            }
          },
          { 
            name: t('diox.products.laundry.liquidDetergent.name'), 
            description: t('diox.products.laundry.liquidDetergent.description'), 
            image: '/diox/ديوكس سائل غسيل (1).png', 
            alt: t('diox.products.laundry.liquidDetergent.alt'),
            details: {
              weight: '900ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.laundry.fabricSoftener.name'), 
            description: t('diox.products.laundry.fabricSoftener.description'), 
            image: '/diox/ديوكس مطري الغسيل.png', 
            alt: t('diox.products.laundry.fabricSoftener.alt'),
            details: {
              weight: '900ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.laundry.stainRemover.name'), 
            description: t('diox.products.laundry.stainRemover.description'), 
            image: '/diox/ديوكس مزيل البقع.png', 
            alt: t('diox.products.laundry.stainRemover.alt'),
            details: {
              weight: '900ml',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          },
          { 
            name: t('diox.products.laundry.regularPowder.name'), 
            description: t('diox.products.laundry.regularPowder.description'), 
            image: '/diox/ديوكس مسحوق غسيل عادي.png', 
            alt: t('diox.products.laundry.regularPowder.alt'),
            details: {
              weight: '300g / 600g / 3kg / 5kg / 9kg',
              material: t('materials.plasticBag'),
              count: `6 ${t('materials.pieces_plural')}`
            }
          }
        ]
      },
      {
        title: t('diox.categories.personalHygiene'),
        products: [
          { 
            name: t('diox.products.personal.liquidSoap.name'), 
            description: t('diox.products.personal.liquidSoap.description'), 
            image: '/diox/ديوكس صابون سائل.png', 
            alt: t('diox.products.personal.liquidSoap.alt'),
            details: {
              weight: '400ml / 3L',
              material: t('materials.plasticBottle'),
              count: `12 ${t('materials.pieces')}`
            }
          }
        ]
      }
    ],
    contactId: 'contact-diox',
    aboutId: 'about-diox',
    pageClass: 'diox-page'
  };

  return <BrandPageTemplate {...dioxData} />;
};

export default DioxPage;





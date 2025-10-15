import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import BrandPageTemplate from '../components/BrandPageTemplate';

const AyluxPage: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <>
      <SEO
        title={t('aylux.seo.title')}
        description={t('aylux.seo.description')}
        keywords={t('aylux.seo.keywords')}
        ogImage="/Aylux-logo.png.webp"
        canonicalUrl="https://karahoca.com/aylux"
      />
      <AyluxPageContent />
    </>
  );
};

const AyluxPageContent: React.FC = () => {
  const { t } = useTranslation();
  
  const ayluxData = {
    brandName: 'AYLUX',
    brandNameArabic: t('aylux.brandNameArabic'),
    heroTitle: t('aylux.hero.title'),
    heroDescription: t('aylux.hero.description'),
    heroImage: '/Aylux-logo.png.webp',
    heroImageAlt: t('aylux.hero.imageAlt'),
    badges: [t('aylux.hero.badge1'), t('aylux.hero.badge2'), t('aylux.hero.badge3')],
    aboutTitle: t('aylux.about.title'),
    aboutSubtitle: t('aylux.about.subtitle'),
    aboutMainHeading: t('aylux.about.mainHeading'),
    aboutSections: [
      {
        title: t('aylux.about.section1.title'),
        content: t('aylux.about.content')
      }
    ],
    productsTitle: t('aylux.productsSection.title'),
    productsSubtitle: t('aylux.productsSection.subtitle'),
    categories: [
      {
        title: t('aylux.categories.homeCleaning'),
        products: [
          { 
            name: t('aylux.products.home.generalCleaner.name'), 
            description: t('aylux.products.home.generalCleaner.description'), 
            image: '/aylux/آيلوكس منظف عام.png', 
            alt: t('aylux.products.home.generalCleaner.alt'),
            details: {
              weight: '750 ml',
              material: t('aylux.products.home.generalCleaner.material'),
              count: t('aylux.products.home.generalCleaner.count')
            }
          },
          { 
            name: t('aylux.products.home.airFreshener.name'), 
            description: t('aylux.products.home.airFreshener.description'), 
            image: '/aylux/آيلوكس معطر الهواء.png', 
            alt: t('aylux.products.home.airFreshener.alt'),
            details: {
              weight: '400 ml',
              material: t('aylux.products.home.airFreshener.material'),
              count: t('aylux.products.home.airFreshener.count')
            }
          },
          { 
            name: t('aylux.products.home.superGel.name'), 
            description: t('aylux.products.home.superGel.description'), 
            image: '/aylux/آيلوكس سوبر جل.png', 
            alt: t('aylux.products.home.superGel.alt'),
            details: {
              weight: '450 ml / 900 ml',
              material: t('aylux.products.home.superGel.material'),
              count: t('aylux.products.home.superGel.count')
            }
          },
          { 
            name: t('aylux.products.home.floorFragrance.name'), 
            description: t('aylux.products.home.floorFragrance.description'), 
            image: '/aylux/آيلوكس معطر الأرضيات.png', 
            alt: t('aylux.products.home.floorFragrance.alt'),
            details: {
              weight: '600 ml',
              material: t('aylux.products.home.floorFragrance.material'),
              count: t('aylux.products.home.floorFragrance.count')
            }
          },
          { 
            name: t('aylux.products.home.glassCleaner.name'), 
            description: t('aylux.products.home.glassCleaner.description'), 
            image: '/aylux/آيلوكس منظف الزجاج.png', 
            alt: t('aylux.products.home.glassCleaner.alt'),
            details: {
              weight: '750 ml',
              material: t('aylux.products.home.glassCleaner.material'),
              count: t('aylux.products.home.glassCleaner.count')
            }
          },
          { 
            name: t('aylux.products.home.chlorine.name'), 
            description: t('aylux.products.home.chlorine.description'), 
            image: '/aylux/آيلوكس كلور (مبيض).png', 
            alt: t('aylux.products.home.chlorine.alt'),
            details: {
              weight: '900 ml / 5 L',
              material: t('aylux.products.home.chlorine.material'),
              count: t('aylux.products.home.chlorine.count')
            }
          },
          { 
            name: t('aylux.products.home.ovenCleaner.name'), 
            description: t('aylux.products.home.ovenCleaner.description'), 
            image: '/aylux/آيلوكس منظف الفرن.png', 
            alt: t('aylux.products.home.ovenCleaner.alt'),
            details: {
              weight: '750 ml',
              material: t('aylux.products.home.ovenCleaner.material'),
              count: t('aylux.products.home.ovenCleaner.count')
            }
          },
          { 
            name: t('aylux.products.home.flash.name'), 
            description: t('aylux.products.home.flash.description'), 
            image: '/aylux/آيلوكس فلاش المنظف.png', 
            alt: t('aylux.products.home.flash.alt'),
            details: {
              weight: '900 ml',
              material: t('aylux.products.home.flash.material'),
              count: t('aylux.products.home.flash.count')
            }
          },
          { 
            name: t('aylux.products.home.bathroomCleaner.name'), 
            description: t('aylux.products.home.bathroomCleaner.description'), 
            image: '/aylux/آيلوكس منظف الحمام.png', 
            alt: t('aylux.products.home.bathroomCleaner.alt'),
            details: {
              weight: '750 ml',
              material: t('aylux.products.home.bathroomCleaner.material'),
              count: t('aylux.products.home.bathroomCleaner.count')
            } 
          },
          { 
            name: t('aylux.products.home.dishGel.name'), 
            description: t('aylux.products.home.dishGel.description'), 
            image: '/aylux/آيلوكس جل غسيل الصحون.png', 
            alt: t('aylux.products.home.dishGel.alt'),
            details: {
              weight: '1.5 kg',
              material: t('aylux.products.home.dishGel.material'),
              count: t('aylux.products.home.dishGel.count')
            }
          },
          { 
            name: t('aylux.products.home.dishLiquid1.name'), 
            description: t('aylux.products.home.dishLiquid1.description'), 
            image: '/aylux/آيلوكس سائل غسيل الصحون (1).png', 
            alt: t('aylux.products.home.dishLiquid1.alt'),
            details: {
              weight: '3 L',
              material: t('aylux.products.home.dishLiquid1.material'),
              count: '4 قطع'
            }
          },
          { 
            name: t('aylux.products.home.dishLiquid2.name'), 
            description: t('aylux.products.home.dishLiquid2.description'), 
            image: '/aylux/آيلوكس سائل غسيل الصحون (2).png', 
            alt: t('aylux.products.home.dishLiquid2.alt'),
            details: {
              weight: '700 ml',
              material: t('aylux.products.home.dishLiquid2.material'),
              count: t('aylux.products.home.dishLiquid2.count')
            } 
          }
        ]
      },
      {
        title: t('aylux.categories.laundry'),
        products: [
          { 
            name: t('aylux.products.laundry.autoPowder1.name'), 
            description: t('aylux.products.laundry.autoPowder1.description'), 
            image: '/aylux/آيلوكس مسحوق غسيل أوتوماتيك (1).png', 
            alt: t('aylux.products.laundry.autoPowder1.alt'),
            details: {
              weight: '2.25 kg / 3 kg',
              material: 'صندوق كرتون',
              count: t('aylux.products.laundry.autoPowder1.count')
            }
          },
          { 
            name: t('aylux.products.laundry.autoPowder2.name'), 
            description: t('aylux.products.laundry.autoPowder2.description'), 
            image: '/aylux/آيلوكس مسحوق غسيل أوتوماتيك (2).png', 
            alt: t('aylux.products.laundry.autoPowder2.alt'),
            details: {
              weight: '150 g / 1.2 kg / 3.5 kg / 9 kg',
              material: t('aylux.products.laundry.autoPowder2.material'),
              count: '6 قطع'
            }
          },
          { 
            name: t('aylux.products.laundry.liquidDetergent.name'), 
            description: t('aylux.products.laundry.liquidDetergent.description'), 
            image: '/aylux/آيلوكس مسحوق الغسيل السائل.png', 
            alt: t('aylux.products.laundry.liquidDetergent.alt'),
            details: {
              weight: '900 ml',
              material: t('aylux.products.laundry.liquidDetergent.material'),
              count: t('aylux.products.laundry.liquidDetergent.count')
            }
          },
          { 
            name: t('aylux.products.laundry.fabricSoftener.name'), 
            description: t('aylux.products.laundry.fabricSoftener.description'), 
            image: '/aylux/آيلوكس مطري الغسيل.png', 
            alt: t('aylux.products.laundry.fabricSoftener.alt'),
            details: {
              weight: '900 ml',
              material: t('aylux.products.laundry.fabricSoftener.material'),
              count: t('aylux.products.laundry.fabricSoftener.count')
            }
          },
          { 
            name: t('aylux.products.laundry.stainRemover.name'), 
            description: t('aylux.products.laundry.stainRemover.description'), 
            image: '/aylux/آيلوكس مزيل البقع.png', 
            alt: t('aylux.products.laundry.stainRemover.alt'),
            details: {
              weight: '900 ml',
              material: t('aylux.products.laundry.stainRemover.material'),
              count: t('aylux.products.laundry.stainRemover.count')
            } 
          },
          { 
            name: t('aylux.products.laundry.regularPowder.name'), 
            description: t('aylux.products.laundry.regularPowder.description'), 
            image: '/aylux/آيلوكس مسحوق الغسيل اليدوي.png', 
            alt: t('aylux.products.laundry.regularPowder.alt'),
            details: {
              weight: '300 g / 600 g / 3 kg / 5 kg / 9 kg',
              material: t('aylux.products.laundry.regularPowder.material'),
              count: t('aylux.products.laundry.regularPowder.count')
            }
          }
        ]
      },
      {
        title: t('aylux.categories.personal'),
        products: [
          { 
            name: t('aylux.products.personal.liquidSoap1.name'), 
            description: t('aylux.products.personal.liquidSoap1.description'), 
            image: '/aylux/آيلوكس صابون سائل (1).png', 
            alt: t('aylux.products.personal.liquidSoap1.alt'),
            details: {
              weight: '3 L',
              material: t('aylux.products.personal.liquidSoap1.material'),
              count: '4 قطع'
            }
          },
          { 
            name: t('aylux.products.personal.liquidSoap2.name'), 
            description: t('aylux.products.personal.liquidSoap2.description'), 
            image: '/aylux/آيلوكس صابون سائل (2).png', 
            alt: t('aylux.products.personal.liquidSoap2.alt'),
            details: {
              weight: '400 ml',
              material: t('aylux.products.personal.liquidSoap2.material'),
              count: t('aylux.products.personal.liquidSoap2.count')
            }
          }
        ]
      }
    ],
    pageClass: 'aylux-page',
    aboutId: 'about-aylux'
  };

  return <BrandPageTemplate {...ayluxData} />;
};

export default AyluxPage;

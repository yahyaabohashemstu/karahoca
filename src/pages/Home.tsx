import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Header from '../components/Header';
import Hero from '../components/Hero';
import BrandsSection from '../components/BrandsSection';
import WorkSection from '../components/WorkSection';
import NumbersSection from '../components/NumbersSection';
import AboutSection from '../components/AboutSection';
import Footer from '../components/Footer';

const Home: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="home-page">
      <SEO
        title={t('home.seo.title')}
        description={t('home.seo.description')}
        keywords={t('home.seo.keywords')}
        ogImage="/KARAHOCA-1-newPhoto.webp"
        canonicalUrl="https://karahoca.com/"
      />
      <div className="bg-elements">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>
      
      <Header />
      
      <main>
        <Hero />
        <BrandsSection />
        <WorkSection />
        <NumbersSection />
        <AboutSection />
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;
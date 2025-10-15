import React from 'react';

const GoalSection: React.FC = () => {
  return (
    <section id="goal" className="section glass-section">
      <div className="section-divider"></div>
      <div className="container split">
        <div className="fx-reveal">
          <h2 className="section-title">هدفنا</h2>
          {/* <p className="goal-subtitle">النمو المستمر والابتكار في قطاع المنظفات</p> */}
          <p>
            تلتزم شركتنا بالنمو المستمر والابتكار في قطاع المنظفات. تشمل أهدافنا المستقبلية توسيع طاقتنا الإنتاجية، وتطوير خطوط منتجات صديقة للبيئة ومستدامة، ودمج التقنيات المتقدمة لتعزيز الكفاءة والجودة.
          </p>
        </div>
        <div className="fx-up">
          <div className="about-media glass-media">
            <div className="blob animated-blob blob--alt"></div>
            <div style={{ width: '320px', height: '320px', position: 'relative', margin: 'auto' }}>
              <img 
                src="/cropped-karahoca-logo-s-.webp" 
                alt="هدف KARAHOCA"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  display: 'block', 
                  position: 'absolute', 
                  top: 0, 
                  left: 0 
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GoalSection;
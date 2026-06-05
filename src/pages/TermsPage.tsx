import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useIsMobile } from '../hooks/useIsMobile';

const L: Record<string, { title: string; updated: string; sections: { heading: string; body: string }[] }> = {
  ar: {
    title: 'شروط الاستخدام',
    updated: 'آخر تحديث: يناير 2025',
    sections: [
      { heading: 'قبول الشروط', body: 'باستخدامك لموقع KARAHOCA الإلكتروني، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام الموقع.' },
      { heading: 'استخدام الموقع', body: 'يُسمح لك باستخدام هذا الموقع للأغراض المشروعة فقط. يُحظر استخدام الموقع بأي طريقة قد تؤدي إلى إلحاق الضرر بالموقع أو الإضرار بتجربة المستخدمين الآخرين.' },
      { heading: 'الملكية الفكرية', body: 'جميع المحتويات المعروضة على هذا الموقع، بما في ذلك النصوص والصور والشعارات والعلامات التجارية (DİOX, AYLUX)، هي ملك لشركة KARAHOCA KIMYA ومحمية بموجب قوانين الملكية الفكرية.' },
      { heading: 'المنتجات والمعلومات', body: 'نبذل جهوداً معقولة لضمان دقة معلومات المنتجات المعروضة على الموقع. ومع ذلك، قد تختلف الألوان والأحجام والتفاصيل الفعلية عن تلك المعروضة على الشاشة.' },
      { heading: 'تحديد المسؤولية', body: 'يُقدَّم هذا الموقع ومحتواه "كما هو" دون أي ضمانات صريحة أو ضمنية. لا تتحمل KARAHOCA مسؤولية أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام هذا الموقع.' },
      { heading: 'القانون الحاكم', body: 'تخضع هذه الشروط لقوانين الجمهورية التركية. أي نزاع ينشأ عن هذه الشروط يخضع للاختصاص القضائي الحصري لمحاكم كيليس، تركيا.' },
      { heading: 'التواصل', body: 'لأي استفسارات حول هذه الشروط، تواصل معنا عبر البريد الإلكتروني: info@karahoca.com أو الهاتف: +90 530 591 4990.' },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: January 2025',
    sections: [
      { heading: 'Acceptance of Terms', body: 'By using the KARAHOCA website, you agree to be bound by these terms and conditions. If you do not agree to any of these terms, please do not use the website.' },
      { heading: 'Use of Website', body: 'You are permitted to use this website for lawful purposes only. Use of the website in any manner that could cause damage to the site or impair other users\' experience is prohibited.' },
      { heading: 'Intellectual Property', body: 'All content displayed on this website, including text, images, logos, and trademarks (DİOX, AYLUX), is the property of KARAHOCA KIMYA and is protected under intellectual property laws.' },
      { heading: 'Products and Information', body: 'We make reasonable efforts to ensure the accuracy of product information displayed on the website. However, actual colors, sizes, and details may differ from those displayed on screen.' },
      { heading: 'Limitation of Liability', body: 'This website and its content are provided "as is" without any express or implied warranties. KARAHOCA shall not be liable for any direct or indirect damages arising from the use of this website.' },
      { heading: 'Governing Law', body: 'These terms are governed by the laws of the Republic of Turkey. Any dispute arising from these terms shall be subject to the exclusive jurisdiction of the courts of Kilis, Turkey.' },
      { heading: 'Contact', body: 'For any inquiries regarding these terms, contact us via email: info@karahoca.com or phone: +90 530 591 4990.' },
    ],
  },
  tr: {
    title: 'Kullanım Şartları',
    updated: 'Son güncelleme: Ocak 2025',
    sections: [
      { heading: 'Şartların Kabulü', body: 'KARAHOCA web sitesini kullanarak bu şart ve koşullara uymayı kabul ediyorsunuz. Bu şartlardan herhangi birini kabul etmiyorsanız, lütfen web sitesini kullanmayınız.' },
      { heading: 'Web Sitesi Kullanımı', body: 'Bu web sitesini yalnızca yasal amaçlarla kullanmanıza izin verilmektedir. Siteye zarar verebilecek veya diğer kullanıcıların deneyimini bozabilecek şekilde kullanım yasaktır.' },
      { heading: 'Fikri Mülkiyet', body: 'Bu web sitesinde görüntülenen metin, görsel, logo ve ticari markalar (DİOX, AYLUX) dahil tüm içerikler KARAHOCA KIMYA\'nın mülkiyetindedir ve fikri mülkiyet yasaları ile korunmaktadır.' },
      { heading: 'Ürünler ve Bilgiler', body: 'Web sitesinde görüntülenen ürün bilgilerinin doğruluğunu sağlamak için makul çabaları gösteriyoruz. Ancak gerçek renkler, boyutlar ve ayrıntılar ekranda görüntülenenlerden farklı olabilir.' },
      { heading: 'Sorumluluk Sınırlaması', body: 'Bu web sitesi ve içeriği açık veya zımni herhangi bir garanti olmaksızın "olduğu gibi" sunulmaktadır. KARAHOCA, bu web sitesinin kullanımından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz.' },
      { heading: 'Uygulanacak Hukuk', body: 'Bu şartlar Türkiye Cumhuriyeti yasalarına tabidir. Bu şartlardan doğan herhangi bir uyuşmazlık, Kilis, Türkiye mahkemelerinin münhasır yargı yetkisine tabidir.' },
      { heading: 'İletişim', body: 'Bu şartlar hakkındaki sorularınız için e-posta: info@karahoca.com veya telefon: +90 530 591 4990 üzerinden bize ulaşın.' },
    ],
  },
  ru: {
    title: 'Условия использования',
    updated: 'Последнее обновление: январь 2025',
    sections: [
      { heading: 'Принятие условий', body: 'Используя веб-сайт KARAHOCA, вы соглашаетесь соблюдать настоящие условия. Если вы не согласны с какими-либо из этих условий, пожалуйста, не используйте сайт.' },
      { heading: 'Использование сайта', body: 'Вам разрешено использовать этот сайт только в законных целях. Использование сайта любым способом, который может нанести ущерб сайту или ухудшить опыт других пользователей, запрещено.' },
      { heading: 'Интеллектуальная собственность', body: 'Весь контент, отображаемый на этом сайте, включая тексты, изображения, логотипы и торговые марки (DİOX, AYLUX), является собственностью KARAHOCA KIMYA и защищен законами об интеллектуальной собственности.' },
      { heading: 'Продукты и информация', body: 'Мы прилагаем разумные усилия для обеспечения точности информации о продуктах на сайте. Однако фактические цвета, размеры и детали могут отличаться от отображаемых на экране.' },
      { heading: 'Ограничение ответственности', body: 'Этот сайт и его содержимое предоставляются "как есть" без каких-либо явных или подразумеваемых гарантий. KARAHOCA не несет ответственности за любые прямые или косвенные убытки, возникшие в результате использования этого сайта.' },
      { heading: 'Применимое право', body: 'Настоящие условия регулируются законодательством Турецкой Республики. Любой спор, возникающий из настоящих условий, подлежит исключительной юрисдикции судов Килиса, Турция.' },
      { heading: 'Контакты', body: 'По любым вопросам относительно этих условий свяжитесь с нами по электронной почте: info@karahoca.com или по телефону: +90 530 591 4990.' },
    ],
  },
};

const TermsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isMobile = useIsMobile(768);
  const lang = i18n.resolvedLanguage || 'ar';
  const d = L[lang] || L.ar;

  return (
    <>
      <SEO title={`${d.title} | KARAHOCA`} description={d.sections[0].body.slice(0, 160)} canonicalUrl="https://karahoca.com/terms" />
      <Header />
      <main style={{ minHeight: '60vh', padding: isMobile ? '2rem 1.25rem' : '4rem 2rem' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 700, marginBottom: 8 }}>{d.title}</h1>
          <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '2rem' }}>{d.updated}</p>
          {d.sections.map((s, i) => (
            <section key={i} style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 6 }}>{s.heading}</h2>
              <p style={{ lineHeight: 1.7, opacity: 0.85 }}>{s.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default TermsPage;

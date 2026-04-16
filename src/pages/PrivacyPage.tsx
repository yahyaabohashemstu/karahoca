import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useIsMobile } from '../hooks/useIsMobile';

const L: Record<string, { title: string; updated: string; sections: { heading: string; body: string }[] }> = {
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: يناير 2025',
    sections: [
      { heading: 'جمع المعلومات', body: 'نجمع المعلومات التي تقدمها لنا مباشرة عند استخدام نموذج الاتصال أو الاشتراك في النشرة الإخبارية. تشمل هذه المعلومات: الاسم، البريد الإلكتروني، ورقم الهاتف.' },
      { heading: 'استخدام المعلومات', body: 'نستخدم المعلومات التي نجمعها للرد على استفساراتك، إرسال تحديثات المنتجات والعروض، تحسين خدماتنا وموقعنا الإلكتروني، والامتثال للالتزامات القانونية.' },
      { heading: 'ملفات تعريف الارتباط', body: 'يستخدم موقعنا ملفات تعريف الارتباط (Cookies) لتحسين تجربة التصفح وتحليل حركة المرور. يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال متصفحك.' },
      { heading: 'مشاركة المعلومات', body: 'لا نبيع أو نشارك معلوماتك الشخصية مع أطراف ثالثة إلا عند الضرورة لتقديم خدماتنا أو الامتثال للقانون.' },
      { heading: 'أمن البيانات', body: 'نتخذ تدابير أمنية معقولة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التغيير أو الإفصاح أو التدمير.' },
      { heading: 'حقوقك', body: 'يحق لك طلب الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها. للاستفسارات، تواصل معنا على info@karahoca.com.' },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: January 2025',
    sections: [
      { heading: 'Information Collection', body: 'We collect information you provide directly when using our contact form or subscribing to our newsletter. This includes: name, email address, and phone number.' },
      { heading: 'Use of Information', body: 'We use the information we collect to respond to your inquiries, send product updates and offers, improve our services and website, and comply with legal obligations.' },
      { heading: 'Cookies', body: 'Our website uses cookies to improve browsing experience and analyze traffic. You can control cookie settings through your browser.' },
      { heading: 'Information Sharing', body: 'We do not sell or share your personal information with third parties except when necessary to provide our services or comply with the law.' },
      { heading: 'Data Security', body: 'We take reasonable security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.' },
      { heading: 'Your Rights', body: 'You have the right to request access to, correction of, or deletion of your personal data. For inquiries, contact us at info@karahoca.com.' },
    ],
  },
  tr: {
    title: 'Gizlilik Politikasi',
    updated: 'Son guncelleme: Ocak 2025',
    sections: [
      { heading: 'Bilgi Toplama', body: 'Iletisim formunu kullandiginizda veya bultenimize abone oldugunuzda dogrudan bize sagladiginiz bilgileri topluyoruz. Bu bilgiler: ad, e-posta adresi ve telefon numarasini icerir.' },
      { heading: 'Bilgi Kullanimi', body: 'Topladigimiz bilgileri sorulariniza yanit vermek, urun guncellemeleri ve teklifler gondermek, hizmetlerimizi ve web sitemizi iyilestirmek ve yasal yukumluluklere uymak icin kullaniyoruz.' },
      { heading: 'Cerezler', body: 'Web sitemiz tarama deneyimini iyilestirmek ve trafigi analiz etmek icin cerezler kullanir. Cerez ayarlarini tarayiciniz uzerinden kontrol edebilirsiniz.' },
      { heading: 'Bilgi Paylasimi', body: 'Hizmetlerimizi sunmak veya yasalara uymak icin gerekli olmadikca kisisel bilgilerinizi ucuncu taraflarla satmaz veya paylasmayiz.' },
      { heading: 'Veri Guvenligi', body: 'Kisisel bilgilerinizi yetkisiz erisim, degistirme, ifsa veya imhadan korumak icin makul guvenlik onlemleri aliyoruz.' },
      { heading: 'Haklariniz', body: 'Kisisel verilerinize erisim, duzeltme veya silme talebinde bulunma hakkiniz vardir. Sorulariniz icin info@karahoca.com adresinden bize ulasin.' },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: январь 2025',
    sections: [
      { heading: 'Сбор информации', body: 'Мы собираем информацию, которую вы предоставляете напрямую при использовании контактной формы или подписке на нашу рассылку. Это включает: имя, адрес электронной почты и номер телефона.' },
      { heading: 'Использование информации', body: 'Мы используем собранную информацию для ответа на ваши запросы, отправки обновлений продуктов и предложений, улучшения наших услуг и сайта, а также соблюдения правовых обязательств.' },
      { heading: 'Файлы cookie', body: 'Наш сайт использует файлы cookie для улучшения опыта просмотра и анализа трафика. Вы можете управлять настройками cookie через ваш браузер.' },
      { heading: 'Передача информации', body: 'Мы не продаем и не передаем вашу личную информацию третьим лицам, за исключением случаев, когда это необходимо для предоставления наших услуг или соблюдения закона.' },
      { heading: 'Безопасность данных', body: 'Мы принимаем разумные меры безопасности для защиты вашей личной информации от несанкционированного доступа, изменения, раскрытия или уничтожения.' },
      { heading: 'Ваши права', body: 'Вы имеете право запросить доступ, исправление или удаление ваших персональных данных. По вопросам обращайтесь по адресу info@karahoca.com.' },
    ],
  },
};

const PrivacyPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isMobile = useIsMobile(768);
  const lang = i18n.resolvedLanguage || 'ar';
  const d = L[lang] || L.ar;

  return (
    <>
      <SEO title={`${d.title} | KARAHOCA`} description={d.sections[0].body.slice(0, 160)} canonicalUrl="https://karahoca.com/privacy" />
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

export default PrivacyPage;

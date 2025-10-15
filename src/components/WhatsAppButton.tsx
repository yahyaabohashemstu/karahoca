import React from 'react';
import { useTranslation } from 'react-i18next';
import { trackWhatsAppClick } from './GoogleAnalytics';
import './WhatsAppButton.css';

interface WhatsAppButtonProps {
  phoneNumber?: string;
  message?: string;
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ 
  phoneNumber = '905305914990',
  message
}) => {
  const { t } = useTranslation();
  const defaultMessage = message || t('whatsapp.message');
  
  // زر الواتساب دائماً ظاهر من بداية الصفحة

  const handleClick = () => {
    // تتبع النقر على زر WhatsApp
    trackWhatsAppClick();
    
    const encodedMessage = encodeURIComponent(defaultMessage);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      className="whatsapp-button whatsapp-button--visible"
      onClick={handleClick}
      aria-label={t('whatsapp.title')}
      title={t('whatsapp.title')}
    >
      <svg
        className="whatsapp-button__icon"
        width="24"
        height="24"
        viewBox="0 0 32 32"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M27.281 4.65C24.318 1.687 20.424 0.056 16.187 0C7.338 0 0.127 7.211 0.123 16.063C0.122 18.89 0.849 21.651 2.232 24.088L0 32L8.118 29.809C10.463 31.071 13.098 31.731 15.773 31.732H15.781C24.627 31.732 31.838 24.521 31.842 15.669C31.844 11.435 30.243 7.612 27.281 4.65ZM16.187 29.051H16.181C13.782 29.05 11.428 28.421 9.368 27.232L8.875 26.943L3.848 28.236L5.166 23.334L4.847 22.824C3.537 20.683 2.842 18.212 2.843 15.663C2.846 8.719 8.246 3.32 16.193 3.32C19.998 3.322 23.578 4.806 26.259 7.489C28.939 10.171 30.421 13.753 30.419 17.557C30.416 24.501 25.016 29.9 16.187 29.051ZM24.978 20.243C24.583 20.046 22.626 19.086 22.268 18.948C21.91 18.811 21.651 18.742 21.392 19.137C21.133 19.532 20.398 20.441 20.166 20.7C19.934 20.959 19.702 20.99 19.307 20.793C18.912 20.596 17.616 20.177 16.088 18.812C14.892 17.745 14.086 16.424 13.854 16.029C13.622 15.634 13.829 15.42 14.026 15.224C14.205 15.044 14.421 14.758 14.618 14.526C14.815 14.294 14.884 14.124 15.021 13.865C15.158 13.606 15.09 13.374 14.991 13.177C14.892 12.98 14.089 11.021 13.762 10.231C13.443 9.463 13.121 9.571 12.883 9.561C12.658 9.551 12.399 9.549 12.14 9.549C11.881 9.549 11.454 9.648 11.096 10.043C10.738 10.438 9.718 11.398 9.718 13.357C9.718 15.316 11.127 17.214 11.324 17.473C11.521 17.732 14.082 21.781 18.079 23.478C19.049 23.901 19.806 24.152 20.396 24.341C21.369 24.651 22.258 24.607 22.962 24.505C23.753 24.392 25.373 23.509 25.7 22.551C26.027 21.593 26.027 20.793 25.928 20.626C25.829 20.459 25.57 20.36 25.175 20.163L24.978 20.243Z"/>
      </svg>
    </button>
  );
};

export default WhatsAppButton;

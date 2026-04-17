import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ai-chat.css';

const AIChatWidget = lazy(() => import('./AIChat'));

const LazyAIChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const [shouldLoadWidget, setShouldLoadWidget] = useState(false);
  const openToggleLabel = t('aiWidget.openToggleLabel', { defaultValue: 'Open AI assistant' });

  if (shouldLoadWidget) {
    return (
      <Suspense
        fallback={(
          <div className="ai-assistant" aria-live="polite">
            <button
              type="button"
              className="ai-assistant__toggle"
              disabled
              aria-busy="true"
              aria-label={openToggleLabel}
              title={openToggleLabel}
            >
              ...
            </button>
          </div>
        )}
      >
        <AIChatWidget initiallyOpen />
      </Suspense>
    );
  }

  return (
    <div className="ai-assistant" aria-live="polite">
      <button
        type="button"
        className="ai-assistant__toggle"
        onClick={() => setShouldLoadWidget(true)}
        aria-expanded={false}
        aria-haspopup="dialog"
        aria-label={openToggleLabel}
        title={openToggleLabel}
      >
        🤖
      </button>
    </div>
  );
};

export default LazyAIChatWidget;

import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ai-chat.css';

const AIChatWidget = lazy(() => import('./AIChat'));

/**
 * Wrapper that defers the chat-widget JS payload until ~1.5 s after the
 * page renders. The earlier "click to load" approach saved ~30 KB on the
 * initial bundle but had a critical side-effect: the attention-grabbing
 * affordances (pulse rings, online dot, rotating hints, exit-intent)
 * never armed before the user opened the panel — and once they did open
 * it, `interactedRef` latched and the engagement features stayed dark
 * forever. Net: the bot was effectively invisible.
 *
 * The new approach mounts the placeholder immediately (so the toggle
 * button is visible on first paint), then loads the real widget on a
 * short timer. By the time the 3 s "hint #1" timer fires inside the
 * real widget, it's already mounted; the engagement loop runs as
 * designed. We still get the bundle split (~30 KB lazy) without the UX
 * regression.
 *
 * `initiallyOpen={false}` is critical — the previous code passed `true`
 * because the user had just clicked the load trigger, but with auto-
 * loading we mount the widget in its CLOSED state so the visitor sees
 * the toggle + all the engagement cues before deciding to open.
 */
const AUTO_LOAD_DELAY_MS = 1500;

const LazyAIChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const [shouldLoadWidget, setShouldLoadWidget] = useState(false);
  const openToggleLabel = t('aiWidget.openToggleLabel', { defaultValue: 'Open AI assistant' });

  useEffect(() => {
    // requestIdleCallback would be ideal here but Safari still doesn't
    // ship it; a plain setTimeout with the same intent is fine — the
    // delay is "shortly after the page is interactive", not "exactly
    // when idle".
    const id = window.setTimeout(() => setShouldLoadWidget(true), AUTO_LOAD_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

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
        {/* Mount in CLOSED state so the engagement layer (pulse +
            rotating hints + exit-intent) runs before the visitor
            decides to open the panel. */}
        <AIChatWidget initiallyOpen={false} />
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

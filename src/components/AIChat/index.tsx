import React, { memo } from 'react';
import { useChatState } from '../../hooks/useChatState';
import { useIsMobile } from '../../hooks/useIsMobile';
import ChatShell from './ChatShell';
import ExitIntentPopup from './ExitIntentPopup';
import '../../styles/ai-chat.css';

interface AIChatWidgetProps {
  initiallyOpen?: boolean;
}

/**
 * Orchestrator for the AI chat widget — the single export consumers import.
 *
 * Responsibilities:
 *   - Wire `useChatState` (all state + side effects live there) to the
 *     presentational components (`ChatShell`, `MessageList`, `MessageInput`,
 *     `SuggestionChips`).
 *   - Render the floating toggle button when the panel is closed.
 *   - Render the welcome-hint bubble (shown 3 s after mount on first visit).
 *
 * Previously: `src/components/AIChatWidget.tsx` — a single 906-line file that
 * mixed state, i18n UI strings, knowledge-base logic, prompt construction,
 * and rendering. Phase 3 split it into:
 *
 *   components/AIChat/
 *     index.tsx          (this file — orchestrator, ~90 lines)
 *     ChatShell.tsx      (expanded window)
 *     MessageList.tsx    (transcript + loading dots)
 *     MessageInput.tsx   (textarea + send)
 *     SuggestionChips.tsx (quick-reply chips)
 *   hooks/useChatState.ts (all state machine + effects + prompt build)
 *   lib/aiChat/          (knowledge, suggestions, welcome, context)
 */
const AIChatWidget: React.FC<AIChatWidgetProps> = ({ initiallyOpen = false }) => {
  const state = useChatState({ initiallyOpen });
  const isMobile = useIsMobile(768);

  const {
    uiText,
    currentLang,
    isRtl,
    isOpen,
    currentHintKey,
    showExitIntent,
    messages,
    inputValue,
    isLoading,
    statusMessage,
    suggestions,
    openChat,
    closeChat,
    dismissWelcomeHint,
    acceptExitIntent,
    dismissExitIntent,
    setInputValue,
    handleSend,
    handleSuggestionClick,
    handleFollowupClick,
    handleContinueOnWhatsApp,
    canContinueOnWhatsApp,
    inputRef,
    messagesEndRef,
  } = state;

  const canSubmit = inputValue.trim().length > 0;
  // Pick the localised hint text for whichever rotation slot is currently
  // active. `currentHintKey` is null when no hint should be visible
  // (panel open, all hints exhausted, or user already engaged).
  const activeHintText = currentHintKey ? uiText.hints[currentHintKey] : null;

  return (
    <div className="ai-assistant" aria-live="polite">
      {activeHintText && (
        <button
          type="button"
          className="ai-assistant__welcome-hint"
          style={{
            // `all: unset` wipes native <button> chrome so the hint visually
            // matches the previous <div> exactly.
            all: 'unset',
            boxSizing: 'border-box',
            position: 'absolute',
            bottom: isMobile ? '6px' : '8px',
            left: isRtl ? (isMobile ? '58px' : '72px') : 'auto',
            right: isRtl ? 'auto' : (isMobile ? '58px' : '72px'),
            background: 'var(--orange, #f54b1a)',
            color: '#fff',
            borderRadius: isMobile ? '16px' : '20px',
            boxShadow: '0 4px 24px rgba(10,42,94,0.10)',
            padding: isMobile ? '0.42rem 1rem' : '0.5rem 1.5rem',
            fontSize: isMobile ? '0.92rem' : '1.08rem',
            fontWeight: 500,
            zIndex: 999,
            cursor: 'pointer',
            transition: 'opacity 0.5s',
            minWidth: isMobile ? '128px' : '160px',
            maxWidth: isMobile ? '250px' : '340px',
            whiteSpace: 'nowrap',
            direction: isRtl ? 'rtl' : 'ltr',
            textAlign: isRtl ? 'right' : 'left',
            display: 'inline-block',
            lineHeight: 1.35,
            // Subtle entry animation per hint switch — re-keyed below so
            // the bubble feels fresh every time the rotation advances.
            animation: 'ai-assistant__hint-pop 280ms ease-out',
          }}
          // Re-mount the button when the hint key changes so the CSS
          // entry animation replays. Without this React would keep the
          // same DOM node and the animation would only fire once.
          key={currentHintKey}
          onClick={dismissWelcomeHint}
          aria-label={uiText.closeWelcomeHint}
          title={uiText.closeWelcomeHint}
        >
          {activeHintText}
        </button>
      )}

      {!isOpen && (
        <button
          type="button"
          className="ai-assistant__toggle"
          onClick={openChat}
          aria-expanded={false}
          aria-label={uiText.openToggleLabel}
          title={uiText.openToggleLabel}
        >
          {/* "Online" presence indicator — small green dot with its own
              gentle breathing animation. The aria-label below carries the
              localised "Online now" text so screen-reader users get the
              same context. */}
          <span
            className="ai-assistant__online-dot"
            role="img"
            aria-label={uiText.onlineLabel}
          />
          <span className="ai-assistant__toggle-icon" aria-hidden="true">
            🤖
          </span>
        </button>
      )}

      {showExitIntent && (
        <ExitIntentPopup
          title={uiText.exitIntent.title}
          body={uiText.exitIntent.body}
          acceptLabel={uiText.exitIntent.accept}
          dismissLabel={uiText.exitIntent.dismiss}
          isRtl={isRtl}
          onAccept={acceptExitIntent}
          onDismiss={dismissExitIntent}
        />
      )}

      {isOpen && (
        <ChatShell
          uiText={uiText}
          currentLang={currentLang}
          isRtl={isRtl}
          messages={messages}
          inputValue={inputValue}
          isLoading={isLoading}
          statusMessage={statusMessage}
          suggestions={suggestions}
          canSubmit={canSubmit}
          inputRef={inputRef}
          messagesEndRef={messagesEndRef}
          onInputChange={setInputValue}
          onSubmit={() => { void handleSend(); }}
          onSuggestionClick={handleSuggestionClick}
          onFollowupPick={handleFollowupClick}
          onContinueOnWhatsApp={handleContinueOnWhatsApp}
          canContinueOnWhatsApp={canContinueOnWhatsApp}
          onClose={closeChat}
        />
      )}
    </div>
  );
};

/**
 * React.memo with the default shallow comparator.
 *
 * The sole prop is `initiallyOpen?: boolean` — Object.is handles that
 * correctly. When a parent re-renders for unrelated reasons (route change,
 * wishlist mutation, language switch bubbling up), this component's render
 * function is skipped. All internal state lives inside `useChatState`'s
 * `useState`/`useRef` — React preserves them across skipped parent renders,
 * so an in-flight chat survives parent churn unchanged.
 */
const MemoizedAIChatWidget = memo(AIChatWidget);
MemoizedAIChatWidget.displayName = 'AIChatWidget';

export default MemoizedAIChatWidget;

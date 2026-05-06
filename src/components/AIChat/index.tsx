import React, { memo } from 'react';
import { Robot } from '@phosphor-icons/react';
import { useChatState } from '../../hooks/useChatState';
import { useIsMobile } from '../../hooks/useIsMobile';
import ChatShell from './ChatShell';
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
    showWelcomeHint,
    messages,
    inputValue,
    isLoading,
    statusMessage,
    suggestions,
    openChat,
    closeChat,
    dismissWelcomeHint,
    setInputValue,
    handleSend,
    handleSuggestionClick,
    inputRef,
    messagesEndRef,
  } = state;

  const canSubmit = inputValue.trim().length > 0;

  return (
    <div className="ai-assistant" aria-live="polite">
      {showWelcomeHint && (
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
          }}
          onClick={dismissWelcomeHint}
          aria-label={uiText.closeWelcomeHint}
          title={uiText.closeWelcomeHint}
        >
          {uiText.welcomeHint}
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
          <Robot size={28} weight="duotone" aria-hidden="true" />
        </button>
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

import React, { memo } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import SuggestionChips from './SuggestionChips';
import type { ChatUIStrings, ChatMessage } from '../../hooks/useChatState';

interface ChatShellProps {
  uiText: ChatUIStrings;
  currentLang: string;
  isRtl: boolean;
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  statusMessage: string | null;
  suggestions: string[];
  canSubmit: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestionClick: (suggestion: string) => void;
  onClose: () => void;
}

/**
 * The expanded chat window — header, transcript, suggestions, composer,
 * privacy notice. Pure presentation: takes state + callbacks from
 * `useChatState` and delegates rendering to the three sub-components.
 */
const ChatShellComponent: React.FC<ChatShellProps> = ({
  uiText,
  currentLang,
  isRtl,
  messages,
  inputValue,
  isLoading,
  statusMessage,
  suggestions,
  canSubmit,
  inputRef,
  messagesEndRef,
  onInputChange,
  onSubmit,
  onSuggestionClick,
  onClose,
}) => (
  <div className="ai-assistant__window" data-lang={currentLang}>
    <header className="ai-assistant__header">
      <div>
        <p className="ai-assistant__title">{uiText.title}</p>
        <span className="ai-assistant__subtitle">{uiText.subtitle}</span>
      </div>
      <button
        type="button"
        className="ai-assistant__close"
        onClick={onClose}
        aria-label={uiText.closeLabel}
      >
        ×
      </button>
    </header>

    <MessageList
      messages={messages}
      isLoading={isLoading}
      loadingLabel={uiText.loadingLabel}
      endRef={messagesEndRef}
    />

    {!isLoading && (
      <SuggestionChips suggestions={suggestions} onPick={onSuggestionClick} />
    )}

    {statusMessage && <div className="ai-assistant__status">{statusMessage}</div>}

    <MessageInput
      value={inputValue}
      placeholder={uiText.placeholder}
      sendLabel={uiText.sendButton}
      ariaLabel={uiText.inputLabel}
      disabled={isLoading}
      canSubmit={canSubmit}
      inputRef={inputRef}
      onChange={onInputChange}
      onSubmit={onSubmit}
    />

    <div className="ai-assistant__privacy" dir={isRtl ? 'rtl' : 'ltr'}>
      {uiText.privacyNotice}
    </div>
  </div>
);

const ChatShell = memo(ChatShellComponent);
ChatShell.displayName = 'ChatShell';

export default ChatShell;

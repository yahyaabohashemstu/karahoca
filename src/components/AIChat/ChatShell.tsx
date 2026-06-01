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
  /**
   * Follow-up chip clicked under the latest assistant message. Separate
   * from `onSuggestionClick` so the hook can fire a distinct analytics
   * event (`chat_followup_chip_used`) for chip-driven engagement.
   */
  onFollowupPick: (followup: string) => void;
  /**
   * "Continue on WhatsApp" CTA tapped. Hook handles the transcript
   * build + URL open; shell just renders the button when
   * `canContinueOnWhatsApp` is true.
   */
  onContinueOnWhatsApp: () => void;
  /** Whether the WhatsApp continuation CTA should be visible right now. */
  canContinueOnWhatsApp: boolean;
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
  onFollowupPick,
  onContinueOnWhatsApp,
  canContinueOnWhatsApp,
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
      productCardLabels={uiText.productCard}
      lang={currentLang}
      followupsLabel={uiText.followupsLabel}
      onFollowupPick={onFollowupPick}
      endRef={messagesEndRef}
    />

    {!isLoading && (
      <SuggestionChips
        suggestions={suggestions}
        onPick={onSuggestionClick}
        // Caption the chips only on a fresh conversation (transcript still
        // just the synthetic welcome bubble) — there they are the
        // product-browse starters and the label frames them as guidance.
        // Once a real exchange exists they're dynamic follow-ups and need
        // no caption.
        label={messages.every((m) => m.id === 'welcome') ? uiText.starterPrompt : undefined}
      />
    )}

    {statusMessage && <div className="ai-assistant__status">{statusMessage}</div>}

    {/* WhatsApp continuation CTA — appears once the visitor has had at
        least one real exchange with Karo. Sits ABOVE the composer so
        the visitor sees it as "an alternative to typing the next
        question" rather than "a way to close the chat". The button
        carries the WhatsApp brand colour to read as a confident
        hand-off, not a settings option. */}
    {canContinueOnWhatsApp && (
      <button
        type="button"
        className="ai-assistant__continue-whatsapp"
        onClick={onContinueOnWhatsApp}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
        <span>{uiText.continueOnWhatsApp}</span>
      </button>
    )}

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

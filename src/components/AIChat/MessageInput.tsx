import React, { memo } from 'react';
import type { KeyboardEvent } from 'react';

interface MessageInputProps {
  value: string;
  placeholder: string;
  sendLabel: string;
  ariaLabel: string;
  disabled: boolean;
  canSubmit: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * Composer for the AI chat: textarea + send button.
 *
 * Submit semantics: Enter submits, Shift+Enter inserts a newline. `disabled`
 * reflects the in-flight state (request pending); `canSubmit` reflects
 * whether the current draft is non-empty after trimming.
 */
const MessageInputComponent: React.FC<MessageInputProps> = ({
  value,
  placeholder,
  sendLabel,
  ariaLabel,
  disabled,
  canSubmit,
  inputRef,
  onChange,
  onSubmit,
}) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="ai-assistant__composer">
      <textarea
        ref={inputRef}
        className="ai-assistant__input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={2000}
      />
      <button
        type="button"
        className="ai-assistant__send"
        onClick={onSubmit}
        disabled={disabled || !canSubmit}
      >
        {sendLabel}
      </button>
    </div>
  );
};

const MessageInput = memo(MessageInputComponent);
MessageInput.displayName = 'MessageInput';

export default MessageInput;

import React, { memo } from 'react';

interface SuggestionChipsProps {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  /**
   * Optional caption rendered above the chip row. Supplied only for the
   * fresh-conversation "starter" chips (e.g. "Try asking:") to frame them
   * as guidance; omitted for the post-reply dynamic suggestions, which
   * speak for themselves.
   */
  label?: string;
}

/**
 * Clickable suggestion chips shown under the transcript when the assistant
 * has just finished a reply. Each chip acts like a canned user question —
 * clicking it immediately sends the text as a new user message.
 *
 * On a brand-new conversation the same row is used for product-browse
 * "starter" chips, in which case `label` is passed to caption the row.
 */
const SuggestionChipsComponent: React.FC<SuggestionChipsProps> = ({ suggestions, onPick, label }) => {
  if (suggestions.length === 0) return null;
  return (
    <div className="ai-assistant__suggestions">
      {label && <span className="ai-assistant__suggestions-label">{label}</span>}
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="ai-assistant__suggestion-btn"
          onClick={() => onPick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

const SuggestionChips = memo(SuggestionChipsComponent);
SuggestionChips.displayName = 'SuggestionChips';

export default SuggestionChips;

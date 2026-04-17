import React, { memo } from 'react';

interface SuggestionChipsProps {
  suggestions: string[];
  onPick: (suggestion: string) => void;
}

/**
 * Clickable suggestion chips shown under the transcript when the assistant
 * has just finished a reply. Each chip acts like a canned user question —
 * clicking it immediately sends the text as a new user message.
 */
const SuggestionChipsComponent: React.FC<SuggestionChipsProps> = ({ suggestions, onPick }) => {
  if (suggestions.length === 0) return null;
  return (
    <div className="ai-assistant__suggestions">
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

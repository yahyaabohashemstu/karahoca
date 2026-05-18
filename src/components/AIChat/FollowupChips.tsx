import React, { memo } from 'react';

interface FollowupChipsProps {
  followups: string[];
  /** Localised aria-label for the chip strip (region landmark). */
  ariaLabel: string;
  /** Fires when the visitor taps a chip — parent sends it as the next user message. */
  onPick: (followup: string) => void;
}

/**
 * Tappable "what to ask next" chips rendered below the latest assistant
 * message. Visitors who don't know what to type next get an obvious path
 * to the most commercially valuable follow-up questions (sizes, brand
 * comparison, shipping, etc.) — curated server-side per detected
 * intent (see `server/services/aiFollowups.mjs`).
 *
 * Why a dedicated component:
 *   1. Memoised. The chip strip re-renders only when its `followups`
 *      array reference changes; the parent MessageList's per-token
 *      streaming re-renders skip this subtree entirely.
 *   2. Keyboard-accessible. Each chip is a real `<button>` so the
 *      visitor can Tab through them and hit Enter — no custom
 *      role/keydown handling required.
 *   3. Future-friendly. When we add a "regenerate suggestions" or
 *      "dismiss this strip" affordance, it lives here, not in
 *      MessageList's already-long render.
 */
const FollowupChipsComponent: React.FC<FollowupChipsProps> = ({
  followups,
  ariaLabel,
  onPick,
}) => {
  if (!followups || followups.length === 0) return null;
  return (
    <div
      className="ai-chat-followups"
      role="region"
      aria-label={ariaLabel}
    >
      {followups.map((text) => (
        <button
          key={text}
          type="button"
          className="ai-chat-followup-chip"
          onClick={() => onPick(text)}
        >
          {text}
        </button>
      ))}
    </div>
  );
};

const FollowupChips = memo(FollowupChipsComponent);
FollowupChips.displayName = 'FollowupChips';

export default FollowupChips;

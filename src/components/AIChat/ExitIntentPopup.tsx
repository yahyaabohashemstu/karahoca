import React, { useEffect, useRef } from 'react';

/**
 * Modal that appears once per session when the visitor signals they're
 * about to leave (desktop: pointer crosses the top edge of the viewport,
 * mobile: a rapid upward scroll from a deep-scroll position). The owner
 * of those triggers is `useChatState`; this component is purely
 * presentational and is mounted/unmounted by the parent based on the
 * `showExitIntent` flag from the hook.
 *
 * Accessibility:
 *   • Renders inside a `<dialog>` so screen readers and assistive tech
 *     know it's modal without us re-implementing focus traps from
 *     scratch.
 *   • Escape and backdrop click dismiss with the "no thanks" semantic
 *     (not engagement, doesn't open the chat).
 *   • The two CTAs have explicit, distinct labels — no ambiguity around
 *     which button does what for keyboard or voice users.
 */
interface ExitIntentPopupProps {
  /** Localised copy from `useChatState().uiText.exitIntent`. */
  title: string;
  body: string;
  acceptLabel: string;
  dismissLabel: string;
  /** Document direction — flips the close-button corner for Arabic. */
  isRtl: boolean;
  /** Fired when the visitor agrees to start chatting. */
  onAccept: () => void;
  /** Fired when the visitor closes the popup without engaging. */
  onDismiss: () => void;
}

const ExitIntentPopup: React.FC<ExitIntentPopupProps> = ({
  title,
  body,
  acceptLabel,
  dismissLabel,
  isRtl,
  onAccept,
  onDismiss,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Promote the static dialog into the top-layer so it visually overlays
  // the rest of the page reliably (no z-index gymnastics needed).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // showModal throws when called twice in StrictMode dev double-invoke;
        // fall through with the dialog already-open.
      }
    }
    const onCancel = (e: Event) => {
      e.preventDefault();
      onDismiss();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
    };
  }, [onDismiss]);

  // Click on the backdrop (outside the .panel) → dismiss. We can't use
  // a parent overlay div because <dialog> renders its own.
  const onDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onDismiss();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={onDialogClick}
      className="ai-exit-intent"
      aria-labelledby="ai-exit-intent-title"
      aria-describedby="ai-exit-intent-body"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="ai-exit-intent__panel">
        <button
          type="button"
          className="ai-exit-intent__close"
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
        >
          ×
        </button>

        <div className="ai-exit-intent__icon" aria-hidden="true">
          💬
        </div>

        <h2 id="ai-exit-intent-title" className="ai-exit-intent__title">
          {title}
        </h2>

        <p id="ai-exit-intent-body" className="ai-exit-intent__body">
          {body}
        </p>

        <div className="ai-exit-intent__actions">
          <button
            type="button"
            className="ai-exit-intent__cta ai-exit-intent__cta--primary"
            onClick={onAccept}
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            className="ai-exit-intent__cta ai-exit-intent__cta--secondary"
            onClick={onDismiss}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default ExitIntentPopup;

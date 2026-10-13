import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keyboard behaviour shared by the admin's modal dialogs. They were mouse-
 * only: Escape did nothing, focus stayed on the page behind the overlay (so
 * Tab walked through hidden controls) and was lost when the dialog closed.
 *
 * While `open`: focus moves into the dialog, Tab cycles inside it, Escape
 * calls `onClose` (the caller decides whether closing is allowed right now,
 * e.g. not mid-upload). On close, focus returns to whatever had it before.
 *
 * Put the returned ref on the dialog panel and give the panel tabIndex={-1}.
 */
export const useModalDialog = <T extends HTMLElement>(open: boolean, onClose: () => void) => {
  const panelRef = useRef<T | null>(null);
  // Latest callback without re-running the effect (which would steal focus
  // back to the panel on every render).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return panelRef;
};

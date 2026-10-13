import React, { cloneElement, isValidElement, useId } from 'react';
import { useModalDialog } from '../utils/useModalDialog';
import { IconButton } from './Button';

/**
 * Label + control + hint/error, with the label linked to the control (a
 * generated id is given to the single child unless it has one).
 *
 *   <Field label="Name (AR)" required hint="…"><input className="adm-input" … /></Field>
 */
export const Field: React.FC<{
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Content next to the label (e.g. an "AI write" button). */
  labelAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, error, required, labelAction, className, children }) => {
  const generated = useId();
  let controlId: string | undefined;
  let control = children;
  if (isValidElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>(children)) {
    controlId = children.props.id ?? generated;
    control = cloneElement(children, {
      id: controlId,
      'aria-invalid': error ? true : children.props['aria-invalid'],
      'aria-describedby': hint || error ? `${controlId}-help` : children.props['aria-describedby'],
    });
  }
  return (
    <div className={['adm-field', error ? 'has-error' : '', className ?? ''].filter(Boolean).join(' ')}>
      {(label || labelAction) && (
        <div className="adm-field-label-row">
          {label && (
            <label className="adm-label" htmlFor={controlId}>
              {label}
              {required && <span className="adm-required" aria-hidden="true"> *</span>}
            </label>
          )}
          {labelAction && <div className="adm-field-label-action">{labelAction}</div>}
        </div>
      )}
      {control}
      {(error || hint) && (
        <p id={controlId ? `${controlId}-help` : undefined} className={error ? 'adm-field-error' : 'adm-field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
};

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits typed on an Arabic keyboard
// become 0-9; anything that is not a digit is dropped.
const westernDigits = (raw: string) => raw
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
  .replace(/\D/g, '');

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'dir'>;

/**
 * Whole-number box. A real <input type="number"> shows its value in the
 * browser's own locale, whatever the page language: in an Arabic Chrome a
 * 0 is "٠", a lone dot. This is a text box that only holds Western digits;
 * ArrowUp / ArrowDown still step by one within min / max.
 *
 *   <NumberInput className="adm-input" min={0} value={n} onChange={(e) => setN(Number(e.target.value))} />
 */
export const NumberInput: React.FC<NumberInputProps> = ({ className, onChange, onKeyDown, min, max, ...rest }) => {
  const stepBy = (input: HTMLInputElement, delta: number) => {
    let next = (parseInt(input.value, 10) || 0) + delta;
    if (min != null && next < Number(min)) next = Number(min);
    if (max != null && next > Number(max)) next = Number(max);
    // Through the native setter + an input event, so React's onChange runs
    // for controlled and uncontrolled boxes alike.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      dir="ltr"
      autoComplete="off"
      className={`${className ?? 'adm-input'} adm-input-num`}
      onChange={(e) => {
        const clean = westernDigits(e.target.value);
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          stepBy(e.currentTarget, e.key === 'ArrowUp' ? 1 : -1);
        }
      }}
    />
  );
};

/**
 * Dialog shell: dimmed overlay, panel with title + close button, body, and
 * an optional footer for the actions. Escape and the close button call
 * onClose (pass a no-op while something must not be interrupted).
 */
export const Modal: React.FC<{
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Clicking the dim background closes too (off by default: it loses work too easily). */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}> = ({ open, title, onClose, closeLabel, footer, size = 'md', closeOnBackdrop, children }) => {
  const panelRef = useModalDialog<HTMLDivElement>(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <div
      className="adm-modal-overlay"
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`adm-modal adm-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="adm-modal-head">
          <h2 id={titleId} className="adm-modal-title">{title}</h2>
          <IconButton icon="close" label={closeLabel} onClick={onClose} size="sm" />
        </div>
        <div className="adm-modal-body">{children}</div>
        {footer && <div className="adm-modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

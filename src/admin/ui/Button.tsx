import React from 'react';
import { Link } from 'react-router-dom';
import { AdminIcon, type IconName } from '../components/AdminIcons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'link';
export type ButtonSize = 'sm' | 'md';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (before the label in reading order). */
  icon?: IconName;
  /** Trailing icon, e.g. "forward" on a "View" link. */
  iconEnd?: IconName;
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
  /** Stretch to the container's width. */
  block?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type AsButton = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { to?: undefined; href?: undefined };
type AsLink = CommonProps & { to: string; href?: undefined; replace?: boolean; state?: unknown; title?: string; 'aria-label'?: string; onClick?: React.MouseEventHandler };
type AsAnchor = CommonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string; to?: undefined };

export type ButtonProps = AsButton | AsLink | AsAnchor;

const classesFor = ({ variant = 'secondary', size = 'md', block, className }: CommonProps) =>
  ['adm-btn', `adm-btn-${variant}`, size === 'sm' ? 'adm-btn-sm' : '', block ? 'adm-btn-block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

const Inner: React.FC<CommonProps> = ({ icon, iconEnd, loading, size, children }) => (
  <>
    {loading
      ? <span className="adm-spinner adm-btn-spinner" aria-hidden="true" />
      : icon && <AdminIcon name={icon} size={size === 'sm' ? 'xs' : 'sm'} />}
    {children !== undefined && children !== null && children !== false && <span className="adm-btn-label">{children}</span>}
    {iconEnd && !loading && <AdminIcon name={iconEnd} size={size === 'sm' ? 'xs' : 'sm'} />}
  </>
);

/**
 * The admin's only button. Renders a <button>, a router <Link> (`to`) or an
 * <a> (`href`) with the same look. Variants: primary (the page's main
 * action — one per view), secondary (default), ghost (quiet, in toolbars
 * and tables), danger (destructive), ai (AI-assisted actions), link.
 */
export const Button: React.FC<ButtonProps> = (props) => {
  const { variant, size, icon, iconEnd, loading, block, className, children, ...rest } = props as CommonProps & Record<string, unknown>;
  const classes = classesFor({ variant, size, block, className });
  const inner = <Inner icon={icon} iconEnd={iconEnd} loading={loading} size={size}>{children}</Inner>;

  if (typeof (rest as { to?: string }).to === 'string') {
    const { to, ...linkRest } = rest as { to: string } & Record<string, unknown>;
    return <Link to={to} className={classes} {...(linkRest as object)}>{inner}</Link>;
  }
  if (typeof (rest as { href?: string }).href === 'string') {
    return <a className={classes} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</a>;
  }
  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type="button"
      {...buttonRest}
      className={classes}
      disabled={Boolean(buttonRest.disabled) || Boolean(loading)}
      aria-busy={loading || undefined}
    >
      {inner}
    </button>
  );
};

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Required: read out and shown as the tooltip — the icon alone says nothing to a screen reader. */
  label: string;
  tone?: 'default' | 'danger' | 'accent';
  size?: ButtonSize;
  loading?: boolean;
  to?: string;
}

/** Square icon-only button (edit, delete, close, move…) with a label. */
export const IconButton: React.FC<IconButtonProps> = ({ icon, label, tone = 'default', size = 'md', loading, to, className, ...rest }) => {
  const classes = ['adm-icon-btn', `adm-icon-btn-${tone}`, size === 'sm' ? 'adm-icon-btn-sm' : '', className ?? ''].filter(Boolean).join(' ');
  const content = loading
    ? <span className="adm-spinner adm-btn-spinner" aria-hidden="true" />
    : <AdminIcon name={icon} size={size === 'sm' ? 'sm' : 'md'} />;
  if (to) {
    return <Link to={to} className={classes} aria-label={label} title={label}>{content}</Link>;
  }
  return (
    <button
      type="button"
      {...rest}
      className={classes}
      aria-label={label}
      title={label}
      disabled={Boolean(rest.disabled) || Boolean(loading)}
    >
      {content}
    </button>
  );
};

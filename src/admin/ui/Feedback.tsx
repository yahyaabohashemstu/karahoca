import React from 'react';
import { Link } from 'react-router-dom';
import { AdminIcon, type IconName } from '../components/AdminIcons';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'violet';

/** Small rounded label: a status, a count, a category. */
export const Badge: React.FC<{
  tone?: Tone;
  icon?: IconName;
  title?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon, title, className, children }) => (
  <span className={['adm-badge', `adm-badge-${tone}`, className ?? ''].filter(Boolean).join(' ')} title={title}>
    {icon && <AdminIcon name={icon} size={12} />}
    <span>{children}</span>
  </span>
);

/** A product brand, in the same colour on every page: AYLUX accent, DIOX blue. */
export const BrandBadge: React.FC<{ brand: string }> = ({ brand }) => (
  <Badge tone={brand === 'DIOX' ? 'info' : brand === 'AYLUX' ? 'accent' : 'neutral'}>
    <bdi dir="ltr">{brand}</bdi>
  </Badge>
);

const ALERT_ICON: Record<'info' | 'success' | 'warning' | 'danger', IconName> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  danger: 'alert',
};

/** A message across the content: errors, confirmations, notices. */
export const Alert: React.FC<{
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}> = ({ tone = 'info', title, action, className, children }) => (
  <div
    className={['adm-alert', `adm-alert-${tone}`, className ?? ''].filter(Boolean).join(' ')}
    role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
  >
    <AdminIcon name={ALERT_ICON[tone]} size="md" className="adm-alert-icon" />
    <div className="adm-alert-body">
      {title && <strong className="adm-alert-title">{title}</strong>}
      {children && <div>{children}</div>}
    </div>
    {action && <div className="adm-alert-action">{action}</div>}
  </div>
);

/**
 * KPI tile: icon, label, big number, optional line under it. The same tile
 * on the dashboard, analytics, campaigns, Karo insights and the newsletter.
 */
export const StatCard: React.FC<{
  icon: IconName;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  to?: string;
}> = ({ icon, label, value, sub, tone = 'accent', to }) => {
  const body = (
    <div className={`adm-stat adm-stat-${tone}`}>
      <span className="adm-stat-icon-chip"><AdminIcon name={icon} size="lg" /></span>
      <span className="adm-stat-label">{label}</span>
      <span className="adm-stat-number">{value}</span>
      {sub && <span className="adm-stat-sub">{sub}</span>}
    </div>
  );
  return to ? <Link to={to} className="adm-stat-link">{body}</Link> : body;
};

/** Grid for StatCards: as many equal columns as fit, never an orphan wider than the rest. */
export const StatGrid: React.FC<{ children: React.ReactNode; min?: number }> = ({ children, min = 170 }) => (
  <div className="adm-stats" style={{ '--adm-stat-min': `${min}px` } as React.CSSProperties}>{children}</div>
);

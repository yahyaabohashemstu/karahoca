import React from 'react';
import { Link } from 'react-router-dom';
import { AdminIcon, type IconName } from '../components/AdminIcons';

/**
 * Page title row. Every admin page starts with this: an optional back link
 * above the title, the title (no icon — the sidebar already says where you
 * are), an optional one-line subtitle, and the page's actions at the end.
 */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { to: string; label: string };
  /** Small badges next to the title (status, counts). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, back, meta, actions }) => (
  <header className="adm-page-header">
    <div className="adm-page-heading">
      {back && (
        <Link to={back.to} className="adm-back-link">
          <AdminIcon name="back" size="sm" />
          <span>{back.label}</span>
        </Link>
      )}
      <div className="adm-page-title-row">
        <h1 className="adm-page-title">{title}</h1>
        {meta && <div className="adm-page-meta">{meta}</div>}
      </div>
      {subtitle && <p className="adm-page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="adm-page-actions">{actions}</div>}
  </header>
);

/**
 * Content panel. `title` + optional icon/subtitle/actions make the header;
 * `flush` removes the body padding (for tables that run edge to edge).
 */
export const Card: React.FC<{
  title?: React.ReactNode;
  icon?: IconName;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  flush?: boolean;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}> = ({ title, icon, subtitle, actions, flush, className, id, children }) => (
  <section id={id} className={['adm-card', flush ? 'adm-card-flush' : '', className ?? ''].filter(Boolean).join(' ')}>
    {(title || actions) && (
      <div className="adm-card-head">
        <div className="adm-card-head-text">
          {title && (
            <h2 className="adm-card-title">
              {icon && <AdminIcon name={icon} size="md" className="adm-card-title-icon" />}
              <span>{title}</span>
            </h2>
          )}
          {subtitle && <p className="adm-card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="adm-card-actions">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

/** A row of filters / search above a list. */
export const Toolbar: React.FC<{ children: React.ReactNode; end?: React.ReactNode; className?: string }> = ({ children, end, className }) => (
  <div className={['adm-toolbar', className ?? ''].filter(Boolean).join(' ')}>
    <div className="adm-toolbar-main">{children}</div>
    {end && <div className="adm-toolbar-end">{end}</div>}
  </div>
);

/** A small heading that splits one page into sections. */
export const SectionTitle: React.FC<{ icon?: IconName; children: React.ReactNode; actions?: React.ReactNode }> = ({ icon, children, actions }) => (
  <div className="adm-section-title">
    {icon && <AdminIcon name={icon} size="sm" />}
    <h2>{children}</h2>
    {actions && <div className="adm-section-title-actions">{actions}</div>}
  </div>
);

/** Centered spinner for a page or panel that is loading. */
export const Loading: React.FC<{ label?: string; inline?: boolean }> = ({ label, inline }) => (
  <div className={inline ? 'adm-loading-inline' : 'adm-loading-center'} role="status">
    <span className="adm-spinner" aria-hidden="true" />
    {label && <span>{label}</span>}
  </div>
);

/** Nothing to show (yet): icon, one line, optional explanation and action. */
export const EmptyState: React.FC<{
  icon?: IconName;
  title: React.ReactNode;
  text?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}> = ({ icon = 'info', title, text, action, compact }) => (
  <div className={['adm-empty', compact ? 'adm-empty-compact' : ''].filter(Boolean).join(' ')}>
    <span className="adm-empty-icon"><AdminIcon name={icon} size={compact ? 'lg' : 'xl'} /></span>
    <p className="adm-empty-title">{title}</p>
    {text && <p className="adm-empty-text">{text}</p>}
    {action && <div className="adm-empty-action">{action}</div>}
  </div>
);

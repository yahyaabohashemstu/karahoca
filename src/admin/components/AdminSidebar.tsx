import React from 'react';
import { NavLink } from 'react-router-dom';
import { AdminIcon, type IconName } from './AdminIcons';

interface SidebarProps {
  onLogout: () => void;
}

const NAV: { group: string; items: { to: string; label: string; icon: IconName }[] }[] = [
  { group: 'Overview', items: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
    { to: '/admin/funnel',    label: 'Funnel',    icon: 'funnel' },
    { to: '/admin/cohorts',   label: 'Cohorts',   icon: 'cohorts' },
    { to: '/admin/ab-tests',  label: 'A/B Tests', icon: 'abtest' },
  ]},
  { group: 'Content', items: [
    { to: '/admin/products', label: 'Products', icon: 'products' },
    { to: '/admin/categories', label: 'Categories', icon: 'categories' },
    { to: '/admin/news', label: 'News', icon: 'news' },
    { to: '/admin/blog', label: 'Blog', icon: 'blog' },
  ]},
  { group: 'Marketing', items: [
    { to: '/admin/campaigns', label: 'Campaigns', icon: 'campaigns' },
    { to: '/admin/newsletter', label: 'Newsletter', icon: 'newsletter' },
  ]},
  { group: 'AI & Users', items: [
    { to: '/admin/ai-knowledge', label: 'AI Knowledge', icon: 'ai' },
    { to: '/admin/karo-insights', label: 'Karo Insights', icon: 'insights' },
    { to: '/admin/chats', label: 'Chat History', icon: 'chats' },
    { to: '/admin/audit-log', label: 'Audit Log', icon: 'audit' },
  ]},
];

export const AdminSidebar: React.FC<SidebarProps> = ({ onLogout }) => (
  <aside className="adm-sidebar">
    {/* Logo */}
    <div className="adm-sidebar-logo">
      <h2>KARAHOCA</h2>
      <span>Admin Dashboard</span>
    </div>

    {/* Navigation */}
    <nav className="adm-nav" aria-label="Admin">
      {NAV.map((group) => (
        <div key={group.group} className="adm-nav-group">
          <div className="adm-nav-section">{group.group}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="adm-nav-icon"><AdminIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>

    {/* Footer */}
    <div className="adm-sidebar-footer">
      <button
        type="button"
        className="adm-nav-link adm-btn-ghost adm-nav-logout"
        onClick={onLogout}
      >
        <span className="adm-nav-icon"><AdminIcon name="logout" /></span>
        <span>Logout</span>
      </button>
    </div>
  </aside>
);

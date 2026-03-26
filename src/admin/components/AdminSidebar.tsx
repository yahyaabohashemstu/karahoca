import React from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
}

const NAV = [
  { group: 'Overview', items: [
    { to: '/admin/dashboard',  label: 'Dashboard',  icon: '📊' },
    { to: '/admin/analytics',  label: 'Analytics',  icon: '📈' },
  ]},
  { group: 'Content', items: [
    { to: '/admin/products',   label: 'Products',   icon: '🧴' },
    { to: '/admin/news',       label: 'News',        icon: '📰' },
  ]},
  { group: 'Marketing', items: [
    { to: '/admin/campaigns',  label: 'Campaigns',  icon: '📧' },
    { to: '/admin/newsletter', label: 'Newsletter', icon: '✉️' },
  ]},
  { group: 'AI & Users', items: [
    { to: '/admin/ai-knowledge', label: 'AI Knowledge', icon: '🤖' },
    { to: '/admin/chats',        label: 'Chat History', icon: '💬' },
  ]},
];

export const AdminSidebar: React.FC<SidebarProps> = ({ onLogout }) => (
  <aside className="adm-sidebar">
    <div className="adm-sidebar-logo">
      <h2>KARAHOCA</h2>
      <span>Admin Dashboard</span>
    </div>

    <nav className="adm-nav">
      {NAV.map(group => (
        <div key={group.group}>
          <div className="adm-nav-section">{group.group}</div>
          {group.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>

    <div className="adm-sidebar-footer">
      <button className="adm-nav-link adm-btn-ghost" onClick={onLogout} style={{ color: 'var(--adm-danger)' }}>
        <span>🚪</span>
        <span>Logout</span>
      </button>
    </div>
  </aside>
);

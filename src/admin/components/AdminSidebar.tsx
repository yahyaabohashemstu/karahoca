import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChartBar,
  ChartLineUp,
  Drop,
  FolderOpen,
  Newspaper,
  EnvelopeSimple,
  Envelope,
  Robot,
  ChatCircle,
  MagnifyingGlass,
  SignOut,
  type Icon,
} from '@phosphor-icons/react';

interface SidebarProps {
  onLogout: () => void;
}

interface NavItem {
  to: string;
  label: string;
  Icon: Icon;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  { group: 'Overview', items: [
    { to: '/admin/dashboard', label: 'Dashboard', Icon: ChartBar },
    { to: '/admin/analytics', label: 'Analytics', Icon: ChartLineUp },
  ]},
  { group: 'Content', items: [
    { to: '/admin/products',  label: 'Products',   Icon: Drop },
    { to: '/admin/categories',label: 'Categories', Icon: FolderOpen },
    { to: '/admin/news',      label: 'News',       Icon: Newspaper },
  ]},
  { group: 'Marketing', items: [
    { to: '/admin/campaigns', label: 'Campaigns',  Icon: EnvelopeSimple },
    { to: '/admin/newsletter',label: 'Newsletter', Icon: Envelope },
  ]},
  { group: 'AI & Users', items: [
    { to: '/admin/ai-knowledge', label: 'AI Knowledge', Icon: Robot },
    { to: '/admin/chats',        label: 'Chat History',  Icon: ChatCircle },
    { to: '/admin/audit-log',    label: 'Audit Log',     Icon: MagnifyingGlass },
  ]},
];

const ICON_PROPS = { size: 18, weight: 'duotone' as const };

export const AdminSidebar: React.FC<SidebarProps> = ({ onLogout }) => (
  <aside className="adm-sidebar">
    <div className="adm-sidebar-logo">
      <h2>KARAHOCA</h2>
      <span>Admin Dashboard</span>
    </div>

    <nav className="adm-nav">
      {NAV.map((group) => (
        <div key={group.group} className="adm-nav-group">
          <div className="adm-nav-section">{group.group}</div>
          {group.items.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon {...ICON_PROPS} className="adm-nav-link__icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>

    <div className="adm-sidebar-footer">
      <button
        className="adm-nav-link adm-nav-link--logout"
        onClick={onLogout}
        type="button"
      >
        <SignOut {...ICON_PROPS} className="adm-nav-link__icon" />
        <span>Logout</span>
      </button>
    </div>
  </aside>
);

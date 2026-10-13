import React from 'react';
import { NavLink } from 'react-router-dom';
import { AdminIcon, type IconName } from './AdminIcons';
import { defineMessages, useAdminLang, useT } from '../i18n/core';

interface SidebarProps {
  onLogout: () => void;
}

const messages = defineMessages({
  en: {
    subtitle: 'Admin Dashboard',
    navLabel: 'Admin',
    groupOverview: 'Overview',
    groupContent: 'Content',
    groupMarketing: 'Marketing',
    groupAi: 'AI & Users',
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    funnel: 'Funnel',
    cohorts: 'Cohorts',
    abTests: 'A/B Tests',
    products: 'Products',
    categories: 'Categories',
    news: 'News',
    blog: 'Blog',
    campaigns: 'Campaigns',
    newsletter: 'Newsletter',
    aiKnowledge: 'AI Knowledge',
    karoInsights: 'Karo Insights',
    chats: 'Chat History',
    auditLog: 'Audit Log',
    logout: 'Logout',
    switchLang: 'العربية',
    switchLangLabel: 'Switch the dashboard to Arabic',
  },
  ar: {
    subtitle: 'لوحة الإدارة',
    navLabel: 'الإدارة',
    groupOverview: 'نظرة عامة',
    groupContent: 'المحتوى',
    groupMarketing: 'التسويق',
    groupAi: 'الذكاء الاصطناعي والزوار',
    dashboard: 'لوحة التحكم',
    analytics: 'التحليلات',
    funnel: 'قمع التحويل',
    cohorts: 'مجموعات الاحتفاظ',
    abTests: 'اختبارات A/B',
    products: 'المنتجات',
    categories: 'الفئات',
    news: 'الأخبار',
    blog: 'المدونة',
    campaigns: 'الحملات البريدية',
    newsletter: 'النشرة البريدية',
    aiKnowledge: 'معرفة المساعد',
    karoInsights: 'إحصاءات كارو',
    chats: 'سجل المحادثات',
    auditLog: 'سجل العمليات',
    logout: 'تسجيل الخروج',
    switchLang: 'English',
    switchLangLabel: 'تحويل لوحة التحكم إلى الإنجليزية',
  },
});

type Key = keyof typeof messages.en;

const NAV: { group: Key; items: { to: string; label: Key; icon: IconName }[] }[] = [
  { group: 'groupOverview', items: [
    { to: '/admin/dashboard', label: 'dashboard', icon: 'dashboard' },
    { to: '/admin/analytics', label: 'analytics', icon: 'analytics' },
    { to: '/admin/funnel',    label: 'funnel',    icon: 'funnel' },
    { to: '/admin/cohorts',   label: 'cohorts',   icon: 'cohorts' },
    { to: '/admin/ab-tests',  label: 'abTests',   icon: 'abtest' },
  ]},
  { group: 'groupContent', items: [
    { to: '/admin/products', label: 'products', icon: 'products' },
    { to: '/admin/categories', label: 'categories', icon: 'categories' },
    { to: '/admin/news', label: 'news', icon: 'news' },
    { to: '/admin/blog', label: 'blog', icon: 'blog' },
  ]},
  { group: 'groupMarketing', items: [
    { to: '/admin/campaigns', label: 'campaigns', icon: 'campaigns' },
    { to: '/admin/newsletter', label: 'newsletter', icon: 'newsletter' },
  ]},
  { group: 'groupAi', items: [
    { to: '/admin/ai-knowledge', label: 'aiKnowledge', icon: 'ai' },
    { to: '/admin/karo-insights', label: 'karoInsights', icon: 'insights' },
    { to: '/admin/chats', label: 'chats', icon: 'chats' },
    { to: '/admin/audit-log', label: 'auditLog', icon: 'audit' },
  ]},
];

export const AdminSidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const t = useT(messages);
  const { lang, setLang } = useAdminLang();

  return (
    <aside className="adm-sidebar">
      {/* Logo */}
      <div className="adm-sidebar-logo">
        <h2>KARAHOCA</h2>
        <span>{t('subtitle')}</span>
      </div>

      {/* Navigation */}
      <nav className="adm-nav" aria-label={t('navLabel')}>
        {NAV.map((group) => (
          <div key={group.group} className="adm-nav-group">
            <div className="adm-nav-section">{t(group.group)}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}
              >
                <span className="adm-nav-icon"><AdminIcon name={item.icon} /></span>
                <span>{t(item.label)}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="adm-sidebar-footer">
        <button
          type="button"
          className="adm-nav-link adm-btn-ghost adm-nav-lang"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          aria-label={t('switchLangLabel')}
          lang={lang === 'ar' ? 'en' : 'ar'}
        >
          <span className="adm-nav-icon"><AdminIcon name="language" /></span>
          <span>{t('switchLang')}</span>
        </button>
        <button
          type="button"
          className="adm-nav-link adm-btn-ghost adm-nav-logout"
          onClick={onLogout}
        >
          <span className="adm-nav-icon"><AdminIcon name="logout" /></span>
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
};

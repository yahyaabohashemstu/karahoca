import React from 'react';
import { Link } from 'react-router-dom';
import { type AdminStats, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { adminApi } from '../utils/adminApi';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { AdminIcon, type IconName } from '../components/AdminIcons';
import { SiteRebuildCard } from '../components/SiteRebuildCard';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Dashboard',
    subtitle: 'What is live on the site, and what visitors are doing',
    openGa: 'Open Google Analytics ↗',
    liveProducts: 'Live Products',
    liveProductsSub: 'Visible on the site',
    news: 'News Articles',
    blog: 'Blog Posts',
    publishedSub: 'Published',
    subscribers: 'Subscribers',
    subscribersSub: 'Active newsletter',
    chatVisitors: 'Chat Visitors',
    chatVisitorsSub: 'Talked to the assistant',
    messages7d: 'Messages (7 days)',
    messagesAllTime: '{n} all time',
    recentTitle: 'Recent Chat Visitors',
    recentCopy: 'Latest visitors who used the assistant, with their last question.',
    allChats: 'All chats →',
    colVisitor: 'Visitor',
    colLanguage: 'Language',
    colMessages: 'Messages',
    colLastActive: 'Last Active',
    colLastQuestion: 'Last Question',
    colOpen: 'Open',
    noChats: 'No chat activity yet.',
    quickActions: 'Quick Actions',
    qaProduct: 'Add a product',
    qaProductCopy: 'Create a catalogue item in all four languages.',
    qaNews: 'Publish news',
    qaNewsCopy: 'Write a company announcement.',
    qaBlog: 'Write a blog post',
    qaBlogCopy: 'Draft an article for the blog.',
    qaCampaign: 'New campaign',
    qaCampaignCopy: 'E-mail the newsletter subscribers.',
  },
  ar: {
    title: 'لوحة التحكم',
    subtitle: 'ما يظهر الآن على الموقع، وما يفعله الزوار',
    openGa: 'فتح Google Analytics ↗',
    liveProducts: 'المنتجات المعروضة',
    liveProductsSub: 'ظاهرة على الموقع',
    news: 'الأخبار',
    blog: 'مقالات المدونة',
    publishedSub: 'منشورة',
    subscribers: 'المشتركون',
    subscribersSub: 'في النشرة البريدية',
    chatVisitors: 'زوار المحادثة',
    chatVisitorsSub: 'تحدّثوا مع المساعد',
    messages7d: 'الرسائل (آخر 7 أيام)',
    messagesAllTime: '{n} منذ البداية',
    recentTitle: 'أحدث زوار المحادثة',
    recentCopy: 'آخر الزوار الذين استخدموا المساعد، مع آخر سؤال طرحوه.',
    allChats: 'كل المحادثات ←',
    colVisitor: 'الزائر',
    colLanguage: 'اللغة',
    colMessages: 'الرسائل',
    colLastActive: 'آخر نشاط',
    colLastQuestion: 'آخر سؤال',
    colOpen: 'فتح',
    noChats: 'لا توجد محادثات بعد.',
    quickActions: 'إجراءات سريعة',
    qaProduct: 'إضافة منتج',
    qaProductCopy: 'أنشئ منتجًا في الكتالوج باللغات الأربع.',
    qaNews: 'نشر خبر',
    qaNewsCopy: 'اكتب إعلانًا باسم الشركة.',
    qaBlog: 'كتابة مقال',
    qaBlogCopy: 'ابدأ مقالًا جديدًا للمدونة.',
    qaCampaign: 'حملة جديدة',
    qaCampaignCopy: 'راسل مشتركي النشرة البريدية.',
  },
});

const GA_PROPERTY_ID = import.meta.env.VITE_GA_PROPERTY_ID;
const GA_LINK = GA_PROPERTY_ID
  ? `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY_ID}/reports/intelligenthome`
  : 'https://analytics.google.com/';

const StatCard: React.FC<{ icon: IconName; label: string; value: number; sub: string; to: string }> = ({ icon, label, value, sub, to }) => (
  <Link to={to} className="adm-dashboard-stat-link">
    <div className="adm-stat-card adm-dashboard-stat-card">
      <div className="adm-stat-icon"><AdminIcon name={icon} size={20} /></div>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{fmtNumber(value)}</div>
      <div className="adm-stat-sub">{sub}</div>
    </div>
  </Link>
);

// One row of numbers. The page used to show the same four figures three
// times (hero tiles, stat cards, "workspace snapshot"), the snapshot adding
// unrelated counts together (products + news, subscribers + chat users).
export const AdminDashboard: React.FC = () => {
  const { data, loading, error } = useAsync<AdminStats>(() => adminApi.getStats(), []);
  const t = useT(messages);
  const tc = useT(common);

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>;
  if (error) return <div className="adm-alert adm-alert-error">⚠ {error}</div>;

  const stats = data?.stats;
  const recent = data?.recentUsers || [];
  const quickLinks: { to: string; icon: IconName; title: string; copy: string }[] = [
    { to: '/admin/products/new', icon: 'products', title: t('qaProduct'), copy: t('qaProductCopy') },
    { to: '/admin/news/new', icon: 'news', title: t('qaNews'), copy: t('qaNewsCopy') },
    { to: '/admin/blog/new', icon: 'blog', title: t('qaBlog'), copy: t('qaBlogCopy') },
    { to: '/admin/campaigns/new', icon: 'campaigns', title: t('qaCampaign'), copy: t('qaCampaignCopy') },
  ];

  return (
    <div className="adm-dashboard-page">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
        <a href={GA_LINK} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-secondary adm-btn-sm">
          {t('openGa')}
        </a>
      </div>

      <div className="adm-stat-grid adm-dashboard-stat-grid">
        <StatCard icon="products" label={t('liveProducts')} value={stats?.products ?? 0} sub={t('liveProductsSub')} to="/admin/products" />
        <StatCard icon="news" label={t('news')} value={stats?.news ?? 0} sub={t('publishedSub')} to="/admin/news" />
        <StatCard icon="blog" label={t('blog')} value={stats?.blogPosts ?? 0} sub={t('publishedSub')} to="/admin/blog" />
        <StatCard icon="newsletter" label={t('subscribers')} value={stats?.subscribers ?? 0} sub={t('subscribersSub')} to="/admin/newsletter" />
        <StatCard icon="cohorts" label={t('chatVisitors')} value={stats?.chatUsers ?? 0} sub={t('chatVisitorsSub')} to="/admin/chats" />
        <StatCard
          icon="chats"
          label={t('messages7d')}
          value={stats?.recentMessages ?? 0}
          sub={t('messagesAllTime', { n: stats?.chatMessages ?? 0 })}
          to="/admin/karo-insights"
        />
      </div>

      <div className="adm-dashboard-main-grid">
        <div className="adm-card adm-dashboard-table-card">
          <div className="adm-dashboard-panel-head">
            <div>
              <div className="adm-card-title">{t('recentTitle')}</div>
              <p className="adm-dashboard-panel-copy">{t('recentCopy')}</p>
            </div>
            <Link to="/admin/chats" className="adm-btn adm-btn-ghost adm-btn-sm">{t('allChats')}</Link>
          </div>

          {recent.length > 0 ? (
            <div className="adm-table-wrap" style={{ marginTop: 14 }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('colVisitor')}</th>
                    <th>{t('colLanguage')}</th>
                    <th>{t('colMessages')}</th>
                    <th>{t('colLastActive')}</th>
                    <th>{t('colLastQuestion')}</th>
                    <th><span className="adm-sr-only">{t('colOpen')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((u: ChatUser) => (
                    <tr key={u.id}>
                      <td className="adm-mono adm-text-muted" title={u.id}>{u.id.slice(0, 8)}…</td>
                      <td><span className="adm-badge adm-badge-blue">{u.language}</span></td>
                      <td>{fmtNumber(u.message_count)}</td>
                      <td className="adm-text-muted adm-text-sm">{fmtDateTime(u.last_seen)}</td>
                      <td className="adm-truncate adm-dashboard-question" dir="auto">{u.last_message || u.last_user_message || '—'}</td>
                      <td>
                        <Link to={`/admin/chats/${encodeURIComponent(u.id)}`} className="adm-btn adm-btn-ghost adm-btn-sm">{tc('viewArrow')}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="adm-dashboard-empty-state">{t('noChats')}</div>
          )}
        </div>

        <div className="adm-dashboard-side-column">
          <div className="adm-card adm-dashboard-side-panel">
            <div className="adm-dashboard-panel-head compact">
              <div>
                <div className="adm-card-title">{t('quickActions')}</div>
              </div>
            </div>
            <div className="adm-dashboard-shortcuts">
              {quickLinks.map((item) => (
                <Link key={item.to} to={item.to} className="adm-dashboard-shortcut">
                  <span className="adm-dashboard-shortcut-icon"><AdminIcon name={item.icon} /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <SiteRebuildCard />
        </div>
      </div>
    </div>
  );
};

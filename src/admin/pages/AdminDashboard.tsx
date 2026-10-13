import React from 'react';
import { Link } from 'react-router-dom';
import { type AdminStats, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { adminApi } from '../utils/adminApi';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { AdminIcon, type IconName } from '../components/AdminIcons';
import { Alert, Button, Card, EmptyState, IconButton, LangTag, Loading, PageHeader, StatCard } from '../ui';
import { SiteRebuildCard } from '../components/SiteRebuildCard';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Dashboard',
    subtitle: 'What is live on the site, and what visitors are doing',
    openGa: 'Open Google Analytics',
    liveProducts: 'Live products',
    liveProductsSub: 'Visible on the site',
    news: 'News articles',
    blog: 'Blog posts',
    publishedSub: 'Published',
    subscribers: 'Subscribers',
    subscribersSub: 'Active newsletter',
    chatVisitors: 'Chat visitors',
    chatVisitorsSub: 'Talked to the assistant',
    messages7d: 'Messages (7 days)',
    messagesAllTime: '{n} all time',
    recentTitle: 'Recent chat visitors',
    recentCopy: 'Latest visitors who used the assistant, with their last question.',
    allChats: 'All chats',
    colVisitor: 'Visitor',
    colLanguage: 'Language',
    colMessages: 'Messages',
    colLastActive: 'Last active',
    colLastQuestion: 'Last question',
    colOpen: 'Open',
    noChats: 'No chat activity yet.',
    quickActions: 'Quick actions',
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
    openGa: 'فتح Google Analytics',
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
    allChats: 'كل المحادثات',
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

// One row of numbers. The page used to show the same four figures three
// times (hero tiles, stat cards, "workspace snapshot"), the snapshot adding
// unrelated counts together (products + news, subscribers + chat users).
export const AdminDashboard: React.FC = () => {
  const { data, loading, error } = useAsync<AdminStats>(() => adminApi.getStats(), []);
  const t = useT(messages);
  const tc = useT(common);

  if (loading) return <Loading label={tc('loading')} />;
  if (error) return <Alert tone="danger">{error}</Alert>;

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
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={(
          <Button href={GA_LINK} target="_blank" rel="noopener noreferrer" size="sm" iconEnd="external">
            {t('openGa')}
          </Button>
        )}
      />

      <div className="adm-stat-grid adm-dashboard-stat-grid">
        <StatCard icon="products" label={t('liveProducts')} value={fmtNumber(stats?.products ?? 0)} sub={t('liveProductsSub')} to="/admin/products" />
        <StatCard icon="news" label={t('news')} value={fmtNumber(stats?.news ?? 0)} sub={t('publishedSub')} to="/admin/news" />
        <StatCard icon="blog" label={t('blog')} value={fmtNumber(stats?.blogPosts ?? 0)} sub={t('publishedSub')} to="/admin/blog" />
        <StatCard icon="newsletter" label={t('subscribers')} value={fmtNumber(stats?.subscribers ?? 0)} sub={t('subscribersSub')} to="/admin/newsletter" />
        <StatCard icon="cohorts" label={t('chatVisitors')} value={fmtNumber(stats?.chatUsers ?? 0)} sub={t('chatVisitorsSub')} to="/admin/chats" />
        <StatCard
          icon="chats"
          label={t('messages7d')}
          value={fmtNumber(stats?.recentMessages ?? 0)}
          sub={t('messagesAllTime', { n: stats?.chatMessages ?? 0 })}
          to="/admin/karo-insights"
        />
      </div>

      <div className="adm-dashboard-main-grid">
        <Card
          className="adm-dashboard-table-card"
          title={t('recentTitle')}
          icon="chats"
          subtitle={t('recentCopy')}
          actions={<Button to="/admin/chats" variant="ghost" size="sm" iconEnd="forward">{t('allChats')}</Button>}
        >
          {recent.length > 0 ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('colVisitor')}</th>
                    <th>{t('colLanguage')}</th>
                    <th>{t('colMessages')}</th>
                    <th>{t('colLastActive')}</th>
                    <th>{t('colLastQuestion')}</th>
                    <th className="adm-col-actions"><span className="adm-sr-only">{t('colOpen')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((u: ChatUser) => (
                    <tr key={u.id}>
                      <td className="adm-mono adm-text-muted" title={u.id}>{u.id.slice(0, 8)}…</td>
                      <td><LangTag lang={u.language} /></td>
                      <td>{fmtNumber(u.message_count)}</td>
                      <td className="adm-cell-date">{fmtDateTime(u.last_seen)}</td>
                      <td className="adm-truncate adm-dashboard-question" dir="auto">{u.last_message || u.last_user_message || '—'}</td>
                      <td className="adm-col-actions">
                        <IconButton icon="eye" label={tc('view')} size="sm" to={`/admin/chats/${encodeURIComponent(u.id)}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="chats" title={t('noChats')} compact />
          )}
        </Card>

        <div className="adm-dashboard-side-column">
          <Card className="adm-dashboard-side-panel" title={t('quickActions')} icon="plus">
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
          </Card>
          <SiteRebuildCard />
        </div>
      </div>
    </div>
  );
};

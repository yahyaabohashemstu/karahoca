import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import '../styles/admin.css';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics').then((m) => ({ default: m.AdminAnalytics })));
const AdminChats = lazy(() => import('./pages/AdminChats').then((m) => ({ default: m.AdminChats })));
const AdminChatDetail = lazy(() => import('./pages/AdminChatDetail').then((m) => ({ default: m.AdminChatDetail })));
const AdminProducts = lazy(() => import('./pages/AdminProducts').then((m) => ({ default: m.AdminProducts })));
const AdminCategories = lazy(() => import('./pages/AdminCategories').then((m) => ({ default: m.AdminCategories })));
const AdminProductEdit = lazy(() => import('./pages/AdminProductEdit').then((m) => ({ default: m.AdminProductEdit })));
const AdminNews = lazy(() => import('./pages/AdminNews').then((m) => ({ default: m.AdminNews })));
const AdminNewsEdit = lazy(() => import('./pages/AdminNewsEdit').then((m) => ({ default: m.AdminNewsEdit })));
const AdminNewsletter = lazy(() => import('./pages/AdminNewsletter').then((m) => ({ default: m.AdminNewsletter })));
const AdminCampaigns = lazy(() => import('./pages/AdminCampaigns').then((m) => ({ default: m.AdminCampaigns })));
const AdminCampaignEdit = lazy(() => import('./pages/AdminCampaignEdit').then((m) => ({ default: m.AdminCampaignEdit })));
const AdminAiKnowledge = lazy(() => import('./pages/AdminAiKnowledge').then((m) => ({ default: m.AdminAiKnowledge })));

const Fallback = () => (
  <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>
);

const wrap = (C: React.ComponentType) => (
  <Suspense fallback={<Fallback />}><C /></Suspense>
);

export const AdminApp: React.FC = () => (
  <Routes>
    <Route index element={<AdminLogin />} />
    <Route path="login" element={<AdminLogin />} />

    <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
      <Route path="dashboard" element={wrap(AdminDashboard)} />
      <Route path="analytics" element={wrap(AdminAnalytics)} />
      <Route path="chats" element={wrap(AdminChats)} />
      <Route path="chats/:userId" element={wrap(AdminChatDetail)} />
      <Route path="products" element={wrap(AdminProducts)} />
      <Route path="categories" element={wrap(AdminCategories)} />
      <Route path="products/:id" element={wrap(AdminProductEdit)} />
      <Route path="news" element={wrap(AdminNews)} />
      <Route path="news/:id" element={wrap(AdminNewsEdit)} />
      <Route path="newsletter" element={wrap(AdminNewsletter)} />
      <Route path="campaigns" element={wrap(AdminCampaigns)} />
      <Route path="campaigns/:id" element={wrap(AdminCampaignEdit)} />
      <Route path="ai-knowledge" element={wrap(AdminAiKnowledge)} />
    </Route>

    <Route path="*" element={<Navigate to="" replace />} />
  </Routes>
);

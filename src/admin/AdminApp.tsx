import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import '../styles/admin.css';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminChats     = lazy(() => import('./pages/AdminChats').then(m => ({ default: m.AdminChats })));
const AdminChatDetail = lazy(() => import('./pages/AdminChatDetail').then(m => ({ default: m.AdminChatDetail })));
const AdminProducts  = lazy(() => import('./pages/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminProductEdit = lazy(() => import('./pages/AdminProductEdit').then(m => ({ default: m.AdminProductEdit })));
const AdminNews      = lazy(() => import('./pages/AdminNews').then(m => ({ default: m.AdminNews })));
const AdminNewsEdit  = lazy(() => import('./pages/AdminNewsEdit').then(m => ({ default: m.AdminNewsEdit })));
const AdminNewsletter = lazy(() => import('./pages/AdminNewsletter').then(m => ({ default: m.AdminNewsletter })));

const Fallback = () => (
  <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>
);

export const AdminApp: React.FC = () => (
  <Routes>
    <Route path="/" element={<AdminLogin />} />
    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route path="dashboard" element={<Suspense fallback={<Fallback />}><AdminDashboard /></Suspense>} />
      <Route path="analytics" element={<Suspense fallback={<Fallback />}><AdminAnalytics /></Suspense>} />
      <Route path="chats" element={<Suspense fallback={<Fallback />}><AdminChats /></Suspense>} />
      <Route path="chats/:userId" element={<Suspense fallback={<Fallback />}><AdminChatDetail /></Suspense>} />
      <Route path="products" element={<Suspense fallback={<Fallback />}><AdminProducts /></Suspense>} />
      <Route path="products/:id" element={<Suspense fallback={<Fallback />}><AdminProductEdit /></Suspense>} />
      <Route path="news" element={<Suspense fallback={<Fallback />}><AdminNews /></Suspense>} />
      <Route path="news/:id" element={<Suspense fallback={<Fallback />}><AdminNewsEdit /></Suspense>} />
      <Route path="newsletter" element={<Suspense fallback={<Fallback />}><AdminNewsletter /></Suspense>} />
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Route>
  </Routes>
);

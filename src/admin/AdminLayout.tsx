import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './components/AdminSidebar';
import { clearToken } from './utils/adminApi';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    navigate('/admin');
  };

  return (
    <div className="adm-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="adm-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`adm-sidebar-wrap ${sidebarOpen ? 'open' : ''}`}>
        <AdminSidebar onLogout={handleLogout} />
      </div>

      {/* Main */}
      <div className="adm-main">
        {/* Mobile header */}
        <div className="adm-mobile-header">
          <button
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>KARAHOCA Admin</span>
        </div>

        <div className="adm-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

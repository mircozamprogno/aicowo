// src/components/layout/Layout.jsx
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { useEnvironment } from '../../hooks/useEnvironment';
import NotificationBell from '../notifications/NotificationBell';
import Sidebar from './Sidebar';

const Layout = ({ children, pageTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { isStaging } = useEnvironment();

  return (
    <div className="layout">
      <div className={`mobile-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}>
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar mobile onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div className="desktop-sidebar">
        <div className="sidebar-container">
          <Sidebar />
        </div>
      </div>

      <div className="main-content">
        <div className={`topbar ${isStaging ? 'topbar-staging' : ''}`}>
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="topbar-content">
            <div className="topbar-title">
              <h1 className="app-title">
                {pageTitle ? t(pageTitle) : t('app.appName')}
                {isStaging && <span className="env-badge">STAGING</span>}
              </h1>
            </div>
            <div className="topbar-actions">
              {profile && <NotificationBell />}
              <div className="user-info">
                <span className="user-name">
                  {profile?.first_name} {profile?.last_name}
                </span>
                <span className="user-role">
                  {t(`roles.${profile?.role}`)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <main className="page-content">
          <div className="page-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
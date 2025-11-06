import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Sidebar from './Sidebar';

const Layout = ({ children, pageTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="layout">
      {/* Mobile sidebar */}
      <div className={`mobile-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}>
        <div 
          className="mobile-sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)} 
        />
        <div className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar mobile onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="desktop-sidebar">
        <div className="sidebar-container">
          <Sidebar />
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="topbar-content">
            <div className="topbar-title">
              <h1 className="app-title">{pageTitle ? t(pageTitle) : t('app.appName')}</h1>
            </div>
            <div className="topbar-actions">
              <LanguageSwitcher />
              <div className="user-info">
                <span className="user-name">
                  {profile?.first_name} {profile?.last_name} ({t(`roles.${profile?.role}`)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
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
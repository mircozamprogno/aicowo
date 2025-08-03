import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import Sidebar from './Sidebar';
import { toast } from './ToastContainer';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.hash = '/login';
      toast.success(t('messages.signedOutSuccessfully'));
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error(t('messages.errorSigningOut'));
    }
  };

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
              <h1 className="app-title">{t('app.appName')}</h1>
            </div>
            <div className="topbar-actions">
              <LanguageSwitcher />
              <div className="user-info">
                <span className="user-name">
                  {profile?.first_name} {profile?.last_name} ({t(`roles.${profile?.role}`)})
                </span>
                <button
                  onClick={handleSignOut}
                  className="logout-btn"
                  title={t('auth.signOut')}
                >
                  <LogOut size={24} />
                </button>
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
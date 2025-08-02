import { Building, Home, Users, X } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import Link from './Link';

const Sidebar = ({ mobile = false, onClose }) => {
  const currentPath = window.location.hash.slice(1) || '/dashboard';
  const { t } = useTranslation();
  
  const navigation = [
    { name: t('navigation.dashboard'), href: '/dashboard', icon: Home },
    { name: t('navigation.partners'), href: '/partners', icon: Building },
    { name: t('navigation.users'), href: '/users', icon: Users },
  ];

  return (
    <div className="sidebar">
      {mobile && (
        <div className="mobile-sidebar-close">
          <button onClick={onClose} className="sidebar-close-btn">
            <X size={24} color="white" />
          </button>
        </div>
      )}
      
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Building size={32} color="#4f46e5" />
          <span className="sidebar-logo-text">{t('app.appShortName')}</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={`sidebar-nav-item ${currentPath === item.href ? 'active' : ''}`}
            onClick={mobile ? onClose : undefined}
          >
            <item.icon size={24} className="sidebar-nav-icon" />
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
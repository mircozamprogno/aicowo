import { Building, Home, Settings, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import Link from './Link';

const RoleBasedSidebar = ({ mobile = false, onClose }) => {
  const currentPath = window.location.hash.slice(1) || '/dashboard';
  const { profile } = useAuth();
  const { t } = useTranslation();
  
  // Define navigation items based on user role
  const getNavigationItems = () => {
    const baseItems = [
      { name: t('navigation.dashboard'), href: '/dashboard', icon: Home, roles: ['superadmin', 'admin', 'user'] }
    ];

    // Role-specific navigation items
    const roleSpecificItems = [
      // Superadmin can see everything
      { name: t('navigation.partners'), href: '/partners', icon: Building, roles: ['superadmin'] },
      { name: t('navigation.users'), href: '/users', icon: Users, roles: ['superadmin'] },
      
      // Partner admin can see their partner info and manage users
      { name: t('navigation.partnerInfo'), href: '/partners', icon: Building, roles: ['admin'] },
      { name: t('navigation.teamMembers'), href: '/users', icon: Users, roles: ['admin'] },
      
      // Regular users see limited options
      { name: t('navigation.myBookings'), href: '/bookings', icon: Settings, roles: ['user'] },
    ];

    // Filter items based on user role
    const userRole = profile?.role || 'user';
    const filteredItems = [...baseItems, ...roleSpecificItems].filter(item => 
      item.roles.includes(userRole)
    );

    return filteredItems;
  };

  const navigationItems = getNavigationItems();

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
        
        {/* User role indicator */}
        <div className="sidebar-user-role">
          <div className="user-role-badge">
            <span className="user-role-text">
              {t(`roles.${profile?.role || 'user'}`)}
            </span>
          </div>
          {profile?.partner_uuid && profile?.role !== 'superadmin' && (
            <div className="user-partner-info">
              <span className="user-partner-text">
                {/* This would show partner name if available */}
                {profile?.partner_name || t('navigation.partnerMember')}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
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
      
      {/* Role-specific footer information */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-content">
          {profile?.role === 'superadmin' && (
            <div className="role-info">
              <p className="role-info-text">{t('navigation.systemAdmin')}</p>
            </div>
          )}
          {profile?.role === 'admin' && (
            <div className="role-info">
              <p className="role-info-text">{t('navigation.partnerAdmin')}</p>
            </div>
          )}
          {profile?.role === 'user' && (
            <div className="role-info">
              <p className="role-info-text">{t('navigation.member')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleBasedSidebar;
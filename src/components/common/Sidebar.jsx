import { Building, Cog, FileText, Home, Mail, Settings, Users, X } from 'lucide-react';
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
      { name: t('navigation.invitations'), href: '/invitations', icon: Mail, roles: ['superadmin'] },
      { name: t('navigation.contracts'), href: '/contracts', icon: FileText, roles: ['superadmin'] },
      
      // Partner admin can see their partner info, services, customers, contracts, and invitations
      { name: t('navigation.partnerInfo'), href: '/partners', icon: Building, roles: ['admin'] },
      { name: t('navigation.services'), href: '/services', icon: Cog, roles: ['admin'] },
      { name: t('navigation.customers'), href: '/customers', icon: Users, roles: ['admin'] },
      { name: t('navigation.contracts'), href: '/contracts', icon: FileText, roles: ['admin'] },
      { name: t('navigation.invitations'), href: '/invitations', icon: Mail, roles: ['admin'] },
      { name: t('navigation.settings'), href: '/settings', icon: Settings, roles: ['admin'] },
      
      // Regular users see limited options and settings
      { name: t('navigation.contracts'), href: '/contracts', icon: FileText, roles: ['user'] },
      { name: t('navigation.myBookings'), href: '/bookings', icon: Settings, roles: ['user'] },
      { name: t('navigation.settings'), href: '/settings', icon: Settings, roles: ['user'] },
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
    </div>
  );
};

export default RoleBasedSidebar;
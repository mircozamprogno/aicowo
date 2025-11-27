import { Activity, BellRing, Building, Calendar, Camera, Cog, CreditCard, DollarSign, File, FileText, HelpCircle, Home, Layers, LogOut, Mail, Settings, Tag, TrendingUp, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Link from './Link';
import { toast } from './ToastContainer';

// Add these imports at the top:
import { useTour } from '../../contexts/TourContext';
import TourNotificationBadge from '../tour/TourNotificationBadge';

const RoleBasedSidebar = ({ mobile = false, onClose }) => {
  const currentPath = window.location.hash.slice(1) || '/dashboard';
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  
  // State for partner branding
  const [partnerBranding, setPartnerBranding] = useState({
    logo: null,
    companyName: null,
    loading: true
  });

  // State for version info
  const [versionInfo, setVersionInfo] = useState(null);
  
  // Check if running on localhost
  const isLocalhost = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname === '' ||
           window.location.hostname.startsWith('192.168.') ||
           window.location.hostname.startsWith('10.') ||
           window.location.hostname.startsWith('172.');
  };

  // Alternative: Check if in development mode
  const isDevelopment = () => {
    return process.env.NODE_ENV === 'development' || isLocalhost();
  };

  // Handle sign out
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
  
  // Define navigation items based on user role
  const getNavigationItems = () => {
    const baseItems = [
      { name: t('navigation.dashboard'), href: '/dashboard', icon: Home, roles: ['superadmin', 'admin', 'user'] }
    ];

    // Role-specific navigation items
    const roleSpecificItems = [
      // Superadmin can see everything EXCEPT contracts
      { name: t('navigation.partners'), href: '/partners', icon: Building, roles: ['superadmin'] },
      { name: t('navigation.invitations'), href: '/invitations', icon: Mail, roles: ['superadmin'] },
      { name: t('navigation.planFeatures'), href: '/plan-features', icon: Layers, roles: ['superadmin'] },
      { name: t('navigation.pricingPlans'), href: '/pricing-plans', icon: CreditCard, roles: ['superadmin'] },
      { name: t('navigation.partnerContracts'), href: '/partner-contracts', icon: File, roles: ['superadmin'] },
      { name: t('navigation.discountCodes'), href: '/discount-codes', icon: Tag, roles: ['superadmin'] },
      { name: t('navigation.superadminemail'), href: '/superadminemail', icon: Mail, roles: ['superadmin'] },
      { name: t('navigation.partner-billing'), href: '/partner-billing', icon: Calendar, roles: ['superadmin'] },
      { name: t('navigation.partners-billing'), href: '/partners-billing', icon: DollarSign, roles: ['superadmin'] },
      { name: t('navigation.billing-statistics'), href: '/billing-statistics', icon: TrendingUp, roles: ['superadmin'] },
      
      // Partner admin navigation - NEW ORDER
      { name: t('navigation.invitations'), href: '/invitations', icon: Mail, roles: ['admin'] },
      { name: t('navigation.customers'), href: '/customers', icon: Users, roles: ['admin'] },
      { name: t('navigation.contracts'), href: '/contracts', icon: FileText, roles: ['admin'] },
      { name: t('navigation.myBookings'), href: '/bookings', icon: Calendar, roles: ['admin'] },
      { name: t('navigation.services'), href: '/services', icon: Cog, roles: ['admin'] },
      { name: t('navigation.customersDiscountCodes'), href: '/customers-discount-codes', icon: Tag, roles: ['admin'] },
      { name: t('navigation.logview'), href: '/logview', icon: Activity, roles: ['admin'] },
      { name: t('navigation.notifications'), href: '/notifications', icon: BellRing, roles: ['user', 'admin', 'superadmin'] },
      { name: t('navigation.settings'), href: '/settings', icon: Settings, roles: ['admin'] },
      { name: t('navigation.billing-history'), href: '/billing-history', icon: DollarSign, roles: ['admin'] },
      { name: t('navigation.support'), href: '/support', icon: HelpCircle, roles: ['admin'] },


      
      
      // Regular users see limited options and settings
      { name: t('navigation.photoGallery'), href: '/photo-gallery', icon: Camera, roles: ['user'] },
      { name: t('navigation.contracts'), href: '/contracts', icon: FileText, roles: ['user'] },
      { name: t('navigation.myBookings'), href: '/bookings', icon: Calendar, roles: ['user'] },
      { name: t('navigation.settings'), href: '/settings', icon: Settings, roles: ['user'] },
    ];

    // Filter items based on user role
    const userRole = profile?.role || 'user';
    const filteredItems = [...baseItems, ...roleSpecificItems].filter(item => 
      item.roles.includes(userRole)
    );

    return filteredItems;
  };

  // Then in the RoleBasedSidebar component, add this hook after the existing hooks:
  const { isOnboardingComplete } = useTour();

  // Fetch partner branding data
  useEffect(() => {
    if (profile) {
      fetchPartnerBranding();
    }
  }, [profile]);

  // Fetch version info - only if not on localhost
  useEffect(() => {
    if (!isLocalhost()) {
      fetchVersionInfo();
    } else {
      console.log('🏠 Running on localhost - skipping version fetch');
    }
  }, []);

  const fetchVersionInfo = async () => {
    try {
      console.log('Fetching version info from /version.json...');
      
      // Fetch version info from the JSON file created during build
      const response = await fetch('/version.json?t=' + Date.now()); // Cache busting
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Version data loaded:', data);
        
        setVersionInfo({
          commit: data.commit,
          message: data.message,
          buildDate: data.buildDate
        });
      } else {
        console.log('❌ Failed to load version.json, status:', response.status);
        
        // Fallback for debugging
        setVersionInfo({
          commit: 'no-file',
          message: 'version.json not found'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching version info:', error);
      
      // Show error state for debugging
      setVersionInfo({
        commit: 'error',
        message: error.message
      });
    }
  };

  const fetchPartnerBranding = async () => {
    if (!profile?.partner_uuid) {
      // For superadmin or users without partner_uuid, show default branding
      setPartnerBranding({
        logo: null,
        companyName: profile?.role === 'superadmin' ? 'System Admin' : 'PowerCowo',
        loading: false
      });
      return;
    }

    try {
      console.log('Fetching partner branding for:', profile.partner_uuid);
      
      // Fetch partner data
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('company_name')
        .eq('partner_uuid', profile.partner_uuid)
        .single();

      if (partnerError) {
        console.error('Error fetching partner data:', partnerError);
        // Fallback with debugging
        setPartnerBranding({
          logo: null,
          companyName: 'PowerCowo (Partner Error)',
          loading: false
        });
        return;
      }

      console.log('Partner data fetched:', partnerData);

      // Fetch partner logo
      let logoUrl = null;
      try {
        const { data: files, error: storageError } = await supabase.storage
          .from('partners')
          .list(`${profile.partner_uuid}`, {
            search: 'logo'
          });

        if (!storageError && files) {
          const logoFile = files.find(file => file.name.startsWith('logo.'));
          
          if (logoFile) {
            const { data } = supabase.storage
              .from('partners')
              .getPublicUrl(`${profile.partner_uuid}/${logoFile.name}`);
            
            logoUrl = data.publicUrl;
            console.log('Logo URL found:', logoUrl);
          }
        }
      } catch (logoError) {
        console.log('No logo found or error loading logo:', logoError);
      }

      const companyName = partnerData?.company_name || 'PowerCowo (No Company Name)';
      console.log('Setting company name:', companyName);

      setPartnerBranding({
        logo: logoUrl,
        companyName: companyName,
        loading: false
      });

    } catch (error) {
      console.error('Error fetching partner branding:', error);
      setPartnerBranding({
        logo: null,
        companyName: 'PowerCowo (Error)',
        loading: false
      });
    }
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
          {partnerBranding.loading ? (
            // Loading state
            <div className="logo-loading">
              <div className="logo-skeleton"></div>
              <div className="company-name-skeleton"></div>
            </div>
          ) : partnerBranding.logo ? (
            // Custom partner logo
            <div className="partner-branding">
              <img 
                src={partnerBranding.logo} 
                alt={`${partnerBranding.companyName} logo`}
                className="partner-logo"
                onError={(e) => {
                  // Fallback to default icon if logo fails to load
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <Building 
                size={32} 
                color="#4f46e5" 
                className="partner-logo-fallback"
                style={{ display: 'none' }}
              />
              <span className="sidebar-logo-text">{partnerBranding.companyName}</span>
            </div>
          ) : (
            // Default branding
            <div className="default-branding">
              <Building size={32} color="#4f46e5" />
              <span className="sidebar-logo-text">{partnerBranding.companyName}</span>
            </div>
          )}
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const isOnboardingItem = item.href === '/services';
          const NavItem = (
            <Link
              key={item.name}
              to={item.href}
              className={`sidebar-nav-item ${currentPath === item.href ? 'active' : ''}`}
              onClick={mobile ? onClose : undefined}
            >
              <item.icon size={24} className="sidebar-nav-icon" />
              {item.name}
            </Link>
          );

          // Only show notification badges for partner admin users during onboarding
          if (isOnboardingItem && profile?.role === 'admin' && !isOnboardingComplete) {
            return (
              <TourNotificationBadge key={item.name} href={item.href}>
                {NavItem}
              </TourNotificationBadge>
            );
          }

          return NavItem;
        })}

        {/* Logout button as last item */}
        <button
          onClick={handleSignOut}
          className="sidebar-nav-item sidebar-logout-btn"
          title={t('auth.signOut')}
        >
          <LogOut size={24} className="sidebar-nav-icon" />
          {t('auth.signOut')}
        </button>
      </nav>

      {/* Version Info - Only show in production/non-localhost */}
      {!isLocalhost() && versionInfo && (
        <div className="sidebar-version">
          <div className="version-info">
            {/* <span className="version-commit">{versionInfo.commit}</span> */}
            {versionInfo.message && (
              <span className="version-message" title={versionInfo.message}>
                {versionInfo.message.length > 30 
                  ? `${versionInfo.message.substring(0, 30)}...` 
                  : versionInfo.message
                }
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleBasedSidebar;
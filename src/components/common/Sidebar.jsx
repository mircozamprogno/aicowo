import { Building, Calendar, Camera, Cog, FileText, Home, Mail, Settings, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Link from './Link';

const RoleBasedSidebar = ({ mobile = false, onClose }) => {
  const currentPath = window.location.hash.slice(1) || '/dashboard';
  const { profile } = useAuth();
  const { t } = useTranslation();
  
  // State for partner branding
  const [partnerBranding, setPartnerBranding] = useState({
    logo: null,
    companyName: null,
    loading: true
  });
  
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
      
      // Partner admin can see their partner info, services, customers, contracts, bookings, and invitations
      { name: t('navigation.partnerInfo'), href: '/partners', icon: Building, roles: ['admin'] },
      { name: t('navigation.services'), href: '/services', icon: Cog, roles: ['admin'] },
      { name: t('navigation.customers'), href: '/customers', icon: Users, roles: ['admin'] },
      { name: t('navigation.contracts'), href: '/contracts', icon: FileText, roles: ['admin'] },
      { name: t('navigation.myBookings'), href: '/bookings', icon: Calendar, roles: ['admin'] },
      { name: t('navigation.invitations'), href: '/invitations', icon: Mail, roles: ['admin'] },
      { name: t('navigation.settings'), href: '/settings', icon: Settings, roles: ['admin'] },
      
      // Regular users see limited options and settings - including Photo Gallery
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

  // Fetch partner branding data
  useEffect(() => {
    if (profile) {
      fetchPartnerBranding();
    }
  }, [profile]);

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
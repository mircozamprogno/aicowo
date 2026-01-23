import { useEffect, useState } from 'react';
import ContractRenewalLogs from '../../components/ContractRenewalLogs';
import { useAuth } from '../../contexts/AuthContext';
import ArchivedContracts from '../../pages/ArchivedContracts';
import BillingStatisticsDashboard from '../../pages/BillingStatisticsDashboard';
import Bookings from '../../pages/Bookings';
import BookingsNew from '../../pages/BookingsNew';
import Contracts from '../../pages/Contracts';
import Customers from '../../pages/Customers';
import Dashboard from '../../pages/Dashboard';
import Invitations from '../../pages/Invitations';
import LocationFormPage from '../../pages/LocationFormPage';
import LogView from '../../pages/LogView';
import Notifications from '../../pages/Notifications';
import PartnerBillingManagement from '../../pages/PartnerBillingManagement';
import PartnerContracts from '../../pages/PartnerContracts';
import Partners from '../../pages/Partners';
import PhotoGallery from '../../pages/PhotoGallery';
import PlanFeatures from '../../pages/PlanFeatures';
import PricingPlans from '../../pages/PricingPlans';
import PrivacyPolicy from '../../pages/PrivacyPolicy';
import Services from '../../pages/Services';
import Settings from '../../pages/Settings';
import SuperAdminEmailTemplates from '../../pages/SuperAdminEmailTemplates';
import TermsOfService from '../../pages/TermsOfService';

import AllPartnersBilling from '../../pages/AllPartnersBilling';
import PartnerBillingHistory from '../../pages/PartnerBillingHistory';


import Support from '../../pages/Support'; // ← ADD THIS IMPORT
import Users from '../../pages/Users';
import logger from '../../utils/logger';
import ForgotPassword from '../auth/ForgotPassword';
import InvitationRegister from '../auth/InvitationRegister';
import Login from '../auth/Login';
import Register from '../auth/Register';
import ResetPassword from '../auth/ResetPassword';
import ProtectedRoute from './ProtectedRoute';
// Add these imports
import ContractFormPage from '../../pages/ContractFormPage';
import CustomersDiscountCodes from '../../pages/CustomersDiscountCodes';
import PartnerDiscountCodes from '../../pages/PartnerDiscountCodes';
import ServiceFormPage from '../../pages/ServiceFormPage';

const Router = () => {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.hash.slice(1) || '/login';
  });

  const { user, loading, isPasswordRecovery } = useAuth();

  useEffect(() => {
    const handleHashChange = () => {
      const newPath = window.location.hash.slice(1) || '/login';
      logger.log('Router: Hash changed to:', newPath);
      setCurrentPath(newPath);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check if this is a password recovery flow
  const isRecoveryFlow = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');

    // Check for various recovery indicators
    const isRecoveryType = urlParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    const hasAccessToken = urlParams.get('access_token') || hashParams.get('access_token');
    const hasError = urlParams.get('error') || hashParams.get('error');
    const errorCode = urlParams.get('error_code') || hashParams.get('error_code');

    logger.log('=== RECOVERY FLOW DEBUG ===');
    logger.log('Full URL:', window.location.href);
    logger.log('Hash:', window.location.hash);
    logger.log('Search:', window.location.search);
    logger.log('Recovery type found:', isRecoveryType);
    logger.log('Access token found:', !!hasAccessToken);
    logger.log('Error found:', hasError);
    logger.log('Error code:', errorCode);
    logger.log('isPasswordRecovery from context:', isPasswordRecovery);
    logger.log('==========================');

    // Return true if any recovery indicator is present
    return isRecoveryType || hasAccessToken || isPasswordRecovery || (hasError && errorCode === 'otp_expired');
  };

  // Simple redirect logic - no complex state management
  useEffect(() => {
    if (loading) return; // Wait for auth check to complete

    logger.log('Router: Checking redirects - User:', !!user, 'Path:', currentPath, 'IsRecovery:', isRecoveryFlow());

    // If this is a recovery flow, always go to reset password page regardless of auth state
    if (isRecoveryFlow()) {
      if (!currentPath.startsWith('/reset-password') && !currentPath.startsWith('/ResetPassword')) {
        logger.log('Router: Recovery flow detected, redirecting to reset password');
        // PRESERVE URL parameters when redirecting
        const currentParams = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
        const redirectUrl = currentParams ? `/ResetPassword?${currentParams}` : '/ResetPassword';
        logger.log('Router: Redirecting to:', redirectUrl);
        window.location.hash = redirectUrl;
        return;
      }
      return; // Stay on reset password page
    }

    // Special handling for invitation registration and password reset - don't redirect if user is on these pages
    if (currentPath.startsWith('/invitation-register') ||
      currentPath.startsWith('/reset-password') ||
      currentPath.startsWith('/ResetPassword') ||
      currentPath.startsWith('/ResetPassword') ||
      currentPath.startsWith('/terms-of-service') ||
      currentPath.startsWith('/privacy-policy')) {
      return; // Let the components handle their own logic
    }

    // If user is logged in but on auth pages, redirect to dashboard
    if (user && !isPasswordRecovery && ['/login', '/register', '/forgot-password'].includes(currentPath)) {
      logger.log('Router: User logged in, redirecting to dashboard');
      window.location.hash = '/dashboard';
      return;
    }

    // If user is not logged in and not on auth pages, redirect to login
    if (!user && !['/login', '/register', '/forgot-password', '/reset-password', '/ResetPassword'].includes(currentPath)) {
      logger.log('Router: User not logged in, redirecting to login');
      window.location.hash = '/login';
      return;
    }
  }, [user, loading, currentPath, isPasswordRecovery]);

  if (loading) {
    logger.log('Router: Showing loading spinner');
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  logger.log('Router: Rendering page - User:', !!user, 'Path:', currentPath);

  // Handle invitation registration route (can include query parameters)
  if (currentPath.startsWith('/invitation-register')) {
    return <InvitationRegister />;
  }

  // Handle Contract Edit Route
  if (currentPath.startsWith('/contracts/edit/')) {
    return user ? (
      <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
        <ContractFormPage />
      </ProtectedRoute>
    ) : <Login />;
  }

  // Handle reset password route (can include query parameters)
  if (currentPath.startsWith('/reset-password') || currentPath.startsWith('/ResetPassword')) {
    return <ResetPassword />;
  }

  // Handle Service Edit Route (with query params)
  if (currentPath.startsWith('/services/edit')) {
    return user ? (
      <ProtectedRoute requiredRoles={['admin']}>
        <ServiceFormPage />
      </ProtectedRoute>
    ) : <Login />;
  }

  // Handle Location Form Routes (new and edit with query params)
  if (currentPath.startsWith('/locations/new') || currentPath.startsWith('/locations/edit')) {
    return user ? (
      <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
        <LocationFormPage />
      </ProtectedRoute>
    ) : <Login />;
  }

  // Render the appropriate component based on current path
  switch (currentPath) {
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    case '/forgot-password':
      return <ForgotPassword />;
    case '/terms-of-service':
      return <TermsOfService />;
    case '/privacy-policy':
      return <PrivacyPolicy />;
    case '/dashboard':
      return user ? <ProtectedRoute><Dashboard /></ProtectedRoute> : <Login />;
    case '/partners':
      return user ? <ProtectedRoute><Partners /></ProtectedRoute> : <Login />;
    case '/services':
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <Services />
        </ProtectedRoute>
      ) : <Login />;
    case '/services/new':
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <ServiceFormPage />
        </ProtectedRoute>
      ) : <Login />;
    case '/services/edit':
      // Note: React Router doesn't handle param parsing in the hash router implementation used here exactly like standard router
      // But based on existing pattern (contracts/edit/), we need to handle dynamic segments or query params.
      // The custom router seems to rely on exact string matching or startsWith.
      // Let's check how /contracts/edit/ works.
      // It handles startsWith('/contracts/edit/')
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <ServiceFormPage />
        </ProtectedRoute>
      ) : <Login />;
    case '/customers':
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <Customers />
        </ProtectedRoute>
      ) : <Login />;
    case '/photo-gallery':
      return user ? (
        <ProtectedRoute requiredRoles={['user']}>
          <PhotoGallery />
        </ProtectedRoute>
      ) : <Login />;
    case '/contracts/new':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <ContractFormPage />
        </ProtectedRoute>
      ) : <Login />;
    case '/contracts':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <Contracts />
        </ProtectedRoute>
      ) : <Login />;
    case '/bookings':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <Bookings />
        </ProtectedRoute>
      ) : <Login />;
    case '/bookings-new':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <BookingsNew />
        </ProtectedRoute>
      ) : <Login />;
    case '/invitations':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin', 'admin']}>
          <Invitations />
        </ProtectedRoute>
      ) : <Login />;
    case '/users':
      return user ? <ProtectedRoute><Users /></ProtectedRoute> : <Login />;
    case '/settings':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin']}>
          <Settings />
        </ProtectedRoute>
      ) : <Login />;
    case '/support':
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <Support />
        </ProtectedRoute>
      ) : <Login />;
    case '/archived-contracts':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <ArchivedContracts />
        </ProtectedRoute>
      ) : <Login />;
    case '/plan-features':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <PlanFeatures />
        </ProtectedRoute>
      ) : <Login />;
    case '/pricing-plans':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <PricingPlans />
        </ProtectedRoute>
      ) : <Login />;
    case '/partner-contracts':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <PartnerContracts />
        </ProtectedRoute>
      ) : <Login />;
    case '/discount-codes':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <PartnerDiscountCodes />
        </ProtectedRoute>
      ) : <Login />;
    case '/customers-discount-codes':
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <CustomersDiscountCodes />
        </ProtectedRoute>
      ) : <Login />;
    case '/renewal-logs':
      return user ? (
        <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
          <ContractRenewalLogs />
        </ProtectedRoute>
      ) : <Login />;



    case '/logview':
      return user ? (
        <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
          <LogView />
        </ProtectedRoute>
      ) : <Login />;

    case '/superadminemail':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <SuperAdminEmailTemplates />
        </ProtectedRoute>
      ) : <Login />;

    case '/partner-billing':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <PartnerBillingManagement />
        </ProtectedRoute>
      ) : <Login />;

    case '/notifications':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <Notifications />
        </ProtectedRoute>
      ) : <Login />;

    case '/billing-history':
      return user ? (
        <ProtectedRoute requiredRoles={['admin']}>
          <PartnerBillingHistory />
        </ProtectedRoute>
      ) : <Login />;

    case '/partners-billing':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <AllPartnersBilling />
        </ProtectedRoute>
      ) : <Login />;

    case '/billing-statistics':
      return user ? (
        <ProtectedRoute requiredRoles={['superadmin']}>
          <BillingStatisticsDashboard />
        </ProtectedRoute>
      ) : <Login />;






    default:
      // For any unknown path, redirect based on auth status
      if (user) {
        window.location.hash = '/dashboard';
        return <ProtectedRoute><Dashboard /></ProtectedRoute>;
      } else {
        window.location.hash = '/login';
        return <Login />;
      }
  }
};

export default Router;
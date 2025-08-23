import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ArchivedContracts from '../../pages/ArchivedContracts';
import Bookings from '../../pages/Bookings';
import Contracts from '../../pages/Contracts';
import Customers from '../../pages/Customers';
import Dashboard from '../../pages/Dashboard';
import Invitations from '../../pages/Invitations';
import Partners from '../../pages/Partners';
import PhotoGallery from '../../pages/PhotoGallery';
import Services from '../../pages/Services';
import Settings from '../../pages/Settings';
import Users from '../../pages/Users';
import ForgotPassword from '../auth/ForgotPassword';
import InvitationRegister from '../auth/InvitationRegister';
import Login from '../auth/Login';
import Register from '../auth/Register';
import ResetPassword from '../auth/ResetPassword'; // ← ADD THIS IMPORT
import ProtectedRoute from './ProtectedRoute';

const Router = () => {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.hash.slice(1) || '/login';
  });
  
  const { user, loading, isPasswordRecovery } = useAuth(); // ← ADD isPasswordRecovery HERE

  useEffect(() => {
    const handleHashChange = () => {
      const newPath = window.location.hash.slice(1) || '/login';
      console.log('Router: Hash changed to:', newPath);
      setCurrentPath(newPath);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check if this is a password recovery flow
  const isRecoveryFlow = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const isRecoveryType = urlParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    const hasAccessToken = urlParams.get('access_token') || hashParams.get('access_token');
    
    // Only consider it a recovery flow if we have the recovery type parameter
    return isRecoveryType;
  };

  // Simple redirect logic - no complex state management
  useEffect(() => {
    if (loading) return; // Wait for auth check to complete

    console.log('Router: Checking redirects - User:', !!user, 'Path:', currentPath, 'IsRecovery:', isRecoveryFlow());

    // If this is a recovery flow, always go to reset password page regardless of auth state
    if (isRecoveryFlow()) {
      if (!currentPath.startsWith('/reset-password') && !currentPath.startsWith('/ResetPassword')) {
        console.log('Router: Recovery flow detected, redirecting to reset password');
        window.location.hash = '/ResetPassword';
        return;
      }
      return; // Stay on reset password page
    }

    // Special handling for invitation registration and password reset - don't redirect if user is on these pages
    if (currentPath.startsWith('/invitation-register') || 
        currentPath.startsWith('/reset-password') || 
        currentPath.startsWith('/ResetPassword')) {
      return; // Let the components handle their own logic
    }

    // If user is logged in but on auth pages, redirect to dashboard
    if (user && !isPasswordRecovery && ['/login', '/register', '/forgot-password'].includes(currentPath)) { // ← ADD RECOVERY CHECK
      console.log('Router: User logged in, redirecting to dashboard');
      window.location.hash = '/dashboard';
      return;
    }

    // If user is not logged in and not on auth pages, redirect to login
    if (!user && !['/login', '/register', '/forgot-password', '/reset-password', '/ResetPassword'].includes(currentPath)) {
      console.log('Router: User not logged in, redirecting to login');
      window.location.hash = '/login';
      return;
    }
  }, [user, loading, currentPath, isPasswordRecovery]); // ← ADD isPasswordRecovery TO DEPENDENCIES

  if (loading) {
    console.log('Router: Showing loading spinner');
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  console.log('Router: Rendering page - User:', !!user, 'Path:', currentPath);

  // Handle invitation registration route (can include query parameters)
  if (currentPath.startsWith('/invitation-register')) {
    return <InvitationRegister />;
  }

  // Handle reset password route (can include query parameters)
  if (currentPath.startsWith('/reset-password') || currentPath.startsWith('/ResetPassword')) { // ← ADD THIS
    return <ResetPassword />;
  }

  // Render the appropriate component based on current path
  switch (currentPath) {
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    case '/forgot-password':
      return <ForgotPassword />;
    // You can also add explicit cases if needed:
    // case '/reset-password':
    //   return <ResetPassword />;
    // case '/ResetPassword':
    //   return <ResetPassword />;
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
    case '/archived-contracts':
      return user ? (
        <ProtectedRoute requiredRoles={['user', 'admin', 'superadmin']}>
          <ArchivedContracts />
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
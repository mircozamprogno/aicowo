import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Customers from '../../pages/Customers';
import Dashboard from '../../pages/Dashboard';
import Invitations from '../../pages/Invitations';
import Partners from '../../pages/Partners';
import Services from '../../pages/Services';
import Settings from '../../pages/Settings';
import Users from '../../pages/Users';
import ForgotPassword from '../auth/ForgotPassword';
import InvitationRegister from '../auth/InvitationRegister';
import Login from '../auth/Login';
import Register from '../auth/Register';
import ProtectedRoute from './ProtectedRoute';

const Router = () => {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.hash.slice(1) || '/login';
  });
  
  const { user, loading } = useAuth();

  useEffect(() => {
    const handleHashChange = () => {
      const newPath = window.location.hash.slice(1) || '/login';
      console.log('Router: Hash changed to:', newPath);
      setCurrentPath(newPath);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Simple redirect logic - no complex state management
  useEffect(() => {
    if (loading) return; // Wait for auth check to complete

    console.log('Router: Checking redirects - User:', !!user, 'Path:', currentPath);

    // Special handling for invitation registration - don't redirect if user is on this page
    if (currentPath.startsWith('/invitation-register')) {
      return; // Let the InvitationRegister component handle the logic
    }

    // If user is logged in but on auth pages, redirect to dashboard
    if (user && ['/login', '/register', '/forgot-password'].includes(currentPath)) {
      console.log('Router: User logged in, redirecting to dashboard');
      window.location.hash = '/dashboard';
      return;
    }

    // If user is not logged in and not on auth pages, redirect to login
    if (!user && !['/login', '/register', '/forgot-password'].includes(currentPath)) {
      console.log('Router: User not logged in, redirecting to login');
      window.location.hash = '/login';
      return;
    }
  }, [user, loading, currentPath]);

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

  // Render the appropriate component based on current path
  switch (currentPath) {
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    case '/forgot-password':
      return <ForgotPassword />;
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
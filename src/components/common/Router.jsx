import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Dashboard from '../../pages/Dashboard';
import Partners from '../../pages/Partners';
import Users from '../../pages/Users';
import ForgotPassword from '../auth/ForgotPassword';
import Login from '../auth/Login';
import Register from '../auth/Register';
import Navigate from './Navigate';
import ProtectedRoute from './ProtectedRoute';

const Router = () => {
  const [currentPath, setCurrentPath] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash || '/dashboard';
  });
  const { user, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const newPath = window.location.hash.slice(1) || '/dashboard';
      console.log('Hash changed to:', newPath);
      setCurrentPath(newPath);
      setRedirecting(false); // Reset redirecting state when hash changes
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle redirects based on auth state
  useEffect(() => {
    if (loading || redirecting) return; // Don't redirect while loading or already redirecting

    const publicRoutes = ['/login', '/register', '/forgot-password'];
    
    if (!user && !publicRoutes.includes(currentPath)) {
      console.log('User not authenticated, redirecting to login');
      setRedirecting(true);
      window.location.hash = '/login';
    } else if (user && publicRoutes.includes(currentPath)) {
      console.log('User authenticated but on public route, redirecting to dashboard');
      setRedirecting(true);
      window.location.hash = '/dashboard';
    }
  }, [user, loading, currentPath, redirecting]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  console.log('Rendering route:', currentPath, 'User:', !!user, 'Loading:', loading, 'Redirecting:', redirecting);

  // Show loading during redirect to prevent flashing
  if (redirecting) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Public routes
  if (currentPath === '/login') return <Login />;
  if (currentPath === '/register') return <Register />;
  if (currentPath === '/forgot-password') return <ForgotPassword />;

  // Protected routes
  if (!user) {
    return <Navigate to="/login" />;
  }

  switch (currentPath) {
    case '/dashboard':
      return <ProtectedRoute><Dashboard /></ProtectedRoute>;
    case '/partners':
      return <ProtectedRoute><Partners /></ProtectedRoute>;
    case '/users':
      return <ProtectedRoute><Users /></ProtectedRoute>;
    default:
      return <Navigate to="/dashboard" />;
  }
};

export default Router;
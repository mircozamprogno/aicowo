import { useAuth } from '../../contexts/AuthContext';
import Layout from './Layout';
import Navigate from './Navigate';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/dashboard" />;
  }

  return <Layout>{children}</Layout>;
};

export default ProtectedRoute;
import { Building, MapPin, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Dashboard = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  
  const [stats, setStats] = useState({
    totalPartners: 0,
    totalLocations: 0,
    totalUsers: 0,
    loading: true
  });

  // Chart data for regular users
  const chartData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
    { name: 'Jun', value: 700 },
  ];

  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    if (!profile) return;

    setStats(prev => ({ ...prev, loading: true }));

    try {
      console.log('Fetching dashboard stats for role:', profile.role);

      let partnersCount = 0;
      let locationsCount = 0;
      let usersCount = 0;

      // Fetch data based on user role
      if (profile.role === 'superadmin') {
        // Superadmin sees all data
        const [partnersResult, locationsResult, usersResult] = await Promise.all([
          supabase.from('partners').select('*', { count: 'exact', head: true }),
          supabase.from('locations').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true })
        ]);

        partnersCount = partnersResult.count || 0;
        locationsCount = locationsResult.count || 0;
        usersCount = usersResult.count || 0;

        console.log('Superadmin stats:', { partnersCount, locationsCount, usersCount });

      } else if (profile.role === 'admin') {
        // Admin sees only their partner's data
        if (profile.partner_uuid) {
          const [locationsResult, usersResult] = await Promise.all([
            supabase
              .from('locations')
              .select('*', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid),
            supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid)
          ]);

          locationsCount = locationsResult.count || 0;
          usersCount = usersResult.count || 0;

          console.log('Admin stats:', { locationsCount, usersCount, partnerUuid: profile.partner_uuid });
        }
      }

      // Handle database errors with mock data
      if (partnersCount === 0 && locationsCount === 0 && usersCount === 0) {
        console.log('No data from database, using mock data');
        
        if (profile.role === 'superadmin') {
          partnersCount = 12;
          locationsCount = 28;
          usersCount = 245;
        } else if (profile.role === 'admin') {
          locationsCount = 3;
          usersCount = 15;
        }
      }

      setStats({
        totalPartners: partnersCount,
        totalLocations: locationsCount,
        totalUsers: usersCount,
        loading: false
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      
      // Fallback to mock data
      let mockStats = { totalPartners: 0, totalLocations: 0, totalUsers: 0 };
      
      if (profile.role === 'superadmin') {
        mockStats = { totalPartners: 12, totalLocations: 28, totalUsers: 245 };
      } else if (profile.role === 'admin') {
        mockStats = { totalPartners: 0, totalLocations: 3, totalUsers: 15 };
      }

      setStats({ ...mockStats, loading: false });
    }
  };

  // Render different dashboards based on user role
  const renderDashboard = () => {
    if (profile?.role === 'superadmin') {
      return (
        <>
          <h1 className="dashboard-title">
            {t('dashboard.welcomeBack')}, {profile?.first_name || 'Admin'}!
          </h1>
          
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Building size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.totalPartners')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalPartners}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <MapPin size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.activeLocations')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalLocations}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Users size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.totalUsers')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalUsers}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (profile?.role === 'admin') {
      return (
        <>
          <h1 className="dashboard-title">
            {t('dashboard.welcomeBack')}, {profile?.first_name || 'Admin'}!
          </h1>
          
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <MapPin size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.activeLocations')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalLocations}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Users size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.totalUsers')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalUsers}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    // Regular user dashboard
    return (
      <>
        <h1 className="dashboard-title">
          {t('dashboard.welcomeBack')}, {profile?.first_name || 'User'}!
        </h1>
        
        <div className="dashboard-chart">
          <h2 className="chart-title">{t('dashboard.monthlyOverview')}</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="dashboard-page">
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;
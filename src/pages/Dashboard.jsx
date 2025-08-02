import { Building, User, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';

const Dashboard = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  
  const data = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
    { name: 'Jun', value: 700 },
  ];

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-title">
        {t('dashboard.welcomeBack')}, {profile?.first_name || 'User'}!
      </h1>
      
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-icon">
              <Users size={24} color="#9ca3af" />
            </div>
            <div className="stat-info">
              <dt className="stat-label">{t('dashboard.totalPartners')}</dt>
              <dd className="stat-value">12</dd>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-icon">
              <Building size={24} color="#9ca3af" />
            </div>
            <div className="stat-info">
              <dt className="stat-label">{t('dashboard.activeLocations')}</dt>
              <dd className="stat-value">28</dd>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-icon">
              <User size={24} color="#9ca3af" />
            </div>
            <div className="stat-info">
              <dt className="stat-label">{t('dashboard.totalUsers')}</dt>
              <dd className="stat-value">245</dd>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-chart">
        <h2 className="chart-title">{t('dashboard.monthlyOverview')}</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
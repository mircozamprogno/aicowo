// src/pages/Notifications.jsx
import { Bell, FileText, Megaphone, Plus, Send } from 'lucide-react';
import { useState } from 'react';
import CreateNotification from '../components/notifications/CreateNotification';
import NotificationsList from '../components/notifications/NotificationsList';
import NotificationTemplates from '../components/notifications/NotificationTemplates';
import PartnerNotifications from '../components/notifications/PartnerNotifications';
import SentNotifications from '../components/notifications/SentNotifications';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import '../styles/pages/Notifications.css';

const Notifications = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();


  const isSuperadmin = profile?.role === 'superadmin';
  const isPartner = profile?.role === 'admin'; // Partner role is 'admin', not 'partner'
  const isCustomer = profile?.role === 'user';
  const [activeTab, setActiveTab] = useState(isSuperadmin ? 'sent' : 'my-notifications');

  const tabs = [
    {
      id: 'my-notifications',
      icon: Bell,
      label: t('notifications.myNotifications'),
      show: !isSuperadmin  // Hide for superadmin
    },
    {
      id: 'create',
      icon: Plus,
      label: t('notifications.createNotification'),
      show: isSuperadmin || isPartner
    },
    {
      id: 'sent',
      icon: Send,
      label: t('notifications.sentNotifications'),
      show: isSuperadmin || isPartner
    },
    {
      id: 'templates',
      icon: FileText,
      label: t('notifications.templates'),
      show: isSuperadmin || isPartner
    },
    {
      id: 'partner-notifications',
      icon: Megaphone,
      label: t('notifications.partnerNotifications'),
      show: isSuperadmin
    }
  ];

  const visibleTabs = tabs.filter(tab => tab.show);

    // Notifications.jsx - add this function
    const handleCreateCancel = () => {
    setActiveTab(isSuperadmin ? 'sent' : 'my-notifications');
    };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div className="notifications-header-content">
          <Bell className="notifications-header-icon" size={32} />
          <div>
            <h1 className="notifications-title">{t('notifications.title')}</h1>
            <p className="notifications-subtitle">{t('notifications.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="notifications-tabs">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`notifications-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="notifications-content">
        {activeTab === 'my-notifications' && <NotificationsList />}
        {activeTab === 'create' && <CreateNotification onCancel={handleCreateCancel} />}
        {activeTab === 'sent' && <SentNotifications />}
        {activeTab === 'templates' && <NotificationTemplates />}
        {activeTab === 'partner-notifications' && isSuperadmin && <PartnerNotifications />}
      </div>
    </div>
  );
};

export default Notifications;
// src/components/notifications/PartnerNotifications.jsx
import { Calendar, Eye, Megaphone, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';
import NotificationModal from './NotificationModal';

import logger from '../../utils/logger';

const PartnerNotifications = () => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [partners, setPartners] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);

  useEffect(() => {
    loadPartners();
    loadNotifications();
  }, []);

  const loadPartners = async () => {
    try {
        const { data, error } = await supabase
        .from('partners')
        .select('partner_uuid, company_name, partner_status')
        .eq('partner_status', 'active')
        .order('company_name');

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      logger.error('Error loading partners:', error);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          partners!notifications_partner_uuid_fkey (
            company_name
          ),
          notification_recipients (
            id
          )
        `)
        .eq('creator_role', 'partner')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedNotifications = (data || []).map(n => ({
        ...n,
        partnerName: n.partners?.company_name || 'Unknown Partner',
        recipientsCount: n.notification_recipients?.length || 0,
        isExpired: new Date(n.valid_until) < new Date(),
        isActive: new Date(n.valid_from) <= new Date() && new Date(n.valid_until) >= new Date()
      }));

      setNotifications(enrichedNotifications);
    } catch (error) {
      logger.error('Error loading partner notifications:', error);
      toast.error(t('notifications.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (notification) => {
    if (notification.status === 'draft') {
      return <span className="status-badge draft">{t('notifications.draft')}</span>;
    }
    if (notification.isExpired) {
      return <span className="status-badge expired">{t('notifications.expired')}</span>;
    }
    if (notification.isActive) {
      return <span className="status-badge active">{t('notifications.active')}</span>;
    }
    return <span className="status-badge scheduled">{t('notifications.scheduled')}</span>;
  };

  const filteredNotifications = notifications.filter(n => {
    if (partnerFilter !== 'all' && n.partner_uuid !== partnerFilter) return false;
    if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase()) && !n.partnerName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="partner-notifications-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}...</p>
      </div>
    );
  }

  return (
    <div className="partner-notifications-container">
      <div className="partner-notifications-header">
        <h2>{t('notifications.partnerNotifications')}</h2>
        <p>{t('notifications.partnerNotificationsDescription')}</p>
      </div>

      <div className="partner-notifications-filters">
        <div className="partner-notifications-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('notifications.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="partner-search-input"
          />
        </div>

        <Select
          value={partnerFilter}
          onChange={(e) => setPartnerFilter(e.target.value)}
          options={[
            { value: 'all', label: t('notifications.allPartners') },
            ...partners.map(p => ({
              value: p.partner_uuid,
              label: p.company_name
            }))
          ]}
          className="partner-filter-select"
        />
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="partner-notifications-empty">
          <Megaphone size={48} />
          <p>{t('notifications.noPartnerNotifications')}</p>
        </div>
      ) : (
        <div className="partner-notifications-table">
          <table>
            <thead>
              <tr>
                <th>{t('notifications.partner')}</th>
                <th>{t('notifications.title')}</th>
                <th>{t('notifications.status')}</th>
                <th>{t('notifications.type')}</th>
                <th>{t('notifications.dates')}</th>
                <th>{t('notifications.recipients')}</th>
                <th>{t('notifications.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.map(notification => (
                <tr key={notification.id}>
                  <td className="partner-name-cell">{notification.partnerName}</td>
                  <td className="notification-title-cell">{notification.title}</td>
                  <td>{getStatusBadge(notification)}</td>
                  <td>
                    <span className="notification-type-badge">
                      {t(`notifications.types.${notification.notification_type}`)}
                    </span>
                  </td>
                  <td className="notification-dates-cell">
                    <div className="date-range">
                      <Calendar size={14} />
                      {new Date(notification.valid_from).toLocaleDateString()}
                      {' - '}
                      {new Date(notification.valid_until).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="notification-recipients-cell">
                    {notification.recipientsCount}
                  </td>
                  <td className="notification-actions-cell">
                    <button
                      onClick={() => setSelectedNotification(notification)}
                      className="action-btn"
                      title={t('notifications.preview')}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedNotification && (
        <NotificationModal
          notifications={[selectedNotification]}
          currentIndex={0}
          mode="preview"
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </div>
  );
};

export default PartnerNotifications;
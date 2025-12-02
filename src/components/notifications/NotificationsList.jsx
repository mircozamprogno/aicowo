// src/components/notifications/NotificationsList.jsx
import { AlertCircle, Calendar, Megaphone, Package, Rocket, Search, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';
import NotificationModal from './NotificationModal';

import logger from '../../utils/logger';

const NotificationsList = () => {
  const { t } = useTranslation();
  const { profile } = useAuth(); // Use profile, not user
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotification, setSelectedNotification] = useState(null);


  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadNotifications();
  }, [profile]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, typeFilter, searchTerm]);

  const loadNotifications = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // For role='user' (customer), use profile.id as customer_uuid
      // For partner/superadmin, use profile.partner_uuid
      const userUuid = profile.role === 'user' ? profile.id : profile.partner_uuid;
      const recipientType = profile.role === 'user' ? 'customer' : 'partner';

      // Safety check
      if (!userUuid) {
        logger.error('NotificationsList - userUuid is undefined!');
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Get notifications targeted to this user
      const { data: recipients, error: recipientsError } = await supabase
        .from('notification_recipients')
        .select('notification_id')
        .eq('recipient_uuid', userUuid)
        .eq('recipient_type', recipientType);

      if (recipientsError) throw recipientsError;

      const notificationIds = recipients.map(r => r.notification_id);

      if (notificationIds.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Get notifications
      const now = new Date().toISOString();
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .in('id', notificationIds)
        .eq('status', 'published')
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_until', now)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // Get views for these notifications
      const { data: views, error: viewsError } = await supabase
        .from('notification_views')
        .select('notification_id, viewed_at')
        .in('notification_id', notificationIds)
        .eq('user_uuid', userUuid);

      if (viewsError) throw viewsError;

      // Merge view status
      const viewsMap = {};
      views.forEach(v => {
        viewsMap[v.notification_id] = v.viewed_at;
      });

      const enrichedNotifications = notificationsData.map(n => ({
        ...n,
        isRead: !!viewsMap[n.id],
        viewedAt: viewsMap[n.id]
      }));

      setNotifications(enrichedNotifications);
    } catch (error) {
      logger.error('Error loading notifications:', error);
      toast.error(t('notifications.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    setSelectedNotification(notification);

    // Mark as viewed if not already
    if (!notification.isRead) {
      try {
        const userUuid = profile.role === 'user' ? profile.id : profile.partner_uuid;
        
        await supabase
          .from('notification_views')
          .upsert({
            notification_id: notification.id,
            user_uuid: userUuid,
            partner_uuid: profile.partner_uuid,
            viewed_at: new Date().toISOString(),
            modal_acknowledged: true
          }, {
            onConflict: 'notification_id,user_uuid'
          });

        // Update local state
        setNotifications(prev => prev.map(n =>
          n.id === notification.id ? { ...n, isRead: true, viewedAt: new Date().toISOString() } : n
        ));
      } catch (error) {
        logger.error('Error marking notification as read:', error);
      }
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      promotion: Package,
      announcement: Megaphone,
      release_note: Rocket,
      alert: AlertCircle,
      new_location: Store
    };
    return icons[type] || Megaphone;
  };

  const getTypeColor = (type) => {
    const colors = {
      promotion: '#16a34a',
      announcement: '#3b82f6',
      release_note: '#8b5cf6',
      alert: '#f97316',
      new_location: '#16a34a'
    };
    return colors[type] || '#6b7280';
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.isRead) return false;
    if (typeFilter !== 'all' && n.notification_type !== typeFilter) return false;
    if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedNotifications = filteredNotifications.slice(startIndex, startIndex + itemsPerPage);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="notifications-list-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}...</p>
      </div>
    );
  }

  return (
    <div className="notifications-list-container">
      <div className="notifications-list-filters">
        <div className="notifications-list-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('notifications.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="notifications-search-input"
          />
        </div>

        <div className="notifications-list-filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('notifications.all')} ({notifications.length})
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            {t('notifications.unread')} ({unreadCount})
          </button>
        </div>

        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: 'all', label: t('notifications.allTypes') },
            { value: 'promotion', label: t('notifications.types.promotion') },
            { value: 'announcement', label: t('notifications.types.announcement') },
            { value: 'release_note', label: t('notifications.types.releaseNote') },
            { value: 'alert', label: t('notifications.types.alert') },
            { value: 'new_location', label: t('notifications.types.newLocation') }
          ]}
        />

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Select
            value={itemsPerPage.toString()}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            options={[
              { value: '10', label: '10 / ' + t('common.page') },
              { value: '20', label: '20 / ' + t('common.page') },
              { value: '50', label: '50 / ' + t('common.page') },
              { value: '100', label: '100 / ' + t('common.page') }
            ]}
          />
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                ←
              </button>
              <span style={{ color: '#6b7280' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="notifications-list-empty">
          <Megaphone size={48} />
          <p>{t('notifications.noNotifications')}</p>
        </div>
      ) : (
        <div className="notifications-list">
          {paginatedNotifications.map(notification => {
            const TypeIcon = getTypeIcon(notification.notification_type);
            const typeColor = getTypeColor(notification.notification_type);

            return (
              <div
                key={notification.id}
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                {!notification.isRead && <div className="notification-unread-dot"></div>}
                
                <div className="notification-item-icon" style={{ backgroundColor: typeColor }}>
                  <TypeIcon size={20} />
                </div>

                <div className="notification-item-content">
                  <h3 className="notification-item-title">{notification.title}</h3>
                  <div className="notification-item-meta">
                    <span className="notification-item-type" style={{ color: typeColor }}>
                      {t(`notifications.types.${notification.notification_type}`)}
                    </span>
                    <span className="notification-item-date">
                      <Calendar size={14} />
                      {new Date(notification.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedNotification && (
        <NotificationModal
          notifications={[selectedNotification]}
          currentIndex={0}
          mode="read"
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </div>
  );
};

export default NotificationsList;
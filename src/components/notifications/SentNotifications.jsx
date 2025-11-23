// src/components/notifications/SentNotifications.jsx
import { Calendar, Edit, Eye, FileText, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import ConfirmModal from '../common/ConfirmModal';
import { toast } from '../common/ToastContainer';
import CreateNotification from './CreateNotification';
import NotificationModal from './NotificationModal';

const SentNotifications = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, draft, published, expired
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [editingNotification, setEditingNotification] = useState(null);
  const [deletingNotification, setDeletingNotification] = useState(null);

  useEffect(() => {
    loadNotifications();
  }, [profile]);

  const loadNotifications = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Notifications are created BY the user (profile.id), not by partner
      const userUuid = profile.id;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          notification_recipients (
            id
          )
        `)
        .eq('created_by_uuid', userUuid)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedNotifications = (data || []).map(n => ({
        ...n,
        recipientsCount: n.notification_recipients?.length || 0,
        isExpired: new Date(n.valid_until) < new Date(),
        isActive: new Date(n.valid_from) <= new Date() && new Date(n.valid_until) >= new Date()
      }));

      setNotifications(enrichedNotifications);
    } catch (error) {
      console.error('Error loading sent notifications:', error);
      toast.error(t('notifications.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingNotification) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_active: false })
        .eq('id', deletingNotification.id);

      if (error) throw error;

      // Activity log
      await supabase.from('activity_logs').insert({
        partner_uuid: profile.partner_uuid,
        user_uuid: profile.partner_uuid,
        action_type: 'notification_deleted',
        entity_type: 'notification',
        entity_id: deletingNotification.id,
        description: `Notification "${deletingNotification.title}" deleted`,
        metadata: { notification_id: deletingNotification.id }
      });

      toast.success(t('notifications.notificationDeleted'));
      loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error(t('notifications.errorDeleting'));
    } finally {
      setDeletingNotification(null);
    }
  };

  const handlePublish = async (notification) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'published' })
        .eq('id', notification.id);

      if (error) throw error;

      // Activity log
      await supabase.from('activity_logs').insert({
        partner_uuid: profile.partner_uuid,
        user_uuid: profile.partner_uuid,
        action_type: 'notification_published',
        entity_type: 'notification',
        entity_id: notification.id,
        description: `Notification "${notification.title}" published`,
        metadata: { notification_id: notification.id }
      });

      toast.success(t('notifications.notificationPublished'));
      loadNotifications();
    } catch (error) {
      console.error('Error publishing notification:', error);
      toast.error(t('notifications.errorPublishing'));
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

  const getTypeIcon = (type) => {
    return <FileText size={16} />;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'draft' && n.status !== 'draft') return false;
    if (filter === 'published' && n.status !== 'published') return false;
    if (filter === 'expired' && !n.isExpired) return false;
    if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (editingNotification) {
    return (
      <CreateNotification
        editNotification={editingNotification}
        onSaved={() => {
          setEditingNotification(null);
          loadNotifications();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="sent-notifications-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}...</p>
      </div>
    );
  }

  return (
    <div className="sent-notifications-container">
      <div className="sent-notifications-filters">
        <div className="sent-notifications-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('notifications.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sent-search-input"
          />
        </div>

        <div className="sent-notifications-filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('notifications.all')} ({notifications.length})
          </button>
          <button
            className={`filter-btn ${filter === 'draft' ? 'active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            {t('notifications.draft')} ({notifications.filter(n => n.status === 'draft').length})
          </button>
          <button
            className={`filter-btn ${filter === 'published' ? 'active' : ''}`}
            onClick={() => setFilter('published')}
          >
            {t('notifications.published')} ({notifications.filter(n => n.status === 'published').length})
          </button>
          <button
            className={`filter-btn ${filter === 'expired' ? 'active' : ''}`}
            onClick={() => setFilter('expired')}
          >
            {t('notifications.expired')} ({notifications.filter(n => n.isExpired).length})
          </button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="sent-notifications-empty">
          <FileText size={48} />
          <p>{t('notifications.noSentNotifications')}</p>
        </div>
      ) : (
        <div className="sent-notifications-table">
          <table>
            <thead>
              <tr>
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
                  <td className="notification-title-cell">{notification.title}</td>
                  <td>{getStatusBadge(notification)}</td>
                  <td>
                    <span className="notification-type-badge">
                      {getTypeIcon(notification.notification_type)}
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
                    {notification.status === 'draft' && (
                      <>
                        <button
                          onClick={() => setEditingNotification(notification)}
                          className="action-btn"
                          title={t('common.edit')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handlePublish(notification)}
                          className="action-btn publish"
                          title={t('notifications.publish')}
                        >
                          {t('notifications.publish')}
                        </button>
                      </>
                    )}
                    {notification.status === 'published' && (
                      <button
                        onClick={() => setEditingNotification(notification)}
                        className="action-btn"
                        title={t('common.edit')}
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeletingNotification(notification)}
                      className="action-btn delete"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
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

      {deletingNotification && (
        <ConfirmModal
          isOpen={true}
          title={t('notifications.confirmDelete')}
          message={t('notifications.confirmDeleteMessage')}
          onConfirm={handleDelete}
          onClose={() => setDeletingNotification(null)}
          confirmText={t('common.delete')}
          isDestructive={true}
        />
      )}
    </div>
  );
};

export default SentNotifications;
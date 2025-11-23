// src/components/notifications/NotificationBell.jsx
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import '../../styles/components/NotificationBell.css';
import NotificationModal from './NotificationModal';

const NotificationBell = () => {
  const { t } = useTranslation();
  const { profile } = useAuth(); // Use profile, not user
  const [unreadCount, setUnreadCount] = useState(0);
  const [unacknowledgedNotifications, setUnacknowledgedNotifications] = useState([]);
  const [currentModalIndex, setCurrentModalIndex] = useState(0);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [hasCheckedOnLogin, setHasCheckedOnLogin] = useState(false);

  useEffect(() => {
    if (profile) {
      loadUnreadCount();
      subscribeToNotifications();
      
      // Check for unacknowledged notifications on first load
      if (!hasCheckedOnLogin) {
        checkUnacknowledgedNotifications();
        setHasCheckedOnLogin(true);
      }
    }
  }, [profile]);

  const loadUnreadCount = async () => {
    if (!profile) return;

    try {
      // For role='user' (customer), use profile.id as customer_uuid
      // For partner/superadmin, use profile.partner_uuid
      const userUuid = profile.role === 'user' ? profile.id : profile.partner_uuid;
      const recipientType = profile.role === 'user' ? 'customer' : 'partner';

      // Safety check
      if (!userUuid) {
        console.error('NotificationBell - loadUnreadCount - userUuid is undefined!');
        setUnreadCount(0);
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
        setUnreadCount(0);
        return;
      }

      // Get published, active, valid notifications
      const now = new Date().toISOString();
      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('id')
        .in('id', notificationIds)
        .eq('status', 'published')
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_until', now);

      if (notificationsError) throw notificationsError;

      const validNotificationIds = notifications.map(n => n.id);

      if (validNotificationIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Get views
      const { data: views, error: viewsError } = await supabase
        .from('notification_views')
        .select('notification_id')
        .in('notification_id', validNotificationIds)
        .eq('user_uuid', userUuid)
        .not('viewed_at', 'is', null);

      if (viewsError) throw viewsError;

      const viewedIds = views.map(v => v.notification_id);
      const unreadIds = validNotificationIds.filter(id => !viewedIds.includes(id));

      setUnreadCount(unreadIds.length);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const checkUnacknowledgedNotifications = async () => {
    if (!profile) return;

    try {
      const userUuid = profile.role === 'user' ? profile.id : profile.partner_uuid;
      const recipientType = profile.role === 'user' ? 'customer' : 'partner';

      // Get notifications targeted to this user
      const { data: recipients, error: recipientsError } = await supabase
        .from('notification_recipients')
        .select('notification_id')
        .eq('recipient_uuid', userUuid)
        .eq('recipient_type', recipientType);

      if (recipientsError) throw recipientsError;

      const notificationIds = recipients.map(r => r.notification_id);

      if (notificationIds.length === 0) return;

      // Get published, active, valid notifications
      const now = new Date().toISOString();
      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .in('id', notificationIds)
        .eq('status', 'published')
        .eq('is_active', true)
        .lte('valid_from', now)
        .gte('valid_until', now)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      if (!notifications || notifications.length === 0) return;

      // Get views to check which are unacknowledged
      const { data: views, error: viewsError } = await supabase
        .from('notification_views')
        .select('notification_id, modal_acknowledged')
        .in('notification_id', notifications.map(n => n.id))
        .eq('user_uuid', userUuid);

      if (viewsError) throw viewsError;

      // Filter notifications that haven't been acknowledged
      const viewsMap = {};
      views.forEach(v => {
        viewsMap[v.notification_id] = v.modal_acknowledged;
      });

      const unacknowledged = notifications.filter(n => {
        return !viewsMap[n.id] || viewsMap[n.id] === false;
      });

      if (unacknowledged.length > 0) {
        setUnacknowledgedNotifications(unacknowledged);
        setCurrentModalIndex(0);
        setShowAutoModal(true);
      }
    } catch (error) {
      console.error('Error checking unacknowledged notifications:', error);
    }
  };

  const subscribeToNotifications = () => {
    if (!profile) return;

    const userUuid = profile.role === 'user' ? profile.id : profile.partner_uuid;

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          // Reload count when notifications change
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_views',
          filter: `user_uuid=eq.${userUuid}`
        },
        () => {
          // Reload count when views change
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAcknowledge = async (notificationId) => {
    if (!profile) return;

    const userUuid = profile.role === 'customer' ? profile.id : profile.partner_uuid;

    try {
      await supabase
        .from('notification_views')
        .upsert({
          notification_id: notificationId,
          user_uuid: userUuid,
          partner_uuid: profile.partner_uuid,
          modal_acknowledged: true
        }, {
          onConflict: 'notification_id,user_uuid'
        });

      loadUnreadCount();
    } catch (error) {
      console.error('Error acknowledging notification:', error);
    }
  };

  const handleModalClose = () => {
    setShowAutoModal(false);
    setUnacknowledgedNotifications([]);
    setCurrentModalIndex(0);
  };

    const handleBellClick = () => {
    window.location.hash = '#/notifications';
    };

  return (
    <>
      <button className="notification-bell" onClick={handleBellClick}>
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showAutoModal && unacknowledgedNotifications.length > 0 && (
        <NotificationModal
          notifications={unacknowledgedNotifications}
          currentIndex={currentModalIndex}
          mode="auto-open"
          onClose={handleModalClose}
          onAcknowledge={handleAcknowledge}
          onNavigate={setCurrentModalIndex}
        />
      )}
    </>
  );
};

export default NotificationBell;
// src/components/notifications/NotificationModal.jsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { toast } from '../common/ToastContainer';

const NotificationModal = ({ 
  notifications = [], 
  currentIndex = 0,
  mode = 'read', // 'auto-open', 'read', 'preview'
  onClose,
  onAcknowledge,
  onNavigate
}) => {
  const { t } = useTranslation();
  const [acknowledging, setAcknowledging] = useState(false);
  
  if (!notifications || notifications.length === 0) return null;

  const notification = notifications[currentIndex];
  const isAutoOpen = mode === 'auto-open';
  const isPreview = mode === 'preview';
  const hasMultiple = notifications.length > 1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < notifications.length - 1;

  const getTypeInfo = (type) => {
    const types = {
      promotion: { label: t('notifications.types.promotion'), color: '#16a34a' },
      announcement: { label: t('notifications.types.announcement'), color: '#3b82f6' },
      release_note: { label: t('notifications.types.releaseNote'), color: '#8b5cf6' },
      alert: { label: t('notifications.types.alert'), color: '#f97316' },
      new_location: { label: t('notifications.types.newLocation'), color: '#16a34a' }
    };
    return types[type] || { label: type, color: '#6b7280' };
  };

  const typeInfo = getTypeInfo(notification.notification_type);

  const handleAcknowledge = async () => {
    if (isPreview) {
      onClose?.();
      return;
    }

    setAcknowledging(true);
    try {
      if (onAcknowledge) {
        await onAcknowledge(notification.id);
      }
      
      // If there are more notifications in auto-open mode, navigate to next
      if (isAutoOpen && canGoNext) {
        onNavigate?.(currentIndex + 1);
      } else {
        onClose?.();
      }
    } catch (error) {
      console.error('Error acknowledging notification:', error);
      toast.error(t('notifications.errorAcknowledging'));
    } finally {
      setAcknowledging(false);
    }
  };

  const handlePrevious = () => {
    if (canGoPrev && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <div className="notification-modal-overlay">
      <div className="notification-modal">
        {isPreview && (
          <div className="notification-modal-preview-banner">
            {t('notifications.previewMode')}
          </div>
        )}
        
        <div className="notification-modal-header">
          <div className="notification-modal-type" style={{ backgroundColor: typeInfo.color }}>
            {typeInfo.label}
          </div>
          <h2 className="notification-modal-title">{notification.title}</h2>
        </div>

        <div className="notification-modal-body">
          <div 
            className="notification-modal-content"
            dangerouslySetInnerHTML={{ __html: notification.message }}
          />
        </div>

        <div className="notification-modal-footer">
          {isAutoOpen && hasMultiple && (
            <div className="notification-modal-navigation">
              <button
                onClick={handlePrevious}
                disabled={!canGoPrev}
                className="notification-modal-nav-btn"
              >
                <ChevronLeft size={20} />
                {t('common.previous')}
              </button>
              <span className="notification-modal-counter">
                {currentIndex + 1} {t('common.of')} {notifications.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!canGoNext}
                className="notification-modal-nav-btn"
              >
                {t('common.next')}
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="notification-modal-acknowledge-btn"
          >
            {acknowledging ? (
              <>
                <div className="loading-spinner-small"></div>
                {t('common.loading')}...
              </>
            ) : isPreview ? (
              t('common.close')
            ) : isAutoOpen ? (
              t('notifications.gotIt')
            ) : (
              t('common.close')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
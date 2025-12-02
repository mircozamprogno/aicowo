// src/components/notifications/CreateNotification.jsx
import { Calendar, Save, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';
import NotificationEditor from './NotificationEditor';
import NotificationModal from './NotificationModal';
import RecipientSelector from './RecipientSelector';

import logger from '../../utils/logger';


import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, logActivity } from '../../utils/activityLogger';

const CreateNotification = ({ editNotification = null, onSaved, onCancel }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState('announcement');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [recipientTypeFilter, setRecipientTypeFilter] = useState('all'); // all, partners, customers

  const isSuperadmin = profile?.role === 'superadmin';
  const isPartner = profile?.role === 'admin';


  useEffect(() => {
    loadTemplates();
    
    if (editNotification) {
      populateForm(editNotification);
    } else {
      // Set default dates (today to 30 days from now)
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      setValidFrom(formatDateTimeLocal(now));
      setValidUntil(formatDateTimeLocal(futureDate));
    }
  }, [editNotification]);

  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const populateForm = async (notification) => {
    setTitle(notification.title);
    setMessage(notification.message);
    setNotificationType(notification.notification_type);
    setValidFrom(formatDateTimeLocal(new Date(notification.valid_from)));
    setValidUntil(formatDateTimeLocal(new Date(notification.valid_until)));
    
    // Load recipients
    const { data: recipients } = await supabase
      .from('notification_recipients')
      .select('recipient_uuid, recipient_type')
      .eq('notification_id', notification.id);
    
    if (recipients) {
      setSelectedRecipients(recipients.map(r => ({
        uuid: r.recipient_uuid,
        type: r.recipient_type
      })));
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      let query = supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!isSuperadmin) {
        query = query.or(`created_by_role.eq.superadmin,partner_uuid.eq.${profile.partner_uuid}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      logger.error('Error loading templates:', error);
      toast.error(t('notifications.errorLoadingTemplates'));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTitle(template.title_template);
      setMessage(template.message_template);
      setNotificationType(template.notification_type);
    }
  };

  const handleSave = async (status = 'draft') => {
    // Validation
    if (!title.trim()) {
      toast.error(t('notifications.titleRequired'));
      return;
    }

    if (!message.trim()) {
      toast.error(t('notifications.messageRequired'));
      return;
    }

    if (!validFrom || !validUntil) {
      toast.error(t('notifications.dateRangeRequired'));
      return;
    }

    if (new Date(validFrom) >= new Date(validUntil)) {
      toast.error(t('notifications.invalidDateRange'));
      return;
    }

    if (selectedRecipients.length === 0 && status === 'published') {
      toast.error(t('notifications.recipientsRequired'));
      return;
    }

    setSaving(true);
    try {
        const notificationData = {
        title,
        message,
        notification_type: notificationType,
        valid_from: new Date(validFrom).toISOString(),
        valid_until: new Date(validUntil).toISOString(),
        status,
        created_by_uuid: profile.id,
        creator_role: profile.role,
        partner_uuid: isSuperadmin ? null : profile.partner_uuid,
        template_id: selectedTemplate || null
        };

      let notificationId;

      if (editNotification) {
        // Update existing
        const { error } = await supabase
          .from('notifications')
          .update(notificationData)
          .eq('id', editNotification.id);

        if (error) throw error;
        notificationId = editNotification.id;

        // Delete old recipients
        await supabase
          .from('notification_recipients')
          .delete()
          .eq('notification_id', notificationId);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();

        if (error) throw error;
        notificationId = data.id;
      }

      // Insert recipients
      if (selectedRecipients.length > 0) {
        const recipientsData = selectedRecipients.map(r => ({
          notification_id: notificationId,
          recipient_uuid: r.uuid,
          recipient_type: r.type,
          partner_uuid: profile.partner_uuid
        }));

        const { error: recipientsError } = await supabase
          .from('notification_recipients')
          .insert(recipientsData);

        if (recipientsError) throw recipientsError;
      }

      // Activity log
        await logActivity({
        action_category: ACTIVITY_CATEGORIES.NOTIFICATION,
        action_type: editNotification ? ACTIVITY_ACTIONS.UPDATED : ACTIVITY_ACTIONS.CREATED,
        entity_id: notificationId,
        entity_type: 'notification',
        description: editNotification 
            ? `Notification "${title}" updated with status: ${status}`
            : `Notification "${title}" created with status: ${status}`,
        metadata: {
            notification_id: notificationId,
            status,
            recipients_count: selectedRecipients.length,
            notification_type: notificationType
        }
        });

      toast.success(
        status === 'published' 
          ? t('notifications.notificationPublished') 
          : t('notifications.notificationSavedAsDraft')
      );

      // Reset form
      if (!editNotification) {
        resetForm();
      }

      onSaved?.();
    } catch (error) {
      logger.error('Error saving notification:', error);
      toast.error(t('notifications.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setNotificationType('announcement');
    setSelectedRecipients([]);
    setSelectedTemplate('');
    
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setValidFrom(formatDateTimeLocal(now));
    setValidUntil(formatDateTimeLocal(futureDate));
  };

  const getSampleData = () => {
    return isSuperadmin ? {
      '{{partner_name}}': 'Demo Company',
      '{{partner_firstname}}': 'Mario',
      '{{partner_lastname}}': 'Rossi'
    } : {
      '{{partner_name}}': 'Your Company',
      '{{customer_name}}': 'John Doe',
      '{{offer_percentage}}': '20%'
    };
  };

  return (
    <div className="create-notification-container">
      <div className="create-notification-header">
        <h2>{editNotification ? t('notifications.editNotification') : t('notifications.createNewNotification')}</h2>
        <p>{t('notifications.createDescription')}</p>
      </div>

      <div className="create-notification-form">
        {/* Template Selection */}
        <div className="form-field">
          <label>{t('notifications.startFromTemplate')}</label>
          <Select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            options={[
              { value: '', label: t('notifications.blankNotification') },
              ...templates.map(template => ({
                value: template.id,
                label: template.name
              }))
            ]}
            placeholder={t('notifications.startFromTemplate')}
          />
        </div>

        {/* Title */}
        <div className="form-field">
          <label>{t('notifications.title')} *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('notifications.titlePlaceholder')}
            className="form-input"
          />
        </div>

        {/* Type */}
        <div className="form-field">
          <label>{t('notifications.type')} *</label>
          <Select
            value={notificationType}
            onChange={(e) => setNotificationType(e.target.value)}
            options={[
              { value: 'announcement', label: t('notifications.types.announcement') },
              { value: 'promotion', label: t('notifications.types.promotion') },
              ...(isSuperadmin ? [{ value: 'release_note', label: t('notifications.types.releaseNote') }] : []),
              { value: 'alert', label: t('notifications.types.alert') },
              ...(isPartner ? [{ value: 'new_location', label: t('notifications.types.newLocation') }] : [])
            ]}
          />
        </div>

        {/* Message Editor */}
        <div className="form-field">
          <label>{t('notifications.message')} *</label>
          <NotificationEditor
            value={message}
            onChange={setMessage}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            sampleData={getSampleData()}
          />
        </div>

        {/* Date Range */}
        <div className="form-field-row">
          <div className="form-field">
            <label>
              <Calendar size={16} />
              {t('notifications.validFrom')} *
            </label>
            <input
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label>
              <Calendar size={16} />
              {t('notifications.validUntil')} *
            </label>
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="form-input"
            />
          </div>
        </div>


        {isSuperadmin && (
          <div className="form-field">
            <label>{t('notifications.recipientType')}</label>
            <Select
              value={recipientTypeFilter}
              onChange={(e) => setRecipientTypeFilter(e.target.value)}
              options={[
                { value: 'all', label: t('notifications.allRecipientTypes') },
                { value: 'partners', label: t('notifications.partnersOnly') },
                { value: 'customers', label: t('notifications.customersOnly') }
              ]}
            />
          </div>
        )}

        {/* Recipient Selection */}
        <div className="form-field">
          <label>
            <Users size={16} />
            {t('notifications.selectRecipients')} *
          </label>
          <RecipientSelector
            userRole={profile.role}
            partnerUuid={profile.partner_uuid}
            selectedRecipients={selectedRecipients}
            onRecipientsChange={setSelectedRecipients}
            recipientTypeFilter={isSuperadmin ? recipientTypeFilter : undefined}
          />
          <p className="form-field-hint">
            {selectedRecipients.length} {t('notifications.recipientsSelected')}
          </p>
        </div>

        {/* Actions */}
        <div className="create-notification-actions" style={{ justifyContent: 'space-between' }}>
          <button
            onClick={onCancel}
            className="btn-secondary"
            type="button"
          >
            {t('common.cancel')}
          </button>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="btn-secondary"
              disabled={!title.trim() || !message.trim()}
            >
              {t('notifications.preview')}
            </button>
            <button
              onClick={() => handleSave('draft')}
              className="btn-secondary"
              disabled={saving}
            >
              <Save size={16} />
              {t('notifications.saveAsDraft')}
            </button>
            <button
              onClick={() => handleSave('published')}
              className="btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  {t('common.saving')}...
                </>
              ) : (
                <>
                  <Send size={16} />
                  {t('notifications.publish')}
                </>
              )}
            </button>
          </div>
        </div>

        
      </div>

      {showPreviewModal && (
        <NotificationModal
          notifications={[{
            id: 'preview',
            title,
            message,
            notification_type: notificationType
          }]}
          currentIndex={0}
          mode="preview"
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
};

export default CreateNotification;
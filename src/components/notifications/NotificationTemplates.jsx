// src/components/notifications/NotificationTemplates.jsx
import { Edit, Eye, FileText, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import ConfirmModal from '../common/ConfirmModal';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';
import NotificationEditor from './NotificationEditor';
import NotificationModal from './NotificationModal';

const NotificationTemplates = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const isSuperadmin = profile?.role === 'superadmin';

  useEffect(() => {
    loadTemplates();
  }, [profile]);

  const loadTemplates = async () => {
    if (!profile) return;

    setLoading(true);
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
      console.error('Error loading templates:', error);
      toast.error(t('notifications.errorLoadingTemplates'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      const { error } = await supabase
        .from('notification_templates')
        .update({ is_active: false })
        .eq('id', deletingTemplate.id);

      if (error) throw error;

      toast.success(t('notifications.templateDeleted'));
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(t('notifications.errorDeletingTemplate'));
    } finally {
      setDeletingTemplate(null);
    }
  };

  const canEdit = (template) => {
    if (isSuperadmin) return true;
    if (template.created_by_role === 'admin' && template.partner_uuid === profile.partner_uuid) return true;
    return false;
  };

  const canDelete = (template) => {
    return canEdit(template);
  };

  if (showEditor) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onSaved={() => {
          setShowEditor(false);
          setEditingTemplate(null);
          loadTemplates();
        }}
        onCancel={() => {
          setShowEditor(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="templates-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}...</p>
      </div>
    );
  }

  return (
    <div className="templates-container">
      <div className="templates-header">
        <h2>{t('notifications.templates')}</h2>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowEditor(true);
          }}
          className="btn-primary"
        >
          <Plus size={16} />
          {t('notifications.createTemplate')}
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="templates-empty">
          <FileText size={48} />
          <p>{t('notifications.noTemplates')}</p>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-card-header">
                <h3>{template.name}</h3>
                <span className={`template-badge ${template.created_by_role}`}>
                  {template.created_by_role === 'superadmin' 
                    ? t('notifications.systemTemplate') 
                    : t('notifications.myTemplate')}
                </span>
              </div>
              
              <p className="template-description">{template.description}</p>
              
              <div className="template-meta">
                <span className="template-type">
                  {t(`notifications.types.${template.notification_type}`)}
                </span>
              </div>

              <div className="template-actions">
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="action-btn"
                  title={t('notifications.preview')}
                >
                  <Eye size={16} />
                </button>
                {canEdit(template) && (
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowEditor(true);
                    }}
                    className="action-btn"
                    title={t('common.edit')}
                  >
                    <Edit size={16} />
                  </button>
                )}
                {canDelete(template) && (
                  <button
                    onClick={() => setDeletingTemplate(template)}
                    className="action-btn delete"
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewTemplate && (
        <NotificationModal
          notifications={[{
            id: previewTemplate.id,
            title: previewTemplate.title_template,
            message: previewTemplate.message_template,
            notification_type: previewTemplate.notification_type
          }]}
          currentIndex={0}
          mode="preview"
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {deletingTemplate && (
        <ConfirmModal
          isOpen={true}
          title={t('notifications.confirmDeleteTemplate')}
          message={t('notifications.confirmDeleteTemplateMessage')}
          onConfirm={handleDelete}
          onClose={() => setDeletingTemplate(null)}
          confirmText={t('common.delete')}
          isDestructive={true}
        />
      )}
    </div>
  );
};

const TemplateEditor = ({ template, onSaved, onCancel }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [notificationType, setNotificationType] = useState(template?.notification_type || 'announcement');
  const [titleTemplate, setTitleTemplate] = useState(template?.title_template || '');
  const [messageTemplate, setMessageTemplate] = useState(template?.message_template || '');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isSuperadmin = profile?.role === 'superadmin';

  const availableVariables = [
    { name: '{{partner_name}}', description: t('notifications.variables.partnerName') },
    { name: '{{customer_name}}', description: t('notifications.variables.customerName') },
    { name: '{{current_date}}', description: t('notifications.variables.currentDate') },
    { name: '{{offer_percentage}}', description: t('notifications.variables.offerPercentage') },
    { name: '{{location_name}}', description: t('notifications.variables.locationName') }
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('notifications.templateNameRequired'));
      return;
    }

    if (!titleTemplate.trim() || !messageTemplate.trim()) {
      toast.error(t('notifications.templateContentRequired'));
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name,
        description,
        notification_type: notificationType,
        title_template: titleTemplate,
        message_template: messageTemplate,
        created_by_role: profile.role,
        partner_uuid: isSuperadmin ? null : profile.partner_uuid,
        is_active: true
      };

      if (template) {
        const { error } = await supabase
          .from('notification_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_templates')
          .insert(templateData);

        if (error) throw error;
      }

      toast.success(t('notifications.templateSaved'));
      onSaved();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(t('notifications.errorSavingTemplate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="template-editor-container">
      <div className="template-editor-header">
        <h2>{template ? t('notifications.editTemplate') : t('notifications.createTemplate')}</h2>
      </div>

      <div className="template-editor-form">
        <div className="form-field">
          <label>{t('notifications.templateName')} *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('notifications.templateNamePlaceholder')}
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label>{t('notifications.templateDescription')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('notifications.templateDescriptionPlaceholder')}
            className="form-textarea"
            rows={3}
          />
        </div>

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
              { value: 'new_location', label: t('notifications.types.newLocation') }
            ]}
            className="form-select"
          />
        </div>

        <div className="form-field">
          <label>{t('notifications.titleTemplate')} *</label>
          <input
            type="text"
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
            placeholder={t('notifications.titleTemplatePlaceholder')}
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label>{t('notifications.messageTemplate')} *</label>
          <NotificationEditor
            value={messageTemplate}
            onChange={setMessageTemplate}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            sampleData={{
              '{{partner_name}}': 'Demo Company',
              '{{customer_name}}': 'John Doe',
              '{{current_date}}': new Date().toLocaleDateString(),
              '{{offer_percentage}}': '20%',
              '{{location_name}}': 'Downtown Branch'
            }}
          />
        </div>

        <div className="template-variables-info">
          <h4>{t('notifications.availableVariables')}</h4>
          <div className="variables-grid">
            {availableVariables.map(v => (
              <div key={v.name} className="variable-badge">
                <code>{v.name}</code>
                <span>{v.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="template-editor-actions">
          <button onClick={onCancel} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? (
              <>
                <div className="loading-spinner-small"></div>
                {t('common.saving')}...
              </>
            ) : (
              <>
                <FileText size={16} />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationTemplates;
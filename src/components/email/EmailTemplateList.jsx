// src/components/email/EmailTemplateList.jsx
import { Bell, CheckCircle, ChevronRight, Clock, FileText, Mail, Shield, UserPlus, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import EmailTemplateEditor from './EmailTemplateEditor';

import logger from '../../utils/logger';

const PARTNER_TEMPLATE_CONFIGS = {
  customer_invitation: {
    id: 'customer_invitation',
    nameKey: 'emailTemplates.customerInvitation',
    descriptionKey: 'emailTemplates.customerInvitationDescription',
    icon: 'UserPlus'
  },
  customer_booking_confirmation: {
    id: 'customer_booking_confirmation',
    nameKey: 'emailTemplates.customerBookingConfirmation',
    descriptionKey: 'emailTemplates.customerBookingConfirmationDescription',
    icon: 'CheckCircle'
  },
  confirmation_email: {
    id: 'confirmation_email',
    nameKey: 'emailTemplates.confirmationEmail',
    descriptionKey: 'emailTemplates.confirmationEmailDescription',
    icon: 'Mail'
  },
  expiry_reminder: {
    id: 'expiry_reminder',
    nameKey: 'emailTemplates.expiryReminder',
    descriptionKey: 'emailTemplates.expiryReminderDescription',
    icon: 'Clock'
  },
  contract_creation: {
    id: 'contract_creation',
    nameKey: 'emailTemplates.contractCreation',
    descriptionKey: 'emailTemplates.contractCreationDescription',
    icon: 'FileText'
  },
  customer_booking_deleted: {
    id: 'customer_booking_deleted',
    nameKey: 'emailTemplates.customerBookingDeleted',
    descriptionKey: 'emailTemplates.customerBookingDeletedDescription',
    icon: 'XCircle'
  }
  // partner_admin_invitation and partner_booking_notification temporarily disabled
};

const SUPERADMIN_TEMPLATE_CONFIGS = {
  partner_invitation: {
    id: 'partner_invitation',
    nameKey: 'emailTemplates.partnerInvitation',
    descriptionKey: 'emailTemplates.partnerInvitationDescription',
    icon: 'Shield'
  }
};

const EmailTemplateList = ({ partnerUuid, mode = 'partner' }) => {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Select the appropriate template configs based on mode
  const TEMPLATE_CONFIGS = mode === 'superadmin'
    ? SUPERADMIN_TEMPLATE_CONFIGS
    : PARTNER_TEMPLATE_CONFIGS;

  useEffect(() => {
    if (partnerUuid) {
      fetchTemplates();
    }
  }, [partnerUuid]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, partner_uuid, template_type, subject_line, body_html, created_at, updated_at')
        .eq('partner_uuid', partnerUuid);

      if (error) {
        logger.error('Error fetching templates:', error);
        throw error;
      }

      logger.log('Templates fetched:', data);
      setTemplates(data || []);
    } catch (error) {
      logger.error('Error in fetchTemplates:', error);
      toast.error('Error loading templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName) => {
    const icons = {
      UserPlus: UserPlus,
      Shield: Shield,
      CheckCircle: CheckCircle,
      Bell: Bell,
      Mail: Mail,
      Clock: Clock,
      FileText: FileText,
      XCircle: XCircle
    };
    const Icon = icons[iconName] || UserPlus;
    return <Icon size={24} />;
  };

  const handleTemplateClick = (templateType) => {
    const config = TEMPLATE_CONFIGS[templateType];
    if (!config) return;

    const dbTemplate = templates.find(t => t.template_type === templateType);

    setSelectedTemplate({
      ...config,
      dbId: dbTemplate?.id,
      subject_line: dbTemplate?.subject_line,
      body_html: dbTemplate?.body_html,
      isCustomized: !!dbTemplate
    });
  };

  if (selectedTemplate) {
    return (
      <EmailTemplateEditor
        template={selectedTemplate}
        partnerUuid={partnerUuid}
        mode={mode}
        onBack={() => {
          setSelectedTemplate(null);
          fetchTemplates();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="email-template-list">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="email-template-list">
      <div className="email-template-list-header">
        <h3 className="email-template-list-title">
          {t('emailTemplates.manageTemplates')}
        </h3>
        <p className="email-template-list-description">
          {mode === 'superadmin'
            ? t('emailTemplates.manageSuperadminTemplatesDescription')
            : t('emailTemplates.manageTemplatesDescription')
          }
        </p>
      </div>

      <div className="template-cards">
        {Object.entries(TEMPLATE_CONFIGS).map(([templateType, config]) => {
          const dbTemplate = templates.find(t => t.template_type === templateType);

          return (
            <div
              key={templateType}
              className={`template-card ${!dbTemplate ? 'template-not-saved' : ''}`}
              onClick={() => handleTemplateClick(templateType)}
            >
              <div className="template-card-icon">
                {getIcon(config.icon)}
              </div>
              <div className="template-card-content">
                <h4 className="template-card-title">
                  {t(config.nameKey)}
                  {dbTemplate && (
                    <span className="template-customized-badge">
                      Customized
                    </span>
                  )}
                </h4>
                <p className="template-card-description">
                  {t(config.descriptionKey)}
                </p>
              </div>
              <div className="template-card-action">
                <ChevronRight size={20} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmailTemplateList;
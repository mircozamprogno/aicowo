// src/components/email/EmailTemplateList.jsx
import { Bell, CheckCircle, ChevronRight, Shield, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import EmailTemplateEditor from './EmailTemplateEditor';

const TEMPLATE_CONFIGS = {
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
  }
  // partner_admin_invitation and partner_booking_notification temporarily disabled
};

const EmailTemplateList = ({ partnerUuid }) => {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

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
        console.error('Error fetching templates:', error);
        throw error;
      }

      console.log('Templates fetched:', data);
      setTemplates(data || []);
    } catch (error) {
      console.error('Error in fetchTemplates:', error);
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
      Bell: Bell
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
          {t('emailTemplates.manageTemplatesDescription')}
        </p>
      </div>

      <div className="template-cards">
        {Object.entries(TEMPLATE_CONFIGS).map(([templateType, config]) => {
          const dbTemplate = templates.find(t => t.template_type === templateType);
          
          return (
            <div
              key={templateType}
              className="template-card"
              onClick={() => handleTemplateClick(templateType)}
            >
              <div className="template-card-icon">
                {getIcon(config.icon)}
              </div>
              <div className="template-card-content">
                <h4 className="template-card-title">
                  {t(config.nameKey)}
                  {dbTemplate && (
                    <span style={{
                      display: 'inline-block',
                      marginLeft: '0.5rem',
                      padding: '0.125rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: '#16a34a',
                      backgroundColor: '#dcfce7',
                      borderRadius: '9999px'
                    }}>
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
// src/components/email/EmailTemplateList.jsx
import { Bell, CheckCircle, ChevronRight, Shield, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { TEMPLATE_TYPES } from '../../utils/defaultEmailTemplates';
import { toast } from '../common/ToastContainer';
import EmailTemplateEditor from './EmailTemplateEditor';

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
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('partner_uuid', partnerUuid);

      if (error) throw error;

      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error(t('messages.errorLoadingTemplates') || 'Error loading templates');
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

  const getTemplateData = (templateType) => {
    const dbTemplate = templates.find(t => t.template_type === templateType.id);
    
    return {
      ...templateType,
      dbId: dbTemplate?.id,
      subject_line: dbTemplate?.subject_line,
      body_html: dbTemplate?.body_html,
      isCustomized: !!dbTemplate
    };
  };

  if (selectedTemplate) {
    return (
      <EmailTemplateEditor
        template={selectedTemplate}
        partnerUuid={partnerUuid}
        onBack={() => {
          setSelectedTemplate(null);
          fetchTemplates(); // Refresh after editing
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="email-template-list">
        <div className="loading-spinner"></div>
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
        {TEMPLATE_TYPES.map((templateType) => {
          const templateData = getTemplateData(templateType);
          
          return (
            <div
              key={templateType.id}
              className="template-card"
              onClick={() => setSelectedTemplate(templateData)}
            >
              <div className="template-card-icon">
                {getIcon(templateType.icon)}
              </div>
              <div className="template-card-content">
                <h4 className="template-card-title">
                  {t(templateType.nameKey)}
                  {templateData.isCustomized && (
                    <span className="template-customized-badge">
                      {t('emailTemplates.customized') || 'Customized'}
                    </span>
                  )}
                </h4>
                <p className="template-card-description">
                  {t(templateType.descriptionKey)}
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
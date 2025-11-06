import { Bell, CheckCircle, ChevronRight, Shield, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { TEMPLATE_TYPES } from '../../utils/defaultEmailTemplates';
import EmailTemplateEditor from './EmailTemplateEditor';

const EmailTemplateList = ({ partnerUuid }) => {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState(null);

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

  if (selectedTemplate) {
    return (
      <EmailTemplateEditor
        template={selectedTemplate}
        partnerUuid={partnerUuid}
        onBack={() => setSelectedTemplate(null)}
      />
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
        {TEMPLATE_TYPES.map((template) => (
          <div
            key={template.id}
            className="template-card"
            onClick={() => setSelectedTemplate(template)}
          >
            <div className="template-card-icon">
              {getIcon(template.icon)}
            </div>
            <div className="template-card-content">
              <h4 className="template-card-title">
                {t(template.nameKey)}
              </h4>
              <p className="template-card-description">
                {t(template.descriptionKey)}
              </p>
            </div>
            <div className="template-card-action">
              <ChevronRight size={20} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailTemplateList;
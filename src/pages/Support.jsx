import { Building, Clock, FileText, HelpCircle, Mail, MapPin, MessageSquare, Phone, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';

import logger from '../utils/logger';

const Support = () => {
  const { t } = useTranslation();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (err) {
      logger.error('Failed to copy email:', err);
    }
  };

  const handleCopyPhone = async (phone) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (err) {
      logger.error('Failed to copy phone:', err);
    }
  };

  const supportCategories = [
    {
      icon: HelpCircle,
      title: t('support.technicalSupport'),
      description: t('support.technicalSupportDescription'),
      email: 'support@mlm-media.com',
      priority: t('support.highPriority')
    },
    {
      icon: Users,
      title: t('support.accountBilling'),
      description: t('support.accountBillingDescription'),
      email: 'billing@mlm-media.com',
      priority: t('support.mediumPriority')
    },
    {
      icon: MessageSquare,
      title: t('support.generalInquiries'),
      description: t('support.generalInquiriesDescription'),
      email: 'info@mlm-media.com',
      priority: t('support.standardPriority')
    },
    {
      icon: FileText,
      title: t('support.documentation'),
      description: t('support.documentationDescription'),
      email: 'docs@mlm-media.com',
      priority: t('support.selfServicePriority')
    }
  ];

  return (
    <div className="support-page">
      <div className="support-header">
        <div className="support-title">
          <HelpCircle size={32} className="support-icon" />
          <div>
            <h1>{t('support.title')}</h1>
            <p>{t('support.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="support-content">
        {/* Company Information Card */}
        <div className="support-card company-info">
          <div className="card-header">
            <Building size={24} className="card-icon" />
            <h2>{t('support.companyInformation')}</h2>
          </div>
          <div className="company-details">
            <div className="company-name">
              <h3>{t('support.companyName')}</h3>
            </div>
            
            <div className="contact-info">
              <div className="contact-item">
                <MapPin size={20} className="contact-icon" />
                <div className="contact-details">
                  <span className="contact-label">{t('support.address')}</span>
                  <span className="contact-value">{t('support.companyAddress')}</span>
                </div>
              </div>

              <div className="contact-item">
                <Phone 
                  size={20} 
                  className="contact-icon clickable" 
                  onClick={() => handleCopyPhone(t('support.phoneNumber'))}
                />
                <div className="contact-details">
                  <span className="contact-label">{t('support.phone')}</span>
                  <span 
                    className="contact-value clickable" 
                    onClick={() => handleCopyPhone(t('support.phoneNumber'))}
                    title={t('support.clickToCopy')}
                  >
                    {t('support.phoneNumber')}
                    {copiedPhone && <span className="copied-text"> ✓ {t('support.copied')}</span>}
                  </span>
                </div>
              </div>

              <div className="contact-item">
                <Mail 
                  size={20} 
                  className="contact-icon clickable" 
                  onClick={() => handleCopyEmail(t('support.mainEmail'))}
                />
                <div className="contact-details">
                  <span className="contact-label">{t('support.email')}</span>
                  <span 
                    className="contact-value clickable" 
                    onClick={() => handleCopyEmail(t('support.mainEmail'))}
                    title={t('support.clickToCopy')}
                  >
                    {t('support.mainEmail')}
                    {copiedEmail && <span className="copied-text"> ✓ {t('support.copied')}</span>}
                  </span>
                </div>
              </div>

              <div className="contact-item">
                <Clock size={20} className="contact-icon" />
                <div className="contact-details">
                  <span className="contact-label">{t('support.businessHours')}</span>
                  <div className="business-hours">
                    <span className="contact-value">{t('support.mondayFriday')}</span>
                    <span className="contact-value secondary">{t('support.saturday')}</span>
                    <span className="contact-value secondary">{t('support.sunday')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Support Categories */}
        <div className="support-categories">
          <h2>{t('support.howCanWeHelp')}</h2>
          <div className="categories-grid">
            {supportCategories.map((category, index) => {
              const IconComponent = category.icon;
              return (
                <div key={index} className="category-card">
                  <div className="category-header">
                    <IconComponent size={24} className="category-icon" />
                    <div className="category-info">
                      <h3>{category.title}</h3>
                      <span className={`priority ${category.priority.toLowerCase().replace(' ', '-')}`}>
                        {category.priority}
                      </span>
                    </div>
                  </div>
                  <p className="category-description">{category.description}</p>
                  <div className="category-contact">
                    <Mail size={16} />
                    <span 
                      className="category-email clickable"
                      onClick={() => handleCopyEmail(category.email)}
                      title={t('support.clickToCopyEmail')}
                    >
                      {category.email}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="support-card emergency-contact">
          <div className="card-header urgent">
            <Phone size={24} className="card-icon" />
            <h2>{t('support.emergencySupport')}</h2>
          </div>
          <div className="emergency-info">
            <p>{t('support.emergencyDescription')}</p>
            <div className="emergency-details">
              <div className="emergency-phone">
                <Phone size={20} />
                <span 
                  className="emergency-number clickable"
                  onClick={() => handleCopyPhone(t('support.emergencyNumber'))}
                  title={t('support.clickToCopyEmergencyNumber')}
                >
                  {t('support.emergencyNumber')}
                </span>
              </div>
              <div className="emergency-availability">
                <Clock size={20} />
                <span>{t('support.available24x7')}</span>
              </div>
            </div>
            <div className="emergency-note">
              <strong>{t('support.note')}</strong> {t('support.emergencyNote')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
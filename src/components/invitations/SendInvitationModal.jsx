import { Mail, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const SendInvitationModal = ({ isOpen, onClose, partner, currentUserRole }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    customMessage: ''
  });
  const [loading, setLoading] = useState(false);

  // Determine invitation type based on user role
  const isPartnerAdminInvitation = currentUserRole === 'superadmin';
  const targetRole = isPartnerAdminInvitation ? 'admin' : 'user';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const generateInvitationLink = (invitationUuid) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#/invitation-register?token=${invitationUuid}`;
  };

  const sendInvitationEmail = async (invitation, invitationLink) => {
    // Add partner data to invitation object for email service
    const invitationWithPartner = {
      ...invitation,
      partners: {
        partner_name: partner?.partner_name,
        company_name: partner?.company_name
      }
    };

    console.log('Sending invitation email with OneSignal:', invitationWithPartner);

    try {
      // Import OneSignal email service (corrected import path)
      const { default: oneSignalEmailService } = await import('../../services/oneSignalEmailService');
      const success = await oneSignalEmailService.sendInvitation(invitationWithPartner, invitationLink);
      
      if (success) {
        toast.success(t('messages.invitationSentSuccessfully'));
      } else {
        toast.error(t('messages.errorSendingInvitation'));
      }
      
      return success;
    } catch (error) {
      console.error('Error with OneSignal email service:', error);
      console.log('Fallback - logging invitation details:', {
        to: invitation.invited_email,
        role: invitation.invited_role,
        partner: partner?.partner_name || partner?.company_name,
        link: invitationLink,
        message: formData.customMessage
      });
      toast.error(t('messages.errorSendingInvitation'));
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create invitation record
      const invitationData = {
        partner_uuid: partner.partner_uuid,
        invited_role: targetRole,
        invited_email: formData.email,
        invited_first_name: formData.firstName,
        invited_last_name: formData.lastName,
        custom_message: formData.customMessage,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('invitations')
        .insert([invitationData])
        .select()
        .single();

      if (error) throw error;

      // Generate invitation link
      const invitationLink = generateInvitationLink(data.invitation_uuid);

      // Send email (in real implementation)
      await sendInvitationEmail(data, invitationLink);

      // Show success and close modal
      toast.success(
        isPartnerAdminInvitation 
          ? t('messages.partnerAdminInvitationSent')
          : t('messages.userInvitationSent')
      );
      
      onClose();
      
      // Reset form
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        customMessage: ''
      });

    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error(error.message || t('messages.errorSendingInvitation'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            {isPartnerAdminInvitation 
              ? t('invitations.invitePartnerAdmin') 
              : t('invitations.inviteUser')
            }
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="invitation-modal-content">
          {/* Partner Info */}
          <div className="invitation-partner-info">
            <div className="partner-info-card">
              <h3 className="partner-info-title">
                {isPartnerAdminInvitation 
                  ? t('invitations.invitingAdminFor')
                  : t('invitations.invitingUserFor')
                }
              </h3>
              <p className="partner-info-name">
                {partner?.partner_name || partner?.company_name}
              </p>
              <div className="role-badge">
                <span className="role-badge-text">
                  {t(`roles.${targetRole}`)}
                </span>
              </div>
            </div>
          </div>

          {/* Invitation Form */}
          <div className="modal-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  {t('auth.firstName')} *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="form-input"
                  placeholder={t('placeholders.firstNamePlaceholder')}
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  {t('auth.lastName')} *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="form-input"
                  placeholder={t('placeholders.lastNamePlaceholder')}
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {t('auth.email')} *
              </label>
              <div className="input-group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="form-input"
                  placeholder={t('placeholders.emailPlaceholder')}
                  value={formData.email}
                  onChange={handleChange}
                />
                <Mail size={16} className="input-icon input-icon-left" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="customMessage" className="form-label">
                {t('invitations.customMessage')} ({t('common.optional')})
              </label>
              <textarea
                id="customMessage"
                name="customMessage"
                rows={3}
                className="form-textarea"
                placeholder={t('placeholders.customMessagePlaceholder')}
                value={formData.customMessage}
                onChange={handleChange}
              />
            </div>

            {/* Preview */}
            <div className="invitation-preview">
              <h4 className="preview-title">{t('invitations.emailPreview')}</h4>
              <div className="preview-content">
                <p><strong>{t('invitations.subject')}:</strong> {t('invitations.emailSubject', { 
                  partnerName: partner?.partner_name || partner?.company_name,
                  role: t(`roles.${targetRole}`)
                })}</p>
                <p><strong>{t('invitations.recipient')}:</strong> {formData.firstName} {formData.lastName} ({formData.email})</p>
                {formData.customMessage && (
                  <p><strong>{t('invitations.customMessage')}:</strong> {formData.customMessage}</p>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="btn-primary"
                disabled={loading || !formData.email || !formData.firstName || !formData.lastName}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    {t('invitations.sending')}...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {t('invitations.sendInvitation')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendInvitationModal;
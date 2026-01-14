// src/components/invitations/SendInvitationModal.jsx
import { Mail, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, logActivity } from '../../utils/activityLogger';
import logger from '../../utils/logger';
import { toast } from '../common/ToastContainer';

const SendInvitationModal = ({ isOpen, onClose, partner, currentUserRole, onSuccess }) => {
  const { t, language } = useTranslation();
  const { profile } = useAuth();
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

  // Auto-fill partner data when modal opens for superadmin inviting partner admin
  useEffect(() => {
    if (isOpen && isPartnerAdminInvitation && partner) {
      setFormData(prev => ({
        ...prev,
        email: partner.email || '',
        firstName: partner.first_name || '',
        lastName: partner.second_name || ''
      }));
    } else if (isOpen && !isPartnerAdminInvitation) {
      // Reset form for user invitations (customer invitations)
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        customMessage: ''
      });
    }
  }, [isOpen, isPartnerAdminInvitation, partner]);

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
    // Prepare invitation data for email service
    const invitationWithPartner = {
      ...invitation,
      partners: {
        first_name: partner?.first_name,
        second_name: partner?.second_name,
        company_name: partner?.company_name
      }
    };

    logger.log('Sending invitation email:', invitationWithPartner);

    try {
      // MODIFIED: For superadmin inviting partner admin, use customizable template
      if (isPartnerAdminInvitation) {
        const { sendPartnerInvitationEmail } = await import('../../services/partnerInvitationEmailService');

        const adminName = profile?.first_name || profile?.email?.split('@')[0] || 'PowerCowo Team';
        const partnerName = partner?.company_name || `${partner?.first_name} ${partner?.second_name}`;

        const success = await sendPartnerInvitationEmail(
          invitation.invited_email,
          partnerName,
          invitationLink,
          adminName,
          language,
          formData.customMessage // <-- ADD THIS PARAMETER
        );

        return success;
      } else {
        // For customer invitations, use existing OneSignal flow
        const { default: oneSignalEmailService } = await import('../../services/oneSignalEmailService');
        const success = await oneSignalEmailService.sendInvitation(invitationWithPartner, invitationLink);

        return success;
      }
    } catch (error) {
      logger.error('Error with email service:', error);
      logger.log('Fallback - logging invitation details:', {
        to: invitation.invited_email,
        role: invitation.invited_role,
        partner: partner?.company_name || partner?.first_name,
        link: invitationLink,
        message: formData.customMessage
      });
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
        custom_message: formData.customMessage,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        status: 'pending'
      };

      // Only include first_name and last_name for partner admin invitations (superadmin inviting partner)
      if (isPartnerAdminInvitation) {
        invitationData.invited_first_name = formData.firstName;
        invitationData.invited_last_name = formData.lastName;
      }

      const { data, error } = await supabase
        .from('invitations')
        .insert([invitationData])
        .select()
        .single();

      if (error) throw error;

      // Generate invitation link
      const invitationLink = generateInvitationLink(data.invitation_uuid);

      // Send email
      const emailSent = await sendInvitationEmail(data, invitationLink);

      // Log activity
      await logActivity({
        action_category: ACTIVITY_CATEGORIES.USER,
        action_type: ACTIVITY_ACTIONS.SENT,
        entity_id: data.id,
        entity_type: 'invitation',
        description: isPartnerAdminInvitation
          ? `Partner admin invitation sent to ${formData.email} for ${partner?.company_name || partner?.first_name}`
          : `Customer invitation sent to ${formData.email}`,
        metadata: {
          invitation_uuid: data.invitation_uuid,
          invited_email: formData.email,
          invited_role: targetRole,
          invited_name: isPartnerAdminInvitation
            ? `${formData.firstName} ${formData.lastName}`
            : null,
          partner_name: partner?.company_name || `${partner?.first_name} ${partner?.second_name}`,
          partner_uuid: partner.partner_uuid,
          email_sent: emailSent,
          has_custom_message: !!formData.customMessage,
          expires_at: data.expires_at,
          invitation_type: isPartnerAdminInvitation ? 'partner_admin' : 'customer'
        }
      });

      // Show success and close modal
      if (emailSent) {
        toast.success(
          isPartnerAdminInvitation
            ? t('messages.partnerAdminInvitationSent')
            : t('messages.userInvitationSent')
        );
      } else {
        // Use toast.error if toast.warning doesn't exist
        toast.error(
          t('messages.invitationCreatedButEmailFailed') ||
          'Invitation created but email may not have been sent. Please verify.'
        );
      }

      onClose();
      if (onSuccess) onSuccess();

      // Reset form
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        customMessage: ''
      });

    } catch (error) {
      logger.error('Error sending invitation:', error);
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


          {/* Invitation Form */}
          <div className="modal-form">
            {isPartnerAdminInvitation && (
              <div className="auto-fill-notice">
                <p className="auto-fill-text">
                  {t('invitations.partnerInfoAutoFilled')}
                </p>
              </div>
            )}

            {/* Only show Name fields for partner admin invitations (superadmin inviting partner) */}
            {isPartnerAdminInvitation && (
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
                    className="invitation-form-input"
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
                    className="invitation-form-input"
                    placeholder={t('placeholders.lastNamePlaceholder')}
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

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
                  className="invitation-form-input"
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
                className="invitation-form-textarea"
                placeholder={t('placeholders.customMessagePlaceholder')}
                value={formData.customMessage}
                onChange={handleChange}
              />
            </div>



            <div className="modal-actions">

              <button
                type="submit"
                onClick={handleSubmit}
                className="btn-invitation-primary"
                disabled={loading || !formData.email || (isPartnerAdminInvitation && (!formData.firstName || !formData.lastName))}
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
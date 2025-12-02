// src/services/partnerInvitationEmailService.js
import { DEFAULT_EMAIL_TEMPLATES } from '../utils/defaultEmailTemplates';
import logger from '../utils/logger';
import oneSignalEmailService from './oneSignalEmailService';
import { supabase } from './supabase';

const SYSTEM_PARTNER_UUID = '11111111-1111-1111-1111-111111111111';

/**
 * Sends a partner invitation email using the customized template (if exists)
 * or falls back to the default template
 * 
 * @param {string} partnerEmail - Email address of the partner to invite
 * @param {string} partnerName - Name of the partner company
 * @param {string} invitationLink - Activation link for the partner account
 * @param {string} adminName - Name of the admin sending the invitation
 * @param {string} language - Language code ('en' or 'it'), defaults to 'en'
 * @param {string} customMessage - Custom message to include in the email
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 */
export const sendPartnerInvitationEmail = async (
  partnerEmail,
  partnerName,
  invitationLink,
  adminName,
  language = 'en',
  customMessage = ''
) => {
  try {
    // 1. Fetch the customized template (if exists)
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject_line, body_html')
      .eq('partner_uuid', SYSTEM_PARTNER_UUID)
      .eq('template_type', 'partner_invitation')
      .single();

    // 2. Use customized template or fall back to default
    let subject, bodyHtml;
    
    if (template && !templateError) {
      logger.log('Using customized partner invitation template');
      subject = template.subject_line;
      bodyHtml = template.body_html;
    } else {
      logger.log('Using default partner invitation template');
      // Use default from defaultEmailTemplates.js
      const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[language]?.partner_invitation || 
                              DEFAULT_EMAIL_TEMPLATES.en.partner_invitation;
      subject = defaultTemplate.subject;
      bodyHtml = defaultTemplate.body;
    }

    // 3. Replace variables
    const variables = {
      '{{partner_name}}': partnerName,
      '{{partner_email}}': partnerEmail,
      '{{invitation_link}}': invitationLink,
      '{{admin_name}}': adminName,
      '{{custom_message}}': customMessage
    };

    Object.entries(variables).forEach(([variable, value]) => {
      const escapedVariable = variable.replace(/[{}]/g, '\\$&');
      subject = subject.replace(new RegExp(escapedVariable, 'g'), value);
      bodyHtml = bodyHtml.replace(new RegExp(escapedVariable, 'g'), value);
    });

    // 4. Load system banner (if exists)
    let bannerUrl = '';
    try {
      const { data: files } = await supabase.storage
        .from('partners')
        .list(SYSTEM_PARTNER_UUID, { search: 'email_banner' });

      const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));
      if (bannerFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${SYSTEM_PARTNER_UUID}/${bannerFile.name}`);
        bannerUrl = data.publicUrl;
      }
    } catch (bannerError) {
      logger.log('No system banner found or error loading banner:', bannerError);
      // Continue without banner
    }

    // 5. Send email using OneSignal directly (NOT sendTestEmail which adds [TEST])
    logger.log('Sending partner invitation email');

    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    const apiKey = import.meta.env.VITE_ONESIGNAL_API_KEY;
    const uniqueTemplateId = import.meta.env.VITE_ONESIGNAL_UNIQUE_TEMPLATE_ID;

    if (!appId || !apiKey || !uniqueTemplateId) {
      logger.error('OneSignal not configured');
      return false;
    }

    const payload = {
      app_id: appId,
      email_from_name: "PowerCowo",
      email_subject: subject,
      email_from_address: "info@tuttoapposto.info",
      email_reply_to_address: "noreply@proton.me",
      template_id: uniqueTemplateId,
      target_channel: "email",
      include_email_tokens: [partnerEmail],
      custom_data: {
        banner_url: bannerUrl,
        body_html: bodyHtml
      }
    };

    const success = await oneSignalEmailService.sendOneSignalRequest(payload);

    if (success) {
      logger.log('Partner invitation email sent successfully to:', partnerEmail);
    } else {
      logger.error('Failed to send partner invitation email to:', partnerEmail);
    }

    return success;

  } catch (error) {
    logger.error('Error in sendPartnerInvitationEmail:', error);
    return false;
  }
};

/**
 * Gets the preview of the partner invitation template with sample data
 * Useful for testing the template before sending
 * 
 * @param {string} language - Language code ('en' or 'it'), defaults to 'en'
 * @returns {Promise<object>} - Returns { subject, bodyHtml, bannerUrl }
 */
export const getPartnerInvitationPreview = async (language = 'en') => {
  try {
    // Fetch the customized template
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject_line, body_html')
      .eq('partner_uuid', SYSTEM_PARTNER_UUID)
      .eq('template_type', 'partner_invitation')
      .single();

    let subject, bodyHtml;
    
    if (template) {
      subject = template.subject_line;
      bodyHtml = template.body_html;
    } else {
      const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[language]?.partner_invitation || 
                              DEFAULT_EMAIL_TEMPLATES.en.partner_invitation;
      subject = defaultTemplate.subject;
      bodyHtml = defaultTemplate.body;
    }

    // Sample data for preview
    const sampleData = {
      '{{partner_name}}': 'Demo Coworking Space',
      '{{partner_email}}': 'demo@example.com',
      '{{invitation_link}}': 'https://powercowo.com/activate/sample-token',
      '{{admin_name}}': 'John Doe',
      '{{custom_message}}': 'We are excited to have you join our platform!'
    };

    Object.entries(sampleData).forEach(([variable, value]) => {
      const escapedVariable = variable.replace(/[{}]/g, '\\$&');
      subject = subject.replace(new RegExp(escapedVariable, 'g'), value);
      bodyHtml = bodyHtml.replace(new RegExp(escapedVariable, 'g'), value);
    });

    // Load banner
    let bannerUrl = '';
    try {
      const { data: files } = await supabase.storage
        .from('partners')
        .list(SYSTEM_PARTNER_UUID, { search: 'email_banner' });

      const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));
      if (bannerFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${SYSTEM_PARTNER_UUID}/${bannerFile.name}`);
        bannerUrl = data.publicUrl;
      }
    } catch (error) {
      logger.log('No system banner found');
    }

    return { subject, bodyHtml, bannerUrl };

  } catch (error) {
    logger.error('Error getting partner invitation preview:', error);
    return null;
  }
};

export default {
  sendPartnerInvitationEmail,
  getPartnerInvitationPreview,
  SYSTEM_PARTNER_UUID
};
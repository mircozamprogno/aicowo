// src/services/partnerInvitationEmailService.js
import { DEFAULT_EMAIL_TEMPLATES } from '../utils/defaultEmailTemplates';
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
 * @returns {Promise<boolean>} - Returns true if email sent successfully
 */
export const sendPartnerInvitationEmail = async (
  partnerEmail,
  partnerName,
  invitationLink,
  adminName,
  language = 'en'
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
      console.log('Using customized partner invitation template');
      subject = template.subject_line;
      bodyHtml = template.body_html;
    } else {
      console.log('Using default partner invitation template');
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
      '{{admin_name}}': adminName
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
      console.log('No system banner found or error loading banner:', bannerError);
      // Continue without banner
    }

    // 5. Send email using OneSignal
    // The sendTestEmail method sends an email with banner and body
    // Subject is embedded in the body HTML as a title or we can prepend it
    
    // Option 1: Try to use sendTestEmail (used in EmailTemplateEditor)
    let success = false;
    
    if (typeof oneSignalEmailService.sendTestEmail === 'function') {
      console.log('Sending partner invitation using sendTestEmail method');
      success = await oneSignalEmailService.sendTestEmail(
        partnerEmail,
        bannerUrl,
        bodyHtml
      );
    } 
    // Option 2: Try to use sendInvitation (used in existing SendInvitationModal)
    else if (typeof oneSignalEmailService.sendInvitation === 'function') {
      console.log('Sending partner invitation using sendInvitation method');
      
      // Format data similar to how existing invitations work
      const invitationData = {
        invited_email: partnerEmail,
        invited_role: 'admin',
        partners: {
          company_name: partnerName
        }
      };
      
      success = await oneSignalEmailService.sendInvitation(invitationData, invitationLink);
    }
    // Option 3: Fallback - log the email details
    else {
      console.warn('No suitable OneSignal email method found');
      console.log('Partner invitation email details:', {
        to: partnerEmail,
        subject: subject,
        bannerUrl: bannerUrl,
        bodyPreview: bodyHtml.substring(0, 200) + '...',
        invitationLink: invitationLink
      });
      
      // Return false to indicate email wasn't sent
      return false;
    }

    if (success) {
      console.log('Partner invitation email sent successfully to:', partnerEmail);
    } else {
      console.error('Failed to send partner invitation email to:', partnerEmail);
    }

    return success;

  } catch (error) {
    console.error('Error in sendPartnerInvitationEmail:', error);
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
      '{{admin_name}}': 'John Doe'
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
      console.log('No system banner found');
    }

    return { subject, bodyHtml, bannerUrl };

  } catch (error) {
    console.error('Error getting partner invitation preview:', error);
    return null;
  }
};

export default {
  sendPartnerInvitationEmail,
  getPartnerInvitationPreview,
  SYSTEM_PARTNER_UUID
};
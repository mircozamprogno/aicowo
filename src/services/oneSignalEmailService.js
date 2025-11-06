// OneSignal Email Service for sending invitations and booking confirmations

class OneSignalEmailService {
  constructor() {
    // Get OneSignal configuration from environment variables
    this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    this.apiKey = import.meta.env.VITE_ONESIGNAL_API_KEY;
    this.adminTemplateId = import.meta.env.VITE_ONESIGNAL_ADMIN_TEMPLATE_ID;
    this.userTemplateId = import.meta.env.VITE_ONESIGNAL_USER_TEMPLATE_ID;
    this.customerBookingTemplateId = import.meta.env.VITE_ONESIGNAL_CUSTOMER_BOOKING_TEMPLATE_ID;
    this.partnerBookingTemplateId = import.meta.env.VITE_ONESIGNAL_PARTNER_BOOKING_TEMPLATE_ID;
    this.uniqueTemplateId = import.meta.env.VITE_ONESIGNAL_UNIQUE_TEMPLATE_ID;
    this.useOneSignal = import.meta.env.VITE_USE_ONESIGNAL === 'true';
    
    // OneSignal API endpoint
    this.apiEndpoint = 'https://onesignal.com/api/v1/notifications';
    
    // Check if OneSignal is configured for invitations
    this.isConfigured = !!(this.appId && this.apiKey && this.adminTemplateId && this.userTemplateId && this.useOneSignal);
    
    // Check if booking templates are configured
    this.isBookingConfigured = !!(this.isConfigured && this.customerBookingTemplateId && this.partnerBookingTemplateId);
    
    if (!this.isConfigured) {
      console.warn('OneSignal email service not configured. Check your .env.local file.');
      console.log('Required variables:', {
        VITE_ONESIGNAL_APP_ID: !!this.appId,
        VITE_ONESIGNAL_API_KEY: !!this.apiKey,
        VITE_ONESIGNAL_ADMIN_TEMPLATE_ID: !!this.adminTemplateId,
        VITE_ONESIGNAL_USER_TEMPLATE_ID: !!this.userTemplateId,
        VITE_USE_ONESIGNAL: this.useOneSignal
      });
    }

    if (!this.isBookingConfigured) {
      console.warn('OneSignal booking templates not configured. Check your .env.local file.');
      console.log('Booking template variables:', {
        VITE_ONESIGNAL_CUSTOMER_BOOKING_TEMPLATE_ID: !!this.customerBookingTemplateId,
        VITE_ONESIGNAL_PARTNER_BOOKING_TEMPLATE_ID: !!this.partnerBookingTemplateId
      });
    }
  }

/**
 * Send invitation email via OneSignal
 * @param {Object} invitationData - The invitation data
 * @param {string} invitationLink - The invitation registration link
 * @returns {Promise<boolean>} - Success status
 */
async sendInvitation(invitationData, invitationLink) {
  if (!this.isConfigured) {
    console.error('OneSignal email service not configured');
    this.logEmailDetails(invitationData, invitationLink);
    return false;
  }

  try {
    // For user invitations, use unique template with custom body
    if (invitationData.invited_role === 'user') {
      return await this.sendCustomerInvitation(invitationData, invitationLink);
    }

    // For admin invitations, keep legacy system (for now)
    const templateId = this.adminTemplateId;
    const partnerName = invitationData.partners?.company_name ||
                       (invitationData.partners?.first_name && invitationData.partners?.second_name 
                         ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                         : invitationData.partners?.first_name || 'the partner');
    
    const firstName = invitationData.invited_first_name || 'User';
    const lastName = invitationData.invited_last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const userUUID = invitationData.partner_uuid;
    const emailSubject = `Invito a unirti a ${partnerName}`;

    const payload = {
      app_id: this.appId,
      email_from_name: "PowerCowo",
      email_subject: emailSubject,
      email_from_address: "info@tuttoapposto.info",
      email_reply_to_address: "noreply@proton.me",
      template_id: templateId,
      target_channel: "email",
      include_email_tokens: [invitationData.invited_email],
      include_aliases: {
        external_id: [userUUID]
      },
      custom_data: {
        partner_name: partnerName,
        link_contract: invitationLink,
        personal_msg: invitationData.custom_message || ''
      }
    };

    console.log('Sending admin invitation with legacy template:', payload);
    return await this.sendOneSignalRequest(payload);
  } catch (error) {
    console.error('Error in sendInvitation:', error);
    return false;
  }
}

/**
 * Send customer invitation using unique template with custom body
 * @param {Object} invitationData - The invitation data
 * @param {string} invitationLink - The invitation registration link
 * @returns {Promise<boolean>} - Success status
 */
async sendCustomerInvitation(invitationData, invitationLink) {
  if (!this.uniqueTemplateId) {
    console.error('Unique template ID not configured');
    return false;
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { supabase } = await import('./supabase');
    const { DEFAULT_EMAIL_TEMPLATES } = await import('../utils/defaultEmailTemplates');

    // Fetch partner data for email settings
    const { data: partnerData, error: partnerError } = await supabase
      .from('partners')
      .select('company_name, email')
      .eq('partner_uuid', invitationData.partner_uuid)
      .single();

    if (partnerError || !partnerData) {
      console.error('Error fetching partner data:', partnerError);
      return false;
    }

    // Fetch custom template from database
    const { data: templateData, error: templateError } = await supabase
      .from('email_templates')
      .select('body_html')
      .eq('partner_uuid', invitationData.partner_uuid)
      .eq('template_type', 'customer_invitation')
      .single();

    // Use custom template or fallback to default
    let bodyHtml;
    if (templateData && !templateError) {
      bodyHtml = templateData.body_html;
      console.log('Using custom customer_invitation template');
    } else {
      // Fallback to default template (assuming language is 'it')
      const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.it?.customer_invitation || 
                             DEFAULT_EMAIL_TEMPLATES.en?.customer_invitation;
      bodyHtml = defaultTemplate?.body || '<p>Welcome!</p>';
      console.log('Using default customer_invitation template');
    }

    // Replace variables with actual data
    const partnerName = partnerData.company_name || 
                       invitationData.partners?.company_name ||
                       (invitationData.partners?.first_name && invitationData.partners?.second_name 
                         ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                         : invitationData.partners?.first_name || 'Partner');
    
    bodyHtml = bodyHtml.replace(/\{\{partner_name\}\}/g, partnerName);
    bodyHtml = bodyHtml.replace(/\{\{invitation_link\}\}/g, invitationLink);
    bodyHtml = bodyHtml.replace(/\{\{custom_message\}\}/g, invitationData.custom_message || '');

    // Fetch banner URL
    const { data: files } = await supabase.storage
      .from('partners')
      .list(`${invitationData.partner_uuid}`, { search: 'email_banner' });

    const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));
    let bannerUrl = '';
    
    if (bannerFile) {
      const { data } = supabase.storage
        .from('partners')
        .getPublicUrl(`${invitationData.partner_uuid}/${bannerFile.name}`);
      bannerUrl = data.publicUrl;
    }

    // Send using unique template with partner email settings
    const emailSubject = `Invito a unirti a ${partnerName}`;

    const payload = {
      app_id: this.appId,
      email_from_name: partnerData.company_name || partnerName,
      email_subject: emailSubject,
      email_from_address: "info@tuttoapposto.info",
      email_reply_to_address: "noreply@proton.me",
      template_id: this.uniqueTemplateId,
      target_channel: "email",
      include_email_tokens: [invitationData.invited_email],
      include_aliases: {
        external_id: [invitationData.partner_uuid]
      },
      custom_data: {
        banner_url: bannerUrl,
        body_html: bodyHtml
      }
    };

    console.log('Sending customer invitation with unique template:', {
      email: invitationData.invited_email,
      fromName: partnerData.company_name,
      fromEmail: partnerData.email,
      bannerUrl,
      bodyLength: bodyHtml.length
    });

    return await this.sendOneSignalRequest(payload);
  } catch (error) {
    console.error('Error sending customer invitation:', error);
    return false;
  }
}

  /**
   * Send booking confirmation emails to both customer and partner
   * @param {Object} bookingData - The booking/reservation data
   * @param {Object} contractData - The contract data
   * @param {Function} t - Translation function
   * @param {Object} partnerData - Partner data (optional, for partner email)
   * @returns {Promise<{customerSuccess: boolean, partnerSuccess: boolean}>} - Success status for both emails
   */
  async sendBookingConfirmation(bookingData, contractData, t, partnerData = null) {
    if (!this.isBookingConfigured) {
      console.error('OneSignal booking templates not configured');
      // In development, log the booking email details
      this.logBookingEmailDetails(bookingData, contractData, t);
      return { customerSuccess: false, partnerSuccess: false };
    }

    try {
      // Prepare booking confirmation data
      const bookingConfirmationData = this.prepareBookingData(bookingData, contractData, t);

      // Send customer confirmation
      const customerSuccess = await this.sendCustomerBookingConfirmation(
        contractData.customers.email,
        bookingConfirmationData,
        contractData
      );

      // Send partner notification
      const partnerSuccess = await this.sendPartnerBookingNotification(
        bookingConfirmationData,
        contractData,
        partnerData
      );

      return { customerSuccess, partnerSuccess };
    } catch (error) {
      console.error('Error sending booking confirmations:', error);
      return { customerSuccess: false, partnerSuccess: false };
    }
  }

  /**
   * Send booking confirmation to customer
   * @param {string} customerEmail - Customer email address
   * @param {Object} bookingData - Prepared booking data
   * @param {Object} contractData - Contract data
   * @returns {Promise<boolean>} - Success status
   */
  async sendCustomerBookingConfirmation(customerEmail, bookingData, contractData) {
    try {
      // Create email subject
      const emailSubject = `Conferma prenotazione - ${contractData.service_name}`;

      const payload = {
        app_id: this.appId,
        email_from_name: "PowerCowo",
        email_subject: emailSubject,
        email_from_address: "info@tuttoapposto.info",
        email_reply_to_address: "noreply@proton.me",
        template_id: this.customerBookingTemplateId,
        target_channel: "email",
        include_email_tokens: [customerEmail],
        include_aliases: {
          external_id: [contractData.customer_id?.toString()]
        },
        custom_data: {
          customer_name: bookingData.customer_name,
          booking_date: bookingData.booking_date,
          resource: bookingData.resource,
          remaining_count: bookingData.remaining_count
        }
      };

      console.log('Sending customer booking confirmation:', {
        email: customerEmail,
        templateId: this.customerBookingTemplateId,
        customData: payload.custom_data
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      console.error('Error sending customer booking confirmation:', error);
      return false;
    }
  }

  /**
   * Send booking notification to partner
   * @param {Object} bookingData - Prepared booking data
   * @param {Object} contractData - Contract data
   * @param {Object} partnerData - Partner data (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async sendPartnerBookingNotification(bookingData, contractData, partnerData = null) {
    try {
      // Get partner email - only check the 'email' field since contact_email doesn't exist
      let partnerEmail = partnerData?.email;
      
      if (!partnerEmail) {
        console.warn('Partner email not available for booking notification. Partner data:', partnerData);
        return false;
      }

      // Create email subject
      const emailSubject = `Nuova prenotazione - ${bookingData.customer_name}`;

      const payload = {
        app_id: this.appId,
        email_from_name: "PowerCowo",
        email_subject: emailSubject,
        email_from_address: "info@tuttoapposto.info",
        email_reply_to_address: "noreply@proton.me",
        template_id: this.partnerBookingTemplateId,
        target_channel: "email",
        include_email_tokens: [partnerEmail],
        include_aliases: {
          external_id: [contractData.partner_uuid]
        },
        custom_data: {
          customer_name: bookingData.customer_name,
          booking_date: bookingData.booking_date,
          resource: bookingData.resource,
          remaining_count: bookingData.remaining_count
        }
      };

      console.log('Sending partner booking notification:', {
        email: partnerEmail,
        templateId: this.partnerBookingTemplateId,
        customData: payload.custom_data
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      console.error('Error sending partner booking notification:', error);
      return false;
    }
  }

  /**
   * Prepare booking data for templates
   * @param {Object} bookingData - Raw booking data
   * @param {Object} contractData - Contract data
   * @param {Function} t - Translation function
   * @returns {Object} - Prepared booking data
   */
  prepareBookingData(bookingData, contractData, t) {
    // Prepare customer name
    const customerName = `${contractData.customers.first_name} ${contractData.customers.second_name}`.trim();

    // Format booking date (assuming bookingData has the reservation date)
    const bookingDate = this.formatBookingDate(bookingData.reservation_date || bookingData.date);

    // Translate resource type
    const resourceTypeNames = {
      'scrivania': t('locations.scrivania'),
      'sala_riunioni': t('locations.salaRiunioni')
    };
    const resource = resourceTypeNames[contractData.resource_type] || contractData.resource_name || t('services.resource');

    // Calculate remaining entries after this booking
    const entriesUsedAfterBooking = (contractData.entries_used || 0) + (bookingData.entries_consumed || 1);
    const remainingCount = (contractData.service_max_entries || 0) - entriesUsedAfterBooking;

    return {
      customer_name: customerName,
      booking_date: bookingDate,
      resource: resource,
      remaining_count: Math.max(0, remainingCount) // Ensure non-negative
    };
  }

  /**
   * Format booking date for display
   * @param {string|Date} date - Booking date
   * @returns {string} - Formatted date
   */
  formatBookingDate(date) {
    if (!date) return '';
    
    try {
      return new Date(date).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting booking date:', error);
      return date.toString();
    }
  }

  /**
   * Send notification via OneSignal API (extracted for reuse)
   * @param {Object} payload - OneSignal notification payload
   * @returns {Promise<boolean>} - Success status
   */
  async sendOneSignalRequest(payload) {
    try {
      // Check if we should use a backend proxy
      const useProxy = import.meta.env.VITE_ONESIGNAL_PROXY_URL;
      const apiUrl = useProxy || this.apiEndpoint;
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add authorization header differently based on proxy or direct
      if (useProxy) {
        // If using proxy, send API key in custom header
        headers['X-OneSignal-API-Key'] = this.apiKey;
      } else {
        // Direct to OneSignal
        headers['Authorization'] = `Basic ${this.apiKey}`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        console.error('OneSignal API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        // If blocked by client, suggest solutions
        if (response.status === 0 || errorText.includes('ERR_BLOCKED_BY_CLIENT')) {
          console.error('OneSignal request blocked. Solutions:');
          console.error('1. Disable ad blocker for localhost');
          console.error('2. Add onesignal.com to whitelist');
          console.error('3. Use a backend proxy (set VITE_ONESIGNAL_PROXY_URL)');
        }
        
        return false;
      }

      const result = await response.json();
      console.log('OneSignal notification sent successfully:', result);
      
      // Check if notification was created successfully
      const success = !!(result.id);
      console.log('OneSignal success check:', { id: result.id, success });
      
      return success;
    } catch (error) {
      console.error('OneSignal API request failed:', error);
      
      // Provide helpful error messages
      if (error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.error('Request blocked by browser security. Try:');
        console.error('1. Disable ad blocker/security extensions');
        console.error('2. Use incognito/private mode');
        console.error('3. Set up a backend proxy');
      }
      
      return false;
    }
  }

  /**
   * Send notification via OneSignal API (legacy method for invitations)
   * @param {Object} params - Notification parameters
   * @returns {Promise<boolean>} - Success status
   */
  async sendOneSignalNotification({ email, templateId, substitutions, invitationData }) {
    try {
      // Prepare the exact JSON structure for invitations
      const partnerName = invitationData.partners?.first_name && invitationData.partners?.second_name 
                         ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                         : invitationData.partners?.first_name || 
                           invitationData.partners?.company_name || 
                           'the partner';
      
      const firstName = invitationData.invited_first_name || 'User';
      const lastName = invitationData.invited_last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // For userUUID: use partner_uuid for admin invitations, could be user-specific for users
      const userUUID = invitationData.partner_uuid;
      
      // Create email subject with actual partner name
      const emailSubject = `Invito a unirti a ${partnerName}`;

      const payload = {
        app_id: this.appId,
        email_from_name: "PowerCowo",
        email_subject: emailSubject,
        email_from_address: "info@tuttoapposto.info",
        email_reply_to_address: "noreply@proton.me",
        template_id: templateId,
        target_channel: "email",
        include_email_tokens: [email],
        include_aliases: {
          external_id: [userUUID]
        },
        custom_data: {
          // For admin invitations use "partner_name", for user invitations use "user_name"
          ...(invitationData.invited_role === 'admin' 
            ? { partner_name: partnerName }
            : { user_name: fullName }
          ),
          link_contract: substitutions.invitation_link,
          personal_msg: invitationData.custom_message || ''
        }
      };

      console.log('Sending OneSignal notification with payload:', {
        email,
        templateId,
        role: invitationData.invited_role,
        userUUID,
        emailSubject,
        partnerName,
        customData: payload.custom_data
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      console.error('Error in sendOneSignalNotification:', error);
      return false;
    }
  }

  /**
   * Prepare template substitutions for OneSignal templates
   * @param {Object} invitationData - Invitation data
   * @param {string} invitationLink - Registration link
   * @returns {Object} - Template substitutions
   */
  prepareTemplateSubstitutions(invitationData, invitationLink) {
    // Return the invitation link for use in the payload
    return {
      invitation_link: invitationLink
    };
  }


  /**
   * Send test email using unique template
   * @param {string} recipientEmail - Recipient email
   * @param {string} bannerUrl - Banner URL
   * @param {string} bodyHtml - HTML body content
   * @returns {Promise<boolean>} - Success status
   */
  async sendTestEmail(recipientEmail, bannerUrl, bodyHtml) {
    if (!this.isConfigured || !this.uniqueTemplateId) {
      console.error('OneSignal unique template not configured');
      console.log('Config check:', {
        isConfigured: this.isConfigured,
        uniqueTemplateId: this.uniqueTemplateId,
        appId: this.appId,
        apiKey: this.apiKey ? 'SET' : 'NOT SET'
      });
      return false;
    }

    try {
      const payload = {
        app_id: this.appId,
        email_from_name: "PowerCowo",
        email_subject: "Test Email - Template Preview",
        email_from_address: "info@tuttoapposto.info",
        email_reply_to_address: "noreply@proton.me",
        template_id: this.uniqueTemplateId,
        target_channel: "email",
        include_email_tokens: [recipientEmail],
        custom_data: {
          banner_url: bannerUrl || '',
          body_html: bodyHtml
        }
      };

      // DEBUG: Log complete payload
      console.log('=== ONESIGNAL TEST EMAIL PAYLOAD ===');
      console.log('Full JSON payload:', JSON.stringify(payload, null, 2));
      console.log('Banner URL:', bannerUrl);
      console.log('Body HTML length:', bodyHtml?.length);
      console.log('Body HTML preview:', bodyHtml?.substring(0, 200));
      console.log('====================================');

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      console.error('Error sending test email:', error);
      return false;
    }
  }

  /**
   * Create a OneSignal user for email tracking (optional)
   * @param {string} email - User email
   * @param {Object} userData - Additional user data
   * @returns {Promise<boolean>} - Success status
   */
  async createOneSignalUser(email, userData = {}) {
    try {
      const payload = {
        app_id: this.appId,
        device_type: 11, // Email device type
        identifier: email,
        tags: {
          email: email,
          user_type: userData.role || 'user',
          partner_name: userData.partnerName || '',
          created_via: 'invitation_system',
          ...userData.tags
        }
      };

      const response = await fetch('https://onesignal.com/api/v1/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn('Failed to create OneSignal user:', response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('OneSignal user created:', result);
      return true;
    } catch (error) {
      console.warn('Error creating OneSignal user:', error);
      return false;
    }
  }

  /**
   * Log email details for development (invitations)
   */
  logEmailDetails(invitationData, invitationLink) {
    const partnerName = invitationData.partners?.first_name && invitationData.partners?.second_name 
                       ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                       : invitationData.partners?.first_name || 
                         invitationData.partners?.company_name || 
                         'the partner';
    
    // Create email subject with actual partner name  
    const emailSubject = `Invito a unirti a ${partnerName}`;
    
    console.log('=== ONESIGNAL EMAIL WOULD BE SENT ===');
    console.log('To:', invitationData.invited_email);
    console.log('Subject:', emailSubject);
    console.log('Template:', invitationData.invited_role === 'admin' ? 'Admin Template' : 'User Template');
    console.log('Template ID:', invitationData.invited_role === 'admin' ? this.adminTemplateId : this.userTemplateId);
    console.log('Link:', invitationLink);
    console.log('Partner:', partnerName);
    console.log('Role:', invitationData.invited_role);
    console.log('Custom Message:', invitationData.custom_message || 'None');
    console.log('========================================');
  }

  /**
   * Log booking email details for development
   */
  logBookingEmailDetails(bookingData, contractData, t) {
    const preparedData = this.prepareBookingData(bookingData, contractData, t);
    
    console.log('=== BOOKING CONFIRMATION EMAILS WOULD BE SENT ===');
    console.log('Customer Email:', contractData.customers.email);
    console.log('Customer Template ID:', this.customerBookingTemplateId);
    console.log('Partner Template ID:', this.partnerBookingTemplateId);
    console.log('Booking Data:', preparedData);
    console.log('Contract:', contractData.contract_number);
    console.log('Service:', contractData.service_name);
    console.log('================================================');
  }

  /**
   * Test OneSignal configuration
   * @returns {Promise<boolean>} - Configuration test result
   */
  async testConfiguration() {
    if (!this.isConfigured) {
      console.error('OneSignal not configured');
      return false;
    }

    try {
      // Test API connection by getting app info
      const response = await fetch(`https://onesignal.com/api/v1/apps/${this.appId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.apiKey}`
        }
      });

      if (!response.ok) {
        console.error('OneSignal configuration test failed:', response.statusText);
        return false;
      }

      const appInfo = await response.json();
      console.log('OneSignal configuration test successful:', {
        appName: appInfo.name,
        appId: this.appId,
        bookingTemplatesConfigured: this.isBookingConfigured
      });
      return true;
    } catch (error) {
      console.error('OneSignal configuration test error:', error);
      return false;
    }
  }
}


// Export singleton instance
export const oneSignalEmailService = new OneSignalEmailService();
export default oneSignalEmailService;
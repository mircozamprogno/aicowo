// OneSignal Email Service for sending invitations

class OneSignalEmailService {
  constructor() {
    // Get OneSignal configuration from environment variables
    this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    this.apiKey = import.meta.env.VITE_ONESIGNAL_API_KEY;
    this.adminTemplateId = import.meta.env.VITE_ONESIGNAL_ADMIN_TEMPLATE_ID;
    this.userTemplateId = import.meta.env.VITE_ONESIGNAL_USER_TEMPLATE_ID;
    this.useOneSignal = import.meta.env.VITE_USE_ONESIGNAL === 'true';
    
    // OneSignal API endpoint
    this.apiEndpoint = 'https://onesignal.com/api/v1/notifications';
    
    // Check if OneSignal is configured
    this.isConfigured = !!(this.appId && this.apiKey && this.adminTemplateId && this.userTemplateId && this.useOneSignal);
    
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
      // In development, just log the email details
      this.logEmailDetails(invitationData, invitationLink);
      return false;
    }

    try {
      // Determine which template to use based on role
      const templateId = invitationData.invited_role === 'admin' 
        ? this.adminTemplateId 
        : this.userTemplateId;

      // Prepare template substitutions
      const templateSubstitutions = this.prepareTemplateSubstitutions(invitationData, invitationLink);

      // Send notification via OneSignal
      const success = await this.sendOneSignalNotification({
        email: invitationData.invited_email,
        templateId: templateId,
        substitutions: templateSubstitutions,
        invitationData: invitationData
      });

      return success;
    } catch (error) {
      console.error('Error sending invitation via OneSignal:', error);
      return false;
    }
  }

  /**
   * Send notification via OneSignal API
   * @param {Object} params - Notification parameters
   * @returns {Promise<boolean>} - Success status
   */
  async sendOneSignalNotification({ email, templateId, substitutions, invitationData }) {
    try {
      // Prepare the exact JSON structure you specified
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
      
      // FIXED: Create proper email subject without role variable
      const emailSubject = `Invitation to join ${partnerName}`;

      const payload = {
        app_id: this.appId,
        email_from_name: "PowerCowo",
        email_subject: emailSubject, // ← FIXED: No more template variables
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
          link_contract: substitutions.invitation_link
        }
      };

      console.log('Sending OneSignal notification with payload:', {
        email,
        templateId,
        role: invitationData.invited_role,
        userUUID,
        emailSubject, // ← FIXED: Log the actual subject being sent
        partnerName, // ← FIXED: Log the actual partner name
        customData: payload.custom_data
      });

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
      // OneSignal returns an ID if successful, recipients might be 0 for email
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
   * Log email details for development
   */
  logEmailDetails(invitationData, invitationLink) {
    const partnerName = invitationData.partners?.first_name && invitationData.partners?.second_name 
                       ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                       : invitationData.partners?.first_name || 
                         invitationData.partners?.company_name || 
                         'the partner';
    
    // FIXED: Log the corrected email subject
    const emailSubject = `Invitation to join ${partnerName}`;
    
    console.log('=== ONESIGNAL EMAIL WOULD BE SENT ===');
    console.log('To:', invitationData.invited_email);
    console.log('Subject:', emailSubject); // ← FIXED: Show actual subject
    console.log('Template:', invitationData.invited_role === 'admin' ? 'Admin Template' : 'User Template');
    console.log('Template ID:', invitationData.invited_role === 'admin' ? this.adminTemplateId : this.userTemplateId);
    console.log('Link:', invitationLink);
    console.log('Partner:', partnerName); // ← FIXED: Show actual partner name
    console.log('Role:', invitationData.invited_role);
    console.log('Custom Message:', invitationData.custom_message || 'None');
    console.log('========================================');
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
        appId: this.appId
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
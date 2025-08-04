// Email service for sending invitations

class EmailService {
  constructor() {
    // Get email configuration from environment variables
    this.smtpHost = import.meta.env.VITE_SMTP_HOST;
    this.smtpPort = import.meta.env.VITE_SMTP_PORT || 587;
    this.smtpUser = import.meta.env.VITE_SMTP_USER;
    this.smtpPassword = import.meta.env.VITE_SMTP_PASSWORD;
    this.fromEmail = import.meta.env.VITE_FROM_EMAIL;
    this.fromName = import.meta.env.VITE_FROM_NAME || 'PowerCowo';
    
    // Check if email is configured
    this.isConfigured = !!(this.smtpHost && this.smtpUser && this.smtpPassword && this.fromEmail);
    
    if (!this.isConfigured) {
      console.warn('Email service not configured. Check your .env.local file.');
    }
  }

  /**
   * Send invitation email
   * @param {Object} invitationData - The invitation data
   * @param {string} invitationLink - The invitation registration link
   * @returns {Promise<boolean>} - Success status
   */
  async sendInvitation(invitationData, invitationLink) {
    if (!this.isConfigured) {
      console.error('Email service not configured');
      // In development, just log the email details
      this.logEmailDetails(invitationData, invitationLink);
      return false;
    }

    try {
      // Prepare email content
      const emailSubject = this.generateSubject(invitationData);
      const emailHtml = this.generateEmailHtml(invitationData, invitationLink);
      const emailText = this.generateEmailText(invitationData, invitationLink);

      // Send email using your preferred method
      const success = await this.sendEmail({
        to: invitationData.invited_email,
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      });

      return success;
    } catch (error) {
      console.error('Error sending invitation email:', error);
      return false;
    }
  }

  /**
   * Send email using SMTP or email service
   * @param {Object} emailData - Email data
   * @returns {Promise<boolean>} - Success status
   */
  async sendEmail({ to, subject, html, text }) {
    // Option 1: Use a service like EmailJS (client-side)
    if (import.meta.env.VITE_USE_EMAILJS === 'true') {
      return await this.sendWithEmailJS({ to, subject, html, text });
    }

    // Option 2: Use your backend API endpoint
    if (import.meta.env.VITE_EMAIL_API_ENDPOINT) {
      return await this.sendWithAPI({ to, subject, html, text });
    }

    // Option 3: Log email for development
    console.log('Email would be sent:', { to, subject, html, text });
    return true;
  }

  /**
   * Send email using EmailJS (client-side service)
   */
  async sendWithEmailJS({ to, subject, html, text }) {
    try {
      // You need to install emailjs: npm install @emailjs/browser
      // import emailjs from '@emailjs/browser';
      
      // const response = await emailjs.send(
      //   import.meta.env.VITE_EMAILJS_SERVICE_ID,
      //   import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      //   {
      //     to_email: to,
      //     subject: subject,
      //     message: html,
      //     from_name: this.fromName,
      //     from_email: this.fromEmail
      //   },
      //   import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      // );
      
      console.log('EmailJS not implemented yet');
      return false;
    } catch (error) {
      console.error('EmailJS error:', error);
      return false;
    }
  }

  /**
   * Send email using backend API
   */
  async sendWithAPI({ to, subject, html, text }) {
    try {
      const response = await fetch(import.meta.env.VITE_EMAIL_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_EMAIL_API_KEY || ''}`
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          text,
          from: {
            email: this.fromEmail,
            name: this.fromName
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Email API error: ${response.status}`);
      }

      const result = await response.json();
      return result.success || true;
    } catch (error) {
      console.error('Email API error:', error);
      return false;
    }
  }

  /**
   * Generate email subject
   */
  generateSubject(invitationData) {
    const partnerName = invitationData.partners?.first_name && invitationData.partners?.second_name 
                       ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                       : invitationData.partners?.first_name || 
                         invitationData.partners?.company_name || 
                         'the partner';
    const role = invitationData.invited_role === 'admin' ? 'Administrator' : 'User';
    return `Invitation to join ${partnerName} as ${role}`;
  }

  /**
   * Generate HTML email content
   */
  generateEmailHtml(invitationData, invitationLink) {
    const partnerName = invitationData.partners?.first_name && invitationData.partners?.second_name 
                       ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                       : invitationData.partners?.first_name || 
                         invitationData.partners?.company_name || 
                         'the partner';
    const role = invitationData.invited_role === 'admin' ? 'Administrator' : 'User';
    const firstName = invitationData.invited_first_name || 'there';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to ${partnerName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏢 PowerCowo</h1>
            <p>Coworking Management Platform</p>
          </div>
          <div class="content">
            <h2>Hello ${firstName}!</h2>
            <p>You've been invited to join <strong>${partnerName}</strong> as a <strong>${role}</strong> on PowerCowo.</p>
            
            ${invitationData.custom_message ? `
              <div style="background: white; padding: 15px; border-left: 4px solid #4f46e5; margin: 20px 0;">
                <p><strong>Personal message:</strong></p>
                <p style="font-style: italic;">${invitationData.custom_message}</p>
              </div>
            ` : ''}
            
            <p>To complete your registration and start using the platform, please click the button below:</p>
            
            <a href="${invitationLink}" class="button">Complete Registration</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; font-family: monospace;">${invitationLink}</p>
            
            <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>This invitation was sent by PowerCowo. If you weren't expecting this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   */
  generateEmailText(invitationData, invitationLink) {
    const partnerName = invitationData.partners?.first_name && invitationData.partners?.second_name 
                       ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                       : invitationData.partners?.first_name || 
                         invitationData.partners?.company_name || 
                         'the partner';
    const role = invitationData.invited_role === 'admin' ? 'Administrator' : 'User';
    const firstName = invitationData.invited_first_name || 'there';

    return `
Hello ${firstName}!

You've been invited to join ${partnerName} as a ${role} on PowerCowo.

${invitationData.custom_message ? `Personal message: ${invitationData.custom_message}\n\n` : ''}

To complete your registration, please visit this link:
${invitationLink}

Note: This invitation will expire in 7 days.

---
PowerCowo - Coworking Management Platform

If you weren't expecting this invitation, you can safely ignore this email.
    `.trim();
  }

  /**
   * Log email details for development
   */
  logEmailDetails(invitationData, invitationLink) {
    console.log('=== EMAIL WOULD BE SENT ===');
    console.log('To:', invitationData.invited_email);
    console.log('Subject:', this.generateSubject(invitationData));
    console.log('Link:', invitationLink);
    console.log('Partner:', invitationData.partners?.first_name && invitationData.partners?.second_name 
                           ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
                           : invitationData.partners?.first_name || invitationData.partners?.company_name);
    console.log('Role:', invitationData.invited_role);
    console.log('Custom Message:', invitationData.custom_message || 'None');
    console.log('========================');
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
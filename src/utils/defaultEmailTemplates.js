// src/utils/defaultEmailTemplates.js
// Default email templates for EN and IT
// These are used when a partner hasn't customized their templates yet

export const DEFAULT_EMAIL_TEMPLATES = {
  en: {
    customer_invitation: {
      subject: 'Invito a unirti a {{partner_name}}',
      body: `<h2><span style="font-size: 16px; font-weight: 400;">Gentile Cliente, 
      <br>{{partner_name}} ti da' il benvenuto.&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">{{custom_message}}&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">Per iniziare a utilizzare i nostri spazi, registrati sul portale.</span></h2>
      <h2><a href="{{invitation_link}}">Completa la registrazione</a></h2>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><i><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Lo Staff&nbsp;</span><span style="color: rgb(17, 24, 39); font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_name}}</span>
      <span style="color: rgb(17, 24, 39); font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">&nbsp;&nbsp;</span></i></p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">-&nbsp;</span></p><p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
      <span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Ricevi questa email perché hai ricevuto un invito da un nostro partner.<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp; -&nbsp;</span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Your company name' },
        { name: '{{structure_name}}', description: 'Your structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{invitation_link}}', description: 'Registration link' },
        { name: '{{custom_message}}', description: 'Your personal message' }
      ]
    },

    confirmation_email: {
      subject: 'Confirm your email address - {{partner_name}}',
      body: `<h2><span style="font-size: 16px; font-weight: 400;">Dear Customer, 
      <br>{{partner_name}} welcomes you.&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">To complete your registration, please confirm your email address.</span></h2>
      <h2><a href="{{confirmation_link}}">Confirm Email</a></h2>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><i><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">The Staff&nbsp;</span><span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_name}}</span>
      <span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">&nbsp;&nbsp;</span></i></p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">-&nbsp;</span></p><p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
      <span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">You are receiving this email to confirm your account.<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;"><b>⚡️ PowerCowo</b>&nbsp; -&nbsp;</span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">MLM Media Logistic Management GmbH<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{confirmation_link}}', description: 'Email confirmation link' },
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{user_email}}', description: 'User email' }
      ]
    },

    partner_admin_invitation: {
      subject: 'Admin Invitation - {{partner_name}}',
      body: `<h2>You've Been Invited as Administrator</h2>
<p>Hello {{admin_name}},</p>
<p>You have been invited to join <strong>{{partner_name}}</strong> as an administrator.</p>
<p>As an admin, you'll have full access to manage your workspace, services, bookings, and team members.</p>
<p>To get started, please complete your registration:</p>
<p><a href="{{invitation_link}}">Complete Admin Registration</a></p>
{{custom_message}}
<p>Welcome aboard!</p>
<p>Best regards,<br>The PowerCowo Team</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{admin_name}}', description: "Admin's full name" },
        { name: '{{invitation_link}}', description: 'Registration link' },
        { name: '{{custom_message}}', description: 'Personal message' }
      ]
    },

    customer_booking_confirmation: {
      subject: 'Booking Confirmed - {{service_name}}',
      body: `<h2>Your Booking is Confirmed!</h2>
<p>Hi {{customer_name}},</p>
<p>Great news! Your booking has been successfully confirmed.</p>
<h3>Booking Details:</h3>
<ul>
  <li><strong>Service:</strong> {{service_name}}</li>
  <li><strong>Date:</strong> {{booking_date}}</li>
  <li><strong>Resource:</strong> {{resource}}</li>
  <li><strong>Remaining Entries:</strong> {{remaining_count}}</li>
</ul>
<p>We look forward to seeing you!</p>
<p>If you need to make any changes or have questions, please don't hesitate to contact us.</p>
<p>Best regards,<br>Your Workspace Team</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{customer_name}}', description: "Customer's full name" },
        { name: '{{booking_date}}', description: 'Date of booking' },
        { name: '{{duration_display}}', description: 'Duration' },
        { name: '{{resource}}', description: 'Resource name (desk, meeting room)' },
        { name: '{{remaining_count}}', description: 'Remaining entries' },
        { name: '{{service_name}}', description: 'Service name' }
      ]
    },

    customer_booking_deleted: {
      subject: 'Booking Cancelled - {{service_name}}',
      body: `<h2>Booking Cancellation Notice</h2>
<p>Dear {{customer_name}},</p>
<p>We regret to inform you that your booking has been cancelled.</p>
<h3>Cancelled Booking Details:</h3>
<ul>
  <li><strong>Service:</strong> {{service_name}}</li>
  <li><strong>Date:</strong> {{booking_date}}</li>
  <li><strong>Resource:</strong> {{resource_name}}</li>
  <li><strong>Location:</strong> {{location_name}}</li>
  <li><strong>Contract Number:</strong> {{contract_number}}</li>
</ul>
<p>We apologize for any inconvenience this may cause. If you have any questions or concerns, please don't hesitate to contact us.</p>
<p>Best regards,<br>{{partner_firstname}} {{partner_lastname}}<br>{{structure_name}}</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">--</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp;</span></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{customer_name}}', description: "Customer's full name" },
        { name: '{{booking_date}}', description: 'Date of booking' },
        { name: '{{duration_display}}', description: 'Duration (for package bookings)' },
        { name: '{{resource_name}}', description: 'Resource name (desk, meeting room)' },
        { name: '{{location_name}}', description: 'Location name' },
        { name: '{{service_name}}', description: 'Service name' },
        { name: '{{contract_number}}', description: 'Contract number' }
      ]
    },

    partner_booking_notification: {
      subject: 'New Booking - {{customer_name}}',
      body: `<h2>New Booking Received</h2>
<p>You have a new booking!</p>
<h3>Booking Details:</h3>
<ul>
  <li><strong>Customer:</strong> {{customer_name}}</li>
  <li><strong>Date:</strong> {{booking_date}}</li>
  <li><strong>Resource:</strong> {{resource}}</li>
  <li><strong>Remaining Entries:</strong> {{remaining_count}}</li>
</ul>
<p>Please ensure everything is ready for your guest.</p>
<p>Best regards,<br>PowerCowo System</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{customer_name}}', description: "Customer's full name" },
        { name: '{{booking_date}}', description: 'Date of booking' },
        { name: '{{resource}}', description: 'Resource name' },
        { name: '{{remaining_count}}', description: 'Remaining entries' }
      ]
    },

    partner_invitation: {
      subject: 'Join PowerCowo - Partner Invitation',
      body: `<h2>Welcome to PowerCowo!</h2>
<p>Hello {{partner_name}},</p>
<p>You've been invited to join PowerCowo as a coworking space partner. We're excited to work with you!</p>
<p>PowerCowo is a comprehensive coworking management platform that will help you:</p>
<ul>
  <li>Manage your locations and resources</li>
  <li>Handle customer contracts and bookings</li>
  <li>Track payments and subscriptions</li>
  <li>Send automated communications</li>
  <li>And much more!</li>
</ul>
<p>To activate your account and get started, please click the button below:</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{invitation_link}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Activate Partner Account
  </a>
</p>
<p>If the button doesn't work, you can copy and paste this link into your browser:</p>
<p style="word-break: break-all;">{{invitation_link}}</p>
<p>Once you've activated your account, you'll receive an email at <strong>{{partner_email}}</strong> with your login credentials.</p>
<p>If you have any questions, feel free to reach out to our team.</p>
<p>Best regards,<br>{{admin_name}}<br>PowerCowo Team</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Partner company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{partner_email}}', description: 'Partner email address' },
        { name: '{{invitation_link}}', description: 'Account activation link' },
        { name: '{{admin_name}}', description: 'Admin name who sent invitation' }
      ]
    },

    expiry_reminder: {
      subject: 'Reminder: {{expiry_type}} - {{partner_name}}',
      body: `<h2>Expiry Reminder</h2>
<p>Dear {{customer_name}},</p>
<p>This is a friendly reminder regarding your <strong>{{expiry_type}}</strong>.</p>
<h3>Details:</h3>
<ul>
  <li><strong>Type:</strong> {{expiry_type}}</li>
  <li><strong>Expiry Date:</strong> {{expiry_date}}</li>
  <li><strong>Contract Number:</strong> {{contract_number}}</li>
  <li><strong>Amount:</strong> {{amount}}</li>
</ul>
<p>Please take the necessary action to avoid any service interruption.</p>
<p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
<p>Best regards,<br>{{partner_firstname}} {{partner_lastname}}<br>{{structure_name}}</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">--</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp;</span></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{customer_name}}', description: 'Customer full name' },
        { name: '{{expiry_type}}', description: 'Type of expiry (e.g., Contract Expiry, Payment Due, etc.)' },
        { name: '{{expiry_date}}', description: 'Date of expiry' },
        { name: '{{contract_number}}', description: 'Contract number' },
        { name: '{{amount}}', description: 'Amount (for payment reminders)' }
      ]
    },

    contract_creation: {
      subject: 'New Contract Created - {{contract_number}}',
      body: `<h2>Contract Created Successfully</h2>
<p>Dear {{customer_name}},</p>
<p>We're pleased to confirm that your new contract has been created.</p>
<h3>Contract Details:</h3>
<ul>
  <li><strong>Contract Number:</strong> {{contract_number}}</li>
  <li><strong>Service:</strong> {{service_name}}</li>
  <li><strong>Type:</strong> {{contract_type}}</li>
  <li><strong>Start Date:</strong> {{start_date}}</li>
  <li><strong>End Date:</strong> {{end_date}}</li>
</ul>
<p>You can now start using our services. If you have any questions about your contract, please don't hesitate to contact us.</p>
<p>Thank you for choosing our services!</p>
<p>Best regards,<br>{{partner_firstname}} {{partner_lastname}}<br>{{structure_name}}</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">--</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp;</span></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Company name' },
        { name: '{{structure_name}}', description: 'Structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{customer_name}}', description: 'Customer full name' },
        { name: '{{contract_number}}', description: 'Contract number' },
        { name: '{{contract_type}}', description: 'Type of contract (package/subscription)' },
        { name: '{{service_name}}', description: 'Service name' },
        { name: '{{start_date}}', description: 'Contract start date' },
        { name: '{{end_date}}', description: 'Contract end date' }
      ]
    }
  },

  it: {
    customer_invitation: {
      subject: 'Invito a unirti a {{partner_name}}',
      body: `<h2><span style="font-size: 16px; font-weight: 400;">Gentile Cliente, 
      <br>{{partner_name}} ti da' il benvenuto.&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">{{custom_message}}&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">Per iniziare a utilizzare i nostri spazi, registrati sul portale.</span></h2>
      <h2><a href="{{invitation_link}}">Completa la registrazione</a></h2>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><i><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Lo Staff&nbsp;</span><span style="color: rgb(17, 24, 39); font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_name}}</span>
      <span style="color: rgb(17, 24, 39); font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">&nbsp;&nbsp;</span></i></p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">-&nbsp;</span></p><p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
      <span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Ricevi questa email perché hai ricevuto un invito da un nostro partner.<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp; -&nbsp;</span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Your company name' },
        { name: '{{structure_name}}', description: 'Your structure name' },
        { name: '{{partner_firstname}}', description: 'Partner first name' },
        { name: '{{partner_lastname}}', description: 'Partner last name' },
        { name: '{{invitation_link}}', description: 'Registration link' },
        { name: '{{custom_message}}', description: 'Your personal message' }
      ]
    },


    confirmation_email: {
      subject: 'Conferma il tuo indirizzo email - {{partner_name}}',
      body: `<h2><span style="font-size: 16px; font-weight: 400;">Gentile Cliente, 
    <br>{{partner_name}} ti da' il benvenuto.&nbsp;</span></h2>
    <h2><span style="font-size: 16px; font-weight: 400;">Per completare la registrazione, conferma il tuo indirizzo email.</span></h2>
    <h2><a href="{{confirmation_link}}">Conferma Email</a></h2>
    <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><i><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">Lo Staff&nbsp;</span><span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_name}}</span>
    <span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">&nbsp;&nbsp;</span></i></p>
    <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">-&nbsp;</span></p><p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
    <span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Ricevi questa email per confermare il tuo account.<br></span>
    <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;"><b>⚡️ PowerCowo</b>&nbsp; -&nbsp;</span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">MLM Media Logistic Management GmbH<br></span>
    <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{confirmation_link}}', description: 'Link di conferma email' },
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{user_email}}', description: 'Email utente' }
      ]
    },

    partner_admin_invitation: {
      subject: 'Invito Amministratore - {{partner_name}}',
      body: `<h2>Sei Stato Invitato come Amministratore</h2>
<p>Ciao {{admin_name}},</p>
<p>Sei stato invitato a unirti a <strong>{{partner_name}}</strong> come amministratore.</p>
<p>Come amministratore, avrai pieno accesso per gestire il tuo workspace, servizi, prenotazioni e membri del team.</p>
<p>Per iniziare, completa la tua registrazione:</p>
<p><a href="{{invitation_link}}">Completa la Registrazione Admin</a></p>
{{custom_message}}
<p>Benvenuto a bordo!</p>
<p>Cordiali saluti,<br>Il Team PowerCowo</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{admin_name}}', description: "Nome completo dell'admin" },
        { name: '{{invitation_link}}', description: 'Link di registrazione' },
        { name: '{{custom_message}}', description: 'Messaggio personale' }
      ]
    },

    customer_booking_confirmation: {
      subject: 'Conferma prenotazione del {{booking_date}}',
      body: `<h2><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-weight: normal;">Gentile {{customer_name}},&nbsp;<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem; font-weight: normal;">la tua prenotazione è confermata:</span></h2>
<ul>
  <li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Data:</strong><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{booking_date}}</span></li>
  <li><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"><b>Durata:&nbsp;</b>{{duration_display}}<br></span></li><li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Accessi rimanenti:</strong>
        <span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{remaining_count}}</span></li></ul>
        <p><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"><br></span></p><p><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_firstname}},</span></p><p>{{structure_name}}<br></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{booking_date}}', description: 'Data della prenotazione' },
        { name: '{{duration_display}}', description: 'Durata' },
        { name: '{{resource}}', description: 'Nome risorsa (scrivania, sala riunioni)' },
        { name: '{{remaining_count}}', description: 'Ingressi rimanenti' },
        { name: '{{service_name}}', description: 'Nome servizio' }
      ]
    },

    customer_booking_deleted: {
      subject: 'Prenotazione Cancellata - {{service_name}}',
      body: `<h2><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-weight: normal;">Gentile {{customer_name}},&nbsp;<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem; font-weight: normal;">siamo spiacenti di informarti che la tua prenotazione è stata cancellata.</span></h2>
<h3><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-weight: normal;">Dettagli Prenotazione Cancellata:</span></h3>
<ul>
  <li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Servizio:</strong><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{service_name}}</span></li>
  <li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Data:</strong><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{booking_date}}</span></li>
  <li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Risorsa:</strong><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{resource_name}}</span></li>
  <li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Sede:</strong><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{location_name}}</span></li>
  <li><strong style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Numero Contratto:</strong><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;"> {{contract_number}}</span></li>
</ul>
<p><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Ci scusiamo per l'eventuale disagio. Per qualsiasi domanda o chiarimento, non esitare a contattarci.</span></p>
<p><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_firstname}},</span></p>
<p>{{structure_name}}<br></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">--</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp;</span></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{booking_date}}', description: 'Data della prenotazione' },
        { name: '{{duration_display}}', description: 'Durata (per prenotazioni pacchetto)' },
        { name: '{{resource_name}}', description: 'Nome risorsa (scrivania, sala riunioni)' },
        { name: '{{location_name}}', description: 'Nome sede' },
        { name: '{{service_name}}', description: 'Nome servizio' },
        { name: '{{contract_number}}', description: 'Numero contratto' }
      ]
    },

    partner_booking_notification: {
      subject: 'Nuova Prenotazione - {{customer_name}}',
      body: `<h2>Nuova Prenotazione Ricevuta</h2>
<p>Hai una nuova prenotazione!</p>
<h3>Dettagli Prenotazione:</h3>
<ul>
  <li><strong>Cliente:</strong> {{customer_name}}</li>
  <li><strong>Data:</strong> {{booking_date}}</li>
  <li><strong>Risorsa:</strong> {{resource}}</li>
  <li><strong>Ingressi Rimanenti:</strong> {{remaining_count}}</li>
</ul>
<p>Assicurati che tutto sia pronto per il tuo ospite.</p>
<p>Cordiali saluti,<br>Sistema PowerCowo</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{booking_date}}', description: 'Data della prenotazione' },
        { name: '{{resource}}', description: 'Nome risorsa' },
        { name: '{{remaining_count}}', description: 'Ingressi rimanenti' }
      ]
    },

    partner_invitation: {
      subject: 'Unisciti a PowerCowo - Invito Partner',
      body: `<h2>Benvenuto in PowerCowo!</h2>
<p>Ciao {{partner_name}},</p>
<p>Sei stato invitato a unirti a PowerCowo come partner di spazi di coworking. Siamo entusiasti di lavorare con te!</p>
<p>PowerCowo è una piattaforma completa di gestione coworking che ti aiuterà a:</p>
<ul>
  <li>Gestire le tue sedi e risorse</li>
  <li>Gestire contratti e prenotazioni dei clienti</li>
  <li>Monitorare pagamenti e abbonamenti</li>
  <li>Inviare comunicazioni automatizzate</li>
  <li>E molto altro!</li>
</ul>
<p>Per attivare il tuo account e iniziare, clicca sul pulsante qui sotto:</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{invitation_link}}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Attiva Account Partner
  </a>
</p>
<p>Se il pulsante non funziona, puoi copiare e incollare questo link nel tuo browser:</p>
<p style="word-break: break-all;">{{invitation_link}}</p>
<p>Una volta attivato il tuo account, riceverai un'email a <strong>{{partner_email}}</strong> con le tue credenziali di accesso.</p>
<p>Se hai domande, non esitare a contattare il nostro team.</p>
<p>Cordiali saluti,<br>{{admin_name}}<br>Team PowerCowo</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome dell\'azienda partner' },
        { name: '{{structure_name}}', description: 'Nome della struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{partner_email}}', description: 'Indirizzo email del partner' },
        { name: '{{invitation_link}}', description: 'Link di attivazione account' },
        { name: '{{admin_name}}', description: 'Nome dell\'admin che ha inviato l\'invito' }
      ]
    },

    expiry_reminder: {
      subject: 'Promemoria: {{expiry_type}} - {{partner_name}}',
      body: `<h2>Promemoria Scadenza</h2>
<p>Gentile {{customer_name}},</p>
<p>Questo è un promemoria riguardante la tua <strong>{{expiry_type}}</strong>.</p>
<h3>Dettagli:</h3>
<ul>
  <li><strong>Tipo:</strong> {{expiry_type}}</li>
  <li><strong>Data di Scadenza:</strong> {{expiry_date}}</li>
  <li><strong>Numero Contratto:</strong> {{contract_number}}</li>
  <li><strong>Importo:</strong> {{amount}}</li>
</ul>
<p>Ti preghiamo di prendere le misure necessarie per evitare interruzioni del servizio.</p>
<p>Se hai domande o hai bisogno di assistenza, non esitare a contattarci.</p>
<p>Cordiali saluti,<br>{{partner_firstname}} {{partner_lastname}}<br>{{structure_name}}</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">--</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp;</span></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{expiry_type}}', description: 'Tipo di scadenza (es. Scadenza Contratto, Pagamento in Scadenza, ecc.)' },
        { name: '{{expiry_date}}', description: 'Data di scadenza' },
        { name: '{{contract_number}}', description: 'Numero contratto' },
        { name: '{{amount}}', description: 'Importo (per promemoria di pagamento)' }
      ]
    },

    contract_creation: {
      subject: 'Nuovo Contratto Creato - {{contract_number}}',
      body: `<h2>Contratto Creato con Successo</h2>
<p>Gentile {{customer_name}},</p>
<p>Siamo lieti di confermare che il tuo nuovo contratto è stato creato.</p>
<h3>Dettagli Contratto:</h3>
<ul>
  <li><strong>Numero Contratto:</strong> {{contract_number}}</li>
  <li><strong>Servizio:</strong> {{service_name}}</li>
  <li><strong>Tipo:</strong> {{contract_type}}</li>
  <li><strong>Data Inizio:</strong> {{start_date}}</li>
  <li><strong>Data Fine:</strong> {{end_date}}</li>
</ul>
<p>Ora puoi iniziare a utilizzare i nostri servizi. Se hai domande sul tuo contratto, non esitare a contattarci.</p>
<p>Grazie per aver scelto i nostri servizi!</p>
<p>Cordiali saluti,<br>{{partner_firstname}} {{partner_lastname}}<br>{{structure_name}}</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">--</p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;"><b>⚡️ PowerCowo</b>&nbsp;</span></p>
<p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">MLM Media Logistic Management GmbH<br></span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 0.875rem;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome azienda' },
        { name: '{{structure_name}}', description: 'Nome struttura' },
        { name: '{{partner_firstname}}', description: 'Nome del partner' },
        { name: '{{partner_lastname}}', description: 'Cognome del partner' },
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{contract_number}}', description: 'Numero contratto' },
        { name: '{{contract_type}}', description: 'Tipo di contratto (pacchetto/abbonamento)' },
        { name: '{{service_name}}', description: 'Nome servizio' },
        { name: '{{start_date}}', description: 'Data inizio contratto' },
        { name: '{{end_date}}', description: 'Data fine contratto' }
      ]
    }
  }
};

// Template metadata
export const TEMPLATE_TYPES = [
  {
    id: 'customer_invitation',
    nameKey: 'emailTemplates.customerInvitation',
    descriptionKey: 'emailTemplates.customerInvitationDesc',
    icon: 'UserPlus'
  },
  {
    id: 'partner_admin_invitation',
    nameKey: 'emailTemplates.partnerAdminInvitation',
    descriptionKey: 'emailTemplates.partnerAdminInvitationDesc',
    icon: 'Shield'
  },
  {
    id: 'customer_booking_confirmation',
    nameKey: 'emailTemplates.customerBookingConfirmation',
    descriptionKey: 'emailTemplates.customerBookingConfirmationDesc',
    icon: 'CheckCircle'
  },
  {
    id: 'partner_booking_notification',
    nameKey: 'emailTemplates.partnerBookingNotification',
    descriptionKey: 'emailTemplates.partnerBookingNotificationDesc',
    icon: 'Bell'
  },
  {
    id: 'partner_invitation',
    nameKey: 'emailTemplates.partnerInvitation',
    descriptionKey: 'emailTemplates.partnerInvitationDescription',
    icon: 'Shield'
  }
];
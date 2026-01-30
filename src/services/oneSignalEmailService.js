// OneSignal Email Service for sending invitations and booking confirmations

import logger from '../utils/logger';

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

    // ENHANCED DEBUG LOGGING
    logger.log('=== ONESIGNAL CONFIGURATION DEBUG ===');
    logger.log('Environment Variables Status:');
    logger.log('  VITE_ONESIGNAL_APP_ID:', this.appId ? `✅ SET (${this.appId.substring(0, 8)}...)` : '❌ MISSING');
    logger.log('  VITE_ONESIGNAL_API_KEY:', this.apiKey ? `✅ SET (${this.apiKey.substring(0, 8)}...)` : '❌ MISSING');
    logger.log('  VITE_ONESIGNAL_ADMIN_TEMPLATE_ID:', this.adminTemplateId ? `✅ SET (${this.adminTemplateId})` : '❌ MISSING');
    logger.log('  VITE_ONESIGNAL_USER_TEMPLATE_ID:', this.userTemplateId ? `✅ SET (${this.userTemplateId})` : '❌ MISSING');
    logger.log('  VITE_ONESIGNAL_UNIQUE_TEMPLATE_ID:', this.uniqueTemplateId ? `✅ SET (${this.uniqueTemplateId})` : '❌ MISSING');
    logger.log('  VITE_ONESIGNAL_CUSTOMER_BOOKING_TEMPLATE_ID:', this.customerBookingTemplateId ? `✅ SET (${this.customerBookingTemplateId})` : '⚠️ OPTIONAL (not set)');
    logger.log('  VITE_ONESIGNAL_PARTNER_BOOKING_TEMPLATE_ID:', this.partnerBookingTemplateId ? `✅ SET (${this.partnerBookingTemplateId})` : '⚠️ OPTIONAL (not set)');
    logger.log('  VITE_USE_ONESIGNAL:', this.useOneSignal ? '✅ true' : '❌ NOT true (value: ' + import.meta.env.VITE_USE_ONESIGNAL + ')');
    logger.log('');
    logger.log('Configuration Status:');
    logger.log('  isConfigured:', this.isConfigured ? '✅ YES' : '❌ NO');
    logger.log('  isBookingConfigured:', this.isBookingConfigured ? '✅ YES' : '❌ NO');
    logger.log('=====================================');

    if (!this.isConfigured) {
      logger.error('❌ OneSignal email service NOT CONFIGURED');
      logger.error('Missing required variables:');
      if (!this.appId) logger.error('  - VITE_ONESIGNAL_APP_ID');
      if (!this.apiKey) logger.error('  - VITE_ONESIGNAL_API_KEY');
      if (!this.adminTemplateId) logger.error('  - VITE_ONESIGNAL_ADMIN_TEMPLATE_ID');
      if (!this.userTemplateId) logger.error('  - VITE_ONESIGNAL_USER_TEMPLATE_ID');
      if (!this.useOneSignal) logger.error('  - VITE_USE_ONESIGNAL (must be exactly "true")');
      logger.error('Add these to Vercel → Settings → Environment Variables → Enable for Preview');
    } else {
      logger.log('✅ OneSignal email service configured successfully');
    }

    if (!this.isBookingConfigured) {
      logger.warn('⚠️ Booking templates not configured (optional):');
      if (!this.customerBookingTemplateId) logger.warn('  - VITE_ONESIGNAL_CUSTOMER_BOOKING_TEMPLATE_ID');
      if (!this.partnerBookingTemplateId) logger.warn('  - VITE_ONESIGNAL_PARTNER_BOOKING_TEMPLATE_ID');
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
      logger.error('OneSignal email service not configured');
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
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
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

      logger.log('Sending admin invitation with legacy template:', payload);
      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      logger.error('Error in sendInvitation:', error);
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
      logger.error('Unique template ID not configured');
      return false;
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { supabase } = await import('./supabase');
      const { DEFAULT_EMAIL_TEMPLATES } = await import('../utils/defaultEmailTemplates');

      // Fetch partner data for email settings
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('company_name, structure_name, first_name, second_name, email, email_banner_url')
        .eq('partner_uuid', invitationData.partner_uuid)
        .single();


      if (partnerError || !partnerData) {
        logger.error('Error fetching partner data:', partnerError);
        return false;
      }

      // Fetch custom template from database
      const { data: templateData, error: templateError } = await supabase
        .from('email_templates')
        .select('body_html, subject_line')
        .eq('partner_uuid', invitationData.partner_uuid)
        .eq('template_type', 'customer_invitation')
        .single();

      // Use custom template or fallback to default
      let bodyHtml;
      let emailSubject = `Invito a unirti a ${partnerData.company_name || 'PowerCowo'}`;

      if (templateData && !templateError) {
        bodyHtml = templateData.body_html;
        if (templateData.subject_line) {
          emailSubject = templateData.subject_line;
        }
        logger.log('Using custom customer_invitation template');
      } else {
        // Fallback to default template (assuming language is 'it')
        const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.it?.customer_invitation ||
          DEFAULT_EMAIL_TEMPLATES.en?.customer_invitation;
        bodyHtml = defaultTemplate?.body || '<p>Welcome!</p>';
        logger.log('Using default customer_invitation template');
      }

      // Replace variables with actual data
      const partnerName = partnerData.structure_name || partnerData.company_name ||
        invitationData.partners?.company_name ||
        (invitationData.partners?.first_name && invitationData.partners?.second_name
          ? `${invitationData.partners.first_name} ${invitationData.partners.second_name}`
          : invitationData.partners?.first_name || 'Partner');

      // Replace variables in subject
      emailSubject = emailSubject.replace(/\{\{partner_name\}\}/g, partnerName);
      emailSubject = emailSubject.replace(/\{\{structure_name\}\}/g, partnerData.structure_name || '');
      emailSubject = emailSubject.replace(/\{\{partner_firstname\}\}/g, partnerData.first_name || '');
      emailSubject = emailSubject.replace(/\{\{partner_lastname\}\}/g, partnerData.second_name || '');
      emailSubject = emailSubject.replace(/\{\{invitation_link\}\}/g, invitationLink);

      // Replace variables in body
      bodyHtml = bodyHtml.replace(/\{\{partner_name\}\}/g, partnerName);
      bodyHtml = bodyHtml.replace(/\{\{structure_name\}\}/g, partnerData.structure_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_firstname\}\}/g, partnerData.first_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_lastname\}\}/g, partnerData.second_name || '');
      bodyHtml = bodyHtml.replace(/\{\{invitation_link\}\}/g, invitationLink);
      bodyHtml = bodyHtml.replace(/\{\{custom_message\}\}/g, invitationData.custom_message || '');

      // Fetch banner URL from partner data or storage fallback
      let bannerUrl = partnerData.email_banner_url || '';

      if (!bannerUrl) {
        const { data: files } = await supabase.storage
          .from('partners')
          .list(`${invitationData.partner_uuid}`, { search: 'email_banner' });

        const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));

        if (bannerFile) {
          const { data } = supabase.storage
            .from('partners')
            .getPublicUrl(`${invitationData.partner_uuid}/${bannerFile.name}`);
          bannerUrl = data.publicUrl;
        }
      }

      // Send using unique template with partner email settings
      const payload = {
        app_id: this.appId,
        email_from_name: partnerData.structure_name || partnerData.company_name || partnerName,
        email_subject: emailSubject,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
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

      logger.log('Sending customer invitation with unique template:', {
        email: invitationData.invited_email,
        fromName: partnerData.company_name,
        fromEmail: partnerData.email,
        bannerUrl,
        bodyLength: bodyHtml.length
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      logger.error('Error sending customer invitation:', error);
      return false;
    }
  }

  /**
  /**
   * Send booking confirmation email to customer using internal template
   * @param {Object} bookingData - The booking/reservation data from package_reservations table
   * @param {Object} contractData - The contract data
   * @param {Function} t - Translation function
   * @param {Object} partnerData - Partner data
   * @param {string} calendarLink - Public URL of the generated ICS file
   * @returns {Promise<boolean>} - Success status
   */
  async sendBookingConfirmation(bookingData, contractData, t, partnerData = null, calendarLink = null) {
    if (!this.uniqueTemplateId) {
      logger.error('Unique template ID not configured');
      return false;
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { supabase } = await import('./supabase');
      const { DEFAULT_EMAIL_TEMPLATES } = await import('../utils/defaultEmailTemplates');

      logger.log('=== BOOKING CONFIRMATION DEBUG ===');
      logger.log('bookingData:', bookingData);
      logger.log('contractData:', contractData);
      logger.log('partnerData:', partnerData);
      logger.log('calendarLink:', calendarLink);

      // Fetch partner data if not provided (for FROM name and banner)
      if (!partnerData) {
        const { data: fetchedPartnerData, error: partnerError } = await supabase
          .from('partners')
          .select('company_name, structure_name, first_name, second_name, email, email_banner_url')
          .eq('partner_uuid', contractData.partner_uuid)
          .single();

        if (partnerError || !fetchedPartnerData) {
          logger.error('Error fetching partner data:', partnerError);
          return false;
        }
        partnerData = fetchedPartnerData;
      }

      logger.log('=== BOOKING CONFIRMATION DEBUG 2 ===');
      logger.log('bookingData:', bookingData);
      logger.log('contractData:', contractData);
      logger.log('partnerData:', partnerData);

      // Fetch custom template from database
      const { data: templateData, error: templateError } = await supabase
        .from('email_templates')
        .select('body_html, subject_line')
        .eq('partner_uuid', contractData.partner_uuid)
        .eq('template_type', 'customer_booking_confirmation')
        .single();

      // Use custom template or fallback to default
      let bodyHtml;
      let emailSubject = 'Prenotazione Confermata'; // Default subject

      if (templateData && !templateError) {
        bodyHtml = templateData.body_html;
        emailSubject = templateData.subject_line || 'Prenotazione Confermata';
        logger.log('Using custom customer_booking_confirmation template');
      } else {
        logger.log('No custom template, using default. Error:', templateError);
        const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.it?.customer_booking_confirmation ||
          DEFAULT_EMAIL_TEMPLATES.en?.customer_booking_confirmation;
        bodyHtml = defaultTemplate?.body || '<p>Booking confirmed</p>';
        if (defaultTemplate?.subject) {
          emailSubject = defaultTemplate.subject;
        }
        logger.log('Using default customer_booking_confirmation template');
      }

      // Extract CUSTOMER data - this is WHO receives the email
      let customerFirstName = '';
      let customerLastName = '';
      let customerEmail = '';

      // Try bookingData first (has nested contracts.customers from the select query)
      if (bookingData.contracts?.customers) {
        customerFirstName = bookingData.contracts.customers.first_name || '';
        customerLastName = bookingData.contracts.customers.second_name || '';
        customerEmail = bookingData.contracts.customers.email || '';
        logger.log('✅ Customer from bookingData.contracts.customers');
      }
      // Fallback to contractData.customers
      else if (contractData.customers) {
        customerFirstName = contractData.customers.first_name || '';
        customerLastName = contractData.customers.second_name || '';
        customerEmail = contractData.customers.email || '';
        logger.log('✅ Customer from contractData.customers');
      }

      const customerName = `${customerFirstName} ${customerLastName}`.trim();

      if (!customerEmail) {
        logger.error('❌ CUSTOMER EMAIL NOT FOUND!');
        logger.log('Available data:', {
          'bookingData.contracts': bookingData.contracts,
          'contractData.customers': contractData.customers
        });
        return false;
      }

      logger.log('✅ Customer data:', { customerName, customerEmail });

      // Get contract/service info early for subject
      const contractNumber = bookingData.contracts?.contract_number || contractData.contract_number || '';
      const serviceName = bookingData.contracts?.service_name || contractData.service_name || '';

      logger.log('🔍 DEBUG partnerData:', {
        structure_name: partnerData.structure_name,
        company_name: partnerData.company_name,
        structure_name_type: typeof partnerData.structure_name,
        structure_name_length: partnerData.structure_name?.length
      });

      const partnerName = partnerData.structure_name || partnerData.company_name || 'PowerCowo';

      logger.log('🔍 DEBUG Final partnerName:', partnerName);

      // Format booking date
      const bookingDate = new Date(bookingData.reservation_date).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Replace variables in subject
      emailSubject = emailSubject.replace(/\{\{service_name\}\}/g, serviceName);
      emailSubject = emailSubject.replace(/\{\{contract_number\}\}/g, contractNumber);
      emailSubject = emailSubject.replace(/\{\{partner_name\}\}/g, partnerName);
      emailSubject = emailSubject.replace(/\{\{structure_name\}\}/g, partnerData?.structure_name || '');
      emailSubject = emailSubject.replace(/\{\{partner_firstname\}\}/g, partnerData?.first_name || '');
      emailSubject = emailSubject.replace(/\{\{partner_lastname\}\}/g, partnerData?.second_name || '');
      emailSubject = emailSubject.replace(/\{\{customer_name\}\}/g, customerName);
      emailSubject = emailSubject.replace(/\{\{booking_date\}\}/g, bookingDate);

      logger.log('✅ Email subject:', emailSubject);



      // Get resource info
      const resourceName = bookingData.location_resources?.resource_name
        || contractData.services?.location_resources?.resource_name
        || contractData.resource_name
        || '';

      const locationName = bookingData.location_resources?.locations?.location_name
        || contractData.services?.location_resources?.locations?.location_name
        || contractData.location_name
        || '';

      // Calculate remaining entries
      const entriesUsed = bookingData.entries_used || (bookingData.duration_type === 'full_day' ? 1 : 0.5);
      const currentEntriesUsed = contractData.entries_used || 0;
      const maxEntries = contractData.service_max_entries || 0;
      const remainingEntries = maxEntries - (currentEntriesUsed + entriesUsed);

      // Duration and time slot info
      const durationType = bookingData.duration_type === 'full_day'
        ? (t('reservations.fullDay') || 'Giornata intera')
        : (t('reservations.halfDay') || 'Mezza giornata');

      let timeSlotInfo = '';
      if (bookingData.duration_type === 'half_day' && bookingData.time_slot) {
        const slotLabel = bookingData.time_slot === 'morning'
          ? (t('reservations.morning') || 'Mattina')
          : (t('reservations.afternoon') || 'Pomeriggio');
        const slotHours = bookingData.time_slot === 'morning'
          ? '9:00 - 13:00'
          : '14:00 - 18:00';
        timeSlotInfo = `${slotLabel} (${slotHours})`;
      }

      // Create combined duration text for display
      const durationDisplay = bookingData.duration_type === 'full_day'
        ? durationType
        : `${durationType} - ${timeSlotInfo}`;

      logger.log('=== TEMPLATE VARIABLES ===');
      const templateVars = {
        partnerName,
        customerName,
        bookingDate,
        resourceName,
        locationName,
        contractNumber,
        serviceName,
        durationType,
        timeSlotInfo,
        entriesUsed,
        remainingEntries
      };
      logger.log(templateVars);

      // Replace ALL possible variable names in template
      bodyHtml = bodyHtml.replace(/\{\{partner_name\}\}/g, partnerName);
      bodyHtml = bodyHtml.replace(/\{\{structure_name\}\}/g, partnerData?.structure_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_firstname\}\}/g, partnerData?.first_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_lastname\}\}/g, partnerData?.second_name || '');
      bodyHtml = bodyHtml.replace(/\{\{customer_name\}\}/g, customerName);
      bodyHtml = bodyHtml.replace(/\{\{booking_date\}\}/g, bookingDate);
      bodyHtml = bodyHtml.replace(/\{\{resource\}\}/g, resourceName);
      bodyHtml = bodyHtml.replace(/\{\{resource_name\}\}/g, resourceName);
      bodyHtml = bodyHtml.replace(/\{\{location_name\}\}/g, locationName);
      bodyHtml = bodyHtml.replace(/\{\{contract_number\}\}/g, contractNumber);
      bodyHtml = bodyHtml.replace(/\{\{service_name\}\}/g, serviceName);
      bodyHtml = bodyHtml.replace(/\{\{duration_type\}\}/g, durationType);
      bodyHtml = bodyHtml.replace(/\{\{time_slot\}\}/g, timeSlotInfo);
      bodyHtml = bodyHtml.replace(/\{\{duration_display\}\}/g, durationDisplay); // ADD THIS LINE
      bodyHtml = bodyHtml.replace(/\{\{entries_used\}\}/g, entriesUsed.toString());
      bodyHtml = bodyHtml.replace(/\{\{remaining_count\}\}/g, Math.max(0, remainingEntries).toString());
      bodyHtml = bodyHtml.replace(/\{\{remaining_entries\}\}/g, Math.max(0, remainingEntries).toString());

      // Calendar Link Generation - Use passed link or fallback to empty
      const finalCalendarLink = calendarLink || '#';

      bodyHtml = bodyHtml.replace(/\{\{calendar_link\}\}/g, finalCalendarLink);
      bodyHtml = bodyHtml.replace(/\{\{calendar_link_label\}\}/g, t?.('bookings.addToCalendar') || 'Aggiungi al Calendario 📅');

      // Fetch banner URL from partner data or storage fallback
      let bannerUrl = partnerData.email_banner_url || '';

      if (!bannerUrl) {
        const { data: files } = await supabase.storage
          .from('partners')
          .list(`${contractData.partner_uuid}`, { search: 'email_banner' });

        const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));

        if (bannerFile) {
          const { data } = supabase.storage
            .from('partners')
            .getPublicUrl(`${contractData.partner_uuid}/${bannerFile.name}`);
          bannerUrl = data.publicUrl;
        }
      }

      logger.log('🔍 DEBUG email_from_name:', partnerName);


      // Send email using unique template
      const payload = {
        app_id: this.appId,
        email_from_name: partnerName,
        email_subject: emailSubject,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
        template_id: this.uniqueTemplateId,
        target_channel: "email",
        include_email_tokens: [customerEmail],
        include_aliases: {
          external_id: [contractData.partner_uuid]
        },
        custom_data: {
          banner_url: bannerUrl,
          body_html: bodyHtml
        }
      };

      logger.log('📧 Sending booking confirmation:', {
        to: customerEmail,
        from: partnerName,
        subject: emailSubject,
        bannerUrl
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
      return false;
    }
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
      logger.error('Error formatting booking date:', error);
      return date.toString();
    }
  }

  /**
   * Send contract creation email to customer
   * @param {Object} contractData - The contract data
   * @param {Function} t - Translation function
   * @param {Object} partnerData - Partner data (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async sendContractCreationEmail(contractData, t, partnerData = null) {
    if (!this.uniqueTemplateId) {
      logger.error('Unique template ID not configured');
      return false;
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { supabase } = await import('./supabase');
      const { DEFAULT_EMAIL_TEMPLATES } = await import('../utils/defaultEmailTemplates');

      logger.log('=== CONTRACT CREATION EMAIL DEBUG ===');
      logger.log('contractData:', contractData);

      // Fetch partner data if not provided
      const { data: fetchedPartnerData, error: partnerError } = await supabase
        .from('partners')
        .select('company_name, structure_name, first_name, second_name, email, email_banner_url')
        .eq('partner_uuid', contractData.partner_uuid)
        .single();

      if (partnerError || !fetchedPartnerData) {
        logger.error('Error fetching partner data:', partnerError);
        return false;
      }
      partnerData = fetchedPartnerData;

      // Fetch custom template from database
      const { data: templateData, error: templateError } = await supabase
        .from('email_templates')
        .select('body_html, subject_line')
        .eq('partner_uuid', contractData.partner_uuid)
        .eq('template_type', 'contract_creation')
        .single();

      // Use custom template or fallback to default
      let bodyHtml;
      let emailSubject = 'Nuovo Contratto Creato';

      if (templateData && !templateError) {
        bodyHtml = templateData.body_html;
        emailSubject = templateData.subject_line || 'Nuovo Contratto Creato';
        logger.log('Using custom contract_creation template');
      } else {
        logger.log('No custom template, using default. Error:', templateError);
        const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.it?.contract_creation ||
          DEFAULT_EMAIL_TEMPLATES.en?.contract_creation;
        bodyHtml = defaultTemplate?.body || '<p>Contract created</p>';
        if (defaultTemplate?.subject) {
          emailSubject = defaultTemplate.subject;
        }
        logger.log('Using default contract_creation template');
      }

      // Extract customer data
      let customerFirstName = '';
      let customerLastName = '';
      let customerEmail = '';

      if (contractData.customers) {
        customerFirstName = contractData.customers.first_name || '';
        customerLastName = contractData.customers.second_name || '';
        customerEmail = contractData.customers.email || '';
      }

      const customerName = `${customerFirstName} ${customerLastName}`.trim();

      if (!customerEmail) {
        logger.error('❌ CUSTOMER EMAIL NOT FOUND!');
        return false;
      }

      logger.log('✅ Customer email:', customerEmail);

      // Get contract info
      const contractNumber = contractData.contract_number || '';
      const serviceName = contractData.service_name || '';
      const startDate = contractData.start_date ? new Date(contractData.start_date).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : '';
      const endDate = contractData.end_date ? new Date(contractData.end_date).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : '';

      const partnerName = partnerData.structure_name || partnerData.company_name || 'PowerCowo';
      const serviceType = contractData.service_type || '';

      // Replace variables in subject and body
      emailSubject = emailSubject.replace(/\{\{service_name\}\}/g, serviceName);
      emailSubject = emailSubject.replace(/\{\{contract_number\}\}/g, contractNumber);
      emailSubject = emailSubject.replace(/\{\{partner_name\}\}/g, partnerName);
      emailSubject = emailSubject.replace(/\{\{customer_name\}\}/g, customerName);
      emailSubject = emailSubject.replace(/\{\{contract_type\}\}/g, serviceType);

      bodyHtml = bodyHtml.replace(/\{\{partner_name\}\}/g, partnerName);
      bodyHtml = bodyHtml.replace(/\{\{structure_name\}\}/g, partnerData?.structure_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_firstname\}\}/g, partnerData?.first_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_lastname\}\}/g, partnerData?.second_name || '');
      bodyHtml = bodyHtml.replace(/\{\{customer_name\}\}/g, customerName);
      bodyHtml = bodyHtml.replace(/\{\{contract_number\}\}/g, contractNumber);
      bodyHtml = bodyHtml.replace(/\{\{service_name\}\}/g, serviceName);
      bodyHtml = bodyHtml.replace(/\{\{contract_type\}\}/g, serviceType);
      bodyHtml = bodyHtml.replace(/\{\{start_date\}\}/g, startDate);
      bodyHtml = bodyHtml.replace(/\{\{end_date\}\}/g, endDate);

      // Fetch banner URL from partner data or storage fallback
      let bannerUrl = partnerData.email_banner_url || '';

      if (!bannerUrl) {
        const { data: files } = await supabase.storage
          .from('partners')
          .list(`${contractData.partner_uuid}`, { search: 'email_banner' });

        const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));

        if (bannerFile) {
          const { data } = supabase.storage
            .from('partners')
            .getPublicUrl(`${contractData.partner_uuid}/${bannerFile.name}`);
          bannerUrl = data.publicUrl;
        }
      }

      // Send email
      const payload = {
        app_id: this.appId,
        email_from_name: partnerName,
        email_subject: emailSubject,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
        template_id: this.uniqueTemplateId,
        target_channel: "email",
        include_email_tokens: [customerEmail],
        include_aliases: {
          external_id: [contractData.partner_uuid]
        },
        custom_data: {
          banner_url: bannerUrl,
          body_html: bodyHtml
        }
      };

      logger.log('📧 Sending contract creation email:', {
        to: customerEmail,
        from: partnerName,
        subject: emailSubject
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      logger.error('Error sending contract creation email:', error);
      return false;
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

        logger.error('OneSignal API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        // If blocked by client, suggest solutions
        if (response.status === 0 || errorText.includes('ERR_BLOCKED_BY_CLIENT')) {
          logger.error('OneSignal request blocked. Solutions:');
          logger.error('1. Disable ad blocker for localhost');
          logger.error('2. Add onesignal.com to whitelist');
          logger.error('3. Use a backend proxy (set VITE_ONESIGNAL_PROXY_URL)');
        }

        return false;
      }

      const result = await response.json();
      logger.log('OneSignal notification sent successfully:', result);

      // Check if notification was created successfully
      const success = !!(result.id);
      logger.log('OneSignal success check:', { id: result.id, success });

      return success;
    } catch (error) {
      logger.error('OneSignal API request failed:', error);

      // Provide helpful error messages
      if (error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        logger.error('Request blocked by browser security. Try:');
        logger.error('1. Disable ad blocker/security extensions');
        logger.error('2. Use incognito/private mode');
        logger.error('3. Set up a backend proxy');
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
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
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

      logger.log('Sending OneSignal notification with payload:', {
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
      logger.error('Error in sendOneSignalNotification:', error);
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
  async sendTestEmail(recipientEmail, bannerUrl, bodyHtml, subject = 'Template Preview') {
    if (!this.isConfigured || !this.uniqueTemplateId) {
      logger.error('OneSignal unique template not configured');
      logger.log('Config check:', {
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
        email_subject: `[TEST] ${subject}`,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
        template_id: this.uniqueTemplateId,
        target_channel: "email",
        include_email_tokens: [recipientEmail],
        custom_data: {
          banner_url: bannerUrl || '',
          body_html: bodyHtml
        }
      };

      // DEBUG: Log complete payload
      logger.log('=== ONESIGNAL TEST EMAIL PAYLOAD ===');
      logger.log('Full JSON payload:', JSON.stringify(payload, null, 2));
      logger.log('Banner URL:', bannerUrl);
      logger.log('Body HTML length:', bodyHtml?.length);
      logger.log('Body HTML preview:', bodyHtml?.substring(0, 200));
      logger.log('====================================');

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      logger.error('Error sending test email:', error);
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
        logger.warn('Failed to create OneSignal user:', response.statusText);
        return false;
      }

      const result = await response.json();
      logger.log('OneSignal user created:', result);
      return true;
    } catch (error) {
      logger.warn('Error creating OneSignal user:', error);
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

    logger.log('=== ONESIGNAL EMAIL WOULD BE SENT ===');
    logger.log('To:', invitationData.invited_email);
    logger.log('Subject:', emailSubject);
    logger.log('Template:', invitationData.invited_role === 'admin' ? 'Admin Template' : 'User Template');
    logger.log('Template ID:', invitationData.invited_role === 'admin' ? this.adminTemplateId : this.userTemplateId);
    logger.log('Link:', invitationLink);
    logger.log('Partner:', partnerName);
    logger.log('Role:', invitationData.invited_role);
    logger.log('Custom Message:', invitationData.custom_message || 'None');
    logger.log('========================================');
  }

  /**
   * Test OneSignal configuration
   * @returns {Promise<boolean>} - Configuration test result
   */
  async testConfiguration() {
    if (!this.isConfigured) {
      logger.error('OneSignal not configured');
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
        logger.error('OneSignal configuration test failed:', response.statusText);
        return false;
      }

      const appInfo = await response.json();
      logger.log('OneSignal configuration test successful:', {
        appName: appInfo.name,
        appId: this.appId,
        bookingTemplatesConfigured: this.isBookingConfigured
      });
      return true;
    } catch (error) {
      logger.error('OneSignal configuration test error:', error);
      return false;
    }
  }

  /**
   * Send booking deletion email to customer
   * @param {Object} bookingData - The booking/reservation data
   * @param {Object} contractData - The contract data
   * @param {Function} t - Translation function
   * @param {Object} partnerData - Partner data (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async sendBookingDeletionEmail(bookingData, contractData, t, partnerData = null) {
    if (!this.uniqueTemplateId) {
      logger.error('Unique template ID not configured');
      return false;
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { supabase } = await import('./supabase');
      const { DEFAULT_EMAIL_TEMPLATES } = await import('../utils/defaultEmailTemplates');

      logger.log('=== BOOKING DELETION EMAIL DEBUG ===');
      logger.log('bookingData:', bookingData);
      logger.log('contractData:', contractData);

      // Fetch partner data if not provided
      if (!partnerData) {
        const { data: fetchedPartnerData, error: partnerError } = await supabase
          .from('partners')
          .select('company_name, structure_name, first_name, second_name, email, email_banner_url')
          .eq('partner_uuid', contractData.partner_uuid)
          .single();

        if (partnerError || !fetchedPartnerData) {
          logger.error('Error fetching partner data:', partnerError);
          return false;
        }
        partnerData = fetchedPartnerData;
      }

      // Fetch custom template from database
      const { data: templateData, error: templateError } = await supabase
        .from('email_templates')
        .select('body_html, subject_line')
        .eq('partner_uuid', contractData.partner_uuid)
        .eq('template_type', 'customer_booking_deleted')
        .single();

      // Use custom template or fallback to default
      let bodyHtml;
      let emailSubject = 'Prenotazione Cancellata';

      if (templateData && !templateError) {
        bodyHtml = templateData.body_html;
        emailSubject = templateData.subject_line || 'Prenotazione Cancellata';
        logger.log('Using custom customer_booking_deleted template');
      } else {
        logger.log('No custom template, using default. Error:', templateError);
        const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.it?.customer_booking_deleted ||
          DEFAULT_EMAIL_TEMPLATES.en?.customer_booking_deleted;
        bodyHtml = defaultTemplate?.body || '<p>Booking cancelled</p>';
        if (defaultTemplate?.subject) {
          emailSubject = defaultTemplate.subject;
        }
        logger.log('Using default customer_booking_deleted template');
      }

      // Extract CUSTOMER data
      let customerFirstName = '';
      let customerLastName = '';
      let customerEmail = '';

      if (bookingData.customers) {
        customerFirstName = bookingData.customers.first_name || '';
        customerLastName = bookingData.customers.second_name || '';
        customerEmail = bookingData.customers.email || '';
        logger.log('✅ Customer from bookingData.customers');
      } else if (contractData.customers) {
        customerFirstName = contractData.customers.first_name || '';
        customerLastName = contractData.customers.second_name || '';
        customerEmail = contractData.customers.email || '';
        logger.log('✅ Customer from contractData.customers');
      }

      const customerName = `${customerFirstName} ${customerLastName}`.trim();

      if (!customerEmail) {
        logger.error('❌ CUSTOMER EMAIL NOT FOUND!');
        return false;
      }

      logger.log('✅ Customer data:', { customerName, customerEmail });

      // Get contract/service info
      const contractNumber = contractData.contract_number || '';
      const serviceName = contractData.service_name || '';
      const partnerName = partnerData.structure_name || partnerData.company_name || 'PowerCowo';

      // Format booking date
      const bookingDate = new Date(bookingData.reservation_date || bookingData.start_date).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Get resource info
      const resourceName = bookingData.location_resources?.resource_name || '';
      const locationName = bookingData.location_resources?.locations?.location_name || '';

      // Duration info (for package bookings)
      let durationDisplay = '';
      if (bookingData.duration_type) {
        const durationType = bookingData.duration_type === 'full_day'
          ? (t('reservations.fullDay') || 'Giornata intera')
          : (t('reservations.halfDay') || 'Mezza giornata');

        if (bookingData.duration_type === 'half_day' && bookingData.time_slot) {
          const slotLabel = bookingData.time_slot === 'morning'
            ? (t('reservations.morning') || 'Mattina')
            : (t('reservations.afternoon') || 'Pomeriggio');
          const slotHours = bookingData.time_slot === 'morning' ? '9:00 - 13:00' : '14:00 - 18:00';
          durationDisplay = `${durationType} - ${slotLabel} (${slotHours})`;
        } else {
          durationDisplay = durationType;
        }
      }

      // Replace variables in subject
      emailSubject = emailSubject.replace(/\{\{service_name\}\}/g, serviceName);
      emailSubject = emailSubject.replace(/\{\{contract_number\}\}/g, contractNumber);
      emailSubject = emailSubject.replace(/\{\{partner_name\}\}/g, partnerName);
      emailSubject = emailSubject.replace(/\{\{customer_name\}\}/g, customerName);
      emailSubject = emailSubject.replace(/\{\{booking_date\}\}/g, bookingDate);

      // Replace variables in body
      bodyHtml = bodyHtml.replace(/\{\{partner_name\}\}/g, partnerName);
      bodyHtml = bodyHtml.replace(/\{\{structure_name\}\}/g, partnerData?.structure_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_firstname\}\}/g, partnerData?.first_name || '');
      bodyHtml = bodyHtml.replace(/\{\{partner_lastname\}\}/g, partnerData?.second_name || '');
      bodyHtml = bodyHtml.replace(/\{\{customer_name\}\}/g, customerName);
      bodyHtml = bodyHtml.replace(/\{\{booking_date\}\}/g, bookingDate);
      bodyHtml = bodyHtml.replace(/\{\{resource_name\}\}/g, resourceName);
      bodyHtml = bodyHtml.replace(/\{\{location_name\}\}/g, locationName);
      bodyHtml = bodyHtml.replace(/\{\{contract_number\}\}/g, contractNumber);
      bodyHtml = bodyHtml.replace(/\{\{service_name\}\}/g, serviceName);
      bodyHtml = bodyHtml.replace(/\{\{duration_display\}\}/g, durationDisplay);

      // Fetch banner URL
      let bannerUrl = partnerData.email_banner_url || '';

      if (!bannerUrl) {
        const { data: files } = await supabase.storage
          .from('partners')
          .list(`${contractData.partner_uuid}`, { search: 'email_banner' });

        const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));

        if (bannerFile) {
          const { data } = supabase.storage
            .from('partners')
            .getPublicUrl(`${contractData.partner_uuid}/${bannerFile.name}`);
          bannerUrl = data.publicUrl;
        }
      }

      // Send email
      const payload = {
        app_id: this.appId,
        email_from_name: partnerName,
        email_subject: emailSubject,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
        template_id: this.uniqueTemplateId,
        target_channel: "email",
        include_email_tokens: [customerEmail],
        include_aliases: {
          external_id: [contractData.partner_uuid]
        },
        custom_data: {
          banner_url: bannerUrl,
          body_html: bodyHtml
        }
      };

      logger.log('📧 Sending booking deletion email:', {
        to: customerEmail,
        from: partnerName,
        subject: emailSubject
      });

      return await this.sendOneSignalRequest(payload);
    } catch (error) {
      logger.error('Error sending booking deletion email:', error);
      return false;
    }
  }
}


// Export singleton instance
export const oneSignalEmailService = new OneSignalEmailService();
export default oneSignalEmailService;
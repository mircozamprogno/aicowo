// src/utils/defaultEmailTemplates.js
// Default email templates for EN and IT
// These are used when a partner hasn't customized their templates yet

export const DEFAULT_EMAIL_TEMPLATES = {
  en: {
    customer_invitation: {
      subject: 'Join {{partner_name}} - Your Invitation',
      body: `<h2>Welcome!</h2>
<p>Hi {{customer_name}},</p>
<p>You've been invited to join <strong>{{partner_name}}</strong>. We're excited to have you as part of our community!</p>
<p>To complete your registration and access all our services, please click the link below:</p>
<p><a href="{{invitation_link}}">Complete Registration</a></p>
{{custom_message}}
<p>If you have any questions, feel free to reach out to us.</p>
<p>Best regards,<br>The {{partner_name}} Team</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Your company name' },
        { name: '{{customer_name}}', description: "Customer's full name" },
        { name: '{{invitation_link}}', description: 'Registration link' },
        { name: '{{custom_message}}', description: 'Your personal message' }
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
        { name: '{{customer_name}}', description: "Customer's full name" },
        { name: '{{booking_date}}', description: 'Date of booking' },
        { name: '{{resource}}', description: 'Resource name (desk, meeting room)' },
        { name: '{{remaining_count}}', description: 'Remaining entries' },
        { name: '{{service_name}}', description: 'Service name' }
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
        { name: '{{customer_name}}', description: "Customer's full name" },
        { name: '{{booking_date}}', description: 'Date of booking' },
        { name: '{{resource}}', description: 'Resource name' },
        { name: '{{remaining_count}}', description: 'Remaining entries' }
      ]
    },

    // NEW: Partner invitation template for SuperAdmin
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
        { name: '{{partner_email}}', description: 'Partner email address' },
        { name: '{{invitation_link}}', description: 'Account activation link' },
        { name: '{{admin_name}}', description: 'Admin name who sent invitation' }
      ]
    }
  },
  
  it: {
    customer_invitation: {
      subject: 'Unisciti a {{partner_name}} - Il Tuo Invito',
      body: `<h2>Benvenuto!</h2>
<p>Ciao {{customer_name}},</p>
<p>Sei stato invitato a unirti a <strong>{{partner_name}}</strong>. Siamo entusiasti di averti come parte della nostra community!</p>
<p>Per completare la tua registrazione e accedere a tutti i nostri servizi, clicca sul link qui sotto:</p>
<p><a href="{{invitation_link}}">Completa la Registrazione</a></p>
{{custom_message}}
<p>Se hai domande, non esitare a contattarci.</p>
<p>Cordiali saluti,<br>Il Team di {{partner_name}}</p>`,
      variables: [
        { name: '{{partner_name}}', description: 'Nome della tua azienda' },
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{invitation_link}}', description: 'Link di registrazione' },
        { name: '{{custom_message}}', description: 'Il tuo messaggio personale' }
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
        { name: '{{admin_name}}', description: "Nome completo dell'admin" },
        { name: '{{invitation_link}}', description: 'Link di registrazione' },
        { name: '{{custom_message}}', description: 'Messaggio personale' }
      ]
    },
    
    customer_booking_confirmation: {
      subject: 'Prenotazione Confermata - {{service_name}}',
      body: `<h2>La Tua Prenotazione è Confermata!</h2>
<p>Ciao {{customer_name}},</p>
<p>Ottima notizia! La tua prenotazione è stata confermata con successo.</p>
<h3>Dettagli Prenotazione:</h3>
<ul>
  <li><strong>Servizio:</strong> {{service_name}}</li>
  <li><strong>Data:</strong> {{booking_date}}</li>
  <li><strong>Risorsa:</strong> {{resource}}</li>
  <li><strong>Ingressi Rimanenti:</strong> {{remaining_count}}</li>
</ul>
<p>Non vediamo l'ora di vederti!</p>
<p>Se hai bisogno di modifiche o hai domande, non esitare a contattarci.</p>
<p>Cordiali saluti,<br>Il Tuo Team Workspace</p>`,
      variables: [
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{booking_date}}', description: 'Data della prenotazione' },
        { name: '{{resource}}', description: 'Nome risorsa (scrivania, sala riunioni)' },
        { name: '{{remaining_count}}', description: 'Ingressi rimanenti' },
        { name: '{{service_name}}', description: 'Nome servizio' }
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
        { name: '{{customer_name}}', description: 'Nome completo del cliente' },
        { name: '{{booking_date}}', description: 'Data della prenotazione' },
        { name: '{{resource}}', description: 'Nome risorsa' },
        { name: '{{remaining_count}}', description: 'Ingressi rimanenti' }
      ]
    },

    // NEW: Partner invitation template for SuperAdmin
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
        { name: '{{partner_email}}', description: 'Indirizzo email del partner' },
        { name: '{{invitation_link}}', description: 'Link di attivazione account' },
        { name: '{{admin_name}}', description: 'Nome dell\'admin che ha inviato l\'invito' }
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
  // NEW: Partner invitation for SuperAdmin
  {
    id: 'partner_invitation',
    nameKey: 'emailTemplates.partnerInvitation',
    descriptionKey: 'emailTemplates.partnerInvitationDescription',
    icon: 'Shield'
  }
];
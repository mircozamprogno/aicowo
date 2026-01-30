-- Add customer_booking_deleted to the email_templates table constraint
-- This allows the new booking deletion email template to be saved

-- Drop the existing constraint
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_template_type_check;

-- Add the new constraint with customer_booking_deleted included
ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_type_check 
CHECK (template_type IN (
  'customer_invitation',
  'partner_admin_invitation', 
  'customer_booking_confirmation',
  'partner_booking_notification',
  'partner_invitation',
  'confirmation_email',
  'expiry_reminder',
  'contract_creation',
  'customer_booking_deleted'
));

-- Fix confirmation email template link overflow issue
-- This script updates all confirmation_email templates to add proper word-break styling

UPDATE email_templates
SET body_html = REPLACE(
  body_html,
  '<div>Se il collegamento viene bloccato, copia e incolla questo link nella barra degli indirizzi:<br><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{confirmation_link}}</span></div>',
  '<div>Se il collegamento viene bloccato, copia e incolla questo link nella barra degli indirizzi:</div><div style="word-break: break-all; overflow-wrap: break-word; background: #f3f4f6; padding: 8px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 12px;">{{confirmation_link}}</div>'
)
WHERE template_type = 'confirmation_email'
  AND body_html LIKE '%Se il collegamento viene bloccato%';

-- Also handle English version if it exists
UPDATE email_templates
SET body_html = REPLACE(
  body_html,
  '<div>If the link is blocked, copy and paste this link into your address bar:<br><span style="font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{confirmation_link}}</span></div>',
  '<div>If the link is blocked, copy and paste this link into your address bar:</div><div style="word-break: break-all; overflow-wrap: break-word; background: #f3f4f6; padding: 8px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 12px;">{{confirmation_link}}</div>'
)
WHERE template_type = 'confirmation_email'
  AND body_html LIKE '%If the link is blocked%';

-- Return updated templates
SELECT
  partner_uuid,
  template_type,
  subject_line,
  CASE
    WHEN body_html LIKE '%word-break: break-all%' THEN 'Fixed ✓'
    ELSE 'Not Updated'
  END as status
FROM email_templates
WHERE template_type = 'confirmation_email';

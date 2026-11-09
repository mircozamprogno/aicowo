-- door_code_cleared_partner now also shows the door position (cleared together with the code).
-- Updates only the seeded copies nobody has edited yet.
UPDATE public.email_templates
SET subject_line = $s$Codice porta da disattivare: {{customer_name}}$s$,
    body_html = $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>l'ultimo contratto attivo di questo cliente è terminato, quindi il suo codice porta e la sua posizione sono stati <strong>rimossi dalla scheda cliente</strong> e sono di nuovo disponibili:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Email</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_email}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Codice porta</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;"><strong>{{door_code}}</strong></td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Posizione</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{door_position}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Ultimo contratto</td><td style="padding:10px 14px;">{{contract_number}}</td></tr>
  </table>
  <p style="color:#b45309;"><strong>Ricordati di disattivare questo codice anche sulla serratura</strong>: PowerCowo non è collegato alla porta, quindi il codice funziona finché non lo rimuovi tu.</p>
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">PowerCowo</p>
</div>$b$
WHERE template_type = 'door_code_cleared_partner'
  AND body_html LIKE '%rimosso dalla scheda cliente</strong> ed è di nuovo disponibile%';

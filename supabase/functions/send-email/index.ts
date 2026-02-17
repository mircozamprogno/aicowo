// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default email templates (embedded for Edge Function)
const DEFAULT_EMAIL_TEMPLATES = {
  it: {
    confirmation_email: {
      subject: 'Conferma il tuo indirizzo email - {{partner_name}}',
      body: `<h2><span style="font-size: 16px; font-weight: 400;">Gentile Cliente,
      <br>{{partner_name}} ti da' il benvenuto.&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">Per completare la registrazione, conferma il tuo indirizzo email.</span></h2>
      <h2><a href="{{confirmation_link}}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Conferma Email</a></h2>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
        <span style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Se il collegamento viene bloccato, copia e incolla questo link nella barra degli indirizzi:<br></span>
        <span style="font-size: 12px; font-family: monospace; word-break: break-all; background: #f3f4f6; padding: 8px; display: block; border-radius: 4px; margin-top: 8px;">{{confirmation_link}}</span>
      </p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><i><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">Lo Staff&nbsp;</span><span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_name}}</span>
      <span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">&nbsp;&nbsp;</span></i></p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">-&nbsp;</span></p><p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
      <span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">Ricevi questa email per confermare il tuo account.<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;"><b>⚡️ PowerCowo</b>&nbsp; -&nbsp;</span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">MLM Media Logistic Management GmbH<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`
    }
  },
  en: {
    confirmation_email: {
      subject: 'Confirm your email address - {{partner_name}}',
      body: `<h2><span style="font-size: 16px; font-weight: 400;">Dear Customer,
      <br>{{partner_name}} welcomes you.&nbsp;</span></h2>
      <h2><span style="font-size: 16px; font-weight: 400;">To complete your registration, please confirm your email address.</span></h2>
      <h2><a href="{{confirmation_link}}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Confirm Email</a></h2>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
        <span style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">If the link is blocked, copy and paste this link into your address bar:<br></span>
        <span style="font-size: 12px; font-family: monospace; word-break: break-all; background: #f3f4f6; padding: 8px; display: block; border-radius: 4px; margin-top: 8px;">{{confirmation_link}}</span>
      </p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><i><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">The Staff&nbsp;</span><span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">{{partner_name}}</span>
      <span style="color: rgb(17, 24, 39); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">&nbsp;&nbsp;</span></i></p>
      <p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;"><span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">-&nbsp;</span></p><p style="caret-color: rgb(51, 51, 51); color: rgb(51, 51, 51); font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; font-size: 16px;">
      <span style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif;">You are receiving this email to confirm your account.<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;"><b>⚡️ PowerCowo</b>&nbsp; -&nbsp;</span><span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">MLM Media Logistic Management GmbH<br></span>
      <span style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px;">Industriepark 11 8610 Uster (ZH) Svizzera</span></p>`
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      template_type,
      recipient_email,
      partner_uuid,
      variables = {},
      language = 'it'
    } = await req.json()

    console.log('send-email invoked:', { template_type, recipient_email, partner_uuid, language })

    // Validate required fields
    if (!template_type || !recipient_email || !partner_uuid) {
      throw new Error('Missing required fields: template_type, recipient_email, partner_uuid')
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch custom template from database
    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('email_templates')
      .select('body_html, subject_line')
      .eq('partner_uuid', partner_uuid)
      .eq('template_type', template_type)
      .single()

    let bodyHtml: string
    let emailSubject: string

    if (templateData && !templateError) {
      bodyHtml = templateData.body_html
      emailSubject = templateData.subject_line
      console.log('Using custom template from database')
    } else {
      // Fallback to default template
      const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[language]?.[template_type] ||
                             DEFAULT_EMAIL_TEMPLATES.en?.[template_type]
      
      if (!defaultTemplate) {
        throw new Error(`Template type '${template_type}' not found`)
      }

      bodyHtml = defaultTemplate.body
      emailSubject = defaultTemplate.subject
      console.log('Using default template')
    }

    // 2. Fetch partner data (including email_banner_url)
    const { data: partnerData, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('company_name, structure_name, first_name, second_name, email_banner_url')
      .eq('partner_uuid', partner_uuid)
      .single()

    if (partnerError || !partnerData) {
      throw new Error('Partner not found')
    }

    const partnerName = partnerData.structure_name || partnerData.company_name || 'PowerCowo'

    // 3. Fetch banner URL from partner data or storage fallback
    let bannerUrl = partnerData.email_banner_url || ''

    if (!bannerUrl) {
      const { data: files } = await supabaseAdmin.storage
        .from('partners')
        .list(partner_uuid, { search: 'email_banner' })

      const bannerFile = files?.find((file: any) => file.name.startsWith('email_banner.'))

      if (bannerFile) {
        const { data } = supabaseAdmin.storage
          .from('partners')
          .getPublicUrl(`${partner_uuid}/${bannerFile.name}`)
        bannerUrl = data.publicUrl
      }
    }

    console.log('Partner data:', { partnerName, bannerUrl })

    // 4. Build complete variables object (partner data + provided variables)
    const allVariables = {
      partner_name: partnerName,
      structure_name: partnerData.structure_name || '',
      partner_firstname: partnerData.first_name || '',
      partner_lastname: partnerData.second_name || '',
      banner_url: bannerUrl,
      ...variables
    }

    console.log('Variables for replacement:', allVariables)

    // 5. Replace variables in subject
    let finalSubject = emailSubject
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      finalSubject = finalSubject.replace(regex, String(value))
    })

    // 6. Replace variables in body
    let finalBody = bodyHtml
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      finalBody = finalBody.replace(regex, String(value))
    })

    console.log('Final email:', { subject: finalSubject, bodyLength: finalBody.length, hasBanner: bannerUrl ? true : false })

    // 7. Send via OneSignal (banner is handled by OneSignal template using {{banner_url}})
    const oneSignalPayload = {
      app_id: Deno.env.get('ONESIGNAL_APP_ID'),
      email_from_name: partnerName,
      email_subject: finalSubject,
      email_from_address: 'app@powercowo.com',
      email_reply_to_address: 'app@powercowo.com',
      template_id: Deno.env.get('ONESIGNAL_UNIQUE_TEMPLATE_ID'),
      target_channel: 'email',
      include_email_tokens: [recipient_email],
      include_aliases: {
        external_id: [partner_uuid]
      },
      custom_data: {
        banner_url: bannerUrl,
        body_html: finalBody
      }
    }

    console.log('Sending to OneSignal:', {
      to: recipient_email,
      from: partnerName,
      subject: finalSubject
    })

    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`
      },
      body: JSON.stringify(oneSignalPayload)
    })

    if (!oneSignalResponse.ok) {
      const errorText = await oneSignalResponse.text()
      console.error('OneSignal error:', errorText)
      throw new Error(`OneSignal API error: ${errorText}`)
    }

    const oneSignalResult = await oneSignalResponse.json()
    console.log('OneSignal response:', oneSignalResult)

    const success = !!oneSignalResult.id

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Email sent successfully' : 'Email sending failed',
        notification_id: oneSignalResult.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('send-email error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
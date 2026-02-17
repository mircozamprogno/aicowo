// supabase/functions/register-invited-user/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            invitationToken,
            email,
            password,
            firstName,
            lastName,
            phone
        } = await req.json()

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Validate invitation
        const { data: invitation, error: invError } = await supabaseAdmin
            .from('invitations')
            .select('*')
            .eq('invitation_uuid', invitationToken)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .single()

        if (invError || !invitation) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired invitation' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create user with email already confirmed (no Supabase confirmation needed)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false, // Will confirm via our custom email
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                phone,
                role: invitation.invited_role,
                partner_uuid: invitation.partner_uuid,
                username: `${firstName} ${lastName}`.toLowerCase().replace(' ', '_')
            }
        })

        if (authError) {
            console.error('User creation error:', authError)
            throw authError
        }

        console.log('User created:', authData.user?.id)

        // Generate confirmation link
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'signup',
            email: email
        })

        if (linkError || !linkData) {
            console.error('Link generation error:', linkError)
            throw new Error('Failed to generate confirmation link')
        }

        console.log('Confirmation link generated')

        // Send confirmation email via send-email function
        const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
            body: {
                template_type: 'confirmation_email',
                recipient_email: email,
                partner_uuid: invitation.partner_uuid,
                variables: {
                    confirmation_link: linkData.properties.action_link,
                    user_email: email
                },
                language: 'it'
            }
        })

        if (emailError) {
            console.error('Email sending error:', emailError)
            // Don't fail registration if email fails - user is created
            console.warn('User created but confirmation email failed to send')
        } else {
            console.log('Confirmation email sent:', emailResult)
        }

        // Mark invitation as used
        await supabaseAdmin
            .from('invitations')
            .update({
                status: 'used',
                used_at: new Date().toISOString()
            })
            .eq('invitation_uuid', invitationToken)

        return new Response(
            JSON.stringify({
                success: true,
                user: authData.user,
                email_sent: !emailError,
                message: 'Account created successfully. Please check your email to confirm.'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    } catch (error) {
        console.error('Function error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'An error occurred during registration' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

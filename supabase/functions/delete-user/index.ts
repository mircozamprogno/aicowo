// Supabase Edge Function to delete users completely
// This deletes users from auth.users, profile, customers, and all related data
// Requires service role key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get the JWT from the Authorization header to verify the caller
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const { userId } = await req.json()

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'User ID is required' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        // Create admin client with service role
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Verify the caller has permission (must be authenticated and admin)
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token)

        if (userError || !caller) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                }
            )
        }

        // Check if caller is admin or superadmin
        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single()

        if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin' && callerProfile.role !== 'partner')) {
            return new Response(
                JSON.stringify({ error: `Insufficient permissions. Role '${callerProfile?.role || 'unknown'}' is not allowed to delete users. Admin, superadmin or partner role required.` }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403,
                }
            )
        }

        console.log(`🗑️ Deleting user ${userId} requested by ${caller.email} (${callerProfile.role})`);

        // Step 1: Get profile info to find related customer records
        const { data: profileData } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single()

        if (!profileData) {
            return new Response(
                JSON.stringify({ error: 'User profile not found' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                }
            )
        }

        // Step 2: Find all customer records for this user
        const { data: customers } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('user_id', userId)

        const customerIds = customers?.map((c: any) => c.id) || []
        console.log(`📋 Found ${customerIds.length} customer records to clean up`);

        if (customerIds.length > 0) {
            // Step 3: Find all contracts for these customers
            const { data: contracts } = await supabaseAdmin
                .from('contracts')
                .select('id')
                .in('customer_id', customerIds)

            const contractIds = contracts?.map((c: any) => c.id) || []
            console.log(`📋 Found ${contractIds.length} contracts to clean up`);

            if (contractIds.length > 0) {
                // Step 4: Delete package_reservations (references contracts)
                const { error: reservationsError } = await supabaseAdmin
                    .from('package_reservations')
                    .delete()
                    .in('contract_id', contractIds)

                if (reservationsError) {
                    console.error('Error deleting package_reservations:', reservationsError)
                }

                // Step 5: Delete bookings (references contracts)
                const { error: bookingsError } = await supabaseAdmin
                    .from('bookings')
                    .delete()
                    .in('contract_id', contractIds)

                if (bookingsError) {
                    console.error('Error deleting bookings:', bookingsError)
                }

                // Step 6: Delete contracts
                const { error: contractsError } = await supabaseAdmin
                    .from('contracts')
                    .delete()
                    .in('id', contractIds)

                if (contractsError) {
                    console.error('Error deleting contracts:', contractsError)
                    throw new Error(`Failed to delete contracts: ${contractsError.message}`)
                }
            }

            // Step 7: Delete customers
            const { error: customersError } = await supabaseAdmin
                .from('customers')
                .delete()
                .in('id', customerIds)

            if (customersError) {
                console.error('Error deleting customers:', customersError)
                throw new Error(`Failed to delete customers: ${customersError.message}`)
            }
        }

        // Step 8: Delete activity_logs for this user
        const { error: activityLogsError } = await supabaseAdmin
            .from('activity_logs')
            .delete()
            .eq('user_id', userId)

        if (activityLogsError) {
            console.error('Error deleting activity_logs:', activityLogsError)
        }

        // Step 9: Disconnect customers_discount_codes created by this user
        // Instead of deleting (which might be blocked by contract usage), we SET NULL
        // This unblocks profile deletion while preserving the record's history
        const { error: discountCodesUpdateError } = await supabaseAdmin
            .from('customers_discount_codes')
            .update({ created_by_user_id: null })
            .eq('created_by_user_id', userId)

        if (discountCodesUpdateError) {
            console.error('Error updating customers_discount_codes:', discountCodesUpdateError)
            // We don't throw here as we can still try to delete profile, 
            // but if this failed, Step 10 will likely fail with FK error.
        }

        // Step 10: Delete profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileError) {
            console.error('Error deleting profile:', profileError)
            throw new Error(`Failed to delete profile: ${profileError.message}`)
        }

        // Step 11: Finally delete from auth.users
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
            console.error('Error deleting user from auth:', deleteError)
            return new Response(
                JSON.stringify({ error: deleteError.message }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        console.log('✅ User and all related data deleted successfully');

        return new Response(
            JSON.stringify({
                success: true,
                message: 'User and all related data deleted successfully',
                deletedRecords: {
                    customers: customerIds.length,
                    profile: 1,
                    auth: 1
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: any) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})

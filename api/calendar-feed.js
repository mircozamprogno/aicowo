// /api/calendar-feed.js
// Vercel serverless function for calendar subscription feeds
// Generates iCalendar format feeds for partners and customers

import { createClient } from '@supabase/supabase-js';
import { createEvents } from 'ics';

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get token from query parameter
        const { token } = req.query;

        if (!token) {
            return res.status(401).json({ error: 'Authentication token required' });
        }

        // Initialize Supabase client with service role key for server-side access
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase configuration');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Validate token and get user_id
        const { data: tokenData, error: tokenError } = await supabase
            .from('calendar_tokens')
            .select('user_id')
            .eq('token', token)
            .single();

        if (tokenError || !tokenData) {
            return res.status(401).json({ error: 'Invalid authentication token' });
        }

        const userId = tokenData.user_id;

        // Get user profile to determine role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, partner_uuid')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        let bookings = [];

        // Fetch bookings based on user role
        if (profile.role === 'admin' || profile.role === 'superadmin') {
            // Partner admin: Get all bookings for their partner
            const query = supabase
                .from('bookings')
                .select(`
          id,
          booking_uuid,
          start_date,
          end_date,
          booking_status,
          contracts!inner (
            id,
            contract_number,
            service_name,
            service_type,
            service_cost,
            service_currency
          ),
          location_resources!inner (
            id,
            resource_name,
            resource_type,
            locations!inner (
              id,
              location_name,
              address,
              city
            )
          ),
          customers!inner (
            id,
            first_name,
            second_name,
            company_name,
            email
          )
        `)
                .eq('is_archived', false)
                .in('booking_status', ['active', 'confirmed']);

            if (profile.role === 'admin') {
                query.eq('partner_uuid', profile.partner_uuid);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching partner bookings:', error);
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }

            bookings = data || [];
        } else {
            // Customer: Get only their own bookings
            // First, get customer_id from user_id
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (customerError || !customer) {
                return res.status(404).json({ error: 'Customer profile not found' });
            }

            const { data, error } = await supabase
                .from('bookings')
                .select(`
          id,
          booking_uuid,
          start_date,
          end_date,
          booking_status,
          contracts!inner (
            id,
            contract_number,
            service_name,
            service_type,
            service_cost,
            service_currency
          ),
          location_resources!inner (
            id,
            resource_name,
            resource_type,
            locations!inner (
              id,
              location_name,
              address,
              city
            )
          )
        `)
                .eq('customer_id', customer.id)
                .eq('is_archived', false)
                .in('booking_status', ['active', 'confirmed']);

            if (error) {
                console.error('Error fetching customer bookings:', error);
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }

            bookings = data || [];
        }

        // Convert bookings to iCalendar events
        const events = bookings.map(booking => {
            const isPartner = profile.role === 'admin' || profile.role === 'superadmin';

            // Build event title
            let title = booking.location_resources.resource_name;
            if (isPartner && booking.customers) {
                const customerName = booking.customers.company_name ||
                    `${booking.customers.first_name} ${booking.customers.second_name || ''}`.trim();
                title = `${title} - ${customerName}`;
            }

            // Build description
            const contract = booking.contracts;
            let description = `Service: ${contract.service_name}\n`;
            description += `Type: ${contract.service_type}\n`;
            description += `Contract: ${contract.contract_number}\n`;
            if (contract.service_cost) {
                description += `Cost: ${contract.service_cost} ${contract.service_currency || 'EUR'}\n`;
            }
            if (isPartner && booking.customers) {
                description += `Customer: ${booking.customers.email}\n`;
            }
            description += `Status: ${booking.booking_status}`;

            // Build location
            const location = booking.location_resources.locations;
            const locationStr = [
                location.location_name,
                location.address,
                location.city
            ].filter(Boolean).join(', ');

            // Parse dates (bookings are date-only, treat as all-day events)
            const startDate = new Date(booking.start_date + 'T00:00:00');
            const endDate = new Date(booking.end_date + 'T23:59:59');

            return {
                start: [
                    startDate.getFullYear(),
                    startDate.getMonth() + 1,
                    startDate.getDate()
                ],
                end: [
                    endDate.getFullYear(),
                    endDate.getMonth() + 1,
                    endDate.getDate()
                ],
                title,
                description,
                location: locationStr,
                status: 'CONFIRMED',
                busyStatus: 'BUSY',
                uid: booking.booking_uuid,
                sequence: 0,
                productId: 'powercowo/calendar-feed'
            };
        });

        // Generate iCalendar file
        const { error: icsError, value: icsContent } = createEvents(events);

        if (icsError) {
            console.error('Error generating iCalendar:', icsError);
            return res.status(500).json({ error: 'Failed to generate calendar feed' });
        }

        // Return iCalendar file
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.status(200).send(icsContent);

    } catch (error) {
        console.error('Calendar feed error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

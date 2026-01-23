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

        let allEvents = [];

        // Get today's date for filtering
        const today = new Date().toISOString().split('T')[0];

        // Fetch bookings based on user role
        if (profile.role === 'admin' || profile.role === 'superadmin') {
            // ===== PARTNER ADMIN: Get all bookings and reservations for their partner =====

            // 1. Fetch subscription bookings (multi-day)
            const bookingsQuery = supabase
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
                .in('booking_status', ['active', 'confirmed'])
                .gte('end_date', today);

            if (profile.role === 'admin') {
                bookingsQuery.eq('partner_uuid', profile.partner_uuid);
            }

            const { data: bookingsData, error: bookingsError } = await bookingsQuery;

            if (bookingsError) {
                console.error('Error fetching partner bookings:', bookingsError);
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }

            // 2. Fetch package reservations (single-day)
            const reservationsQuery = supabase
                .from('reservations')
                .select(`
          id,
          reservation_uuid,
          reservation_date,
          reservation_status,
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
                .in('reservation_status', ['active', 'confirmed'])
                .gte('reservation_date', today);

            if (profile.role === 'admin') {
                reservationsQuery.eq('partner_uuid', profile.partner_uuid);
            }

            const { data: reservationsData, error: reservationsError } = await reservationsQuery;

            if (reservationsError) {
                console.error('Error fetching partner reservations:', reservationsError);
                return res.status(500).json({ error: 'Failed to fetch reservations' });
            }

            // Combine and normalize both types
            const normalizedBookings = (bookingsData || []).map(b => ({
                ...b,
                type: 'booking',
                start_date: b.start_date,
                end_date: b.end_date,
                uid: b.booking_uuid,
                status: b.booking_status
            }));

            const normalizedReservations = (reservationsData || []).map(r => ({
                ...r,
                type: 'reservation',
                start_date: r.reservation_date,
                end_date: r.reservation_date, // Single day
                uid: r.reservation_uuid,
                status: r.reservation_status
            }));

            allEvents = [...normalizedBookings, ...normalizedReservations];
            console.log(`[Calendar Feed] Partner ${profile.partner_uuid}: Found ${normalizedBookings.length} bookings + ${normalizedReservations.length} reservations = ${allEvents.length} total events`);

        } else {
            // ===== CUSTOMER: Get only their own bookings and reservations =====

            // First, get customer_id from user_id
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (customerError || !customer) {
                return res.status(404).json({ error: 'Customer profile not found' });
            }

            // 1. Fetch subscription bookings (multi-day)
            const { data: bookingsData, error: bookingsError } = await supabase
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
                .in('booking_status', ['active', 'confirmed'])
                .gte('end_date', today);

            if (bookingsError) {
                console.error('Error fetching customer bookings:', bookingsError);
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }

            // 2. Fetch package reservations (single-day)
            const { data: reservationsData, error: reservationsError } = await supabase
                .from('reservations')
                .select(`
          id,
          reservation_uuid,
          reservation_date,
          reservation_status,
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
                .in('reservation_status', ['active', 'confirmed'])
                .gte('reservation_date', today);

            if (reservationsError) {
                console.error('Error fetching customer reservations:', reservationsError);
                return res.status(500).json({ error: 'Failed to fetch reservations' });
            }

            // Combine and normalize both types
            const normalizedBookings = (bookingsData || []).map(b => ({
                ...b,
                type: 'booking',
                start_date: b.start_date,
                end_date: b.end_date,
                uid: b.booking_uuid,
                status: b.booking_status
            }));

            const normalizedReservations = (reservationsData || []).map(r => ({
                ...r,
                type: 'reservation',
                start_date: r.reservation_date,
                end_date: r.reservation_date, // Single day
                uid: r.reservation_uuid,
                status: r.reservation_status
            }));

            allEvents = [...normalizedBookings, ...normalizedReservations];
            console.log(`[Calendar Feed] Customer ${customer.id}: Found ${normalizedBookings.length} bookings + ${normalizedReservations.length} reservations = ${allEvents.length} total events`);
        }

        // Convert all events to iCalendar format
        const events = allEvents.map(event => {
            const isPartner = profile.role === 'admin' || profile.role === 'superadmin';

            // Build event title
            let title = event.location_resources.resource_name;
            if (isPartner && event.customers) {
                const customerName = event.customers.company_name ||
                    `${event.customers.first_name} ${event.customers.second_name || ''}`.trim();
                title = `${title} - ${customerName}`;
            }

            // Build description
            const contract = event.contracts;
            let description = `Service: ${contract.service_name}\n`;
            description += `Type: ${contract.service_type}\n`;
            description += `Contract: ${contract.contract_number}\n`;
            if (contract.service_cost) {
                description += `Cost: ${contract.service_cost} ${contract.service_currency || 'EUR'}\n`;
            }
            if (isPartner && event.customers) {
                description += `Customer: ${event.customers.email}\n`;
            }
            description += `Status: ${event.status}`;

            // Build location
            const location = event.location_resources.locations;
            const locationStr = [
                location.location_name,
                location.address,
                location.city
            ].filter(Boolean).join(', ');

            // Parse dates for all-day events
            // For iCalendar all-day events, the end date must be EXCLUSIVE (the day after)
            // So if booking is Jan 23-25, the iCal end should be Jan 26
            const startDate = new Date(booking.start_date);
            const endDate = new Date(booking.end_date);

            // Add 1 day to end date to make it exclusive (iCalendar spec for all-day events)
            endDate.setDate(endDate.getDate() + 1);

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
                uid: event.uid,
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

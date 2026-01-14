// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
        const url = new URL(req.url)
        const id = url.searchParams.get('id')
        const type = url.searchParams.get('type') // 'booking' or 'package'
        const download = url.searchParams.get('download') === 'true'

        if (!id || !type) {
            throw new Error('Missing id or type parameters')
        }

        // --------------------------------------------------------------------------------
        // LANDING PAGE STRATEGY
        // To avoid "about:blank" issues with email tracking links, we first serve an HTML
        // page that then triggers the download via Client-Side redirect.
        // --------------------------------------------------------------------------------
        if (!download) {
            // Force HTTPS because Supabase Edge Functions often report http behind the proxy
            const currentUrl = url.toString().replace('http:', 'https:');
            const downloadUrl = `${currentUrl}&download=true`;

            // CSP-Compliant HTML: No inline styles, no scripts. 
            // Uses Meta Refresh for redirect.
            const html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="1;url=${downloadUrl}">
    <title>Download Calendario</title>
</head>
<body>
    <h1>Download Calendario</h1>
    <p>Il download del tuo evento dovrebbe partire automaticamente.</p>
    <p>Se non succede nulla, <a href="${downloadUrl}">clicca qui per scaricare il file .ics</a>.</p>
</body>
</html>`;

            // Use Headers object to be absolutely sure about overrides and case sensitivity
            const headers = new Headers();
            headers.set('Content-Type', 'text/html; charset=utf-8');
            headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

            return new Response(html, {
                status: 200,
                headers: headers
            });
        }

        // --------------------------------------------------------------------------------
        // ICS GENERATION LOGIC (Only runs if download=true)
        // --------------------------------------------------------------------------------

        // Create a Supabase client with the Auth context of the logged in user.
        const supabaseClient = createClient(
            // Supabase API URL - env var automatically injected
            Deno.env.get('SUPABASE_URL') ?? '',
            // Supabase API ANON KEY - env var automatically injected
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        )

        let event = {
            summary: '',
            description: '',
            location: '',
            start: '',
            end: '',
            uid: '',
            isAllDay: false
        }

        if (type === 'booking') {
            const { data: booking, error } = await supabaseClient
                .from('bookings')
                .select(`
          *,
          contracts (
            service_name
          ),
          location_resources (
            resource_name,
            locations (
              location_name,
              address,
              city
            )
          )
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            if (!booking) throw new Error('Booking not found')

            event.summary = `Prenotazione: ${booking.contracts?.service_name || 'Coworking'}`
            event.description = `Risorsa: ${booking.location_resources?.resource_name}`
            event.location = `${booking.location_resources?.locations?.location_name}, ${booking.location_resources?.locations?.address}, ${booking.location_resources?.locations?.city}`

            // Bookings are usually full days or specific times? Assuming full days from start to end based on DB schema usually
            // If it's a date string YYYY-MM-DD
            event.start = booking.start_date.replace(/-/g, '')
            event.end = booking.end_date.replace(/-/g, '')
            // For all day events, end date is exclusive in ICS, so we need to add 1 day or handle it
            // Let's assume for now it's date based. If it has time, we'd parse it.

            // If simple dates, we make them all day
            event.isAllDay = true
            event.uid = `booking-${booking.id}@powercowo.com`

        } else if (type === 'package') {
            const { data: reservation, error } = await supabaseClient
                .from('package_reservations')
                .select(`
          *,
          contracts (
            service_name
          ),
          location_resources (
            resource_name,
            locations (
              location_name,
              address,
              city
            )
          )
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            if (!reservation) throw new Error('Reservation not found')

            event.summary = `Prenotazione: ${reservation.contracts?.service_name || 'Coworking'}`
            event.description = `Risorsa: ${reservation.location_resources?.resource_name} (${reservation.duration_type === 'full_day' ? 'Giornata Intera' : reservation.time_slot === 'morning' ? 'Mattina' : 'Pomeriggio'})`
            event.location = `${reservation.location_resources?.locations?.location_name}, ${reservation.location_resources?.locations?.address}, ${reservation.location_resources?.locations?.city}`
            event.uid = `reservation-${reservation.id}@powercowo.com`

            const dateStr = reservation.reservation_date
            if (reservation.duration_type === 'full_day') {
                event.start = `${dateStr.replace(/-/g, '')}T090000`
                event.end = `${dateStr.replace(/-/g, '')}T180000`
            } else if (reservation.time_slot === 'morning') {
                event.start = `${dateStr.replace(/-/g, '')}T090000`
                event.end = `${dateStr.replace(/-/g, '')}T130000`
            } else { // afternoon
                event.start = `${dateStr.replace(/-/g, '')}T140000`
                event.end = `${dateStr.replace(/-/g, '')}T180000`
            }
            event.isAllDay = false
        }

        // Generate ICS content
        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//PowerCowo//Booking//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${event.uid}`,
            `DTSTAMP:${now}`,
            `SUMMARY:${event.summary}`,
            `DESCRIPTION:${event.description}`,
            `LOCATION:${event.location}`,
            `STATUS:CONFIRMED`,
        ]

        if (event.isAllDay) {
            // Calculate next day for exclusive end date
            const endDate = new Date(event.end.substring(0, 4), parseInt(event.end.substring(4, 6)) - 1, parseInt(event.end.substring(6, 8)))
            endDate.setDate(endDate.getDate() + 1)
            const nextDayStr = endDate.toISOString().slice(0, 10).replace(/-/g, '')

            icsContent.push(`DTSTART;VALUE=DATE:${event.start}`)
            icsContent.push(`DTEND;VALUE=DATE:${nextDayStr}`)
        } else {
            // Assuming Europe/Rome time for simplicity, but cleaner is UTC
            // Here we append 'Z' to treat as UTC or local time?
            // Ideally we'd use VTIMEZONE but that's complex. 
            // Let's use local floating time (no Z) which is usually interpreted as user's local, 
            // OR fix it to structure's time. 
            // Since coworking is physical, time is local to the structure.
            // Easiest is to output local time string: YYYYMMDDTHHMMSS
            icsContent.push(`DTSTART:${event.start}`)
            icsContent.push(`DTEND:${event.end}`)
        }

        icsContent.push('END:VEVENT')
        icsContent.push('END:VCALENDAR')

        const fileContent = icsContent.join('\r\n')

        return new Response(
            fileContent,
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/calendar; charset=utf-8',
                    'Content-Disposition': `attachment; filename="booking.ics"`,
                }
            }
        )

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

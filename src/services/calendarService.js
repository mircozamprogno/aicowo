import logger from '../utils/logger';
import { supabase } from './supabase';

/**
 * Generates an ICS file content string
 * @param {Object} event - Event details
 * @param {string} event.summary - Event title
 * @param {string} event.description - Event description
 * @param {string} event.location - Event location
 * @param {string} event.start - Start date/time (YYYYMMDD or YYYYMMDDTHHMMSS)
 * @param {string} event.end - End date/time
 * @param {string} event.uid - Unique ID
 * @param {boolean} event.isAllDay - Whether it's an all-day event
 * @returns {string} ICS file content
 */
export const generateICSContent = (event) => {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

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
    ];

    if (event.isAllDay) {
        // For all day events, end date is exclusive in ICS, so we need to add 1 day
        // Assuming event.end is YYYYMMDD
        const year = parseInt(event.end.substring(0, 4));
        const month = parseInt(event.end.substring(4, 6)) - 1;
        const day = parseInt(event.end.substring(6, 8));

        const endDate = new Date(year, month, day);
        endDate.setDate(endDate.getDate() + 1);
        const nextDayStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

        icsContent.push(`DTSTART;VALUE=DATE:${event.start}`);
        icsContent.push(`DTEND;VALUE=DATE:${nextDayStr}`);
    } else {
        icsContent.push(`DTSTART:${event.start}`);
        icsContent.push(`DTEND:${event.end}`);
    }

    icsContent.push('END:VEVENT');
    icsContent.push('END:VCALENDAR');

    return icsContent.join('\r\n');
};

/**
 * Generates ICS content and uploads it to Supabase Storage
 * @param {Object} data - Booking or Reservation data
 * @param {string} type - 'booking' or 'package'
 * @param {string} partnerUuid - Partner UUID for storage path
 * @returns {Promise<string>} Public URL of the uploaded ICS file
 */
export const generateAndUploadICS = async (data, type, partnerUuid) => {
    try {
        let event = {
            summary: '',
            description: '',
            location: '',
            start: '',
            end: '',
            uid: '',
            isAllDay: false
        };

        const locationName = data.location_resources?.locations?.location_name || '';
        const address = data.location_resources?.locations?.address || '';
        const city = data.location_resources?.locations?.city || '';
        const fullLocation = [locationName, address, city].filter(Boolean).join(', ');
        const serviceName = data.contracts?.service_name || 'Coworking';
        const resourceName = data.location_resources?.resource_name || '';

        if (type === 'booking') {
            event.summary = `Prenotazione: ${serviceName}`;
            event.description = `Risorsa: ${resourceName}`;
            event.location = fullLocation;
            event.start = data.start_date.replace(/-/g, '');
            event.end = data.end_date.replace(/-/g, '');
            event.isAllDay = true;
            event.uid = `booking-${data.id}@powercowo.com`;
        } else if (type === 'package') {
            event.summary = `Prenotazione: ${serviceName}`;
            const timeSlotLabel = data.duration_type === 'full_day'
                ? 'Giornata Intera'
                : data.time_slot === 'morning' ? 'Mattina' : 'Pomeriggio';

            event.description = `Risorsa: ${resourceName} (${timeSlotLabel})`;
            event.location = fullLocation;
            event.uid = `reservation-${data.id}@powercowo.com`;

            const dateStr = data.reservation_date;
            if (data.duration_type === 'full_day') {
                event.start = `${dateStr.replace(/-/g, '')}T090000`;
                event.end = `${dateStr.replace(/-/g, '')}T180000`;
            } else if (data.time_slot === 'morning') {
                event.start = `${dateStr.replace(/-/g, '')}T090000`;
                event.end = `${dateStr.replace(/-/g, '')}T130000`;
            } else { // afternoon
                event.start = `${dateStr.replace(/-/g, '')}T140000`;
                event.end = `${dateStr.replace(/-/g, '')}T180000`;
            }
            event.isAllDay = false;
        }

        const icsContent = generateICSContent(event);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const fileName = `${partnerUuid}/calendars/${type}-${data.id}.ics`;

        const { error: uploadError } = await supabase.storage
            .from('partners')
            .upload(fileName, blob, {
                contentType: 'text/calendar;charset=utf-8',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from('partners')
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;

    } catch (error) {
        logger.error('Error creating ICS file:', error);
        return null;
    }
};

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create the real Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);


export const reservationService = {
  // Get all reservations for a customer
  async getCustomerReservations(customerId) {
    const { data, error } = await supabase
      .from('package_reservations')
      .select(`
        *,
        contracts (
          id,
          contract_number,
          service_name,
          service_type
        ),
        location_resources (
          id,
          resource_name,
          resource_type,
          locations (
            id,
            location_name
          )
        )
      `)
      .eq('customer_id', customerId)
      .eq('reservation_status', 'confirmed')
      .order('reservation_date', { ascending: false });

    return { data, error };
  },

  // Get reservations for a specific date and resource
  async getResourceReservations(locationResourceId, date) {
    const { data, error } = await supabase
      .from('package_reservations')
      .select('*')
      .eq('location_resource_id', locationResourceId)
      .eq('reservation_date', date)
      .eq('reservation_status', 'confirmed');

    return { data, error };
  },

  // Check if a time slot is available
  async checkTimeSlotAvailability(locationResourceId, date, durationType, timeSlot = null) {
    const { data: reservations, error } = await this.getResourceReservations(locationResourceId, date);
    
    if (error) return { available: false, error: error.message };

    // For full day bookings, check if any reservation exists
    if (durationType === 'full_day') {
      return { 
        available: reservations.length === 0,
        conflictReason: reservations.length > 0 ? 'Resource already booked for this date' : null
      };
    }

    // For half day bookings, check specific time slot
    const hasFullDayConflict = reservations.some(res => res.duration_type === 'full_day');
    const hasTimeSlotConflict = reservations.some(res => 
      res.duration_type === 'half_day' && res.time_slot === timeSlot
    );

    if (hasFullDayConflict) {
      return { 
        available: false, 
        conflictReason: 'Resource booked for full day on this date' 
      };
    }

    if (hasTimeSlotConflict) {
      return { 
        available: false, 
        conflictReason: `${timeSlot === 'morning' ? 'Morning' : 'Afternoon'} slot already booked` 
      };
    }

    return { available: true };
  },

  // Create a new reservation
  async createReservation(reservationData) {
    const { data, error } = await supabase
      .from('package_reservations')
      .insert([reservationData])
      .select(`
        *,
        contracts (
          contract_number,
          service_name
        ),
        location_resources (
          resource_name,
          resource_type,
          locations (
            location_name
          )
        )
      `)
      .single();

    return { data, error };
  },

  // Cancel a reservation
  async cancelReservation(reservationId) {
    const { data, error } = await supabase
      .from('package_reservations')
      .update({ 
        reservation_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId)
      .select()
      .single();

    return { data, error };
  },

  // Get package contracts for a customer with remaining entries
  async getAvailablePackageContracts(customerId) {
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        services (
          id,
          service_name,
          service_type,
          location_resources!fk_services_location_resource (
            id,
            resource_name,
            resource_type,
            locations (
              id,
              location_name
            )
          )
        ),
        locations (
          id,
          location_name
        )
      `)
      .eq('customer_id', customerId)
      .eq('contract_status', 'active')
      .eq('services.service_type', 'pacchetto')
      .gte('service_max_entries', supabase.raw('entries_used + 0.5')) // At least 0.5 entries remaining
      .lte('start_date', new Date().toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0]);

    return { data, error };
  }
};


// For development/testing, you can temporarily use mock data
// but the authentication will go through real Supabase
export default supabase;
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


// Add these functions to the existing supabase.js file

// Archive service functions
export const archiveService = {
  // Get active contracts (non-archived)
  async getActiveContracts(partnerUuid, userRole, userId = null) {
    let query = supabase
      .from('contracts')
      .select(`
        *,
        customers (
          id,
          first_name,
          second_name,
          email,
          company_name
        ),
        services (
          id,
          service_name,
          service_type
        ),
        locations (
          id,
          location_name
        )
      `)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    // Apply role-based filters
    if (userRole === 'user') {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customerData) {
        query = query.eq('customer_id', customerData.id);
      } else {
        return { data: [], error: null };
      }
    } else if (userRole === 'admin') {
      query = query.eq('partner_uuid', partnerUuid);
    }

    return await query;
  },

  // Get active bookings (non-archived, from non-archived contracts)
  async getActiveBookings(partnerUuid, userRole, userId = null) {
    let query = supabase
      .from('bookings')
      .select(`
        id,
        start_date,
        end_date,
        booking_status,
        contracts!inner (
          id,
          contract_number,
          service_name,
          service_type,
          service_cost,
          service_currency,
          is_archived
        ),
        location_resources (
          id,
          resource_name,
          resource_type,
          locations (
            id,
            location_name
          )
        ),
        customers (
          id,
          first_name,
          second_name,
          email,
          company_name
        )
      `)
      .eq('booking_status', 'active')
      .eq('is_archived', false)
      .eq('contracts.is_archived', false)
      .order('start_date');

    // Apply role-based filters
    if (userRole === 'user') {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customerData) {
        query = query.eq('customer_id', customerData.id);
      } else {
        return { data: [], error: null };
      }
    } else if (userRole === 'admin') {
      query = query.eq('partner_uuid', partnerUuid);
    }

    return await query;
  },

  // Get active package reservations (non-archived, from non-archived contracts)
  async getActivePackageReservations(partnerUuid, userRole, userId = null) {
    let query = supabase
      .from('package_reservations')
      .select(`
        id,
        reservation_date,
        duration_type,
        time_slot,
        reservation_status,
        contracts!inner (
          id,
          contract_number,
          service_name,
          service_type,
          service_cost,
          service_currency,
          is_archived
        ),
        location_resources (
          id,
          resource_name,
          resource_type,
          locations (
            id,
            location_name
          )
        ),
        customers (
          id,
          first_name,
          second_name,
          email,
          company_name
        )
      `)
      .eq('reservation_status', 'confirmed')
      .eq('is_archived', false)
      .eq('contracts.is_archived', false)
      .order('reservation_date');

    // Apply role-based filters
    if (userRole === 'user') {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customerData) {
        query = query.eq('customer_id', customerData.id);
      } else {
        return { data: [], error: null };
      }
    } else if (userRole === 'admin') {
      query = query.eq('partner_uuid', partnerUuid);
    }

    return await query;
  },

  // Check if contract has related active data that would be affected by archiving
  async checkContractDependencies(contractId) {
    try {
      // Check for active bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('contract_id', contractId)
        .eq('is_archived', false)
        .eq('booking_status', 'active');

      if (bookingsError) throw bookingsError;

      // Check for active package reservations
      const { data: reservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('id')
        .eq('contract_id', contractId)
        .eq('is_archived', false)
        .eq('reservation_status', 'confirmed');

      if (reservationsError) throw reservationsError;

      return {
        hasActiveBookings: (bookings || []).length > 0,
        hasActiveReservations: (reservations || []).length > 0,
        activeBookingsCount: (bookings || []).length,
        activeReservationsCount: (reservations || []).length
      };

    } catch (error) {
      console.error('Error checking contract dependencies:', error);
      return {
        hasActiveBookings: false,
        hasActiveReservations: false,
        activeBookingsCount: 0,
        activeReservationsCount: 0,
        error: error.message
      };
    }
  },

  // Bulk archive old contracts (utility function for maintenance)
  async bulkArchiveExpiredContracts(daysAfterExpiry = 30, partnerUuid = null) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAfterExpiry);

      let query = supabase
        .from('contracts')
        .select('id, contract_number, end_date')
        .eq('is_archived', false)
        .lt('end_date', cutoffDate.toISOString().split('T')[0]);

      if (partnerUuid) {
        query = query.eq('partner_uuid', partnerUuid);
      }

      const { data: expiredContracts, error: selectError } = await query;

      if (selectError) throw selectError;

      if (!expiredContracts || expiredContracts.length === 0) {
        return {
          success: true,
          archivedCount: 0,
          message: 'No expired contracts found to archive'
        };
      }

      const now = new Date().toISOString();
      const contractIds = expiredContracts.map(c => c.id);

      // Archive expired contracts
      const { error: archiveError } = await supabase
        .from('contracts')
        .update({
          is_archived: true,
          archived_at: now,
          archive_reason: `Automatically archived - expired more than ${daysAfterExpiry} days ago`,
          updated_at: now
        })
        .in('id', contractIds);

      if (archiveError) throw archiveError;

      // Archive related bookings
      await supabase
        .from('bookings')
        .update({
          is_archived: true,
          archived_at: now,
          archive_reason: `Contract automatically archived`,
          updated_at: now
        })
        .in('contract_id', contractIds)
        .eq('is_archived', false);

      // Archive related package reservations
      await supabase
        .from('package_reservations')
        .update({
          is_archived: true,
          archived_at: now,
          archive_reason: `Contract automatically archived`,
          updated_at: now
        })
        .in('contract_id', contractIds)
        .eq('is_archived', false);

      return {
        success: true,
        archivedCount: contractIds.length,
        archivedContracts: expiredContracts.map(c => c.contract_number)
      };

    } catch (error) {
      console.error('Error in bulk archive operation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// For development/testing, you can temporarily use mock data
// but the authentication will go through real Supabase
export default supabase;
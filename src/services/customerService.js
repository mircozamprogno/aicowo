// Customer service for handling automatic customer registration
import { supabase } from './supabase';

class CustomerService {
  /**
   * Automatically create a customer record when a user registers
   * This should be called after successful user registration
   * @param {Object} userData - User registration data
   * @param {string} userId - Supabase user ID
   * @param {string} partnerUuid - Partner UUID for tenant isolation
   * @returns {Promise<Object>} - Created customer record
   */
  async createCustomerFromRegistration(userData, userId, partnerUuid) {
    try {
      console.log('Creating customer record for new user:', {
        userId,
        partnerUuid,
        userData
      });

      // Prepare customer data from user registration
      const customerData = {
        user_id: userId,
        partner_uuid: partnerUuid,
        first_name: userData.first_name || '',
        second_name: userData.last_name || '',
        email: userData.email || '',
        customer_type: 'individual', // Default to individual
        customer_status: 'active',
        country: 'Italy', // Default country
        created_at: new Date().toISOString()
      };

      // Insert customer record
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (error) {
        console.error('Error creating customer record:', error);
        throw error;
      }

      console.log('Customer record created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in createCustomerFromRegistration:', error);
      throw error;
    }
  }

  /**
   * Get customer data for a specific user
   * @param {string} userId - Supabase user ID
   * @returns {Promise<Object|null>} - Customer record or null
   */
  async getCustomerByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching customer by user ID:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getCustomerByUserId:', error);
      return null;
    }
  }

  /**
   * Update customer data
   * @param {string} customerId - Customer ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated customer record
   */
  async updateCustomer(customerId, updateData) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .select()
        .single();

      if (error) {
        console.error('Error updating customer:', error);
        throw error;
      }

      console.log('Customer updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in updateCustomer:', error);
      throw error;
    }
  }

  /**
   * Get all customers for a partner (admin view)
   * @param {string} partnerUuid - Partner UUID
   * @returns {Promise<Array>} - Array of customer records
   */
  async getCustomersByPartner(partnerUuid) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('partner_uuid', partnerUuid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customers by partner:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCustomersByPartner:', error);
      return [];
    }
  }

  /**
   * Create or update customer record (upsert functionality)
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>} - Customer record
   */
  async upsertCustomer(customerData) {
    try {
      // Check if customer exists by user_id
      if (customerData.user_id) {
        const existingCustomer = await this.getCustomerByUserId(customerData.user_id);
        
        if (existingCustomer) {
          // Update existing customer
          return await this.updateCustomer(existingCustomer.id, customerData);
        }
      }
      
      // Create new customer
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (error) {
        console.error('Error upserting customer:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in upsertCustomer:', error);
      throw error;
    }
  }

  /**
   * Ensure customer record exists for user (create if missing)
   * @param {string} userId - User ID
   * @param {string} partnerUuid - Partner UUID
   * @param {Object} userProfile - User profile data
   * @returns {Promise<Object>} - Customer record
   */
  async ensureCustomerRecord(userId, partnerUuid, userProfile = {}) {
    try {
      // Check if customer record exists
      let customer = await this.getCustomerByUserId(userId);
      
      if (!customer) {
        // Create customer record from user profile
        const customerData = {
          user_id: userId,
          partner_uuid: partnerUuid,
          first_name: userProfile.first_name || '',
          second_name: userProfile.last_name || '',
          email: userProfile.email || '',
          customer_type: 'individual',
          customer_status: 'active',
          country: 'Italy'
        };
        
        customer = await this.upsertCustomer(customerData);
        console.log('Created missing customer record:', customer);
      }
      
      return customer;
    } catch (error) {
      console.error('Error ensuring customer record:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const customerService = new CustomerService();
export default customerService;
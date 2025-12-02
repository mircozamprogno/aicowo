// Fixed customerService.js to handle database conflicts properly

import logger from '../utils/logger';
import { supabase } from './supabase';

class CustomerService {
  /**
   * Get customer data for a specific user
   * @param {string} userId - Supabase user ID
   * @returns {Promise<Object|null>} - Customer record or null
   */
  async getCustomerByUserId(userId) {
    try {
      logger.log('Fetching customer for user ID:', userId);
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no record found

      if (error) {
        logger.error('Error fetching customer by user ID:', error);
        return null;
      }

      logger.log('Customer fetch result:', data);
      return data;
    } catch (error) {
      logger.error('Error in getCustomerByUserId:', error);
      return null;
    }
  }

  /**
   * Automatically create a customer record when a user registers
   * @param {Object} userData - User registration data
   * @param {string} userId - Supabase user ID
   * @param {string} partnerUuid - Partner UUID for tenant isolation
   * @returns {Promise<Object>} - Created customer record
   */
  async createCustomerFromRegistration(userData, userId, partnerUuid) {
    try {
      logger.log('Creating customer record for new user:', {
        userId,
        partnerUuid,
        userData
      });

      // First check if customer already exists to avoid conflicts
      const existingCustomer = await this.getCustomerByUserId(userId);
      if (existingCustomer) {
        logger.log('Customer record already exists:', existingCustomer);
        return existingCustomer;
      }

      // Prepare customer data from user registration
      const customerData = {
        user_id: userId,
        partner_uuid: partnerUuid,
        first_name: userData.first_name || '',
        second_name: userData.last_name || '',
        email: userData.email || '',
        customer_type: 'individual',
        customer_status: 'incomplete_profile', // Set to incomplete_profile for new customers
        country: 'Italy',
        created_at: new Date().toISOString()
      };

      // Insert customer record with conflict handling
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .maybeSingle();

      if (error) {
        // If it's a conflict error (duplicate), try to fetch existing record
        if (error.code === '23505' || error.message.includes('duplicate')) {
          logger.log('Duplicate customer detected, fetching existing record...');
          const existing = await this.getCustomerByUserId(userId);
          if (existing) {
            return existing;
          }
        }
        logger.error('Error creating customer record:', error);
        throw error;
      }

      logger.log('Customer record created successfully:', data);
      return data;
    } catch (error) {
      logger.error('Error in createCustomerFromRegistration:', error);
      throw error;
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
        logger.error('Error updating customer:', error);
        throw error;
      }

      logger.log('Customer updated successfully:', data);
      return data;
    } catch (error) {
      logger.error('Error in updateCustomer:', error);
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
      logger.log('Ensuring customer record exists for:', { userId, partnerUuid });

      // Check if customer record exists
      let customer = await this.getCustomerByUserId(userId);
      
      if (!customer) {
        logger.log('No customer record found, creating one...');
        
        // Prepare the user data for the registration method
        const userData = {
          first_name: userProfile.first_name || '',
          last_name: userProfile.last_name || '', // Note: using last_name here to match registration format
          email: userProfile.email || ''
        };
        
        // Use the registration method which properly sets incomplete_profile status
        customer = await this.createCustomerFromRegistration(
          userData, 
          userId, 
          partnerUuid
        );
        
        logger.log('Created missing customer record with incomplete_profile status:', customer);
      } else {
        logger.log('Customer record already exists:', customer);
      }
      
      return customer;
    } catch (error) {
      logger.error('Error ensuring customer record:', error);
      // Don't throw here - let the application continue even if customer creation fails
      // This prevents blocking the login process
      return null;
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
        logger.error('Error fetching customers by partner:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getCustomersByPartner:', error);
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
      
      // Create new customer using the conflict-safe method
      return await this.createCustomerFromRegistration(
        customerData,
        customerData.user_id,
        customerData.partner_uuid
      );
    } catch (error) {
      logger.error('Error in upsertCustomer:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const customerService = new CustomerService();
export default customerService;
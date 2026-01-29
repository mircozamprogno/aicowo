// src/services/userDeletionService.js
// Service for complete user deletion via Supabase Edge Function

import logger from '../utils/logger';
import { supabase } from './supabase';

/**
 * Completely delete a user from the system
 * This will delete:
 * - All package_reservations for the user's contracts
 * - All bookings for the user's contracts
 * - All contracts for the user's customers
 * - All customer records for the user
 * - All activity_logs for the user
 * - The user's profile
 * - The user from auth.users
 * 
 * @param {string} userId - The auth user ID to delete
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const deleteUserCompletely = async (userId) => {
    try {
        logger.log(`🗑️ Initiating complete deletion for user: ${userId}`);

        // Get the current session to pass the auth token
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            throw new Error('No active session');
        }

        // Get the Supabase URL from the client
        const supabaseUrl = supabase.supabaseUrl;

        // Call the delete-user edge function
        const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId }),
        });

        const result = await response.json();

        if (!response.ok) {
            logger.error('Edge function error:', result);
            return {
                success: false,
                error: result.error || 'Failed to delete user'
            };
        }

        logger.log('✅ User deleted successfully:', result);
        return {
            success: true,
            data: result
        };

    } catch (error) {
        logger.error('Error in deleteUserCompletely:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Delete a customer and optionally their user account
 * 
 * @param {number} customerId - The customer ID to delete
 * @param {boolean} deleteUserAccount - Whether to also delete the user's auth account
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const deleteCustomer = async (customerId, deleteUserAccount = false) => {
    try {
        logger.log(`🗑️ Deleting customer ${customerId}, deleteUserAccount: ${deleteUserAccount}`);

        if (deleteUserAccount) {
            // First, get the customer's user_id
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('user_id')
                .eq('id', customerId)
                .single();

            if (customerError) {
                throw customerError;
            }

            if (!customer || !customer.user_id) {
                throw new Error('Customer has no associated user account');
            }

            // Use the edge function to delete everything
            return await deleteUserCompletely(customer.user_id);
        } else {
            // Just delete the customer record (contracts and related data should cascade)
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', customerId);

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: { message: 'Customer deleted successfully' }
            };
        }

    } catch (error) {
        logger.error('Error in deleteCustomer:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export default {
    deleteUserCompletely,
    deleteCustomer
};

// src/services/contractArchiveService.js
import logger from '../utils/logger';
import { supabase } from './supabase';

export class ContractArchiveService {
  /**
   * Archive a contract and its related bookings/reservations
   * @param {number} contractId - The contract ID to archive
   * @param {string} userId - The user ID performing the archive
   * @param {string} reason - The reason for archiving
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  static async archiveContract(contractId, userId, reason = 'Deleted by user') {
    try {
      // Start a transaction-like operation
      const now = new Date().toISOString();

      // 1. Archive the contract
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .update({
          is_archived: true,
          archived_at: now,
          archived_by_user_id: userId,
          archive_reason: reason,
          updated_at: now
        })
        .eq('id', contractId)
        .eq('is_archived', false) // Only archive if not already archived
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
        .single();

      if (contractError) {
        throw new Error(`Failed to archive contract: ${contractError.message}`);
      }

      if (!contractData) {
        throw new Error('Contract not found or already archived');
      }

      // 2. Archive related bookings
      const { error: bookingsError } = await supabase
        .from('bookings')
        .update({
          is_archived: true,
          archived_at: now,
          archived_by_user_id: userId,
          archive_reason: `Contract archived: ${reason}`,
          updated_at: now
        })
        .eq('contract_id', contractId)
        .eq('is_archived', false);

      if (bookingsError) {
        logger.error('Error archiving related bookings:', bookingsError);
        // Don't fail the whole operation for this
      }

      // 3. Archive related package reservations
      const { error: reservationsError } = await supabase
        .from('package_reservations')
        .update({
          is_archived: true,
          archived_at: now,
          archived_by_user_id: userId,
          archive_reason: `Contract archived: ${reason}`,
          updated_at: now
        })
        .eq('contract_id', contractId)
        .eq('is_archived', false);

      if (reservationsError) {
        logger.error('Error archiving related package reservations:', reservationsError);
        // Don't fail the whole operation for this
      }

      return {
        success: true,
        data: contractData
      };

    } catch (error) {
      logger.error('Error in archiveContract:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore an archived contract and its related data
   * @param {number} contractId - The contract ID to restore
   * @param {string} userId - The user ID performing the restore
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  static async restoreContract(contractId, userId) {
    try {
      const now = new Date().toISOString();

      // 1. Restore the contract
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by_user_id: null,
          archive_reason: null,
          updated_at: now
        })
        .eq('id', contractId)
        .eq('is_archived', true) // Only restore if archived
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
        .single();

      if (contractError) {
        throw new Error(`Failed to restore contract: ${contractError.message}`);
      }

      if (!contractData) {
        throw new Error('Contract not found or not archived');
      }

      // 2. Restore related bookings
      const { error: bookingsError } = await supabase
        .from('bookings')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by_user_id: null,
          archive_reason: null,
          updated_at: now
        })
        .eq('contract_id', contractId)
        .eq('is_archived', true);

      if (bookingsError) {
        logger.error('Error restoring related bookings:', bookingsError);
      }

      // 3. Restore related package reservations
      const { error: reservationsError } = await supabase
        .from('package_reservations')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by_user_id: null,
          archive_reason: null,
          updated_at: now
        })
        .eq('contract_id', contractId)
        .eq('is_archived', true);

      if (reservationsError) {
        logger.error('Error restoring related package reservations:', reservationsError);
      }

      return {
        success: true,
        data: contractData
      };

    } catch (error) {
      logger.error('Error in restoreContract:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get archived contracts for a partner
   * @param {string} partnerUuid - The partner UUID
   * @param {string} userRole - The user role ('user', 'admin', 'superadmin')
   * @param {string} userId - The user ID (for customer role)
   * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
   */
  static async getArchivedContracts(partnerUuid, userRole, userId = null) {
    try {
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
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      // Apply role-based filters
      if (userRole === 'user') {
        // For customers, get their customer ID first
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (customerData) {
          query = query.eq('customer_id', customerData.id);
        } else {
          // No customer record found
          return { success: true, data: [] };
        }
      } else if (userRole === 'admin') {
        query = query.eq('partner_uuid', partnerUuid);
      }
      // superadmin sees all archived contracts

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch archived contracts: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      logger.error('Error in getArchivedContracts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get archive analytics for dashboard
   * @param {string} partnerUuid - The partner UUID
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  static async getArchiveAnalytics(partnerUuid) {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('archived_at, service_type, service_cost')
        .eq('partner_uuid', partnerUuid)
        .eq('is_archived', true);

      if (error) {
        throw new Error(`Failed to fetch archive analytics: ${error.message}`);
      }

      const analytics = {
        totalArchived: data.length,
        archivedThisMonth: 0,
        archivedThisYear: 0,
        totalArchivedValue: 0,
        byServiceType: {
          abbonamento: 0,
          pacchetto: 0,
          free_trial: 0
        }
      };

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      data.forEach(contract => {
        const archivedDate = new Date(contract.archived_at);
        
        // Count by time period
        if (archivedDate.getFullYear() === currentYear) {
          analytics.archivedThisYear++;
          if (archivedDate.getMonth() === currentMonth) {
            analytics.archivedThisMonth++;
          }
        }

        // Sum total value
        analytics.totalArchivedValue += contract.service_cost || 0;

        // Count by service type
        if (analytics.byServiceType.hasOwnProperty(contract.service_type)) {
          analytics.byServiceType[contract.service_type]++;
        }
      });

      return {
        success: true,
        data: analytics
      };

    } catch (error) {
      logger.error('Error in getArchiveAnalytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Permanently delete archived contracts older than specified days
   * @param {number} daysOld - Delete contracts archived more than this many days ago
   * @param {string} partnerUuid - The partner UUID (optional, for partner-specific cleanup)
   * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
   */
  static async permanentlyDeleteOldArchived(daysOld = 365, partnerUuid = null) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let query = supabase
        .from('contracts')
        .select('id')
        .eq('is_archived', true)
        .lt('archived_at', cutoffDate.toISOString());

      if (partnerUuid) {
        query = query.eq('partner_uuid', partnerUuid);
      }

      const { data: contractsToDelete, error: selectError } = await query;

      if (selectError) {
        throw new Error(`Failed to find old archived contracts: ${selectError.message}`);
      }

      if (!contractsToDelete || contractsToDelete.length === 0) {
        return {
          success: true,
          deletedCount: 0
        };
      }

      const contractIds = contractsToDelete.map(c => c.id);

      // Delete in order: reservations -> bookings -> contracts
      await supabase
        .from('package_reservations')
        .delete()
        .in('contract_id', contractIds);

      await supabase
        .from('bookings')
        .delete()
        .in('contract_id', contractIds);

      const { error: deleteError } = await supabase
        .from('contracts')
        .delete()
        .in('id', contractIds);

      if (deleteError) {
        throw new Error(`Failed to permanently delete contracts: ${deleteError.message}`);
      }

      return {
        success: true,
        deletedCount: contractIds.length
      };

    } catch (error) {
      logger.error('Error in permanentlyDeleteOldArchived:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
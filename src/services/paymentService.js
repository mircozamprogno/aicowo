// src/services/paymentService.js

import logger from '../utils/logger';
import { supabase } from './supabase';

export class PaymentService {
  /**
   * Get all payments for a contract
   */
  static async getContractPayments(contractId) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          contracts!inner(
            contract_number,
            service_cost,
            service_currency,
            customers(first_name, second_name, email, company_name)
          )
        `)
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error fetching contract payments:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Get payment status for contracts
   */
  static async getContractPaymentStatus(contractIds = []) {
    try {
      let query = supabase.from('contract_payment_status').select('*');
      
      if (contractIds.length > 0) {
        query = query.in('contract_id', contractIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error fetching contract payment status:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Create a new payment record
   */

  static async createPayment(paymentData) {
    try {
      // Generate payment number if not provided
      if (!paymentData.payment_number) {
        const { data: numberData, error: numberError } = await supabase
          .rpc('generate_payment_number');
        
        if (numberError) throw numberError;
        paymentData.payment_number = numberData;
      }

      const { data, error } = await supabase
        .from('payments')
        .insert([{
          ...paymentData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select(`
          id,
          payment_number,
          amount,
          currency,
          payment_method,
          payment_status,
          payment_type,
          payment_date,
          due_date,
          transaction_reference,
          notes,
          receipt_url,
          created_at,
          contracts!inner(
            contract_number,
            service_cost,
            service_currency,
            customers(first_name, second_name, email, company_name)
          )
        `)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error creating payment:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Update an existing payment
   */
  static async updatePayment(paymentId, updates) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select(`
          *,
          contracts!inner(
            contract_number,
            service_cost,
            service_currency,
            customers(first_name, second_name, email, company_name)
          )
        `)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error updating payment:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Delete a payment record
   */
  static async deletePayment(paymentId) {
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      logger.error('Error deleting payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark payment as completed
   */
  static async markPaymentAsCompleted(paymentId, userId, paymentDate = null) {
    try {
      const updates = {
        payment_status: 'completed',
        processed_by: userId,
        payment_date: paymentDate || new Date().toISOString()
      };

      return await this.updatePayment(paymentId, updates);
    } catch (error) {
      logger.error('Error marking payment as completed:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Get payments by partner
   */
  static async getPartnerPayments(partnerUuid, filters = {}) {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          contracts!inner(
            id,
            contract_number,
            service_cost,
            service_currency,
            service_name,
            start_date,
            end_date,
            customers(first_name, second_name, email, company_name),
            locations(location_name)
          )
        `)
        .eq('partner_uuid', partnerUuid);

      // Apply filters
      if (filters.status) {
        query = query.eq('payment_status', filters.status);
      }
      if (filters.method) {
        query = query.eq('payment_method', filters.method);
      }
      if (filters.dateFrom) {
        query = query.gte('payment_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('payment_date', filters.dateTo);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error fetching partner payments:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Get payment statistics for dashboard
   */
  static async getPaymentStats(partnerUuid, period = 'month') {
    try {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const { data, error } = await supabase
        .from('payments')
        .select('amount, payment_status, payment_method, payment_date')
        .eq('partner_uuid', partnerUuid)
        .gte('payment_date', startDate.toISOString());

      if (error) throw error;

      // Calculate statistics
      const stats = {
        totalPayments: data.length,
        completedPayments: data.filter(p => p.payment_status === 'completed').length,
        pendingPayments: data.filter(p => p.payment_status === 'pending').length,
        failedPayments: data.filter(p => p.payment_status === 'failed').length,
        totalRevenue: data
          .filter(p => p.payment_status === 'completed')
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
        pendingRevenue: data
          .filter(p => p.payment_status === 'pending')
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
        paymentMethods: data.reduce((acc, p) => {
          acc[p.payment_method] = (acc[p.payment_method] || 0) + 1;
          return acc;
        }, {})
      };

      return { data: stats, error: null };
    } catch (error) {
      logger.error('Error fetching payment stats:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Get overdue payments
   */
  static async getOverduePayments(partnerUuid) {
    try {
      const { data, error } = await supabase
        .from('contract_payment_status')
        .select(`
          *,
          contracts!inner(
            id,
            contract_number,
            service_name,
            start_date,
            end_date,
            customers(first_name, second_name, email, company_name),
            locations(location_name)
          )
        `)
        .eq('contracts.partner_uuid', partnerUuid)
        .eq('is_overdue', true)
        .order('next_due_date', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error fetching overdue payments:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Create payment plan
   */
  static async createPaymentPlan(planData) {
    try {
      const { data, error } = await supabase
        .from('payment_plans')
        .insert([{
          ...planData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error creating payment plan:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Update payment plan
   */
  static async updatePaymentPlan(planId, updates) {
    try {
      const { data, error } = await supabase
        .from('payment_plans')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error updating payment plan:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Get payment plan for contract
   */
  static async getContractPaymentPlan(contractId) {
    try {
      const { data, error } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('contract_id', contractId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return { data, error: error?.code === 'PGRST116' ? null : error };
    } catch (error) {
      logger.error('Error fetching payment plan:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Upload payment receipt
   */
  static async uploadPaymentReceipt(paymentId, file) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-${paymentId}-${Date.now()}.${fileExt}`;
      const filePath = `payments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Update payment record with receipt URL
      const { error: updateError } = await supabase
        .from('payments')
        .update({ receipt_url: data.publicUrl })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      return { data: data.publicUrl, error: null };
    } catch (error) {
      logger.error('Error uploading payment receipt:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Bulk mark payments as paid
   */
  static async bulkMarkAsPaid(paymentIds, userId) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'completed',
          processed_by: userId,
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', paymentIds)
        .select();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error bulk updating payments:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Generate payment report
   */
  static async generatePaymentReport(partnerUuid, filters = {}) {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          contracts!inner(
            contract_number,
            service_name,
            service_cost,
            service_currency,
            customers(first_name, second_name, email, company_name),
            locations(location_name)
          )
        `)
        .eq('partner_uuid', partnerUuid);

      // Apply date range filter
      if (filters.startDate) {
        query = query.gte('payment_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('payment_date', filters.endDate);
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('payment_status', filters.status);
      }

      // Apply method filter
      if (filters.method && filters.method !== 'all') {
        query = query.eq('payment_method', filters.method);
      }

      query = query.order('payment_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Process data for export
      const reportData = data.map(payment => ({
        payment_number: payment.payment_number,
        contract_number: payment.contracts.contract_number,
        customer_name: payment.contracts.customers.company_name || 
          `${payment.contracts.customers.first_name} ${payment.contracts.customers.second_name}`,
        customer_email: payment.contracts.customers.email,
        service_name: payment.contracts.service_name,
        location: payment.contracts.locations?.location_name || 'N/A',
        amount: payment.amount,
        currency: payment.currency,
        payment_method: payment.payment_method,
        payment_status: payment.payment_status,
        payment_date: payment.payment_date,
        due_date: payment.due_date,
        transaction_reference: payment.transaction_reference,
        notes: payment.notes
      }));

      return { data: reportData, error: null };
    } catch (error) {
      logger.error('Error generating payment report:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Calculate payment terms due date
   */
  static calculateDueDate(startDate, paymentTerms = 'net_30') {
    const start = new Date(startDate);
    let daysToAdd;

    switch (paymentTerms) {
      case 'immediate':
        daysToAdd = 0;
        break;
      case 'net_7':
        daysToAdd = 7;
        break;
      case 'net_15':
        daysToAdd = 15;
        break;
      case 'net_30':
        daysToAdd = 30;
        break;
      case 'net_45':
        daysToAdd = 45;
        break;
      case 'net_60':
        daysToAdd = 60;
        break;
      default:
        daysToAdd = 30;
    }

    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate;
  }

  /**
   * Validate payment amount
   */
  static validatePaymentAmount(amount, contractCost, existingPayments = []) {
    const totalPaid = existingPayments
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    const remainingAmount = contractCost - totalPaid;
    
    return {
      isValid: amount <= remainingAmount && amount > 0,
      remainingAmount,
      totalPaid,
      wouldOverpay: amount > remainingAmount
    };
  }
}
// services/fattureInCloudService.js
import logger from '../utils/logger';
import { supabase } from './supabase';

export class FattureInCloudService {
  static async uploadContract(contract, partnerSettings, t) {
    try {
      logger.log('=== FattureInCloud Upload Debug ===');
      logger.log('Uploading contract to FattureInCloud:', contract.id);
      logger.log('Contract data:', contract);
      logger.log('Partner settings:', partnerSettings);

      // Validate partner has FattureInCloud enabled
      if (!partnerSettings?.fattureincloud_enabled) {
        throw new Error('FattureInCloud integration not enabled for this partner');
      }

      if (!partnerSettings?.fattureincloud_api_token || !partnerSettings?.fattureincloud_company_id) {
        throw new Error('FattureInCloud API credentials not configured');
      }

      // Get full customer data
      const customerData = await this.getCustomerData(contract.customer_id);
      logger.log('Customer data:', customerData);
      
      // Build FattureInCloud document payload
      const documentData = this.buildDocumentPayload(contract, customerData, partnerSettings, t);
      logger.log('Document payload:', JSON.stringify(documentData, null, 2));

      // Prepare the request
      const requestUrl = `${supabase.supabaseUrl}/functions/v1/fattureincloud`;
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      };
      const requestBody = {
        contract,
        partnerSettings,
        documentData
      };

      logger.log('=== API Request Debug ===');
      logger.log('Request URL:', requestUrl);
      logger.log('Request Headers:', requestHeaders);
      logger.log('Request Body:', JSON.stringify(requestBody, null, 2));
      logger.log('Supabase URL:', supabase.supabaseUrl);
      logger.log('Supabase Key (first 20 chars):', supabase.supabaseKey?.substring(0, 20) + '...');

      // Make the API call
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      logger.log('=== API Response Debug ===');
      logger.log('Response status:', response.status);
      logger.log('Response statusText:', response.statusText);
      logger.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        logger.log('Error response body (text):', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          logger.log('Error response body (JSON):', errorData);
        } catch (e) {
          logger.log('Error response is not valid JSON');
          errorData = { message: errorText };
        }
        
        throw new Error(`FattureInCloud API error (${response.status}): ${errorData.message || errorText || response.statusText}`);
      }

      const result = await response.json();
      logger.log('=== Success Response ===');
      logger.log('FattureInCloud upload successful:', result);

      // Record the upload in our database
      await this.recordUpload(contract.id, result.data.id, result.data.number);

      return {
        success: true,
        data: result.data,
        invoice_id: result.data.id,
        invoice_number: result.data.number
      };

    } catch (error) {
      logger.error('=== Upload Error ===');
      logger.error('Error uploading to FattureInCloud:', error);
      logger.error('Error stack:', error.stack);
      
      // Record failed attempt
      await this.recordUploadAttempt(contract.id, false, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getCustomerData(customerId) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      throw new Error(`Error fetching customer data: ${error.message}`);
    }

    return data;
  }

  static buildDocumentPayload(contract, customer, partnerSettings, t) {
    const contractStartDate = new Date(contract.start_date);
    const contractEndDate = new Date(contract.end_date);
    const dueDate = this.calculateDueDate(contract.start_date, contract.payment_terms || 'net_30');

    return {
      data: {
        type: partnerSettings.fattureincloud_document_type || "proforma",
        numeration: "",
        subject: `Contract: ${contract.service_name}`,
        visible_subject: `Service contract for ${contract.service_name} - Period: ${contractStartDate.toLocaleDateString()} to ${contractEndDate.toLocaleDateString()}`,
        amount_net: parseFloat(contract.service_cost),
        amount_vat: this.calculateVAT(contract.service_cost, 22), // Assuming 22% VAT
        amount_due_discount: 0,
        entity: {
          name: customer.company_name || `${customer.first_name} ${customer.second_name}`,
          vat_number: customer.piva || "",
          tax_code: customer.codice_fiscale || customer.piva || "",
          address_street: customer.address || "",
          address_postal_code: customer.postal_code || "",
          address_city: customer.city || "",
          address_province: customer.province || "",
          address_extra: customer.address_extra || "",
          country: customer.country || "Italia",
          certified_email: customer.pec_email || "",
          ei_code: customer.sdi_code || ""
        },
        date: contractStartDate.toISOString().split('T')[0],
        next_due_date: dueDate,
        items_list: [
          {
            code: this.generateItemCode(contract.service_type),
            name: contract.service_name,
            measure: contract.service_type === 'pacchetto' ? 'Nr.' : 'Mese',
            net_price: parseFloat(contract.service_cost),
            gross_price: parseFloat(contract.service_cost) * 1.22,
            apply_withholding_taxes: false,
            discount: 0,
            discount_highlight: false,
            in_dn: false,
            qty: 1,
            vat: {
              id: 0,
              value: 22,
              description: "Aliquota ordinaria"
            }
          }
        ],
        payments_list: [
          {
            amount: parseFloat(contract.service_cost) * 1.22,
            due_date: dueDate,
            payment_terms: {
              days: this.getPaymentTermsDays(contract.payment_terms),
              type: "standard"
            },
            status: "not_paid"
          }
        ]
      }
    };
  }

  static calculateVAT(amount, vatRate = 22) {
    return parseFloat((parseFloat(amount) * vatRate / 100).toFixed(2));
  }

  static calculateDueDate(startDate, paymentTerms) {
    const start = new Date(startDate);
    const days = this.getPaymentTermsDays(paymentTerms);
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate.toISOString().split('T')[0];
  }

  static getPaymentTermsDays(paymentTerms) {
    const terms = {
      'net_15': 15,
      'net_30': 30,
      'net_45': 45,
      'net_60': 60,
      'immediate': 0
    };
    return terms[paymentTerms] || 30;
  }

  static generateItemCode(serviceType) {
    const codes = {
      'abbonamento': 'SUB',
      'pacchetto': 'PKG',
      'free_trial': 'TRL'
    };
    return codes[serviceType] || 'SRV';
  }

  static calculateQuantity(contract) {
    if (contract.service_type === 'pacchetto') {
      return contract.service_max_entries || 1;
    }
    
    // For subscriptions, calculate months
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                   (end.getMonth() - start.getMonth());
    return Math.max(1, months);
  }

  static async recordUpload(contractId, invoiceId, invoiceNumber) {
    const { error } = await supabase
      .from('contract_fattureincloud_uploads')
      .insert([{
        contract_id: contractId,
        fattureincloud_invoice_id: invoiceId,
        fattureincloud_invoice_number: invoiceNumber,
        uploaded_at: new Date().toISOString(),
        upload_status: 'success'
      }]);

    if (error) {
      logger.error('Error recording upload:', error);
    }
  }

  static async recordUploadAttempt(contractId, success, errorMessage = null) {
    const { error } = await supabase
      .from('contract_fattureincloud_uploads')
      .insert([{
        contract_id: contractId,
        upload_status: success ? 'success' : 'failed',
        error_message: errorMessage,
        uploaded_at: new Date().toISOString()
      }]);

    if (error) {
      logger.error('Error recording upload attempt:', error);
    }
  }

  static async getUploadStatus(contractIds) {
    const { data, error } = await supabase
      .from('contract_fattureincloud_uploads')
      .select('*')
      .in('contract_id', contractIds)
      .eq('upload_status', 'success')
      .order('uploaded_at', { ascending: false });

    if (error) {
      logger.error('Error getting upload status:', error);
      return {};
    }

    // Convert to map for easy lookup
    const statusMap = {};
    data.forEach(upload => {
      if (!statusMap[upload.contract_id]) {
        statusMap[upload.contract_id] = upload;
      }
    });

    return statusMap;
  }

  static async getPartnerSettings(partnerUuid) {
    const { data, error } = await supabase
      .from('partners')
      .select('fattureincloud_enabled, fattureincloud_api_token, fattureincloud_company_id, fattureincloud_document_type')
      .eq('partner_uuid', partnerUuid)
      .single();

    if (error) {
      logger.error('Error getting partner settings:', error);
      return null;
    }

    return data;
  }

  static async bulkUploadContracts(contractIds, partnerUuid, t) {
    const results = [];
    const partnerSettings = await this.getPartnerSettings(partnerUuid);

    if (!partnerSettings?.fattureincloud_enabled) {
      throw new Error('FattureInCloud integration not enabled');
    }

    for (const contractId of contractIds) {
      try {
        // Get contract data
        const { data: contract, error } = await supabase
          .from('contracts')
          .select(`
            *,
            customers (*),
            services (*),
            locations (*)
          `)
          .eq('id', contractId)
          .single();

        if (error) {
          results.push({
            contractId,
            success: false,
            error: `Error fetching contract: ${error.message}`
          });
          continue;
        }

        const result = await this.uploadContract(contract, partnerSettings, t);
        results.push({
          contractId,
          contractNumber: contract.contract_number,
          ...result
        });

        // Add delay between uploads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        results.push({
          contractId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  static async fetchClients(companyId, accessToken, partnerUuid) {
    try {
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('fattureincloud_client_id, customer_status')
        .eq('partner_uuid', partnerUuid)
        .not('fattureincloud_client_id', 'is', null);

      // Only exclude ACTIVE customers, include inactive ones
      const activeClientIds = new Set(
        existingCustomers
          ?.filter(c => c.customer_status !== 'inactive')
          .map(c => c.fattureincloud_client_id) || []
      );

      logger.log('📋 Active customer IDs to exclude:', Array.from(activeClientIds));

      // Get user session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Call through Supabase Edge Function instead of direct API
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/fattureincloud`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'fetch_clients',
            companyId,
            accessToken
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Edge function error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const availableClients = result.data.filter(
        client => !activeClientIds.has(client.id)
      );

      logger.log('✅ Available clients for import:', availableClients.length);

      return { success: true, clients: availableClients };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async fetchClientDetails(companyId, clientId, accessToken) {
    try {
      // Get user session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/fattureincloud`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'fetch_client_details',
            companyId,
            clientId,
            accessToken
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Edge function error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async importClients(selectedClientIds, companyId, accessToken, partnerUuid) {
    const results = [];

    for (const clientId of selectedClientIds) {
      try {
        const detailsResult = await this.fetchClientDetails(companyId, clientId, accessToken);
        
        if (!detailsResult.success) {
          results.push({ clientId, success: false, error: detailsResult.error });
          continue;
        }

        const client = detailsResult.data;

        // Log full JSON from FattureInCloud for debugging
        logger.log('=== FULL FATTUREINCLOUD CLIENT DATA ===');
        logger.log(`Client ID: ${clientId}`);
        logger.log('Complete JSON:', JSON.stringify(client, null, 2));
        logger.log('========================================');

        // Check if customer already exists (including inactive)
        const { data: existingCustomer, error: checkError } = await supabase
          .from('customers')
          .select('id, customer_status')
          .eq('partner_uuid', partnerUuid)
          .eq('fattureincloud_client_id', clientId)
          .maybeSingle();

        if (checkError) {
          logger.error('❌ Error checking existing customer:', checkError);
          results.push({ clientId, success: false, error: checkError.message });
          continue;
        }

        const customerData = {
          partner_uuid: partnerUuid,
          fattureincloud_client_id: client.id,
          company_name: client.name || '',
          first_name: client.first_name || '',
          second_name: client.last_name || '',
          piva: client.vat_number || null,
          codice_fiscale: client.tax_code || null,
          address: client.address_street || '',
          zip: client.address_postal_code || '',
          city: client.address_city || '',
          country: client.country || '',
          email: client.email || `noemail-${client.id}@imported.fc`,
          pec: client.certified_email || '',
          phone: client.phone || '',
          sdi_code: client.ei_code || '',
          customer_status: 'active', // Set to active (or reactivate)
          customer_type: client.name ? 'entrepeneur' : 'individual',
          updated_at: new Date().toISOString()
        };

        logger.log('📦 Mapped customer data:', JSON.stringify(customerData, null, 2));

        let data, error;

        if (existingCustomer) {
          // Update existing customer (reactivate if inactive)
          logger.log(`🔄 Updating existing customer ${existingCustomer.id} (status: ${existingCustomer.customer_status})`);
          
          const result = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existingCustomer.id)
            .select()
            .single();

          data = result.data;
          error = result.error;

          if (!error) {
            logger.log(`✅ Customer ${existingCustomer.id} updated and reactivated`);
          }
        } else {
          // Insert new customer
          logger.log('➕ Creating new customer');
          customerData.created_at = new Date().toISOString();

          const result = await supabase
            .from('customers')
            .insert(customerData)
            .select()
            .single();

          data = result.data;
          error = result.error;

          if (!error) {
            logger.log('✅ New customer created');
          }
        }

        results.push(error ? 
          { clientId, success: false, error: error.message } : 
          { clientId, success: true, data }
        );
      } catch (error) {
        logger.error(`❌ Error importing client ${clientId}:`, error);
        results.push({ clientId, success: false, error: error.message });
      }
    }

    return results;
  }
}
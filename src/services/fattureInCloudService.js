// services/fattureInCloudService.js
import { supabase } from './supabase';

export class FattureInCloudService {
  static async uploadContract(contract, partnerSettings, t) {
    try {
      // console.log('=== FattureInCloud Upload Debug ===');
      // console.log('Uploading contract to FattureInCloud:', contract.id);
      // console.log('Contract data:', contract);
      // console.log('Partner settings:', partnerSettings);

      // Validate partner has FattureInCloud enabled
      if (!partnerSettings?.fattureincloud_enabled) {
        throw new Error('FattureInCloud integration not enabled for this partner');
      }

      if (!partnerSettings?.fattureincloud_api_token || !partnerSettings?.fattureincloud_company_id) {
        throw new Error('FattureInCloud API credentials not configured');
      }

      // Get full customer data
      const customerData = await this.getCustomerData(contract.customer_id);
      // console.log('Customer data:', customerData);
      
      // Build FattureInCloud document payload
      const documentData = this.buildDocumentPayload(contract, customerData, partnerSettings, t);
      // console.log('Document payload:', JSON.stringify(documentData, null, 2));

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

      // console.log('=== API Request Debug ===');
      // console.log('Request URL:', requestUrl);
      // console.log('Request Headers:', requestHeaders);
      // console.log('Request Body:', JSON.stringify(requestBody, null, 2));
      // console.log('Supabase URL:', supabase.supabaseUrl);
      // console.log('Supabase Key (first 20 chars):', supabase.supabaseKey?.substring(0, 20) + '...');

      // Make the API call
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      // console.log('=== API Response Debug ===');
      // console.log('Response status:', response.status);
      // console.log('Response statusText:', response.statusText);
      // console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body (text):', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.log('Error response body (JSON):', errorData);
        } catch (e) {
          console.log('Error response is not valid JSON');
          errorData = { message: errorText };
        }
        
        throw new Error(`FattureInCloud API error (${response.status}): ${errorData.message || errorText || response.statusText}`);
      }

      const result = await response.json();
      console.log('=== Success Response ===');
      console.log('FattureInCloud upload successful:', result);

      // Record the upload in our database
      await this.recordUpload(contract.id, result.data.id, result.data.number);

      return {
        success: true,
        data: result.data,
        invoice_id: result.data.id,
        invoice_number: result.data.number
      };

    } catch (error) {
      console.error('=== Upload Error ===');
      console.error('Error uploading to FattureInCloud:', error);
      console.error('Error stack:', error.stack);
      
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
      console.error('Error recording upload:', error);
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
      console.error('Error recording upload attempt:', error);
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
      console.error('Error getting upload status:', error);
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
      console.error('Error getting partner settings:', error);
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

  // Add after bulkUploadContracts method:

  static async fetchClients(companyId, accessToken, partnerUuid) {
    try {
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('fattureincloud_client_id')
        .eq('partner_uuid', partnerUuid)
        .not('fattureincloud_client_id', 'is', null);

      const existingClientIds = new Set(existingCustomers?.map(c => c.fattureincloud_client_id) || []);

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
        console.error('Edge function error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const availableClients = result.data.filter(
        client => !existingClientIds.has(client.id)
      );

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
        console.error('Edge function error response:', errorText);
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
        const customerData = {
          partner_uuid: partnerUuid,
          fattureincloud_client_id: client.id,  // ✅ ADD THIS
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
          customer_status: 'tobequalified',
          customer_type: client.name ? 'entrepeneur' : 'individual',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };


        console.log('🔍 Inserting customer:', {
          name: customerData.company_name,
          email: customerData.email,
          piva: customerData.piva,
          pec: customerData.pec
        });

        const { data, error } = await supabase
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        results.push(error ? 
          { clientId, success: false, error: error.message } : 
          { clientId, success: true, data }
        );
      } catch (error) {
        results.push({ clientId, success: false, error: error.message });
      }
    }

    return results;
  }
}
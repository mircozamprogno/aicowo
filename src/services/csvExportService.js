// src/services/csvExportService.js

/**
 * CSV Export Service for Contracts
 * Handles exporting contract data with customer information for invoicing purposes
 */

import { supabase } from './supabase';

export const CSVExportService = {
  /**
   * Export contracts to CSV format
   * @param {Array} contracts - Array of contract objects
   * @param {Function} t - Translation function
   * @returns {string} CSV content
   */
  async exportContractsToCSV(contracts, t) {
    try {
      // Fetch complete customer data with all fields needed for invoicing
      const contractsWithFullData = await Promise.all(
        contracts.map(async (contract) => {
          let fullCustomerData = contract.customers;
          let locationData = null;

          // Fetch complete customer data if we have customer_id
          if (contract.customer_id) {
            try {
              const { data: customerData, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', contract.customer_id)
                .single();

              if (!customerError && customerData) {
                fullCustomerData = customerData;
              }
            } catch (error) {
              console.warn('Error fetching customer data for contract:', contract.id, error);
            }
          }

          // Fetch location data with VAT information
          if (contract.location_id) {
            try {
              const { data: locationInfo, error: locationError } = await supabase
                .from('locations')
                .select('*')
                .eq('id', contract.location_id)
                .single();

              if (!locationError && locationInfo) {
                locationData = locationInfo;
              }
            } catch (error) {
              console.warn('Error fetching location data for contract:', contract.id, error);
            }
          }

          return {
            ...contract,
            customers: fullCustomerData,
            location_data: locationData
          };
        })
      );

      // Define CSV headers with translations
      const headers = [
        t('contracts.contractNumber') || 'Numero Contratto',
        t('contracts.status') || 'Stato',
        t('contracts.startDate') || 'Data Inizio',
        t('contracts.endDate') || 'Data Fine',
        t('contracts.duration') || 'Durata (giorni)',
        t('common.createdAt') || 'Data Creazione',
        
        // Customer information
        t('customers.companyName') || 'Ragione Sociale',
        t('customers.firstName') || 'Nome',
        t('customers.lastName') || 'Cognome',
        t('customers.email') || 'Email',
        t('customers.phone') || 'Telefono',
        t('customers.address') || 'Indirizzo',
        t('customers.zip') || 'CAP',
        t('customers.city') || 'Città',
        t('customers.country') || 'Paese',
        t('customers.codiceFiscale') || 'Codice Fiscale',
        t('customers.piva') || 'P.IVA',
        
        // Service information
        t('services.serviceName') || 'Nome Servizio',
        t('services.type') || 'Tipo Servizio',
        t('contracts.resource') || 'Risorsa',
        t('contracts.resourceType') || 'Tipo Risorsa',
        
        // Package specific
        t('contracts.maxEntries') || 'Ingressi Massimi',
        t('contracts.entriesUsed') || 'Ingressi Utilizzati',
        t('reservations.entriesRemaining') || 'Ingressi Rimanenti',
        
        // Financial information
        t('contracts.baseAmount') || 'Importo Base',
        t('contracts.currency') || 'Valuta',
        t('contracts.vatPercentage') || 'IVA (%)',
        t('contracts.vatAmount') || 'Importo IVA',
        t('contracts.total') || 'Totale',
        
        // Payment information
        t('contracts.requiresPayment') || 'Richiede Pagamento',
        t('contracts.paymentTerms') || 'Termini di Pagamento'
      ];

      // Helper function to format date in Italian format
      const formatDateIT = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('it-IT');
      };

      // Helper function to calculate contract duration
      const calculateDuration = (startDate, endDate) => {
        if (!startDate || !endDate) return '';
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end - start;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      };

      // Helper function to get service type translation
      const getServiceTypeLabel = (type) => {
        if (!type) return '';
        const types = {
          abbonamento: t('services.subscription') || 'Abbonamento',
          pacchetto: t('services.package') || 'Pacchetto',
          free_trial: t('services.freeTrial') || 'Prova Gratuita'
        };
        return types[type] || type;
      };

      // Helper function to get resource type translation
      const getResourceTypeLabel = (type) => {
        if (!type) return '';
        const types = {
          scrivania: t('locations.scrivania') || 'Scrivania',
          sala_riunioni: t('locations.salaRiunioni') || 'Sala Riunioni'
        };
        return types[type] || type;
      };

      // Helper function to get payment terms translation
      const getPaymentTermsLabel = (terms) => {
        if (!terms) return '';
        const termLabels = {
          immediate: t('payments.immediate') || 'Immediato',
          net_15: t('payments.net15') || 'Netto 15 giorni',
          net_30: t('payments.net30') || 'Netto 30 giorni',
          net_60: t('payments.net60') || 'Netto 60 giorni'
        };
        return termLabels[terms] || terms;
      };

      // Helper function to escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // If contains comma, quotes, or newlines, wrap in quotes and escape internal quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Generate CSV content
      let csvContent = headers.map(header => escapeCSV(header)).join(',') + '\n';

      contractsWithFullData.forEach(contract => {
        const customer = contract.customers || {};
        
        // Calculate financial values
        const baseAmount = parseFloat(contract.service_cost) || 0;
        const vatPercentage = parseFloat(contract.location_data?.vat_percentage) || 0;
        const vatAmount = baseAmount * (vatPercentage / 100);
        const totalAmount = baseAmount + vatAmount;
        
        // Calculate package entries
        const maxEntries = contract.service_max_entries || '';
        const usedEntries = contract.entries_used || 0;
        const remainingEntries = maxEntries ? maxEntries - usedEntries : '';

        const row = [
          contract.contract_number || '',
          t(`contracts.${contract.contract_status}`) || contract.contract_status || '',
          formatDateIT(contract.start_date),
          formatDateIT(contract.end_date),
          calculateDuration(contract.start_date, contract.end_date),
          formatDateIT(contract.created_at),
          
          // Customer data
          customer.company_name || '',
          customer.first_name || '',
          customer.second_name || '',
          customer.email || '',
          customer.phone || '',
          customer.address || '',
          customer.zip || '',
          customer.city || '',
          customer.country || '',
          customer.codice_fiscale || '',
          customer.piva || '',
          
          // Service data
          contract.service_name || '',
          getServiceTypeLabel(contract.service_type),
          contract.resource_name || '',
          getResourceTypeLabel(contract.resource_type),
          
          // Package data
          maxEntries,
          usedEntries,
          remainingEntries,
          
          // Financial data
          baseAmount.toFixed(2),
          contract.service_currency || 'EUR',
          vatPercentage.toFixed(1),
          vatAmount.toFixed(2),
          totalAmount.toFixed(2),
          
          // Payment data
          contract.requires_payment ? (t('common.yes') || 'Sì') : (t('common.no') || 'No'),
          getPaymentTermsLabel(contract.payment_terms)
        ];

        csvContent += row.map(field => escapeCSV(field)).join(',') + '\n';
      });

      return csvContent;

    } catch (error) {
      console.error('Error generating CSV:', error);
      throw new Error('Failed to generate CSV export');
    }
  },

  /**
   * Download CSV file
   * @param {string} csvContent - The CSV content
   * @param {string} filename - The filename for the download
   */
  downloadCSV(csvContent, filename) {
    try {
      // Create blob with UTF-8 BOM for proper Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });

      // Create download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading CSV:', error);
      throw new Error('Failed to download CSV file');
    }
  },

  /**
   * Generate filename for CSV export
   * @returns {string} Formatted filename
   */
  generateFilename() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `contracts-export-${year}-${month}-${day}.csv`;
  }
};
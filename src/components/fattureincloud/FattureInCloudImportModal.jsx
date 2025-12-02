import { CheckCircle, Download, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { FattureInCloudService } from '../../services/fattureInCloudService';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const FattureInCloudImportModal = ({ isOpen, onClose, partnerSettings, partnerUuid, onImportSuccess }) => {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState([]);

  useEffect(() => {
    if (isOpen && partnerSettings?.fattureincloud_enabled) {
      fetchClients();
      setSelectedClients(new Set()); // Reset selection when modal opens
      setImportResults([]); // Reset results
    }
  }, [isOpen]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const result = await FattureInCloudService.fetchClients(
        partnerSettings.fattureincloud_company_id,
        partnerSettings.fattureincloud_api_token,
        partnerUuid
      );
      
      if (result.success) {
        logger.log('✅ Fetched clients:', result.clients.map(c => ({ id: c.id, name: c.name })));
        setClients(result.clients);
      } else {
        toast.error(`Failed to fetch clients: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Error fetching clients: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(clients.map(c => c.id));
      logger.log('📋 Selecting all clients:', Array.from(allIds));
      setSelectedClients(allIds);
    } else {
      logger.log('📋 Deselecting all clients');
      setSelectedClients(new Set());
    }
  };

  const handleSelectClient = (clientId, checked) => {
    logger.log(`📌 ${checked ? 'Selecting' : 'Deselecting'} client:`, clientId);
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    logger.log('📋 Current selection:', Array.from(newSelected));
    setSelectedClients(newSelected);
  };

  const handleImport = async () => {
    const selectedArray = Array.from(selectedClients);
    
    if (selectedArray.length === 0) {
      toast.error('Please select at least one client to import');
      return;
    }

    logger.log('🚀 Starting import for clients:', selectedArray);
    setImporting(true);
    setImportResults([]);

    try {
      const results = await FattureInCloudService.importClients(
        selectedArray,
        partnerSettings.fattureincloud_company_id,
        partnerSettings.fattureincloud_api_token,
        partnerUuid
      );

      logger.log('📊 Import results:', results);
      setImportResults(results);

      // Get successfully imported client IDs
      const successfulClientIds = results
        .filter(r => r.success)
        .map(r => r.clientId);
      
      logger.log('✅ Successfully imported client IDs:', successfulClientIds);

      // Remove successfully imported clients from the list
      setClients(prev => {
        const updated = prev.filter(c => !successfulClientIds.includes(c.id));
        logger.log('📋 Remaining clients after removal:', updated.map(c => ({ id: c.id, name: c.name })));
        return updated;
      });

      // COMPLETELY CLEAR the selection
      logger.log('🧹 Clearing all selections');
      setSelectedClients(new Set());

      const successCount = successfulClientIds.length;
      const totalCount = results.length;

      if (successCount === totalCount) {
        toast.success(`Successfully imported ${successCount} clients!`);
        onImportSuccess && onImportSuccess();
      } else if (successCount > 0) {
        toast.info(`Imported ${successCount}/${totalCount} clients`);
      } else {
        toast.error('Failed to import any clients');
      }

    } catch (error) {
      logger.error('❌ Import error:', error);
      toast.error(`Import error: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container bulk-upload-modal">
        <div className="modal-header">
          <h2 className="modal-title">Import Clients from FattureInCloud</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <p>Loading clients...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="no-eligible-contracts">
              <p>No clients available to import.</p>
            </div>
          ) : (
            <>
              <div className="bulk-upload-controls">
                <div className="select-all">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedClients.size > 0 && selectedClients.size === clients.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={importing}
                  />
                  <label htmlFor="select-all">
                    Select All ({clients.length} clients)
                  </label>
                </div>
              </div>

              <div className="contracts-selection">
                {clients.map((client) => {
                  const result = importResults.find(r => r.clientId === client.id);
                  const isSelected = selectedClients.has(client.id);
                  
                  return (
                    <div key={client.id} className="contract-selection-item">
                      <div className="contract-checkbox">
                        <input
                          type="checkbox"
                          id={`client-${client.id}`}
                          checked={isSelected}
                          onChange={(e) => handleSelectClient(client.id, e.target.checked)}
                          disabled={importing || result?.success}
                        />
                      </div>
                      
                      <div className="contract-info">
                        <div className="contract-number">{client.name}</div>
                        <div className="contract-details">
                          {client.vat_number && `P.IVA: ${client.vat_number}`}
                          {client.email && ` - ${client.email}`}
                          {client.address_city && ` - ${client.address_city}`}
                        </div>
                      </div>

                      {result && (
                        <div className={`upload-result ${result.success ? 'success' : 'error'}`}>
                          {result.success ? (
                            <>
                              <CheckCircle size={16} className="text-green-600" />
                              <span>Imported</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} className="text-red-600" />
                              <span title={result.error}>Failed</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={importing}
          >
            Close
          </button>
          
          {clients.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              className="btn-primary"
              disabled={importing || selectedClients.size === 0}
            >
              {importing ? (
                <>Importing...</>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Import Selected ({selectedClients.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FattureInCloudImportModal;
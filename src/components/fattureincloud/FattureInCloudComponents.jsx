// components/fattureincloud/FattureInCloudUploadButton.jsx
import { CheckCircle, Clock, Upload } from 'lucide-react';
import { useState } from 'react';
import { FattureInCloudService } from '../../services/fattureInCloudService';
import { toast } from '../common/ToastContainer';

const FattureInCloudUploadButton = ({ 
  contract, 
  partnerSettings, 
  uploadStatus, 
  onUploadSuccess 
}) => {
  const [uploading, setUploading] = useState(false);

  // Check if partner has FattureInCloud enabled
  if (!partnerSettings?.fattureincloud_enabled) {
    return null;
  }

  // Check if already uploaded
  const isUploaded = uploadStatus && uploadStatus.upload_status === 'success';

  const handleUpload = async () => {
    setUploading(true);

    try {
      const result = await FattureInCloudService.uploadContract(contract, partnerSettings);
      
      if (result.success) {
        toast.success(`Invoice uploaded successfully! Number: ${result.invoice_number}`);
        onUploadSuccess && onUploadSuccess(result);
      } else {
        toast.error(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (isUploaded) {
    return (
      <div className="fattureincloud-status uploaded" title="Uploaded to FattureInCloud">
        <CheckCircle size={16} className="text-green-600" />
        <span className="text-xs">#{uploadStatus.fattureincloud_invoice_number}</span>
      </div>
    );
  }

  return (
    <button
      className="fattureincloud-upload-btn"
      onClick={handleUpload}
      disabled={uploading}
      title="Upload to FattureInCloud"
    >
      {uploading ? (
        <Clock size={16} className="animate-spin" />
      ) : (
        <Upload size={16} />
      )}
      {uploading ? 'Uploading...' : 'Upload to F.C.'}
    </button>
  );
};

// components/fattureincloud/BulkUploadModal.jsx
import { X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

const BulkUploadModal = ({ 
  isOpen, 
  onClose, 
  contracts, 
  partnerSettings, 
  uploadStatuses,
  partnerUuid
}) => {
  const [selectedContracts, setSelectedContracts] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);

  // Filter eligible contracts (not already uploaded)
  const eligibleContracts = contracts.filter(contract => {
    const isUploaded = uploadStatuses[contract.id]?.upload_status === 'success';
    return !isUploaded && contract.requires_payment !== false && contract.service_type !== 'free_trial';
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedContracts(new Set());
      setUploadResults([]);
    }
  }, [isOpen]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedContracts(new Set(eligibleContracts.map(c => c.id)));
    } else {
      setSelectedContracts(new Set());
    }
  };

  const handleSelectContract = (contractId, checked) => {
    const newSelected = new Set(selectedContracts);
    if (checked) {
      newSelected.add(contractId);
    } else {
      newSelected.delete(contractId);
    }
    setSelectedContracts(newSelected);
  };

  const handleBulkUpload = async () => {
    if (selectedContracts.size === 0) {
      toast.error('Please select at least one contract to upload');
      return;
    }

    setUploading(true);
    setUploadResults([]);

    try {
      const contractIds = Array.from(selectedContracts);
      const results = await FattureInCloudService.bulkUploadContracts(
        contractIds, 
        partnerUuid
      );

      setUploadResults(results);

      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      if (successCount === totalCount) {
        toast.success(`All ${successCount} invoices uploaded successfully!`);
      } else {
        toast.info(`${successCount}/${totalCount} invoices uploaded successfully`);
      }

    } catch (error) {
      toast.error(`Bulk upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container bulk-upload-modal">
        <div className="modal-header">
          <h2 className="modal-title">Bulk Upload to FattureInCloud</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {eligibleContracts.length === 0 ? (
            <div className="no-eligible-contracts">
              <p>No contracts eligible for upload. All contracts are either already uploaded or don't require invoicing.</p>
            </div>
          ) : (
            <>
              <div className="bulk-upload-controls">
                <div className="select-all">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedContracts.size === eligibleContracts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={uploading}
                  />
                  <label htmlFor="select-all">
                    Select All ({eligibleContracts.length} contracts)
                  </label>
                </div>
              </div>

              <div className="contracts-selection">
                {eligibleContracts.map((contract) => {
                  const result = uploadResults.find(r => r.contractId === contract.id);
                  
                  return (
                    <div key={contract.id} className="contract-selection-item">
                      <div className="contract-checkbox">
                        <input
                          type="checkbox"
                          id={`contract-${contract.id}`}
                          checked={selectedContracts.has(contract.id)}
                          onChange={(e) => handleSelectContract(contract.id, e.target.checked)}
                          disabled={uploading || result?.success}
                        />
                      </div>
                      
                      <div className="contract-info">
                        <div className="contract-number">{contract.contract_number}</div>
                        <div className="contract-details">
                          {contract.customers?.company_name || 
                           `${contract.customers?.first_name} ${contract.customers?.second_name}`} - 
                          {contract.service_name} - €{contract.service_cost}
                        </div>
                      </div>

                      {result && (
                        <div className={`upload-result ${result.success ? 'success' : 'error'}`}>
                          {result.success ? (
                            <>
                              <CheckCircle size={16} className="text-green-600" />
                              <span>Uploaded #{result.data?.number}</span>
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
            disabled={uploading}
          >
            Close
          </button>
          
          {eligibleContracts.length > 0 && (
            <button
              type="button"
              onClick={handleBulkUpload}
              className="btn-primary"
              disabled={uploading || selectedContracts.size === 0}
            >
              {uploading ? (
                <>
                  <Clock size={16} className="animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  Upload Selected ({selectedContracts.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { BulkUploadModal, FattureInCloudUploadButton };

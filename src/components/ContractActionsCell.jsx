import {
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit2,
  MoreVertical,
  Trash2,
  Upload
} from 'lucide-react';
import { useState } from 'react';
import '../styles/components/contractaction.css';

const ContractActionsCell = ({ 
  contract, 
  canManagePayments,
  canEditContracts,
  isPartnerAdmin,
  isSuperAdmin,
  generatingPDF,
  onGeneratePDF,
  onRecordPayment,
  onPaymentHistory,
  onEditContract,
  onPackageBooking,
  onDeleteContract,
  canBookPackage,
  getBookButtonText,
  isInRange,
  t,
  partnerSettings,
  uploadStatus,
  onUploadSuccess
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canBook = canBookPackage(contract);

  console.log('Testing translation:', t('contracts.actions.downloadPDF'));
  console.log('Testing translation type:', typeof t('contracts.actions.downloadPDF'));
  
  // Check if already uploaded to FattureInCloud
  const isUploaded = uploadStatus && uploadStatus.upload_status === 'success';

  const handleFattureInCloudUpload = async () => {
    if (isUploaded || uploading) return;
    
    setUploading(true);
    try {
      // Import the service dynamically to avoid circular imports
      const { FattureInCloudService } = await import('../services/fattureInCloudService');
      const result = await FattureInCloudService.uploadContract(contract, partnerSettings, t);
      
      if (result.success) {
        // Show success feedback
        console.log(`Invoice uploaded successfully! Number: ${result.invoice_number}`);
        onUploadSuccess && onUploadSuccess(result);
      } else {
        console.error(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // NO PRIMARY ACTIONS - Everything goes in dropdown now
  const primaryActions = [].filter(action => action.show);

  const secondaryActions = [
    // PDF MOVED TO DROPDOWN AS FIRST ITEM
    {
      key: 'pdf',
      icon: generatingPDF === contract.id ? 
        <div className="loading-spinner-small"></div> : 
        <Download size={14} />,
      label: t('contracts.actions.downloadPDF'),
      className: 'pdf-btn',
      onClick: () => onGeneratePDF(contract),
      disabled: generatingPDF === contract.id,
      show: true
    },
    {
      key: 'fattureincloud',
      icon: isUploaded ? 
        <CheckCircle size={14} /> : 
        (uploading ? <Clock size={14} className="animate-spin" /> : <Upload size={14} />),
      label: isUploaded ? 
        `F.C. #${uploadStatus.fattureincloud_invoice_number}` : 
        (uploading ? 'Uploading...' : 'Upload to F.C.'),
      className: `fattureincloud-btn ${isUploaded ? 'uploaded' : ''}`,
      onClick: handleFattureInCloudUpload,
      disabled: uploading || isUploaded,
      show: partnerSettings?.fattureincloud_enabled && 
            contract.requires_payment !== false && 
            contract.service_type !== 'free_trial'
    },
    {
      key: 'payment',
      icon: <DollarSign size={14} />,
      label: t('contracts.actions.recordPayment'),
      className: 'payment-btn',
      onClick: () => {
        console.log('Recording payment for contract:', contract.id);
        onRecordPayment(contract);
      },
      show: canManagePayments && contract.requires_payment !== false && contract.service_type !== 'free_trial'
    },
    {
      key: 'history',
      icon: <CreditCard size={14} />,
      label: t('contracts.actions.paymentHistory'), 
      className: 'history-btn',
      onClick: () => {
        console.log('Opening payment history for contract:', contract.id);
        onPaymentHistory(contract);
      },
      show: canManagePayments && contract.requires_payment !== false && contract.service_type !== 'free_trial'
    },
    {
      key: 'edit',
      icon: <Edit2 size={14} />,
      label: t('contracts.actions.editContract'),
      className: 'edit-btn',
      onClick: () => onEditContract(contract),
      show: canEditContracts
    },
    {
      key: 'book',
      icon: <Calendar size={14} />,
      label: canBook ? t('reservations.bookReservation') : t('reservations.cannotBook'),
      className: 'package-booking-btn',
      onClick: () => {
        if (canBook) {
          console.log('Booking package for contract:', contract.id);
          onPackageBooking(contract);
        }
      },
      disabled: !canBook,
      show: contract.service_type === 'pacchetto' && isInRange
    },
    {
      key: 'delete',
      icon: <Trash2 size={14} />,
      label: t('contracts.actions.archiveContract'),
      className: 'delete-btn',
      onClick: () => onDeleteContract(contract),
      show: isPartnerAdmin || isSuperAdmin
    }
  ].filter(action => action.show);

  return (
    <td className="contracts-table-cell actions-cell">
      <div className="contract-actions">
        {/* NO PDF BUTTON OUTSIDE - Only dropdown menu */}
        {secondaryActions.length > 0 && (
          <div className="actions-dropdown">
            <button
              className="action-btn dropdown-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              title={t('contracts.actions.moreActions')}
            >
              <MoreVertical size={14} />
            </button>
            
            {showDropdown && (
              <div className="dropdown-menu">
                {secondaryActions.map(action => (
                  <button
                    key={action.key}
                    className={`dropdown-item ${action.className}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                      setShowDropdown(false);
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="dropdown-backdrop" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </td>
  );
};

export default ContractActionsCell;
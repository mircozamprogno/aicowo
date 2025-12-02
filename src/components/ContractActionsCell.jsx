// src/components/ContractActionsCell.jsx
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
import { useEffect, useRef, useState } from 'react';
import '../styles/components/contractaction.css';
import logger from '../utils/logger';

const ContractActionsCell = ({ 
  contract, 
  openDropdownId,
  setOpenDropdownId,
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
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const [uploading, setUploading] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Check if THIS dropdown is open
  const showDropdown = openDropdownId === contract.id;

  const canBook = canBookPackage(contract);

  logger.log('Testing translation:', t('contracts.actions.downloadPDF'));
  logger.log('Testing translation type:', typeof t('contracts.actions.downloadPDF'));
  
  const isUploaded = uploadStatus && uploadStatus.upload_status === 'success';

  const handleToggleDropdown = (e) => {
    e.stopPropagation();
    // If this dropdown is open, close it. Otherwise open it.
    setOpenDropdownId(showDropdown ? null : contract.id);
  };

  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  const handleFattureInCloudUpload = async () => {
    if (isUploaded || uploading) return;
    
    setUploading(true);
    try {
      const { FattureInCloudService } = await import('../services/fattureInCloudService');
      const result = await FattureInCloudService.uploadContract(contract, partnerSettings, t);
      
      if (result.success) {
        logger.log(`Invoice uploaded successfully! Number: ${result.invoice_number}`);
        onUploadSuccess && onUploadSuccess(result);
      } else {
        logger.error(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      logger.error(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const secondaryActions = [
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
        logger.log('Recording payment for contract:', contract.id);
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
        logger.log('Opening payment history for contract:', contract.id);
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
          logger.log('Booking package for contract:', contract.id);
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

  useEffect(() => {
    if (showDropdown && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const dropdown = dropdownRef.current?.querySelector('.dropdown-menu');
      
      // DEBUG LOGGING
      logger.log('🔍 Dropdown opened for contract:', contract.id);
      logger.log('📍 Position:', dropdownPosition);
      logger.log('📐 Trigger rect:', triggerRect);
      
      if (dropdown) {
        dropdown.style.top = `${triggerRect.bottom + 4}px`;
        dropdown.style.left = `${triggerRect.right - 200}px`;
        
        logger.log('✅ Dropdown positioned at:', {
          top: dropdown.style.top,
          left: dropdown.style.left,
          zIndex: window.getComputedStyle(dropdown).zIndex
        });
      }
      
      const viewportHeight = window.innerHeight;
      const estimatedDropdownHeight = secondaryActions.length * 44 + 20;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      
      logger.log('📊 Space check:', { spaceBelow, spaceAbove, estimatedHeight: estimatedDropdownHeight });
      
      if (spaceBelow < estimatedDropdownHeight && spaceAbove > estimatedDropdownHeight) {
        setDropdownPosition('top');
        if (dropdown) {
          dropdown.style.top = `${triggerRect.top - estimatedDropdownHeight - 4}px`;
          logger.log('⬆️ Opening upward, new top:', dropdown.style.top);
        }
      } else {
        setDropdownPosition('bottom');
        logger.log('⬇️ Opening downward');
      }
    }
  }, [showDropdown, secondaryActions.length, contract.id]);

  return (
    <td className="contracts-table-cell actions-cell">
      <div className="contract-actions">
        {secondaryActions.length > 0 && (
          <div className="actions-dropdown" ref={dropdownRef}>
            <button
              ref={triggerRef}
              className="action-btn dropdown-trigger"
              onClick={handleToggleDropdown}
              title={t('contracts.actions.moreActions')}
            >
              <MoreVertical size={14} />
            </button>
            
            {showDropdown && (
              <>
                <div 
                  className="dropdown-backdrop" 
                  onClick={handleCloseDropdown}
                />
                
                <div className={`dropdown-menu dropdown-${dropdownPosition}`}>
                  {secondaryActions.map(action => (
                    <button
                      key={action.key}
                      className={`dropdown-item ${action.className}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                        handleCloseDropdown();
                      }}
                      disabled={action.disabled}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </td>
  );
};

export default ContractActionsCell;
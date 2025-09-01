import {
    Calendar,
    CreditCard,
    DollarSign,
    Download,
    Edit2,
    MoreVertical,
    Trash2
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
  t 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const canBook = canBookPackage(contract);

  // Always use dropdown approach for now to simplify
  const primaryActions = [
    {
      key: 'pdf',
      icon: generatingPDF === contract.id ? 
        <div className="loading-spinner-small"></div> : 
        <Download size={14} />,
      label: 'PDF',
      className: 'pdf-btn',
      onClick: () => onGeneratePDF(contract),
      disabled: generatingPDF === contract.id,
      show: true
    }
  ].filter(action => action.show);

  const secondaryActions = [
    {
      key: 'payment',
      icon: <DollarSign size={14} />,
      label: t('payments.recordPayment'),
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
      label: t('payments.paymentHistory'), 
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
      label: t('contracts.editContract'),
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
      label: t('contracts.deleteContract'),
      className: 'delete-btn',
      onClick: () => onDeleteContract(contract),
      show: isPartnerAdmin || isSuperAdmin
    }
  ].filter(action => action.show);

  return (
    <td className="contracts-table-cell actions-cell">
      <div className="contract-actions">
        {/* PDF button always visible */}
        {primaryActions.map(action => (
          <button
            key={action.key}
            className={`action-btn ${action.className}`}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
        
        {/* Other actions in dropdown */}
        {secondaryActions.length > 0 && (
          <div className="actions-dropdown">
            <button
              className="action-btn dropdown-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              title="More actions"
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
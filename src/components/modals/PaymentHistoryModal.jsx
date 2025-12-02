// src/components/modals/PaymentHistoryModal.jsx

import { Calendar, CreditCard, DollarSign, Edit2, Eye, FileText, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { PaymentService } from '../../services/paymentService';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const PaymentHistoryModal = ({ 
  isOpen, 
  onClose, 
  contract,
  onEditPayment,
  onRefresh 
}) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentStats, setPaymentStats] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const { profile } = useAuth();
  const { t } = useTranslation();

  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';
  const canEditPayments = isPartnerAdmin || isSuperAdmin;

  useEffect(() => {
    if (isOpen && contract) {
      loadPayments();
    }
  }, [isOpen, contract]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await PaymentService.getContractPayments(contract.id);
      
      if (error) {
        toast.error(t('payments.errorLoadingPayments'));
        logger.error('Error loading payments:', error);
        return;
      }

      setPayments(data || []);
      calculateStats(data || []);
    } catch (error) {
      logger.error('Error loading payments:', error);
      toast.error(t('payments.errorLoadingPayments'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData) => {
    const completed = paymentsData.filter(p => p.payment_status === 'completed');
    const pending = paymentsData.filter(p => p.payment_status === 'pending');
    
    // Use amount_gross if available, otherwise fall back to amount
    const totalPaid = completed.reduce((sum, p) => {
      const amount = p.amount_gross !== null && p.amount_gross !== undefined 
        ? parseFloat(p.amount_gross) 
        : parseFloat(p.amount);
      return sum + (amount || 0);
    }, 0);
    
    const pendingAmount = pending.reduce((sum, p) => {
      const amount = p.amount_gross !== null && p.amount_gross !== undefined 
        ? parseFloat(p.amount_gross) 
        : parseFloat(p.amount);
      return sum + (amount || 0);
    }, 0);
    
    // Calculate contract total with VAT
    const baseAmount = parseFloat(contract?.service_cost) || 0;
    const vatPercentage = parseFloat(contract?.locations?.vat_percentage) || 0;
    const vatAmount = baseAmount * (vatPercentage / 100);
    const contractCostGross = baseAmount + vatAmount;
    
    const outstanding = Math.max(0, contractCostGross - totalPaid);

    setPaymentStats({
      totalPayments: paymentsData.length,
      completedPayments: completed.length,
      pendingPayments: pending.length,
      totalPaid,
      pendingAmount,
      outstanding,
      contractCost: contractCostGross,
      isFullyPaid: totalPaid >= contractCostGross && contractCostGross > 0,
      paymentPercentage: contractCostGross > 0 ? Math.min((totalPaid / contractCostGross) * 100, 100) : 0
    });
  };

  const handleDeletePayment = (payment) => {
    setPaymentToDelete(payment);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete) return;

    try {
      const { success, error } = await PaymentService.deletePayment(paymentToDelete.id);
      
      if (error) {
        toast.error(error);
        return;
      }

      toast.success(t('payments.paymentDeleted'));
      setShowDeleteConfirm(false);
      setPaymentToDelete(null);
      loadPayments();
      if (onRefresh) onRefresh();
    } catch (error) {
      logger.error('Error deleting payment:', error);
      toast.error(t('payments.errorDeletingPayment'));
    }
  };

  const handleEditPayment = (payment) => {
    if (onEditPayment) {
      onEditPayment(payment);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: contract?.service_currency || 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      completed: 'payment-status-completed',
      pending: 'payment-status-pending',
      failed: 'payment-status-failed',
      refunded: 'payment-status-refunded',
      cancelled: 'payment-status-cancelled'
    };
    return classes[status] || 'payment-status-default';
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return '💰';
      case 'bank_transfer':
        return '🏦';
      case 'credit_card':
      case 'stripe':
        return '💳';
      case 'paypal':
        return '🅿️';
      default:
        return '💸';
    }
  };

  const getPaymentAmount = (payment) => {
    return payment.amount_gross !== null && payment.amount_gross !== undefined 
      ? payment.amount_gross 
      : payment.amount;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-container payment-history-modal">
          <div className="modal-header">
            <h2 className="modal-title">
              <FileText size={20} className="mr-2" />
              {t('payments.paymentHistory')} - {contract?.contract_number}
            </h2>
            <button onClick={onClose} className="modal-close-btn">
              <X size={24} />
            </button>
          </div>

          <div className="payment-history-content">
            {paymentStats && (
              <div className="payment-stats-section">
                <div className="payment-stats-grid">
                  <div className="stat-card stat-paid">
                    <div className="stat-icon">
                      <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{formatCurrency(paymentStats.totalPaid)}</div>
                      <div className="stat-label">{t('payments.totalPaid')}</div>
                    </div>
                  </div>

                  <div className="stat-card stat-outstanding">
                    <div className="stat-icon">
                      <Calendar size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{formatCurrency(paymentStats.outstanding)}</div>
                      <div className="stat-label">{t('payments.outstanding')}</div>
                    </div>
                  </div>

                  <div className="stat-card stat-count">
                    <div className="stat-icon">
                      <CreditCard size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{paymentStats.totalPayments}</div>
                      <div className="stat-label">{t('payments.totalPayments') || 'Pagamenti Totali'}</div>
                    </div>
                  </div>

                  <div className={`stat-card stat-progress ${paymentStats.isFullyPaid ? 'fully-paid' : ''}`}>
                    <div className="stat-icon">
                      <FileText size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{Math.round(paymentStats.paymentPercentage)}%</div>
                      <div className="stat-label">{t('payments.paymentProgress') || 'Progresso Pagamento'}</div>
                    </div>
                  </div>
                </div>

                <div className="payment-progress-container">
                  <div className="progress-header">
                    <span className="progress-label">{t('payments.paymentProgress') || 'Progresso Pagamento'}</span>
                    <span className="progress-value">
                      {formatCurrency(paymentStats.totalPaid)} / {formatCurrency(paymentStats.contractCost)}
                    </span>
                  </div>
                  <div className="progress-bar-wrapper">
                    <div 
                      className={`progress-bar-fill ${paymentStats.isFullyPaid ? 'fully-paid' : ''}`}
                      style={{ width: `${paymentStats.paymentPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="payments-list-section">
              <div className="section-header">
                <h3>{t('payments.paymentHistory') || 'Storico Pagamenti'}</h3>
                {paymentStats && (
                  <span className={`payment-status-badge ${paymentStats.isFullyPaid ? 'fully-paid' : 'outstanding'}`}>
                    {paymentStats.isFullyPaid 
                      ? (t('contracts.fullyPaid') || 'Completamente Pagato')
                      : (t('contracts.awaitingPayment') || 'Da Pagare')}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="payments-loading">
                  <div className="loading-spinner-small"></div>
                  <span>{t('common.loading')}</span>
                </div>
              ) : payments.length === 0 ? (
                <div className="no-payments">
                  <DollarSign size={48} className="no-payments-icon" />
                  <p>{t('payments.noPaymentsFound')}</p>
                </div>
              ) : (
                <div className="payments-table-container">
                  <table className="payments-history-table">
                    <thead>
                      <tr>
                        <th>{t('payments.number') || 'Numero'}</th>
                        <th>{t('payments.amount') || 'Importo'}</th>
                        <th>{t('payments.method') || 'Metodo'}</th>
                        <th>{t('payments.date') || 'Data'}</th>
                        {canEditPayments && <th>{t('contracts.actionsColumn') || 'Azioni'}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="payment-row">
                          <td>
                            <span className="payment-number">{payment.payment_number}</span>
                          </td>
                          
                          <td>
                            <div className="payment-amount-cell">
                              <span className="amount-value">{formatCurrency(getPaymentAmount(payment))}</span>
                              <span className="payment-type-badge">
                                {t(`payments.types.${payment.payment_type}`) || payment.payment_type}
                              </span>
                            </div>
                          </td>
                          
                          <td>
                            <div className="payment-method-cell">
                              <span className="method-icon">{getMethodIcon(payment.payment_method)}</span>
                              <span className="method-name">
                                {t(`payments.methods.${payment.payment_method}`)}
                              </span>
                            </div>
                          </td>
                          
                          <td className="payment-date-cell">
                            {formatDate(payment.payment_date)}
                          </td>
                          
                          {canEditPayments && (
                            <td>
                              <div className="payment-actions">
                                <button
                                  className="action-btn edit-btn"
                                  onClick={() => handleEditPayment(payment)}
                                  title={t('payments.tooltips.editPayment') || 'Modifica Pagamento'}
                                >
                                  <Edit2 size={16} />
                                </button>
                                
                                {payment.receipt_url && (
                                  <button
                                    className="action-btn view-btn"
                                    onClick={() => window.open(payment.receipt_url, '_blank')}
                                    title={t('payments.tooltips.viewReceipt') || 'Vedi Ricevuta'}
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                                
                                <button
                                  className="action-btn delete-btn"
                                  onClick={() => handleDeletePayment(payment)}
                                  title={t('payments.tooltips.deletePayment') || 'Elimina Pagamento'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="btn-secondary">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && paymentToDelete && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('payments.confirmDeletePayment') || 'Conferma Eliminazione Pagamento'}
              </h2>
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="modal-close-btn"
              >
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content">
              <div className="delete-warning">
                <Trash2 size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('common.confirmDelete')}</h3>
                  <p>{t('payments.deletePaymentWarning') || 'Questa azione non può essere annullata.'}</p>
                </div>
              </div>

              <div className="payment-to-delete-info">
                <div className="delete-info-item">
                  <strong>{t('payments.paymentNumber')}:</strong> {paymentToDelete.payment_number}
                </div>
                <div className="delete-info-item">
                  <strong>{t('payments.amount')}:</strong> {formatCurrency(getPaymentAmount(paymentToDelete))}
                </div>
                <div className="delete-info-item">
                  <strong>{t('payments.paymentMethod')}:</strong> {t(`payments.methods.${paymentToDelete.payment_method}`)}
                </div>
                <div className="delete-info-item">
                  <strong>{t('payments.paymentDate')}:</strong> {formatDate(paymentToDelete.payment_date)}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePayment}
                  className="btn-danger"
                >
                  {t('payments.deletePayment') || 'Elimina Pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentHistoryModal;
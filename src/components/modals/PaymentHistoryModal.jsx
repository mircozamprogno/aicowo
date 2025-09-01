// src/components/modals/PaymentHistoryModal.jsx

import { Calendar, CreditCard, DollarSign, Edit2, Eye, FileText, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { PaymentService } from '../../services/paymentService';
import { toast } from '../common/ToastContainer';

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

  // Determine user capabilities
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
        console.error('Error loading payments:', error);
        return;
      }

      setPayments(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error(t('payments.errorLoadingPayments'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData) => {
    const completed = paymentsData.filter(p => p.payment_status === 'completed');
    const pending = paymentsData.filter(p => p.payment_status === 'pending');
    
    const totalPaid = completed.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const pendingAmount = pending.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const contractCost = contract?.service_cost || 0;
    const outstanding = Math.max(0, contractCost - totalPaid);

    setPaymentStats({
      totalPayments: paymentsData.length,
      completedPayments: completed.length,
      pendingPayments: pending.length,
      totalPaid,
      pendingAmount,
      outstanding,
      contractCost,
      isFullyPaid: totalPaid >= contractCost && contractCost > 0,
      paymentPercentage: contractCost > 0 ? (totalPaid / contractCost) * 100 : 0
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
      loadPayments(); // Reload payments
      if (onRefresh) onRefresh(); // Refresh parent component
    } catch (error) {
      console.error('Error deleting payment:', error);
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
      completed: 'status-completed',
      pending: 'status-pending',
      failed: 'status-failed',
      refunded: 'status-refunded',
      cancelled: 'status-cancelled'
    };
    return classes[status] || 'status-default';
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

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-container payment-history-modal" style={{ maxWidth: '56rem' }}>
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
            {/* Payment Statistics */}
            {paymentStats && (
              <div className="payment-stats-section">
                <div className="payment-stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">
                      <DollarSign size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{formatCurrency(paymentStats.totalPaid)}</div>
                      <div className="stat-label">{t('payments.totalPaid')}</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      <Calendar size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{formatCurrency(paymentStats.outstanding)}</div>
                      <div className="stat-label">{t('payments.outstanding')}</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      <CreditCard size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{paymentStats.totalPayments}</div>
                      <div className="stat-label">{t('payments.totalPayments')}</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      <FileText size={20} />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{Math.round(paymentStats.paymentPercentage)}%</div>
                      <div className="stat-label">{t('payments.paymentProgress')}</div>
                    </div>
                  </div>
                </div>

                {/* Payment Progress Bar */}
                <div className="payment-progress">
                  <div className="progress-header">
                    <span className="progress-label">{t('payments.paymentProgress')}</span>
                    <span className="progress-value">
                      {formatCurrency(paymentStats.totalPaid)} / {formatCurrency(paymentStats.contractCost)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${Math.min(paymentStats.paymentPercentage, 100)}%`,
                        backgroundColor: paymentStats.isFullyPaid ? '#16a34a' : '#3b82f6'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Payments List */}
            <div className="payments-list-section">
              <div className="section-header">
                <h3>{t('payments.paymentHistory')}</h3>
                <div className="section-actions">
                  {paymentStats && (
                    <span className={`payment-status-badge ${paymentStats.isFullyPaid ? 'fully-paid' : 'outstanding'}`}>
                      {paymentStats.isFullyPaid 
                        ? t('contracts.fullyPaid') 
                        : t('contracts.awaitingPayment')}
                    </span>
                  )}
                </div>
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
                <div className="payments-table-wrapper">
                  <table className="payments-table">
                    <thead>
                      <tr>
                        <th>{t('payments.paymentNumber')}</th>
                        <th>{t('payments.amount')}</th>
                        <th>{t('payments.paymentMethod')}</th>
                        <th>{t('payments.paymentDate')}</th>
                        <th>{t('payments.paymentStatus')}</th>
                        <th>{t('payments.transactionRef')}</th>
                        {canEditPayments && <th>{t('contracts.actions')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="payment-row">
                          <td className="payment-number">
                            <div className="payment-number-info">
                              <span className="number">{payment.payment_number}</span>
                              <span className="created-date">
                                {t('common.createdAt')}: {formatDate(payment.created_at)}
                              </span>
                            </div>
                          </td>
                          
                          <td className="payment-amount">
                            <div className="amount-info">
                              <span className="amount">{formatCurrency(payment.amount)}</span>
                              <span className="payment-type">{t(`payments.types.${payment.payment_type}`)}</span>
                            </div>
                          </td>
                          
                          <td className="payment-method">
                            <div className="method-info">
                              <span className="method-icon">{getMethodIcon(payment.payment_method)}</span>
                              <span className="method-name">
                                {t(`payments.methods.${payment.payment_method}`)}
                              </span>
                            </div>
                          </td>
                          
                          <td className="payment-date">
                            {formatDate(payment.payment_date)}
                          </td>
                          
                          <td className="payment-status">
                            <span className={`status-badge ${getStatusBadgeClass(payment.payment_status)}`}>
                              {t(`payments.status.${payment.payment_status}`)}
                            </span>
                          </td>
                          
                          <td className="transaction-ref">
                            <span className="transaction-ref-text">
                              {payment.transaction_reference || '-'}
                            </span>
                          </td>
                          
                          {canEditPayments && (
                            <td className="payment-actions">
                              <div className="actions-group">
                                <button
                                  className="action-btn edit-btn"
                                  onClick={() => handleEditPayment(payment)}
                                  title={t('payments.tooltips.editPayment')}
                                >
                                  <Edit2 size={16} />
                                </button>
                                
                                {payment.receipt_url && (
                                  <button
                                    className="action-btn view-btn"
                                    onClick={() => window.open(payment.receipt_url, '_blank')}
                                    title={t('payments.tooltips.viewReceipt')}
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                                
                                <button
                                  className="action-btn delete-btn"
                                  onClick={() => handleDeletePayment(payment)}
                                  title={t('payments.tooltips.deletePayment')}
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

            {/* Payment Notes */}
            {payments.some(p => p.notes) && (
              <div className="payment-notes-section">
                <h4>{t('payments.notes')}</h4>
                <div className="notes-list">
                  {payments
                    .filter(p => p.notes)
                    .map(payment => (
                      <div key={payment.id} className="note-item">
                        <div className="note-header">
                          <span className="note-payment">{payment.payment_number}</span>
                          <span className="note-date">{formatDate(payment.created_at)}</span>
                        </div>
                        <div className="note-content">{payment.notes}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="btn-secondary">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && paymentToDelete && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('payments.confirmDeletePayment')}
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
                  <p>{t('payments.deletePaymentWarning')}</p>
                </div>
              </div>

              <div className="payment-to-delete">
                <div className="summary-item">
                  <strong>{t('payments.paymentNumber')}:</strong> {paymentToDelete.payment_number}
                </div>
                <div className="summary-item">
                  <strong>{t('payments.amount')}:</strong> {formatCurrency(paymentToDelete.amount)}
                </div>
                <div className="summary-item">
                  <strong>{t('payments.paymentMethod')}:</strong> {t(`payments.methods.${paymentToDelete.payment_method}`)}
                </div>
                <div className="summary-item">
                  <strong>{t('payments.paymentDate')}:</strong> {formatDate(paymentToDelete.payment_date)}
                </div>
              </div>

              <div className="delete-modal-actions">
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
                  {t('payments.deletePayment')}
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
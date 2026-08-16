import { Calendar, DollarSign, Edit, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import PartnerPaymentForm from '../forms/PartnerPaymentForm';

import logger from '../../utils/logger';

const PartnerPaymentHistoryModal = ({ isOpen, onClose, contract }) => {
  const { t } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  useEffect(() => {
    if (isOpen && contract) {
      fetchPayments();
    }
  }, [isOpen, contract]);

  const fetchPayments = async () => {
    if (!contract?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partners_payments')
        .select('*')
        .eq('contract_id', contract.id)
        .order('payment_period_start', { ascending: false });

      if (error) {
        logger.error('Error fetching partner payments:', error);
        // Mock data for development
        setPayments([
          {
            id: 1,
            contract_id: contract.id,
            payment_period_start: '2025-01-01',
            payment_period_end: '2025-01-31',
            amount: contract.final_price || 79.99,
            currency: contract?.partners_pricing_plans?.currency || 'EUR',
            payment_status: 'paid',
            payment_date: '2025-01-01',
            due_date: '2025-01-01',
            payment_method: 'bank_transfer',
            transaction_reference: 'TXN-2025-001',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            contract_id: contract.id,
            payment_period_start: '2025-02-01',
            payment_period_end: '2025-02-28',
            amount: contract.final_price || 79.99,
            currency: contract?.partners_pricing_plans?.currency || 'EUR',
            payment_status: 'pending',
            payment_date: null,
            due_date: '2025-02-01',
            payment_method: null,
            transaction_reference: null,
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ]);
      } else {
        setPayments(data || []);
      }
    } catch (error) {
      logger.error('Error fetching partner payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    setShowPaymentForm(true);
  };

  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    setShowPaymentForm(true);
  };

  const handlePaymentFormClose = () => {
    setShowPaymentForm(false);
    setEditingPayment(null);
  };

  const handlePaymentFormSuccess = (savedPayment) => {
    if (editingPayment) {
      setPayments(prev => 
        prev.map(p => p.id === savedPayment.id ? savedPayment : p)
      );
      toast.success(t('partnerContracts.paymentUpdatedSuccessfully') || 'Payment updated successfully');
    } else {
      setPayments(prev => [savedPayment, ...prev]);
      toast.success(t('partnerContracts.paymentCreatedSuccessfully') || 'Payment recorded successfully');
    }
    setShowPaymentForm(false);
    setEditingPayment(null);
  };

  const handleDeletePayment = (payment) => {
    setPaymentToDelete(payment);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('partners_payments')
        .delete()
        .eq('id', paymentToDelete.id);

      if (error) {
        logger.error('Error deleting payment:', error);
        toast.error(t('partnerContracts.errorDeletingPayment') || 'Error deleting payment');
        return;
      }

      setPayments(prev => prev.filter(p => p.id !== paymentToDelete.id));
      toast.success(t('partnerContracts.paymentDeletedSuccessfully') || 'Payment deleted successfully');
    } catch (error) {
      logger.error('Error deleting payment:', error);
      toast.error(t('partnerContracts.errorDeletingPayment') || 'Error deleting payment');
    } finally {
      setShowDeleteConfirm(false);
      setPaymentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setPaymentToDelete(null);
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid':
        return 'status-paid';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      case 'overdue':
        return 'status-overdue';
      default:
        return 'status-default';
    }
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      bank_transfer: 'Bank Transfer',
      credit_card: 'Credit Card',
      paypal: 'PayPal',
      stripe: 'Stripe',
      cash: 'Cash',
      other: 'Other'
    };
    return methods[method] || method || '-';
  };

  const calculateTotalPaid = () => {
    return payments
      .filter(p => p.payment_status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const calculateOutstanding = () => {
    return payments
      .filter(p => ['pending', 'overdue'].includes(p.payment_status))
      .reduce((sum, p) => sum + p.amount, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container payment-history-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            <DollarSign size={20} className="mr-2" />
            {t('partnerContracts.paymentHistoryFor')} {contract?.contract_number}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          {/* Contract Summary */}
          <div className="contract-summary">
            <h3 className="section-title">{t('partnerContracts.contractSummary')}</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">{t('partnerContracts.partner')}:</span>
                <span className="summary-value">
                  {contract?.partners?.company_name || 
                   `${contract?.partners?.first_name} ${contract?.partners?.second_name}`}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerContracts.plan')}:</span>
                <span className="summary-value">{contract?.partners_pricing_plans?.plan_name}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerContracts.billingFrequency')}:</span>
                <span className="summary-value">{contract?.billing_frequency}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerContracts.finalPrice')}:</span>
                <span className="summary-value">{formatCurrency(contract?.final_price, contract?.partners_pricing_plans?.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment Statistics */}
          <div className="payment-stats">
            <div className="stat-item">
              <span className="stat-label">{t('partnerContracts.totalPaid')}</span>
              <span className="stat-value paid">{formatCurrency(calculateTotalPaid(), contract?.partners_pricing_plans?.currency)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('partnerContracts.outstanding')}</span>
              <span className="stat-value outstanding">{formatCurrency(calculateOutstanding(), contract?.partners_pricing_plans?.currency)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('partnerContracts.totalPayments')}</span>
              <span className="stat-value">{payments.length}</span>
            </div>
          </div>

          {/* Payments List */}
          <div className="payments-section">
            <div className="section-header">
              <h3 className="section-title">{t('partnerContracts.paymentHistory')}</h3>
              <button className="add-payment-btn" onClick={handleAddPayment} title={t('partnerContracts.recordPayment')}>
                <Plus size={16} />
                {t('partnerContracts.recordPayment')}
              </button>
            </div>
            
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>{t('common.loading')}</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="empty-payments">
                <p>{t('partnerContracts.noPaymentsFound')}</p>
                <button 
                  onClick={handleAddPayment}
                  className="btn-primary mt-2"
                >
                  {t('partnerContracts.recordFirstPayment')}
                </button>
              </div>
            ) : (
              <div className="payments-list">
                {payments.map((payment) => (
                  <div key={payment.id} className="payment-item">
                    <div className="payment-info">
                      <div className="payment-period">
                        <Calendar size={16} />
                        {formatDate(payment.payment_period_start)} - {formatDate(payment.payment_period_end)}
                      </div>
                      <div className="payment-details">
                        <span className="payment-amount">
                          {formatCurrency(payment.amount, payment.currency)}
                        </span>
                        <span className={`payment-status ${getStatusBadgeClass(payment.payment_status)}`}>
                          {t(`partnerContracts.${payment.payment_status}`)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="payment-meta">
                      <div className="payment-dates">
                        <div className="date-item">
                          <span className="date-label">{t('partnerContracts.dueDate')}:</span>
                          <span className="date-value">{formatDate(payment.due_date)}</span>
                        </div>
                        {payment.payment_date && (
                          <div className="date-item">
                            <span className="date-label">{t('partnerContracts.paidDate')}:</span>
                            <span className="date-value">{formatDate(payment.payment_date)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="payment-method-info">
                        {payment.payment_method && (
                          <div className="method-item">
                            <span className="method-label">{t('partnerContracts.paymentMethod')}:</span>
                            <span className="method-value">{getPaymentMethodLabel(payment.payment_method)}</span>
                          </div>
                        )}
                        {payment.transaction_reference && (
                          <div className="reference-item">
                            <span className="reference-label">{t('partnerContracts.transactionRef')}:</span>
                            <span className="reference-value">{payment.transaction_reference}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="payment-actions">
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => handleEditPayment(payment)}
                        title={t('partnerContracts.editPayment')}
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeletePayment(payment)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Payment Form Modal */}
      <PartnerPaymentForm
        isOpen={showPaymentForm}
        onClose={handlePaymentFormClose}
        onSuccess={handlePaymentFormSuccess}
        contract={contract}
        payment={editingPayment}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && paymentToDelete && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('common.confirmDelete')}
              </h2>
              <button onClick={handleDeleteCancel} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content">
              <div className="delete-warning">
                <Trash2 size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('common.warning') || 'Warning'}</h3>
                  <p>{t('partnerContracts.confirmDeletePaymentRecord')}</p>
                  <div className="payment-summary">
                    <div className="summary-item">
                      <span className="summary-label">{t('partnerContracts.amount')}:</span>
                      <span className="summary-value">{formatCurrency(paymentToDelete.amount, contract?.partners_pricing_plans?.currency || paymentToDelete.currency)}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t('partnerContracts.period')}:</span>
                      <span className="summary-value">
                        {formatDate(paymentToDelete.payment_period_start)} - {formatDate(paymentToDelete.payment_period_end)}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t('partnerContracts.status')}:</span>
                      <span className="summary-value">{t(`partnerContracts.${paymentToDelete.payment_status}`)}</span>
                    </div>
                  </div>
                  <p className="warning-note">
                    {t('partnerContracts.actionCannotBeUndone')}
                  </p>
                </div>
              </div>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="btn-danger"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerPaymentHistoryModal;
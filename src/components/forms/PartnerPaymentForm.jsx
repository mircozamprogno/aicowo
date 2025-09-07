import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const PartnerPaymentForm = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  contract,
  payment = null // For editing existing payments
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isEditing = !!payment;
  
  const [formData, setFormData] = useState({
    payment_period_start: '',
    payment_period_end: '',
    amount: '',
    currency: 'EUR',
    payment_status: 'paid',
    payment_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_method: 'bank_transfer',
    transaction_reference: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);

  // Update form data when payment changes (for editing)
  useEffect(() => {
    if (payment) {
      setFormData({
        payment_period_start: payment.payment_period_start || '',
        payment_period_end: payment.payment_period_end || '',
        amount: payment.amount?.toString() || '',
        currency: payment.currency || 'EUR',
        payment_status: payment.payment_status || 'paid',
        payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
        due_date: payment.due_date || '',
        payment_method: payment.payment_method || 'bank_transfer',
        transaction_reference: payment.transaction_reference || '',
        notes: payment.notes || ''
      });
    } else if (contract) {
      // Auto-populate for new payment based on contract
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      setFormData({
        payment_period_start: startOfMonth.toISOString().split('T')[0],
        payment_period_end: endOfMonth.toISOString().split('T')[0],
        amount: contract.final_price?.toString() || '',
        currency: contract.currency || 'EUR',
        payment_status: 'paid',
        payment_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        transaction_reference: '',
        notes: ''
      });
    }
  }, [payment, contract]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.payment_period_start) {
      toast.error(t('partnerContracts.paymentPeriodStartRequired') || 'Payment period start is required');
      return false;
    }

    if (!formData.payment_period_end) {
      toast.error(t('partnerContracts.paymentPeriodEndRequired') || 'Payment period end is required');
      return false;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error(t('partnerContracts.validAmountRequired') || 'Valid amount is required');
      return false;
    }

    if (!formData.due_date) {
      toast.error(t('partnerContracts.dueDateRequired') || 'Due date is required');
      return false;
    }

    const startDate = new Date(formData.payment_period_start);
    const endDate = new Date(formData.payment_period_end);
    
    if (endDate <= startDate) {
      toast.error(t('partnerContracts.endDateMustBeAfterStartDate') || 'End date must be after start date');
      return false;
    }

    return true;
  };

  const generatePaymentReference = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `PAY-${year}${month}-${random}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare data for submission
      const submitData = {
        contract_id: contract.id,
        partner_uuid: contract.partner_uuid, // <-- Add this line
        payment_period_start: formData.payment_period_start,
        payment_period_end: formData.payment_period_end,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        payment_status: formData.payment_status,
        payment_date: formData.payment_status === 'paid' ? formData.payment_date : null,
        due_date: formData.due_date,
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference.trim() || (formData.payment_status === 'paid' ? generatePaymentReference() : null),
        notes: formData.notes.trim() || null,
        created_by_user_id: user?.id
      };

      let result;
      
      if (isEditing) {
        // Update existing payment
        result = await supabase
          .from('partners_payments')
          .update(submitData)
          .eq('id', payment.id)
          .select()
          .single();
      } else {
        // Create new payment
        result = await supabase
          .from('partners_payments')
          .insert([submitData])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) {
        console.error('Error saving payment:', error);
        throw error;
      }

      toast.success(
        isEditing 
          ? t('partnerContracts.paymentUpdatedSuccessfully') || 'Payment updated successfully'
          : t('partnerContracts.paymentCreatedSuccessfully') || 'Payment recorded successfully'
      );
      
      onSuccess(data);
      onClose();
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error(error.message || (isEditing ? t('partnerContracts.errorUpdatingPayment') : t('partnerContracts.errorCreatingPayment')));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    const locale = currency === 'EUR' ? 'de-DE' : 
                  currency === 'GBP' ? 'en-GB' : 'en-US';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container partner-payment-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('partnerContracts.editPayment') : t('partnerContracts.recordPayment')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.paymentPeriod')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="payment_period_start" className="form-label">
                  {t('partnerContracts.periodStart')} *
                </label>
                <input
                  id="payment_period_start"
                  name="payment_period_start"
                  type="date"
                  required
                  className="form-input"
                  value={formData.payment_period_start}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="payment_period_end" className="form-label">
                  {t('partnerContracts.periodEnd')} *
                </label>
                <input
                  id="payment_period_end"
                  name="payment_period_end"
                  type="date"
                  required
                  className="form-input"
                  value={formData.payment_period_end}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.paymentAmount')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount" className="form-label">
                  {t('partnerContracts.amount')} *
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="form-input"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="currency" className="form-label">
                  {t('partnerContracts.currency')} *
                </label>
                <select
                  id="currency"
                  name="currency"
                  required
                  className="form-select"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            {formData.amount && (
              <div className="amount-preview">
                <span className="preview-label">{t('partnerContracts.amountPreview')}:</span>
                <span className="preview-value">{formatCurrency(parseFloat(formData.amount) || 0)}</span>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.paymentStatus')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="payment_status" className="form-label">
                  {t('partnerContracts.status')} *
                </label>
                <select
                  id="payment_status"
                  name="payment_status"
                  required
                  className="form-select"
                  value={formData.payment_status}
                  onChange={handleChange}
                >
                  <option value="paid">{t('partnerContracts.paid')}</option>
                  <option value="pending">{t('partnerContracts.pending')}</option>
                  <option value="failed">{t('partnerContracts.failed')}</option>
                  <option value="overdue">{t('partnerContracts.overdue')}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="due_date" className="form-label">
                  {t('partnerContracts.dueDate')} *
                </label>
                <input
                  id="due_date"
                  name="due_date"
                  type="date"
                  required
                  className="form-input"
                  value={formData.due_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            {formData.payment_status === 'paid' && (
              <div className="form-group">
                <label htmlFor="payment_date" className="form-label">
                  {t('partnerContracts.paymentDate')}
                </label>
                <input
                  id="payment_date"
                  name="payment_date"
                  type="date"
                  className="form-input"
                  value={formData.payment_date}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.paymentDetails')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="payment_method" className="form-label">
                  {t('partnerContracts.paymentMethod')}
                </label>
                <select
                  id="payment_method"
                  name="payment_method"
                  className="form-select"
                  value={formData.payment_method}
                  onChange={handleChange}
                >
                  <option value="bank_transfer">{t('partnerContracts.bankTransfer')}</option>
                  <option value="credit_card">{t('partnerContracts.creditCard')}</option>
                  <option value="paypal">{t('partnerContracts.paypal')}</option>
                  <option value="stripe">{t('partnerContracts.stripe')}</option>
                  <option value="cash">{t('partnerContracts.cash')}</option>
                  <option value="other">{t('partnerContracts.other')}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="transaction_reference" className="form-label">
                  {t('partnerContracts.transactionReference')}
                </label>
                <input
                  id="transaction_reference"
                  name="transaction_reference"
                  type="text"
                  className="form-input"
                  value={formData.transaction_reference}
                  onChange={handleChange}
                  placeholder="TXN-2025-001"
                />
                <small className="form-help">
                  {t('partnerContracts.transactionReferenceHelp') || 'Leave empty to auto-generate for paid status'}
                </small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                {t('partnerContracts.notes')}
              </label>
              <textarea
                id="notes"
                name="notes"
                className="form-input"
                rows="3"
                placeholder="Additional notes about this payment..."
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading 
                ? (isEditing ? t('common.updating') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('partnerContracts.recordPayment'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnerPaymentForm;
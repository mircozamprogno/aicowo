// src/components/forms/PaymentForm.jsx

import { DollarSign, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { PaymentService } from '../../services/paymentService';
import { toast } from '../common/ToastContainer';

const PaymentForm = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  contract, 
  editMode = false, 
  paymentToEdit = null 
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    due_date: '',
    transaction_reference: '',
    notes: '',
    payment_type: 'full',
    payment_status: 'completed'
  });

  const [loading, setLoading] = useState(false);
  const [existingPayments, setExistingPayments] = useState([]);
  const [validation, setValidation] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && contract) {
      loadExistingPayments();
      if (editMode && paymentToEdit) {
        populateEditForm();
      } else {
        resetForm();
      }
    }
  }, [isOpen, contract, editMode, paymentToEdit]);

  useEffect(() => {
    if (formData.amount && contract) {
      validateAmount();
    }
  }, [formData.amount, existingPayments, contract]);

  const loadExistingPayments = async () => {
    if (!contract?.id) return;
    
    const { data, error } = await PaymentService.getContractPayments(contract.id);
    if (error) {
      console.error('Error loading payments:', error);
    } else {
      setExistingPayments(data || []);
    }
  };

  const populateEditForm = () => {
    if (!paymentToEdit) return;

    setFormData({
      amount: paymentToEdit.amount?.toString() || '',
      payment_method: paymentToEdit.payment_method || 'bank_transfer',
      payment_date: paymentToEdit.payment_date 
        ? new Date(paymentToEdit.payment_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      due_date: paymentToEdit.due_date 
        ? new Date(paymentToEdit.due_date).toISOString().split('T')[0]
        : '',
      transaction_reference: paymentToEdit.transaction_reference || '',
      notes: paymentToEdit.notes || '',
      payment_type: paymentToEdit.payment_type || 'full',
      payment_status: paymentToEdit.payment_status || 'completed'
    });
  };

  const resetForm = () => {
    const dueDate = contract?.payment_terms 
      ? PaymentService.calculateDueDate(contract.start_date, contract.payment_terms)
      : null;

    setFormData({
      amount: contract?.service_cost?.toString() || '',
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      due_date: dueDate ? dueDate.toISOString().split('T')[0] : '',
      transaction_reference: '',
      notes: '',
      payment_type: 'full',
      payment_status: 'completed'
    });
    setReceiptFile(null);
    setValidation(null);
  };

  const validateAmount = () => {
    const amount = parseFloat(formData.amount);
    if (!amount || !contract) {
      setValidation(null);
      return;
    }

    const validation = PaymentService.validatePaymentAmount(
      amount, 
      contract.service_cost, 
      existingPayments.filter(p => !editMode || p.id !== paymentToEdit?.id)
    );

    setValidation(validation);

    // Auto-adjust payment type based on amount
    if (validation.isValid) {
      const newType = amount >= validation.remainingAmount ? 'full' : 'partial';
      if (formData.payment_type !== newType) {
        setFormData(prev => ({ ...prev, payment_type: newType }));
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPEG, PNG, WebP, and PDF files are allowed');
        return;
      }

      setReceiptFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error(t('payments.enterAmount'));
        return;
      }

      if (!formData.payment_method) {
        toast.error(t('payments.selectPaymentMethod'));
        return;
      }

      if (!validation?.isValid && !editMode) {
        toast.error(validation?.wouldOverpay 
          ? 'Payment amount exceeds remaining balance'
          : 'Invalid payment amount');
        return;
      }

      const paymentData = {
        ...formData,
        contract_id: contract.id,
        partner_uuid: contract.partner_uuid,
        amount: parseFloat(formData.amount),
        created_by: user.id,
        currency: contract.service_currency || 'EUR'
      };

      let result;
      if (editMode && paymentToEdit) {
        result = await PaymentService.updatePayment(paymentToEdit.id, paymentData);
      } else {
        result = await PaymentService.createPayment(paymentData);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Upload receipt if provided
      if (receiptFile && result.data?.id) {
        setUploadingReceipt(true);
        const uploadResult = await PaymentService.uploadPaymentReceipt(
          result.data.id, 
          receiptFile
        );
        
        if (uploadResult.error) {
          console.warn('Receipt upload failed:', uploadResult.error);
          toast.warn('Payment saved but receipt upload failed');
        }
        setUploadingReceipt(false);
      }

      toast.success(editMode 
        ? t('payments.paymentUpdated') 
        : t('payments.paymentRecorded'));
      
      onSuccess(result.data);
      onClose();
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error(editMode 
        ? t('payments.errorUpdatingPayment') 
        : t('payments.errorRecordingPayment'));
    } finally {
      setLoading(false);
      setUploadingReceipt(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: contract?.service_currency || 'EUR'
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '42rem' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <DollarSign size={20} className="mr-2" />
            {editMode 
              ? t('payments.editPayment')
              : t('payments.recordPaymentFor')} {contract?.contract_number}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Contract Info Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('contracts.contractDetails')}</h3>
            <div className="contract-summary">
              <div className="summary-item">
                <span className="summary-label">{t('contracts.contract')}</span>
                <span className="summary-value">{contract?.contract_number}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('contracts.service')}</span>
                <span className="summary-value">{contract?.service_name}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('contracts.customer')}</span>
                <span className="summary-value">
                  {contract?.customers?.company_name || 
                   `${contract?.customers?.first_name} ${contract?.customers?.second_name}`}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('contracts.cost')}</span>
                <span className="summary-value cost">
                  {formatCurrency(contract?.service_cost)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Details Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('payments.paymentDetails')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount" className="form-label">
                  {t('payments.amount')} *
                </label>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="form-input"
                  placeholder="0.00"
                  required
                />
                {validation && (
                  <div className={`validation-info ${validation.isValid ? 'success' : 'error'}`}>
                    {validation.wouldOverpay ? (
                      <span className="validation-error">
                        Amount exceeds remaining balance of {formatCurrency(validation.remainingAmount)}
                      </span>
                    ) : validation.isValid ? (
                      <span className="validation-success">
                        ✓ Valid amount. Remaining: {formatCurrency(validation.remainingAmount - parseFloat(formData.amount || 0))}
                      </span>
                    ) : (
                      <span className="validation-error">
                        Please enter a valid amount
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="payment_method" className="form-label">
                  {t('payments.paymentMethod')} *
                </label>
                <select
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="bank_transfer">{t('payments.methods.bank_transfer')}</option>
                  <option value="cash">{t('payments.methods.cash')}</option>
                  <option value="credit_card">{t('payments.methods.credit_card')}</option>
                  <option value="paypal">{t('payments.methods.paypal')}</option>
                  <option value="other">{t('payments.methods.other')}</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="payment_date" className="form-label">
                  {t('payments.paymentDate')}
                </label>
                <input
                  type="date"
                  id="payment_date"
                  value={formData.payment_date}
                  onChange={(e) => handleInputChange('payment_date', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="payment_status" className="form-label">
                  {t('payments.paymentStatus')}
                </label>
                <select
                  id="payment_status"
                  value={formData.payment_status}
                  onChange={(e) => handleInputChange('payment_status', e.target.value)}
                  className="form-select"
                >
                  <option value="completed">{t('payments.status.completed')}</option>
                  <option value="pending">{t('payments.status.pending')}</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="transaction_reference" className="form-label">
                {t('payments.transactionRef')} ({t('common.optional')})
              </label>
              <input
                type="text"
                id="transaction_reference"
                value={formData.transaction_reference}
                onChange={(e) => handleInputChange('transaction_reference', e.target.value)}
                className="form-input"
                placeholder={t('payments.enterTransactionRef')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                {t('payments.notes')} ({t('common.optional')})
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="form-input"
                rows="3"
                placeholder={t('payments.paymentNotes')}
              />
            </div>
          </div>

          {/* Receipt Upload Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('payments.receiptUpload')}</h3>
            
            <div className="file-upload-area">
              <input
                type="file"
                id="receipt"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="receipt" className="file-upload-label">
                <Upload size={20} />
                <span>
                  {receiptFile 
                    ? `Selected: ${receiptFile.name}`
                    : t('payments.uploadProofOfPayment')}
                </span>
              </label>
              <small className="file-upload-hint">
                JPEG, PNG, WebP, PDF up to 5MB
              </small>
            </div>
          </div>

          {/* Payment Summary */}
          {validation && (
            <div className="form-section">
              <h3 className="form-section-title">{t('payments.paymentSummary')}</h3>
              <div className="payment-summary">
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.cost')}</span>
                  <span className="summary-value">{formatCurrency(contract?.service_cost)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('payments.totalPaid')}</span>
                  <span className="summary-value">{formatCurrency(validation.totalPaid)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('payments.outstanding')}</span>
                  <span className="summary-value">{formatCurrency(validation.remainingAmount)}</span>
                </div>
                {formData.amount && (
                  <div className="summary-item total">
                    <span className="summary-label">
                      {t('payments.outstanding')} {t('contracts.after')} {t('payments.paymentDetails')}
                    </span>
                    <span className="summary-value">
                      {formatCurrency(Math.max(0, validation.remainingAmount - parseFloat(formData.amount)))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading || uploadingReceipt}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || uploadingReceipt || (!validation?.isValid && !editMode)}
            >
              {loading || uploadingReceipt ? (
                <>
                  <div className="loading-spinner-small"></div>
                  {uploadingReceipt 
                    ? 'Uploading...' 
                    : (editMode ? t('common.updating') : t('common.creating'))
                  }
                </>
              ) : (
                editMode ? t('payments.updatePayment') : t('payments.confirmPayment')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
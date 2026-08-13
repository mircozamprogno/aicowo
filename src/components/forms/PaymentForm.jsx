// src/components/forms/PaymentForm.jsx

import { Banknote, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { PaymentService } from '../../services/paymentService';
import { supabase } from '../../services/supabase';
import '../../styles/components/PaymentForm.css';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

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
  const [includeVAT, setIncludeVAT] = useState(true);
  const [vatInfo, setVatInfo] = useState({
    percentage: 0,
    baseAmount: 0,
    vatAmount: 0,
    totalAmount: 0
  });

  const { user } = useAuth();
  const { t } = useTranslation();

  // Payment method options
  const paymentMethodOptions = [
    { value: 'bank_transfer', label: t('payments.methods.bank_transfer') },
    { value: 'cash', label: t('payments.methods.cash') },
    { value: 'credit_card', label: t('payments.methods.credit_card') },
    { value: 'paypal', label: t('payments.methods.paypal') },
    { value: 'other', label: t('payments.methods.other') }
  ];

  // Payment status options
  const paymentStatusOptions = [
    { value: 'completed', label: t('payments.status.completed') },
    { value: 'pending', label: t('payments.status.pending') }
  ];

  useEffect(() => {
    if (isOpen && contract) {
      // Initialize form with contract data
      const initializeForm = async () => {
        // Fetch fresh location data to ensure we have vat_percentage
        let vatPercentage = 0;

        if (contract.location_id) {
          try {
            const { data: locationData, error: locationError } = await supabase
              .from('locations')
              .select('vat_percentage')
              .eq('id', contract.location_id)
              .single();

            if (!locationError && locationData) {
              vatPercentage = parseFloat(locationData.vat_percentage) || 0;
            } else {
              logger.warn('Could not load location VAT:', locationError);
            }
          } catch (error) {
            logger.error('Error fetching location data:', error);
          }
        }

        // Calculate VAT info with fetched data
        const baseAmount = parseFloat(contract.service_cost) || 0;
        const vatAmount = baseAmount * (vatPercentage / 100);
        const totalAmount = baseAmount + vatAmount;

        setVatInfo({
          percentage: vatPercentage,
          baseAmount,
          vatAmount,
          totalAmount
        });

        // Load existing payments
        const { data, error } = await PaymentService.getContractPayments(contract.id);

        if (error) {
          logger.error('Error loading payments:', error);
          setExistingPayments([]);
        } else {
          setExistingPayments(data || []);
        }

        // Now initialize form with loaded payments
        if (editMode && paymentToEdit) {
          populateEditForm();
        } else {
          // Calculate remaining with loaded payments
          const totalPaidGross = (data || [])
            .filter(p => p.payment_status === 'completed')
            .reduce((sum, p) => {
              const paymentAmount = p.amount_gross !== null && p.amount_gross !== undefined
                ? parseFloat(p.amount_gross)
                : parseFloat(p.amount);
              return sum + (paymentAmount || 0);
            }, 0);

          const contractGross = includeVAT ? totalAmount : baseAmount;
          const remainingAmount = Math.max(0, contractGross - totalPaidGross);
          const defaultAmount = remainingAmount > 0 ? remainingAmount : contractGross;

          const dueDate = contract?.payment_terms
            ? PaymentService.calculateDueDate(contract.start_date, contract.payment_terms)
            : null;

          const newFormData = {
            amount: defaultAmount > 0 ? defaultAmount.toFixed(2) : '',
            payment_method: 'bank_transfer',
            payment_date: new Date().toISOString().split('T')[0],
            due_date: dueDate ? dueDate.toISOString().split('T')[0] : '',
            transaction_reference: '',
            notes: '',
            payment_type: 'full',
            payment_status: 'completed'
          };

          setFormData(newFormData);
          setReceiptFile(null);

          // Trigger validation immediately after setting amount
          if (defaultAmount > 0) {
            validateAmountValue(defaultAmount, contractGross, totalPaidGross);
          }
        }
      };

      initializeForm();
    }
  }, [isOpen, contract, editMode, paymentToEdit]);

  useEffect(() => {
    if (formData.amount && contract && vatInfo.totalAmount > 0) {
      validateAmount();
    }
  }, [formData.amount, existingPayments, contract, includeVAT, vatInfo]);

  const populateEditForm = () => {
    if (!paymentToEdit) return;

    // Check if payment has VAT breakdown
    const hasVATBreakdown = paymentToEdit.amount_gross !== null &&
      paymentToEdit.amount_gross !== undefined;

    setFormData({
      amount: hasVATBreakdown
        ? paymentToEdit.amount_gross?.toString()
        : paymentToEdit.amount?.toString() || '',
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

    // Set VAT inclusion based on existing payment
    if (hasVATBreakdown) {
      setIncludeVAT(paymentToEdit.amount_vat > 0);
    }
  };

  const calculatePaymentBreakdown = (grossAmount) => {
    if (!includeVAT || vatInfo.percentage === 0) {
      return {
        net: grossAmount,
        vat: 0,
        gross: grossAmount,
        vatPercentage: 0
      };
    }

    // Calculate net from gross: net = gross / (1 + vat_rate)
    const net = grossAmount / (1 + (vatInfo.percentage / 100));
    const vat = grossAmount - net;

    return {
      net: parseFloat(net.toFixed(2)),
      vat: parseFloat(vat.toFixed(2)),
      gross: parseFloat(grossAmount.toFixed(2)),
      vatPercentage: vatInfo.percentage
    };
  };

  const validateAmountValue = (amount, contractTotal, totalPaid) => {
    const remainingGross = contractTotal - totalPaid;
    const isValid = amount <= remainingGross && amount > 0;
    const wouldOverpay = amount > remainingGross;

    setValidation({
      isValid,
      remainingAmount: remainingGross,
      totalPaid: totalPaid,
      wouldOverpay,
      contractTotal: contractTotal
    });
  };

  const validateAmount = () => {
    const amount = parseFloat(formData.amount);
    if (!amount || !contract) {
      setValidation(null);
      return;
    }

    // Calculate total paid (in gross amounts)
    const totalPaidGross = existingPayments
      .filter(p => !editMode || p.id !== paymentToEdit?.id)
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, p) => {
        // Use amount_gross if available, otherwise fall back to amount
        const paymentAmount = p.amount_gross !== null && p.amount_gross !== undefined
          ? parseFloat(p.amount_gross)
          : parseFloat(p.amount);
        return sum + (paymentAmount || 0);
      }, 0);

    // Total contract amount (gross)
    const contractGross = includeVAT ? vatInfo.totalAmount : vatInfo.baseAmount;

    validateAmountValue(amount, contractGross, totalPaidGross);

    // Auto-adjust payment type based on amount
    const remainingGross = contractGross - totalPaidGross;
    if (amount > 0 && amount <= remainingGross) {
      const newType = amount >= remainingGross ? 'full' : 'partial';
      if (formData.payment_type !== newType) {
        setFormData(prev => ({ ...prev, payment_type: newType }));
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVATToggle = () => {
    const newIncludeVAT = !includeVAT;
    setIncludeVAT(newIncludeVAT);

    // Recalculate default amount based on VAT inclusion
    if (!editMode && formData.amount) {
      // Recalculate based on current payments
      const totalPaidGross = existingPayments
        .filter(p => p.payment_status === 'completed')
        .reduce((sum, p) => {
          const paymentAmount = p.amount_gross !== null && p.amount_gross !== undefined
            ? parseFloat(p.amount_gross)
            : parseFloat(p.amount);
          return sum + (paymentAmount || 0);
        }, 0);

      const contractGross = newIncludeVAT ? vatInfo.totalAmount : vatInfo.baseAmount;
      const remainingAmount = Math.max(0, contractGross - totalPaidGross);
      const defaultAmount = remainingAmount > 0 ? remainingAmount : contractGross;

      setFormData(prev => ({
        ...prev,
        amount: defaultAmount > 0 ? defaultAmount.toFixed(2) : ''
      }));
    }
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

      const grossAmount = parseFloat(formData.amount);
      const breakdown = calculatePaymentBreakdown(grossAmount);

      const paymentData = {
        ...formData,
        contract_id: contract.id,
        partner_uuid: contract.partner_uuid,
        amount: breakdown.gross, // Keep for backward compatibility
        amount_net: breakdown.net,
        amount_vat: breakdown.vat,
        amount_gross: breakdown.gross,
        vat_percentage: breakdown.vatPercentage,
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
          logger.warn('Receipt upload failed:', uploadResult.error);
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
      logger.error('Error saving payment:', error);
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

  const currentPaymentBreakdown = formData.amount
    ? calculatePaymentBreakdown(parseFloat(formData.amount))
    : null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '42rem' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Banknote size={20} className="mr-2" />
            {editMode
              ? t('payments.editPayment')
              : t('payments.recordPaymentFor')} {contract?.contract_number}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Contract Info Section Removed */}


          {/* Payment Details Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('payments.paymentDetails')}</h3>

            {/* VAT Inclusion Toggle */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>
                <input
                  type="checkbox"
                  checked={includeVAT}
                  onChange={handleVATToggle}
                  style={{
                    marginRight: '0.5rem',
                    width: '1.125rem',
                    height: '1.125rem',
                    cursor: 'pointer'
                  }}
                />
                <span>{t('payments.includeVAT') || 'Include VAT in payment'} ({vatInfo.percentage}%)</span>
              </label>
              <small style={{
                display: 'block',
                marginTop: '0.25rem',
                color: '#6b7280',
                fontSize: '0.8rem',
                marginLeft: '1.625rem'
              }}>
                {includeVAT
                  ? (t('payments.paymentWithVAT') || 'Payment amount includes VAT')
                  : (t('payments.paymentWithoutVAT') || 'Payment amount is net (without VAT)')
                }
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount" className="form-label">
                  {t('payments.amount')} *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow only numbers and one decimal point
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      handleInputChange('amount', val);
                    }
                  }}
                  className="form-input"
                  placeholder="0.00"
                  required
                />
                {currentPaymentBreakdown && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    padding: '0.5rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '0.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>{t('contracts.baseAmount') || 'Net'}:</span>
                      <span>{formatCurrency(currentPaymentBreakdown.net)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>{t('contracts.vat') || 'VAT'} ({currentPaymentBreakdown.vatPercentage}%):</span>
                      <span>{formatCurrency(currentPaymentBreakdown.vat)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '0.25rem',
                      // borderTop: '1px solid #d1d5db', // REMOVE
                      fontWeight: '600'
                    }}>
                      <span>{t('contracts.total') || 'Total'}:</span>
                      <span>{formatCurrency(currentPaymentBreakdown.gross)}</span>
                    </div>
                  </div>
                )}
                {validation && (
                  <div className={`validation-info ${validation.isValid ? 'success' : 'error'}`}>
                    {validation.wouldOverpay ? (
                      <span className="validation-error">
                        Amount exceeds remaining balance of {formatCurrency(validation.remainingAmount)}
                      </span>
                    ) : validation.isValid ? (
                      <span className="validation-success">
                        ✓ {t('payments.validAmountRemaining')} {formatCurrency(validation.remainingAmount - parseFloat(formData.amount || 0))}
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
                <Select
                  value={formData.payment_method}
                  onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  options={paymentMethodOptions}
                  placeholder={t('payments.selectPaymentMethod')}
                />
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
                <Select
                  value={formData.payment_status}
                  onChange={(e) => handleInputChange('payment_status', e.target.value)}
                  options={paymentStatusOptions}
                  placeholder={t('payments.selectPaymentStatus')}
                />
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
                    ? receiptFile.name
                    : (t('payments.uploadProofOfPayment') || 'Upload proof of payment')}
                </span>
              </label>
              <small className="file-upload-hint">
                {t('payments.fileUploadHint') || 'JPEG, PNG, WebP, PDF up to 5MB'}
              </small>
            </div>
          </div>

          {/* Payment Summary */}
          {validation && (
            <div className="form-section">
              <h3 className="form-section-title">{t('payments.paymentSummary')}</h3>
              <div className="payment-summary">
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.contractTotal')}</span>
                  <span className="summary-value">{formatCurrency(validation.contractTotal)}</span>
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
                      {t('payments.afterPayment') || 'Outstanding after payment'}
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
              className="btn-primary-purple"
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
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const PartnerContractForm = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  contract = null,
  partners = [],
  pricingPlans = [],
  discountCodes = []
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isEditing = !!contract;
  
  const [formData, setFormData] = useState({
    partner_uuid: '',
    plan_id: '',
    discount_code_id: '',
    billing_frequency: 'monthly',
    contract_status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    auto_renew: false,
    contract_terms: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [calculatedPricing, setCalculatedPricing] = useState({
    basePrice: 0,
    discountAmount: 0,
    finalPrice: 0
  });

  // Update form data when contract changes
  useEffect(() => {
    if (contract) {
      logger.log('Loading contract data for editing:', contract);
      setFormData({
        partner_uuid: contract.partner_uuid || '',
        plan_id: contract.plan_id?.toString() || '',
        discount_code_id: contract.discount_code_id?.toString() || '',
        billing_frequency: contract.billing_frequency || 'monthly',
        contract_status: contract.contract_status || 'active',
        start_date: contract.start_date || new Date().toISOString().split('T')[0],
        end_date: contract.end_date || '',
        auto_renew: contract.auto_renew || false,
        contract_terms: contract.contract_terms || '',
        notes: contract.notes || ''
      });
    } else {
      // Reset form for new contract
      logger.log('Resetting form for new contract');
      setFormData({
        partner_uuid: '',
        plan_id: '',
        discount_code_id: '',
        billing_frequency: 'monthly',
        contract_status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        auto_renew: false,
        contract_terms: '',
        notes: ''
      });
    }
  }, [contract]);

  // Update selected plan when plan_id changes
  useEffect(() => {
    if (formData.plan_id) {
      const plan = pricingPlans.find(p => p.id.toString() === formData.plan_id);
      setSelectedPlan(plan);
    } else {
      setSelectedPlan(null);
    }
  }, [formData.plan_id, pricingPlans]);

  // Update selected discount when discount_code_id changes
  useEffect(() => {
    if (formData.discount_code_id) {
      const discount = discountCodes.find(d => d.id.toString() === formData.discount_code_id);
      setSelectedDiscount(discount);
    } else {
      setSelectedDiscount(null);
    }
  }, [formData.discount_code_id, discountCodes]);

  // Calculate pricing when plan, billing frequency, or discount changes
  useEffect(() => {
    if (selectedPlan) {
      const basePrice = formData.billing_frequency === 'monthly' 
        ? selectedPlan.monthly_price 
        : selectedPlan.yearly_price;

      let discountAmount = 0;
      if (selectedDiscount) {
        if (selectedDiscount.discount_type === 'percentage') {
          discountAmount = (basePrice * selectedDiscount.discount_value) / 100;
        } else {
          discountAmount = Math.min(selectedDiscount.discount_value, basePrice);
        }
      }

      const finalPrice = Math.max(0, basePrice - discountAmount);

      setCalculatedPricing({
        basePrice,
        discountAmount,
        finalPrice
      });
    } else {
      setCalculatedPricing({
        basePrice: 0,
        discountAmount: 0,
        finalPrice: 0
      });
    }
  }, [selectedPlan, formData.billing_frequency, selectedDiscount]);

  // Auto-calculate end date when start date or plan changes
  useEffect(() => {
    if (formData.start_date && selectedPlan && !isEditing) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(startDate);
      
      if (selectedPlan.is_trial) {
        endDate.setDate(startDate.getDate() + (selectedPlan.trial_duration_days || 14));
      } else if (formData.billing_frequency === 'monthly') {
        endDate.setFullYear(startDate.getFullYear() + 1); // 1 year contract
      } else {
        endDate.setFullYear(startDate.getFullYear() + 1); // 1 year contract
      }
      
      setFormData(prev => ({ 
        ...prev, 
        end_date: endDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.start_date, selectedPlan, formData.billing_frequency, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const generateContractNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `PC-${year}${month}-${random}`;
  };

  const validateForm = () => {
    if (!formData.partner_uuid) {
      toast.error(t('messages.partnerRequired') || 'Please select a partner');
      return false;
    }

    if (!formData.plan_id) {
      toast.error(t('messages.planRequired') || 'Please select a pricing plan');
      return false;
    }

    if (!formData.start_date) {
      toast.error(t('messages.startDateRequired') || 'Start date is required');
      return false;
    }

    if (!formData.end_date) {
      toast.error(t('messages.endDateRequired') || 'End date is required');
      return false;
    }

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    
    if (endDate <= startDate) {
      toast.error(t('messages.endDateMustBeAfterStartDate') || 'End date must be after start date');
      return false;
    }

    return true;
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
        partner_uuid: formData.partner_uuid,
        plan_id: parseInt(formData.plan_id),
        discount_code_id: formData.discount_code_id ? parseInt(formData.discount_code_id) : null,
        billing_frequency: formData.billing_frequency,
        contract_status: formData.contract_status,
        start_date: formData.start_date,
        end_date: formData.end_date,
        base_price: calculatedPricing.basePrice,
        discount_amount: calculatedPricing.discountAmount,
        final_price: calculatedPricing.finalPrice,
        currency: selectedPlan?.currency || 'EUR',
        auto_renew: formData.auto_renew,
        contract_terms: formData.contract_terms.trim() || null,
        notes: formData.notes.trim() || null,
        created_by_user_id: user?.id
      };

      let result;
      
      if (isEditing) {
        // Update existing contract
        result = await supabase
          .from('partners_contracts')
          .update(submitData)
          .eq('id', contract.id)
          .select(`
            *,
            partners!partners_contracts_partner_uuid_fkey (
              id,
              first_name,
              second_name,
              company_name,
              email
            ),
            partners_pricing_plans (
              id,
              plan_name,
              monthly_price,
              yearly_price,
              currency
            ),
            partners_discount_codes (
              id,
              code,
              discount_type,
              discount_value
            )
          `)
          .single();
      } else {
        // Create new contract
        const contractNumber = generateContractNumber();
        submitData.contract_number = contractNumber;

        // Check for existing active contract for this partner
        const { data: existingContract } = await supabase
          .from('partners_contracts')
          .select('id')
          .eq('partner_uuid', submitData.partner_uuid)
          .eq('contract_status', 'active')
          .single();

        if (existingContract) {
          toast.error(t('messages.partnerAlreadyHasActiveContract') || 'This partner already has an active contract');
          setLoading(false);
          return;
        }

        result = await supabase
          .from('partners_contracts')
          .insert([submitData])
          .select(`
            *,
            partners!partners_contracts_partner_uuid_fkey (
              id,
              first_name,
              second_name,
              company_name,
              email
            ),
            partners_pricing_plans (
              id,
              plan_name,
              monthly_price,
              yearly_price
            ),
            partners_discount_codes (
              id,
              code,
              discount_type,
              discount_value
            )
          `)
          .single();
      }

      const { data, error } = result;

      if (error) {
        logger.error('Error saving partner contract:', error);
        throw error;
      }

      toast.success(
        isEditing 
          ? t('messages.partnerContractUpdatedSuccessfully') || 'Partner contract updated successfully'
          : t('messages.partnerContractCreatedSuccessfully') || 'Partner contract created successfully'
      );
      
      onSuccess(data);
      onClose();
    } catch (error) {
      logger.error('Error saving partner contract:', error);
      toast.error(error.message || (isEditing ? t('messages.errorUpdatingPartnerContract') : t('messages.errorCreatingPartnerContract')));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getPartnerDisplayName = (partner) => {
    return partner.company_name || `${partner.first_name} ${partner.second_name}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container partner-contract-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('partnerContracts.editContract') : t('partnerContracts.addContract')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.partnerAndPlan')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="partner_uuid" className="form-label">
                  {t('partnerContracts.partner')} *
                </label>
                <select
                  id="partner_uuid"
                  name="partner_uuid"
                  required
                  className="form-select"
                  value={formData.partner_uuid}
                  onChange={handleChange}
                  disabled={isEditing} // Don't allow partner changes when editing
                >
                  <option value="">{t('partnerContracts.selectPartner')}</option>
                  {partners.filter(p => p.partner_status === 'active').map((partner) => (
                    <option key={partner.partner_uuid} value={partner.partner_uuid}>
                      {getPartnerDisplayName(partner)} ({partner.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="plan_id" className="form-label">
                  {t('partnerContracts.pricingPlan')} *
                </label>
                <select
                  id="plan_id"
                  name="plan_id"
                  required
                  className="form-select"
                  value={formData.plan_id}
                  onChange={handleChange}
                >
                  <option value="">{t('partnerContracts.selectPlan')}</option>
                  {pricingPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.plan_name} {plan.is_trial ? '(Trial)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedPlan && (
              <div className="plan-details">
                <h4>{t('partnerContracts.planDetails')}</h4>
                <div className="plan-info-display">
                  <div className="plan-detail-item">
                    <span className="detail-label">{t('partnerContracts.planName')}:</span>
                    <span className="detail-value">{selectedPlan.plan_name}</span>
                  </div>
                  {selectedPlan.is_trial ? (
                    <div className="plan-detail-item">
                      <span className="detail-label">{t('partnerContracts.trialDuration')}:</span>
                      <span className="detail-value">{selectedPlan.trial_duration_days} days</span>
                    </div>
                  ) : (
                    <>
                      <div className="plan-detail-item">
                        <span className="detail-label">{t('partnerContracts.monthlyPrice')}:</span>
                        <span className="detail-value">{formatCurrency(selectedPlan.monthly_price, selectedPlan.currency)}</span>
                      </div>
                      <div className="plan-detail-item">
                        <span className="detail-label">{t('partnerContracts.yearlyPrice')}:</span>
                        <span className="detail-value">{formatCurrency(selectedPlan.yearly_price, selectedPlan.currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.billingAndDiscount')}</h3>
            
            <div className="form-row">
              {selectedPlan && !selectedPlan.is_trial && (
                <div className="form-group">
                  <label htmlFor="billing_frequency" className="form-label">
                    {t('partnerContracts.billingFrequency')} *
                  </label>
                  <select
                    id="billing_frequency"
                    name="billing_frequency"
                    required
                    className="form-select"
                    value={formData.billing_frequency}
                    onChange={handleChange}
                  >
                    <option value="monthly">{t('partnerContracts.monthly')}</option>
                    <option value="yearly">{t('partnerContracts.yearly')}</option>
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label htmlFor="discount_code_id" className="form-label">
                  {t('partnerContracts.discountCode')} ({t('common.optional')})
                </label>
                <select
                  id="discount_code_id"
                  name="discount_code_id"
                  className="form-select"
                  value={formData.discount_code_id}
                  onChange={handleChange}
                >
                  <option value="">{t('partnerContracts.noDiscount')}</option>
                  {discountCodes.map((discount) => (
                    <option key={discount.id} value={discount.id}>
                      {discount.code} - {discount.discount_type === 'percentage' 
                        ? `${discount.discount_value}%` 
                        : formatCurrency(discount.discount_value, selectedPlan?.currency || 'EUR')
                      } off
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pricing Summary */}
            {selectedPlan && (
              <div className="pricing-summary">
                <h4>{t('partnerContracts.pricingSummary')}</h4>
                <div className="pricing-breakdown">
                  <div className="pricing-item">
                    <span className="pricing-label">{t('partnerContracts.basePrice')}:</span>
                    <span className="pricing-value">{formatCurrency(calculatedPricing.basePrice, selectedPlan?.currency)}</span>
                  </div>
                  {calculatedPricing.discountAmount > 0 && (
                    <div className="pricing-item discount">
                      <span className="pricing-label">{t('partnerContracts.discount')}:</span>
                      <span className="pricing-value">-{formatCurrency(calculatedPricing.discountAmount, selectedPlan?.currency)}</span>
                    </div>
                  )}
                  <div className="pricing-item total">
                    <span className="pricing-label">{t('partnerContracts.finalPrice')}:</span>
                    <span className="pricing-value">{formatCurrency(calculatedPricing.finalPrice, selectedPlan?.currency)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.contractPeriod')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_date" className="form-label">
                  {t('partnerContracts.startDate')} *
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  required
                  className="form-input"
                  value={formData.start_date}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="end_date" className="form-label">
                  {t('partnerContracts.endDate')} *
                </label>
                <input
                  id="end_date"
                  name="end_date"
                  type="date"
                  required
                  className="form-input"
                  value={formData.end_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contract_status" className="form-label">
                  {t('partnerContracts.contractStatus')} *
                </label>
                <select
                  id="contract_status"
                  name="contract_status"
                  required
                  className="form-select"
                  value={formData.contract_status}
                  onChange={handleChange}
                >
                  <option value="draft">{t('partnerContracts.draft')}</option>
                  <option value="active">{t('partnerContracts.active')}</option>
                  <option value="suspended">{t('partnerContracts.suspended')}</option>
                  <option value="cancelled">{t('partnerContracts.cancelled')}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    name="auto_renew"
                    checked={formData.auto_renew}
                    onChange={handleChange}
                    className="form-checkbox"
                  />
                  <span className="checkbox-text">
                    {t('partnerContracts.autoRenew')}
                  </span>
                </label>
                <small className="form-help">
                  {t('partnerContracts.autoRenewHelp')}
                </small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('partnerContracts.additionalInformation')}</h3>
            
            <div className="form-group">
              <label htmlFor="contract_terms" className="form-label">
                {t('partnerContracts.contractTerms')}
              </label>
              <textarea
                id="contract_terms"
                name="contract_terms"
                className="form-input"
                rows="4"
                placeholder="Enter specific terms and conditions for this contract..."
                value={formData.contract_terms}
                onChange={handleChange}
              />
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
                placeholder="Internal notes about this contract..."
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
              disabled={loading || !selectedPlan}
            >
              {loading 
                ? (isEditing ? t('common.updating') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnerContractForm;
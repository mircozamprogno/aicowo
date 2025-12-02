import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const PricingPlanForm = ({ isOpen, onClose, onSuccess, plan = null }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isEditing = !!plan;
  
  const [formData, setFormData] = useState({
    plan_name: '',
    plan_description: '',
    monthly_price: '',
    yearly_price: '',
    currency: 'EUR', // Add currency field with EUR default
    plan_status: 'active',
    is_trial: false,
    trial_duration_days: ''
  });
  
  const [loading, setLoading] = useState(false);

  // Add this currency options array near the top of your component:
  const currencyOptions = [
    { value: 'EUR', label: 'EUR (€)', symbol: '€' },
    { value: 'USD', label: 'USD ($)', symbol: '$' },
    { value: 'GBP', label: 'GBP (£)', symbol: '£' },
    { value: 'CHF', label: 'CHF (Fr)', symbol: 'Fr' },
    { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
    { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' }
  ];

  // Add this currency formatting function:
  const formatCurrencyPreview = (amount, currency) => {
    // More defensive checks
    if (!amount || isNaN(parseFloat(amount)) || !currency || currency.trim() === '') {
      return '';
    }
    
    try {
      const numAmount = parseFloat(amount);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.trim(),
        minimumFractionDigits: 2,
      }).format(numAmount);
    } catch (error) {
      logger.warn('Currency formatting error:', error);
      // Fallback format
      return `${amount} ${currency}`;
    }
  };
  
  // Update form data when plan changes
  useEffect(() => {
    if (plan) {
      logger.log('Loading plan data for editing:', plan);
      setFormData({
        plan_name: plan.plan_name || '',
        plan_description: plan.plan_description || '',
        monthly_price: plan.monthly_price?.toString() || '',
        yearly_price: plan.yearly_price?.toString() || '',
        currency: plan.currency || 'EUR', // Ensure currency is always set
        plan_status: plan.plan_status || 'active',
        is_trial: plan.is_trial || false,
        trial_duration_days: plan.trial_duration_days?.toString() || ''
      });
    } else {
      // Reset form for new plan
      logger.log('Resetting form for new plan');
      setFormData({
        plan_name: '',
        plan_description: '',
        monthly_price: '',
        yearly_price: '',
        currency: 'EUR', // Default currency
        plan_status: 'active',
        is_trial: false,
        trial_duration_days: ''
      });
    }
  }, [plan]);

  // Auto-calculate yearly price with 20% discount when monthly price changes
  useEffect(() => {
    if (!isEditing && formData.monthly_price && !formData.is_trial) {
      const monthlyPrice = parseFloat(formData.monthly_price);
      if (!isNaN(monthlyPrice)) {
        const yearlyPrice = Math.round((monthlyPrice * 12 * 0.8) * 100) / 100; // 20% discount
        setFormData(prev => ({ ...prev, yearly_price: yearlyPrice.toString() }));
      }
    }
  }, [formData.monthly_price, isEditing, formData.is_trial]);

  // Reset prices when switching to trial
  useEffect(() => {
    if (formData.is_trial) {
      setFormData(prev => ({ 
        ...prev, 
        monthly_price: '0', 
        yearly_price: '0',
        trial_duration_days: prev.trial_duration_days || '14'
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        trial_duration_days: ''
      }));
    }
  }, [formData.is_trial]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const validateForm = () => {
    if (!formData.plan_name.trim()) {
      toast.error(t('messages.planNameRequired') || 'Plan name is required');
      return false;
    }

    if (formData.is_trial) {
      const trialDays = parseInt(formData.trial_duration_days);
      if (!trialDays || trialDays < 1) {
        toast.error(t('messages.validTrialDurationRequired') || 'Valid trial duration is required');
        return false;
      }
    } else {
      const monthlyPrice = parseFloat(formData.monthly_price);
      const yearlyPrice = parseFloat(formData.yearly_price);

      if (isNaN(monthlyPrice) || monthlyPrice < 0) {
        toast.error(t('messages.validMonthlyPriceRequired') || 'Valid monthly price is required');
        return false;
      }

      if (isNaN(yearlyPrice) || yearlyPrice < 0) {
        toast.error(t('messages.validYearlyPriceRequired') || 'Valid yearly price is required');
        return false;
      }
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
        plan_name: formData.plan_name.trim(),
        plan_description: formData.plan_description.trim() || null,
        monthly_price: formData.is_trial ? 0 : parseFloat(formData.monthly_price),
        yearly_price: formData.is_trial ? 0 : parseFloat(formData.yearly_price),
        plan_status: formData.plan_status,
        is_trial: formData.is_trial,
        trial_duration_days: formData.is_trial ? parseInt(formData.trial_duration_days) : null,
        created_by_user_id: user?.id
      };

      let result;
      
      if (isEditing) {
        // Update existing plan
        result = await supabase
          .from('partners_pricing_plans')
          .update(submitData)
          .eq('id', plan.id)
          .select()
          .single();
      } else {
        // Create new plan - check for duplicate name first
        const { data: existingPlan } = await supabase
          .from('partners_pricing_plans')
          .select('id')
          .eq('plan_name', submitData.plan_name)
          .single();

        if (existingPlan) {
          toast.error(t('messages.planNameExists') || 'A plan with this name already exists');
          setLoading(false);
          return;
        }

        result = await supabase
          .from('partners_pricing_plans')
          .insert([submitData])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) {
        logger.error('Error saving pricing plan:', error);
        throw error;
      }

      toast.success(
        isEditing 
          ? t('messages.pricingPlanUpdatedSuccessfully') || 'Pricing plan updated successfully'
          : t('messages.pricingPlanCreatedSuccessfully') || 'Pricing plan created successfully'
      );
      
      onSuccess(data);
      onClose();
    } catch (error) {
      logger.error('Error saving pricing plan:', error);
      toast.error(error.message || (isEditing ? t('messages.errorUpdatingPricingPlan') : t('messages.errorCreatingPricingPlan')));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('pricingPlans.editPlan') : t('pricingPlans.addPlan')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section">
            <h3 className="form-section-title">{t('pricingPlans.basicInformation')}</h3>
            
            <div className="form-group">
              <label htmlFor="plan_name" className="form-label">
                {t('pricingPlans.planName')} *
              </label>
              <input
                id="plan_name"
                name="plan_name"
                type="text"
                required
                className="form-input"
                placeholder="e.g., Professional, Enterprise, Starter"
                value={formData.plan_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="currency" className="form-label">
                  {t('pricingPlans.currency') || 'Currency'} *
                </label>
                <select
                  id="currency"
                  name="currency"
                  required
                  className="form-select"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  {currencyOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="plan_status" className="form-label">
                {t('pricingPlans.planStatus')} *
              </label>
              <select
                id="plan_status"
                name="plan_status"
                required
                className="form-select"
                value={formData.plan_status}
                onChange={handleChange}
              >
                <option value="active">{t('pricingPlans.active')}</option>
                <option value="inactive">{t('pricingPlans.inactive')}</option>
                <option value="archived">{t('pricingPlans.archived')}</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('pricingPlans.planType')}</h3>
            
            <div className="form-group">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  name="is_trial"
                  checked={formData.is_trial}
                  onChange={handleChange}
                  className="form-checkbox"
                />
                <span className="checkbox-text">
                  {t('pricingPlans.isTrialPlan')}
                </span>
              </label>
              <small className="form-help">
                {t('pricingPlans.trialPlanHelp')}
              </small>
            </div>

            {formData.is_trial && (
              <div className="form-group">
                <label htmlFor="trial_duration_days" className="form-label">
                  {t('pricingPlans.trialDuration')} *
                </label>
                <div className="input-with-suffix">
                  <input
                    id="trial_duration_days"
                    name="trial_duration_days"
                    type="number"
                    min="1"
                    max="365"
                    required
                    className="form-input"
                    placeholder="14"
                    value={formData.trial_duration_days}
                    onChange={handleChange}
                  />
                  <span className="input-suffix">{t('pricingPlans.days')}</span>
                </div>
                <small className="form-help">
                  {t('pricingPlans.trialDurationHelp')}
                </small>
              </div>
            )}
          </div>

          {!formData.is_trial && (
            <div className="form-section">
              <h3 className="form-section-title">{t('pricingPlans.pricing')}</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="monthly_price" className="form-label">
                    {t('pricingPlans.monthlyPrice') || 'Monthly Price'} *
                  </label>
                  <div className="price-input-container">
                    <input
                      id="monthly_price"
                      name="monthly_price"
                      type="number"
                      step="0.01"
                      min="0"
                      required={!formData.is_trial}
                      disabled={formData.is_trial}
                      className="form-input"
                      placeholder={t('placeholders.monthlyPrice') || '29.99'}
                      value={formData.monthly_price}
                      onChange={handleChange}
                    />
                    {formData.monthly_price && formData.currency && (
                      <span className="price-preview">
                        {formatCurrencyPreview(formData.monthly_price, formData.currency)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="yearly_price" className="form-label">
                    {t('pricingPlans.yearlyPrice') || 'Yearly Price'} *
                  </label>
                  <div className="price-input-container">
                    <input
                      id="yearly_price"
                      name="yearly_price"
                      type="number"
                      step="0.01"
                      min="0"
                      required={!formData.is_trial}
                      disabled={formData.is_trial}
                      className="form-input"
                      placeholder={t('placeholders.yearlyPrice') || '299.99'}
                      value={formData.yearly_price}
                      onChange={handleChange}
                    />
                    {formData.yearly_price && formData.currency && (
                      <span className="price-preview">
                        {formatCurrencyPreview(formData.yearly_price, formData.currency)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {formData.monthly_price && formData.yearly_price && (
                <div className="pricing-preview">
                  <h4>{t('pricingPlans.pricingPreview')}</h4>
                  <div className="preview-comparison">
                    <div className="preview-item">
                      <span className="preview-label">{t('pricingPlans.monthlyTotal')}</span>
                      <span className="preview-value">
                        {formatCurrencyPreview((parseFloat(formData.monthly_price) * 12), formData.currency)}/{t('pricingPlans.year')}
                      </span>
                    </div>
                    <div className="preview-item">
                      <span className="preview-label">{t('pricingPlans.yearlyPrice')}</span>
                      <span className="preview-value">
                        {formatCurrencyPreview(parseFloat(formData.yearly_price), formData.currency)}/{t('pricingPlans.year')}
                      </span>
                    </div>
                    {(() => {
                      const monthlyTotal = parseFloat(formData.monthly_price) * 12;
                      const yearlyPrice = parseFloat(formData.yearly_price);
                      const savings = monthlyTotal - yearlyPrice;
                      const savingsPercentage = Math.round((savings / monthlyTotal) * 100);
                      
                      return savings > 0 ? (
                        <div className="preview-item savings">
                          <span className="preview-label">{t('pricingPlans.yearlySavings')}</span>
                          <span className="preview-value savings-value">
                            {formatCurrencyPreview(savings, formData.currency)} ({savingsPercentage}% {t('pricingPlans.off')})
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

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
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PricingPlanForm;
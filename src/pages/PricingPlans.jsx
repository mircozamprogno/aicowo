import { CreditCard, Edit, Eye, Plus, Settings, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import PricingPlanForm from '../components/forms/PricingPlanForm';
import PlanFeaturesModal from '../components/modals/PlanFeaturesModal';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/pages/pricing-plans.css';

const PricingPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const { profile } = useAuth();
  const { t } = useTranslation();

  // Check if user is superadmin
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchPlans();
    }
  }, [isSuperAdmin]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_pricing_plans')
        .select(`
          *,
          plan_feature_count:partners_plan_feature_mappings(count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pricing plans:', error);
        // Mock data for development
        setPlans([
          {
            id: 1,
            plan_name: 'Basic',
            plan_description: 'Perfect for small coworking spaces',
            monthly_price: 29.99,
            yearly_price: 299.99,
            plan_status: 'active',
            is_trial: false,
            trial_duration_days: null,
            created_at: new Date().toISOString(),
            plan_feature_count: [{ count: 5 }]
          },
          {
            id: 2,
            plan_name: 'Professional',
            plan_description: 'Ideal for growing businesses',
            monthly_price: 79.99,
            yearly_price: 799.99,
            plan_status: 'active',
            is_trial: false,
            trial_duration_days: null,
            created_at: new Date().toISOString(),
            plan_feature_count: [{ count: 12 }]
          },
          {
            id: 3,
            plan_name: 'Free Trial',
            plan_description: '14-day trial to test all features',
            monthly_price: 0,
            yearly_price: 0,
            plan_status: 'active',
            is_trial: true,
            trial_duration_days: 14,
            created_at: new Date().toISOString(),
            plan_feature_count: [{ count: 8 }]
          }
        ]);
      } else {
        setPlans(data || []);
      }
    } catch (error) {
      console.error('Error fetching pricing plans:', error);
      toast.error(t('messages.errorLoadingPricingPlans') || 'Error loading pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPlan(null);
  };

  const handleFormSuccess = (savedPlan) => {
    if (editingPlan) {
      setPlans(prev => 
        prev.map(p => p.id === savedPlan.id ? savedPlan : p)
      );
      toast.success(t('messages.pricingPlanUpdatedSuccessfully') || 'Pricing plan updated successfully');
    } else {
      setPlans(prev => [savedPlan, ...prev]);
      toast.success(t('messages.pricingPlanCreatedSuccessfully') || 'Pricing plan created successfully');
    }
    setShowForm(false);
    setEditingPlan(null);
  };

  const handleDeletePlan = (plan) => {
    setPlanToDelete(plan);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('partners_pricing_plans')
        .delete()
        .eq('id', planToDelete.id);

      if (error) {
        console.error('Error deleting pricing plan:', error);
        toast.error(t('messages.errorDeletingPricingPlan') || 'Error deleting pricing plan');
        return;
      }

      setPlans(prev => prev.filter(p => p.id !== planToDelete.id));
      toast.success(t('messages.pricingPlanDeletedSuccessfully') || 'Pricing plan deleted successfully');
    } catch (error) {
      console.error('Error deleting pricing plan:', error);
      toast.error(t('messages.errorDeletingPricingPlan') || 'Error deleting pricing plan');
    } finally {
      setShowDeleteConfirm(false);
      setPlanToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setPlanToDelete(null);
  };

  const handleManageFeatures = (plan) => {
    setSelectedPlan(plan);
    setShowFeaturesModal(true);
  };

  const handleFeaturesModalClose = () => {
    setShowFeaturesModal(false);
    setSelectedPlan(null);
  };

  const handleFeaturesUpdated = () => {
    // Refresh plans to update feature counts
    fetchPlans();
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getFeatureCount = (plan) => {
    return plan.plan_feature_count?.[0]?.count || 0;
  };

  const getYearlySavings = (monthlyPrice, yearlyPrice) => {
    const yearlyFromMonthly = monthlyPrice * 12;
    const savings = yearlyFromMonthly - yearlyPrice;
    const percentage = Math.round((savings / yearlyFromMonthly) * 100);
    return { savings, percentage };
  };

  // Access control
  if (!isSuperAdmin) {
    return (
      <div className="pricing-plans-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can manage pricing plans.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="pricing-plans-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="pricing-plans-page">
      <div className="pricing-plans-header">
        <div className="pricing-plans-header-content">
          <h1 className="pricing-plans-title">
            <CreditCard size={24} className="mr-2" />
            {t('pricingPlans.title')}
          </h1>
          <p className="pricing-plans-description">
            {t('pricingPlans.subtitle')}
          </p>
          <div className="pricing-plans-stats">
            <div className="stat-item">
              <span className="stat-label">{t('pricingPlans.totalPlans')}</span>
              <span className="stat-value">{plans.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('pricingPlans.activePlans')}</span>
              <span className="stat-value">
                {plans.filter(p => p.plan_status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('pricingPlans.trialPlans')}</span>
              <span className="stat-value">
                {plans.filter(p => p.is_trial).length}
              </span>
            </div>
          </div>
        </div>
        <div className="pricing-plans-header-actions">
          <button className="add-plan-btn" onClick={handleAddPlan}>
            <Plus size={16} className="mr-2" />
            {t('pricingPlans.addPlan')}
          </button>
        </div>
      </div>

      <div className="pricing-plans-grid">
        {plans.map((plan) => {
          const featureCount = getFeatureCount(plan);
          const yearlySavings = getYearlySavings(plan.monthly_price, plan.yearly_price);
          
          return (
            <div key={plan.id} className={`pricing-plan-card ${plan.is_trial ? 'trial-plan' : ''}`}>
              <div className="plan-header">
                <div className="plan-name-section">
                  <h3 className="plan-name">{plan.plan_name}</h3>
                  <div className="plan-badges">
                    <span className={`status-badge ${plan.plan_status === 'active' ? 'status-active' : 'status-inactive'}`}>
                      {t(`pricingPlans.${plan.plan_status}`)}
                    </span>
                    {plan.is_trial && (
                      <span className="trial-badge">
                        {t('pricingPlans.trial')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="plan-actions">
                  <button 
                    className="action-btn view-btn"
                    onClick={() => handleManageFeatures(plan)}
                    title={t('pricingPlans.manageFeatures')}
                  >
                    <Settings size={16} />
                  </button>
                  <button 
                    className="action-btn edit-btn"
                    onClick={() => handleEditPlan(plan)}
                    title={t('pricingPlans.editPlan')}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="action-btn delete-btn"
                    onClick={() => handleDeletePlan(plan)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {plan.plan_description && (
                <p className="plan-description">{plan.plan_description}</p>
              )}

              <div className="plan-pricing">
                {plan.is_trial ? (
                  <div className="trial-pricing">
                    <span className="trial-text">{t('pricingPlans.freeTrial')}</span>
                    <span className="trial-duration">
                      {plan.trial_duration_days} {t('pricingPlans.days')}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="price-option">
                      <span className="price-label">{t('pricingPlans.monthly')}</span>
                      <span className="price-value">{formatCurrency(plan.monthly_price, plan.currency)}</span>
                      <span className="price-period">/{t('pricingPlans.month')}</span>
                    </div>
                    
                    <div className="price-option yearly">
                      <span className="price-label">{t('pricingPlans.yearly')}</span>
                      <span className="price-value">{formatCurrency(plan.yearly_price, plan.currency)}</span>
                      <span className="price-period">/{t('pricingPlans.year')}</span>
                      {yearlySavings.percentage > 0 && (
                        <span className="savings-badge">
                          {t('pricingPlans.save')} {yearlySavings.percentage}%
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="plan-features-summary">
                <div className="features-count">
                  <span className="count">{featureCount}</span>
                  <span className="label">{t('pricingPlans.featuresIncluded')}</span>
                </div>
                <button 
                  className="view-features-btn"
                  onClick={() => handleManageFeatures(plan)}
                >
                  <Eye size={14} />
                  {t('pricingPlans.viewFeatures')}
                </button>
              </div>

              <div className="plan-footer">
                <small className="created-date">
                  {t('common.createdAt')}: {new Date(plan.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          );
        })}
        
        {plans.length === 0 && (
          <div className="pricing-plans-empty">
            <CreditCard size={48} className="empty-icon" />
            <p>{t('pricingPlans.noPlansFound')}</p>
            <button 
              onClick={handleAddPlan}
              className="btn-primary mt-4"
            >
              {t('pricingPlans.addFirstPlan')}
            </button>
          </div>
        )}
      </div>

      {/* Pricing Plan Form Modal */}
      <PricingPlanForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        plan={editingPlan}
      />

      {/* Plan Features Management Modal */}
      <PlanFeaturesModal
        isOpen={showFeaturesModal}
        onClose={handleFeaturesModalClose}
        plan={selectedPlan}
        onFeaturesUpdated={handleFeaturesUpdated}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && planToDelete && (
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
                  <p>Are you sure you want to delete the plan "{planToDelete.plan_name}"?</p>
                  <p className="warning-note">
                    This action cannot be undone and will affect all partner contracts using this plan.
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

export default PricingPlans;
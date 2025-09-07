import { DollarSign, Edit, File, Plus, Printer, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import PartnerContractForm from '../components/forms/PartnerContractForm';
import PartnerPaymentHistoryModal from '../components/modals/PartnerPaymentHistoryModal';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { generatePartnerContractPDF } from '../services/partnerContractGenerator';
import { supabase } from '../services/supabase';
import '../styles/pages/partner-contracts.css';

const PartnerContracts = () => {
  const [contracts, setContracts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contractToDelete, setContractToDelete] = useState(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');

  const { profile } = useAuth();
  const { t } = useTranslation();

  const [generatingPDF, setGeneratingPDF] = useState(null); // contract ID being processed

  // Check if user is superadmin
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchContracts();
      fetchPartners();
      fetchPricingPlans();
      fetchDiscountCodes();
    }
  }, [isSuperAdmin]);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_contracts')
        .select(`
          *,
          partners!partners_contracts_partner_uuid_fkey (
            id,
            first_name,
            second_name,
            company_name,
            email,
            address,
            zip,
            city,
            country,
            piva,
            phone
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching partner contracts:', error);
        // Mock data for development
        setContracts([
          {
            id: 1,
            contract_uuid: 'pc-1',
            contract_number: 'PC-2025-001',
            partner_uuid: 'partner-1',
            plan_id: 1,
            billing_frequency: 'monthly',
            contract_status: 'active',
            start_date: '2025-01-01',
            end_date: '2025-12-31',
            base_price: 79.99,
            discount_amount: 0,
            final_price: 79.99,
            currency: 'USD',
            auto_renew: true,
            created_at: new Date().toISOString(),
            partners: {
              id: 1,
              first_name: 'TechSpace',
              second_name: 'Milano',
              company_name: 'TechSpace Milano SRL',
              email: 'info@techspace.com'
            },
            partners_pricing_plans: {
              id: 1,
              plan_name: 'Professional',
              monthly_price: 79.99,
              yearly_price: 799.99
            },
            partners_discount_codes: null
          },
          {
            id: 2,
            contract_uuid: 'pc-2',
            contract_number: 'PC-2025-002',
            partner_uuid: 'partner-2',
            plan_id: 2,
            billing_frequency: 'yearly',
            contract_status: 'active',
            start_date: '2025-01-15',
            end_date: '2026-01-15',
            base_price: 1199.99,
            discount_amount: 200.00,
            final_price: 999.99,
            currency: 'USD',
            auto_renew: false,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            partners: {
              id: 2,
              first_name: 'CoWork',
              second_name: 'Hub',
              company_name: 'CoWork Hub Ltd',
              email: 'admin@coworkhub.com'
            },
            partners_pricing_plans: {
              id: 2,
              plan_name: 'Enterprise',
              monthly_price: 149.99,
              yearly_price: 1199.99
            },
            partners_discount_codes: {
              id: 1,
              code: 'LAUNCH25',
              discount_type: 'fixed_amount',
              discount_value: 200.00
            }
          }
        ]);
      } else {
        setContracts(data || []);
      }
    } catch (error) {
      console.error('Error fetching partner contracts:', error);
      toast.error(t('messages.errorLoadingPartnerContracts') || 'Error loading partner contracts');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('partner_uuid, first_name, second_name, company_name, email, partner_status')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Error fetching partners:', error);
        // Mock data for development
        setPartners([
          {
            partner_uuid: 'partner-1',
            first_name: 'TechSpace',
            second_name: 'Milano',
            company_name: 'TechSpace Milano SRL',
            email: 'info@techspace.com',
            partner_status: 'active'
          },
          {
            partner_uuid: 'partner-2',
            first_name: 'CoWork',
            second_name: 'Hub',
            company_name: 'CoWork Hub Ltd',
            email: 'admin@coworkhub.com',
            partner_status: 'active'
          }
        ]);
      } else {
        setPartners(data || []);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchPricingPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_pricing_plans')
        .select('*')
        .eq('plan_status', 'active')
        .order('plan_name', { ascending: true });

      if (error) {
        console.error('Error fetching pricing plans:', error);
        // Mock data for development
        setPricingPlans([
          {
            id: 1,
            plan_name: 'Professional',
            monthly_price: 79.99,
            yearly_price: 799.99,
            is_trial: false
          },
          {
            id: 2,
            plan_name: 'Enterprise',
            monthly_price: 149.99,
            yearly_price: 1199.99,
            is_trial: false
          },
          {
            id: 3,
            plan_name: 'Free Trial',
            monthly_price: 0,
            yearly_price: 0,
            is_trial: true,
            trial_duration_days: 14
          }
        ]);
      } else {
        setPricingPlans(data || []);
      }
    } catch (error) {
      console.error('Error fetching pricing plans:', error);
    }
  };

  const fetchDiscountCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_discount_codes')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) {
        console.error('Error fetching discount codes:', error);
        // Mock data for development
        setDiscountCodes([
          {
            id: 1,
            code: 'LAUNCH25',
            discount_type: 'fixed_amount',
            discount_value: 200.00,
            description: 'Launch discount'
          },
          {
            id: 2,
            code: 'SUMMER30',
            discount_type: 'percentage',
            discount_value: 30,
            description: 'Summer promotion'
          }
        ]);
      } else {
        setDiscountCodes(data || []);
      }
    } catch (error) {
      console.error('Error fetching discount codes:', error);
    }
  };

  const handleAddContract = () => {
    setEditingContract(null);
    setShowForm(true);
  };

  const handleEditContract = (contract) => {
    setEditingContract(contract);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingContract(null);
  };

  const handleFormSuccess = (savedContract) => {
    if (editingContract) {
      setContracts(prev => 
        prev.map(c => c.id === savedContract.id ? savedContract : c)
      );
      toast.success(t('messages.partnerContractUpdatedSuccessfully') || 'Partner contract updated successfully');
    } else {
      setContracts(prev => [savedContract, ...prev]);
      toast.success(t('messages.partnerContractCreatedSuccessfully') || 'Partner contract created successfully');
    }
    setShowForm(false);
    setEditingContract(null);
  };

  const handleDeleteContract = (contract) => {
    setContractToDelete(contract);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('partners_contracts')
        .delete()
        .eq('id', contractToDelete.id);

      if (error) {
        console.error('Error deleting partner contract:', error);
        toast.error(t('messages.errorDeletingPartnerContract') || 'Error deleting partner contract');
        return;
      }

      setContracts(prev => prev.filter(c => c.id !== contractToDelete.id));
      toast.success(t('messages.partnerContractDeletedSuccessfully') || 'Partner contract deleted successfully');
    } catch (error) {
      console.error('Error deleting partner contract:', error);
      toast.error(t('messages.errorDeletingPartnerContract') || 'Error deleting partner contract');
    } finally {
      setShowDeleteConfirm(false);
      setContractToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setContractToDelete(null);
  };

  const handleViewPayments = (contract) => {
    setSelectedContract(contract);
    setShowPaymentHistory(true);
  };

  const handlePaymentHistoryClose = () => {
    setShowPaymentHistory(false);
    setSelectedContract(null);
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'expired':
        return 'status-expired';
      case 'cancelled':
        return 'status-cancelled';
      case 'suspended':
        return 'status-suspended';
      case 'draft':
        return 'status-draft';
      default:
        return 'status-inactive';
    }
  };

  const getBillingFrequencyLabel = (frequency) => {
    return frequency === 'monthly' ? t('partnerContracts.monthly') : t('partnerContracts.yearly');
  };

  const getPartnerDisplayName = (contract) => {
    const partner = contract.partners;
    return partner?.company_name || `${partner?.first_name} ${partner?.second_name}`;
  };

  const calculateNextPaymentDate = (contract) => {
    const startDate = new Date(contract.start_date);
    const today = new Date();
    
    if (contract.billing_frequency === 'monthly') {
      const nextMonth = new Date(startDate);
      while (nextMonth <= today) {
        nextMonth.setMonth(nextMonth.getMonth() + 1);
      }
      return nextMonth;
    } else {
      const nextYear = new Date(startDate);
      while (nextYear <= today) {
        nextYear.setFullYear(nextYear.getFullYear() + 1);
      }
      return nextYear;
    }
  };

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    const statusMatch = filterStatus === 'all' || contract.contract_status === filterStatus;
    const planMatch = filterPlan === 'all' || contract.plan_id.toString() === filterPlan;
    return statusMatch && planMatch;
  });

  // Get unique statuses and plans for filters
  const uniqueStatuses = [...new Set(contracts.map(c => c.contract_status))];
  const usedPlans = [...new Set(contracts.map(c => c.plan_id))];

  const handleGeneratePDF = async (contract) => {
    if (!contract) return;
    
    setGeneratingPDF(contract.id);
    
    try {
      // Get partner data from the contract
      const partnerData = contract.partners;
      
      // Use company logo from Supabase storage, fallback to partner logo
      const companyLogoUrl = `${supabase.storage.from('powercowo').getPublicUrl('/logo.png').data.publicUrl}`;
      const partnerLogoUrl = partnerData?.partner_uuid ? 
        `${supabase.storage.from('logos').getPublicUrl(`partners/${partnerData.partner_uuid}/logo.png`).data.publicUrl}` : 
        null;

      const logoUrl = companyLogoUrl; // Always use company logo for contracts
      
      await generatePartnerContractPDF(contract, partnerData, logoUrl, t);
      
      toast.success(t('partnerContracts.pdfGenerated') || 'PDF generato con successo');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('partnerContracts.pdfError') || 'Errore durante la generazione del PDF');
    } finally {
      setGeneratingPDF(null);
    }
  };

  // Access control
  if (!isSuperAdmin) {
    return (
      <div className="partner-contracts-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can manage partner contracts.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="partner-contracts-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="partner-contracts-page">
      <div className="partner-contracts-header">
        <div className="partner-contracts-header-content">
          <h1 className="partner-contracts-title">
            <File size={24} className="mr-2" />
            {t('partnerContracts.title')}
          </h1>
          <p className="partner-contracts-description">
            {t('partnerContracts.subtitle')}
          </p>
          <div className="partner-contracts-stats">
            <div className="stat-item">
              <span className="stat-label">{t('partnerContracts.totalContracts')}</span>
              <span className="stat-value">{contracts.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('partnerContracts.activeContracts')}</span>
              <span className="stat-value">
                {contracts.filter(c => c.contract_status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('partnerContracts.monthlyContracts')}</span>
              <span className="stat-value">
                {contracts.filter(c => c.contract_status === 'active' && c.billing_frequency === 'monthly').length}
              </span>
            </div>
          </div>
        </div>
        <div className="partner-contracts-header-actions">
          <button className="add-contract-btn" onClick={handleAddContract}>
            <Plus size={16} className="mr-2" />
            {t('partnerContracts.addContract')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="partner-contracts-filters">
        <div className="filter-group">
          <label htmlFor="status-filter" className="filter-label">
            {t('partnerContracts.contractStatus')}:
          </label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.all')}</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {t(`partnerContracts.${status}`)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="plan-filter" className="filter-label">
            {t('partnerContracts.pricingPlan')}:
          </label>
          <select
            id="plan-filter"
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.all')}</option>
            {usedPlans.map(planId => {
              const plan = pricingPlans.find(p => p.id === planId);
              return plan ? (
                <option key={planId} value={planId}>
                  {plan.plan_name}
                </option>
              ) : null;
            })}
          </select>
        </div>
      </div>

      <div className="partner-contracts-table-container">
        <div className="partner-contracts-table-wrapper">
          <table className="partner-contracts-table">
            <thead className="partner-contracts-table-head">
              <tr>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.contract')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.partner')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.plan')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.billing')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.amount')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.period')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.status')}
                </th>
                <th className="partner-contracts-table-header">
                  {t('partnerContracts.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="partner-contracts-table-body">
              {filteredContracts.map((contract) => {
                const nextPayment = calculateNextPaymentDate(contract);
                
                return (
                  <tr key={contract.id} className="partner-contracts-table-row">
                    <td className="partner-contracts-table-cell">
                      <div className="contract-info">
                        <div className="contract-number">{contract.contract_number}</div>
                        <div className="contract-created">
                          {t('common.createdAt')}: {formatDate(contract.created_at)}
                        </div>
                      </div>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <div className="partner-info">
                        <div className="partner-name">
                          {getPartnerDisplayName(contract)}
                        </div>
                        <div className="partner-email">{contract.partners?.email}</div>
                      </div>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <div className="plan-info">
                        <div className="plan-name">{contract.partners_pricing_plans?.plan_name}</div>
                        {contract.partners_discount_codes && (
                          <div className="discount-code">
                            Code: {contract.partners_discount_codes.code}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <div className="billing-info">
                        <div className="billing-frequency">
                          {getBillingFrequencyLabel(contract.billing_frequency)}
                        </div>
                        {contract.auto_renew && (
                          <div className="auto-renew">Auto-renew</div>
                        )}
                      </div>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <div className="amount-info">
                        <div className="final-price">
                          {formatCurrency(contract.final_price, contract.partners_pricing_plans?.currency || 'EUR')}
                        </div>
                        {contract.discount_amount > 0 && (
                          <div className="discount-info">
                            <span className="base-price">
                              {formatCurrency(contract.base_price, contract.partners_pricing_plans?.currency || 'EUR')}
                            </span>
                            <span className="discount">
                              -{formatCurrency(contract.discount_amount, contract.partners_pricing_plans?.currency || 'EUR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <div className="period-info">
                        <div className="period-dates">
                          {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                        </div>
                        {contract.contract_status === 'active' && (
                          <div className="next-payment">
                            {t('partnerContracts.nextPayment')}: {formatDate(nextPayment)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <span className={`status-badge ${getStatusBadgeClass(contract.contract_status)}`}>
                        {t(`partnerContracts.${contract.contract_status}`)}
                      </span>
                    </td>
                    <td className="partner-contracts-table-cell">
                      <div className="contract-actions">
                        <button 
                          className="action-btn view-btn"
                          onClick={() => handleViewPayments(contract)}
                          title={t('partnerContracts.viewPayments')}
                        >
                          <DollarSign size={16} />
                        </button>
                        <button 
                          className="action-btn edit-btn"
                          onClick={() => handleEditContract(contract)}
                          title={t('partnerContracts.editContract')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleGeneratePDF(contract)}
                          className="btn-icon btn-print"
                          title={t('partnerContracts.printContract') || 'Stampa Contratto'}
                          disabled={generatingPDF === contract.id}
                        >
                          {generatingPDF === contract.id ? (
                            <div className="spinner-small"></div>
                          ) : (
                            <Printer size={16} />
                          )}
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteContract(contract)}
                          title={t('common.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredContracts.length === 0 && (
            <div className="partner-contracts-empty">
              <File size={48} className="empty-icon" />
              <p>{contracts.length === 0 ? t('partnerContracts.noContractsFound') : 'No contracts match the current filters'}</p>
              {contracts.length === 0 && (
                <button 
                  onClick={handleAddContract}
                  className="btn-primary mt-4"
                >
                  {t('partnerContracts.addFirstContract')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Partner Contract Form Modal */}
      <PartnerContractForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        contract={editingContract}
        partners={partners}
        pricingPlans={pricingPlans}
        discountCodes={discountCodes}
      />

      {/* Partner Payment History Modal */}
      <PartnerPaymentHistoryModal
        isOpen={showPaymentHistory}
        onClose={handlePaymentHistoryClose}
        contract={selectedContract}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && contractToDelete && (
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
                  <p>Are you sure you want to delete contract "{contractToDelete.contract_number}"?</p>
                  <p className="warning-note">
                    This action cannot be undone and will affect the partner's platform access.
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

export default PartnerContracts;
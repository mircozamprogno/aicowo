import { Edit2, FileText, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import ContractForm from '../components/forms/ContractForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Contracts = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const { profile } = useAuth();
  const { t } = useTranslation();

  // Determine user capabilities
  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';
  const canCreateContracts = isCustomer || isPartnerAdmin;

  useEffect(() => {
    if (profile) {
      fetchContracts();
      if (isPartnerAdmin) {
        fetchCustomersAndLocations();
      }
    }
  }, [profile]);

  const fetchContracts = async () => {
    try {
      console.log('Fetching contracts for user:', profile);
      
      let query = supabase
        .from('contracts')
        .select(`
          *,
          customers (
            id,
            first_name,
            second_name,
            email,
            company_name
          ),
          services (
            id,
            service_name,
            service_type
          ),
          locations (
            id,
            location_name
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters based on user role
      if (isCustomer) {
        // Users see only their own contracts
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', profile.id)
          .single();
        
        if (customerData) {
          query = query.eq('customer_id', customerData.id);
        }
      } else if (isPartnerAdmin) {
        // Partner admins see contracts for their partner
        query = query.eq('partner_uuid', profile.partner_uuid);
      }
      // Superadmins see all contracts (no additional filter)

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching contracts:', error);
        
        // Provide mock data for development
        const mockContracts = [
          {
            id: 1,
            contract_uuid: 'mock-contract-1',
            contract_number: 'TECH-MIL-20250107-0001',
            start_date: '2025-01-07',
            end_date: '2025-02-07',
            service_name: 'Hot Desk Monthly',
            service_type: 'abbonamento',
            service_cost: 150.00,
            service_currency: 'EUR',
            location_name: 'Milano Centro',
            resource_name: 'Hot Desks Area A',
            resource_type: 'scrivania',
            contract_status: 'active',
            entries_used: 0,
            service_max_entries: null,
            created_at: new Date().toISOString(),
            customers: {
              first_name: 'Mario',
              second_name: 'Rossi',
              email: 'mario.rossi@email.com',
              company_name: null
            }
          },
          {
            id: 2,
            contract_uuid: 'mock-contract-2', 
            contract_number: 'TECH-MIL-20250105-0001',
            start_date: '2025-01-05',
            end_date: '2025-04-05',
            service_name: 'Meeting Room Package',
            service_type: 'pacchetto',
            service_cost: 200.00,
            service_currency: 'EUR',
            location_name: 'Milano Centro',
            resource_name: 'Small Meeting Room',
            resource_type: 'sala_riunioni',
            contract_status: 'active',
            entries_used: 3,
            service_max_entries: 10,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            customers: {
              first_name: 'Anna',
              second_name: 'Verdi',
              email: 'anna.verdi@company.com',
              company_name: 'Verdi SRL'
            }
          }
        ];
        
        setContracts(mockContracts);
      } else {
        setContracts(data || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
      toast.error(t('messages.errorLoadingContracts'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersAndLocations = async () => {
    try {
      // Fetch customers for partner admin
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, first_name, second_name, email, company_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('first_name');

      if (customersError) {
        console.error('Error fetching customers:', customersError);
      } else {
        setCustomers(customersData || []);
      }

      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
      } else {
        setLocations(locationsData || []);
      }
    } catch (error) {
      console.error('Error fetching customers and locations:', error);
    }
  };

  const handleCreateContract = () => {
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleFormSuccess = (savedContract) => {
    setContracts(prev => [savedContract, ...prev]);
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
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
      default:
        return 'status-inactive';
    }
  };

  const getServiceTypeBadgeClass = (type) => {
    const classes = {
      abbonamento: 'service-type-subscription',
      pacchetto: 'service-type-package',
      free_trial: 'service-type-trial'
    };
    return classes[type] || 'service-type-default';
  };

  const getServiceTypeLabel = (type) => {
    const types = {
      abbonamento: t('services.subscription'),
      pacchetto: t('services.package'),
      free_trial: t('services.freeTrial')
    };
    return types[type] || type;
  };

  const getResourceTypeIcon = (type) => {
    return type === 'scrivania' ? '🪑' : '🏢';
  };

  const calculateDaysRemaining = (endDate) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return <div className="contracts-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="contracts-page">
      <div className="contracts-header">
        <div className="contracts-header-content">
          <h1 className="contracts-title">
            <FileText size={24} className="mr-2" />
            {t('contracts.title')}
          </h1>
          <p className="contracts-description">
            {isCustomer 
              ? t('contracts.manageYourContracts')
              : t('contracts.managePartnerContracts')
            }
          </p>
          <div className="contracts-stats">
            <div className="stat-item">
              <span className="stat-label">{t('contracts.totalContracts')}</span>
              <span className="stat-value">{contracts.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('contracts.activeContracts')}</span>
              <span className="stat-value">
                {contracts.filter(c => c.contract_status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('contracts.expiredContracts')}</span>
              <span className="stat-value">
                {contracts.filter(c => c.contract_status === 'expired').length}
              </span>
            </div>
          </div>
        </div>
        {canCreateContracts && (
          <div className="contracts-header-actions">
            <button className="add-contract-btn" onClick={handleCreateContract}>
              <Plus size={16} className="mr-2" />
              {t('contracts.createContract')}
            </button>
          </div>
        )}
      </div>

      <div className="contracts-table-container">
        <div className="contracts-table-wrapper">
          <table className="contracts-table">
            <thead className="contracts-table-head">
              <tr>
                <th className="contracts-table-header">
                  {t('contracts.contract')}
                </th>
                {!isCustomer && (
                  <th className="contracts-table-header">
                    {t('contracts.customer')}
                  </th>
                )}
                <th className="contracts-table-header">
                  {t('contracts.service')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.location')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.period')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.cost')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.status')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="contracts-table-body">
              {contracts.map((contract) => {
                const daysRemaining = calculateDaysRemaining(contract.end_date);
                return (
                  <tr key={contract.id} className="contracts-table-row">
                    <td className="contracts-table-cell">
                      <div className="contract-info">
                        <div className="contract-number">{contract.contract_number}</div>
                        <div className="contract-created">
                          {t('common.createdAt')}: {formatDate(contract.created_at)}
                        </div>
                      </div>
                    </td>
                    {!isCustomer && (
                      <td className="contracts-table-cell">
                        <div className="customer-info">
                          <div className="customer-name">
                            {contract.customers?.company_name || 
                             `${contract.customers?.first_name} ${contract.customers?.second_name}`}
                          </div>
                          <div className="customer-email">{contract.customers?.email}</div>
                        </div>
                      </td>
                    )}
                    <td className="contracts-table-cell">
                      <div className="service-info">
                        <div className="service-header">
                          <span className="service-name">{contract.service_name}</span>
                          <span className={`service-type-badge ${getServiceTypeBadgeClass(contract.service_type)}`}>
                            {getServiceTypeLabel(contract.service_type)}
                          </span>
                        </div>
                        {contract.service_type === 'pacchetto' && contract.service_max_entries && (
                          <div className="usage-info">
                            {contract.entries_used || 0} / {contract.service_max_entries} {t('contracts.entriesUsed')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="contracts-table-cell">
                      <div className="location-info">
                        <div className="location-name">{contract.location_name}</div>
                        <div className="resource-info">
                          <span className="resource-icon">
                            {getResourceTypeIcon(contract.resource_type)}
                          </span>
                          {contract.resource_name}
                        </div>
                      </div>
                    </td>
                    <td className="contracts-table-cell">
                      <div className="period-info">
                        <div className="period-dates">
                          {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                        </div>
                        {contract.contract_status === 'active' && (
                          <div className={`days-remaining ${daysRemaining <= 7 ? 'warning' : ''}`}>
                            {daysRemaining > 0 
                              ? `${daysRemaining} ${t('contracts.daysRemaining')}`
                              : t('contracts.expired')
                            }
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="contracts-table-cell">
                      <div className="cost-info">
                        {formatCurrency(contract.service_cost, contract.service_currency)}
                      </div>
                    </td>
                    <td className="contracts-table-cell">
                      <span className={`status-badge ${getStatusBadgeClass(contract.contract_status)}`}>
                        {t(`contracts.${contract.contract_status}`)}
                      </span>
                    </td>
                    <td className="contracts-table-cell">
                      <div className="contract-actions">
                        <button 
                          className="view-btn"
                          onClick={() => {/* TODO: Implement contract details view */}}
                          title={t('contracts.viewContract')}
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {contracts.length === 0 && (
            <div className="contracts-empty">
              <FileText size={48} className="empty-icon" />
              <p>{t('contracts.noContractsFound')}</p>
              {canCreateContracts && (
                <button 
                  onClick={handleCreateContract}
                  className="btn-primary mt-4"
                >
                  {t('contracts.createFirstContract')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contract Form Modal */}
      <ContractForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        partnerUuid={profile?.partner_uuid}
        isCustomerMode={isCustomer}
        customers={customers}
        locations={locations}
      />
    </div>
  );
};

export default Contracts;
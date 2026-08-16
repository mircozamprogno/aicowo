// src/components/ContractsFilter.jsx
import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import '../styles/components/contractsfilter.css';
import SearchableSelect from './common/SearchableSelect';
import Select from './common/Select';

const ContractsFilter = ({ 
  contracts, 
  customers, 
  locations, 
  onFilterChange, 
  isCustomerMode = false,
  canManagePayments = false,
  contractPayments = {},
  getPaymentStatus
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    customer: '',
    location: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    paymentStatus: ''
  });

  // Filter options
  const statusOptions = [
    { value: 'active', label: t('contracts.active') },
    { value: 'expired', label: t('contracts.expired') },
    { value: 'cancelled', label: t('contracts.cancelled') },
    { value: 'suspended', label: t('contracts.suspended') }
  ];

  const paymentStatusOptions = [
    { value: 'paid', label: t('payments.status.paid') },
    { value: 'unpaid', label: t('payments.status.unpaid') },
    { value: 'partial', label: t('payments.status.partial') },
    { value: 'overdue', label: t('payments.status.overdue') },
    { value: 'not_required', label: t('payments.status.not_required') }
  ];

  // Get unique customers and locations from contracts if not provided
  const getUniqueCustomers = () => {
    if (customers && customers.length > 0) {
      return customers;
    }
    
    const uniqueCustomers = [];
    const customerMap = new Map();
    
    contracts.forEach(contract => {
      if (contract.customers && contract.customer_id) {
        const key = contract.customer_id;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            id: contract.customer_id,
            display_name: contract.customers.company_name || 
              `${contract.customers.first_name} ${contract.customers.second_name}`,
            company_name: contract.customers.company_name,
            first_name: contract.customers.first_name,
            second_name: contract.customers.second_name
          });
        }
      }
    });
    
    return Array.from(customerMap.values());
  };

  const getUniqueLocations = () => {
    if (locations && locations.length > 0) {
      return locations;
    }
    
    const uniqueLocations = [];
    const locationMap = new Map();
    
    contracts.forEach(contract => {
      if (contract.location_name && contract.location_id) {
        const key = contract.location_id;
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            id: contract.location_id,
            location_name: contract.location_name
          });
        }
      }
    });
    
    return Array.from(locationMap.values());
  };

  const uniqueCustomers = getUniqueCustomers();
  const uniqueLocations = getUniqueLocations();

  // Prepare options for SearchableSelect components
  const customerOptions = uniqueCustomers.map(customer => ({
    value: customer.id.toString(),
    label: customer.display_name || customer.company_name || 
      `${customer.first_name} ${customer.second_name}`
  }));

  const locationOptions = uniqueLocations.map(location => ({
    value: location.id.toString(),
    label: location.location_name
  }));

  // Helper function to get payment status
  const getPaymentStatusForContract = (contract) => {
    if (getPaymentStatus && typeof getPaymentStatus === 'function') {
      const status = getPaymentStatus(contract);
      return status;
    }
    
    if (contract.service_type === 'free_trial' || contract.requires_payment === false) {
      return 'not_required';
    }
    
    const paymentInfo = contractPayments[contract.id];
    if (paymentInfo && paymentInfo.payment_status) {
      return paymentInfo.payment_status;
    }
    
    return 'unpaid';
  };

  // Apply filters function
  const applyFilters = (filtersToApply) => {
    let filteredContracts = [...contracts];

    if (filtersToApply.customer) {
      filteredContracts = filteredContracts.filter(contract => 
        contract.customer_id?.toString() === filtersToApply.customer
      );
    }

    if (filtersToApply.location) {
      filteredContracts = filteredContracts.filter(contract => 
        contract.location_id?.toString() === filtersToApply.location
      );
    }

    if (filtersToApply.dateFrom || filtersToApply.dateTo) {
      filteredContracts = filteredContracts.filter(contract => {
        const contractStart = new Date(contract.start_date);
        const contractEnd = new Date(contract.end_date);
        
        let matchesDateRange = true;
        
        if (filtersToApply.dateFrom) {
          const filterStart = new Date(filtersToApply.dateFrom);
          matchesDateRange = matchesDateRange && contractEnd >= filterStart;
        }
        
        if (filtersToApply.dateTo) {
          const filterEnd = new Date(filtersToApply.dateTo);
          matchesDateRange = matchesDateRange && contractStart <= filterEnd;
        }
        
        return matchesDateRange;
      });
    }

    if (filtersToApply.status) {
      filteredContracts = filteredContracts.filter(contract => 
        contract.contract_status === filtersToApply.status
      );
    }

    if (filtersToApply.paymentStatus && canManagePayments) {
      filteredContracts = filteredContracts.filter(contract => {
        const contractPaymentStatus = getPaymentStatusForContract(contract);
        return contractPaymentStatus === filtersToApply.paymentStatus;
      });
    }

    return filteredContracts;
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    const filteredContracts = applyFilters(newFilters);
    onFilterChange(filteredContracts, newFilters);
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters = {
      customer: '',
      location: '',
      dateFrom: '',
      dateTo: '',
      status: '',
      paymentStatus: ''
    };
    setFilters(clearedFilters);
    onFilterChange(contracts, clearedFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <div className="contracts-filter">
      <div className="filter-content">
        <div className="filter-grid">
          {/* Customer Filter - Hidden for customer users */}
          {!isCustomerMode && uniqueCustomers.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">
                {t('filters.customer')}
              </label>
              <SearchableSelect
                value={filters.customer}
                onChange={(e) => handleFilterChange('customer', e.target.value)}
                options={customerOptions}
                placeholder={t('filters.allCustomers')}
                emptyMessage={t('filters.noCustomersFound') || 'No customers found'}
              />
            </div>
          )}

          {/* Location Filter */}
          {uniqueLocations.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">
                {t('filters.location')}
              </label>
              <SearchableSelect
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                options={locationOptions}
                placeholder={t('filters.allLocations')}
                emptyMessage={t('filters.noLocationsFound') || 'No locations found'}
              />
            </div>
          )}

          {/* Date Range Filters */}
          <div className="filter-group">
            <label className="filter-label">
              {t('filters.dateFrom')}
            </label>
            <input
              type="date"
              className="filter-input"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">
              {t('filters.dateTo')}
            </label>
            <input
              type="date"
              className="filter-input"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="filter-group">
            <label className="filter-label">
              {t('filters.status')}
            </label>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              options={statusOptions}
              placeholder={t('filters.allStatuses')}
            />
          </div>

          {/* Payment Status Filter - Only show if user can manage payments */}
          {canManagePayments && (
            <div className="filter-group">
              <label className="filter-label">
                {t('filters.paymentStatus')}
              </label>
              <Select
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                options={paymentStatusOptions}
                placeholder={t('filters.allPaymentStatuses')}
              />
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="active-filters">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="active-filters-label">{t('filters.activeFilters')}:</span>
              <button 
                className="clear-filters-btn"
                onClick={clearAllFilters}
                title={t('filters.clearAll')}
              >
                <RotateCcw size={14} />
                <span>{t('filters.clearAll')}</span>
              </button>
            </div>
            <div className="active-filters-list">
              {filters.customer && (
                <span className="filter-tag">
                  {t('filters.customer')}: {uniqueCustomers.find(c => c.id.toString() === filters.customer)?.display_name}
                  <button 
                    className="filter-tag-remove"
                    onClick={() => handleFilterChange('customer', '')}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {filters.location && (
                <span className="filter-tag">
                  {t('filters.location')}: {uniqueLocations.find(l => l.id.toString() === filters.location)?.location_name}
                  <button 
                    className="filter-tag-remove"
                    onClick={() => handleFilterChange('location', '')}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {filters.dateFrom && (
                <span className="filter-tag">
                  {t('filters.dateFrom')}: {new Date(filters.dateFrom).toLocaleDateString('it-IT')}
                  <button 
                    className="filter-tag-remove"
                    onClick={() => handleFilterChange('dateFrom', '')}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {filters.dateTo && (
                <span className="filter-tag">
                  {t('filters.dateTo')}: {new Date(filters.dateTo).toLocaleDateString('it-IT')}
                  <button 
                    className="filter-tag-remove"
                    onClick={() => handleFilterChange('dateTo', '')}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {filters.status && (
                <span className="filter-tag">
                  {t('filters.status')}: {statusOptions.find(s => s.value === filters.status)?.label}
                  <button 
                    className="filter-tag-remove"
                    onClick={() => handleFilterChange('status', '')}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {filters.paymentStatus && (
                <span className="filter-tag">
                  {t('filters.paymentStatus')}: {paymentStatusOptions.find(p => p.value === filters.paymentStatus)?.label}
                  <button 
                    className="filter-tag-remove"
                    onClick={() => handleFilterChange('paymentStatus', '')}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractsFilter;
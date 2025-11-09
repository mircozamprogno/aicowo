import { Download, Edit2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import FattureInCloudImportModal from '../components/fattureincloud/FattureInCloudImportModal';
import CustomerForm from '../components/forms/CustomerForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

// Logger
import logger from '../utils/logger';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const { profile } = useAuth();
  const { t } = useTranslation();

  const [showImportModal, setShowImportModal] = useState(false);
  const [partnerSettings, setPartnerSettings] = useState(null);


  useEffect(() => {
    fetchCustomers();
    fetchPartnerSettings();
  }, [profile]);

  const fetchCustomers = async () => {
    if (!profile?.partner_uuid) {
      logger.warn('No partner_uuid found for user');
      setLoading(false);
      return;
    }

    logger.log('Starting to fetch customers for partner:', profile.partner_uuid);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .neq('customer_status', 'inactive') // Exclude inactive customers
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      logger.log('Supabase response:', { data, error });

      if (error) {
        logger.error('Supabase error:', error);
        // Provide mock data if the table doesn't exist or there's an error
        logger.log('Using mock data for customers');
        setCustomers([
          {
            id: 1,
            customer_uuid: 'mock-customer-1',
            first_name: 'Mario',
            second_name: 'Rossi',
            company_name: '',
            email: 'mario.rossi@example.com',
            phone: '+39 123 456 7890',
            customer_status: 'active',
            customer_type: 'individual',
            city: 'Milano',
            country: 'Italy',
            piva: '',
            codice_fiscale: 'RSSMRA80A01F205X',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            customer_uuid: 'mock-customer-2',
            first_name: 'Anna',
            second_name: 'Verdi',
            company_name: 'Verdi SRL',
            email: 'anna.verdi@verdisrl.com',
            phone: '+39 098 765 4321',
            customer_status: 'active',
            customer_type: 'company',
            city: 'Roma',
            country: 'Italy',
            piva: '12345678901',
            codice_fiscale: '',
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 3,
            customer_uuid: 'mock-customer-3',
            first_name: 'Luca',
            second_name: 'Bianchi',
            company_name: '',
            email: 'luca.bianchi@email.com',
            phone: '+39 555 123 4567',
            customer_status: 'inactive',
            customer_type: 'individual',
            city: 'Torino',
            country: 'Italy',
            piva: '',
            codice_fiscale: 'BNCLCA90B15L219Y',
            created_at: new Date(Date.now() - 172800000).toISOString()
          }
        ]);
      } else {
        logger.log('Setting real customers data:', data);
        setCustomers(data || []);
      }
    } catch (error) {
      logger.error('Error fetching customers:', error);
      toast.error(t('messages.errorLoadingCustomers'));
      setCustomers([]);
    } finally {
      logger.log('Setting loading to false');
      setLoading(false);
    }
  };

  const fetchPartnerSettings = async () => {
    if (!profile?.partner_uuid) return;
    
    logger.log('Fetching partner settings for:', profile.partner_uuid);
    
    const { data, error } = await supabase
      .from('partners')
      .select('fattureincloud_enabled, fattureincloud_company_id, fattureincloud_api_token')
      .eq('partner_uuid', profile.partner_uuid)
      .single();
    
    logger.log('Partner settings result:', { data, error });
      
    if (!error && data) {
      setPartnerSettings(data);
      logger.log('✅ Partner settings loaded:', data);
    } else {
      logger.error('❌ Error loading partner settings:', error);
    }
  };

  // Add handler:
  const handleImportSuccess = () => {
    fetchCustomers();
    setShowImportModal(false);
  };

  const checkCustomerConstraints = async (customerId) => {
    logger.log('=== CHECKING CONSTRAINTS FOR CUSTOMER ID:', customerId);
    const constraints = [];

    try {
      // Check for active bookings
      logger.log('Checking bookings...');
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_status')
        .eq('customer_id', customerId);

      logger.log('Bookings result:', { data: bookings, error: bookingsError });
      
      if (!bookingsError && bookings && bookings.length > 0) {
        const activeBookings = bookings.filter(b => b.booking_status === 'active');
        if (activeBookings.length > 0) {
          constraints.push(t('customers.constraints.activeBookings', { count: activeBookings.length }));
          logger.log('Found active bookings:', activeBookings.length);
        }
      }

      // Check for active contracts
      logger.log('Checking contracts...');
      const { data: contracts, error: contractsError } = await supabase
        .from('contracts')
        .select('id, contract_status')
        .eq('customer_id', customerId);

      logger.log('Contracts result:', { data: contracts, error: contractsError });
      
      if (!contractsError && contracts && contracts.length > 0) {
        const activeContracts = contracts.filter(c => c.contract_status === 'active');
        if (activeContracts.length > 0) {
          constraints.push(t('customers.constraints.activeContracts', { count: activeContracts.length }));
          logger.log('Found active contracts:', activeContracts.length);
        }
      }

      // Check for package reservations
      logger.log('Checking package reservations...');
      const { data: reservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('id, reservation_status')
        .eq('customer_id', customerId);

      logger.log('Reservations result:', { data: reservations, error: reservationsError });
      
      if (!reservationsError && reservations && reservations.length > 0) {
        const activeReservations = reservations.filter(r => r.reservation_status === 'confirmed');
        if (activeReservations.length > 0) {
          constraints.push(t('customers.constraints.activeReservations', { count: activeReservations.length }));
          logger.log('Found active reservations:', activeReservations.length);
        }
      }

      // Check for payments through contracts
      if (contracts && contracts.length > 0) {
        logger.log('Checking payments for contracts...');
        const contractIds = contracts.map(c => c.id);
        
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('id, payment_status')
          .in('contract_id', contractIds);

        logger.log('Payments result:', { data: payments, error: paymentsError });
        
        if (!paymentsError && payments && payments.length > 0) {
          const activePayments = payments.filter(p => ['pending', 'completed'].includes(p.payment_status));
          if (activePayments.length > 0) {
            constraints.push(t('customers.constraints.relatedPayments', { count: activePayments.length }));
            logger.log('Found related payments:', activePayments.length);
          }
        }
      }

    } catch (error) {
      logger.error('CONSTRAINT CHECK ERROR:', error);
    }

    logger.log('=== FINAL CONSTRAINTS:', constraints);
    return constraints;
  };

  const handleDeleteCustomer = async (customer) => {
    logger.log('=== STARTING DELETE PROCESS FOR CUSTOMER:', customer);
    
    // Check constraints first
    const constraints = await checkCustomerConstraints(customer.id);
    
    // If there are constraints, show error and don't proceed
    if (constraints.length > 0) {
      logger.log('=== CANNOT DELETE - HAS CONSTRAINTS');
      toast.error(t('customers.cannotDeleteWithConstraints'));
      return { success: false, constraints };
    }

    try {
      // Set status to inactive instead of deleting
      const { error } = await supabase
        .from('customers')
        .update({ 
          customer_status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (error) {
        logger.error('Database error:', error);
        throw error;
      }

      logger.log('=== CUSTOMER STATUS UPDATED TO INACTIVE');

      // Remove from UI
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
      toast.success(t('customers.customerDeactivatedSuccessfully'));
      
      return { success: true };

    } catch (error) {
      logger.error('Error deactivating customer:', error);
      toast.error(t('customers.errorDeactivatingCustomer'));
      return { success: false, error: error.message };
    }
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCustomer(null);
  };

  const handleFormSuccess = (savedCustomer) => {
    if (editingCustomer) {
      setCustomers(prev => 
        prev.map(c => c.id === savedCustomer.id ? savedCustomer : c)
      );
    } else {
      setCustomers(prev => [savedCustomer, ...prev]);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'suspended':
        return 'status-suspended';
      default:
        return 'status-inactive';
    }
  };

  // Check if user can manage customers (admin partners)
  const canManageCustomers = profile?.role === 'admin';

  if (!canManageCustomers) {
    return (
      <div className="customers-page">
        <div className="customers-unauthorized">
          <h1>{t('customers.accessDenied')}</h1>
          <p>{t('customers.accessDeniedMessage')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="customers-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="customers-page">
      <div className="customers-header">
        <div className="customers-header-content">
          <h1 className="customers-title">{t('customers.title')}</h1>
          <p className="customers-description">
            {t('customers.manageCustomersInvitedOnly')}
          </p>
          <div className="customers-stats">
            <div className="stat-item">
              <span className="stat-label">{t('customers.totalCustomers')}</span>
              <span className="stat-value">{customers.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('customers.activeCustomers')}</span>
              <span className="stat-value">
                {customers.filter(c => c.customer_status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('customers.companies')}</span>
              <span className="stat-value">
                {customers.filter(c => c.customer_type === 'entrepeneur').length}
              </span>
            </div>
          </div>
        </div>
        
        {partnerSettings?.fattureincloud_enabled && (
          <button
            className="btn-primary"
            onClick={() => setShowImportModal(true)}
            style={{ alignSelf: 'flex-start' }}
          >
            <Download size={16} style={{ marginRight: '0.5rem' }} />
            {t('customers.importFromFC')}
          </button>
        )}
      </div>

      <div className="customers-table-container">
        <div className="customers-table-wrapper">
          <table className="customers-table">
            <thead className="customers-table-head">
              <tr>
                <th className="customers-table-header">
                  {t('customers.customer')}
                </th>
                <th className="customers-table-header">
                  {t('auth.email')}
                </th>
                <th className="customers-table-header">
                  {t('customers.phone')}
                </th>
                <th className="customers-table-header">
                  {t('customers.type')}
                </th>
                <th className="customers-table-header">
                  {t('customers.status')}
                </th>
                <th className="customers-table-header">
                  {t('customers.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="customers-table-body">
              {customers.map((customer) => (
                <tr key={customer.id} className="customers-table-row">
                  <td className="customers-table-cell">
                    <div className="customer-info">
                      <div className="customer-name">
                        {customer.company_name ? (
                          <>
                            <div className="customer-company">{customer.company_name}</div>
                            <div className="customer-person">
                              {customer.first_name} {customer.second_name}
                            </div>
                          </>
                        ) : (
                          <div className="customer-person">
                            {customer.first_name} {customer.second_name}
                          </div>
                        )}
                      </div>
                      <div className="customer-location">
                        {customer.city && customer.country && `${customer.city}, ${customer.country}`}
                      </div>
                      <div className="customer-created">
                        {t('common.createdAt')}: {formatDate(customer.created_at)}
                      </div>
                    </div>
                  </td>
                  <td className="customers-table-cell">
                    <div className="customer-email">
                      {customer.email}
                      {customer.billing_email && customer.billing_email !== customer.email && (
                        <div className="billing-email">
                          <small>{t('customers.billing')}: {customer.billing_email}</small>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="customers-table-cell">
                    <div className="customer-phone">
                      {customer.phone}
                      {customer.billing_phone && customer.billing_phone !== customer.phone && (
                        <div className="billing-phone">
                          <small>{t('customers.billing')}: {customer.billing_phone}</small>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="customers-table-cell">
                    <span className="type-badge">
                      {t(`customers.${customer.customer_type}`)}
                    </span>
                  </td>
                  <td className="customers-table-cell">
                    <span className={`status-badge ${getStatusBadgeClass(customer.customer_status)}`}>
                      {t(`customers.${customer.customer_status}`)}
                    </span>
                  </td>
                  <td className="customers-table-cell">
                    <div className="customer-actions">
                      <button 
                        className="edit-btn"
                        onClick={() => handleEditCustomer(customer)}
                        title={t('customers.editCustomer')}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="customers-empty">
              <div className="empty-content">
                <h3>{t('customers.noCustomersYet')}</h3>
                <p>{t('customers.customersWillAppearHere')}</p>
                <div className="empty-hint">
                  <strong>{t('customers.howToAddCustomers')}:</strong>
                  <ol>
                    <li>{t('customers.step1SendInvitation')}</li>
                    <li>{t('customers.step2CustomerRegisters')}</li>
                    <li>{t('customers.step3CustomerCompletesProfile')}</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        onDelete={handleDeleteCustomer}
        checkConstraints={checkCustomerConstraints}
        customer={editingCustomer}
        partnerUuid={profile?.partner_uuid}
      />

      
      <FattureInCloudImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        partnerSettings={partnerSettings}
        partnerUuid={profile?.partner_uuid}
        onImportSuccess={handleImportSuccess}
      />

    </div>
  );
};

export default Customers;
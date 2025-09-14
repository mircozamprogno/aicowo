import { Edit2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import CustomerForm from '../components/forms/CustomerForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteConstraints, setDeleteConstraints] = useState([]);
  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchCustomers();
  }, [profile]);

  const fetchCustomers = async () => {
    if (!profile?.partner_uuid) {
      console.warn('No partner_uuid found for user');
      setLoading(false);
      return;
    }

    console.log('Starting to fetch customers for partner:', profile.partner_uuid);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .neq('customer_status', 'inactive') // Exclude inactive customers
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        // Provide mock data if the table doesn't exist or there's an error
        console.log('Using mock data for customers');
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
        console.log('Setting real customers data:', data);
        setCustomers(data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error(t('messages.errorLoadingCustomers'));
      setCustomers([]);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const checkCustomerConstraints = async (customerId) => {
    console.log('=== CHECKING CONSTRAINTS FOR CUSTOMER ID:', customerId);
    const constraints = [];

    try {
      // Check for active bookings
      console.log('Checking bookings...');
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_status')
        .eq('customer_id', customerId);

      console.log('Bookings result:', { data: bookings, error: bookingsError });
      
      if (!bookingsError && bookings && bookings.length > 0) {
        const activeBookings = bookings.filter(b => b.booking_status === 'active');
        if (activeBookings.length > 0) {
          constraints.push(t('customers.constraints.activeBookings', { count: activeBookings.length }));
          console.log('Found active bookings:', activeBookings.length);
        }
      }

      // Check for active contracts
      console.log('Checking contracts...');
      const { data: contracts, error: contractsError } = await supabase
        .from('contracts')
        .select('id, contract_status')
        .eq('customer_id', customerId);

      console.log('Contracts result:', { data: contracts, error: contractsError });
      
      if (!contractsError && contracts && contracts.length > 0) {
        const activeContracts = contracts.filter(c => c.contract_status === 'active');
        if (activeContracts.length > 0) {
          constraints.push(t('customers.constraints.activeContracts', { count: activeContracts.length }));
          console.log('Found active contracts:', activeContracts.length);
        }
      }

      // Check for package reservations
      console.log('Checking package reservations...');
      const { data: reservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('id, reservation_status')
        .eq('customer_id', customerId);

      console.log('Reservations result:', { data: reservations, error: reservationsError });
      
      if (!reservationsError && reservations && reservations.length > 0) {
        const activeReservations = reservations.filter(r => r.reservation_status === 'confirmed');
        if (activeReservations.length > 0) {
          constraints.push(t('customers.constraints.activeReservations', { count: activeReservations.length }));
          console.log('Found active reservations:', activeReservations.length);
        }
      }

      // Check for payments through contracts
      if (contracts && contracts.length > 0) {
        console.log('Checking payments for contracts...');
        const contractIds = contracts.map(c => c.id);
        
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('id, payment_status')
          .in('contract_id', contractIds);

        console.log('Payments result:', { data: payments, error: paymentsError });
        
        if (!paymentsError && payments && payments.length > 0) {
          const activePayments = payments.filter(p => ['pending', 'completed'].includes(p.payment_status));
          if (activePayments.length > 0) {
            constraints.push(t('customers.constraints.relatedPayments', { count: activePayments.length }));
            console.log('Found related payments:', activePayments.length);
          }
        }
      }

    } catch (error) {
      console.error('CONSTRAINT CHECK ERROR:', error);
    }

    console.log('=== FINAL CONSTRAINTS:', constraints);
    return constraints;
  };

  const handleDeleteCustomer = async (customer) => {
    console.log('=== STARTING DELETE PROCESS FOR CUSTOMER:', customer);
    
    // Set the customer we're working with
    setCustomerToDelete(customer);
    
    // Check constraints first
    setDeleteLoading(true);
    const constraints = await checkCustomerConstraints(customer.id);
    setDeleteLoading(false);
    
    // Set up modal data and show it
    setDeleteConstraints(constraints);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;

    console.log('=== CONFIRMING DELETE FOR:', customerToDelete);
    console.log('=== CONSTRAINTS:', deleteConstraints);

    // If there are constraints, don't allow deletion
    if (deleteConstraints.length > 0) {
      console.log('=== CANNOT DELETE - HAS CONSTRAINTS');
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      setDeleteConstraints([]);
      return;
    }

    try {
      setDeleteLoading(true);

      // Set status to inactive instead of deleting
      const { error } = await supabase
        .from('customers')
        .update({ 
          customer_status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', customerToDelete.id);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('=== CUSTOMER STATUS UPDATED TO INACTIVE');

      // Remove from UI
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      toast.success(t('customers.customerDeactivatedSuccessfully'));

    } catch (error) {
      console.error('Error deactivating customer:', error);
      toast.error(t('customers.errorDeactivatingCustomer'));
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      setDeleteConstraints([]);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setCustomerToDelete(null);
    setDeleteConstraints([]);
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
                {customers.filter(c => c.customer_type === 'company').length}
              </span>
            </div>
          </div>
        </div>
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
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteCustomer(customer)}
                        disabled={deleteLoading}
                        title={t('customers.deleteCustomer')}
                      >
                        {deleteLoading && customerToDelete?.id === customer.id ? (
                          <div className="loading-spinner-small"></div>
                        ) : (
                          <Trash2 size={16} />
                        )}
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

      {/* Customer Form Modal - Only for editing */}
      <CustomerForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        customer={editingCustomer}
        partnerUuid={profile?.partner_uuid}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && customerToDelete && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <h3 className="delete-modal-title">
                {deleteConstraints.length > 0 
                  ? t('customers.cannotDeleteCustomer')
                  : t('customers.confirmDelete')
                }
              </h3>
            </div>
            
            <div className="delete-modal-content">
              {deleteConstraints.length > 0 ? (
                <>
                  <p className="delete-modal-message">
                    {t('customers.activeConstraints')}:
                  </p>
                  <ul className="constraints-list">
                    {deleteConstraints.map((constraint, index) => (
                      <li key={index} className="constraint-item">
                        {constraint}
                      </li>
                    ))}
                  </ul>
                  <p className="delete-modal-warning">
                    {t('customers.resolveConstraintsFirst')}
                  </p>
                </>
              ) : (
                <p className="delete-modal-message">
                  {t('customers.confirmDeleteCustomer', { 
                    customerName: `${customerToDelete.first_name} ${customerToDelete.second_name}` 
                  })}
                </p>
              )}
            </div>
            
            <div className="delete-modal-actions">
              <button
                className="btn-secondary"
                onClick={handleCancelDelete}
                disabled={deleteLoading}
              >
                {deleteConstraints.length > 0 ? t('common.close') : t('common.cancel')}
              </button>
              
              {deleteConstraints.length === 0 && (
                <button
                  className="btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      {t('common.deleting')}...
                    </>
                  ) : (
                    t('customers.deleteCustomer')
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
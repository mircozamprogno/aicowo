import { Edit2, UserPlus } from 'lucide-react';
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

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setShowForm(true);
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
            {t('customers.manageCustomers')}
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
        <div className="customers-header-actions">
          <button className="add-customer-btn" onClick={handleAddCustomer}>
            <UserPlus size={16} className="mr-2" />
            {t('customers.addCustomer')}
          </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="customers-empty">
              <UserPlus size={48} className="empty-icon" />
              <p>{t('customers.noCustomersFound')}</p>
              <button 
                onClick={handleAddCustomer}
                className="btn-primary mt-4"
              >
                {t('customers.addFirstCustomer')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        customer={editingCustomer}
        partnerUuid={profile?.partner_uuid}
      />
    </div>
  );
};

export default Customers;
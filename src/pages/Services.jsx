import { Edit2, Plus, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import ServiceForm from '../components/forms/ServiceForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Services = () => {
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (profile?.partner_uuid) {
      fetchServicesAndLocations();
    }
  }, [profile]);

  const fetchServicesAndLocations = async () => {
    setLoading(true);
    try {
      // Fetch locations first
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      if (locationsError && locationsError.code !== 'PGRST116') {
        console.error('Error fetching locations:', locationsError);
        // Use mock locations for development
        setLocations([
          { id: 1, location_name: 'Main Office', partner_uuid: profile.partner_uuid },
          { id: 2, location_name: 'Co-working Space', partner_uuid: profile.partner_uuid }
        ]);
      } else {
        setLocations(locationsData || []);
      }

      // Fetch services with location information
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          locations (
            id,
            location_name
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .order('created_at', { ascending: false });

      if (servicesError && servicesError.code !== 'PGRST116') {
        console.error('Error fetching services:', servicesError);
        // Use mock services for development
        setServices([
          {
            id: 1,
            service_uuid: 'mock-service-1',
            service_name: 'Monthly Membership',
            service_description: 'Full access to coworking space for 30 days',
            service_type: 'abbonamento',
            cost: 150.00,
            currency: 'EUR',
            duration_days: 30,
            max_entries: null,
            quantity: 20,
            quantity_alert_threshold: 5,
            service_status: 'active',
            location_id: 1,
            locations: { id: 1, location_name: 'Main Office' },
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            service_uuid: 'mock-service-2',
            service_name: '10 Day Passes',
            service_description: 'Package of 10 day passes for flexible access',
            service_type: 'pacchetto',
            cost: 120.00,
            currency: 'EUR',
            duration_days: 90,
            max_entries: 10,
            quantity: 5,
            quantity_alert_threshold: 1,
            service_status: 'active',
            location_id: 2,
            locations: { id: 2, location_name: 'Co-working Space' },
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 3,
            service_uuid: 'mock-service-3',
            service_name: 'Free Trial Week',
            service_description: 'One week free trial for new customers',
            service_type: 'free_trial',
            cost: 0.00,
            currency: 'EUR',
            duration_days: 7,
            max_entries: null,
            quantity: 3,
            quantity_alert_threshold: 0,
            service_status: 'active',
            location_id: 1,
            locations: { id: 1, location_name: 'Main Office' },
            created_at: new Date(Date.now() - 172800000).toISOString()
          }
        ]);
      } else {
        setServices(servicesData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('messages.errorLoadingServices'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = () => {
    setEditingService(null);
    setShowForm(true);
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingService(null);
  };

  const handleFormSuccess = (savedService) => {
    if (editingService) {
      // Update existing service in the list
      setServices(prev => 
        prev.map(s => s.id === savedService.id ? savedService : s)
      );
    } else {
      // Add new service to the list
      setServices(prev => [savedService, ...prev]);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getServiceTypeLabel = (type) => {
    const types = {
      abbonamento: t('services.subscription'),
      pacchetto: t('services.package'),
      free_trial: t('services.freeTrial')
    };
    return types[type] || type;
  };

  const getServiceTypeBadgeClass = (type) => {
    const classes = {
      abbonamento: 'service-type-subscription',
      pacchetto: 'service-type-package',
      free_trial: 'service-type-trial'
    };
    return classes[type] || 'service-type-default';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'draft':
        return 'status-draft';
      default:
        return 'status-inactive';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Check if user can manage services (admin partners only)
  const canManageServices = profile?.role === 'admin';

  if (!canManageServices) {
    return (
      <div className="services-page">
        <div className="services-unauthorized">
          <h1>{t('services.accessDenied')}</h1>
          <p>{t('services.accessDeniedMessage')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="services-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="services-page">
      <div className="services-header">
        <div className="services-header-content">
          <h1 className="services-title">
            <Settings size={24} className="mr-2" />
            {t('services.title')}
          </h1>
          <p className="services-description">
            {t('services.manageServices')}
          </p>
          <div className="services-stats">
            <div className="stat-item">
              <span className="stat-label">{t('services.totalServices')}</span>
              <span className="stat-value">{services.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('services.activeServices')}</span>
              <span className="stat-value">
                {services.filter(s => s.service_status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('services.subscriptions')}</span>
              <span className="stat-value">
                {services.filter(s => s.service_type === 'abbonamento').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('services.packages')}</span>
              <span className="stat-value">
                {services.filter(s => s.service_type === 'pacchetto').length}
              </span>
            </div>
          </div>
        </div>
        <div className="services-header-actions">
          <button className="add-service-btn" onClick={handleAddService}>
            <Plus size={16} className="mr-2" />
            {t('services.addService')}
          </button>
        </div>
      </div>

      <div className="services-table-container">
        <div className="services-table-wrapper">
          <table className="services-table">
            <thead className="services-table-head">
              <tr>
                <th className="services-table-header">
                  {t('services.service')}
                </th>
                <th className="services-table-header">
                  {t('services.type')}
                </th>
                <th className="services-table-header">
                  {t('services.location')}
                </th>
                <th className="services-table-header">
                  {t('services.quantity')}
                </th>
                <th className="services-table-header">
                  {t('services.cost')}
                </th>
                <th className="services-table-header">
                  {t('services.duration')}
                </th>
                <th className="services-table-header">
                  {t('services.status')}
                </th>
                <th className="services-table-header">
                  {t('services.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="services-table-body">
              {services.map((service) => (
                <tr key={service.id} className="services-table-row">
                  <td className="services-table-cell">
                    <div className="service-info">
                      <div className="service-name">{service.service_name}</div>
                      <div className="service-description">
                        {service.service_description}
                      </div>
                      {service.service_type === 'pacchetto' && service.max_entries && (
                        <div className="service-entries">
                          {t('services.maxEntries')}: {service.max_entries}
                        </div>
                      )}
                      <div className="service-created">
                        {t('common.createdAt')}: {formatDate(service.created_at)}
                      </div>
                    </div>
                  </td>
                  <td className="services-table-cell">
                    <span className={`service-type-badge ${getServiceTypeBadgeClass(service.service_type)}`}>
                      {getServiceTypeLabel(service.service_type)}
                    </span>
                  </td>
                  <td className="services-table-cell">
                    <div className="service-location">
                      {service.locations?.location_name || t('services.noLocation')}
                    </div>
                  </td>
                  <td className="services-table-cell">
                    <div className="service-quantity">
                      <span className="quantity-number">{service.quantity}</span>
                      <span className="quantity-label">{t('services.available')}</span>
                      {service.quantity_alert_threshold > 0 && service.quantity <= service.quantity_alert_threshold && (
                        <span className="quantity-alert">⚠️ {t('services.lowStock')}</span>
                      )}
                    </div>
                  </td>
                  <td className="services-table-cell">
                    <div className="service-cost">
                      {service.cost > 0 ? formatCurrency(service.cost, service.currency) : t('services.free')}
                    </div>
                  </td>
                  <td className="services-table-cell">
                    <div className="service-duration">
                      {service.duration_days} {t('services.days')}
                    </div>
                  </td>
                  <td className="services-table-cell">
                    <span className={`status-badge ${getStatusBadgeClass(service.service_status)}`}>
                      {t(`services.${service.service_status}`)}
                    </span>
                  </td>
                  <td className="services-table-cell">
                    <div className="service-actions">
                      <button 
                        className="edit-btn"
                        onClick={() => handleEditService(service)}
                        title={t('services.editService')}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {services.length === 0 && (
            <div className="services-empty">
              <Settings size={48} className="empty-icon" />
              <p>{t('services.noServicesFound')}</p>
              <button 
                onClick={handleAddService}
                className="btn-primary mt-4"
              >
                {t('services.addFirstService')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Service Form Modal */}
      <ServiceForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        service={editingService}
        partnerUuid={profile?.partner_uuid}
        locations={locations}
      />
    </div>
  );
};

export default Services;
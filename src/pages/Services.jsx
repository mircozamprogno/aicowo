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

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        // Only show error for actual errors, not empty results
        if (locationsError.code !== 'PGRST116') {
          toast.error(t('messages.errorLoadingLocations'));
        }
        setLocations([]);
      } else {
        setLocations(locationsData || []);
      }

      // Fetch services with location and resource information using the new structure
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          location_resources!fk_services_location_resource (
            id,
            resource_name,
            resource_type,
            quantity,
            description,
            locations (
              id,
              location_name
            )
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .order('created_at', { ascending: false });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        // Only show error for actual errors, not empty results
        if (servicesError.code !== 'PGRST116') {
          toast.error(t('messages.errorLoadingServices'));
        }
        setServices([]);
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

  const getResourceTypeLabel = (type) => {
    return type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
  };

  // Removed getResourceTypeIcon function since we don't need icons anymore

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
                  {t('services.resource')}
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
                    <div className="service-resource">
                      {service.location_resources ? (
                        <div className="resource-info">
                          <div className="resource-header">
                            {/* Removed the resource icon span */}
                            <span className="resource-name">
                              {service.location_resources.resource_name}
                            </span>
                          </div>
                          <div className="resource-location">
                            📍 {service.location_resources.locations?.location_name}
                          </div>
                          <div className="resource-quantity">
                            {service.location_resources.quantity} {t('services.available')}
                          </div>
                        </div>
                      ) : (
                        <span className="no-resource">{t('services.noResource')}</span>
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
// src/pages/Services.jsx
import { Edit2, HelpCircle, Plus, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Pagination from '../components/common/Pagination';
import { toast } from '../components/common/ToastContainer';
import ServiceForm from '../components/forms/ServiceForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

import logger from '../utils/logger';

const Services = () => {
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [showServiceInfo, setShowServiceInfo] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (profile?.partner_uuid) {
      fetchServicesAndLocations();
    }
  }, [profile]);

  // Reset page when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const fetchServicesAndLocations = async () => {
    setLoading(true);
    try {
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      if (locationsError) {
        logger.error('Error fetching locations:', locationsError);
        if (locationsError.code !== 'PGRST116') {
          toast.error(t('messages.errorLoadingLocations'));
        }
        setLocations([]);
      } else {
        setLocations(locationsData || []);
      }

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
        logger.error('Error fetching services:', servicesError);
        if (servicesError.code !== 'PGRST116') {
          toast.error(t('messages.errorLoadingServices'));
        }
        setServices([]);
      } else {
        setServices(servicesData || []);
      }
    } catch (error) {
      logger.error('Error fetching data:', error);
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
    if (savedService === null) {
      fetchServicesAndLocations();
      return;
    }

    if (editingService) {
      setServices(prev =>
        prev.map(s => s.id === savedService.id ? savedService : s)
      );
    } else {
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
      free_trial: t('services.freeTrial'),
      giornaliero: t('services.dayPass')
    };
    return types[type] || type;
  };

  const getServiceTypeBadgeClass = (type) => {
    const classes = {
      abbonamento: 'service-type-subscription',
      pacchetto: 'service-type-package',
      free_trial: 'service-type-trial',
      giornaliero: 'service-type-daypass'
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Pagination logic
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentServices = services.slice(startIndex, endIndex);



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

        </div>
        <div className="services-header-actions">
          <button
            className="service-info-btn"
            onClick={() => setShowServiceInfo(true)}
            title={t('services.serviceInfo')}
          >
            <HelpCircle size={16} className="mr-2" />
            {t('services.serviceInfo')}
          </button>
          <button className="btn-service-primary" onClick={handleAddService}>
            <Plus size={16} className="mr-2" />
            {t('services.addService')}
          </button>
        </div>
      </div>

      <Pagination
        totalItems={services.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

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
              {currentServices.map((service) => (
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

      <ServiceForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        service={editingService}
        partnerUuid={profile?.partner_uuid}
        locations={locations}
      />

      {showServiceInfo && (
        <div className="modal-overlay">
          <div className="modal-container service-info-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('services.serviceTypesInformation')}
              </h2>
              <button
                onClick={() => setShowServiceInfo(false)}
                className="modal-close-btn"
              >
                <X size={24} />
              </button>
            </div>

            <div className="service-info-content">
              <p className="service-info-description">
                {t('services.serviceInfoModalDescription')}
              </p>

              <div className="service-type-info">
                <div className="service-type-item">
                  <div className="service-type-header">
                    <span className="service-type-badge service-type-subscription">
                      {t('services.subscription')}
                    </span>
                    <h3>{t('services.subscriptionInfo')}</h3>
                  </div>
                  <p className="service-type-description">
                    {t('services.subscriptionDescription')}
                  </p>
                  <p className="service-type-example">
                    {t('services.subscriptionExample')}
                  </p>
                </div>

                <div className="service-type-item">
                  <div className="service-type-header">
                    <span className="service-type-badge service-type-package">
                      {t('services.package')}
                    </span>
                    <h3>{t('services.packageInfo')}</h3>
                  </div>
                  <p className="service-type-description">
                    {t('services.packageDescription')}
                  </p>
                  <p className="service-type-example">
                    {t('services.packageExample')}
                  </p>
                </div>

                <div className="service-type-item">
                  <div className="service-type-header">
                    <span className="service-type-badge service-type-daypass">
                      {t('services.dayPass')}
                    </span>
                    <h3>{t('services.dayPassInfo')}</h3>
                  </div>
                  <p className="service-type-description">
                    {t('services.dayPassDescription')}
                  </p>
                  <p className="service-type-example">
                    {t('services.dayPassExample')}
                  </p>
                </div>
              </div>

              <div className="service-info-actions">
                <button
                  type="button"
                  onClick={() => setShowServiceInfo(false)}
                  className="btn-primary"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
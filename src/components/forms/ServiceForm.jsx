// src/components/forms/ServiceForm.jsx
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTourIntegration } from '../../hooks/useTourIntegration';
import { supabase } from '../../services/supabase';
import SearchableSelect from '../common/SearchableSelect';
import { toast } from '../common/ToastContainer';

import { logActivity } from '../../utils/activityLogger';
import logger from '../../utils/logger';

const ServiceForm = ({ isOpen, onClose, onSuccess, service = null, partnerUuid, locations = [] }) => {
  const { t } = useTranslation();
  const isEditing = !!service;

  const [formData, setFormData] = useState({
    service_name: '',
    service_description: '',
    service_type: 'abbonamento',
    location_id: '',
    location_resource_id: '',
    cost: '',
    currency: 'EUR',
    duration_days: '30',
    max_entries: '',
    service_status: 'active',
    is_renewable: true,
    auto_renew: false,
    private: false
  });

  const [locationResources, setLocationResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [loading, setLoading] = useState(false);
  const { onServiceCreated } = useTourIntegration();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showContractsExist, setShowContractsExist] = useState(false);
  const [contractCount, setContractCount] = useState(0);
  const [contractsList, setContractsList] = useState([]);

  const formatDuration = (days) => {
    const numDays = parseFloat(days);
    if (numDays === 0.5) return t('services.halfDay');
    if (numDays === 1) return t('services.oneDay');
    return t('services.daysCount', { count: numDays });
  };

  useEffect(() => {
    if (service) {
      logger.log('Loading service data for editing:', service);
      setFormData({
        service_name: service.service_name || '',
        service_description: service.service_description || '',
        service_type: service.service_type || 'abbonamento',
        location_id: service.location_id?.toString() || '',
        location_resource_id: service.location_resource_id?.toString() || '',
        cost: service.cost?.toString() || '',
        currency: service.currency || 'EUR',
        duration_days: service.duration_days?.toString() || '30',
        max_entries: service.max_entries?.toString() || '',
        service_status: service.service_status || 'active',
        is_renewable: service.is_renewable !== false,
        auto_renew: service.auto_renew || false,
        private: service.private || false
      });

      if (service.location_id) {
        fetchLocationResources(service.location_id.toString());
      }
    } else {
      logger.log('Resetting form for new service');
      setFormData({
        service_name: '',
        service_description: '',
        service_type: 'abbonamento',
        location_id: locations.length > 0 ? locations[0].id.toString() : '',
        location_resource_id: '',
        cost: '',
        currency: 'EUR',
        duration_days: '30',
        max_entries: '',
        service_status: 'active',
        is_renewable: true,
        auto_renew: false,
        private: false
      });

      if (locations.length > 0) {
        fetchLocationResources(locations[0].id.toString());
      }
    }
  }, [service, locations]);

  const fetchLocationResources = async (locationId) => {
    if (!locationId) {
      setLocationResources([]);
      return;
    }

    setLoadingResources(true);
    try {
      const { data, error } = await supabase
        .from('location_resources')
        .select('*')
        .eq('location_id', parseInt(locationId))
        .eq('partner_uuid', partnerUuid)
        .order('resource_type', { ascending: true });

      if (error) {
        logger.error('Error fetching location resources:', error);
        if (error.code !== 'PGRST116') {
          toast.error('Error loading resources for this location');
        }
        setLocationResources([]);
      } else {
        setLocationResources(data || []);
      }
    } catch (error) {
      logger.error('Error fetching location resources:', error);
      setLocationResources([]);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleLocationChange = (e) => {
    const locationId = e.target.value;
    setFormData(prev => ({
      ...prev,
      location_id: locationId,
      location_resource_id: ''
    }));

    fetchLocationResources(locationId);
  };

  const handleServiceTypeChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({
      ...prev,
      service_type: newType,
      max_entries: newType === 'pacchetto' ? prev.max_entries : '',
      cost: newType === 'free_trial' ? '0' : prev.cost,
      duration_days: newType === 'abbonamento' ? '30' :
        newType === 'pacchetto' ? '90' :
          newType === 'free_trial' ? '7' :
            newType === 'giornaliero' ? '1' : prev.duration_days,
      is_renewable: newType === 'giornaliero' ? false : prev.is_renewable,
      auto_renew: newType === 'giornaliero' ? false : prev.auto_renew
    }));
  };

  const handleServiceStatusChange = (e) => {
    setFormData(prev => ({ ...prev, service_status: e.target.value }));
  };

  const handleCurrencyChange = (e) => {
    setFormData(prev => ({ ...prev, currency: e.target.value }));
  };

  const handleLocationResourceChange = (e) => {
    setFormData(prev => ({ ...prev, location_resource_id: e.target.value }));
  };

  const validateForm = () => {
    if (!formData.service_name.trim()) {
      toast.error(t('messages.serviceNameRequired'));
      return false;
    }
    if (!formData.location_resource_id) {
      toast.error(t('messages.resourceRequired'));
      return false;
    }
    if (formData.cost === '' || parseFloat(formData.cost) < 0) {
      toast.error(t('messages.validCostRequired'));
      return false;
    }
    const durationValue = parseFloat(formData.duration_days);
    if (!formData.duration_days || durationValue <= 0) {
      toast.error(t('messages.validDurationRequired'));
      return false;
    }
    if (formData.service_type === 'pacchetto' && (!formData.max_entries || parseInt(formData.max_entries) <= 0)) {
      toast.error(t('messages.validMaxEntriesRequired'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const serviceData = {
        service_name: formData.service_name.trim(),
        service_description: formData.service_description.trim(),
        service_type: formData.service_type,
        location_id: parseInt(formData.location_id),
        location_resource_id: parseInt(formData.location_resource_id),
        cost: parseFloat(formData.cost),
        currency: formData.currency,
        duration_days: parseFloat(formData.duration_days),
        max_entries: formData.service_type === 'pacchetto' ? parseInt(formData.max_entries) || null : null,
        service_status: formData.service_status,
        is_renewable: formData.is_renewable,
        auto_renew: formData.auto_renew,
        private: formData.private,
        partner_uuid: partnerUuid
      };

      let result;

      if (isEditing) {
        result = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', service.id)
          .select(`
            *,
            location_resources!fk_services_location_resource (
              id,
              resource_name,
              resource_type,
              quantity,
              location_id,
              locations (
                id,
                location_name
              )
            )
          `);

        const { data, error } = result;

        if (error) {
          logger.error('Service save error:', error);
          throw error;
        }

        await logActivity({
          action_category: 'service',
          action_type: 'updated',
          entity_id: data[0].id.toString(),
          entity_type: 'services',
          description: `Updated service: ${data[0].service_name}`,
          metadata: {
            service_name: data[0].service_name,
            service_type: data[0].service_type,
            location_id: data[0].location_id,
            resource_id: data[0].location_resource_id,
            cost: data[0].cost,
            currency: data[0].currency,
            duration_days: data[0].duration_days,
            status: data[0].service_status,
            is_private: data[0].private
          }
        });

        toast.success(t('messages.serviceUpdatedSuccessfully'));
        onSuccess(data[0]);
      } else {
        result = await supabase
          .from('services')
          .insert([serviceData])
          .select(`
            *,
            location_resources!fk_services_location_resource (
              id,
              resource_name,
              resource_type,
              quantity,
              location_id,
              locations (
                id,
                location_name
              )
            )
          `);

        const { data, error } = result;

        if (error) {
          logger.error('Service save error:', error);
          throw error;
        }

        if (data && data[0]) {
          await onServiceCreated(data[0]);

          await logActivity({
            action_category: 'service',
            action_type: 'created',
            entity_id: data[0].id.toString(),
            entity_type: 'services',
            description: `Created service: ${data[0].service_name}`,
            metadata: {
              service_name: data[0].service_name,
              service_type: data[0].service_type,
              location_id: data[0].location_id,
              resource_id: data[0].location_resource_id,
              cost: data[0].cost,
              currency: data[0].currency,
              duration_days: data[0].duration_days,
              status: data[0].service_status,
              is_private: data[0].private
            }
          });
        }

        toast.success(t('messages.serviceCreatedSuccessfully'));
        onSuccess(data[0]);
      }

      onClose();
    } catch (error) {
      logger.error('Error saving service:', error);
      toast.error(error.message || t('messages.errorSavingService'));
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id);

      if (error) {
        logger.error('Service delete error:', error);
        throw error;
      }

      await logActivity({
        action_category: 'service',
        action_type: 'deleted',
        entity_id: service.id.toString(),
        entity_type: 'services',
        description: `Deleted service: ${service.service_name}`,
        metadata: {
          service_name: service.service_name,
          service_type: service.service_type,
          location_id: service.location_id,
          cost: service.cost,
          currency: service.currency
        }
      });

      toast.success(t('messages.serviceDeletedSuccessfully'));
      setShowDeleteConfirm(false);
      onClose();

      onSuccess(null);
    } catch (error) {
      logger.error('Error deleting service:', error);
      toast.error(error.message || t('messages.errorDeletingService'));
    } finally {
      setLoading(false);
    }
  };

  const checkForContracts = async () => {
    setLoading(true);

    try {
      const { data, error, count } = await supabase
        .from('contracts')
        .select('id, contract_number, customer_id, customers(first_name, second_name)', { count: 'exact' })
        .eq('service_id', service.id)
        .eq('contract_status', 'active')
        .eq('is_archived', false)
        .order('contract_number', { ascending: true });

      if (error) {
        logger.error('Error checking contracts:', error);
        throw error;
      }

      if (count > 0) {
        setContractCount(count);
        setContractsList(data || []);
        setShowContractsExist(true);
      } else {
        setShowDeleteConfirm(true);
      }
    } catch (error) {
      logger.error('Error checking for contracts:', error);
      toast.error(t('messages.errorCheckingContracts'));
    } finally {
      setLoading(false);
    }
  };



  const getResourceTypeLabel = (type) => {
    return type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
  };



  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container service-form-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('services.editService') : t('services.addService')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-form">
          <div className="form-section">


            <div className="form-group">
              <label htmlFor="service_name" className="form-label">
                {t('services.serviceName')} *
              </label>
              <input
                id="service_name"
                name="service_name"
                type="text"
                required
                className="form-input"
                placeholder={t('placeholders.serviceNamePlaceholder')}
                value={formData.service_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="service_description" className="form-label">
                {t('services.description')}
              </label>
              <textarea
                id="service_description"
                name="service_description"
                rows={3}
                className="form-textarea"
                placeholder={t('placeholders.serviceDescriptionPlaceholder')}
                value={formData.service_description}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="service_type" className="form-label">
                  {t('services.type')} *
                </label>
                <SearchableSelect
                  value={formData.service_type}
                  onChange={handleServiceTypeChange}
                  options={[
                    { value: 'abbonamento', label: t('services.subscription') },
                    { value: 'pacchetto', label: t('services.package') },
                    { value: 'giornaliero', label: t('services.dayPass') },
                    { value: 'free_trial', label: t('services.freeTrial') }
                  ]}
                  placeholder={t('services.selectType')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="service_status" className="form-label">
                  {t('services.status')} *
                </label>
                <SearchableSelect
                  value={formData.service_status}
                  onChange={handleServiceStatusChange}
                  options={[
                    { value: 'active', label: t('services.active') },
                    { value: 'inactive', label: t('services.inactive') },
                    { value: 'draft', label: t('services.draft') }
                  ]}
                  placeholder={t('services.selectStatus')}
                />
              </div>
            </div>
          </div>

          <div className="form-section">


            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location_id" className="form-label">
                  {t('services.location')} *
                </label>
                <SearchableSelect
                  value={formData.location_id}
                  onChange={handleLocationChange}
                  options={
                    locations.length === 0
                      ? [{ value: '', label: t('services.noLocationsAvailable') }]
                      : locations.map(location => ({
                        value: location.id.toString(),
                        label: location.location_name
                      }))
                  }
                  placeholder={t('services.selectLocation')}
                  emptyMessage={t('services.noLocationsAvailable')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="location_resource_id" className="form-label">
                  {t('services.resource')} *
                </label>
                <SearchableSelect
                  value={formData.location_resource_id}
                  onChange={handleLocationResourceChange}
                  options={
                    !formData.location_id
                      ? [{ value: '', label: t('services.selectLocationFirst') }]
                      : loadingResources
                        ? [{ value: '', label: t('common.loading') + '...' }]
                        : locationResources.length === 0
                          ? [{ value: '', label: t('services.noResourcesAvailable') }]
                          : locationResources.map(resource => ({
                            value: resource.id.toString(),
                            label: `${resource.resource_name} (${resource.quantity} ${t('services.available')})`
                          }))
                  }
                  placeholder={t('services.selectResource')}
                  emptyMessage={t('services.noResourcesAvailable')}
                  className={!formData.location_id || loadingResources ? 'disabled' : ''}
                />
              </div>
            </div>

            {formData.location_resource_id && (
              <div className="resource-info-display">
                {locationResources
                  .filter(r => r.id.toString() === formData.location_resource_id)
                  .map(resource => (
                    <div key={resource.id} className="selected-resource-info">
                      <div className="resource-details">
                        <strong>{getResourceTypeLabel(resource.resource_type)}</strong>: {resource.resource_name}
                      </div>
                      <div className="resource-quantity">
                        {t('services.availableQuantity')}: <strong>{resource.quantity}</strong>
                      </div>
                      {resource.description && (
                        <div className="resource-description">
                          {resource.description}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <div className="form-section">


            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cost" className="form-label">
                  {t('services.cost')} *
                </label>
                <input
                  id="cost"
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="form-input"
                  placeholder="0.00"
                  value={formData.cost}
                  onChange={handleChange}
                  disabled={formData.service_type === 'free_trial'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="currency" className="form-label">
                  {t('services.currency')}
                </label>
                <SearchableSelect
                  value={formData.currency}
                  onChange={handleCurrencyChange}
                  options={[
                    { value: 'EUR', label: 'EUR (€)' },
                    { value: 'USD', label: 'USD ($)' },
                    { value: 'GBP', label: 'GBP (£)' }
                  ]}
                  placeholder={t('services.selectCurrency')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="duration_days" className="form-label">
                  {t('services.durationDays')} *
                </label>
                <input
                  id="duration_days"
                  name="duration_days"
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  className="form-input"
                  placeholder="30"
                  value={formData.duration_days}
                  onChange={handleChange}
                  disabled={formData.service_type === 'giornaliero'}
                />
                {formData.duration_days && (
                  <p className="form-help-text" style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {formatDuration(formData.duration_days)}
                  </p>
                )}
              </div>
              {formData.service_type === 'pacchetto' && (
                <div className="form-group">
                  <label htmlFor="max_entries" className="form-label">
                    {t('services.maxEntries')} *
                  </label>
                  <input
                    id="max_entries"
                    name="max_entries"
                    type="number"
                    min="1"
                    required={formData.service_type === 'pacchetto'}
                    className="form-input"
                    placeholder="10"
                    value={formData.max_entries}
                    onChange={handleChange}
                  />
                </div>
              )}
            </div>

            {formData.service_type === 'free_trial' && (
              <div className="form-note">
                <p className="note-text">
                  <strong>{t('services.freeTrialNote')}:</strong> {t('services.freeTrialDescription')}
                </p>
              </div>
            )}
          </div>

          <div className="form-section">


            <div className="form-checkboxes">
              <div className="toggle-row">
                <div className="toggle-label-group">
                  <label htmlFor="is_renewable" className="toggle-label">
                    {t('services.isRenewable')}
                  </label>
                  <p className="toggle-help">
                    {t('services.renewableHelp')}
                  </p>
                </div>
                <label className="switch">
                  <input
                    id="is_renewable"
                    name="is_renewable"
                    type="checkbox"
                    checked={formData.is_renewable}
                    onChange={handleChange}
                    disabled={formData.service_type === 'giornaliero'}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>

              {formData.is_renewable && (
                <div className="toggle-row">
                  <div className="toggle-label-group">
                    <label htmlFor="auto_renew" className="toggle-label">
                      {t('services.autoRenew')}
                    </label>
                    <p className="toggle-help">
                      {t('services.autoRenewHelp')}
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      id="auto_renew"
                      name="auto_renew"
                      type="checkbox"
                      checked={formData.auto_renew}
                      onChange={handleChange}
                      disabled={formData.service_type === 'giornaliero'}
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>
              )}

              <div className="toggle-row">
                <div className="toggle-label-group">
                  <label htmlFor="private" className="toggle-label">
                    {t('services.privateService')}
                  </label>
                  <p className="toggle-help">
                    {t('services.privateServiceHelp')}
                  </p>
                </div>
                <label className="switch">
                  <input
                    id="private"
                    name="private"
                    type="checkbox"
                    checked={formData.private}
                    onChange={handleChange}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={checkForContracts}
                  className="btn-danger"
                  style={{ animation: 'none', textTransform: 'none' }}
                  disabled={loading}
                >
                  {t('common.delete')}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-service-primary"
                disabled={loading || locations.length === 0 || !formData.location_resource_id}
              >
                {loading
                  ? (isEditing ? t('common.saving') + '...' : t('common.creating') + '...')
                  : (isEditing ? t('common.save') : t('common.create'))
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {showContractsExist && (
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-container" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{t('services.cannotDeleteTitle')}</h2>
              <button onClick={() => setShowContractsExist(false)} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>
            <div className="modal-form">
              <p style={{ marginBottom: '1rem' }}>
                {t('services.cannotDeleteMessage', { count: contractCount })}
              </p>
              <p style={{ color: '#dc2626', fontWeight: '500', marginBottom: '1rem' }}>
                {t('services.cannotDeleteHint')}
              </p>

              <div style={{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  marginBottom: '0.75rem',
                  color: '#374151'
                }}>
                  {t('services.affectedContracts')}:
                </h4>
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  {contractsList.map((contract) => (
                    <div key={contract.id} style={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          color: '#111827'
                        }}>
                          {contract.contract_number}
                        </span>
                        {contract.customers && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.875rem',
                            color: '#6b7280'
                          }}>
                            ({contract.customers.first_name} {contract.customers.second_name})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowContractsExist(false)}
                  className="btn-service-primary"
                >
                  {t('common.understood')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-container" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{t('services.confirmDelete')}</h2>
              <button onClick={() => setShowDeleteConfirm(false)} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>
            <div className="modal-form">
              <p>{t('services.confirmDeleteMessage')}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary"
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn-danger"
                  style={{ animation: 'none', textTransform: 'none' }}
                  disabled={loading}
                >
                  {loading ? t('common.deleting') + '...' : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceForm;
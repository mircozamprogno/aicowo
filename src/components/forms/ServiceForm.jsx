import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const ServiceForm = ({ isOpen, onClose, onSuccess, service = null, partnerUuid, locations = [] }) => {
  const { t } = useTranslation();
  const isEditing = !!service;
  
  const [formData, setFormData] = useState({
    service_name: '',
    service_description: '',
    service_type: 'abbonamento',
    location_id: '',
    cost: '',
    currency: 'EUR',
    duration_days: '30',
    max_entries: '',
    quantity: '1',
    quantity_alert_threshold: '0',
    service_status: 'active',
    is_renewable: true,
    auto_renew: false,
    grace_period_days: '0'
  });
  
  const [loading, setLoading] = useState(false);

  // Update form data when service changes
  useEffect(() => {
    if (service) {
      console.log('Loading service data for editing:', service);
      setFormData({
        service_name: service.service_name || '',
        service_description: service.service_description || '',
        service_type: service.service_type || 'abbonamento',
        location_id: service.location_id?.toString() || '',
        cost: service.cost?.toString() || '',
        currency: service.currency || 'EUR',
        duration_days: service.duration_days?.toString() || '30',
        max_entries: service.max_entries?.toString() || '',
        quantity: service.quantity?.toString() || '1',
        quantity_alert_threshold: service.quantity_alert_threshold?.toString() || '0',
        service_status: service.service_status || 'active',
        is_renewable: service.is_renewable !== false,
        auto_renew: service.auto_renew || false,
        grace_period_days: service.grace_period_days?.toString() || '0'
      });
    } else {
      // Reset form for new service
      console.log('Resetting form for new service');
      setFormData({
        service_name: '',
        service_description: '',
        service_type: 'abbonamento',
        location_id: locations.length > 0 ? locations[0].id.toString() : '',
        cost: '',
        currency: 'EUR',
        duration_days: '30',
        max_entries: '',
        quantity: '1',
        quantity_alert_threshold: '0',
        service_status: 'active',
        is_renewable: true,
        auto_renew: false,
        grace_period_days: '0'
      });
    }
  }, [service, locations]);

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

  const handleServiceTypeChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({
      ...prev,
      service_type: newType,
      // Reset max_entries if not pacchetto
      max_entries: newType === 'pacchetto' ? prev.max_entries : '',
      // Set cost to 0 if free_trial
      cost: newType === 'free_trial' ? '0' : prev.cost,
      // Set default duration based on type
      duration_days: newType === 'abbonamento' ? '30' : 
                    newType === 'pacchetto' ? '90' : 
                    newType === 'free_trial' ? '7' : prev.duration_days
    }));
  };

  const validateForm = () => {
    if (!formData.service_name.trim()) {
      toast.error(t('messages.serviceNameRequired'));
      return false;
    }
    if (!formData.location_id) {
      toast.error(t('messages.locationRequired'));
      return false;
    }
    if (formData.cost === '' || parseFloat(formData.cost) < 0) {
      toast.error(t('messages.validCostRequired'));
      return false;
    }
    if (!formData.duration_days || parseInt(formData.duration_days) <= 0) {
      toast.error(t('messages.validDurationRequired'));
      return false;
    }
    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      toast.error(t('messages.validQuantityRequired'));
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
      // Prepare service data
      const serviceData = {
        service_name: formData.service_name.trim(),
        service_description: formData.service_description.trim(),
        service_type: formData.service_type,
        location_id: parseInt(formData.location_id),
        cost: parseFloat(formData.cost),
        currency: formData.currency,
        duration_days: parseInt(formData.duration_days),
        max_entries: formData.service_type === 'pacchetto' ? parseInt(formData.max_entries) || null : null,
        quantity: parseInt(formData.quantity),
        quantity_alert_threshold: parseInt(formData.quantity_alert_threshold) || 0,
        service_status: formData.service_status,
        is_renewable: formData.is_renewable,
        auto_renew: formData.auto_renew,
        grace_period_days: parseInt(formData.grace_period_days) || 0,
        partner_uuid: partnerUuid
      };

      let result;
      
      if (isEditing) {
        // Update existing service
        result = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', service.id)
          .select(`
            *,
            locations (
              id,
              location_name
            )
          `);
      } else {
        // Create new service
        result = await supabase
          .from('services')
          .insert([serviceData])
          .select(`
            *,
            locations (
              id,
              location_name
            )
          `);
      }

      const { data, error } = result;

      if (error) {
        console.error('Service save error:', error);
        throw error;
      }

      toast.success(
        isEditing 
          ? t('messages.serviceUpdatedSuccessfully') 
          : t('messages.serviceCreatedSuccessfully')
      );
      
      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(error.message || t('messages.errorSavingService'));
    } finally {
      setLoading(false);
    }
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

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Basic Information Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('services.basicInformation')}</h3>
            
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
                <select
                  id="service_type"
                  name="service_type"
                  required
                  className="form-select"
                  value={formData.service_type}
                  onChange={handleServiceTypeChange}
                >
                  <option value="abbonamento">{t('services.subscription')}</option>
                  <option value="pacchetto">{t('services.package')}</option>
                  <option value="free_trial">{t('services.freeTrial')}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="location_id" className="form-label">
                  {t('services.location')} *
                </label>
                <select
                  id="location_id"
                  name="location_id"
                  required
                  className="form-select"
                  value={formData.location_id}
                  onChange={handleChange}
                >
                  {locations.length === 0 ? (
                    <option value="">{t('services.noLocationsAvailable')}</option>
                  ) : (
                    <>
                      <option value="">{t('services.selectLocation')}</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.location_name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="service_status" className="form-label">
                {t('services.status')} *
              </label>
              <select
                id="service_status"
                name="service_status"
                required
                className="form-select"
                value={formData.service_status}
                onChange={handleChange}
              >
                <option value="active">{t('services.active')}</option>
                <option value="inactive">{t('services.inactive')}</option>
                <option value="draft">{t('services.draft')}</option>
              </select>
            </div>
          </div>

          {/* Pricing and Duration Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('services.pricingAndDuration')}</h3>
            
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
                <select
                  id="currency"
                  name="currency"
                  className="form-select"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
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
                  min="1"
                  required
                  className="form-input"
                  placeholder="30"
                  value={formData.duration_days}
                  onChange={handleChange}
                />
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

          {/* Quantity and Availability Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('services.quantityAndAvailability')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="quantity" className="form-label">
                  {t('services.quantity')} *
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  placeholder="1"
                  value={formData.quantity}
                  onChange={handleChange}
                />
                <p className="form-help-text">
                  {t('services.quantityHelp')}
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="quantity_alert_threshold" className="form-label">
                  {t('services.alertThreshold')}
                </label>
                <input
                  id="quantity_alert_threshold"
                  name="quantity_alert_threshold"
                  type="number"
                  min="0"
                  className="form-input"
                  placeholder="0"
                  value={formData.quantity_alert_threshold}
                  onChange={handleChange}
                />
                <p className="form-help-text">
                  {t('services.alertThresholdHelp')}
                </p>
              </div>
            </div>

            <div className="quantity-examples">
              <div className="examples-title">{t('services.quantityExamples')}:</div>
              <div className="examples-list">
                <div className="example-item">
                  <strong>{t('services.exampleDesks')}:</strong> {t('services.exampleDesksDesc')}
                </div>
                <div className="example-item">
                  <strong>{t('services.exampleMeetingRooms')}:</strong> {t('services.exampleMeetingRoomsDesc')}
                </div>
                <div className="example-item">
                  <strong>{t('services.exampleParkingSpots')}:</strong> {t('services.exampleParkingSpotsDesc')}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings Section */}
          <div className="form-section">
            <h3 className="form-section-title">{t('services.advancedSettings')}</h3>
            
            <div className="form-group">
              <label htmlFor="grace_period_days" className="form-label">
                {t('services.gracePeriodDays')}
              </label>
              <input
                id="grace_period_days"
                name="grace_period_days"
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={formData.grace_period_days}
                onChange={handleChange}
              />
              <p className="form-help-text">
                {t('services.gracePeriodHelp')}
              </p>
            </div>

            <div className="form-checkboxes">
              <div className="form-checkbox-group">
                <div className="checkbox-wrapper">
                  <input
                    id="is_renewable"
                    name="is_renewable"
                    type="checkbox"
                    className="form-checkbox"
                    checked={formData.is_renewable}
                    onChange={handleChange}
                  />
                  <label htmlFor="is_renewable" className="form-checkbox-label">
                    {t('services.isRenewable')}
                  </label>
                </div>
                <p className="form-help-text">
                  {t('services.renewableHelp')}
                </p>
              </div>

              {formData.is_renewable && (
                <div className="form-checkbox-group">
                  <div className="checkbox-wrapper">
                    <input
                      id="auto_renew"
                      name="auto_renew"
                      type="checkbox"
                      className="form-checkbox"
                      checked={formData.auto_renew}
                      onChange={handleChange}
                    />
                    <label htmlFor="auto_renew" className="form-checkbox-label">
                      {t('services.autoRenew')}
                    </label>
                  </div>
                  <p className="form-help-text">
                    {t('services.autoRenewHelp')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || locations.length === 0}
            >
              {loading 
                ? (isEditing ? t('common.saving') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceForm;
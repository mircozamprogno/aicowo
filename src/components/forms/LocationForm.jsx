import { Calendar, MapPin, Monitor, Plus, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const LocationForm = ({ isOpen, onClose, onSuccess, location = null, partnerUuid }) => {
  const { t } = useTranslation();
  const isEditing = !!location;
  
  const [formData, setFormData] = useState({
    location_name: '',
  });

  const [resources, setResources] = useState([
    { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' },
    { resource_type: 'sala_riunioni', resource_name: '', quantity: '1', description: '' }
  ]);
  
  const [loading, setLoading] = useState(false);

  // Initialize form data when location changes
  useEffect(() => {
    if (location) {
      // Set form data
      setFormData({
        location_name: location.location_name || '',
      });

      // Set resources data
      if (location.resources && location.resources.length > 0) {
        const formattedResources = location.resources.map(resource => ({
          id: resource.id, // Keep the ID for updates
          resource_type: resource.resource_type,
          resource_name: resource.resource_name,
          quantity: resource.quantity.toString(),
          description: resource.description || ''
        }));
        setResources(formattedResources);
      } else {
        // Default resources for new locations or locations without resources
        setResources([
          { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' },
          { resource_type: 'sala_riunioni', resource_name: '', quantity: '1', description: '' }
        ]);
      }
    } else {
      // Reset form for new location
      setFormData({
        location_name: '',
      });
      setResources([
        { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' },
        { resource_type: 'sala_riunioni', resource_name: '', quantity: '1', description: '' }
      ]);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleResourceChange = (index, field, value) => {
    setResources(prev => prev.map((resource, i) => 
      i === index ? { ...resource, [field]: value } : resource
    ));
  };

  const addResource = () => {
    setResources(prev => [...prev, {
      resource_type: 'scrivania',
      resource_name: '',
      quantity: '1',
      description: ''
    }]);
  };

  const removeResource = (index) => {
    if (resources.length > 1) {
      setResources(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    if (!formData.location_name.trim()) {
      toast.error(t('messages.locationNameRequired'));
      return false;
    }

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      if (!resource.resource_name.trim()) {
        toast.error(t('messages.resourceNameRequired', { index: i + 1 }));
        return false;
      }
      if (!resource.quantity || parseInt(resource.quantity) <= 0) {
        toast.error(t('messages.validResourceQuantityRequired', { index: i + 1 }));
        return false;
      }
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
      let locationData;
      
      if (isEditing) {
        // Update existing location
        const { data: updatedLocation, error: locationError } = await supabase
          .from('locations')
          .update({ location_name: formData.location_name.trim() })
          .eq('id', location.id)
          .select()
          .single();

        if (locationError) throw locationError;
        locationData = updatedLocation;

        // Delete existing resources for this location
        await supabase
          .from('location_resources')
          .delete()
          .eq('location_id', location.id);

      } else {
        // Create new location
        const { data: newLocation, error: locationError } = await supabase
          .from('locations')
          .insert([{
            location_name: formData.location_name.trim(),
            partner_uuid: partnerUuid
          }])
          .select()
          .single();

        if (locationError) throw locationError;
        locationData = newLocation;
      }

      // Insert/Update resources
      const resourcesData = resources
        .filter(resource => resource.resource_name.trim()) // Only include resources with names
        .map(resource => ({
          location_id: locationData.id,
          partner_uuid: partnerUuid,
          resource_type: resource.resource_type,
          resource_name: resource.resource_name.trim(),
          quantity: parseInt(resource.quantity),
          description: resource.description.trim() || null
        }));

      if (resourcesData.length > 0) {
        const { error: resourcesError } = await supabase
          .from('location_resources')
          .insert(resourcesData);

        if (resourcesError) throw resourcesError;
      }

      toast.success(
        isEditing 
          ? t('messages.locationUpdatedSuccessfully') 
          : t('messages.locationCreatedSuccessfully')
      );
      
      onSuccess(locationData);
      onClose();
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error(error.message || t('messages.errorSavingLocation'));
    } finally {
      setLoading(false);
    }
  };

  const getResourceIcon = (type) => {
    return type === 'scrivania' ? <Monitor /> : <Users />;
  };

  const getResourceTypeLabel = (type) => {
    return type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
  };

  if (!isOpen) return null;

  return (
    <div className="locations-modal-backdrop">
      <div className="location-form-modal-container">
        {/* Header */}
        <div className="location-form-header">
          <div className="location-form-header-content">
            <MapPin />
            <h2 className="location-form-title">
              {isEditing ? t('locations.editLocation') : t('locations.addLocation')}
            </h2>
          </div>
          <button onClick={onClose} className="location-form-close">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="location-form-layout">
          {/* Left Panel - Location Details */}
          <div className="location-form-sidebar">
            <div className="location-form-sidebar-content">
              <div className="location-details-section">
                <h3 className="location-details-header">
                  <MapPin />
                  {t('locations.basicInformation')}
                </h3>
                
                <div className="location-form-group">
                  <div className="location-input-group">
                    <label htmlFor="location_name" className="location-form-label">
                      {t('locations.locationName')} *
                    </label>
                    <input
                      id="location_name"
                      name="location_name"
                      type="text"
                      required
                      className="location-form-input"
                      placeholder={t('placeholders.locationNamePlaceholder')}
                      value={formData.location_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Resource Summary */}
              <div className="resource-summary">
                <h4 className="resource-summary-title">{t('locations.resourcesSummary')}</h4>
                <div className="resource-summary-list">
                  {resources.filter(r => r.resource_name.trim()).map((resource, index) => (
                    <div key={index} className="resource-summary-item">
                      <div className="resource-summary-info">
                        {getResourceIcon(resource.resource_type)}
                        <span>{resource.resource_name || t('locations.unnamed')}</span>
                      </div>
                      <span className="resource-summary-quantity">×{resource.quantity}</span>
                    </div>
                  ))}
                  {resources.filter(r => r.resource_name.trim()).length === 0 && (
                    <p className="resource-summary-empty">{t('locations.noResourcesAddedYet')}</p>
                  )}
                </div>
              </div>

              {/* Helper Tips */}
              <div className="helper-tips">
                <h4 className="helper-tips-title">💡 {t('locations.tips')}</h4>
                <ul className="helper-tips-list">
                  <li>• {t('locations.useDescriptiveNames')}</li>
                  <li>• {t('locations.addDescriptionsForSpecial')}</li>
                  <li>• {t('locations.setAccurateQuantities')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Panel - Resources */}
          <div className="location-form-main">
            <div className="resources-management-header">
              <h3 className="resources-management-title">
                <Calendar />
                {t('locations.availableResources')}
              </h3>
              <button
                type="button"
                onClick={addResource}
                className="add-resource-button"
              >
                <Plus />
                {t('locations.addResource')}
              </button>
            </div>

            <div className="resources-content">
              <div className="resources-list">
                {resources.map((resource, index) => (
                  <div key={index} className="resource-item">
                    <div className="resource-item-header">
                      <div className="resource-item-info">
                        <div className="resource-number-badge">
                          {index + 1}
                        </div>
                        <div className="resource-type-info">
                          {getResourceIcon(resource.resource_type)}
                          {getResourceTypeLabel(resource.resource_type)}
                        </div>
                      </div>
                      {resources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeResource(index)}
                          className="resource-remove-button"
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                    
                    <div className="resource-item-form">
                      <div className="resource-form-grid">
                        <div className="resource-form-col-3">
                          <div className="resource-form-group">
                            <label className="resource-form-label">
                              {t('locations.resourceType')} *
                            </label>
                            <select
                              className="resource-form-select"
                              value={resource.resource_type}
                              onChange={(e) => handleResourceChange(index, 'resource_type', e.target.value)}
                              required
                            >
                              <option value="scrivania">{t('locations.scrivania')}</option>
                              <option value="sala_riunioni">{t('locations.salaRiunioni')}</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="resource-form-col-5">
                          <div className="resource-form-group">
                            <label className="resource-form-label">
                              {t('locations.resourceName')} *
                            </label>
                            <input
                              type="text"
                              className="resource-form-input"
                              placeholder={t('placeholders.resourceNamePlaceholder')}
                              value={resource.resource_name}
                              onChange={(e) => handleResourceChange(index, 'resource_name', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="resource-form-col-2">
                          <div className="resource-form-group">
                            <label className="resource-form-label">
                              {t('locations.quantity')} *
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="999"
                              className="resource-form-input"
                              value={resource.quantity}
                              onChange={(e) => handleResourceChange(index, 'quantity', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="resource-form-col-2">
                          <div className="resource-form-group">
                            <label className="resource-form-label">
                              {t('locations.status')}
                            </label>
                            <div className="resource-status-container">
                              <span className="resource-status-badge">
                                {t('locations.available')}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="resource-description-group">
                          <div className="resource-form-group">
                            <label className="resource-form-label">
                              {t('locations.description')} <span style={{color: '#6b7280'}}>({t('common.optional')})</span>
                            </label>
                            <textarea
                              rows={2}
                              className="resource-form-textarea"
                              placeholder={t('placeholders.resourceDescriptionPlaceholder')}
                              value={resource.description}
                              onChange={(e) => handleResourceChange(index, 'description', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Examples section */}
              <div className="examples-section">
                <h4 className="examples-title">📋 {t('locations.resourceExamples')}</h4>
                <div className="examples-grid">
                  <div className="example-category">
                    <div className="example-category-header">
                      <Monitor />
                      {t('locations.scrivania')}:
                    </div>
                    <ul className="example-list">
                      <li>• {t('locations.hotDeskExample')}</li>
                      <li>• {t('locations.privateOfficeExample')}</li>
                      <li>• {t('locations.standingDeskExample')}</li>
                    </ul>
                  </div>
                  <div className="example-category">
                    <div className="example-category-header">
                      <Users />
                      {t('locations.salaRiunioni')}:
                    </div>
                    <ul className="example-list">
                      <li>• {t('locations.conferenceRoomExample')}</li>
                      <li>• {t('locations.phoneBoothExample')}</li>
                      <li>• {t('locations.trainingRoomExample')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="location-form-footer">
              <button
                type="button"
                onClick={onClose}
                className="form-button form-button-secondary"
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="form-button form-button-primary"
                disabled={loading}
              >
                {loading && (
                  <div className="form-loading-spinner" />
                )}
                {loading 
                  ? (isEditing ? t('common.saving') + '...' : t('common.creating') + '...') 
                  : (isEditing ? t('common.save') : t('common.create'))
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LocationForm;
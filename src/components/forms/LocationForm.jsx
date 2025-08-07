import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const LocationForm = ({ isOpen, onClose, onSuccess, location = null, partnerUuid }) => {
  const { t } = useTranslation();
  const isEditing = !!location;
  
  const [formData, setFormData] = useState({
    location_name: location?.location_name || '',
  });

  const [resources, setResources] = useState([
    { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' },
    { resource_type: 'sala_riunioni', resource_name: '', quantity: '1', description: '' }
  ]);
  
  const [loading, setLoading] = useState(false);

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container location-form-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('locations.editLocation') : t('locations.addLocation')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Basic Information */}
          <div className="form-section">
            <h3 className="form-section-title">{t('locations.basicInformation')}</h3>
            
            <div className="form-group">
              <label htmlFor="location_name" className="form-label">
                {t('locations.locationName')} *
              </label>
              <input
                id="location_name"
                name="location_name"
                type="text"
                required
                className="form-input"
                placeholder={t('placeholders.locationNamePlaceholder')}
                value={formData.location_name}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Resources Section */}
          <div className="form-section">
            <div className="resources-header">
              <h3 className="form-section-title">{t('locations.availableResources')}</h3>
              <button
                type="button"
                onClick={addResource}
                className="add-resource-btn"
              >
                <Plus size={16} />
                {t('locations.addResource')}
              </button>
            </div>
            
            <div className="resources-list">
              {resources.map((resource, index) => (
                <div key={index} className="resource-item">
                  <div className="resource-header">
                    <span className="resource-number">{index + 1}.</span>
                    {resources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeResource(index)}
                        className="remove-resource-btn"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  <div className="resource-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">
                          {t('locations.resourceType')} *
                        </label>
                        <select
                          className="form-select"
                          value={resource.resource_type}
                          onChange={(e) => handleResourceChange(index, 'resource_type', e.target.value)}
                          required
                        >
                          <option value="scrivania">{t('locations.scrivania')}</option>
                          <option value="sala_riunioni">{t('locations.salaRiunioni')}</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">
                          {t('locations.resourceName')} *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={t('placeholders.resourceNamePlaceholder')}
                          value={resource.resource_name}
                          onChange={(e) => handleResourceChange(index, 'resource_name', e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">
                          {t('locations.quantity')} *
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          placeholder="1"
                          value={resource.quantity}
                          onChange={(e) => handleResourceChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">
                        {t('locations.description')} ({t('common.optional')})
                      </label>
                      <textarea
                        rows={2}
                        className="form-textarea"
                        placeholder={t('placeholders.resourceDescriptionPlaceholder')}
                        value={resource.description}
                        onChange={(e) => handleResourceChange(index, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="resources-examples">
              <div className="examples-title">{t('locations.resourceExamples')}:</div>
              <div className="examples-content">
                <div className="example-group">
                  <strong>{t('locations.scrivania')}:</strong>
                  <span>{t('locations.scrivaniaSexamples')}</span>
                </div>
                <div className="example-group">
                  <strong>{t('locations.salaRiunioni')}:</strong>
                  <span>{t('locations.salaRiunioniExamples')}</span>
                </div>
              </div>
            </div>
          </div>

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
              disabled={loading}
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

export default LocationForm;
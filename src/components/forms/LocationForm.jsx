import { Calendar, Image, MapPin, Monitor, Plus, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { imageService } from '../../services/imageService';
import { supabase } from '../../services/supabase';
import ImageUpload from '../common/ImageUpload';
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

  // Image states
  const [images, setImages] = useState({
    exterior: [],
    scrivania: [],
    sala_riunioni: []
  });

  const [activeImageTab, setActiveImageTab] = useState('exterior');
  const [uploadingImages, setUploadingImages] = useState(false);
  
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
          id: resource.id,
          resource_type: resource.resource_type,
          resource_name: resource.resource_name,
          quantity: resource.quantity.toString(),
          description: resource.description || ''
        }));
        setResources(formattedResources);
      } else {
        setResources([
          { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' },
          { resource_type: 'sala_riunioni', resource_name: '', quantity: '1', description: '' }
        ]);
      }

      // Load existing images
      loadExistingImages();
    } else {
      // Reset form for new location
      setFormData({
        location_name: '',
      });
      setResources([
        { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' },
        { resource_type: 'sala_riunioni', resource_name: '', quantity: '1', description: '' }
      ]);
      setImages({
        exterior: [],
        scrivania: [],
        sala_riunioni: []
      });
    }
  }, [location]);

  const loadExistingImages = async () => {
    if (!location?.id) return;

    try {
      const result = await imageService.getLocationImagesGrouped(location.id);
      if (result.success) {
        setImages(result.data);
      } else {
        console.error('Failed to load images:', result.error);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

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

  // Handle image changes for each category
  const handleImagesChange = (category, newImages) => {
    setImages(prev => ({
      ...prev,
      [category]: newImages
    }));
  };

  // Upload images to storage
  const uploadImages = async (locationId) => {
    setUploadingImages(true);
    const uploadPromises = [];

    for (const [category, categoryImages] of Object.entries(images)) {
      const newImages = categoryImages.filter(img => img.isNew && img.file);
      
      if (newImages.length > 0) {
        const files = newImages.map(img => img.file);
        uploadPromises.push(
          imageService.uploadLocationImages(files, partnerUuid, locationId, category, {
            startOrder: categoryImages.filter(img => !img.isNew).length
          })
        );
      }
    }

    try {
      const results = await Promise.all(uploadPromises);
      
      // Check for any failed uploads
      const allResults = results.flat();
      const failed = allResults.filter(r => !r.success);
      
      if (failed.length > 0) {
        console.error('Some images failed to upload:', failed);
        toast.error(t('locations.someImagesFailedToUpload', { count: failed.length }));
      }

      const succeeded = allResults.filter(r => r.success);
      if (succeeded.length > 0) {
        toast.success(t('locations.imagesUploadedSuccessfully', { count: succeeded.length }));
      }

    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(t('locations.errorUploadingImages'));
    } finally {
      setUploadingImages(false);
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

        // Delete existing resources for this location (wait for completion)
        const { error: deleteResourcesError } = await supabase
          .from('location_resources')
          .delete()
          .eq('location_id', location.id);

        if (deleteResourcesError) {
          console.error('Error deleting existing resources:', deleteResourcesError);
          // Continue anyway - we'll handle duplicates below
        }

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

      // Insert/Update resources with better error handling
      const resourcesData = resources
        .filter(resource => resource.resource_name.trim())
        .map(resource => ({
          location_id: locationData.id,
          partner_uuid: partnerUuid,
          resource_type: resource.resource_type,
          resource_name: resource.resource_name.trim(),
          quantity: parseInt(resource.quantity),
          description: resource.description.trim() || null
        }));

      if (resourcesData.length > 0) {
        // For editing, use upsert to handle any potential duplicates
        if (isEditing) {
          // Insert resources one by one to handle potential conflicts
          for (const resourceData of resourcesData) {
            const { error: resourceError } = await supabase
              .from('location_resources')
              .upsert(resourceData, {
                onConflict: 'location_id,resource_name',
                ignoreDuplicates: false
              });
            
            if (resourceError) {
              console.error('Error inserting resource:', resourceError);
              // Continue with other resources
            }
          }
        } else {
          // For new locations, insert normally
          const { error: resourcesError } = await supabase
            .from('location_resources')
            .insert(resourcesData);

          if (resourcesError) throw resourcesError;
        }
      }

      // Upload new images
      await uploadImages(locationData.id);

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

  const getImageTabLabel = (category) => {
    const labels = {
      exterior: t('locations.exteriorImages') || 'Exterior Photos',
      scrivania: t('locations.deskImages') || 'Desk Areas',
      sala_riunioni: t('locations.meetingRoomImages') || 'Meeting Rooms'
    };
    return labels[category];
  };

  const getTotalImages = () => {
    return Object.values(images).reduce((total, categoryImages) => total + categoryImages.length, 0);
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

              {/* Images Summary */}
              <div className="images-summary">
                <h4 className="images-summary-title">
                  <Image size={16} />
                  {t('locations.imagesSummary')} ({getTotalImages()})
                </h4>
                <div className="images-summary-categories">
                  {Object.entries(images).map(([category, categoryImages]) => (
                    <div key={category} className="images-summary-item">
                      <span className="images-summary-category">
                        {getImageTabLabel(category)}
                      </span>
                      <span className="images-summary-count">
                        {categoryImages.length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Helper Tips */}
              <div className="helper-tips">
                <h4 className="helper-tips-title">💡 {t('locations.tips')}</h4>
                <ul className="helper-tips-list">
                  <li>• {t('locations.useDescriptiveNames')}</li>
                  <li>• {t('locations.addDescriptionsForSpecial')}</li>
                  <li>• {t('locations.setAccurateQuantities')}</li>
                  <li>• {t('locations.uploadQualityImages')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Panel - Resources and Images */}
          <div className="location-form-main">
            {/* Tab Navigation */}
            <div className="form-tabs-nav">
              <button
                type="button"
                className={`form-tab ${activeImageTab === 'resources' ? 'active' : ''}`}
                onClick={() => setActiveImageTab('resources')}
              >
                <Calendar />
                {t('locations.resources')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeImageTab === 'exterior' ? 'active' : ''}`}
                onClick={() => setActiveImageTab('exterior')}
              >
                <Image />
                {t('locations.exteriorImages')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeImageTab === 'scrivania' ? 'active' : ''}`}
                onClick={() => setActiveImageTab('scrivania')}
              >
                <Monitor />
                {t('locations.deskImages')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeImageTab === 'sala_riunioni' ? 'active' : ''}`}
                onClick={() => setActiveImageTab('sala_riunioni')}
              >
                <Users />
                {t('locations.meetingRoomImages')}
              </button>
            </div>

            {/* Tab Content */}
            <div className="form-tab-content">
              {activeImageTab === 'resources' && (
                <div className="resources-tab">
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
              )}

              {/* Image Upload Tabs */}
              {activeImageTab !== 'resources' && (
                <div className="images-tab">
                  <ImageUpload
                    category={activeImageTab}
                    images={images[activeImageTab]}
                    onImagesChange={(newImages) => handleImagesChange(activeImageTab, newImages)}
                    maxImages={10}
                    disabled={loading || uploadingImages}
                    showAltText={true}
                  />
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="location-form-footer">
              <button
                type="button"
                onClick={onClose}
                className="form-button form-button-secondary"
                disabled={loading || uploadingImages}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="form-button form-button-primary"
                disabled={loading || uploadingImages}
              >
                {(loading || uploadingImages) && (
                  <div className="form-loading-spinner" />
                )}
                {loading || uploadingImages
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
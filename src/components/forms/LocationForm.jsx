import { Calendar, Image, Mail, Map, MapPin, Monitor, Navigation, Phone, Plus, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { imageService } from '../../services/imageService';
import { supabase } from '../../services/supabase';
import ImageUpload from '../common/ImageUpload';
import { toast } from '../common/ToastContainer';
import MapSelector from '../maps/MapSelector';

const LocationForm = ({ isOpen, onClose, onSuccess, location = null, partnerUuid, partnerData = null }) => {
  const { t } = useTranslation();
  const isEditing = !!location;
  
  const [formData, setFormData] = useState({
    location_name: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Italy',
    latitude: null,
    longitude: null,
    phone: '',
    email: '',
    description: '',
    timezone: 'Europe/Rome'
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

  const [activeTab, setActiveTab] = useState('basic');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Initialize form data when location changes
  useEffect(() => {
    if (location) {
      // Set form data
      setFormData({
        location_name: location.location_name || '',
        address: location.address || '',
        city: location.city || '',
        postal_code: location.postal_code || '',
        country: location.country || 'Italy',
        latitude: location.latitude || null,
        longitude: location.longitude || null,
        phone: location.phone || '',
        email: location.email || '',
        description: location.description || '',
        timezone: location.timezone || 'Europe/Rome'
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
      // Reset form for new location with partner defaults
      const defaultFormData = {
        location_name: '',
        address: partnerData?.address || '',
        city: partnerData?.city || '',
        postal_code: partnerData?.zip || '',
        country: partnerData?.country || 'Italy',
        latitude: null,
        longitude: null,
        phone: partnerData?.phone || '',
        email: partnerData?.email || '',
        description: '',
        timezone: 'Europe/Rome'
      };
      
      setFormData(defaultFormData);
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
  }, [location, partnerData]);

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

  // Handle coordinates change from map
  const handleCoordinatesChange = (lat, lng) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
  };

  // Geocode address using Nominatim
  const geocodeAddress = async () => {
    const { address, city, postal_code, country } = formData;
    
    if (!address && !city) {
      toast.error(t('locations.addressOrCityRequired'));
      return;
    }

    setGeocoding(true);
    
    try {
      // Build query string for Nominatim
      const addressComponents = [
        address,
        city,
        postal_code,
        country
      ].filter(Boolean);
      
      const query = addressComponents.join(', ');
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=${country === 'Italy' ? 'it' : ''}`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));
        
        toast.success(t('locations.addressGeocodedSuccessfully'));
        
        // Switch to map tab to show the result
        setActiveTab('location');
      } else {
        toast.error(t('locations.addressNotFound'));
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error(t('locations.geocodingError'));
    } finally {
      setGeocoding(false);
    }
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

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error(t('messages.invalidEmailFormat'));
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
          .update({
            location_name: formData.location_name.trim(),
            address: formData.address.trim() || null,
            city: formData.city.trim() || null,
            postal_code: formData.postal_code.trim() || null,
            country: formData.country,
            latitude: formData.latitude,
            longitude: formData.longitude,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            description: formData.description.trim() || null,
            timezone: formData.timezone
          })
          .eq('id', location.id)
          .select()
          .single();

        if (locationError) throw locationError;
        locationData = updatedLocation;

        // Delete existing resources for this location
        const { error: deleteResourcesError } = await supabase
          .from('location_resources')
          .delete()
          .eq('location_id', location.id);

        if (deleteResourcesError) {
          console.error('Error deleting existing resources:', deleteResourcesError);
        }

      } else {
        // Create new location
        const { data: newLocation, error: locationError } = await supabase
          .from('locations')
          .insert([{
            location_name: formData.location_name.trim(),
            partner_uuid: partnerUuid,
            address: formData.address.trim() || null,
            city: formData.city.trim() || null,
            postal_code: formData.postal_code.trim() || null,
            country: formData.country,
            latitude: formData.latitude,
            longitude: formData.longitude,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            description: formData.description.trim() || null,
            timezone: formData.timezone
          }])
          .select()
          .single();

        if (locationError) throw locationError;
        locationData = newLocation;
      }

      // Insert/Update resources
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
              {/* Basic Information */}
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

              {/* Contact Information Summary */}
              <div className="contact-summary">
                <h4 className="contact-summary-title">
                  <Phone size={16} />
                  {t('locations.contactInformation')}
                </h4>
                <div className="contact-summary-list">
                  {formData.phone && (
                    <div className="contact-summary-item">
                      <Phone size={14} />
                      <span>{formData.phone}</span>
                    </div>
                  )}
                  {formData.email && (
                    <div className="contact-summary-item">
                      <Mail size={14} />
                      <span>{formData.email}</span>
                    </div>
                  )}
                  {!formData.phone && !formData.email && (
                    <p className="contact-summary-empty">{t('locations.noContactInfoYet')}</p>
                  )}
                </div>
              </div>

              {/* Address Summary */}
              <div className="address-summary">
                <h4 className="address-summary-title">
                  <MapPin size={16} />
                  {t('locations.addressInformation')}
                </h4>
                <div className="address-summary-content">
                  {formData.address || formData.city ? (
                    <div className="address-summary-text">
                      {formData.address && <div>{formData.address}</div>}
                      <div>
                        {[formData.postal_code, formData.city].filter(Boolean).join(' ')}
                      </div>
                      {formData.country && <div>{formData.country}</div>}
                      {formData.latitude && formData.longitude && (
                        <div className="coordinates-display">
                          <Navigation size={12} />
                          <span>{formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="address-summary-empty">{t('locations.noAddressYet')}</p>
                  )}
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
            </div>
          </div>

          {/* Right Panel - Tabbed Content */}
          <div className="location-form-main">
            {/* Tab Navigation */}
            <div className="form-tabs-nav">
              <button
                type="button"
                className={`form-tab ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
              >
                <MapPin />
                {t('locations.basicInfo')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeTab === 'address' ? 'active' : ''}`}
                onClick={() => setActiveTab('address')}
              >
                <Navigation />
                {t('locations.address')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeTab === 'location' ? 'active' : ''}`}
                onClick={() => setActiveTab('location')}
              >
                <Map />
                {t('locations.mapLocation')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeTab === 'resources' ? 'active' : ''}`}
                onClick={() => setActiveTab('resources')}
              >
                <Calendar />
                {t('locations.resources')}
              </button>
              <button
                type="button"
                className={`form-tab ${activeTab === 'images' ? 'active' : ''}`}
                onClick={() => setActiveTab('images')}
              >
                <Image />
                {t('locations.images')} ({getTotalImages()})
              </button>
            </div>

            {/* Tab Content */}
            <div className="form-tab-content">
              {/* Basic Information Tab */}
              {activeTab === 'basic' && (
                <div className="basic-info-tab">
                  <div className="basic-info-content">
                    <h3 className="tab-section-title">
                      <Phone />
                      {t('locations.contactDetails')}
                    </h3>
                    
                    <div className="form-grid">
                      <div className="form-group">
                        <label htmlFor="phone" className="form-label">
                          {t('locations.phoneNumber')}
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          className="form-input"
                          placeholder={t('placeholders.phoneNumberPlaceholder')}
                          value={formData.phone}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="email" className="form-label">
                          {t('locations.emailAddress')}
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          className="form-input"
                          placeholder={t('placeholders.emailPlaceholder')}
                          value={formData.email}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="description" className="form-label">
                        {t('locations.description')} <span style={{color: '#6b7280'}}>({t('common.optional')})</span>
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={4}
                        className="form-textarea"
                        placeholder={t('placeholders.locationDescriptionPlaceholder')}
                        value={formData.description}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="timezone" className="form-label">
                        {t('locations.timezone')}
                      </label>
                      <select
                        id="timezone"
                        name="timezone"
                        className="form-select"
                        value={formData.timezone}
                        onChange={handleChange}
                      >
                        <option value="Europe/Rome">Europe/Rome (GMT+1)</option>
                        <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
                        <option value="Europe/Berlin">Europe/Berlin (GMT+1)</option>
                        <option value="Europe/Madrid">Europe/Madrid (GMT+1)</option>
                        <option value="Europe/London">Europe/London (GMT+0)</option>
                        <option value="Europe/Zurich">Europe/Zurich (GMT+1)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Tab */}
              {activeTab === 'address' && (
                <div className="address-tab">
                  <div className="address-content">
                    <div className="address-header">
                      <h3 className="tab-section-title">
                        <MapPin />
                        {t('locations.addressInformation')}
                      </h3>
                      <button
                        type="button"
                        onClick={geocodeAddress}
                        disabled={geocoding || (!formData.address && !formData.city)}
                        className="geocode-button"
                      >
                        {geocoding ? (
                          <>
                            <div className="geocode-spinner" />
                            {t('locations.geocoding')}...
                          </>
                        ) : (
                          <>
                            <Navigation />
                            {t('locations.findOnMap')}
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="form-grid">
                      <div className="form-group form-group-full">
                        <label htmlFor="address" className="form-label">
                          {t('locations.streetAddress')}
                        </label>
                        <input
                          id="address"
                          name="address"
                          type="text"
                          className="form-input"
                          placeholder={t('placeholders.streetAddressPlaceholder')}
                          value={formData.address}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label htmlFor="postal_code" className="form-label">
                          {t('locations.postalCode')}
                        </label>
                        <input
                          id="postal_code"
                          name="postal_code"
                          type="text"
                          className="form-input"
                          placeholder={t('placeholders.postalCodePlaceholder')}
                          value={formData.postal_code}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="city" className="form-label">
                          {t('locations.city')}
                        </label>
                        <input
                          id="city"
                          name="city"
                          type="text"
                          className="form-input"
                          placeholder={t('placeholders.cityPlaceholder')}
                          value={formData.city}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="country" className="form-label">
                          {t('locations.country')}
                        </label>
                        <select
                          id="country"
                          name="country"
                          className="form-select"
                          value={formData.country}
                          onChange={handleChange}
                        >
                          <option value="Italy">Italy</option>
                          <option value="France">France</option>
                          <option value="Germany">Germany</option>
                          <option value="Spain">Spain</option>
                          <option value="Switzerland">Switzerland</option>
                          <option value="Austria">Austria</option>
                          <option value="Netherlands">Netherlands</option>
                          <option value="Belgium">Belgium</option>
                          <option value="Portugal">Portugal</option>
                          <option value="United Kingdom">United Kingdom</option>
                        </select>
                      </div>
                    </div>

                    {/* Coordinates Display */}
                    {(formData.latitude && formData.longitude) && (
                      <div className="coordinates-section">
                        <h4 className="coordinates-title">
                          <Navigation size={16} />
                          {t('locations.coordinates')}
                        </h4>
                        <div className="coordinates-display">
                          <div className="coordinate-item">
                            <span className="coordinate-label">{t('locations.latitude')}:</span>
                            <span className="coordinate-value">{formData.latitude.toFixed(6)}</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coordinate-label">{t('locations.longitude')}:</span>
                            <span className="coordinate-value">{formData.longitude.toFixed(6)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Address Tips */}
                    <div className="address-tips">
                      <h4 className="address-tips-title">💡 {t('locations.addressTips')}</h4>
                      <ul className="address-tips-list">
                        <li>• {t('locations.tipCompleteAddress')}</li>
                        <li>• {t('locations.tipUseGeocode')}</li>
                        <li>• {t('locations.tipVerifyOnMap')}</li>
                        <li>• {t('locations.tipContactInfo')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Map Location Tab */}
              {activeTab === 'location' && (
                <div className="location-tab">
                  <div className="location-content">
                    <h3 className="tab-section-title">
                      <Map />
                      {t('locations.mapLocation')}
                    </h3>
                    
                    <div className="map-instructions">
                      <p>{t('locations.mapInstructions')}</p>
                    </div>

                    <MapSelector
                      latitude={formData.latitude}
                      longitude={formData.longitude}
                      onCoordinatesChange={handleCoordinatesChange}
                      address={`${formData.address}, ${formData.city}, ${formData.country}`.replace(/^[, ]+|[, ]+$/g, '')}
                    />
                  </div>
                </div>
              )}

              {/* Resources Tab */}
              {activeTab === 'resources' && (
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

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="images-tab">
                  <div className="images-content">
                    <h3 className="tab-section-title">
                      <Image />
                      {t('locations.locationImages')}
                    </h3>
                    
                    {/* Image Categories */}
                    <div className="image-categories">
                      {Object.entries(images).map(([category, categoryImages]) => (
                        <div key={category} className="image-category-section">
                          <h4 className="image-category-title">
                            {category === 'exterior' && <Image size={16} />}
                            {category === 'scrivania' && <Monitor size={16} />}
                            {category === 'sala_riunioni' && <Users size={16} />}
                            {getImageTabLabel(category)} ({categoryImages.length})
                          </h4>
                          
                          <ImageUpload
                            category={category}
                            images={categoryImages}
                            onImagesChange={(newImages) => handleImagesChange(category, newImages)}
                            maxImages={10}
                            disabled={loading || uploadingImages}
                            showAltText={true}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
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
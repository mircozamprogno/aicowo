import { Calendar, Image, Map, MapPin, Monitor, Navigation, Plus, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTourIntegration } from '../../hooks/useTourIntegration';
import { imageService } from '../../services/imageService';
import { supabase } from '../../services/supabase';
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, logActivity } from '../../utils/activityLogger';
import ImageUpload from '../common/ImageUpload';
import { toast } from '../common/ToastContainer';
import MapSelector from '../maps/MapSelector';

import logger from '../../utils/logger';

const LocationForm = ({ isOpen, onClose, onSuccess, location = null, partnerUuid, partnerData = null, embedded = false, hideHeader = false }) => {
  const { t } = useTranslation();
  const isEditing = !!location;

  const { profile } = useAuth();

  const getDefaultVatByCountry = (country) => {
    const vatRates = {
      'Italy': 22.00,
      'France': 20.00,
      'Germany': 19.00,
      'Spain': 21.00,
      'Switzerland': 7.70,
      'Austria': 20.00,
      'Netherlands': 21.00,
      'Belgium': 21.00,
      'Portugal': 23.00,
      'United Kingdom': 20.00
    };
    return vatRates[country] || 22.00;
  };

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
    timezone: 'Europe/Rome',
    vat_percentage: 22.00
  });

  const [images, setImages] = useState({
    exterior: [],
    scrivania: [],
    sala_riunioni: []
  });

  const [resources, setResources] = useState([]);
  const [resourcesToDelete, setResourcesToDelete] = useState([]);
  const [initialResources, setInitialResources] = useState([]);

  // Add state for resource types
  const [resourceTypologyOptions, setResourceTypologyOptions] = useState([]);

  // Fetch resource types on mount
  useEffect(() => {
    if (partnerUuid) {
      fetchResourceTypes();
    }
  }, [partnerUuid]);

  const fetchResourceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_resource_types')
        .select('*')
        .eq('partner_uuid', partnerUuid)
        .order('type_name');

      if (error) throw error;
      setResourceTypologyOptions(data || []);
    } catch (error) {
      logger.error('Error fetching resource types:', error);
      // Fallback to defaults if fetch fails, or handle gracefully
    }
  };

  const [activeTab, setActiveTab] = useState('basic');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalInfo, setDeleteModalInfo] = useState({
    index: null,
    resourceName: '',
    hasBookings: false,
    bookingCount: 0
  });

  const { onLocationCreated } = useTourIntegration();

  useEffect(() => {
    if (location) {
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
        timezone: location.timezone || 'Europe/Rome',
        vat_percentage: location.vat_percentage || getDefaultVatByCountry(location.country || 'Italy')
      });

      if (location.resources && location.resources.length > 0) {
        const formattedResources = location.resources.map(resource => ({
          id: resource.id,
          resource_type: resource.resource_type,
          resource_name: resource.resource_name,
          quantity: resource.quantity.toString(),
          description: resource.description || ''
        })).sort((a, b) => b.id - a.id); // Sort by ID descending (newest first)
        setResources(formattedResources);
        setInitialResources(formattedResources);
      } else {
        if (profile?.role === 'superadmin') {
          setResources([]);
          setInitialResources([]);
        } else {
          setResources([
            { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' }
          ]);
          setInitialResources([]);
        }
      }

      setResourcesToDelete([]);
      loadExistingImages();
    } else {
      const defaultCountry = partnerData?.country || 'Italy';
      const defaultFormData = {
        location_name: '',
        address: partnerData?.address || '',
        city: partnerData?.city || '',
        postal_code: partnerData?.zip || '',
        country: defaultCountry,
        latitude: null,
        longitude: null,
        phone: partnerData?.phone || '',
        email: partnerData?.email || '',
        description: '',
        timezone: 'Europe/Rome',
        vat_percentage: getDefaultVatByCountry(defaultCountry)
      };

      setFormData(defaultFormData);
      if (profile?.role === 'superadmin') {
        setResources([]);
      } else {
        setResources([
          { resource_type: 'scrivania', resource_name: '', quantity: '1', description: '' }
        ]);
      }
      setImages({
        exterior: [],
        scrivania: [],
        sala_riunioni: []
      });
      setResourcesToDelete([]);
      setInitialResources([]);
    }
  }, [location, partnerData, profile?.role]);

  const loadExistingImages = async () => {
    if (!location?.id) return;

    try {
      const result = await imageService.getLocationImagesGrouped(location.id);
      if (result.success) {
        setImages(result.data);
      } else {
        logger.error('Failed to load images:', result.error);
      }
    } catch (error) {
      logger.error('Error loading images:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'vat_percentage') {
      const numValue = parseFloat(value);
      if (value !== '' && (isNaN(numValue) || numValue < 0 || numValue > 100)) {
        return;
      }
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? 0 : parseFloat(value)
      }));
      return;
    }

    if (name === 'country' && !isEditing) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        vat_percentage: getDefaultVatByCountry(value)
      }));
      return;
    }

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
    setResources(prev => [{
      resource_type: 'scrivania',
      resource_name: '',
      quantity: 1,
      description: ''
    }, ...prev]);
  };

  const handleResourceDelete = async (index) => {
    const resource = resources[index];

    if (!resource.id) {
      removeResource(index);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: bookings, error: bookingCheckError } = await supabase
        .from('package_reservations')
        .select('id')
        .eq('location_resource_id', resource.id)
        .gte('reservation_date', today);

      if (bookingCheckError) {
        logger.error('Error checking bookings:', bookingCheckError);
        toast.error(t('locations.errorCheckingResourceUsage'));
        return;
      }

      const bookingCount = bookings ? bookings.length : 0;

      setDeleteModalInfo({
        index: index,
        resourceName: resource.resource_name || 'Unnamed Resource',
        hasBookings: bookingCount > 0,
        bookingCount: bookingCount
      });
      setShowDeleteModal(true);

    } catch (error) {
      logger.error('Error checking resource bookings:', error);
      toast.error(t('locations.errorCheckingResourceUsage'));
    }
  };

  const confirmResourceDelete = () => {
    if (deleteModalInfo.hasBookings) {
      setShowDeleteModal(false);
      return;
    }

    removeResource(deleteModalInfo.index);
    setShowDeleteModal(false);
  };

  const removeResource = (index) => {
    if (resources.length > 1) {
      const resource = resources[index];

      if (resource.id) {
        setResourcesToDelete(prev => [...prev, resource.id]);
      }

      setResources(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleImagesChange = (category, newImages) => {
    setImages(prev => ({
      ...prev,
      [category]: newImages
    }));
  };

  const handleImageDelete = async (image) => {
    if (!image.id) {
      throw new Error('Cannot delete image: missing image ID');
    }

    try {
      logger.log('Deleting image:', image.id, image.image_name);

      const result = await imageService.deleteLocationImage(image.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete image');
      }

      await logActivity({
        action_category: ACTIVITY_CATEGORIES.LOCATION,
        action_type: ACTIVITY_ACTIONS.IMAGE_DELETED,
        entity_id: location?.id,
        entity_type: 'location',
        description: `Deleted image from location: ${location?.location_name}`,
        metadata: {
          location_id: location?.id,
          location_name: location?.location_name,
          image_id: image.id,
          image_name: image.image_name,
          image_category: image.image_category
        }
      });

      toast.success(t('locations.imageDeletedSuccessfully') || 'Image deleted successfully');
    } catch (error) {
      logger.error('Error deleting image:', error);
      toast.error(t('locations.errorDeletingImage') || 'Error deleting image');
      throw error;
    }
  };

  const handleCoordinatesChange = (lat, lng) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
  };

  const geocodeAddress = async () => {
    const { address, city, postal_code, country } = formData;

    logger.log('🗺️ Geocoding request:', { address, city, postal_code, country });

    if (!address && !city) {
      toast.error(t('locations.addressOrCityRequired'));
      return;
    }

    setGeocoding(true);

    try {
      const addressComponents = [
        address,
        city,
        postal_code,
        country
      ].filter(Boolean);

      const query = addressComponents.join(', ');
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=${country === 'Italy' ? 'it' : ''}`;

      logger.log('🔍 Query:', query);
      logger.log('🌐 URL:', url);

      const response = await fetch(url);
      logger.log('📡 Response status:', response.status);

      const data = await response.json();
      logger.log('📊 Response data:', data);

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        logger.log('✅ Found coordinates:', { lat, lng });

        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));

        toast.success(t('locations.addressGeocodedSuccessfully'));

      } else {
        logger.log('❌ No results found');
        toast.error(t('locations.addressNotFound'));
      }
    } catch (error) {
      logger.error('💥 Geocoding error:', error);
      toast.error(t('locations.geocodingError'));
    } finally {
      setGeocoding(false);
    }
  };

  const uploadImages = async (locationId) => {
    setUploadingImages(true);
    const uploadPromises = [];
    let totalNewImages = 0;

    for (const [category, categoryImages] of Object.entries(images)) {
      const newImages = categoryImages.filter(img => img.isNew && img.file);

      if (newImages.length > 0) {
        totalNewImages += newImages.length;
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

      const allResults = results.flat();
      const failed = allResults.filter(r => !r.success);

      if (failed.length > 0) {
        logger.error('Some images failed to upload:', failed);
        toast.error(t('locations.someImagesFailedToUpload', { count: failed.length }));
      }

      const succeeded = allResults.filter(r => r.success);
      if (succeeded.length > 0) {
        await logActivity({
          action_category: ACTIVITY_CATEGORIES.LOCATION,
          action_type: ACTIVITY_ACTIONS.IMAGES_UPLOADED,
          entity_id: locationId,
          entity_type: 'location',
          description: `Uploaded ${succeeded.length} image(s) to location: ${formData.location_name}`,
          metadata: {
            location_id: locationId,
            location_name: formData.location_name,
            images_count: succeeded.length,
            images_by_category: Object.entries(images).reduce((acc, [cat, imgs]) => {
              const newCount = imgs.filter(img => img.isNew && img.file).length;
              if (newCount > 0) acc[cat] = newCount;
              return acc;
            }, {})
          }
        });

        toast.success(t('locations.imagesUploadedSuccessfully', { count: succeeded.length }));
      }

    } catch (error) {
      logger.error('Error uploading images:', error);
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

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error(t('messages.invalidEmailFormat'));
      return false;
    }

    if (formData.vat_percentage < 0 || formData.vat_percentage > 100) {
      toast.error(t('messages.invalidVatPercentage'));
      return false;
    }

    const isSuperAdmin = profile?.role === 'superadmin';

    if (!isSuperAdmin && resources.filter(r => r.resource_name.trim()).length === 0) {
      toast.error('At least one resource is required for partner locations');
      return false;
    }

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      if (resource.resource_name.trim()) {
        if (!resource.quantity || parseInt(resource.quantity) <= 0) {
          toast.error(t('messages.validResourceQuantityRequired', { index: i + 1 }));
          return false;
        }
      }
    }

    return true;
  };

  const getLocationChanges = (original, updated) => {
    const changes = {};
    const fields = ['location_name', 'address', 'city', 'postal_code', 'country',
      'phone', 'email', 'description', 'timezone', 'vat_percentage',
      'latitude', 'longitude'];

    fields.forEach(field => {
      if (original[field] !== updated[field]) {
        changes[field] = {
          from: original[field],
          to: updated[field]
        };
      }
    });

    return changes;
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
        const locationChanges = getLocationChanges(location, formData);

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
            timezone: formData.timezone,
            vat_percentage: formData.vat_percentage
          })
          .eq('id', location.id)
          .select()
          .single();

        if (locationError) throw locationError;
        locationData = updatedLocation;

        await logActivity({
          action_category: ACTIVITY_CATEGORIES.LOCATION,
          action_type: ACTIVITY_ACTIONS.UPDATED,
          entity_id: locationData.id,
          entity_type: 'location',
          description: `Updated location: ${locationData.location_name}`,
          metadata: {
            location_id: locationData.id,
            location_name: locationData.location_name,
            changes: locationChanges,
            has_changes: Object.keys(locationChanges).length > 0
          }
        });

        if (resourcesToDelete.length > 0) {
          logger.log('Deleting resources:', resourcesToDelete);

          const { data: resourcesToLog } = await supabase
            .from('location_resources')
            .select('id, resource_name, resource_type')
            .in('id', resourcesToDelete);

          const { error: deleteResourcesError } = await supabase
            .from('location_resources')
            .delete()
            .in('id', resourcesToDelete);

          if (deleteResourcesError) {
            logger.error('Error deleting resources:', deleteResourcesError);
            throw new Error(t('locations.cannotDeleteResourceDBError'));
          }

          if (resourcesToLog && resourcesToLog.length > 0) {
            await logActivity({
              action_category: ACTIVITY_CATEGORIES.LOCATION,
              action_type: ACTIVITY_ACTIONS.RESOURCES_DELETED,
              entity_id: locationData.id,
              entity_type: 'location',
              description: `Deleted ${resourcesToLog.length} resource(s) from location: ${locationData.location_name}`,
              metadata: {
                location_id: locationData.id,
                location_name: locationData.location_name,
                deleted_resources: resourcesToLog.map(r => ({
                  id: r.id,
                  name: r.resource_name,
                  type: r.resource_type
                }))
              }
            });
          }
        }

        const newResources = resources.filter(r => !r.id && r.resource_name.trim());
        const updatedResources = resources.filter(r => r.id && r.resource_name.trim());

        const resourcesData = resources
          .filter(resource => resource.resource_name.trim())
          .map(resource => ({
            id: resource.id || undefined,
            location_id: locationData.id,
            partner_uuid: partnerUuid,
            resource_type: resource.resource_type,
            resource_name: resource.resource_name.trim(),
            quantity: 1, // Enforce 1 as per user request
            description: resource.description.trim() || null
          }));

        for (const resourceData of resourcesData) {
          if (resourceData.id) {
            const { error: updateError } = await supabase
              .from('location_resources')
              .update({
                resource_type: resourceData.resource_type,
                resource_name: resourceData.resource_name,
                quantity: resourceData.quantity,
                description: resourceData.description
              })
              .eq('id', resourceData.id);

            if (updateError) throw updateError;
          } else {
            delete resourceData.id;
            const { error: insertError } = await supabase
              .from('location_resources')
              .insert([resourceData]);

            if (insertError) throw insertError;
          }
        }

        if (newResources.length > 0) {
          await logActivity({
            action_category: ACTIVITY_CATEGORIES.LOCATION,
            action_type: ACTIVITY_ACTIONS.RESOURCES_ADDED,
            entity_id: locationData.id,
            entity_type: 'location',
            description: `Added ${newResources.length} resource(s) to location: ${locationData.location_name}`,
            metadata: {
              location_id: locationData.id,
              location_name: locationData.location_name,
              added_resources: newResources.map(r => ({
                name: r.resource_name,
                type: r.resource_type,
                quantity: r.quantity
              }))
            }
          });
        }

        if (updatedResources.length > 0) {
          await logActivity({
            action_category: ACTIVITY_CATEGORIES.LOCATION,
            action_type: ACTIVITY_ACTIONS.RESOURCES_UPDATED,
            entity_id: locationData.id,
            entity_type: 'location',
            description: `Updated ${updatedResources.length} resource(s) in location: ${locationData.location_name}`,
            metadata: {
              location_id: locationData.id,
              location_name: locationData.location_name,
              updated_resources: updatedResources.map(r => ({
                id: r.id,
                name: r.resource_name,
                type: r.resource_type,
                quantity: r.quantity
              }))
            }
          });
        }

      } else {
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
            timezone: formData.timezone,
            vat_percentage: formData.vat_percentage
          }])
          .select()
          .single();

        if (locationError) throw locationError;
        locationData = newLocation;

        await onLocationCreated({
          ...locationData,
          resources: []
        });

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
          const { error: resourcesError } = await supabase
            .from('location_resources')
            .insert(resourcesData);

          if (resourcesError) throw resourcesError;
        }

        await logActivity({
          action_category: ACTIVITY_CATEGORIES.LOCATION,
          action_type: ACTIVITY_ACTIONS.CREATED,
          entity_id: locationData.id,
          entity_type: 'location',
          description: `Created new location: ${locationData.location_name}`,
          metadata: {
            location_id: locationData.id,
            location_name: locationData.location_name,
            address: formData.address,
            city: formData.city,
            country: formData.country,
            resources_count: resourcesData.length,
            resources: resourcesData.map(r => ({
              name: r.resource_name,
              type: r.resource_type,
              quantity: r.quantity
            }))
          }
        });
      }

      await uploadImages(locationData.id);

      toast.success(
        isEditing
          ? t('messages.locationUpdatedSuccessfully')
          : t('messages.locationCreatedSuccessfully')
      );

      onSuccess(locationData);
      onClose();
    } catch (error) {
      logger.error('Error saving location:', error);
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

  if (!isOpen && !embedded) return null;

  const formContent = (
    <>
      <div className={embedded ? "location-form-container-embedded" : "location-form-modal-container"}>
        {!hideHeader && (
          <div className="location-form-header">
            <div className="location-form-header-content">
              <MapPin />
              <h2 className="location-form-title">
                {isEditing ? `${t('locations.editLocation')} - ${formData.location_name}` : t('locations.addLocation')}
              </h2>
            </div>
            {!embedded && (
              <button onClick={onClose} className="location-form-close">
                <X />
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="location-form-layout">
          {/* Sidebar removed as per request */}

          <div className="location-form-main">
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

            <div className="form-tab-content">
              {activeTab === 'basic' && (
                <div className="basic-info-tab">
                  <div className="basic-info-content">
                    <h3 className="tab-section-title">
                      {t('locations.contactDetails')}
                    </h3>

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
                        {t('locations.description')} <span style={{ color: '#6b7280' }}>({t('common.optional')})</span>
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

                    <div className="form-grid">
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

                      <div className="form-group">
                        <label htmlFor="vat_percentage" className="form-label">
                          {t('locations.vatPercentage')} *
                        </label>
                        <div className="vat-input-container">
                          <input
                            id="vat_percentage"
                            name="vat_percentage"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            required
                            className="form-input vat-input"
                            placeholder={t('placeholders.vatPercentagePlaceholder')}
                            value={formData.vat_percentage}
                            onChange={handleChange}
                          />
                          <span className="vat-percentage-symbol">%</span>
                        </div>
                        <p className="vat-help-text">
                          {t('locations.vatHelpText')}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )}

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

                  <div className="map-section" style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
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



              {activeTab === 'resources' && (
                <div className="resources-tab">
                  <div className="resources-content">
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
                        <div key={resource.id || `resource-${index}`} className="resource-item">
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
                                onClick={() => handleResourceDelete(index)}
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
                                    <option value="" disabled>{t('common.select') || 'Select...'}</option>
                                    {resourceTypologyOptions.map(type => (
                                      <option key={type.id} value={type.type_code}>
                                        {type.type_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="resource-description-group">
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

                              <div className="resource-description-group">
                                <div className="resource-form-group">
                                  <label className="resource-form-label">
                                    {t('locations.description')} <span style={{ color: '#6b7280' }}>({t('common.optional')})</span>
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


                    <div className="examples-section">
                      <p style={{
                        fontWeight: 'bold',
                        marginBottom: '1rem',
                        fontSize: '0.95rem'
                      }}>
                        ℹ️ {t('locations.resourceDefinitionNote')}
                      </p>

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
                </div>
              )}

              {activeTab === 'images' && (
                <div className="images-tab">
                  <div className="images-content">
                    <h3 className="tab-section-title">
                      <Image />
                      {t('locations.locationImages')}
                    </h3>

                    <div className="image-upload-tips" style={{ marginBottom: '1.5rem' }}>
                      <h5 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('locations.imageUploadTips')}</h5>
                      <ul style={{ fontSize: '0.875rem', color: '#4b5563', paddingLeft: 0, listStyle: 'none' }}>
                        <li>• {t('locations.tipSupportedFormats')}</li>
                        <li>• {t('locations.tipMaxSize')}</li>
                        <li>• {t('locations.tipBestQuality')}</li>
                        <li>• {t('locations.tipDescriptiveNames')}</li>
                      </ul>
                    </div>

                    <div className="image-categories">
                      {Object.entries(images).map(([category, categoryImages]) => (
                        <div key={category} className="image-category-section">


                          <ImageUpload
                            category={category}
                            images={categoryImages}
                            onImagesChange={(newImages) => handleImagesChange(category, newImages)}
                            onImageDelete={isEditing ? handleImageDelete : null}
                            maxImages={10}
                            disabled={loading || uploadingImages}
                            showAltText={true}
                            showTips={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

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

      {
        showDeleteModal && (
          <div className="modal-overlay">
            <div className="delete-confirmation-modal">
              <div className="delete-modal-header">
                <h3 className="delete-modal-title">
                  {deleteModalInfo.hasBookings ? t('locations.cannotDeleteResourceTitle') : t('common.confirmDelete')}
                </h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="delete-modal-close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="delete-modal-content">
                {deleteModalInfo.hasBookings ? (
                  <>
                    <p className="delete-modal-message">
                      {t('locations.resourceHasBookingsMessage', {
                        resourceName: deleteModalInfo.resourceName,
                        count: deleteModalInfo.bookingCount
                      })}
                    </p>
                    <p className="delete-modal-explanation">
                      {t('locations.resourceHasBookingsAction')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="delete-modal-message">
                      {t('locations.deleteResourceConfirmMessage', { resourceName: deleteModalInfo.resourceName })}
                    </p>
                    <p className="delete-modal-explanation">
                      {t('locations.deleteResourceUndoWarning')}
                    </p>
                  </>
                )}
              </div>

              <div className="delete-modal-actions">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="delete-modal-button delete-modal-cancel"
                >
                  {deleteModalInfo.hasBookings ? t('common.understood') : t('common.cancel')}
                </button>
                {!deleteModalInfo.hasBookings && (
                  <button
                    onClick={confirmResourceDelete}
                    className="delete-modal-button delete-modal-confirm"
                  >
                    {t('locations.deleteResourceBtn')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }
    </>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <div className="locations-modal-backdrop location-form-modal-backdrop">
      {formContent}
    </div>
  );
};

export default LocationForm;
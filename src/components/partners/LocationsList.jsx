import { Building2, Calendar, Edit2, Image, MapPin, Monitor, Plus, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { imageService } from '../../services/imageService';
import { supabase } from '../../services/supabase';
import ImageLightbox from '../common/ImageLightbox';
import { toast } from '../common/ToastContainer';
import LocationForm from '../forms/LocationForm';

const LocationsList = ({ partner, isOpen, onClose }) => {
  const [locations, setLocations] = useState([]);
  const [locationResources, setLocationResources] = useState({});
  const [locationImages, setLocationImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && partner) {
      fetchLocationsAndResources();
    }
  }, [isOpen, partner]);

  const fetchLocationsAndResources = async () => {
    try {
      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_uuid', partner.partner_uuid)
        .order('created_at', { ascending: false });

      if (locationsError && locationsError.code !== 'PGRST116') {
        console.error('Error fetching locations:', locationsError);
        // Provide mock data for now
        setLocations([
          {
            id: 1,
            location_name: 'Main Office',
            location_uuid: 'mock-uuid-1',
            partner_uuid: partner.partner_uuid,
            created_at: '2024-01-15T10:30:00Z'
          },
          {
            id: 2,
            location_name: 'Secondary Branch',
            location_uuid: 'mock-uuid-2', 
            partner_uuid: partner.partner_uuid,
            created_at: '2024-02-20T14:15:00Z'
          }
        ]);
      } else {
        setLocations(locationsData || []);
      }

      // Fetch resources for all locations
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('location_resources')
        .select('*')
        .eq('partner_uuid', partner.partner_uuid)
        .order('resource_type', { ascending: true });

      if (resourcesError && resourcesError.code !== 'PGRST116') {
        console.error('Error fetching resources:', resourcesError);
        // Provide mock resources data
        setLocationResources({
          1: [
            { id: 1, resource_type: 'scrivania', resource_name: 'Hot Desks', quantity: 20, description: 'Flexible workspace desks' },
            { id: 2, resource_type: 'sala_riunioni', resource_name: 'Small Meeting Room', quantity: 3, description: 'Meeting rooms for up to 4 people' }
          ],
          2: [
            { id: 3, resource_type: 'scrivania', resource_name: 'Co-working Desks', quantity: 15, description: 'Shared workspace desks' },
            { id: 4, resource_type: 'sala_riunioni', resource_name: 'Conference Room', quantity: 2, description: 'Professional meeting spaces' }
          ]
        });
      } else {
        // Group resources by location_id
        const groupedResources = {};
        (resourcesData || []).forEach(resource => {
          if (!groupedResources[resource.location_id]) {
            groupedResources[resource.location_id] = [];
          }
          groupedResources[resource.location_id].push(resource);
        });
        setLocationResources(groupedResources);
      }

      // Fetch images for all locations
      await fetchLocationImages(locationsData || []);

    } catch (error) {
      console.error('Error fetching locations and resources:', error);
      toast.error(t('messages.errorLoadingLocations'));
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationImages = async (locationsList) => {
    const imagesData = {};
    
    for (const location of locationsList) {
      try {
        const result = await imageService.getLocationImagesGrouped(location.id);
        if (result.success) {
          imagesData[location.id] = result.data;
        } else {
          imagesData[location.id] = { exterior: [], scrivania: [], sala_riunioni: [] };
        }
      } catch (error) {
        console.error(`Error fetching images for location ${location.id}:`, error);
        imagesData[location.id] = { exterior: [], scrivania: [], sala_riunioni: [] };
      }
    }
    
    setLocationImages(imagesData);
  };

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowLocationForm(true);
  };

  const handleEditLocation = async (location) => {
    try {
      // Fetch the complete location data including resources
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('location_resources')
        .select('*')
        .eq('location_id', location.id)
        .order('id', { ascending: true });

      if (resourcesError) {
        console.error('Error fetching location resources:', resourcesError);
      }

      // Create the complete location object with resources
      const locationWithResources = {
        ...location,
        resources: resourcesData || []
      };

      setEditingLocation(locationWithResources);
      setShowLocationForm(true);
    } catch (error) {
      console.error('Error preparing location for edit:', error);
      toast.error(t('messages.errorLoadingLocationData'));
    }
  };

  const handleDeleteLocation = async (location) => {
    if (!window.confirm(t('messages.confirmDeleteLocation'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id);

      if (error) throw error;

      setLocations(prev => prev.filter(l => l.id !== location.id));
      setLocationResources(prev => {
        const newResources = { ...prev };
        delete newResources[location.id];
        return newResources;
      });
      setLocationImages(prev => {
        const newImages = { ...prev };
        delete newImages[location.id];
        return newImages;
      });
      
      toast.success(t('messages.locationDeletedSuccessfully'));
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error(t('messages.errorDeletingLocation'));
    }
  };

  const handleLocationFormClose = () => {
    setShowLocationForm(false);
    setEditingLocation(null);
  };

  const handleLocationFormSuccess = (savedLocation) => {
    if (editingLocation) {
      // Update existing location in the list
      setLocations(prev => 
        prev.map(l => l.id === savedLocation.id ? savedLocation : l)
      );
    } else {
      // Add new location to the list
      setLocations(prev => [savedLocation, ...prev]);
    }
    // Refresh all data including images
    fetchLocationsAndResources();
  };

  const openLightbox = (images, startIndex = 0) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxImages([]);
    setLightboxIndex(0);
  };

  const getResourceTypeLabel = (type) => {
    return type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
  };

  const getResourceIcon = (type) => {
    return type === 'scrivania' ? <Monitor /> : <Users />;
  };

  const getTotalResourcesForLocation = (locationId) => {
    const resources = locationResources[locationId] || [];
    return resources.reduce((total, resource) => total + resource.quantity, 0);
  };

  const getResourceTypeStats = (locationId) => {
    const resources = locationResources[locationId] || [];
    const desks = resources.filter(r => r.resource_type === 'scrivania').reduce((sum, r) => sum + r.quantity, 0);
    const rooms = resources.filter(r => r.resource_type === 'sala_riunioni').reduce((sum, r) => sum + r.quantity, 0);
    return { desks, rooms };
  };

  const getLocationImageStats = (locationId) => {
    const images = locationImages[locationId] || { exterior: [], scrivania: [], sala_riunioni: [] };
    return {
      total: Object.values(images).reduce((sum, arr) => sum + arr.length, 0),
      exterior: images.exterior.length,
      scrivania: images.scrivania.length,
      sala_riunioni: images.sala_riunioni.length
    };
  };

  const renderImageGallery = (locationId, category, maxVisible = 3) => {
    const images = locationImages[locationId]?.[category] || [];
    
    if (images.length === 0) {
      return (
        <div className="image-gallery-empty">
          <Image size={16} />
          <span>{t('locations.noImages')}</span>
        </div>
      );
    }

    const visibleImages = images.slice(0, maxVisible);
    const remainingCount = Math.max(0, images.length - maxVisible);

    return (
      <div className="image-gallery">
        {visibleImages.map((image, index) => (
          <div 
            key={image.id} 
            className="image-gallery-item"
            onClick={() => openLightbox(images, index)}
          >
            <img 
              src={image.public_url} 
              alt={image.alt_text || `${category} image`}
              className="gallery-thumbnail"
            />
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div 
            className="image-gallery-more"
            onClick={() => openLightbox(images, maxVisible)}
          >
            <div className="gallery-more-overlay">
              <span>+{remainingCount}</span>
            </div>
            <img 
              src={images[maxVisible].public_url} 
              alt="More images"
              className="gallery-thumbnail"
            />
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="locations-modal-backdrop">
        <div className="locations-modal-container">
          {/* Header */}
          <div className="locations-modal-header">
            <div className="locations-modal-header-content">
              <Building2 className="locations-modal-icon" />
              <div>
                <h2 className="locations-modal-title">
                  {t('locations.locationsFor')} {partner?.first_name && partner?.second_name 
                    ? `${partner.first_name} ${partner.second_name}`
                    : partner?.first_name || partner?.company_name
                  }
                </h2>
                <p className="locations-modal-subtitle">
                  {t('locations.manageWorkspacesAndMeetingRooms')}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="locations-modal-close">
              <X />
            </button>
          </div>

          {/* Content */}
          <div className="locations-content-layout">
            {/* Sidebar */}
            <div className="locations-sidebar">
              <div className="locations-sidebar-header">
                <button onClick={handleAddLocation} className="locations-add-button">
                  <Plus />
                  {t('locations.addLocation')}
                </button>
              </div>

              {/* Location Stats */}
              <div className="locations-stats">
                <h3 className="locations-stats-title">{t('locations.quickStats')}</h3>
                <div className="locations-stats-grid">
                  <div className="locations-stat-card">
                    <div className="locations-stat-value">
                      {locations.length}
                    </div>
                    <div className="locations-stat-label">{t('locations.totalLocations')}</div>
                  </div>
                  <div className="locations-stat-card">
                    <div className="locations-stat-value blue">
                      {Object.values(locationResources).flat().reduce((sum, r) => sum + r.quantity, 0)}
                    </div>
                    <div className="locations-stat-label">{t('locations.totalResources')}</div>
                  </div>
                  <div className="locations-stat-card">
                    <div className="locations-stat-value purple">
                      {Object.values(locationImages).reduce((sum, imgs) => 
                        sum + Object.values(imgs).reduce((s, arr) => s + arr.length, 0), 0
                      )}
                    </div>
                    <div className="locations-stat-label">{t('locations.totalImages')}</div>
                  </div>
                </div>
              </div>

              {/* Location Navigation */}
              <div className="locations-navigation">
                <div className="locations-nav-container">
                  <h3 className="locations-nav-title">{t('locations.locations')}</h3>
                  {loading ? (
                    <div className="locations-nav-loading">{t('common.loading')}</div>
                  ) : locations.length === 0 ? (
                    <div className="locations-nav-empty">
                      <MapPin />
                      <p>{t('locations.noLocationsFound')}</p>
                    </div>
                  ) : (
                    <div className="locations-nav-list">
                      {locations.map((location) => {
                        const stats = getResourceTypeStats(location.id);
                        const imageStats = getLocationImageStats(location.id);
                        return (
                          <div key={location.id} className="location-nav-item">
                            <div className="location-nav-content">
                              <div className="location-nav-info">
                                <h4 className="location-nav-name">
                                  {location.location_name}
                                </h4>
                                <div className="location-nav-stats">
                                  <div className="location-nav-stat">
                                    <Monitor />
                                    {stats.desks}
                                  </div>
                                  <div className="location-nav-stat">
                                    <Users />
                                    {stats.rooms}
                                  </div>
                                  <div className="location-nav-stat">
                                    <Image />
                                    {imageStats.total}
                                  </div>
                                </div>
                              </div>
                              <div className="location-nav-actions">
                                <button
                                  onClick={() => handleEditLocation(location)}
                                  className="location-nav-action edit"
                                  title={t('common.edit')}
                                >
                                  <Edit2 />
                                </button>
                                <button
                                  onClick={() => handleDeleteLocation(location)}
                                  className="location-nav-action delete"
                                  title={t('common.delete')}
                                >
                                  <Trash2 />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="locations-main-content">
              {loading ? (
                <div className="locations-loading-state">
                  <div className="text-center">
                    <div className="locations-loading-spinner"></div>
                    <p className="locations-loading-text">{t('locations.loadingLocations')}</p>
                  </div>
                </div>
              ) : locations.length === 0 ? (
                <div className="locations-empty-state">
                  <div className="text-center">
                    <Building2 className="locations-empty-icon" />
                    <h3 className="locations-empty-title">{t('locations.noLocationsYet')}</h3>
                    <p className="locations-empty-description">{t('locations.getStartedByAdding')}</p>
                    <button onClick={handleAddLocation} className="locations-empty-button">
                      <Plus />
                      {t('locations.addFirstLocation')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="locations-content">
                  <div className="locations-grid">
                    {locations.map((location) => {
                      const resources = locationResources[location.id] || [];
                      const stats = getResourceTypeStats(location.id);
                      const imageStats = getLocationImageStats(location.id);
                      
                      return (
                        <div key={location.id} className="location-card">
                          {/* Location Header */}
                          <div className="location-card-header">
                            <div className="location-card-header-content">
                              <div className="location-card-info">
                                <div className="location-card-icon-container">
                                  <div className="location-card-icon">
                                    <MapPin />
                                  </div>
                                  <div>
                                    <h3 className="location-card-title">
                                      {location.location_name}
                                    </h3>
                                    <p className="location-card-date">
                                      {t('common.createdAt')}: {new Date(location.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="location-card-stats">
                                  <div className="location-card-stat blue">
                                    <Monitor />
                                    <span>
                                      {stats.desks} {t('locations.workspaces')}
                                    </span>
                                  </div>
                                  <div className="location-card-stat purple">
                                    <Users />
                                    <span>
                                      {stats.rooms} {t('locations.meetingRooms')}
                                    </span>
                                  </div>
                                  <div className="location-card-stat emerald">
                                    <Calendar />
                                    <span>
                                      {getTotalResourcesForLocation(location.id)} {t('locations.totalResources')}
                                    </span>
                                  </div>
                                  <div className="location-card-stat orange">
                                    <Image />
                                    <span>
                                      {imageStats.total} {t('locations.images')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="location-card-actions">
                                <button
                                  onClick={() => handleEditLocation(location)}
                                  className="location-card-action edit"
                                  title={t('common.edit')}
                                >
                                  <Edit2 />
                                </button>
                                <button
                                  onClick={() => handleDeleteLocation(location)}
                                  className="location-card-action delete"
                                  title={t('common.delete')}
                                >
                                  <Trash2 />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Image Galleries */}
                          {imageStats.total > 0 && (
                            <div className="location-card-images">
                              <h4 className="location-images-title">
                                <Image size={16} />
                                {t('locations.locationImages')}
                              </h4>
                              
                              <div className="location-images-categories">
                                {imageStats.exterior > 0 && (
                                  <div className="image-category">
                                    <div className="image-category-header">
                                      <span className="image-category-label">
                                        {t('locations.exteriorImages')} ({imageStats.exterior})
                                      </span>
                                    </div>
                                    {renderImageGallery(location.id, 'exterior', 4)}
                                  </div>
                                )}

                                {imageStats.scrivania > 0 && (
                                  <div className="image-category">
                                    <div className="image-category-header">
                                      <Monitor size={14} />
                                      <span className="image-category-label">
                                        {t('locations.deskImages')} ({imageStats.scrivania})
                                      </span>
                                    </div>
                                    {renderImageGallery(location.id, 'scrivania', 4)}
                                  </div>
                                )}

                                {imageStats.sala_riunioni > 0 && (
                                  <div className="image-category">
                                    <div className="image-category-header">
                                      <Users size={14} />
                                      <span className="image-category-label">
                                        {t('locations.meetingRoomImages')} ({imageStats.sala_riunioni})
                                      </span>
                                    </div>
                                    {renderImageGallery(location.id, 'sala_riunioni', 4)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Resources Grid */}
                          <div className="location-card-resources">
                            {resources.length > 0 ? (
                              <div className="location-resources-grid">
                                {resources.map((resource) => (
                                  <div key={resource.id} className="resource-card">
                                    <div className="resource-card-header">
                                      <div className="resource-card-type">
                                        <div className={`resource-card-icon ${
                                          resource.resource_type === 'scrivania' ? 'desk' : 'room'
                                        }`}>
                                          {getResourceIcon(resource.resource_type)}
                                        </div>
                                        <div>
                                          <span className="resource-card-type-label">
                                            {getResourceTypeLabel(resource.resource_type)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="resource-card-quantity">
                                        <span className="resource-quantity-number">
                                          {resource.quantity}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <h4 className="resource-card-name">
                                      {resource.resource_name}
                                    </h4>
                                    
                                    {resource.description && (
                                      <p className="resource-card-description">
                                        {resource.description}
                                      </p>
                                    )}
                                    
                                    <div className="resource-card-footer">
                                      <span className="resource-card-status-label">{t('locations.status')}</span>
                                      <span className="resource-card-status-badge">
                                        {t('locations.available')}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="resource-no-resources">
                                <Users />
                                <p>{t('locations.noResourcesFound')}</p>
                                <button onClick={() => handleEditLocation(location)}>
                                  {t('locations.addResources')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Location Form Modal */}
      <LocationForm
        isOpen={showLocationForm}
        onClose={handleLocationFormClose}
        onSuccess={handleLocationFormSuccess}
        location={editingLocation}
        partnerUuid={partner?.partner_uuid}
      />

      {/* Image Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
      />
    </>
  );
};

export default LocationsList;
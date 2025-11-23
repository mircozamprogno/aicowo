import { Camera, ChevronLeft, ChevronRight, Filter, Image, Mail, Map, MapPin, Monitor, Navigation, Phone, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { imageService } from '../services/imageService';
import { supabase } from '../services/supabase';

import logger from '../utils/logger';

const PhotoGallery = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  
  const [locations, setLocations] = useState([]);
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' or 'locations'
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch locations and images
  useEffect(() => {
    if (profile?.partner_uuid) {
      fetchData();
    }
  }, [profile]);

  // Apply filters when filter states change
  useEffect(() => {
    applyFilters();
  }, [images, selectedCategory, selectedLocation, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch locations for this partner with enhanced fields
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select(`
          id,
          location_name,
          address,
          city,
          postal_code,
          country,
          latitude,
          longitude,
          phone,
          email,
          description,
          created_at
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      if (locationsError) throw locationsError;

      setLocations(locationsData || []);

      // Fetch all images for all locations
      const allImages = [];
      for (const location of locationsData || []) {
        const result = await imageService.getLocationImages(location.id);
        if (result.success) {
          // Add location info to each image
          const imagesWithLocation = result.data.map(image => ({
            ...image,
            location_name: location.location_name,
            location_id: location.id,
            location_address: location.address,
            location_city: location.city,
            location_postal_code: location.postal_code,
            location_country: location.country,
            location_phone: location.phone,
            location_email: location.email,
            location_description: location.description,
            location_latitude: location.latitude,
            location_longitude: location.longitude
          }));
          allImages.push(...imagesWithLocation);
        }
      }

      setImages(allImages);

    } catch (err) {
      logger.error('Error fetching gallery data:', err);
      setError(err.message);
      toast.error(t('photoGallery.errorLoadingGallery'));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...images];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(image => image.image_category === selectedCategory);
    }

    // Filter by location
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(image => image.location_id === parseInt(selectedLocation));
    }

    // Filter by search query (location name, city, address)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(image => 
        image.location_name?.toLowerCase().includes(query) ||
        image.location_city?.toLowerCase().includes(query) ||
        image.location_address?.toLowerCase().includes(query) ||
        image.location_country?.toLowerCase().includes(query)
      );
    }

    // Sort by location name, then by display order
    filtered.sort((a, b) => {
      if (a.location_name !== b.location_name) {
        return a.location_name.localeCompare(b.location_name);
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });

    setFilteredImages(filtered);
  }, [images, selectedCategory, selectedLocation, searchQuery]);

  const openLightbox = (index) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const goToPrevious = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? filteredImages.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex(prev => 
      prev === filteredImages.length - 1 ? 0 : prev + 1
    );
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'scrivania':
        return <Monitor size={16} />;
      case 'sala_riunioni':
        return <Users size={16} />;
      case 'exterior':
      default:
        return <Image size={16} />;
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      exterior: t('locations.exterior') || 'Exterior',
      scrivania: t('locations.scrivania') || 'Desk Areas',
      sala_riunioni: t('locations.salaRiunioni') || 'Meeting Rooms'
    };
    return labels[category] || category;
  };

  const getImageStats = () => {
    const stats = {
      total: filteredImages.length,
      exterior: filteredImages.filter(img => img.image_category === 'exterior').length,
      scrivania: filteredImages.filter(img => img.image_category === 'scrivania').length,
      sala_riunioni: filteredImages.filter(img => img.image_category === 'sala_riunioni').length,
      locations: new Set(filteredImages.map(img => img.location_id)).size
    };
    return stats;
  };

  // Format address for display
  const formatAddress = (location) => {
    const parts = [
      location.address,
      [location.postal_code, location.city].filter(Boolean).join(' '),
      location.country
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Open location in external map
  const openInMap = (location) => {
    if (location.latitude && location.longitude) {
      const url = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=15`;
      window.open(url, '_blank');
    } else if (location.address || location.city) {
      const address = formatAddress(location);
      if (address) {
        const url = `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
      }
    }
  };

  // Get location details from image
  const getLocationFromImage = (image) => {
    return {
      id: image.location_id,
      location_name: image.location_name,
      address: image.location_address,
      city: image.location_city,
      postal_code: image.location_postal_code,
      country: image.location_country,
      phone: image.location_phone,
      email: image.location_email,
      description: image.location_description,
      latitude: image.location_latitude,
      longitude: image.location_longitude
    };
  };

  // Group images by location for location view
  const getImagesByLocation = () => {
    const locationGroups = {};
    
    filteredImages.forEach(image => {
      const locationId = image.location_id;
      if (!locationGroups[locationId]) {
        locationGroups[locationId] = {
          location: getLocationFromImage(image),
          images: []
        };
      }
      locationGroups[locationId].images.push(image);
    });
    
    return Object.values(locationGroups);
  };

  if (loading) {
    return (
      <div className="photo-gallery-container">
        <div className="photo-gallery-header">
          <div className="photo-gallery-title">
            <Camera size={24} />
            <h1>{t('photoGallery.title') || 'Photo Gallery'}</h1>
          </div>
        </div>
        <div className="photo-gallery-loading">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="photo-gallery-container">
        <div className="photo-gallery-header">
          <div className="photo-gallery-title">
            <Camera size={24} />
            <h1>{t('photoGallery.title') || 'Photo Gallery'}</h1>
          </div>
        </div>
        <div className="photo-gallery-error">
          <p>{t('photoGallery.errorMessage')}: {error}</p>
          <button onClick={fetchData} className="retry-button">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const stats = getImageStats();
  const locationGroups = getImagesByLocation();

  return (
    <div className="photo-gallery-container">
      {/* Header */}
      <div className="photo-gallery-header">
        <div className="photo-gallery-title">
          <Camera size={24} />
          <h1>{t('photoGallery.title') || 'Photo Gallery'}</h1>
        </div>
        
        <div className="photo-gallery-actions">
          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              onClick={() => setViewMode('gallery')}
              className={`view-mode-btn ${viewMode === 'gallery' ? 'active' : ''}`}
            >
              <Image size={16} />
              {t('photoGallery.galleryView') || 'Gallery'}
            </button>
            <button
              onClick={() => setViewMode('locations')}
              className={`view-mode-btn ${viewMode === 'locations' ? 'active' : ''}`}
            >
              <MapPin size={16} />
              {t('photoGallery.locationsView') || 'Locations'}
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
          >
            <Filter size={16} />
            {t('photoGallery.filters') || 'Filters'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="photo-gallery-stats">
        <div className="stats-item">
          <Image size={16} />
          <span>{stats.total} {t('photoGallery.totalImages') || 'Total Images'}</span>
        </div>
        <div className="stats-item">
          <MapPin size={16} />
          <span>{stats.locations} {t('photoGallery.locations') || 'Locations'}</span>
        </div>
        <div className="stats-breakdown">
          <span className="stats-category">
            {getCategoryIcon('exterior')} {stats.exterior}
          </span>
          <span className="stats-category">
            {getCategoryIcon('scrivania')} {stats.scrivania}
          </span>
          <span className="stats-category">
            {getCategoryIcon('sala_riunioni')} {stats.sala_riunioni}
          </span>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="photo-gallery-filters">
          {/* Search */}
          <div className="filter-group">
            <label className="filter-label">
              {t('photoGallery.searchLocations') || 'Search Locations'}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-search"
              placeholder={t('photoGallery.searchPlaceholder') || 'Search by location name, city, or address...'}
            />
          </div>

          {/* Category Filter */}
          <div className="filter-group">
            <label className="filter-label">
              {t('photoGallery.filterByCategory') || 'Category'}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">{t('photoGallery.allCategories') || 'All Categories'}</option>
              <option value="exterior">{getCategoryLabel('exterior')}</option>
              <option value="scrivania">{getCategoryLabel('scrivania')}</option>
              <option value="sala_riunioni">{getCategoryLabel('sala_riunioni')}</option>
            </select>
          </div>

          {/* Location Filter */}
          <div className="filter-group">
            <label className="filter-label">
              {t('photoGallery.filterByLocation') || 'Location'}
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="filter-select"
            >
              <option value="all">{t('photoGallery.allLocations') || 'All Locations'}</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.location_name} {location.city && `(${location.city})`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedLocation('all');
              setSearchQuery('');
            }}
            className="filter-clear"
          >
            {t('photoGallery.clearFilters') || 'Clear Filters'}
          </button>
        </div>
      )}

      {/* Content */}
      {filteredImages.length === 0 ? (
        <div className="photo-gallery-empty">
          <Camera size={48} />
          <h3>{t('photoGallery.noImages') || 'No Images Found'}</h3>
          <p>
            {selectedCategory !== 'all' || selectedLocation !== 'all' || searchQuery
              ? t('photoGallery.noImagesWithFilters') || 'Try adjusting your filters to see more images.'
              : t('photoGallery.noImagesAvailable') || 'No images have been uploaded yet.'
            }
          </p>
        </div>
      ) : viewMode === 'gallery' ? (
        /* Gallery Grid View */
        <div className="photo-gallery-grid">
          {filteredImages.map((image, index) => {
            const location = getLocationFromImage(image);
            const address = formatAddress(location);
            return (
              <div key={image.id} className="gallery-item">
                <div 
                  className="gallery-image-container"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={image.public_url}
                    alt={image.alt_text || `${image.location_name} - ${getCategoryLabel(image.image_category)}`}
                    className="gallery-image"
                    loading="lazy"
                  />
                  <div className="gallery-overlay">
                    <div className="gallery-info">
                      <div className="gallery-location">
                        <MapPin size={12} />
                        {image.location_name}
                      </div>
                      <div className="gallery-category">
                        {getCategoryIcon(image.image_category)}
                        {getCategoryLabel(image.image_category)}
                      </div>
                      {address && (
                        <div className="gallery-address">
                          <Navigation size={10} />
                          {location.city}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Locations View */
        <div className="photo-gallery-locations">
          {locationGroups.map(({ location, images }) => {
            const address = formatAddress(location);
            return (
              <div key={location.id} className="location-gallery-card">
                {/* Location Header */}
                <div className="location-gallery-header">
                  <div className="location-gallery-info">
                    <div className="location-gallery-title-row">
                      <h3 className="location-gallery-title">
                        <MapPin size={20} />
                        {location.location_name}
                      </h3>
                      <div className="location-gallery-actions">
                        {(location.latitude && location.longitude) || address ? (
                          <button
                            onClick={() => openInMap(location)}
                            className="location-map-button"
                            title={t('locations.viewOnMap')}
                          >
                            <Map size={16} />
                            {t('locations.viewOnMap')}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Address */}
                    {address && (
                      <div className="location-gallery-address">
                        <Navigation size={14} />
                        <span>{address}</span>
                      </div>
                    )}

                    {/* Contact Info */}
                    {(location.phone || location.email) && (
                      <div className="location-gallery-contact">
                        {location.phone && (
                          <div className="location-contact-item">
                            <Phone size={14} />
                            <a href={`tel:${location.phone}`}>{location.phone}</a>
                          </div>
                        )}
                        {location.email && (
                          <div className="location-contact-item">
                            <Mail size={14} />
                            <a href={`mailto:${location.email}`}>{location.email}</a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {location.description && (
                      <div className="location-gallery-description">
                        <p>{location.description}</p>
                      </div>
                    )}

                    {/* Image Count */}
                    <div className="location-gallery-count">
                      <Image size={14} />
                      <span>{images.length} {t('photoGallery.images') || 'images'}</span>
                    </div>
                  </div>
                </div>

                {/* Images Grid */}
                <div className="location-images-grid">
                  {images.slice(0, 8).map((image, index) => {
                    const globalIndex = filteredImages.findIndex(img => img.id === image.id);
                    return (
                      <div key={image.id} className="location-image-item">
                        <div 
                          className="location-image-container"
                          onClick={() => openLightbox(globalIndex)}
                        >
                          <img
                            src={image.public_url}
                            alt={image.alt_text}
                            className="location-image"
                            loading="lazy"
                          />
                          <div className="location-image-category">
                            {getCategoryIcon(image.image_category)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show more indicator */}
                  {images.length > 8 && (
                    <div className="location-images-more">
                      <div className="images-more-overlay">
                        <span>+{images.length - 8}</span>
                        <span>{t('common.more') || 'more'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && filteredImages.length > 0 && (
        <div className="lightbox-backdrop" onClick={closeLightbox}>
          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button className="lightbox-close" onClick={closeLightbox}>
              <X size={24} />
            </button>
            
            {/* Navigation Arrows */}
            {filteredImages.length > 1 && (
              <>
                <button className="lightbox-nav lightbox-prev" onClick={goToPrevious}>
                  <ChevronLeft size={32} />
                </button>
                <button className="lightbox-nav lightbox-next" onClick={goToNext}>
                  <ChevronRight size={32} />
                </button>
              </>
            )}

            {/* Main Image Display */}
            <div className="lightbox-image-wrapper">
              <img
                src={filteredImages[currentImageIndex]?.public_url}
                alt={filteredImages[currentImageIndex]?.alt_text}
                className="lightbox-image"
              />
            </div>
            
            {/* Minimal Info Bar */}
            <div className="lightbox-info-bar">
              <div className="lightbox-basic-info">
                <div className="lightbox-location-name">
                  <MapPin size={16} />
                  {filteredImages[currentImageIndex]?.location_name}
                </div>
                <div className="lightbox-category-info">
                  {getCategoryIcon(filteredImages[currentImageIndex]?.image_category)}
                  {getCategoryLabel(filteredImages[currentImageIndex]?.image_category)}
                </div>
              </div>
              
              {filteredImages.length > 1 && (
                <div className="lightbox-counter">
                  {currentImageIndex + 1} / {filteredImages.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
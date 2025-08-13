import { Camera, ChevronLeft, ChevronRight, Filter, Image, MapPin, Monitor, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { imageService } from '../services/imageService';
import { supabase } from '../services/supabase';

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
  }, [images, selectedCategory, selectedLocation]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch locations for this partner
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select(`
          id,
          location_name,
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
            location_id: location.id
          }));
          allImages.push(...imagesWithLocation);
        }
      }

      setImages(allImages);

    } catch (err) {
      console.error('Error fetching gallery data:', err);
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

    // Sort by location name, then by display order
    filtered.sort((a, b) => {
      if (a.location_name !== b.location_name) {
        return a.location_name.localeCompare(b.location_name);
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });

    setFilteredImages(filtered);
  }, [images, selectedCategory, selectedLocation]);

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

  return (
    <div className="photo-gallery-container">
      {/* Header */}
      <div className="photo-gallery-header">
        <div className="photo-gallery-title">
          <Camera size={24} />
          <h1>{t('photoGallery.title') || 'Photo Gallery'}</h1>
        </div>
        
        <div className="photo-gallery-actions">
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
                  {location.location_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedLocation('all');
            }}
            className="filter-clear"
          >
            {t('photoGallery.clearFilters') || 'Clear Filters'}
          </button>
        </div>
      )}

      {/* Gallery Grid */}
      {filteredImages.length === 0 ? (
        <div className="photo-gallery-empty">
          <Camera size={48} />
          <h3>{t('photoGallery.noImages') || 'No Images Found'}</h3>
          <p>
            {selectedCategory !== 'all' || selectedLocation !== 'all'
              ? t('photoGallery.noImagesWithFilters') || 'Try adjusting your filters to see more images.'
              : t('photoGallery.noImagesAvailable') || 'No images have been uploaded yet.'
            }
          </p>
        </div>
      ) : (
        <div className="photo-gallery-grid">
          {filteredImages.map((image, index) => (
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
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && filteredImages.length > 0 && (
        <div className="lightbox-backdrop" onClick={closeLightbox}>
          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>
              <X size={24} />
            </button>
            
            {filteredImages.length > 1 && (
              <>
                <button className="lightbox-nav lightbox-prev" onClick={goToPrevious}>
                  <ChevronLeft size={24} />
                </button>
                <button className="lightbox-nav lightbox-next" onClick={goToNext}>
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            <div className="lightbox-content">
              <img
                src={filteredImages[currentImageIndex]?.public_url}
                alt={filteredImages[currentImageIndex]?.alt_text}
                className="lightbox-image"
              />
              
              <div className="lightbox-info">
                <div className="lightbox-title">
                  <MapPin size={16} />
                  {filteredImages[currentImageIndex]?.location_name}
                </div>
                <div className="lightbox-category">
                  {getCategoryIcon(filteredImages[currentImageIndex]?.image_category)}
                  {getCategoryLabel(filteredImages[currentImageIndex]?.image_category)}
                </div>
                {filteredImages.length > 1 && (
                  <div className="lightbox-counter">
                    {currentImageIndex + 1} / {filteredImages.length}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
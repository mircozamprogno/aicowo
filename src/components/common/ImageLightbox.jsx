import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';

const ImageLightbox = ({ images = [], initialIndex = 0, isOpen, onClose }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, currentIndex]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setIsZoomed(false);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setIsZoomed(false);
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const imageUrl = currentImage?.public_url || currentImage?.preview;

  return (
    <div className="lightbox-overlay">
      {/* Background overlay */}
      <div className="lightbox-backdrop" onClick={onClose} />
      
      {/* Main content */}
      <div className="lightbox-container">
        {/* Header */}
        <div className="lightbox-header">
          <div className="lightbox-info">
            <h3 className="lightbox-title">
              {currentImage?.image_name || `Image ${currentIndex + 1}`}
            </h3>
            <span className="lightbox-counter">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
          <div className="lightbox-actions">
            <button
              onClick={toggleZoom}
              className="lightbox-action-btn"
              title={isZoomed ? t('locations.zoomOut') : t('locations.zoomIn')}
            >
              {isZoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
            </button>
            <button
              onClick={onClose}
              className="lightbox-action-btn"
              title={t('common.close')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Image container */}
        <div className="lightbox-image-container">
          {images.length > 1 && (
            <button
              onClick={goToPrevious}
              className="lightbox-nav-btn prev"
              title={t('locations.previousImage')}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <div className={`lightbox-image-wrapper ${isZoomed ? 'zoomed' : ''}`}>
            <img
              src={imageUrl}
              alt={currentImage?.alt_text || `Image ${currentIndex + 1}`}
              className="lightbox-image"
              onClick={toggleZoom}
            />
          </div>

          {images.length > 1 && (
            <button
              onClick={goToNext}
              className="lightbox-nav-btn next"
              title={t('locations.nextImage')}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>

        {/* Image metadata */}
        {currentImage?.alt_text && (
          <div className="lightbox-metadata">
            <p className="lightbox-description">{currentImage.alt_text}</p>
          </div>
        )}

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="lightbox-thumbnails">
            <div className="thumbnails-container">
              {images.map((image, index) => (
                <button
                  key={image.id || index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsZoomed(false);
                  }}
                  className={`thumbnail-btn ${index === currentIndex ? 'active' : ''}`}
                >
                  <img
                    src={image.public_url || image.preview}
                    alt={image.alt_text || `Thumbnail ${index + 1}`}
                    className="thumbnail-image"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageLightbox;
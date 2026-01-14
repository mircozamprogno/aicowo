import { AlertCircle, Image, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';

import logger from '../../utils/logger';

const ImageUpload = ({
  category,
  images = [],
  onImagesChange,
  maxImages = 10,
  disabled = false,
  showAltText = false,
  showTips = true,
  onImageDelete = null // Callback for deleting existing images from storage
}) => {
  const { t } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const dropZoneRef = useRef(null);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, [disabled]);

  // Handle drop event
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [disabled, images.length, maxImages, category]);

  // Process selected files
  const handleFiles = useCallback((files) => {
    const imageFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return false;
      }
      return true;
    });

    if (imageFiles.length === 0) {
      return;
    }

    // Check if we would exceed max images
    const totalImages = images.length + imageFiles.length;
    if (totalImages > maxImages) {
      alert(t('locations.maxImagesExceeded', { max: maxImages }));
      return;
    }

    // Create preview objects for new images
    const newImages = imageFiles.map((file, index) => ({
      id: `new_${Date.now()}_${index}_${Math.random().toString(36).substring(2)}`,
      file,
      preview: URL.createObjectURL(file),
      isNew: true,
      alt_text: `${getCategoryLabel(category)} image`,
      display_order: images.length + index
    }));

    onImagesChange([...images, ...newImages]);
  }, [images, maxImages, category, t, onImagesChange]);

  // Attach drag and drop events when component mounts or category changes
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    // Add event listeners
    dropZone.addEventListener('dragenter', handleDrag);
    dropZone.addEventListener('dragleave', handleDrag);
    dropZone.addEventListener('dragover', handleDrag);
    dropZone.addEventListener('drop', handleDrop);

    // Cleanup function
    return () => {
      dropZone.removeEventListener('dragenter', handleDrag);
      dropZone.removeEventListener('dragleave', handleDrag);
      dropZone.removeEventListener('dragover', handleDrag);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [handleDrag, handleDrop, category]);

  // Handle file input change
  const handleFileInput = (e) => {
    if (disabled) return;

    const files = Array.from(e.target.files);
    handleFiles(files);

    // Reset input
    e.target.value = '';
  };

  // Remove image - now handles both new and existing images
  const removeImage = async (imageId) => {
    const imageToRemove = images.find(img => img.id === imageId);

    if (!imageToRemove) return;

    // If it's an existing image (not new), call the delete callback
    if (!imageToRemove.isNew && onImageDelete) {
      setDeletingImageId(imageId);
      try {
        // Call the parent's delete handler
        await onImageDelete(imageToRemove);
      } catch (error) {
        logger.error('Error deleting image:', error);
        setDeletingImageId(null);
        return; // Don't remove from UI if deletion failed
      }
      setDeletingImageId(null);
    }

    // Remove from UI
    const updatedImages = images.filter(img => img.id !== imageId);

    // Clean up preview URLs for new images
    if (imageToRemove.preview && imageToRemove.isNew) {
      URL.revokeObjectURL(imageToRemove.preview);
    }

    onImagesChange(updatedImages);
  };

  // Update alt text
  const updateAltText = (imageId, altText) => {
    const updatedImages = images.map(img =>
      img.id === imageId ? { ...img, alt_text: altText } : img
    );
    onImagesChange(updatedImages);
  };

  // Move image position
  const moveImage = (fromIndex, toIndex) => {
    const updatedImages = [...images];
    const [movedImage] = updatedImages.splice(fromIndex, 1);
    updatedImages.splice(toIndex, 0, movedImage);

    // Update display order
    updatedImages.forEach((img, index) => {
      img.display_order = index;
    });

    onImagesChange(updatedImages);
  };

  // Get category label
  const getCategoryLabel = (cat) => {
    const labels = {
      exterior: t('locations.exterior') || 'Exterior',
      scrivania: t('locations.scrivania') || 'Desk',
      sala_riunioni: t('locations.salaRiunioni') || 'Meeting Room'
    };
    return labels[cat] || cat;
  };

  // Get image URL
  const getImageUrl = (image) => {
    if (image.preview) return image.preview;
    if (image.public_url) return image.public_url;
    return null;
  };

  const canAddMore = images.length < maxImages && !disabled;

  return (
    <div className="image-upload-container">
      <div className="image-upload-header">
        <h4 className="image-upload-title">
          <Image size={16} />
          {getCategoryLabel(category)} {t('locations.images')}
          <span className="image-count">({images.length}/{maxImages})</span>
        </h4>
        {canAddMore && (
          <label className="image-upload-button">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              disabled={disabled}
            />
            <Plus size={16} />
            {t('locations.addImages')}
          </label>
        )}
      </div>

      {/* Drop Zone */}
      {canAddMore && (
        <div
          ref={dropZoneRef}
          className={`image-drop-zone ${dragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        >
          <div className="drop-zone-content">
            <Upload size={32} />
            <p>{t('locations.dropImagesHere')}</p>
            <p className="drop-zone-hint">
              {t('locations.imageRequirements')}
            </p>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="image-grid">
          {images.map((image, index) => (
            <div key={image.id} className="image-item">
              <div className="image-preview">
                <img
                  src={getImageUrl(image)}
                  alt={image.alt_text || 'Location image'}
                />

                {/* Image overlay */}
                <div className="image-overlay">
                  <div className="image-actions">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => moveImage(index, index - 1)}
                        className="image-action-btn move-left"
                        title={t('locations.moveLeft')}
                        disabled={deletingImageId === image.id}
                      >
                        ←
                      </button>
                    )}

                    {index < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveImage(index, index + 1)}
                        className="image-action-btn move-right"
                        title={t('locations.moveRight')}
                        disabled={deletingImageId === image.id}
                      >
                        →
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="image-action-btn remove"
                      title={t('common.delete')}
                      disabled={deletingImageId === image.id}
                    >
                      {deletingImageId === image.id ? (
                        <div className="deleting-spinner" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Upload status */}
                {image.isNew && (
                  <div className="image-status new">
                    {t('locations.newImage')}
                  </div>
                )}

                {/* Deleting indicator */}
                {deletingImageId === image.id && (
                  <div className="image-status deleting">
                    {t('common.deleting') || 'Deleting...'}
                  </div>
                )}

                {/* Order indicator */}
                <div className="image-order">{index + 1}</div>
              </div>

              {/* Alt text input */}
              {showAltText && (
                <div className="image-metadata">
                  <input
                    type="text"
                    placeholder={t('locations.imageDescription')}
                    value={image.alt_text || ''}
                    onChange={(e) => updateAltText(image.id, e.target.value)}
                    className="alt-text-input"
                    disabled={deletingImageId === image.id}
                  />
                </div>
              )}

              {/* Image info */}
              <div className="image-info">
                <div className="image-name" title={image.image_name || image.file?.name}>
                  {image.image_name || image.file?.name || 'Unknown'}
                </div>
                {image.file && (
                  <div className="image-size">
                    {(image.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !canAddMore && (
        <div className="image-upload-empty">
          <Image size={32} />
          <p>{t('locations.noImagesUploaded')}</p>
        </div>
      )}

      {/* Validation messages */}
      {images.length === maxImages && (
        <div className="image-upload-message warning">
          <AlertCircle size={16} />
          {t('locations.maxImagesReached', { max: maxImages })}
        </div>
      )}

      {/* Upload tips */}
      {showTips && (
        <div className="image-upload-tips">
          <h5>{t('locations.imageUploadTips')}</h5>
          <ul>
            <li>• {t('locations.tipSupportedFormats')}</li>
            <li>• {t('locations.tipMaxSize')}</li>
            <li>• {t('locations.tipBestQuality')}</li>
            <li>• {t('locations.tipDescriptiveNames')}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
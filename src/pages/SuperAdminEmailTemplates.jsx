// src/pages/SuperAdminEmailTemplates.jsx
import { Image, Mail, Shield, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import EmailTemplateList from '../components/email/EmailTemplateList';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';


import logger from '../utils/logger';

const SYSTEM_PARTNER_UUID = '11111111-1111-1111-1111-111111111111';

const SuperAdminEmailTemplates = () => {
  const { t } = useTranslation();
  
  // Email banner upload states
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [currentBannerUrl, setCurrentBannerUrl] = useState(null);

  useEffect(() => {
    loadCurrentBanner();
  }, []);

  const loadCurrentBanner = async () => {
    try {
      // Check if email banner exists in storage
      const { data: files, error } = await supabase.storage
        .from('partners')
        .list(SYSTEM_PARTNER_UUID, {
          search: 'email_banner'
        });

      if (error) {
        logger.log('No existing email banner found or error:', error);
        return;
      }

      // Find email banner file
      const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));
      
      if (bannerFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${SYSTEM_PARTNER_UUID}/${bannerFile.name}`);
        
        setCurrentBannerUrl(data.publicUrl);
      }
    } catch (error) {
      logger.error('Error loading current email banner:', error);
    }
  };

  const processImage = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');

      img.onload = () => {
        // Calculate new dimensions (max 800x600, maintaining aspect ratio)
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to process image'));
            }
          },
          'image/png',
          0.9 // Quality setting
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleBannerSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB original)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file size must be less than 10MB');
      return;
    }

    setBannerUploading(true);

    try {
      // Process and compress image
      const processedBlob = await processImage(file);
      
      // Create File object from blob
      const processedFile = new File([processedBlob], 'email_banner.png', {
        type: 'image/png'
      });

      // Create preview URL
      const previewUrl = URL.createObjectURL(processedBlob);
      setBannerPreview(previewUrl);

      // Automatically upload after processing
      await uploadBannerFile(processedFile);

    } catch (error) {
      logger.error('Error processing banner image:', error);
      toast.error('Error processing image. Please try another file.');
      setBannerUploading(false);
    }
  };

  const uploadBannerFile = async (file) => {
    if (!file) return;

    try {
      // Delete existing banner first
      try {
        const { data: existingFiles } = await supabase.storage
          .from('partners')
          .list(SYSTEM_PARTNER_UUID, {
            search: 'email_banner'
          });

        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await supabase.storage
              .from('partners')
              .remove([`${SYSTEM_PARTNER_UUID}/${existingFile.name}`]);
          }
        }
      } catch (deleteError) {
        logger.log('No existing banner to delete or error:', deleteError);
      }

      // Upload new banner
      const fileName = 'email_banner.png';
      const filePath = `${SYSTEM_PARTNER_UUID}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('partners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('partners')
        .getPublicUrl(filePath);

      setCurrentBannerUrl(urlData.publicUrl);
      setBannerPreview(null); // Clear preview since we now have current banner

      toast.success('System email banner uploaded successfully!');

    } catch (error) {
      logger.error('Error uploading email banner:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('row-level security policy')) {
        toast.error('Storage permission error. Please contact support to configure bucket policies.');
      } else if (error.message?.includes('storage')) {
        toast.error('Storage error. Please try again or contact support.');
      } else {
        toast.error('Error uploading email banner. Please try again.');
      }
      
      // Clear preview on error
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
        setBannerPreview(null);
      }
    } finally {
      setBannerUploading(false);
    }
  };

  const handleBannerRemove = async () => {
    if (!currentBannerUrl) return;

    try {
      const { error } = await supabase.storage
        .from('partners')
        .remove([`${SYSTEM_PARTNER_UUID}/email_banner.png`]);

      if (error) throw error;

      setCurrentBannerUrl(null);
      toast.success('System email banner removed successfully!');

    } catch (error) {
      logger.error('Error removing email banner:', error);
      toast.error('Error removing email banner. Please try again.');
    }
  };

  const cancelBannerSelection = () => {
    setBannerUploading(false);
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
    }
  };

  return (
    <div className="superadmin-email-templates-page">
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-header-icon">
            <Shield size={32} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title">
              <Mail size={24} className="mr-2" />
              {t('emailTemplates.systemTemplates') || 'System Email Templates'}
            </h1>
            <p className="page-description">
              {t('emailTemplates.systemTemplatesDescription') || 
               'Manage email templates used for partner invitations and system communications'}
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Email Banner Upload Section */}
        <div className="form-section">
          <h3 className="form-section-title">
            <Image size={20} style={{ marginRight: '0.5rem', display: 'inline' }} />
            {t('settings.systemEmailBanner') || 'System Email Banner'}
          </h3>
          <p className="form-section-description">
            {t('settings.systemEmailBannerDescription') || 
             'Upload a banner image that will appear at the top of system email templates (partner invitations). Recommended size: 800x200px. Supported formats: JPG, PNG, GIF.'}
          </p>

          <div className="banner-upload-section">
            {/* Current Banner Display */}
            {currentBannerUrl && !bannerPreview && (
              <div className="current-banner-container">
                <div className="banner-display-card">
                  <div className="banner-header">
                    <h4 className="banner-section-subtitle">
                      {t('settings.currentBanner') || 'Current Banner'}
                    </h4>
                  </div>
                  <div className="banner-image-container">
                    <img 
                      src={currentBannerUrl} 
                      alt="Current system email banner" 
                      className="banner-image"
                    />
                  </div>
                </div>
                <div className="banner-actions-container">
                  <label 
                    htmlFor="banner-upload-change" 
                    className="banner-btn banner-btn-primary"
                  >
                    <Upload size={16} />
                    {t('settings.changeBanner') || 'Change Banner'}
                  </label>
                  <input
                    id="banner-upload-change"
                    type="file"
                    accept="image/*"
                    onChange={handleBannerSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleBannerRemove}
                    className="banner-btn banner-btn-danger"
                  >
                    <X size={16} />
                    {t('settings.removeBanner') || 'Remove Banner'}
                  </button>
                </div>
              </div>
            )}

            {/* Banner Preview */}
            {bannerPreview && (
              <div className="banner-preview-container">
                <div className="banner-display-card">
                  <div className="banner-header">
                    <h4 className="banner-section-subtitle">
                      {bannerUploading ? 
                        (t('settings.uploadingBanner') || 'Uploading Banner...') : 
                        (t('settings.bannerPreview') || 'Banner Preview')
                      }
                    </h4>
                    {bannerUploading && (
                      <div className="upload-status">
                        <div className="loading-spinner-small"></div>
                        <span className="upload-status-text">
                          {t('settings.processingAndUploading') || 'Processing and uploading...'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="banner-image-container">
                    <img 
                      src={bannerPreview} 
                      alt="Banner preview" 
                      className={`banner-image ${bannerUploading ? 'uploading' : ''}`}
                    />
                  </div>
                </div>
                {!bannerUploading && (
                  <div className="banner-actions-container">
                    <button
                      type="button"
                      onClick={cancelBannerSelection}
                      className="banner-btn banner-btn-secondary"
                    >
                      <X size={16} />
                      {t('common.cancel') || 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Upload Banner Input - First time */}
            {!bannerPreview && !currentBannerUrl && (
              <div className="banner-upload-empty">
                <div className="upload-placeholder">
                  <div className="upload-icon">
                    <Upload size={32} />
                  </div>
                  <div className="upload-text">
                    <h4>{t('settings.uploadSystemEmailBanner') || 'Upload System Email Banner'}</h4>
                    <p>JPG, PNG, GIF up to 10MB</p>
                    <p className="upload-recommendation">Recommended: 800x200px</p>
                  </div>
                </div>
                <div className="banner-actions-container">
                  <label 
                    htmlFor="banner-upload-new" 
                    className="banner-btn banner-btn-primary banner-btn-large"
                  >
                    <Upload size={16} />
                    {t('settings.uploadBanner') || 'Upload Banner'}
                  </label>
                  <input
                    id="banner-upload-new"
                    type="file"
                    accept="image/*"
                    onChange={handleBannerSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Email Template Management Section */}
        <div className="form-section">
          <EmailTemplateList 
            partnerUuid={SYSTEM_PARTNER_UUID}
            mode="superadmin"
          />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminEmailTemplates;
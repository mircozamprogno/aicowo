import { Image, Save, Upload, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Settings = () => {
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const [customerData, setCustomerData] = useState(null);
  const [partnerData, setPartnerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Logo upload states
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  
  // Determine if user is admin partner or regular user
  const isAdminPartner = profile?.role === 'admin';
  
  const [formData, setFormData] = useState({
    first_name: '',
    second_name: '',
    email: '',
    phone: '',
    address: '',
    zip: '',
    city: '',
    country: 'Italy',
    codice_fiscale: '',
    customer_type: 'individual',
    company_name: '',
    piva: '',
    pec: '',
    sdi_code: '',
    website: '',
    billing_email: '',
    billing_phone: '',
    billing_address: '',
    billing_zip: '',
    billing_city: '',
    billing_country: 'Italy',
    notes: '',
    // Partner-specific fields
    partner_type: 'company',
    partner_status: 'active'
  });

  useEffect(() => {
    if (user && profile) {
      if (isAdminPartner) {
        fetchPartnerData();
        loadCurrentLogo();
      } else {
        fetchCustomerData();
      }
    }
  }, [user, profile, isAdminPartner]);

  const loadCurrentLogo = async () => {
    if (!profile?.partner_uuid) return;

    try {
      // Check if logo exists in storage
      const { data: files, error } = await supabase.storage
        .from('partners')
        .list(`${profile.partner_uuid}`, {
          search: 'logo'
        });

      if (error) {
        console.log('No existing logo found or error:', error);
        return;
      }

      // Find logo file (could be logo.png, logo.jpg, etc.)
      const logoFile = files?.find(file => file.name.startsWith('logo.'));
      
      if (logoFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${profile.partner_uuid}/${logoFile.name}`);
        
        setCurrentLogoUrl(data.publicUrl);
      }
    } catch (error) {
      console.error('Error loading current logo:', error);
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

  const handleLogoSelect = async (e) => {
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

    setLogoUploading(true);

    try {
      // Process and compress image
      const processedBlob = await processImage(file);
      
      // Create File object from blob
      const processedFile = new File([processedBlob], 'logo.png', {
        type: 'image/png'
      });

      // Create preview URL
      const previewUrl = URL.createObjectURL(processedBlob);
      setLogoPreview(previewUrl);

      // Automatically upload after processing
      await uploadLogoFile(processedFile);

    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Error processing image. Please try another file.');
      setLogoUploading(false);
    }
  };

  const uploadLogoFile = async (file) => {
    if (!file || !profile?.partner_uuid) return;

    try {
      // Delete existing logo first
      try {
        const { data: existingFiles } = await supabase.storage
          .from('partners')
          .list(`${profile.partner_uuid}`, {
            search: 'logo'
          });

        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await supabase.storage
              .from('partners')
              .remove([`${profile.partner_uuid}/${existingFile.name}`]);
          }
        }
      } catch (deleteError) {
        console.log('No existing logo to delete or error:', deleteError);
      }

      // Upload new logo
      const fileName = 'logo.png';
      const filePath = `${profile.partner_uuid}/${fileName}`;

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

      setCurrentLogoUrl(urlData.publicUrl);
      setLogoPreview(null); // Clear preview since we now have current logo

      toast.success('Logo uploaded successfully!');

    } catch (error) {
      console.error('Error uploading logo:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('row-level security policy')) {
        toast.error('Storage permission error. Please contact support to configure bucket policies.');
      } else if (error.message?.includes('storage')) {
        toast.error('Storage error. Please try again or contact support.');
      } else {
        toast.error('Error uploading logo. Please try again.');
      }
      
      // Clear preview on error
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!profile?.partner_uuid || !currentLogoUrl) return;

    try {
      const { error } = await supabase.storage
        .from('partners')
        .remove([`${profile.partner_uuid}/logo.png`]);

      if (error) throw error;

      setCurrentLogoUrl(null);
      toast.success('Logo removed successfully!');

    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Error removing logo. Please try again.');
    }
  };

  const cancelLogoSelection = () => {
    setLogoUploading(false);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
  };

  const fetchPartnerData = async () => {
    try {
      console.log('Fetching partner data for admin:', profile.partner_uuid);
      
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .single();

      if (error) {
        console.error('Error fetching partner data:', error);
        toast.error(t('messages.errorLoadingPartnerData'));
        return;
      }

      if (data) {
        console.log('Found partner data:', data);
        setPartnerData(data);
        setFormData({
          first_name: data.first_name || '',
          second_name: data.second_name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          zip: data.zip || '',
          city: data.city || '',
          country: data.country || 'Italy',
          codice_fiscale: '', // Partners don't have codice_fiscale in partners table
          customer_type: 'company', // Partners are always companies in settings
          company_name: data.company_name || '',
          piva: data.piva || '',
          pec: data.pec || '',
          sdi_code: '', // Not in partners table
          website: data.website || '',
          billing_email: '', // Not in partners table
          billing_phone: '', // Not in partners table
          billing_address: '', // Not in partners table
          billing_zip: '', // Not in partners table
          billing_city: '', // Not in partners table
          billing_country: 'Italy', // Default
          notes: '', // Not in partners table
          partner_type: data.partner_type || 'company',
          partner_status: data.partner_status || 'active'
        });
      }
    } catch (error) {
      console.error('Error fetching partner data:', error);
      toast.error(t('messages.errorLoadingPartnerData'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerData = async () => {
    try {
      console.log('Fetching customer data for user:', user.id);
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching customer data:', error);
        // If there's an error, we'll create a new customer record
      }

      if (data) {
        console.log('Found existing customer data:', data);
        setCustomerData(data);
        setFormData({
          first_name: data.first_name || '',
          second_name: data.second_name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          address: data.address || '',
          zip: data.zip || '',
          city: data.city || '',
          country: data.country || 'Italy',
          codice_fiscale: data.codice_fiscale || '',
          customer_type: data.customer_type || 'individual',
          company_name: data.company_name || '',
          piva: data.piva || '',
          pec: data.pec || '',
          sdi_code: data.sdi_code || '',
          website: data.website || '',
          billing_email: data.billing_email || '',
          billing_phone: data.billing_phone || '',
          billing_address: data.billing_address || '',
          billing_zip: data.billing_zip || '',
          billing_city: data.billing_city || '',
          billing_country: data.billing_country || 'Italy',
          notes: data.notes || '',
          partner_type: 'company',
          partner_status: 'active'
        });
      } else {
        console.log('No customer data found, will create new record');
        setFormData(prev => ({
          ...prev,
          first_name: profile.first_name || '',
          second_name: profile.last_name || '',
          email: user.email || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast.error(t('messages.errorLoadingCustomerData'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isAdminPartner) {
        // Update partner data
        const partnerUpdateData = {
          first_name: formData.first_name,
          second_name: formData.second_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          zip: formData.zip,
          city: formData.city,
          country: formData.country,
          company_name: formData.company_name,
          piva: formData.piva,
          pec: formData.pec,
          website: formData.website,
          partner_type: formData.partner_type,
          partner_status: formData.partner_status
        };

        const { data, error } = await supabase
          .from('partners')
          .update(partnerUpdateData)
          .eq('id', partnerData.id)
          .select();

        if (error) throw error;

        setPartnerData(data[0]);
        toast.success(t('messages.partnerDataSavedSuccessfully'));
      } else {
        // Update customer data
        let result;
        
        if (customerData) {
          // Update existing customer record
          result = await supabase
            .from('customers')
            .update(formData)
            .eq('id', customerData.id)
            .select();
        } else {
          // Create new customer record
          const newCustomerData = {
            ...formData,
            user_id: user.id,
            partner_uuid: profile.partner_uuid
          };
          
          result = await supabase
            .from('customers')
            .insert([newCustomerData])
            .select();
        }

        const { data, error } = result;

        if (error) throw error;

        setCustomerData(data[0]);
        toast.success(t('messages.customerDataSavedSuccessfully'));
      }
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error(error.message || (isAdminPartner ? t('messages.errorSavingPartnerData') : t('messages.errorSavingCustomerData')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="settings-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-header-content">
          <h1 className="settings-title">
            <User size={24} className="mr-2" />
            {t('settings.title')}
          </h1>
          <p className="settings-description">
            {isAdminPartner 
              ? t('settings.managePartnerData')
              : t('settings.manageCustomerData')
            }
          </p>
        </div>
      </div>

      <div className="settings-content">
        <form onSubmit={handleSubmit} className="settings-form">
          
          {/* Logo Upload Section - Only for Partners */}
          {isAdminPartner && (
            <div className="form-section">
              <h3 className="form-section-title">
                <Image size={20} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Company Logo
              </h3>
              <p className="form-section-description">
                Upload your company logo. It will be used in contracts and other documents. 
                Recommended size: 800x600px or smaller. Supported formats: JPG, PNG, GIF.
              </p>

              <div className="logo-upload-section">
                {/* Current Logo Display */}
                {currentLogoUrl && !logoPreview && (
                  <div className="current-logo">
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '500' }}>
                      {t('settings.currentLogo') || 'Current Logo:'}
                    </h4>
                    <div className="logo-display">
                      <img 
                        src={currentLogoUrl} 
                        alt="Current company logo" 
                        style={{
                          maxWidth: '200px',
                          maxHeight: '150px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          objectFit: 'contain'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="logo-action-btn remove-logo-btn"
                        style={{
                          marginTop: '0.5rem',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          minWidth: '120px',
                          height: '38px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                      >
                        <X size={16} />
                        {t('settings.removeLogo') || 'Remove Logo'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Logo Preview */}
                {logoPreview && (
                  <div className="logo-preview">
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '500' }}>
                      {logoUploading ? (t('settings.uploadingLogo') || 'Uploading Logo...') : (t('settings.logoPreview') || 'Logo Preview:')}
                    </h4>
                    <div className="logo-display">
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        style={{
                          maxWidth: '200px',
                          maxHeight: '150px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          objectFit: 'contain',
                          opacity: logoUploading ? 0.6 : 1
                        }}
                      />
                      {logoUploading && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          marginTop: '0.5rem',
                          color: '#6b7280',
                          fontSize: '0.875rem'
                        }}>
                          <div className="loading-spinner-small"></div>
                          {t('settings.processingAndUploading') || 'Processing and uploading...'}
                        </div>
                      )}
                      {!logoUploading && (
                        <button
                          type="button"
                          onClick={cancelLogoSelection}
                          className="logo-action-btn cancel-logo-btn"
                          style={{
                            marginTop: '0.5rem',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            minWidth: '120px',
                            height: '38px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
                        >
                          <X size={16} />
                          {t('common.cancel') || 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Logo Upload Input */}
                {!logoPreview && (
                  <div className="logo-upload-input">
                    <label 
                      htmlFor="logo-upload" 
                      className="logo-action-btn logo-upload-label"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        minWidth: '120px',
                        height: '38px'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#4338ca'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#4f46e5'}
                    >
                      <Upload size={16} />
                      {currentLogoUrl ? (t('settings.changeLogo') || 'Change Logo') : (t('settings.uploadLogo') || 'Upload Logo')}
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personal Information Section */}
          <div className="form-section">
            <h3 className="form-section-title">
              {isAdminPartner ? t('customers.partnerInformation') : t('customers.personalInformation')}
            </h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name" className="form-label">
                  {t('customers.firstName')} *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  className="form-input"
                  placeholder={t('placeholders.firstNamePlaceholder')}
                  value={formData.first_name}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="second_name" className="form-label">
                  {t('customers.secondName')} {!isAdminPartner && '*'}
                </label>
                <input
                  id="second_name"
                  name="second_name"
                  type="text"
                  required={!isAdminPartner}
                  className="form-input"
                  placeholder={t('placeholders.secondNamePlaceholder')}
                  value={formData.second_name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  {t('auth.email')} *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="form-input"
                  placeholder={t('placeholders.emailPlaceholder')}
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  {t('customers.phone')}
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-input"
                  placeholder={t('placeholders.phonePlaceholder')}
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Codice Fiscale only for users, not partners */}
            {!isAdminPartner && (
              <div className="form-group">
                <label htmlFor="codice_fiscale" className="form-label">
                  {t('customers.codiceFiscale')} *
                </label>
                <input
                  id="codice_fiscale"
                  name="codice_fiscale"
                  type="text"
                  required
                  className="form-input"
                  placeholder={t('placeholders.codiceFiscalePlaceholder')}
                  value={formData.codice_fiscale}
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Customer type only for users */}
            {!isAdminPartner && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customer_type" className="form-label">
                    {t('customers.type')} *
                  </label>
                  <select
                    id="customer_type"
                    name="customer_type"
                    required
                    className="form-select"
                    value={formData.customer_type}
                    onChange={handleChange}
                  >
                    <option value="individual">{t('customers.individual')}</option>
                    <option value="company">{t('customers.company')}</option>
                    <option value="organization">{t('customers.organization')}</option>
                  </select>
                </div>
              </div>
            )}

            {/* Partner type and status for admin partners */}
            {isAdminPartner && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="partner_type" className="form-label">
                    {t('partners.type')} *
                  </label>
                  <select
                    id="partner_type"
                    name="partner_type"
                    required
                    className="form-select"
                    value={formData.partner_type}
                    onChange={handleChange}
                  >
                    <option value="company">{t('partners.company')}</option>
                    <option value="individual">{t('partners.individual')}</option>
                    <option value="organization">{t('partners.organization')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="partner_status" className="form-label">
                    {t('partners.status')} *
                  </label>
                  <select
                    id="partner_status"
                    name="partner_status"
                    required
                    className="form-select"
                    value={formData.partner_status}
                    onChange={handleChange}
                  >
                    <option value="active">{t('partners.active')}</option>
                    <option value="inactive">{t('partners.inactive')}</option>
                    <option value="pending">{t('partners.pending')}</option>
                    <option value="suspended">{t('partners.suspended')}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Address Information */}
          <div className="form-section">
            <h3 className="form-section-title">{t('customers.addressInformation')}</h3>
            
            <div className="form-group">
              <label htmlFor="address" className="form-label">
                {t('customers.address')} {!isAdminPartner && '*'}
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required={!isAdminPartner}
                className="form-input"
                placeholder={t('placeholders.addressPlaceholder')}
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="zip" className="form-label">
                  {t('customers.zip')} {!isAdminPartner && '*'}
                </label>
                <input
                  id="zip"
                  name="zip"
                  type="text"
                  required={!isAdminPartner}
                  className="form-input"
                  placeholder={t('placeholders.zipPlaceholder')}
                  value={formData.zip}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="city" className="form-label">
                  {t('customers.city')} {!isAdminPartner && '*'}
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required={!isAdminPartner}
                  className="form-input"
                  placeholder={t('placeholders.cityPlaceholder')}
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="country" className="form-label">
                  {t('customers.country')} {!isAdminPartner && '*'}
                </label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  required={!isAdminPartner}
                  className="form-input"
                  placeholder={t('placeholders.countryPlaceholder')}
                  value={formData.country}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Business Information - Show for companies or always for partners */}
          {(isAdminPartner || formData.customer_type === 'company') && (
            <div className="form-section">
              <h3 className="form-section-title">
                {isAdminPartner ? t('customers.businessInformation') : t('customers.businessInformation')}
              </h3>
              
              <div className="form-group">
                <label htmlFor="company_name" className="form-label">
                  {t('customers.companyName')} *
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  required
                  className="form-input"
                  placeholder={t('placeholders.companyNamePlaceholder')}
                  value={formData.company_name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="piva" className="form-label">
                    {t('customers.piva')}
                  </label>
                  <input
                    id="piva"
                    name="piva"
                    type="text"
                    className="form-input"
                    placeholder={t('placeholders.pivaPlaceholder')}
                    value={formData.piva}
                    onChange={handleChange}
                  />
                </div>
                {!isAdminPartner && (
                  <div className="form-group">
                    <label htmlFor="sdi_code" className="form-label">
                      {t('customers.sdiCode')}
                    </label>
                    <input
                      id="sdi_code"
                      name="sdi_code"
                      type="text"
                      className="form-input"
                      placeholder={t('placeholders.sdiCodePlaceholder')}
                      value={formData.sdi_code}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pec" className="form-label">
                    {t('customers.pec')}
                  </label>
                  <input
                    id="pec"
                    name="pec"
                    type="email"
                    className="form-input"
                    placeholder={t('placeholders.pecPlaceholder')}
                    value={formData.pec}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="website" className="form-label">
                    {t('customers.website')}
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    className="form-input"
                    placeholder={t('placeholders.websitePlaceholder')}
                    value={formData.website}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Billing Information - Only show for users with company type */}
          {!isAdminPartner && formData.customer_type === 'company' && (
            <div className="form-section">
              <h3 className="form-section-title">{t('customers.billingInformation')}</h3>
              <p className="form-section-description">
                {t('settings.billingInfoDescription')}
              </p>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="billing_email" className="form-label">
                    {t('customers.billingEmail')}
                  </label>
                  <input
                    id="billing_email"
                    name="billing_email"
                    type="email"
                    className="form-input"
                    placeholder={t('placeholders.billingEmailPlaceholder')}
                    value={formData.billing_email}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="billing_phone" className="form-label">
                    {t('customers.billingPhone')}
                  </label>
                  <input
                    id="billing_phone"
                    name="billing_phone"
                    type="tel"
                    className="form-input"
                    placeholder={t('placeholders.billingPhonePlaceholder')}
                    value={formData.billing_phone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="billing_address" className="form-label">
                  {t('customers.billingAddress')}
                </label>
                <textarea
                  id="billing_address"
                  name="billing_address"
                  rows={2}
                  className="form-textarea"
                  placeholder={t('placeholders.billingAddressPlaceholder')}
                  value={formData.billing_address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="billing_zip" className="form-label">
                    {t('customers.billingZip')}
                  </label>
                  <input
                    id="billing_zip"
                    name="billing_zip"
                    type="text"
                    className="form-input"
                    placeholder={t('placeholders.billingZipPlaceholder')}
                    value={formData.billing_zip}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="billing_city" className="form-label">
                    {t('customers.billingCity')}
                  </label>
                  <input
                    id="billing_city"
                    name="billing_city"
                    type="text"
                    className="form-input"
                    placeholder={t('placeholders.billingCityPlaceholder')}
                    value={formData.billing_city}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="billing_country" className="form-label">
                    {t('customers.billingCountry')}
                  </label>
                  <input
                    id="billing_country"
                    name="billing_country"
                    type="text"
                    className="form-input"
                    placeholder={t('placeholders.billingCountryPlaceholder')}
                    value={formData.billing_country}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button
              type="submit"
              className="save-settings-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  {t('common.saving')}...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {t('settings.saveSettings')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
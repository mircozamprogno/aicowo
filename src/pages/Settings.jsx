// src/pages/Settings.jsx
import { AlertTriangle, Calendar, CheckCircle, Clock, DollarSign, Download, FileText, Filter, Globe, Image, Mail, MapPin, Save, Upload, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import OperatingScheduleManager from '../components/calendar/OperatingScheduleManager';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import EmailTemplateList from '../components/email/EmailTemplateList';
import LocationsList from '../components/partners/LocationsList';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { generateInvoicePDF } from '../services/pdfGenerator';
import { supabase } from '../services/supabase';
import '../styles/components/operating-calendar.css';
import '../styles/pages/partner-billing-history.css';

import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';

const Settings = () => {
  const { profile, user } = useAuth();
  const { t, language, changeLanguage } = useTranslation();
  const [customerData, setCustomerData] = useState(null);
  const [partnerData, setPartnerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Logo upload states
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  
  // Location management states
  const [showLocations, setShowLocations] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Email banner upload states
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [currentBannerUrl, setCurrentBannerUrl] = useState(null);
  
  // Billing history states
  const [payments, setPayments] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [billingStats, setBillingStats] = useState({
    total: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    totalAmount: 0
  });
  
  const isAdminPartner = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';
  
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
    structure_name: '',
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
    partner_type: 'company',
    partner_status: 'active',
    preferred_language: language || 'it'
  });

  useEffect(() => {
    if (user && profile) {
      if (isAdminPartner || isSuperAdmin) {
        fetchPartnerData();
        loadCurrentLogo();
        loadCurrentBanner();
        fetchPayments();
      } else {
        fetchCustomerData();
      }
    }
  }, [user, profile, isAdminPartner, isSuperAdmin]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_payments')
        .select(`
          *,
          partners_contracts (
            contract_number,
            billing_frequency,
            partners_pricing_plans (
              plan_name
            )
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .order('payment_period_start', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
      calculateBillingStats(data || []);
    } catch (error) {
      logger.error('Error fetching payments:', error);
    }
  };

  const calculateBillingStats = (paymentsData) => {
    const stats = {
      total: paymentsData.length,
      pending: 0,
      paid: 0,
      overdue: 0,
      totalAmount: 0
    };

    paymentsData.forEach(payment => {
      stats.totalAmount += Number(payment.amount);
      
      if (payment.payment_status === 'paid') {
        stats.paid++;
      } else if (payment.payment_status === 'pending' && payment.is_overdue) {
        stats.overdue++;
      } else if (payment.payment_status === 'pending') {
        stats.pending++;
      }
    });

    setBillingStats(stats);
  };

  const handleDownloadInvoice = async (payment) => {
    setDownloadingId(payment.id);
    
    try {
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .single();

      if (partnerError) throw partnerError;

      const logoUrl = partnerData?.logo_url || null;
      await generateInvoicePDF(payment, partnerData, logoUrl, t);

      toast.success(t('messages.pdfGenerated') || 'PDF generated successfully');
    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      toast.error(t('messages.errorGeneratingPdf') || 'Error generating PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status, isOverdue) => {
    if (status === 'paid') return 'status-paid';
    if (status === 'pending' && isOverdue) return 'status-overdue';
    if (status === 'pending') return 'status-pending';
    if (status === 'failed') return 'status-failed';
    if (status === 'cancelled') return 'status-cancelled';
    return 'status-inactive';
  };

  const getStatusLabel = (status, isOverdue) => {
    if (status === 'paid') return t('partnerBilling.paid') || 'Pagato';
    if (status === 'pending' && isOverdue) return t('partnerBilling.overdue') || 'Scaduto';
    if (status === 'pending') return t('partnerBilling.pending') || 'In Attesa';
    if (status === 'failed') return t('partnerBilling.failed') || 'Fallito';
    if (status === 'cancelled') return t('partnerBilling.cancelled') || 'Annullato';
    return status;
  };

  const getOverLimitBadge = (payment) => {
    if (payment.is_over_limit) {
      return (
        <span className="over-limit-badge" title={`${payment.active_users_count} / ${payment.plan_active_users_limit}`}>
          {t('partnerBilling.overLimit') || 'Oltre Limite'}
        </span>
      );
    }
    return null;
  };

  const filteredPayments = payments.filter(payment => {
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'overdue' ? payment.is_overdue && payment.payment_status === 'pending' : payment.payment_status === filterStatus);
    
    const yearMatch = filterYear === 'all' || 
      new Date(payment.payment_period_start).getFullYear().toString() === filterYear;
    
    return statusMatch && yearMatch;
  });

  const uniqueYears = [...new Set(payments.map(p => 
    new Date(p.payment_period_start).getFullYear().toString()
  ))].sort((a, b) => b - a);

  const yearOptions = [
    { value: 'all', label: t('common.all') || 'Tutti' },
    ...uniqueYears.map(year => ({ value: year, label: year }))
  ];

  const statusOptions = [
    { value: 'all', label: t('common.all') || 'Tutti' },
    { value: 'pending', label: t('partnerBilling.pending') || 'In Attesa' },
    { value: 'paid', label: t('partnerBilling.paid') || 'Pagato' },
    { value: 'overdue', label: t('partnerBilling.overdue') || 'Scaduto' },
    { value: 'failed', label: t('partnerBilling.failed') || 'Fallito' }
  ];

  const loadCurrentLogo = async () => {
    if (!profile?.partner_uuid) return;

    try {
      const { data: files, error } = await supabase.storage
        .from('partners')
        .list(`${profile.partner_uuid}`, {
          search: 'logo'
        });

      if (error) {
        logger.log('No existing logo found or error:', error);
        return;
      }

      const logoFile = files?.find(file => file.name.startsWith('logo.'));
      
      if (logoFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${profile.partner_uuid}/${logoFile.name}`);
        
        setCurrentLogoUrl(data.publicUrl);
      }
    } catch (error) {
      logger.error('Error loading current logo:', error);
    }
  };

  const loadCurrentBanner = async () => {
    if (!profile?.partner_uuid) return;

    try {
      const { data: files, error } = await supabase.storage
        .from('partners')
        .list(`${profile.partner_uuid}`, {
          search: 'email_banner'
        });

      if (error) {
        logger.log('No existing email banner found or error:', error);
        return;
      }

      const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));
      
      if (bannerFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${profile.partner_uuid}/${bannerFile.name}`);
        
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

        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to process image'));
            }
          },
          'image/png',
          0.9
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleLogoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file size must be less than 10MB');
      return;
    }

    setLogoUploading(true);

    try {
      const processedBlob = await processImage(file);
      const processedFile = new File([processedBlob], 'logo.png', {
        type: 'image/png'
      });

      const previewUrl = URL.createObjectURL(processedBlob);
      setLogoPreview(previewUrl);

      await uploadLogoFile(processedFile);

    } catch (error) {
      logger.error('Error processing image:', error);
      toast.error('Error processing image. Please try another file.');
      setLogoUploading(false);
    }
  };

  const uploadLogoFile = async (file) => {
    if (!file || !profile?.partner_uuid) return;

    try {
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
        logger.log('No existing logo to delete or error:', deleteError);
      }

      const fileName = 'logo.png';
      const filePath = `${profile.partner_uuid}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('partners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('partners')
        .getPublicUrl(filePath);

      setCurrentLogoUrl(urlData.publicUrl);
      setLogoPreview(null);

      toast.success('Logo uploaded successfully!');

    } catch (error) {
      logger.error('Error uploading logo:', error);
      
      if (error.message?.includes('row-level security policy')) {
        toast.error('Storage permission error. Please contact support to configure bucket policies.');
      } else if (error.message?.includes('storage')) {
        toast.error('Storage error. Please try again or contact support.');
      } else {
        toast.error('Error uploading logo. Please try again.');
      }
      
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
      logger.error('Error removing logo:', error);
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

  const handleBannerSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file size must be less than 10MB');
      return;
    }

    setBannerUploading(true);

    try {
      const processedBlob = await processImage(file);
      const processedFile = new File([processedBlob], 'email_banner.png', {
        type: 'image/png'
      });

      const previewUrl = URL.createObjectURL(processedBlob);
      setBannerPreview(previewUrl);

      await uploadBannerFile(processedFile);

    } catch (error) {
      logger.error('Error processing banner image:', error);
      toast.error('Error processing image. Please try another file.');
      setBannerUploading(false);
    }
  };

  const uploadBannerFile = async (file) => {
    if (!file || !profile?.partner_uuid) return;

    try {
      try {
        const { data: existingFiles } = await supabase.storage
          .from('partners')
          .list(`${profile.partner_uuid}`, {
            search: 'email_banner'
          });

        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await supabase.storage
              .from('partners')
              .remove([`${profile.partner_uuid}/${existingFile.name}`]);
          }
        }
      } catch (deleteError) {
        logger.log('No existing banner to delete or error:', deleteError);
      }

      const fileName = 'email_banner.png';
      const filePath = `${profile.partner_uuid}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('partners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('partners')
        .getPublicUrl(filePath);

      setCurrentBannerUrl(urlData.publicUrl);
      setBannerPreview(null);

      toast.success('Email banner uploaded successfully!');

    } catch (error) {
      logger.error('Error uploading email banner:', error);
      
      if (error.message?.includes('row-level security policy')) {
        toast.error('Storage permission error. Please contact support to configure bucket policies.');
      } else if (error.message?.includes('storage')) {
        toast.error('Storage error. Please try again or contact support.');
      } else {
        toast.error('Error uploading email banner. Please try again.');
      }
      
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
        setBannerPreview(null);
      }
    } finally {
      setBannerUploading(false);
    }
  };

  const handleBannerRemove = async () => {
    if (!profile?.partner_uuid || !currentBannerUrl) return;

    try {
      const { error } = await supabase.storage
        .from('partners')
        .remove([`${profile.partner_uuid}/email_banner.png`]);

      if (error) throw error;

      setCurrentBannerUrl(null);
      toast.success('Email banner removed successfully!');

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

  const fetchPartnerData = async () => {
    try {
      logger.log('Fetching partner data for admin:', profile.partner_uuid);
      
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .single();

      if (error) {
        logger.error('Error fetching partner data:', error);
        toast.error(t('messages.errorLoadingPartnerData'));
        return;
      }

      if (data) {
        logger.log('Found partner data:', data);
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
          codice_fiscale: '',
          customer_type: 'company',
          company_name: data.company_name || '',
          structure_name: data.structure_name || '',
          piva: data.piva || '',
          pec: data.pec || '',
          sdi_code: '',
          website: data.website || '',
          billing_email: '',
          billing_phone: '',
          billing_address: '',
          billing_zip: '',
          billing_city: '',
          billing_country: 'Italy',
          notes: '',
          partner_type: data.partner_type || 'company',
          partner_status: data.partner_status || 'active',
          preferred_language: language || 'it'
        });
      }
    } catch (error) {
      logger.error('Error fetching partner data:', error);
      toast.error(t('messages.errorLoadingPartnerData'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerData = async () => {
    try {
      logger.log('Fetching customer data for user:', user.id);
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching customer data:', error);
      }

      if (data) {
        logger.log('Found existing customer data:', data);
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
          partner_status: 'active',
          preferred_language: language || 'it'
        });
      } else {
        logger.log('No customer data found, will create new record');
        setFormData(prev => ({
          ...prev,
          first_name: profile.first_name || '',
          second_name: profile.last_name || '',
          email: user.email || '',
          preferred_language: language || 'it'
        }));
      }
    } catch (error) {
      logger.error('Error fetching customer data:', error);
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

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setFormData(prev => ({
      ...prev,
      preferred_language: newLanguage
    }));
    changeLanguage(newLanguage);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isAdminPartner || isSuperAdmin) {
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
          structure_name: formData.structure_name,
          piva: formData.piva,
          pec: formData.pec,
          website: formData.website,
          partner_type: formData.partner_type,
          partner_status: formData.partner_status
        };

        const changes = {};
        Object.keys(partnerUpdateData).forEach(key => {
          if (partnerData[key] !== partnerUpdateData[key]) {
            changes[key] = {
              old: partnerData[key] || null,
              new: partnerUpdateData[key] || null
            };
          }
        });

        const { data, error } = await supabase
          .from('partners')
          .update(partnerUpdateData)
          .eq('id', partnerData.id)
          .select();

        if (error) throw error;

        setPartnerData(data[0]);

        if (Object.keys(changes).length > 0) {
          await logActivity({
            action_category: ACTIVITY_CATEGORIES.USER,
            action_type: ACTIVITY_ACTIONS.UPDATED,
            entity_id: partnerData.id,
            entity_type: 'partner',
            description: `Partner profile updated: ${formData.company_name || formData.first_name}`,
            metadata: {
              partner_name: formData.company_name || `${formData.first_name} ${formData.second_name}`,
              partner_type: formData.partner_type,
              changes: changes
            }
          });
        }

        toast.success(t('messages.partnerDataSavedSuccessfully'));
      } else {
        let result;
        
        if (customerData) {
          const changes = {};
          Object.keys(formData).forEach(key => {
            if (customerData[key] !== formData[key]) {
              changes[key] = {
                old: customerData[key] || null,
                new: formData[key] || null
              };
            }
          });

          result = await supabase
            .from('customers')
            .update(formData)
            .eq('id', customerData.id)
            .select();

          const { data, error } = result;
          if (error) throw error;

          setCustomerData(data[0]);

          if (Object.keys(changes).length > 0) {
            await logActivity({
              action_category: ACTIVITY_CATEGORIES.CUSTOMER,
              action_type: ACTIVITY_ACTIONS.UPDATED,
              entity_id: customerData.id,
              entity_type: 'customer',
              description: `Customer profile updated: ${formData.first_name} ${formData.second_name}`,
              metadata: {
                customer_name: `${formData.first_name} ${formData.second_name}`,
                customer_type: formData.customer_type,
                customer_email: formData.email,
                changes: changes
              }
            });
          }
        } else {
          const newCustomerData = {
            ...formData,
            user_id: user.id,
            partner_uuid: profile.partner_uuid
          };
          
          result = await supabase
            .from('customers')
            .insert([newCustomerData])
            .select();

          const { data, error } = result;
          if (error) throw error;

          setCustomerData(data[0]);

          await logActivity({
            action_category: ACTIVITY_CATEGORIES.CUSTOMER,
            action_type: ACTIVITY_ACTIONS.CREATED,
            entity_id: data[0].id,
            entity_type: 'customer',
            description: `Customer profile created: ${formData.first_name} ${formData.second_name}`,
            metadata: {
              customer_name: `${formData.first_name} ${formData.second_name}`,
              customer_type: formData.customer_type,
              customer_email: formData.email,
              created_data: newCustomerData
            }
          });
        }

        toast.success(t('messages.customerDataSavedSuccessfully'));
      }
    } catch (error) {
      logger.error('Error saving data:', error);
      toast.error(error.message || (isAdminPartner ? t('messages.errorSavingPartnerData') : t('messages.errorSavingCustomerData')));
    } finally {
      setSaving(false);
    }
  };

  const handleLocationsModalClose = () => {
    setShowLocations(false);
  };

  const languageOptions = [
    { value: 'it', label: 'Italiano' },
    { value: 'en', label: 'English' }
  ];

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
            {isAdminPartner || isSuperAdmin
              ? t('settings.managePartnerData')
              : t('settings.manageCustomerData')
            }
          </p>
        </div>
      </div>

      {(isAdminPartner || isSuperAdmin) && (
        <div className="settings-tabs">
          <div className="settings-tabs-nav">
            <button
              type="button"
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={20} />
              {t('settings.profileSettings') || 'Profile Settings'}
            </button>
            <button
              type="button"
              className={`settings-tab ${activeTab === 'locations' ? 'active' : ''}`}
              onClick={() => setActiveTab('locations')}
            >
              <MapPin size={20} />
              {t('locations.locations') || 'Locations'}
            </button>
            <button
              type="button"
              className={`settings-tab ${activeTab === 'email-templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('email-templates')}
            >
              <Mail size={20} />
              {t('settings.emailTemplates') || 'Email Templates'}
            </button>
            {isAdminPartner && (
              <button
                type="button"
                className={`settings-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                <Calendar size={20} />
                {t('settings.operatingCalendar') || 'Operating Calendar'}
              </button>
            )}
            <button
              type="button"
              className={`settings-tab ${activeTab === 'invoices' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              <FileText size={20} />
              {t('settings.invoices') || 'Fatture'}
            </button>
          </div>
        </div>
      )}

      <div className="settings-content">
        {activeTab === 'profile' && (
          <form onSubmit={handleSubmit} className="settings-form">
            
            {(isAdminPartner || isSuperAdmin) && (
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
                  {currentLogoUrl && !logoPreview && (
                    <div className="current-logo-container">
                      <div className="logo-display-card">
                        <div className="logo-header">
                          <h4 className="logo-section-subtitle">
                            {t('settings.currentLogo') || 'Current Logo'}
                          </h4>
                        </div>
                        <div className="logo-image-container">
                          <img 
                            src={currentLogoUrl} 
                            alt="Current company logo" 
                            className="logo-image"
                          />
                        </div>
                      </div>
                      <div className="logo-actions-container">
                        <label 
                          htmlFor="logo-upload-change" 
                          className="logo-btn logo-btn-primary"
                        >
                          <Upload size={16} />
                          {t('settings.changeLogo') || 'Change Logo'}
                        </label>
                        <input
                          id="logo-upload-change"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          className="logo-btn logo-btn-danger"
                        >
                          <X size={16} />
                          {t('settings.removeLogo') || 'Remove Logo'}
                        </button>
                      </div>
                    </div>
                  )}

                  {logoPreview && (
                    <div className="logo-preview-container">
                      <div className="logo-display-card">
                        <div className="logo-header">
                          <h4 className="logo-section-subtitle">
                            {logoUploading ? 
                              (t('settings.uploadingLogo') || 'Uploading Logo...') : 
                              (t('settings.logoPreview') || 'Logo Preview')
                            }
                          </h4>
                          {logoUploading && (
                            <div className="upload-status">
                              <div className="loading-spinner-small"></div>
                              <span className="upload-status-text">
                                {t('settings.processingAndUploading') || 'Processing and uploading...'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="logo-image-container">
                          <img 
                            src={logoPreview} 
                            alt="Logo preview" 
                            className={`logo-image ${logoUploading ? 'uploading' : ''}`}
                          />
                        </div>
                      </div>
                      {!logoUploading && (
                        <div className="logo-actions-container">
                          <button
                            type="button"
                            onClick={cancelLogoSelection}
                            className="logo-btn logo-btn-secondary"
                          >
                            <X size={16} />
                            {t('common.cancel') || 'Cancel'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!logoPreview && !currentLogoUrl && (
                    <div className="logo-upload-empty">
                      <div className="upload-placeholder">
                        <div className="upload-icon">
                          <Upload size={32} />
                        </div>
                        <div className="upload-text">
                          <h4>{t('settings.uploadLogo') || 'Upload Company Logo'}</h4>
                          <p>JPG, PNG, GIF up to 10MB</p>
                        </div>
                      </div>
                      <div className="logo-actions-container">
                        <label 
                          htmlFor="logo-upload-new" 
                          className="logo-btn logo-btn-primary logo-btn-large"
                        >
                          <Upload size={16} />
                          {t('settings.uploadLogo') || 'Upload Logo'}
                        </label>
                        <input
                          id="logo-upload-new"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-section">
              <h3 className="form-section-title">
                {(isAdminPartner || isSuperAdmin) ? t('customers.partnerInformation') : t('customers.personalInformation')}
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
                    {t('customers.secondName')} {!(isAdminPartner || isSuperAdmin) && '*'}
                  </label>
                  <input
                    id="second_name"
                    name="second_name"
                    type="text"
                    required={!(isAdminPartner || isSuperAdmin)}
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
                    className="form-input form-input-readonly"
                    placeholder={t('placeholders.emailPlaceholder')}
                    value={formData.email}
                    onChange={handleChange}
                    readOnly   
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

              <div className="form-group">
                <label htmlFor="preferred_language" className="form-label">
                  <Globe size={16} style={{ marginRight: '0.25rem', display: 'inline', verticalAlign: 'middle' }} />
                  {t('settings.language') || 'Language'}
                </label>
                <Select
                  name="preferred_language"
                  value={formData.preferred_language}
                  onChange={handleLanguageChange}
                  options={languageOptions}
                  placeholder={t('settings.selectLanguage') || 'Select language'}
                />
              </div>

              {!(isAdminPartner || isSuperAdmin) && (
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

              {!(isAdminPartner || isSuperAdmin) && (
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
                      <option value="freelancer">{t('customers.freelancer')}</option>
                      <option value="entrepeneur">{t('customers.entrepeneur')}</option>
                      <option value="employee">{t('customers.employee')}</option>
                      <option value="tourist">{t('customers.tourist')}</option>
                      <option value="student">{t('customers.student')}</option>
                    </select>
                  </div>
                </div>
              )}

              {isSuperAdmin && (
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
                      <option value="individual">{t('partners.individual')}</option>
                      <option value="freelancer">{t('partners.freelancer')}</option>
                      <option value="entrepeneur">{t('partners.entrepeneur')}</option>
                      <option value="employee">{t('partners.employee')}</option>
                      <option value="tourist">{t('partners.tourist')}</option>
                      <option value="student">{t('partners.student')}</option>
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

            <div className="form-section">
              <h3 className="form-section-title">{t('customers.addressInformation')}</h3>
              
              <div className="form-group">
                <label htmlFor="address" className="form-label">
                  {t('customers.address')} {!(isAdminPartner || isSuperAdmin) && '*'}
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required={!(isAdminPartner || isSuperAdmin)}
                  className="form-input"
                  placeholder={t('placeholders.addressPlaceholder')}
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="zip" className="form-label">
                    {t('customers.zip')} {!(isAdminPartner || isSuperAdmin) && '*'}
                  </label>
                  <input
                    id="zip"
                    name="zip"
                    type="text"
                    required={!(isAdminPartner || isSuperAdmin)}
                    className="form-input"
                    placeholder={t('placeholders.zipPlaceholder')}
                    value={formData.zip}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="city" className="form-label">
                    {t('customers.city')} {!(isAdminPartner || isSuperAdmin) && '*'}
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    required={!(isAdminPartner || isSuperAdmin)}
                    className="form-input"
                    placeholder={t('placeholders.cityPlaceholder')}
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="country" className="form-label">
                    {t('customers.country')} {!(isAdminPartner || isSuperAdmin) && '*'}
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    required={!(isAdminPartner || isSuperAdmin)}
                    className="form-input"
                    placeholder={t('placeholders.countryPlaceholder')}
                    value={formData.country}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {((isAdminPartner || isSuperAdmin) || formData.customer_type === 'company') && (
              <div className="form-section">
                <h3 className="form-section-title">
                  {(isAdminPartner || isSuperAdmin) ? t('customers.businessInformation') : t('customers.businessInformation')}
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

                <div className="form-group">
                  <label htmlFor="structure_name" className="form-label">
                    {t('customers.structureName')}
                  </label>
                  <input
                    id="structure_name"
                    name="structure_name"
                    type="text"
                    className="form-input"
                    placeholder={t('placeholders.structureNamePlaceholder')}
                    value={formData.structure_name}
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
                  {!(isAdminPartner || isSuperAdmin) && (
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

            {!(isAdminPartner || isSuperAdmin) && formData.customer_type === 'company' && (
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
        )}

        {activeTab === 'locations' && (isAdminPartner || isSuperAdmin) && (
          <div className="locations-tab-content">
            <div className="locations-tab-header">
              <h3 className="locations-tab-title">
                <MapPin size={20} />
                {t('locations.locationsFor')} {partnerData?.company_name || partnerData?.first_name}
              </h3>
              <p className="locations-tab-description">
                {t('locations.manageWorkspacesAndMeetingRooms')}
              </p>
            </div>
            <LocationsList
              partner={partnerData}
              isOpen={true}
              onClose={handleLocationsModalClose}
              embedded={true}
            />
          </div>
        )}

        {activeTab === 'email-templates' && (isAdminPartner || isSuperAdmin) && (
          <div className="email-templates-tab-content">
            <div className="email-templates-tab-header">
              <h3 className="email-templates-tab-title">
                <Mail size={20} />
                {t('settings.emailTemplateCustomization') || 'Email Template Customization'}
              </h3>
              <p className="email-templates-tab-description">
                {t('settings.customizeEmailBanner') || 'Customize the banner and content that appears in your email templates'}
              </p>
            </div>

            <div className="email-templates-content">
              <div className="form-section">
                <h3 className="form-section-title">
                  <Image size={20} style={{ marginRight: '0.5rem', display: 'inline' }} />
                  {t('settings.emailBanner') || 'Email Banner'}
                </h3>
                <p className="form-section-description">
                  {t('settings.emailBannerDescription') || 'Upload a banner image that will appear at the top of your email templates. Recommended size: 800x200px. Supported formats: JPG, PNG, GIF.'}
                </p>

                <div className="banner-upload-section">
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
                            alt="Current email banner" 
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

                  {!bannerPreview && !currentBannerUrl && (
                    <div className="banner-upload-empty">
                      <div className="upload-placeholder">
                        <div className="upload-icon">
                          <Upload size={32} />
                        </div>
                        <div className="upload-text">
                          <h4>{t('settings.uploadEmailBanner') || 'Upload Email Banner'}</h4>
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

              <div className="form-section">
                <EmailTemplateList partnerUuid={profile.partner_uuid} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && isAdminPartner && (
          <div className="calendar-tab-content">
            <div className="calendar-tab-header">
              <h3 className="calendar-tab-title">
                <Calendar size={20} />
                {t('settings.manageOperatingCalendar') || 'Manage Operating Calendar'}
              </h3>
              <p className="calendar-tab-description">
                {t('settings.operatingCalendarDescription') || 'Configure when your locations and resources are available for booking'}
              </p>
            </div>
            <OperatingScheduleManager />
          </div>
        )}

        {activeTab === 'invoices' && (isAdminPartner || isSuperAdmin) && (
          <div className="partner-billing-history-page" style={{ padding: 0, background: 'transparent' }}>
            <div className="partner-billing-history-header">
              <div className="partner-billing-history-header-content">
                <h1 className="partner-billing-history-title">
                  <DollarSign size={24} className="mr-2" />
                  {t('partnerBilling.billingHistory') || 'Storico Fatturazione'}
                </h1>
                <p className="partner-billing-history-description">
                  {t('partnerBilling.billingHistorySubtitle') || 'Visualizza e gestisci le tue fatture'}
                </p>
              </div>
            </div>

            <div className="billing-stats-grid">
              <div className="stat-card">
                <div className="stat-icon total">
                  <FileText size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('partnerBilling.totalInvoices') || 'Totale Fatture'}</div>
                  <div className="stat-value">{billingStats.total}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon pending">
                  <Clock size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('partnerBilling.pending') || 'In Attesa'}</div>
                  <div className="stat-value">{billingStats.pending}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon paid">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('partnerBilling.paid') || 'Pagate'}</div>
                  <div className="stat-value">{billingStats.paid}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon overdue">
                  <AlertTriangle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('partnerBilling.overdue') || 'Scadute'}</div>
                  <div className="stat-value">{billingStats.overdue}</div>
                </div>
              </div>

              <div className="stat-card total-amount">
                <div className="stat-icon amount">
                  <DollarSign size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('partnerBilling.totalAmount') || 'Importo Totale'}</div>
                  <div className="stat-value">{formatCurrency(billingStats.totalAmount, payments[0]?.currency)}</div>
                </div>
              </div>
            </div>

            <div className="billing-filters">
              <div className="filter-group">
                <label className="filter-label">
                  <Filter size={16} />
                  {t('partnerBilling.status')}:
                </label>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  options={statusOptions}
                  placeholder={t('common.all')}
                  autoSelectSingle={false}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  <Calendar size={16} />
                  {t('partnerBilling.year')}:
                </label>
                <Select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  options={yearOptions}
                  placeholder={t('common.all')}
                  autoSelectSingle={false}
                />
              </div>
            </div>

            <div className="billing-table-container">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>{t('partnerBilling.invoiceNumber') || 'N. Fattura'}</th>
                    <th>{t('partnerBilling.period') || 'Periodo'}</th>
                    <th>{t('partnerBilling.plan') || 'Piano'}</th>
                    <th>{t('partnerBilling.amount') || 'Importo'}</th>
                    <th>{t('partnerBilling.activeUsers') || 'Utenti Attivi'}</th>
                    <th>{t('partnerBilling.dueDate') || 'Scadenza'}</th>
                    <th>{t('partnerBilling.status')}</th>
                    <th>{t('partnerContracts.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className={payment.is_overdue && payment.payment_status === 'pending' ? 'overdue-row' : ''}>
                      <td>
                        <div className="invoice-info">
                          <div className="invoice-number">{payment.invoice_number}</div>
                          {payment.transaction_reference && (
                            <div className="transaction-ref">{payment.transaction_reference}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="period-info">
                          <div>{formatDate(payment.payment_period_start)}</div>
                          <div className="period-separator">→</div>
                          <div>{formatDate(payment.payment_period_end)}</div>
                        </div>
                      </td>
                      <td>
                        <div className="plan-info">
                          {payment.partners_contracts?.partners_pricing_plans?.plan_name || '-'}
                        </div>
                      </td>
                      <td>
                        <div className="amount-info">
                          <div className="amount">{formatCurrency(payment.amount, payment.currency)}</div>
                          {payment.late_fee > 0 && (
                            <div className="late-fee">+{formatCurrency(payment.late_fee, payment.currency)} {t('partnerBilling.lateFee')}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="users-info">
                          {payment.active_users_count !== null ? (
                            <>
                              <span>{payment.active_users_count} / {payment.plan_active_users_limit || 0}</span>
                              {getOverLimitBadge(payment)}
                            </>
                          ) : '-'}
                        </div>
                      </td>
                      <td>
                        <div className="due-date-info">
                          {formatDate(payment.due_date)}
                          {payment.is_overdue && payment.payment_status === 'pending' && (
                            <div className="overdue-days">
                              {payment.overdue_days} {t('partnerBilling.daysOverdue') || 'giorni'}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(payment.payment_status, payment.is_overdue)}`}>
                          {getStatusLabel(payment.payment_status, payment.is_overdue)}
                        </span>
                      </td>
                      <td>
                        <div className="billing-actions">
                          <button 
                            className="action-btn download-btn"
                            onClick={() => handleDownloadInvoice(payment)}
                            disabled={downloadingId === payment.id}
                            title={t('partnerBilling.downloadInvoice')}
                          >
                            {downloadingId === payment.id ? (
                              <span className="downloading-spinner">⏳</span>
                            ) : (
                              <Download size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredPayments.length === 0 && (
                <div className="empty-state">
                  <FileText size={48} className="empty-icon" />
                  <p>{t('partnerBilling.noInvoices') || 'Nessuna fattura trovata'}</p>
                </div>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default Settings;
// src/components/customers/CustomerForm.jsx
import { FileText, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const CustomerForm = ({
  isOpen,
  onClose,
  onSuccess,
  onDelete,
  checkConstraints,
  customer = null,
  partnerUuid,
  userId = null,
  isProfileCompletion = false
}) => {
  const { t } = useTranslation();
  const isEditing = !!customer;

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
    customer_status: 'active',
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
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConstraints, setDeleteConstraints] = useState([]);

  // Document upload states
  const [documentUrl, setDocumentUrl] = useState(null);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentType, setDocumentType] = useState(null);

  const customerTypeOptions = [
    { value: 'individual', label: t('customers.individual') },
    { value: 'freelancer', label: t('customers.freelancer') },
    { value: 'entrepeneur', label: t('customers.entrepeneur') },
    { value: 'employee', label: t('customers.employee') },
    { value: 'tourist', label: t('customers.tourist') },
    { value: 'student', label: t('customers.student') },
    { value: 'affiliated', label: t('customers.affiliated') }
  ];

  const customerStatusOptions = [
    { value: 'active', label: t('customers.active') },
    { value: 'notactive', label: t('customers.notactive') }
  ];

  const needsBusinessInfo = ['freelancer', 'entrepeneur', 'company'].includes(formData.customer_type);

  useEffect(() => {
    if (customer) {
      logger.log('Loading customer data for editing:', customer);
      setFormData({
        first_name: customer.first_name || '',
        second_name: customer.second_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        zip: customer.zip || '',
        city: customer.city || '',
        country: customer.country || 'Italy',
        codice_fiscale: customer.codice_fiscale || '',
        customer_type: customer.customer_type || 'individual',
        customer_status: customer.customer_status || 'active',
        company_name: customer.company_name || '',
        piva: customer.piva || '',
        pec: customer.pec || '',
        sdi_code: customer.sdi_code || '',
        website: customer.website || '',
        billing_email: customer.billing_email || '',
        billing_phone: customer.billing_phone || '',
        billing_address: customer.billing_address || '',
        billing_zip: customer.billing_zip || '',
        billing_city: customer.billing_city || '',
        billing_country: customer.billing_country || 'Italy',
        notes: customer.notes || ''
      });
    } else {
      logger.log('Resetting form for new customer');
      setFormData({
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
        customer_status: 'active',
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
        notes: ''
      });
    }
  }, [customer]);

  // Load existing document
  useEffect(() => {
    if (customer && partnerUuid) {
      loadCurrentDocument();
    }
  }, [customer, partnerUuid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;

      if (isEditing) {
        result = await supabase
          .from('customers')
          .update(formData)
          .eq('id', customer.id)
          .select();
      } else {
        const customerData = {
          ...formData,
          partner_uuid: partnerUuid,
          user_id: userId || null
        };

        result = await supabase
          .from('customers')
          .insert([customerData])
          .select();
      }

      const { data, error } = result;

      if (error) throw error;

      toast.success(
        isEditing
          ? t('messages.customerUpdatedSuccessfully')
          : isProfileCompletion
            ? t('customers.profileCompletedSuccessfully')
            : t('messages.customerCreatedSuccessfully')
      );

      onSuccess(data[0]);
      if (!isProfileCompletion) {
        onClose();
      }
    } catch (error) {
      logger.error('Error saving customer:', error);
      toast.error(error.message || t('messages.errorSavingCustomer'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!customer || !checkConstraints) return;

    setDeleteLoading(true);
    const constraints = await checkConstraints(customer.id);
    setDeleteConstraints(constraints);
    setDeleteLoading(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!customer || !onDelete) return;

    if (deleteConstraints.length > 0) {
      setShowDeleteConfirm(false);
      setDeleteConstraints([]);
      return;
    }

    setDeleteLoading(true);
    const result = await onDelete(customer);
    setDeleteLoading(false);

    if (result.success) {
      setShowDeleteConfirm(false);
      setDeleteConstraints([]);
      onClose();
    } else if (result.constraints) {
      setDeleteConstraints(result.constraints);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteConstraints([]);
  };

  const loadCurrentDocument = async () => {
    if (!customer || !partnerUuid) return;

    try {
      const { data: files, error } = await supabase.storage
        .from('partners')
        .list(`${partnerUuid}/${customer.customer_uuid}`, {
          search: 'document_id'
        });

      if (error || !files || files.length === 0) {
        return;
      }

      const docFile = files[0];
      const extension = docFile.name.split('.').pop();
      setDocumentType(extension);

      const { data } = supabase.storage
        .from('partners')
        .getPublicUrl(`${partnerUuid}/${customer.customer_uuid}/${docFile.name}`);

      setDocumentUrl(data.publicUrl);
    } catch (error) {
      logger.error('Error loading document:', error);
    }
  };

  const handleDocumentSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const validTypes = ['application/pdf', 'image/png'];

    if (!validTypes.includes(fileType)) {
      toast.error(t('customers.documentTypeError'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('customers.documentSizeError'));
      return;
    }

    setDocumentUploading(true);

    try {
      await uploadDocumentFile(file);
      toast.success(t('messages.documentUploadedSuccessfully') || 'Document uploaded successfully');
    } catch (error) {
      logger.error('Error uploading document:', error);
      toast.error(t('messages.errorUploadingDocument') || 'Error uploading document');
    } finally {
      setDocumentUploading(false);
    }
  };

  const uploadDocumentFile = async (file) => {
    if (!file || !partnerUuid) return;

    const customerUuid = customer?.customer_uuid;
    if (!customerUuid) {
      throw new Error('Customer UUID required for document upload');
    }

    try {
      // Remove existing document
      const { data: existingFiles } = await supabase.storage
        .from('partners')
        .list(`${partnerUuid}/${customerUuid}`, {
          search: 'document_id'
        });

      if (existingFiles && existingFiles.length > 0) {
        for (const existingFile of existingFiles) {
          await supabase.storage
            .from('partners')
            .remove([`${partnerUuid}/${customerUuid}/${existingFile.name}`]);
        }
      }
    } catch (deleteError) {
      logger.log('No existing document to delete:', deleteError);
    }

    const extension = file.type === 'application/pdf' ? 'pdf' : 'png';
    const fileName = `document_id.${extension}`;
    const filePath = `${partnerUuid}/${customerUuid}/${fileName}`;

    const { error } = await supabase.storage
      .from('partners')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('partners')
      .getPublicUrl(filePath);

    setDocumentUrl(data.publicUrl);
    setDocumentType(extension);
  };

  const handleDocumentRemove = async () => {
    if (!customer || !partnerUuid) return;

    try {
      const { data: files } = await supabase.storage
        .from('partners')
        .list(`${partnerUuid}/${customer.customer_uuid}`, {
          search: 'document_id'
        });

      if (files && files.length > 0) {
        for (const file of files) {
          await supabase.storage
            .from('partners')
            .remove([`${partnerUuid}/${customer.customer_uuid}/${file.name}`]);
        }
      }

      setDocumentUrl(null);
      setDocumentType(null);
      toast.success(t('messages.documentRemovedSuccessfully') || 'Document removed successfully');
    } catch (error) {
      logger.error('Error removing document:', error);
      toast.error(t('messages.errorRemovingDocument') || 'Error removing document');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-container customer-form-modal">
          <div className="modal-header">
            <h2 className="modal-title">
              {isProfileCompletion
                ? t('customers.completeYourProfile')
                : isEditing
                  ? t('customers.editCustomer')
                  : t('customers.addCustomer')
              }
            </h2>
            {!isProfileCompletion && (
              <button onClick={onClose} className="modal-close-btn">
                <X size={24} />
              </button>
            )}
          </div>

          {isProfileCompletion && (
            <div className="profile-completion-notice">
              <p className="profile-completion-text">
                {t('customers.profileCompletionNotice')}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="modal-form">
            <h3 className="form-section-title">{t('customers.personalInformation')}</h3>

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
                  {t('customers.secondName')} *
                </label>
                <input
                  id="second_name"
                  name="second_name"
                  type="text"
                  required
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
                  {t('customers.phone')} *
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="form-input"
                  placeholder={t('placeholders.phonePlaceholder')}
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="codice_fiscale" className="form-label">
                {t('customers.codiceFiscale')}
              </label>
              <input
                id="codice_fiscale"
                name="codice_fiscale"
                type="text"
                className="form-input"
                placeholder={t('placeholders.codiceFiscalePlaceholder')}
                value={formData.codice_fiscale}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="customer_type" className="form-label">
                  {t('customers.type')}
                </label>
                <Select
                  name="customer_type"
                  value={formData.customer_type}
                  onChange={handleChange}
                  options={customerTypeOptions}
                  placeholder={t('customers.selectType')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="customer_status" className="form-label">
                  {t('customers.status')} *
                </label>
                {isProfileCompletion ? (
                  <input
                    id="customer_status"
                    name="customer_status"
                    type="text"
                    className="form-input"
                    value={t(`customers.${formData.customer_status}`)}
                    readOnly
                    disabled
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: '#666'
                    }}
                  />
                ) : (
                  <Select
                    name="customer_status"
                    value={formData.customer_status}
                    onChange={handleChange}
                    options={customerStatusOptions}
                    placeholder={t('customers.selectStatus')}
                  />
                )}
              </div>
            </div>

            {/* Document ID Upload */}
            <div className="form-group">
              <label className="form-label">
                {t('customers.documentId')}
              </label>

              {!documentUrl ? (
                <div className="document-upload-area">
                  <input
                    id="document-upload"
                    type="file"
                    accept="application/pdf,image/png"
                    onChange={handleDocumentSelect}
                    style={{ display: 'none' }}
                    disabled={!customer || documentUploading}
                  />
                  <label
                    htmlFor="document-upload"
                    className={`btn-fc-import ${(!customer || documentUploading) ? 'disabled' : ''}`}
                    style={{ cursor: (!customer || documentUploading) ? 'not-allowed' : 'pointer' }}
                  >
                    <Upload size={16} />
                    {documentUploading ? t('customers.documentUploading') : t('customers.uploadDocument')}
                  </label>
                  {!customer && (
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                      {t('customers.saveCustomerFirst') || 'Save customer first to upload document'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="document-preview">
                  <div className="document-info">
                    <FileText size={20} style={{ color: '#4f46e5' }} />
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="document-link"
                    >
                      {t('customers.viewDocument')} ({documentType?.toUpperCase()})
                    </a>
                  </div>
                  <div className="document-actions">
                    <label
                      htmlFor="document-replace"
                      className="btn-fc-import"
                      style={{ cursor: documentUploading ? 'not-allowed' : 'pointer' }}
                    >
                      <Upload size={16} />
                      {t('customers.replaceDocument')}
                    </label>
                    <input
                      id="document-replace"
                      type="file"
                      accept="application/pdf,image/png"
                      onChange={handleDocumentSelect}
                      style={{ display: 'none' }}
                      disabled={documentUploading}
                    />
                    <button
                      type="button"
                      onClick={handleDocumentRemove}
                      className="btn-secondary"
                      disabled={documentUploading}
                    >
                      <X size={16} />
                      {t('customers.removeDocument')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {needsBusinessInfo && (
              <>
                <h3 className="form-section-title">{t('customers.businessInformation')}</h3>

                <div className="form-group">
                  <label htmlFor="company_name" className="form-label">
                    {t('customers.companyName')}
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
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

                <h3 className="form-section-title">{t('customers.billingInformation')}</h3>

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
              </>
            )}

            <h3 className="form-section-title">{t('customers.notes')}</h3>
            <div className="form-group">
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="form-textarea"
                placeholder={t('placeholders.notesPlaceholder')}
                value={formData.notes}
                onChange={handleChange}
              />
            </div>

            <div className="modal-actions">
              {isEditing && !isProfileCompletion && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="btn-delete-customer"
                  disabled={loading || deleteLoading}
                >
                  {deleteLoading ? (
                    <div className="loading-spinner-small"></div>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      {t('customers.delete')}
                    </>
                  )}
                </button>
              )}

              <div className="modal-actions-right">
                <button
                  type="submit"
                  className="btn-primary-purple"
                  disabled={loading}
                >
                  {loading
                    ? (isEditing ? t('common.saving') + '...' : t('common.creating') + '...')
                    : isProfileCompletion
                      ? t('customers.completeProfile')
                      : (isEditing ? t('common.save') : t('common.create'))
                  }
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {deleteConstraints.length > 0
                  ? t('customers.cannotDeleteCustomer')
                  : t('customers.confirmDelete')
                }
              </h2>
              <button onClick={handleCancelDelete} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content">
              {deleteConstraints.length > 0 ? (
                <>
                  <p className="delete-modal-message">
                    {t('customers.activeConstraints')}:
                  </p>
                  <ul className="constraints-list">
                    {deleteConstraints.map((constraint, index) => (
                      <li key={index} className="constraint-item">
                        {constraint}
                      </li>
                    ))}
                  </ul>
                  <p className="delete-modal-warning">
                    {t('customers.resolveConstraintsFirst')}
                  </p>
                </>
              ) : (
                <p className="delete-modal-message">
                  {t('customers.confirmDeleteCustomer', {
                    customerName: `${customer?.first_name} ${customer?.second_name}`
                  })}
                </p>
              )}
            </div>

            <div className="delete-modal-actions">
              <button
                className="btn-secondary"
                onClick={handleCancelDelete}
                disabled={deleteLoading}
              >
                {deleteConstraints.length > 0 ? t('common.close') : t('common.cancel')}
              </button>

              {deleteConstraints.length === 0 && (
                <button
                  className="btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      {t('common.deleting')}...
                    </>
                  ) : (
                    t('customers.deleteCustomer')
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerForm;
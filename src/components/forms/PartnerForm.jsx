import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const PartnerForm = ({ isOpen, onClose, onSuccess, partner = null }) => {
  const { t } = useTranslation();
  const isEditing = !!partner;
  
  const [formData, setFormData] = useState({
    first_name: '',
    second_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    zip: '',
    city: '',
    country: '',
    partner_type: 'company',
    partner_status: 'active',
    piva: '',
    pec: '',
    website: '',
    // FattureInCloud fields
    fattureincloud_enabled: false,
    fattureincloud_api_token: '',
    fattureincloud_company_id: '',
    fattureincloud_default_vat: 22,
    fattureincloud_document_type: 'proforma'
  });
  
  const [loading, setLoading] = useState(false);

  // Update form data when partner changes
  useEffect(() => {
    if (partner) {
      console.log('Loading partner data for editing:', partner);
      setFormData({
        first_name: partner.first_name || '',
        second_name: partner.second_name || '',
        company_name: partner.company_name || '',
        email: partner.email || '',
        phone: partner.phone || '',
        address: partner.address || '',
        zip: partner.zip || '',
        city: partner.city || '',
        country: partner.country || '',
        partner_type: partner.partner_type || 'company',
        partner_status: partner.partner_status || 'active',
        piva: partner.piva || '',
        pec: partner.pec || '',
        website: partner.website || '',
        // FattureInCloud fields - NOW READING FROM DATABASE
        fattureincloud_enabled: partner.fattureincloud_enabled || false,
        fattureincloud_api_token: partner.fattureincloud_api_token || '',
        fattureincloud_company_id: partner.fattureincloud_company_id || '',
        fattureincloud_default_vat: partner.fattureincloud_default_vat || 22,
        fattureincloud_document_type: partner.fattureincloud_document_type || 'proforma'
      });
    } else {
      // Reset form for new partner
      console.log('Resetting form for new partner');
      setFormData({
        first_name: '',
        second_name: '',
        company_name: '',
        email: '',
        phone: '',
        address: '',
        zip: '',
        city: '',
        country: '',
        partner_type: 'company',
        partner_status: 'active',
        piva: '',
        pec: '',
        website: '',
        // FattureInCloud fields
        fattureincloud_enabled: false,
        fattureincloud_api_token: '',
        fattureincloud_company_id: '',
        fattureincloud_default_vat: 22,
        fattureincloud_document_type: 'proforma'
      });
    }
  }, [partner]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      
      if (isEditing) {
        // Update existing partner
        result = await supabase
          .from('partners')
          .update(formData)
          .eq('id', partner.id)
          .select();
      } else {
        // Create new partner
        result = await supabase
          .from('partners')
          .insert([formData])
          .select();
      }

      const { data, error } = result;

      if (error) throw error;

      toast.success(
        isEditing 
          ? t('messages.partnerUpdatedSuccessfully') 
          : t('messages.partnerCreatedSuccessfully')
      );
      
      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error saving partner:', error);
      toast.error(error.message || t('messages.errorSavingPartner'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('partners.editPartner') : t('partners.addPartner')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name" className="form-label">
                {t('partners.firstName')} *
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
                {t('partners.secondName')}
              </label>
              <input
                id="second_name"
                name="second_name"
                type="text"
                className="form-input"
                placeholder={t('placeholders.secondNamePlaceholder')}
                value={formData.second_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="company_name" className="form-label">
              {t('partners.companyName')}
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
                {t('partners.phone')}
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
            <label htmlFor="address" className="form-label">
              {t('partners.address')}
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="form-input"
              placeholder={t('placeholders.addressPlaceholder')}
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="zip" className="form-label">
                {t('partners.zip')}
              </label>
              <input
                id="zip"
                name="zip"
                type="text"
                className="form-input"
                placeholder={t('placeholders.zipPlaceholder')}
                value={formData.zip}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="city" className="form-label">
                {t('partners.city')}
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
                {t('partners.country')}
              </label>
              <input
                id="country"
                name="country"
                type="text"
                className="form-input"
                placeholder={t('placeholders.countryPlaceholder')}
                value={formData.country}
                onChange={handleChange}
              />
            </div>
          </div>

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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="piva" className="form-label">
                {t('partners.piva')}
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
              <label htmlFor="pec" className="form-label">
                {t('partners.pec')}
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
          </div>

          <div className="form-group">
            <label htmlFor="website" className="form-label">
              {t('partners.website')}
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

          {/* FattureInCloud Integration Section */}
          <div className="form-section">
            <div className="form-section-header">
              <h3 className="form-section-title">{t('partners.fattureincloud.title')}</h3>
              <p className="form-section-description">
                {t('partners.fattureincloud.description')}
              </p>
            </div>

            <div className="form-group">
              <div className="form-switch">
                <input
                  id="fattureincloud_enabled"
                  name="fattureincloud_enabled"
                  type="checkbox"
                  className="form-switch-input"
                  checked={formData.fattureincloud_enabled}
                  onChange={handleChange}
                />
                <label htmlFor="fattureincloud_enabled" className="form-switch-label">
                  <span className="form-switch-slider"></span>
                  <span className="form-switch-text">
                    {t('partners.fattureincloud.enabled')}
                  </span>
                </label>
              </div>
            </div>

            {formData.fattureincloud_enabled && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fattureincloud_api_token" className="form-label">
                      {t('partners.fattureincloud.apiToken')} *
                    </label>
                    <input
                      id="fattureincloud_api_token"
                      name="fattureincloud_api_token"
                      type="password"
                      className="form-input"
                      placeholder={t('placeholders.fattureincloudApiTokenPlaceholder')}
                      value={formData.fattureincloud_api_token}
                      onChange={handleChange}
                      required={formData.fattureincloud_enabled}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="fattureincloud_company_id" className="form-label">
                      {t('partners.fattureincloud.companyId')} *
                    </label>
                    <input
                      id="fattureincloud_company_id"
                      name="fattureincloud_company_id"
                      type="text"
                      className="form-input"
                      placeholder={t('placeholders.fattureincloudCompanyIdPlaceholder')}
                      value={formData.fattureincloud_company_id}
                      onChange={handleChange}
                      required={formData.fattureincloud_enabled}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fattureincloud_default_vat" className="form-label">
                      {t('partners.fattureincloud.defaultVat')}
                    </label>
                    <input
                      id="fattureincloud_default_vat"
                      name="fattureincloud_default_vat"
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      placeholder="22"
                      value={formData.fattureincloud_default_vat}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="fattureincloud_document_type" className="form-label">
                      {t('partners.fattureincloud.documentType')}
                    </label>
                    <select
                      id="fattureincloud_document_type"
                      name="fattureincloud_document_type"
                      className="form-select"
                      value={formData.fattureincloud_document_type}
                      onChange={handleChange}
                    >
                      <option value="proforma">{t('partners.fattureincloud.types.proforma')}</option>
                      <option value="invoice">{t('partners.fattureincloud.types.invoice')}</option>
                      <option value="estimate">{t('partners.fattureincloud.types.estimate')}</option>
                      <option value="receipt">{t('partners.fattureincloud.types.receipt')}</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading 
                ? (isEditing ? t('common.saving') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnerForm;
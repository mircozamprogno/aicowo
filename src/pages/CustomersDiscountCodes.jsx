// src/pages/CustomersDiscountCodes.jsx
import { DollarSign, Edit, Percent, Plus, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/pages/customers-discount-codes.css';

import logger from '../utils/logger';

const CustomersDiscountCodes = () => {
  const [discountCodes, setDiscountCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const { profile } = useAuth();
  const { t } = useTranslation();

  const isAdmin = profile?.role === 'admin';
  const partnerUuid = profile?.partner_uuid;

  useEffect(() => {
    if (isAdmin && partnerUuid) {
      fetchDiscountCodes();
    }
  }, [isAdmin, partnerUuid]);

  const fetchDiscountCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('customers_discount_codes')
        .select('*')
        .eq('partner_uuid', partnerUuid)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching discount codes:', error);
        toast.error(t('messages.errorLoadingDiscountCodes') || 'Error loading discount codes');
      } else {
        setDiscountCodes(data || []);
      }
    } catch (error) {
      logger.error('Error fetching discount codes:', error);
      toast.error(t('messages.errorLoadingDiscountCodes') || 'Error loading discount codes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = () => {
    setEditingCode(null);
    setShowForm(true);
  };

  const handleEditCode = (code) => {
    setEditingCode(code);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCode(null);
  };

  const handleFormSuccess = (savedCode) => {
    if (editingCode) {
      setDiscountCodes(prev =>
        prev.map(c => c.id === savedCode.id ? savedCode : c)
      );
      toast.success(t('messages.discountCodeUpdatedSuccessfully') || 'Discount code updated successfully');
    } else {
      setDiscountCodes(prev => [savedCode, ...prev]);
      toast.success(t('messages.discountCodeCreatedSuccessfully') || 'Discount code created successfully');
    }
    setShowForm(false);
    setEditingCode(null);
  };

  const handleDeleteSuccess = (deletedCodeId) => {
    setDiscountCodes(prev => prev.filter(c => c.id !== deletedCodeId));
    setShowForm(false);
    setEditingCode(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadgeClass = (code) => {
    if (!code.is_active) return 'status-inactive';

    const now = new Date();
    const validUntil = new Date(code.valid_until);
    const validFrom = new Date(code.valid_from);

    if (now > validUntil) return 'status-expired';
    if (now < validFrom) return 'status-scheduled';
    if (code.usage_limit && code.usage_count >= code.usage_limit) return 'status-used-up';

    return 'status-active';
  };

  const getStatusLabel = (code) => {
    const status = getStatusBadgeClass(code);
    switch (status) {
      case 'status-active': return t('discountCodes.active');
      case 'status-inactive': return t('discountCodes.inactive');
      case 'status-expired': return t('discountCodes.expired');
      case 'status-scheduled': return t('discountCodes.scheduled');
      case 'status-used-up': return t('discountCodes.usedUp');
      default: return t('discountCodes.unknown');
    }
  };

  const getUsagePercentage = (code) => {
    if (!code.usage_limit) return 0;
    return Math.min((code.usage_count / code.usage_limit) * 100, 100);
  };

  const filteredCodes = discountCodes.filter(code => {
    const statusMatch = filterStatus === 'all' || getStatusBadgeClass(code).includes(filterStatus);
    const typeMatch = filterType === 'all' || code.discount_type === filterType;
    return statusMatch && typeMatch;
  });

  const uniqueStatuses = [...new Set(discountCodes.map(c => getStatusBadgeClass(c).replace('status-', '')))];
  const uniqueTypes = [...new Set(discountCodes.map(c => c.discount_type))];

  const getStatusOptions = () => {
    return [
      { value: 'all', label: t('common.all') },
      ...uniqueStatuses.map(status => ({
        value: status,
        label: t(`discountCodes.${status}`)
      }))
    ];
  };

  const getTypeOptions = () => {
    return [
      { value: 'all', label: t('common.all') },
      ...uniqueTypes.map(type => ({
        value: type,
        label: t(`discountCodes.${type}`)
      }))
    ];
  };

  if (!isAdmin) {
    return (
      <div className="customers-discount-codes-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>{t('customersDiscountCodes.accessDeniedMessage') || 'Only partners can manage customer discount codes.'}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="customers-discount-codes-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="customers-discount-codes-page">
      <div className="customers-discount-codes-header">
        <div className="customers-discount-codes-header-content">
          <h1 className="customers-discount-codes-title">
            <Tag size={24} className="mr-2" />
            {t('customersDiscountCodes.title') || 'Customer Discount Codes'}
          </h1>
          <p className="customers-discount-codes-description">
            {t('customersDiscountCodes.subtitle') || 'Create and manage discount codes for your customers'}
          </p>

        </div>
        <div className="customers-discount-codes-header-actions">
          <button className="btn-discount-primary" onClick={handleAddCode}>
            <Plus size={16} className="mr-2" />
            {t('discountCodes.addCode')}
          </button>
        </div>
      </div>

      <div className="customers-discount-codes-filters">
        <div className="filter-group">
          <label htmlFor="status-filter" className="filter-label">
            {t('discountCodes.status')}:
          </label>
          <Select
            name="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={getStatusOptions()}
            placeholder={t('common.all')}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="type-filter" className="filter-label">
            {t('discountCodes.discountType')}:
          </label>
          <Select
            name="type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={getTypeOptions()}
            placeholder={t('common.all')}
          />
        </div>
      </div>

      <div className="customers-discount-codes-table-container">
        <div className="customers-discount-codes-table-wrapper">
          <table className="customers-discount-codes-table">
            <thead className="customers-discount-codes-table-head">
              <tr>
                <th className="customers-discount-codes-table-header">
                  {t('discountCodes.code')}
                </th>
                <th className="customers-discount-codes-table-header">
                  {t('discountCodes.discount')}
                </th>
                <th className="customers-discount-codes-table-header">
                  {t('discountCodes.validity')}
                </th>
                <th className="customers-discount-codes-table-header">
                  {t('discountCodes.usage')}
                </th>
                <th className="customers-discount-codes-table-header">
                  {t('discountCodes.status')}
                </th>
                <th className="customers-discount-codes-table-header">
                  {t('discountCodes.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="customers-discount-codes-table-body">
              {filteredCodes.map((code) => (
                <tr key={code.id} className="customers-discount-codes-table-row">
                  <td className="customers-discount-codes-table-cell">
                    <div className="code-info">
                      <div className="code-value">{code.code}</div>
                      <div className="code-description">{code.description}</div>
                    </div>
                  </td>
                  <td className="customers-discount-codes-table-cell">
                    <div className="discount-info">
                      <div className="discount-value">
                        {code.discount_type === 'percentage' ? (
                          <span className="percentage-discount" style={{ color: 'black' }}>
                            <Percent size={14} />
                            {code.discount_value}%
                          </span>
                        ) : (
                          <span className="fixed-discount" style={{ color: 'black' }}>
                            <DollarSign size={14} />
                            {code.discount_value}
                          </span>
                        )}
                      </div>
                      <div className="discount-type">
                        {t(`discountCodes.${code.discount_type}`)}
                      </div>
                    </div>
                  </td>
                  <td className="customers-discount-codes-table-cell">
                    <div className="validity-info">
                      <div className="validity-dates">
                        {formatDate(code.valid_from)} - {formatDate(code.valid_until)}
                      </div>
                      <div className="validity-remaining">
                        {new Date() > new Date(code.valid_until)
                          ? t('discountCodes.expired')
                          : `${Math.ceil((new Date(code.valid_until) - new Date()) / (1000 * 60 * 60 * 24))} days left`
                        }
                      </div>
                    </div>
                  </td>
                  <td className="customers-discount-codes-table-cell">
                    <div className="usage-info">
                      <div className="usage-stats">
                        <span className="usage-count">{code.usage_count || 0}</span>
                        {code.usage_limit && (
                          <>
                            <span className="usage-separator"> / </span>
                            <span className="usage-limit">{code.usage_limit}</span>
                          </>
                        )}
                      </div>
                      {code.usage_limit && (
                        <div className="usage-bar">
                          <div
                            className="usage-progress"
                            style={{ width: `${getUsagePercentage(code)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="customers-discount-codes-table-cell">
                    <span className={`status-badge ${getStatusBadgeClass(code)}`}>
                      {getStatusLabel(code)}
                    </span>
                  </td>
                  <td className="customers-discount-codes-table-cell">
                    <div className="code-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditCode(code)}
                        title={t('discountCodes.editCode')}
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCodes.length === 0 && (
            <div className="customers-discount-codes-empty">
              <Tag size={48} className="empty-icon" />
              <p>{discountCodes.length === 0 ? t('discountCodes.noCodesFound') : 'No codes match the current filters'}</p>
              {discountCodes.length === 0 && (
                <button
                  onClick={handleAddCode}
                  className="btn-discount-primary mt-4"
                >
                  {t('discountCodes.addFirstCode')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <DiscountCodeForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          onDeleteSuccess={handleDeleteSuccess}
          code={editingCode}
          partnerUuid={partnerUuid}
        />
      )}
    </div>
  );
};

const DiscountCodeForm = ({ isOpen, onClose, onSuccess, onDeleteSuccess, code = null, partnerUuid }) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const isEditing = !!code;

  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    description: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    usage_limit: '',
    is_active: true
  });

  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const discountTypeOptions = [
    { value: 'percentage', label: t('discountCodes.percentage') },
    { value: 'fixed_amount', label: t('discountCodes.fixedAmount') }
  ];

  useEffect(() => {
    if (code) {
      setFormData({
        code: code.code || '',
        discount_type: code.discount_type || 'percentage',
        discount_value: code.discount_value?.toString() || '',
        description: code.description || '',
        valid_from: code.valid_from ? new Date(code.valid_from).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        valid_until: code.valid_until ? new Date(code.valid_until).toISOString().split('T')[0] : '',
        usage_limit: code.usage_limit?.toString() || '',
        is_active: code.is_active !== undefined ? code.is_active : true
      });
    } else {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setFormData(prev => ({
        ...prev,
        valid_until: nextYear.toISOString().split('T')[0]
      }));
    }
  }, [code]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: result }));
  };

  const validateForm = () => {
    if (!formData.code.trim()) {
      toast.error(t('discountCodes.codeRequired') || 'Discount code is required');
      return false;
    }

    if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
      toast.error(t('discountCodes.validDiscountValueRequired') || 'Valid discount value is required');
      return false;
    }

    if (formData.discount_type === 'percentage' && parseFloat(formData.discount_value) > 100) {
      toast.error(t('discountCodes.percentageMax100') || 'Percentage discount cannot exceed 100%');
      return false;
    }

    if (!formData.valid_from) {
      toast.error(t('discountCodes.validFromRequired') || 'Valid from date is required');
      return false;
    }

    if (!formData.valid_until) {
      toast.error(t('discountCodes.validUntilRequired') || 'Valid until date is required');
      return false;
    }

    const startDate = new Date(formData.valid_from);
    const endDate = new Date(formData.valid_until);

    if (endDate <= startDate) {
      toast.error(t('discountCodes.endDateMustBeAfterStartDate') || 'End date must be after start date');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        partner_uuid: partnerUuid,
        code: formData.code.trim().toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        description: formData.description.trim() || null,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        is_active: formData.is_active,
        created_by_user_id: profile?.id
      };

      let result;

      if (isEditing) {
        result = await supabase
          .from('customers_discount_codes')
          .update(submitData)
          .eq('id', code.id)
          .eq('partner_uuid', partnerUuid)
          .select()
          .single();
      } else {
        result = await supabase
          .from('customers_discount_codes')
          .insert([submitData])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) {
        logger.error('Error saving discount code:', error);
        throw error;
      }

      toast.success(
        isEditing
          ? t('messages.discountCodeUpdatedSuccessfully') || 'Discount code updated successfully'
          : t('messages.discountCodeCreatedSuccessfully') || 'Discount code created successfully'
      );

      onSuccess(data);
      onClose();
    } catch (error) {
      logger.error('Error saving discount code:', error);
      if (error.code === '23505') {
        toast.error(t('discountCodes.codeAlreadyExists') || 'This discount code already exists');
      } else {
        toast.error(error.message || (isEditing ? t('messages.errorUpdatingDiscountCode') : t('messages.errorCreatingDiscountCode')));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('customers_discount_codes')
        .delete()
        .eq('id', code.id)
        .eq('partner_uuid', partnerUuid);

      if (error) {
        logger.error('Error deleting discount code:', error);
        toast.error(t('messages.errorDeletingDiscountCode') || 'Error deleting discount code');
        return;
      }

      toast.success(t('messages.discountCodeDeletedSuccessfully') || 'Discount code deleted successfully');
      onDeleteSuccess(code.id);
    } catch (error) {
      logger.error('Error deleting discount code:', error);
      toast.error(t('messages.errorDeletingDiscountCode') || 'Error deleting discount code');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-container customers-discount-code-modal">
          <div className="modal-header">
            <h2 className="modal-title">
              {isEditing ? t('discountCodes.editCode') : t('discountCodes.addCode')}
            </h2>
            <button onClick={onClose} className="modal-close-btn">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-section">
              <h3 className="form-section-title">{t('discountCodes.basicInfo')}</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="code" className="form-label">
                    {t('discountCodes.code')} *
                  </label>
                  <div className="code-input-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <input
                      id="code"
                      name="code"
                      type="text"
                      required
                      className="form-input"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="SUMMER25"
                      style={{ textTransform: 'uppercase', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="btn-secondary generate-btn"
                    >
                      {t('discountCodes.generate')}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="description" className="form-label">
                    {t('discountCodes.description')}
                  </label>
                  <input
                    id="description"
                    name="description"
                    type="text"
                    className="form-input"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Summer promotion discount"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">{t('discountCodes.discountSettings')}</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="discount_type" className="form-label">
                    {t('discountCodes.discountType')} *
                  </label>
                  <Select
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleChange}
                    options={discountTypeOptions}
                    placeholder={t('discountCodes.selectType')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discount_value" className="form-label">
                    {t('discountCodes.discountValue')} *
                  </label>
                  <input
                    id="discount_value"
                    name="discount_value"
                    type="text"
                    required
                    className="form-input"
                    value={formData.discount_value}
                    onChange={handleChange}
                    placeholder={formData.discount_type === 'percentage' ? '25' : '50.00'}
                  />
                  <small className="form-help">
                    {formData.discount_type === 'percentage'
                      ? t('discountCodes.percentageHelp') || 'Enter percentage (0-100)'
                      : t('discountCodes.fixedAmountHelp') || 'Enter fixed amount in USD'
                    }
                  </small>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">{t('discountCodes.validity')}</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="valid_from" className="form-label">
                    {t('discountCodes.validFrom')} *
                  </label>
                  <input
                    id="valid_from"
                    name="valid_from"
                    type="date"
                    required
                    className="form-input"
                    value={formData.valid_from}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="valid_until" className="form-label">
                    {t('discountCodes.validUntil')} *
                  </label>
                  <input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    required
                    className="form-input"
                    value={formData.valid_until}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">{t('discountCodes.usageSettings')}</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="usage_limit" className="form-label">
                    {t('discountCodes.usageLimit')} ({t('common.optional')})
                  </label>
                  <input
                    id="usage_limit"
                    name="usage_limit"
                    type="text"
                    className="form-input"
                    value={formData.usage_limit}
                    onChange={handleChange}
                    placeholder="100"
                  />
                  <small className="form-help">
                    {t('discountCodes.usageLimitHelp') || 'Leave empty for unlimited usage'}
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="form-checkbox"
                    />
                    <span className="checkbox-text">
                      {t('discountCodes.isActive')}
                    </span>
                  </label>
                  <small className="form-help">
                    {t('discountCodes.isActiveHelp') || 'Inactive codes cannot be used'}
                  </small>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn-danger"
                  style={{ animation: 'none', textTransform: 'none' }}
                  disabled={loading}
                >

                  {t('common.delete')}
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
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
                  className="btn-discount-primary"
                  disabled={loading}
                >
                  {loading
                    ? (isEditing ? t('common.updating') + '...' : t('common.creating') + '...')
                    : (isEditing ? t('common.save') : t('common.create'))
                  }
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('common.confirmDelete')}
              </h2>
              <button onClick={() => setShowDeleteConfirm(false)} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content">
              <div className="delete-warning">
                <Trash2 size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('common.warning') || 'Warning'}</h3>
                  <p>Are you sure you want to delete discount code "{code.code}"?</p>
                  <p className="warning-note">
                    This action cannot be undone and will affect any contracts using this discount code.
                  </p>
                </div>
              </div>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="btn-danger"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomersDiscountCodes;
import { DollarSign, Edit, Percent, Plus, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/pages/partner-discount-codes.css';

const PartnerDiscountCodes = () => {
  const [discountCodes, setDiscountCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const { profile } = useAuth();
  const { t } = useTranslation();

  // Check if user is superadmin
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchDiscountCodes();
    }
  }, [isSuperAdmin]);

  const fetchDiscountCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching discount codes:', error);
        // Mock data for development
        setDiscountCodes([
          {
            id: 1,
            code: 'LAUNCH25',
            discount_type: 'fixed_amount',
            discount_value: 200.00,
            description: 'Launch discount for new partners',
            valid_from: '2025-01-01',
            valid_until: '2025-12-31',
            usage_limit: 100,
            usage_count: 15,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            code: 'SUMMER30',
            discount_type: 'percentage',
            discount_value: 30,
            description: 'Summer promotion - 30% off',
            valid_from: '2025-06-01',
            valid_until: '2025-08-31',
            usage_limit: 50,
            usage_count: 8,
            is_active: true,
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 3,
            code: 'EXPIRED10',
            discount_type: 'percentage',
            discount_value: 10,
            description: 'Expired test discount',
            valid_from: '2024-01-01',
            valid_until: '2024-12-31',
            usage_limit: 20,
            usage_count: 20,
            is_active: false,
            created_at: new Date(Date.now() - 172800000).toISOString()
          }
        ]);
      } else {
        setDiscountCodes(data || []);
      }
    } catch (error) {
      console.error('Error fetching discount codes:', error);
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

  const handleDeleteCode = (code) => {
    setCodeToDelete(code);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('partners_discount_codes')
        .delete()
        .eq('id', codeToDelete.id);

      if (error) {
        console.error('Error deleting discount code:', error);
        toast.error(t('messages.errorDeletingDiscountCode') || 'Error deleting discount code');
        return;
      }

      setDiscountCodes(prev => prev.filter(c => c.id !== codeToDelete.id));
      toast.success(t('messages.discountCodeDeletedSuccessfully') || 'Discount code deleted successfully');
    } catch (error) {
      console.error('Error deleting discount code:', error);
      toast.error(t('messages.errorDeletingDiscountCode') || 'Error deleting discount code');
    } finally {
      setShowDeleteConfirm(false);
      setCodeToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setCodeToDelete(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  // Filter codes
  const filteredCodes = discountCodes.filter(code => {
    const statusMatch = filterStatus === 'all' || getStatusBadgeClass(code).includes(filterStatus);
    const typeMatch = filterType === 'all' || code.discount_type === filterType;
    return statusMatch && typeMatch;
  });

  // Get unique statuses and types for filters
  const uniqueStatuses = [...new Set(discountCodes.map(c => getStatusBadgeClass(c).replace('status-', '')))];
  const uniqueTypes = [...new Set(discountCodes.map(c => c.discount_type))];

  // Access control
  if (!isSuperAdmin) {
    return (
      <div className="discount-codes-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can manage discount codes.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="discount-codes-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="discount-codes-page">
      <div className="discount-codes-header">
        <div className="discount-codes-header-content">
          <h1 className="discount-codes-title">
            <Tag size={24} className="mr-2" />
            {t('discountCodes.title')}
          </h1>
          <p className="discount-codes-description">
            {t('discountCodes.subtitle')}
          </p>
          <div className="discount-codes-stats">
            <div className="stat-item">
              <span className="stat-label">{t('discountCodes.totalCodes')}</span>
              <span className="stat-value">{discountCodes.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('discountCodes.activeCodes')}</span>
              <span className="stat-value">
                {discountCodes.filter(c => getStatusBadgeClass(c) === 'status-active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('discountCodes.totalUsage')}</span>
              <span className="stat-value">
                {discountCodes.reduce((sum, c) => sum + (c.usage_count || 0), 0)}
              </span>
            </div>
          </div>
        </div>
        <div className="discount-codes-header-actions">
          <button className="add-code-btn" onClick={handleAddCode}>
            <Plus size={16} className="mr-2" />
            {t('discountCodes.addCode')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="discount-codes-filters">
        <div className="filter-group">
          <label htmlFor="status-filter" className="filter-label">
            {t('discountCodes.status')}:
          </label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.all')}</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {t(`discountCodes.${status}`)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="type-filter" className="filter-label">
            {t('discountCodes.discountType')}:
          </label>
          <select
            id="type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.all')}</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {t(`discountCodes.${type}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="discount-codes-table-container">
        <div className="discount-codes-table-wrapper">
          <table className="discount-codes-table">
            <thead className="discount-codes-table-head">
              <tr>
                <th className="discount-codes-table-header">
                  {t('discountCodes.code')}
                </th>
                <th className="discount-codes-table-header">
                  {t('discountCodes.discount')}
                </th>
                <th className="discount-codes-table-header">
                  {t('discountCodes.validity')}
                </th>
                <th className="discount-codes-table-header">
                  {t('discountCodes.usage')}
                </th>
                <th className="discount-codes-table-header">
                  {t('discountCodes.status')}
                </th>
                <th className="discount-codes-table-header">
                  {t('discountCodes.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="discount-codes-table-body">
              {filteredCodes.map((code) => (
                <tr key={code.id} className="discount-codes-table-row">
                  <td className="discount-codes-table-cell">
                    <div className="code-info">
                      <div className="code-value">{code.code}</div>
                      <div className="code-description">{code.description}</div>
                    </div>
                  </td>
                  <td className="discount-codes-table-cell">
                    <div className="discount-info">
                      <div className="discount-value">
                        {code.discount_type === 'percentage' ? (
                          <span className="percentage-discount">
                            <Percent size={14} />
                            {code.discount_value}%
                          </span>
                        ) : (
                          <span className="fixed-discount">
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
                  <td className="discount-codes-table-cell">
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
                  <td className="discount-codes-table-cell">
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
                  <td className="discount-codes-table-cell">
                    <span className={`status-badge ${getStatusBadgeClass(code)}`}>
                      {getStatusLabel(code)}
                    </span>
                  </td>
                  <td className="discount-codes-table-cell">
                    <div className="code-actions">
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => handleEditCode(code)}
                        title={t('discountCodes.editCode')}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteCode(code)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCodes.length === 0 && (
            <div className="discount-codes-empty">
              <Tag size={48} className="empty-icon" />
              <p>{discountCodes.length === 0 ? t('discountCodes.noCodesFound') : 'No codes match the current filters'}</p>
              {discountCodes.length === 0 && (
                <button 
                  onClick={handleAddCode}
                  className="btn-primary mt-4"
                >
                  {t('discountCodes.addFirstCode')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Discount Code Form Modal */}
      {showForm && (
        <DiscountCodeForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          code={editingCode}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && codeToDelete && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('common.confirmDelete')}
              </h2>
              <button onClick={handleDeleteCancel} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content">
              <div className="delete-warning">
                <Trash2 size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('common.warning') || 'Warning'}</h3>
                  <p>Are you sure you want to delete discount code "{codeToDelete.code}"?</p>
                  <p className="warning-note">
                    This action cannot be undone and will affect any contracts using this discount code.
                  </p>
                </div>
              </div>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
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
    </div>
  );
};

// Discount Code Form Component
const DiscountCodeForm = ({ isOpen, onClose, onSuccess, code = null }) => {
  const { user } = useAuth();
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

  useEffect(() => {
    if (code) {
      setFormData({
        code: code.code || '',
        discount_type: code.discount_type || 'percentage',
        discount_value: code.discount_value?.toString() || '',
        description: code.description || '',
        valid_from: code.valid_from || new Date().toISOString().split('T')[0],
        valid_until: code.valid_until || '',
        usage_limit: code.usage_limit?.toString() || '',
        is_active: code.is_active !== undefined ? code.is_active : true
      });
    } else {
      // Set default end date to 1 year from now
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
        code: formData.code.trim().toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        description: formData.description.trim() || null,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        is_active: formData.is_active,
        created_by_user_id: user?.id
      };

      let result;
      
      if (isEditing) {
        result = await supabase
          .from('partners_discount_codes')
          .update(submitData)
          .eq('id', code.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('partners_discount_codes')
          .insert([submitData])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) {
        console.error('Error saving discount code:', error);
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
      console.error('Error saving discount code:', error);
      if (error.code === '23505') { // Unique violation
        toast.error(t('discountCodes.codeAlreadyExists') || 'This discount code already exists');
      } else {
        toast.error(error.message || (isEditing ? t('messages.errorUpdatingDiscountCode') : t('messages.errorCreatingDiscountCode')));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container discount-code-modal">
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
                <div className="code-input-group">
                  <input
                    id="code"
                    name="code"
                    type="text"
                    required
                    className="form-input"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="SUMMER25"
                    style={{ textTransform: 'uppercase' }}
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
                <select
                  id="discount_type"
                  name="discount_type"
                  required
                  className="form-select"
                  value={formData.discount_type}
                  onChange={handleChange}
                >
                  <option value="percentage">{t('discountCodes.percentage')}</option>
                  <option value="fixed_amount">{t('discountCodes.fixedAmount')}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="discount_value" className="form-label">
                  {t('discountCodes.discountValue')} *
                </label>
                <input
                  id="discount_value"
                  name="discount_value"
                  type="number"
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  min="0"
                  max={formData.discount_type === 'percentage' ? '100' : undefined}
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
                  type="number"
                  min="1"
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
                ? (isEditing ? t('common.updating') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnerDiscountCodes;